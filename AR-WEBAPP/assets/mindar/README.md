# MindAR image targets

`targets.mind` is consumed at runtime by MindAR (loaded via CDN in `Prototype.html`) to track image targets in the camera feed. It is a binary artifact — when the source image changes, recompile it with the steps below.

## Source image

- `../../../1.识别图素材/1.最终版识别图源文件-png/一毛-正视图.png`

High feature density, well-suited for MindAR image tracking.

## Recompile

1. Open the official compiler: <https://hiukim.github.io/mind-ar-js-doc/tools/compile>
2. Choose **Image Targets Compiler**.
3. Upload the source PNG above (or a resized 1024px wide copy — recompile time roughly tracks pixel count).
4. Leave defaults, click **Start**.
5. When compilation finishes, click **Download** and save the file to this folder as `targets.mind` (overwrite).

## Multi-target (future)

MindAR supports multiple targets in a single `.mind` by uploading several images at once. Each gets an auto-incrementing `targetIndex`, referenced in `Prototype.html` via `<a-entity mindar-image-target="targetIndex: N">`. To add poster/packaging variants, drop their PNGs into the compiler together with `一毛-正视图.png` and recompile.

## Runtime reference

Scene wiring lives in [`AR-WEBAPP/Prototype.html`](../../Prototype.html) inside the `MindARStage` component:

```html
<a-scene mindar-image="imageTargetSrc: assets/mindar/targets.mind; autoStart: false; ...">
  <a-entity mindar-image-target="targetIndex: 0" id="emo-anchor"></a-entity>
</a-scene>
```

The `.mind` URL is resolved relative to `Prototype.html`, so keep this file at `AR-WEBAPP/assets/mindar/targets.mind`.
