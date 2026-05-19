from __future__ import annotations

import base64
import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np


DEFAULT_MAX_IMAGE_BYTES = 4_000_000
DEFAULT_MAX_DIMENSION = 960


def _read_float(name: str, fallback: float) -> float:
    try:
        return float(os.getenv(name, fallback))
    except (TypeError, ValueError):
        return fallback


def _read_int(name: str, fallback: int) -> int:
    try:
        return int(os.getenv(name, fallback))
    except (TypeError, ValueError):
        return fallback


def _feature_name(value: str | None) -> str:
    next_value = (value or os.getenv("AR_OPENCV_FEATURE") or "AKAZE").upper()
    return "ORB" if next_value == "ORB" else "AKAZE"


def create_feature_extractor(name: str | None = None):
    feature = _feature_name(name)
    if feature == "ORB":
        return feature, cv2.ORB_create(
            nfeatures=_read_int("AR_OPENCV_ORB_FEATURES", 1600),
            scaleFactor=1.2,
            nlevels=8,
            fastThreshold=_read_int("AR_OPENCV_ORB_FAST_THRESHOLD", 8),
        )
    return feature, cv2.AKAZE_create(
        threshold=_read_float("AR_OPENCV_AKAZE_THRESHOLD", 0.0008),
        nOctaves=_read_int("AR_OPENCV_AKAZE_OCTAVES", 4),
        nOctaveLayers=_read_int("AR_OPENCV_AKAZE_OCTAVE_LAYERS", 4),
    )


def normalize_image(image: np.ndarray, max_dimension: int = DEFAULT_MAX_DIMENSION) -> np.ndarray:
    if image is None or image.size == 0:
        raise ValueError("Empty image.")

    height, width = image.shape[:2]
    longest = max(width, height)
    if longest > max_dimension:
        scale = max_dimension / float(longest)
        image = cv2.resize(image, (max(1, int(width * scale)), max(1, int(height * scale))), interpolation=cv2.INTER_AREA)

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe.apply(gray)


def decode_image_payload(payload: dict[str, Any], max_bytes: int = DEFAULT_MAX_IMAGE_BYTES) -> np.ndarray:
    encoded = payload.get("imageDataUrl") or payload.get("imageBase64") or payload.get("image") or ""
    if not encoded or not isinstance(encoded, str):
        raise ValueError("Missing imageDataUrl or imageBase64.")

    if encoded.startswith("data:"):
        _, encoded = encoded.split(",", 1)

    try:
        raw = base64.b64decode(encoded, validate=False)
    except Exception as error:
        raise ValueError("Invalid base64 image payload.") from error

    if len(raw) > max_bytes:
        raise ValueError(f"Image payload is too large: {len(raw)} bytes.")

    buffer = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Could not decode image payload.")
    return image


def extract_features(image: np.ndarray, extractor, max_dimension: int = DEFAULT_MAX_DIMENSION) -> tuple[np.ndarray, np.ndarray]:
    prepared = normalize_image(image, max_dimension=max_dimension)
    keypoints, descriptors = extractor.detectAndCompute(prepared, None)
    points = np.array([point.pt for point in keypoints], dtype=np.float32)
    if descriptors is None:
        descriptors = np.empty((0, 0), dtype=np.uint8)
    return points, descriptors.astype(np.uint8, copy=False)


@dataclass
class IndexedTarget:
    scene_id: str
    target_id: str
    target_index: int
    label: str
    kind: str
    ar_mode: str
    source_image_url: str
    source_path: str
    mind_file_url: str
    points: np.ndarray
    descriptors: np.ndarray


