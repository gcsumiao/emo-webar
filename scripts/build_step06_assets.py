#!/usr/bin/env python3

import argparse
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FRAME_DIR = ROOT / "AR-WEBAPP" / "assets" / "step06" / "frames"
DEFAULT_AUDIO_MP4 = ROOT / "AR-WEBAPP" / "assets" / "step06" / "audio" / "emo_2_1.mp4"
DEFAULT_GLB = ROOT / "AR-WEBAPP" / "assets" / "step06" / "models" / "yimao-sitting.glb"
DEFAULT_OUT_DIR = ROOT / "AR-WEBAPP" / "assets" / "step06"
def parse_args():
  parser = argparse.ArgumentParser(description="Build lightweight Step06 runtime assets.")
  parser.add_argument("--frames", type=Path, default=DEFAULT_FRAME_DIR, help="Directory containing source PNG frames")
  parser.add_argument("--audio-mp4", type=Path, default=DEFAULT_AUDIO_MP4, help="MP4 containing source audio")
  parser.add_argument("--glb", type=Path, default=DEFAULT_GLB, help="GLB file to preserve")
  parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR, help="Output step06 asset directory")
  parser.add_argument("--size", type=int, default=1024, help="Square output size for APNG and poster")
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
    image = image.resize((size, size), Image.Resampling.LANCZOS)
  image = image.quantize(colors=colors, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).convert("RGBA")
  return image


def build_apng(frames, size: int, colors: int, out_image: Path, out_poster: Path, frame_duration_ms: int):
  out_image.parent.mkdir(parents=True, exist_ok=True)
  out_poster.parent.mkdir(parents=True, exist_ok=True)

  with tempfile.TemporaryDirectory(prefix="step06-build-") as tmp_dir:
    tmp_dir_path = Path(tmp_dir)
    resized_paths = []

    for index, src in enumerate(frames):
      prepared = prepare_frame(src, size=size, colors=colors)
      temp_path = tmp_dir_path / f"frame_{index:04d}.png"
      prepared.save(temp_path, optimize=True)
      resized_paths.append(temp_path)

    poster_image = Image.open(resized_paths[0])
    poster_image.save(out_poster, optimize=True)

    apng_frames = [Image.open(path) for path in resized_paths]
    first_frame = apng_frames[0]
    append_frames = apng_frames[1:]
    first_frame.save(
      out_image,
      save_all=True,
      append_images=append_frames,
      duration=frame_duration_ms,
      loop=1,
      optimize=False,
      disposal=2,
      blend=0,
    )


def write_manifest(out_dir: Path, duration_ms: int, frame_count: int, size: int):
  manifest = {
    "introImageUrl": "assets/step06/intro/yimao-intro.apng",
    "introPosterUrl": "assets/step06/intro/yimao-intro-poster.png",
    "introDurationMs": duration_ms,
    "audioUrl": "assets/step06/audio/yimao-intro.m4a",
    "glbUrl": "assets/step06/models/yimao-sitting.glb",
    "width": size,
    "height": size,
    "fps": round(frame_count / (duration_ms / 1000), 3),
  }
  (out_dir / "manifest.json").write_text(
    json.dumps(manifest, indent=2, ensure_ascii=True) + "\n",
    encoding="utf-8",
  )


def main():
  args = parse_args()
  frames = collect_frames(args.frames)
  duration_ms = extract_audio_duration_ms(args.audio_mp4)
  frame_duration_ms = max(1, round(duration_ms / len(frames)))

  out_intro = args.out_dir / "intro" / "yimao-intro.apng"
  out_poster = args.out_dir / "intro" / "yimao-intro-poster.png"
  out_audio = args.out_dir / "audio" / "yimao-intro.m4a"
  out_models = args.out_dir / "models"

  build_apng(frames, size=args.size, colors=args.colors, out_image=out_intro, out_poster=out_poster, frame_duration_ms=frame_duration_ms)
  extract_audio(args.audio_mp4, out_audio)

  out_models.mkdir(parents=True, exist_ok=True)
  if args.glb.resolve() != (out_models / args.glb.name).resolve():
    shutil.copy2(args.glb, out_models / args.glb.name)

  write_manifest(args.out_dir, duration_ms=duration_ms, frame_count=len(frames), size=args.size)


if __name__ == "__main__":
  main()
