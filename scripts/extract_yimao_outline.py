"""Extract a white-on-transparent silhouette of 一毛 from a reference frame.

Source: 2.AR角色素材/.../png/1_0084.png (pink mascot on sky-blue gradient)
Output: AR-WEBAPP/assets/scan/yimao-outline.png

Strategy:
  - Load RGB, detect "pink-dominant" pixels where R > G and R > B by a margin.
  - Morph close to fill holes, open to drop speckles.
  - Crop to the silhouette bounding box + small padding so the PNG rect maps
    cleanly to a CSS frame {left, top, width, height}.
  - Write alpha-only PNG: white where mascot, transparent elsewhere.
"""

from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

SRC = Path("/Users/sumiaoc/Downloads/emo-checklist/2.AR角色素材/2.一毛动画工程文件/emo3D动画黑色背景（png帧序列+MP4）/png/1_0084.png")
OUT = Path("/Users/sumiaoc/Downloads/emo-checklist/AR-WEBAPP/assets/scan/yimao-outline.png")


def main() -> None:
    img = Image.open(SRC).convert("RGB")
    arr = np.asarray(img, dtype=np.int16)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]

    # Pink dominance: red channel comfortably above green AND blue.
    # Also require reasonable brightness so we don't grab dark fringe noise.
    pink = (r - g > 18) & (r - b > 18) & (r > 140)

    mask = pink.astype(np.uint8) * 255
    m = Image.fromarray(mask, mode="L")

    # Morph close (fill tiny gaps from eyes/mouth/shadow) + open (drop noise).
    m = m.filter(ImageFilter.MaxFilter(7))   # dilate
    m = m.filter(ImageFilter.MinFilter(7))   # erode → close
    m = m.filter(ImageFilter.MinFilter(3))   # erode
    m = m.filter(ImageFilter.MaxFilter(3))   # dilate → open
    m = m.filter(ImageFilter.GaussianBlur(1.5))

    mask_arr = np.asarray(m)
    ys, xs = np.where(mask_arr > 40)
    if len(xs) == 0:
        raise SystemExit("No silhouette detected — tune thresholds.")
    pad = 6
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, mask_arr.shape[1])
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, mask_arr.shape[0])
    cropped = mask_arr[y0:y1, x0:x1]

    h, w = cropped.shape
    out = np.zeros((h, w, 4), dtype=np.uint8)
    out[..., 0] = 255
    out[..., 1] = 255
    out[..., 2] = 255
    out[..., 3] = cropped

    Image.fromarray(out, mode="RGBA").save(OUT, optimize=True)
    print(f"Wrote {OUT}")
    print(f"Silhouette size: {w}x{h}  aspect {w/h:.3f}")
    print(f"Original bbox in source: x=[{x0},{x1}) y=[{y0},{y1}) of {mask_arr.shape[1]}x{mask_arr.shape[0]}")


if __name__ == "__main__":
    main()
