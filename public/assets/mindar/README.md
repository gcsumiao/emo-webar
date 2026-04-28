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
- `freezeCurrentTarget()` copies the current anchored model into an editable scene-level frozen object.
- `unfreezeCurrentTarget()` hides the frozen object and restores live anchored content.
- `moveFrozenByScreenDelta({ dx, dy })` moves the frozen object along the camera-facing plane.
- `rotateFrozenBy({ yawDelta })` rotates the frozen object around the Y axis.
- `getFrozenState()` returns the current frozen transform and source target.

The scan and AR screens currently treat any configured target as an EMO hit. Spatial AR content lives under the MindAR anchor, so it follows the detected image's position, rotation, and scale.

## Frozen edit mode

When the user taps the shutter in the AR screen, `ARActive` calls `window.__mindar.freezeCurrentTarget()`. The runtime swaps from the live target-anchored sprite to `#frozen-ar-object`, keeps the final `1_0261.png` sprite visible in camera space, and lets the user edit it even if the physical target moves out of view.

Captured mode supports these gestures:

- **Move**: drag the middle camera area to reposition the frozen sprite.
- **Rotate**: twist with two fingers to rotate the sprite around the Y axis.
- **Scale**: pinch with two fingers while captured to scale the frozen sprite.

Retake calls `unfreezeCurrentTarget()` and returns to live anchored AR.

## Anchored AR content

The main Vite WebAR experience uses high-quality transparent PNG frames as the primary AR character, not `10249.MP4` and not the sitting GLB. The reference flow is Kivicube-like:

1. MindAR recognizes one of the 6 image targets.
2. The target anchor receives the live sprite plane.
3. The intro sequence plays exactly `1_0009.png` through `1_0065.png`, then `1_0242.png` through `1_0261.png`.
4. The live and captured final states both hold on `assets/step06/intro-hq/1_0261.png`.

`10249.MP4` is only a visual reference for timing and final composition. `yimao-sitting.glb` remains a static fallback/debug asset because it has no baked animation and does not match the desired landing sequence as closely as the PNG frames.

For a future Kivicube upload package, export separate platform-friendly images/video/GLB as needed. Do not reduce the Vite WebAR `intro-hq` sprite quality unless mobile performance testing shows a real problem.

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
