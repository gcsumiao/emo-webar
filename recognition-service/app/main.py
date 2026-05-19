from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException

from .recognizer import DEFAULT_MAX_IMAGE_BYTES, OpenCvRecognizer, decode_image_payload


def _index_paths() -> tuple[Path, Path]:
    data_dir = Path(os.getenv("AR_RECOGNITION_DATA_DIR", "/app/data"))
    metadata_path = Path(os.getenv("AR_RECOGNITION_OPENCV_METADATA", data_dir / "opencv-metadata.json"))
    index_path = Path(os.getenv("AR_RECOGNITION_OPENCV_INDEX", data_dir / "opencv-index.npz"))
    return metadata_path, index_path


app = FastAPI(title="EMO AR OpenCV Recognition Service", version="1.0.0")
recognizer: OpenCvRecognizer | None = None
startup_error: str | None = None


def _int_value(value: Any, fallback: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


@app.on_event("startup")
def load_recognizer() -> None:
    global recognizer, startup_error
    metadata_path, index_path = _index_paths()
    try:
        recognizer = OpenCvRecognizer(metadata_path=metadata_path, index_path=index_path)
        startup_error = None
    except Exception as error:
        recognizer = None
        startup_error = str(error)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": recognizer is not None,
        "targetCount": len(recognizer.targets) if recognizer else 0,
        "feature": recognizer.feature_name if recognizer else None,
        "error": startup_error,
    }


@app.post("/recognize")
def recognize(payload: dict[str, Any]) -> dict[str, Any]:
    if recognizer is None:
        raise HTTPException(status_code=503, detail=startup_error or "Recognition index is not loaded.")

    max_bytes = _int_value(os.getenv("AR_RECOGNITION_MAX_IMAGE_BYTES"), DEFAULT_MAX_IMAGE_BYTES)
    try:
        image = decode_image_payload(payload, max_bytes=max_bytes)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    tenant = str(payload.get("tenant") or os.getenv("AR_DEFAULT_TENANT") or "emo")
    location = str(payload.get("location") or os.getenv("AR_DEFAULT_LOCATION") or "store-a")
    max_candidates = _int_value(payload.get("maxCandidates") or os.getenv("AR_RECOGNITION_MAX_CANDIDATES"), 3)
    return recognizer.recognize(image, tenant=tenant, location=location, max_candidates=max_candidates)
