# MindAR image targets

`targets.mind` is consumed at runtime by MindAR (loaded via CDN in `Prototype.html`) to track image targets in the camera feed. It is a binary artifact — when the source image changes, recompile it with the steps below.

## Source images

The current `targets.mind` contains 6 image targets. Keep this order in sync with `MINDAR_TARGETS` in `AR-WEBAPP/Prototype.html`:

0. `../../../1.识别图素材/3.实际场景照片-jpg/一毛气模-实拍图01.jpg`
1. `../../../1.识别图素材/3.实际场景照片-jpg/一毛气模-实拍图02.jpg`
2. `../../../1.识别图素材/3.实际场景照片-jpg/产品-抱枕.jpg`
3. `../../../1.识别图素材/3.实际场景照片-jpg/产品-毛绒挂件01.jpg`
4. `../../../1.识别图素材/3.实际场景照片-jpg/产品-毛绒挂件02.JPG`
5. `../../../1.识别图素材/1.最终版识别图源文件-png/一毛-正视图.png`

## Recompile

1. Open the official compiler: <https://hiukim.github.io/mind-ar-js-doc/tools/compile>
2. Choose **Image Targets Compiler**.
3. Upload the source images above in the exact order listed here. Each image receives an auto-incrementing `targetIndex`.
4. Leave defaults, click **Start**.
5. When compilation finishes, click **Download** and save the file to this folder as `targets.mind` (overwrite).
6. If you add, remove, or reorder targets, update `MINDAR_TARGETS` in `AR-WEBAPP/Prototype.html`.

## Multi-target anchored runtime

MindAR supports multiple targets in a single `.mind` by uploading several images at once. Each gets an auto-incrementing `targetIndex`, referenced in `Prototype.html` via `<a-entity mindar-image-target="targetIndex: N">`.

`MindARStage` generates one anchor for each configured target and attaches A-Frame content as that anchor's child:

```html
<a-entity mindar-image-target="targetIndex: 0" id="emo-anchor-0">
  <a-entity class="anchored-content">
    <a-gltf-model src="#emo-model"></a-gltf-model>
  </a-entity>
</a-entity>
```

Runtime state is exposed through `window.__mindar`:

- `onTargetFound(cb)` receives `{ targetIndex, targetId, label, ar }`.
- `onTargetLost(cb)` receives `{ targetIndex, targetId, label, ar }`.
- `getActiveTargets()` returns all currently tracked targets.
- `getLastTarget()` returns the most recent target metadata.

The scan and AR screens currently treat any configured target as an EMO hit. Spatial AR content lives under the MindAR anchor, so it follows the detected image's position, rotation, and scale.

## Anchored AR content

Current A-Frame asset mapping in `Prototype.html`:

- `emo-model`: `../step06/models/yimao-sitting.glb`

All 6 targets currently use the same anchored GLB model with conservative default transforms:

```js
{
  type: 'model',
  assetId: 'emo-model',
  position: '0 0 0.08',
  rotation: '0 0 0',
  scale: '0.18 0.18 0.18'
}
```

To add richer Kivicube-style content later:

- Put GLB models in `AR-WEBAPP/assets/models/` or keep campaign-specific models under `AR-WEBAPP/assets/step06/models/`.
- Put video textures in `AR-WEBAPP/assets/videos/`.
- Add an A-Frame asset entry in `AFRAME_ASSETS`.
- Change the matching `MINDAR_TARGETS[n].ar` config to `type: 'model'`, `type: 'image'`, or `type: 'video'`.

Video assets should be muted, looped, and `playsinline`; `MindARStage` pauses video targets on `targetLost`.

## AI hybrid placeholder

`Prototype.html` also defines a browser-local AI placeholder at `window.__emoDetector`:

```js
window.__emoDetector.start({ source, intervalMs });
window.__emoDetector.stop();
window.__emoDetector.onResult((result) => {
  // result: { present, confidence, source: 'local-ai' }
});
```

MindAR remains authoritative for known posters/packaging. The future local AI model should only report open-scene EMO presence unless it is used as an auxiliary label beside a MindAR `targetIndex`.

The `.mind` URL is resolved relative to `Prototype.html`, so keep this file at `AR-WEBAPP/assets/mindar/targets.mind`.
