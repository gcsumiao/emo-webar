from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote, urljoin

import cv2
import numpy as np

from .recognizer import create_feature_extractor, extract_features


IMAGE_EXT_RE = re.compile(r"\.(png|jpe?g|webp)$", re.IGNORECASE)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the OpenCV cloud recognition index.")
    parser.add_argument("--repo-root", default=os.getenv("AR_RECOGNITION_REPO_ROOT", "/workspace"))
    parser.add_argument("--source-root", default=os.getenv("AR_RECOGNITION_SOURCE_ROOT", ""))
    parser.add_argument("--output-dir", default=os.getenv("AR_RECOGNITION_DATA_DIR", "/app/data"))
    parser.add_argument("--check", action="store_true")
    return parser.parse_args()


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def to_posix(path: str | Path) -> str:
    return Path(path).as_posix()


def strip_ext(filename: str) -> str:
    return re.sub(r"\.[^.]+$", "", filename)


def locale_key(value: str) -> list[Any]:
    return [int(part) if part.isdigit() else part.casefold() for part in re.split(r"(\d+)", value)]


def matches_prefix(filename: str, prefix: str) -> bool:
    if not IMAGE_EXT_RE.search(filename):
        return False
    if not prefix:
        return True
    stem = strip_ext(filename)
    return stem == prefix or stem.startswith(f"{prefix} ") or stem.startswith(f"{prefix}-")


def resolve_source_root(repo_root: Path, config: dict[str, Any], requested: str) -> Path:
    candidates: list[str] = []
    if requested:
        candidates.append(requested)
    candidates.extend(config.get("sourceRootCandidates") or [])

    for candidate in candidates:
        resolved = Path(candidate)
        if not resolved.is_absolute():
            resolved = repo_root / resolved
        if resolved.exists():
            return resolved

    raise FileNotFoundError("Could not find recognition source root. Set AR_RECOGNITION_SOURCE_ROOT.")


def normalize_file_entry(entry: Any, defaults: dict[str, Any]) -> dict[str, Any]:
    if isinstance(entry, str):
        return {"path": to_posix(entry), **defaults}
    if isinstance(entry, dict):
        path = entry.get("path") or entry.get("file")
        if not path:
            raise ValueError(f"Recognition file entry is missing path: {entry}")
        return {"path": to_posix(path), **defaults, **entry}
    raise TypeError(f"Unsupported recognition file entry: {entry!r}")


def list_matching_files(source_root: Path, group: dict[str, Any], defaults: dict[str, Any]) -> list[dict[str, Any]]:
    group_defaults = {**defaults}
    for key in ("kind", "arMode", "targetId", "label"):
        if group.get(key) is not None:
            group_defaults[key] = group[key]

    if isinstance(group.get("files"), list):
        return [normalize_file_entry(entry, group_defaults) for entry in group["files"]]

    folder = group.get("folder")
    if not folder:
        return []

    folder_path = source_root / folder
    names = [name for name in os.listdir(folder_path) if IMAGE_EXT_RE.search(name)]
    prefixes = group.get("prefixes") or [""]
    files: list[dict[str, Any]] = []
    for prefix in prefixes:
        for name in sorted((item for item in names if matches_prefix(item, prefix)), key=locale_key):
            files.append({"path": to_posix(Path(folder) / name), **group_defaults})
    return files


def expand_scene_files(source_root: Path, scene_config: dict[str, Any], defaults: dict[str, Any]) -> list[dict[str, Any]]:
    groups = scene_config.get("groups") if isinstance(scene_config.get("groups"), list) else [scene_config]
    files: list[dict[str, Any]] = []
    for group in groups:
        files.extend(list_matching_files(source_root, group, defaults))
    return files


def source_image_url(source_path: str, source_base_url: str) -> str:
    if source_base_url == "source://":
        return f"source://{source_path}"
    encoded = "/".join(quote(part) for part in source_path.split("/"))
    return urljoin(source_base_url.rstrip("/") + "/", encoded)


def target_metadata(scene: dict[str, Any], manifest: dict[str, Any], target_index: int, source: dict[str, Any]) -> dict[str, Any]:
    manifest_targets = manifest.get("targets") if isinstance(manifest.get("targets"), list) else []
    manifest_target = None
    if scene.get("sceneId") == manifest.get("defaultSceneId"):
        manifest_target = next((target for target in manifest_targets if int(target.get("targetIndex", -1)) == target_index), None)
    label = source.get("label") or (manifest_target or {}).get("label") or strip_ext(Path(source["path"]).name)
    target_id = source.get("targetId") or (manifest_target or {}).get("targetId") or f"{scene.get('sceneId')}-{target_index}"
    return {"targetId": target_id, "label": label}


