#!/usr/bin/env python3

import argparse
import json
import re
import shutil
import struct
import subprocess
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FRAME_DIR = ROOT / "2.AR角色素材" / "2.一毛动画工程文件" / "emo3D动画黑色背景（png帧序列+MP4）" / "png"
DEFAULT_AUDIO_MP4 = ROOT / "2.AR角色素材" / "2.一毛动画工程文件" / "emo_粉色背景有声" / "emo_2_1.mp4"
DEFAULT_GLB = ROOT / "2.AR角色素材" / "1.3D模型文件-GLB" / "一毛坐姿.glb"
DEFAULT_SCENE_JPG = ROOT / "1.识别图素材" / "3.实际场景照片-jpg" / "一毛气模-实拍图01.jpg"
DEFAULT_OUTLINE_PNG = ROOT / "1.识别图素材" / "1.最终版识别图源文件-png" / "一毛-正视图.png"
DEFAULT_OUT_DIR = ROOT / "AR-WEBAPP" / "assets" / "step06"
DEFAULT_SCAN_DIR = ROOT / "AR-WEBAPP" / "assets" / "scan"


def parse_args():
  parser = argparse.ArgumentParser(description="Build prototype scan + Step06 runtime assets.")
  parser.add_argument("--frames", type=Path, default=DEFAULT_FRAME_DIR, help="Directory containing source PNG frames")
  parser.add_argument("--audio-mp4", type=Path, default=DEFAULT_AUDIO_MP4, help="MP4 containing source audio")
  parser.add_argument("--glb", type=Path, default=DEFAULT_GLB, help="GLB file to preserve")
  parser.add_argument("--scene-jpg", type=Path, default=DEFAULT_SCENE_JPG, help="Scene photo used for scan/ar background")
  parser.add_argument("--outline-png", type=Path, default=DEFAULT_OUTLINE_PNG, help="Transparent mascot PNG used for scan outline shape")
  parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR, help="Output step06 asset directory")
  parser.add_argument("--scan-dir", type=Path, default=DEFAULT_SCAN_DIR, help="Output scan asset directory")
  parser.add_argument("--frame-size", type=int, default=768, help="Square output size for intro frames")
  parser.add_argument("--scene-width", type=int, default=1200, help="Output width for scan/ar background")
  parser.add_argument("--outline-size", type=int, default=720, help="Square output size for scan outline mask")
  parser.add_argument("--colors", type=int, default=192, help="Palette size for compressed PNG frames")
  return parser.parse_args()


def natural_key(path: Path):
  parts = re.split(r"(\d+)", path.name)
  return [int(part) if part.isdigit() else part for part in parts]


def collect_frames(frame_dir: Path):
  frames = sorted(frame_dir.glob("*.png"), key=natural_key)
  if not frames:
    raise FileNotFoundError(f"No PNG frames found in {frame_dir}")
  return frames


def extract_audio_duration_ms(audio_mp4: Path):
  result = subprocess.run(
    ["afinfo", str(audio_mp4)],
    check=True,
    capture_output=True,
    text=True,
  )
  match = re.search(r"estimated duration:\s*([0-9.]+)\s*sec", result.stdout)
  if not match:
    raise RuntimeError("Could not parse duration from afinfo output.")
  return round(float(match.group(1)) * 1000)


def extract_audio(audio_mp4: Path, out_audio: Path):
  out_audio.parent.mkdir(parents=True, exist_ok=True)
  shutil.copy2(audio_mp4, out_audio)