class OpenCvRecognizer:
    def __init__(self, metadata_path: str | Path, index_path: str | Path):
        self.metadata_path = Path(metadata_path)
        self.index_path = Path(index_path)
        self.metadata: dict[str, Any] = {}
        self.targets: list[IndexedTarget] = []
        self.feature_name = "AKAZE"
        self.extractor = None
        self.matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
        self.load()

    def load(self) -> None:
        if not self.metadata_path.exists() or not self.index_path.exists():
            raise FileNotFoundError(
                f"OpenCV recognition index is missing: {self.metadata_path} / {self.index_path}"
            )

        self.metadata = json.loads(self.metadata_path.read_text(encoding="utf-8"))
        self.feature_name, self.extractor = create_feature_extractor(self.metadata.get("feature"))
        arrays = np.load(self.index_path)
        targets: list[IndexedTarget] = []

        for entry in self.metadata.get("targets", []):
            descriptor_key = entry.get("descriptorKey")
            keypoint_key = entry.get("keypointKey")
            if not descriptor_key or not keypoint_key:
                continue
            descriptors = arrays[descriptor_key].astype(np.uint8, copy=False)
            points = arrays[keypoint_key].astype(np.float32, copy=False)
            targets.append(IndexedTarget(
                scene_id=str(entry.get("sceneId") or ""),
                target_id=str(entry.get("targetId") or ""),
                target_index=int(entry.get("targetIndex") or 0),
                label=str(entry.get("label") or entry.get("targetId") or ""),
                kind=str(entry.get("kind") or "planar-scene"),
                ar_mode=str(entry.get("arMode") or "screen-space"),
                source_image_url=str(entry.get("sourceImageUrl") or ""),
                source_path=str(entry.get("sourcePath") or ""),
                mind_file_url=str(entry.get("mindFileUrl") or entry.get("mindTargetUrl") or ""),
                points=points,
                descriptors=descriptors,
            ))

        self.targets = targets

    def recognize(self, image: np.ndarray, tenant: str = "emo", location: str = "store-a", max_candidates: int = 3) -> dict[str, Any]:
        started_at = time.perf_counter()
        max_dimension = _read_int("AR_OPENCV_MAX_DIMENSION", DEFAULT_MAX_DIMENSION)
        min_confidence = _read_float("AR_OPENCV_MIN_CONFIDENCE", 0.42)
        strong_confidence = _read_float("AR_OPENCV_STRONG_CONFIDENCE", 0.72)
        min_margin = _read_float("AR_OPENCV_MIN_MARGIN", 0.03)
        min_good_matches = _read_int("AR_OPENCV_MIN_GOOD_MATCHES", 18)
        min_inliers = _read_int("AR_OPENCV_MIN_INLIERS", 8)
        min_inlier_ratio = _read_float("AR_OPENCV_MIN_INLIER_RATIO", 0.20)

        query_points, query_descriptors = extract_features(image, self.extractor, max_dimension=max_dimension)
        if query_descriptors.size == 0 or len(query_points) == 0:
            return self._miss(
                tenant,
                location,
                reason="no-query-features",
                threshold=min_confidence,
                elapsed_ms=started_at,
                query_keypoints=len(query_points),
            )

        candidates = [
            candidate
            for target in self.targets
            if (candidate := self._score_target(query_points, query_descriptors, target))
        ]
        candidates.sort(key=lambda item: item["confidence"], reverse=True)
        top = candidates[:max(1, int(max_candidates or 3))]

        if not top:
            return self._miss(
                tenant,
                location,
                reason="no-candidates",
                threshold=min_confidence,
                elapsed_ms=started_at,
                query_keypoints=len(query_points),
            )

        best = top[0]
        second_confidence = float(top[1]["confidence"]) if len(top) > 1 else 0.0
        score_margin = max(0.0, float(best["confidence"]) - second_confidence)
        geometry_ok = (
            best["inlierCount"] >= min_inliers
            or best["inlierRatio"] >= min_inlier_ratio
            or best["goodMatchCount"] >= int(min_good_matches * 1.6)
        )
        matched = (
            best["confidence"] >= min_confidence
            and best["goodMatchCount"] >= min_good_matches
            and geometry_ok
            and (score_margin >= min_margin or best["confidence"] >= strong_confidence)
        )

        if not matched:
            return self._miss(
                tenant,
                location,
                reason="below-threshold",
                threshold=min_confidence,
                elapsed_ms=started_at,
                query_keypoints=len(query_points),
                confidence=best["confidence"],
                score_margin=score_margin,
                candidates=top,
            )

        target = best["target"]
        return {
            "schemaVersion": 1,
            "matched": True,
            "source": "opencv-recognition-service",
            "recognitionMode": "cloud-first",
            "tenant": tenant,
            "location": location,
            "sceneId": target.scene_id,
            "targetId": target.target_id,
            "targetIndex": target.target_index,
            "label": target.label,
            "kind": target.kind,
            "arMode": target.ar_mode or "screen-space",
            "confidence": round(float(best["confidence"]), 4),
            "scoreMargin": round(score_margin, 4),
            "mindFileUrl": target.mind_file_url,
            "mindTargetUrl": target.mind_file_url,
            "sourceImageUrl": target.source_image_url,
            "metrics": self._public_metrics(best),
            "candidates": [self._candidate_payload(candidate) for candidate in top],
            "elapsedMs": int((time.perf_counter() - started_at) * 1000),
        }

    def _score_target(self, query_points: np.ndarray, query_descriptors: np.ndarray, target: IndexedTarget) -> dict[str, Any] | None:
        if target.descriptors.size == 0 or query_descriptors.shape[1] != target.descriptors.shape[1]:
            return None

        ratio = _read_float("AR_OPENCV_LOWE_RATIO", 0.74)
        max_distance = _read_float("AR_OPENCV_MAX_DESCRIPTOR_DISTANCE", 92.0)
        raw_matches = self.matcher.knnMatch(query_descriptors, target.descriptors, k=2)
        good_matches = []
        for match_group in raw_matches:
            if not match_group:
                continue
            first = match_group[0]
            second = match_group[1] if len(match_group) > 1 else None
            ratio_ok = second is None or first.distance < ratio * second.distance
            if ratio_ok and first.distance <= max_distance:
                good_matches.append(first)

        good_count = len(good_matches)
        if good_count < 4:
            return None

        inlier_count = 0
        inlier_ratio = 0.0
        if good_count >= 8:
            src = np.float32([query_points[match.queryIdx] for match in good_matches]).reshape(-1, 1, 2)
            dst = np.float32([target.points[match.trainIdx] for match in good_matches]).reshape(-1, 1, 2)
            try:
                _, mask = cv2.findHomography(src, dst, cv2.RANSAC, _read_float("AR_OPENCV_RANSAC_THRESHOLD", 5.0))
            except cv2.error:
                mask = None
            if mask is not None:
                inlier_count = int(mask.ravel().sum())
                inlier_ratio = inlier_count / max(1, good_count)

        average_distance = sum(float(match.distance) for match in good_matches) / max(1, good_count)
        min_good_matches = _read_int("AR_OPENCV_MIN_GOOD_MATCHES", 18)
        min_inliers = _read_int("AR_OPENCV_MIN_INLIERS", 8)
        good_score = min(1.0, good_count / max(1.0, min_good_matches * 2.2))
        inlier_score = min(1.0, inlier_count / max(1.0, min_inliers * 2.0))
        ratio_score = min(1.0, inlier_ratio / 0.45)
        distance_score = max(0.0, 1.0 - average_distance / 92.0)
        confidence = (
            good_score * 0.34
            + inlier_score * 0.30
            + ratio_score * 0.22
            + distance_score * 0.14
        )

        return {
            "target": target,
            "confidence": float(min(1.0, confidence)),
            "goodMatchCount": good_count,
            "inlierCount": inlier_count,
            "inlierRatio": float(inlier_ratio),
            "averageDistance": float(average_distance),
            "targetKeypoints": int(len(target.points)),
        }

    def _miss(
        self,
        tenant: str,
        location: str,
        reason: str,
        threshold: float,
        elapsed_ms: float,
        query_keypoints: int = 0,
        confidence: float = 0.0,
        score_margin: float = 0.0,
        candidates: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        return {
            "schemaVersion": 1,
            "matched": False,
            "source": "opencv-recognition-service",
            "recognitionMode": "cloud-first",
            "tenant": tenant,
            "location": location,
            "arMode": "screen-space",
            "reason": reason,
            "confidence": round(float(confidence), 4),
            "scoreMargin": round(float(score_margin), 4),
            "threshold": threshold,
            "queryKeypoints": query_keypoints,
            "candidates": [self._candidate_payload(candidate) for candidate in candidates or []],
            "elapsedMs": int((time.perf_counter() - elapsed_ms) * 1000),
        }

    def _public_metrics(self, candidate: dict[str, Any]) -> dict[str, Any]:
        return {
            "goodMatchCount": int(candidate["goodMatchCount"]),
            "inlierCount": int(candidate["inlierCount"]),
            "inlierRatio": round(float(candidate["inlierRatio"]), 4),
            "averageDistance": round(float(candidate["averageDistance"]), 2),
            "targetKeypoints": int(candidate["targetKeypoints"]),
        }

    def _candidate_payload(self, candidate: dict[str, Any]) -> dict[str, Any]:
        target = candidate["target"]
        return {
            "sceneId": target.scene_id,
            "targetId": target.target_id,
            "targetIndex": target.target_index,
            "label": target.label,
            "kind": target.kind,
            "arMode": target.ar_mode,
            "confidence": round(float(candidate["confidence"]), 4),
            "metrics": self._public_metrics(candidate),
        }