def main() -> int:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    output_dir = Path(args.output_dir).resolve()
    config = read_json(repo_root / "recognition" / "target-sources.json")
    catalog = read_json(repo_root / "public" / "assets" / "ar" / "mindar-scenes.json")
    manifest = read_json(repo_root / "public" / "assets" / "ar" / "manifest.json")
    source_root = resolve_source_root(repo_root, config, args.source_root)
    source_base_url = os.getenv("AR_RECOGNITION_SOURCE_BASE_URL", "source://")
    feature_name, extractor = create_feature_extractor(os.getenv("AR_OPENCV_FEATURE"))
    scenes_by_id = {scene.get("sceneId"): scene for scene in catalog.get("scenes", [])}
    warnings: list[str] = []
    targets: list[dict[str, Any]] = []
    arrays: dict[str, np.ndarray] = {}

    for scene_config in config.get("scenes", []):
        scene_id = scene_config.get("sceneId")
        scene = scenes_by_id.get(scene_id)
        if not scene:
            warnings.append(f"Unknown scene in recognition mapping: {scene_id}")
            continue

        defaults = {
            "kind": scene_config.get("kind") or config.get("defaultKind") or "planar-scene",
            "arMode": scene_config.get("arMode") or config.get("defaultArMode") or "screen-space",
        }
        files = expand_scene_files(source_root, scene_config, defaults)
        if int(scene.get("targetCount") or 0) != len(files):
            warnings.append(f"{scene_id}: source count {len(files)} does not match catalog targetCount {scene.get('targetCount')}")

        for target_index, source in enumerate(files):
            source_path = source["path"]
            absolute_path = source_root / source_path
            if not absolute_path.exists():
                warnings.append(f"{scene_id}: missing source image {source_path}")
                continue

            image = cv2.imdecode(np.frombuffer(absolute_path.read_bytes(), dtype=np.uint8), cv2.IMREAD_COLOR)
            if image is None:
                warnings.append(f"{scene_id}: could not decode source image {source_path}")
                continue

            points, descriptors = extract_features(image, extractor)
            keypoint_key = f"points_{len(targets)}"
            descriptor_key = f"descriptors_{len(targets)}"
            arrays[keypoint_key] = points
            arrays[descriptor_key] = descriptors
            metadata = target_metadata(scene, manifest, target_index, source)
            targets.append({
                "sceneId": scene_id,
                "targetIndex": target_index,
                "targetId": metadata["targetId"],
                "label": metadata["label"],
                "kind": source.get("kind") or defaults["kind"],
                "arMode": source.get("arMode") or defaults["arMode"],
                "sourceImageUrl": source_image_url(source_path, source_base_url),
                "sourcePath": source_path,
                "mindFileUrl": scene.get("mindTargetUrl") or scene.get("mindFileUrl") or "",
                "mindTargetUrl": scene.get("mindTargetUrl") or scene.get("mindFileUrl") or "",
                "keypointKey": keypoint_key,
                "descriptorKey": descriptor_key,
                "keypointCount": int(len(points)),
                "descriptorCount": int(len(descriptors)),
            })

    metadata = {
        "schemaVersion": 1,
        "algorithm": "opencv-feature-recognition-v1",
        "feature": feature_name,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceRootHint": to_posix(source_root.relative_to(repo_root)) if source_root.is_relative_to(repo_root) else str(source_root),
        "catalogUrl": "/assets/ar/mindar-scenes.json",
        "targetCount": len(targets),
        "warnings": warnings,
        "targets": targets,
    }

    metadata_path = output_dir / "opencv-metadata.json"
    index_path = output_dir / "opencv-index.npz"
    if args.check:
        if not metadata_path.exists() or not index_path.exists():
            print("OpenCV recognition index is missing. Run npm run recognition:opencv:index.", file=sys.stderr)
            return 1
        current = read_json(metadata_path)
        if current.get("targetCount") != metadata["targetCount"] or current.get("feature") != metadata["feature"]:
            print("OpenCV recognition index metadata is out of date. Run npm run recognition:opencv:index.", file=sys.stderr)
            return 1
        print(f"OpenCV recognition index exists ({metadata['targetCount']} targets, {metadata['feature']}).")
        return 0

    output_dir.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(index_path, **arrays)
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for warning in warnings:
        print(warning, file=sys.stderr)
    print(f"Wrote {metadata_path} and {index_path} with {len(targets)} targets.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