def prepare_frame(src: Path, size: int, colors: int):
  image = Image.open(src).convert("RGBA")
  if image.size != (size, size):
    image.thumbnail((size, size), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    offset = ((size - image.size[0]) // 2, (size - image.size[1]) // 2)
    canvas.paste(image, offset, image)
    image = canvas
  return image.quantize(colors=colors, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).convert("RGBA")


def build_sequence(frames, size: int, colors: int, out_dir: Path):
  out_dir.mkdir(parents=True, exist_ok=True)
  urls = []
  for src in frames:
    prepared = prepare_frame(src, size=size, colors=colors)
    out_path = out_dir / src.name
    prepared.save(out_path, optimize=True)
    urls.append(f"assets/step06/sequence/{src.name}")
  return urls


def recolor_glb(src: Path, out_path: Path):
  data = src.read_bytes()
  magic, version, _ = struct.unpack_from("<III", data, 0)
  if magic != 0x46546C67 or version != 2:
    shutil.copy2(src, out_path)
    return

  offset = 12
  chunks = []
  while offset + 8 <= len(data):
    chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
    offset += 8
    chunk_data = data[offset:offset + chunk_length]
    offset += chunk_length
    chunks.append((chunk_type, chunk_data))

  if not chunks or chunks[0][0] != 0x4E4F534A:
    shutil.copy2(src, out_path)
    return

  gltf = json.loads(chunks[0][1].decode("utf-8").rstrip(" \t\r\n\0"))
  for material in gltf.get("materials", []):
    pbr = material.setdefault("pbrMetallicRoughness", {})
    pbr["baseColorFactor"] = [1.0, 0.49, 0.61, 1.0]
    pbr["metallicFactor"] = 0
    pbr["roughnessFactor"] = 0.82
    material["emissiveFactor"] = [0.02, 0.0, 0.01]

  json_chunk = json.dumps(gltf, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
  json_chunk += b" " * ((4 - len(json_chunk) % 4) % 4)
  rebuilt_chunks = [(0x4E4F534A, json_chunk), *chunks[1:]]

  total_length = 12 + sum(8 + len(chunk) for _, chunk in rebuilt_chunks)
  output = bytearray(struct.pack("<III", magic, version, total_length))
  for chunk_type, chunk_data in rebuilt_chunks:
    output += struct.pack("<II", len(chunk_data), chunk_type)
    output += chunk_data
  out_path.write_bytes(output)


def copy_glb(src: Path, out_dir: Path):
  out_dir.mkdir(parents=True, exist_ok=True)
  out_path = out_dir / "yimao-sitting.glb"
  recolor_glb(src, out_path)
  return out_path


def resize_scene(scene_jpg: Path, out_path: Path, width: int):
  image = Image.open(scene_jpg).convert("RGB")
  if image.width > width:
    ratio = width / image.width
    image = image.resize((width, round(image.height * ratio)), Image.Resampling.LANCZOS)
  out_path.parent.mkdir(parents=True, exist_ok=True)
  image.save(out_path, quality=90, optimize=True)


def build_outline_asset(src: Path, out_path: Path, size: int):
  image = Image.open(src).convert("RGBA")
  image.thumbnail((size, size), Image.Resampling.LANCZOS)
  canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
  offset = ((size - image.size[0]) // 2, (size - image.size[1]) // 2)
  canvas.paste(image, offset, image)
  out_path.parent.mkdir(parents=True, exist_ok=True)
  canvas.save(out_path, optimize=True)


def write_manifest(out_dir: Path, duration_ms: int, frame_urls, size: int):
  manifest = {
    "frameUrls": frame_urls,
    "frameCount": len(frame_urls),
    "introDurationMs": duration_ms,
    "frameDurationMs": round(duration_ms / len(frame_urls)),
    "audioUrl": "assets/step06/audio/yimao-intro.m4a",
    "glbUrl": "assets/step06/models/yimao-sitting.glb",
    "finalFrameUrl": frame_urls[-1],
    "width": size,
    "height": size,
    "fps": round(len(frame_urls) / (duration_ms / 1000), 3),
  }
  (out_dir / "manifest.json").write_text(
    json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
    encoding="utf-8",
  )


def main():
  args = parse_args()
  frames = collect_frames(args.frames)
  duration_ms = extract_audio_duration_ms(args.audio_mp4)

  frame_urls = build_sequence(
    frames,
    size=args.frame_size,
    colors=args.colors,
    out_dir=args.out_dir / "sequence",
  )
  extract_audio(args.audio_mp4, args.out_dir / "audio" / "yimao-intro.m4a")
  copy_glb(args.glb, args.out_dir / "models")
  write_manifest(args.out_dir, duration_ms=duration_ms, frame_urls=frame_urls, size=args.frame_size)

  resize_scene(args.scene_jpg, args.scan_dir / "scene-01.jpg", width=args.scene_width)
  build_outline_asset(args.outline_png, args.scan_dir / "yimao-outline.png", size=args.outline_size)


if __name__ == "__main__":
  main()
