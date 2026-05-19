# MindAR image target packs

Each `.mind` file in this folder is a MindAR scene pack. The Vite WebAR runtime loads one pack at a time through the scene catalog at `public/assets/ar/mindar-scenes.json`.

The original `targets.mind` remains the default EMO flow. Additional files such as `气模targets.mind`, `水箱targets.mind`, and `电箱targets.mind` are selected by `sceneId` after recognition.

MindAR cannot discover this folder from the browser at runtime and does not load all packs simultaneously. When files are added or removed, regenerate the catalog:

```sh
npm run mindar:catalog
npm run mindar:catalog:check
```

## Default source images

The default `targets.mind` contains 6 image targets. Keep this order in sync with the default `targets` entries in `public/assets/ar/manifest.json`:

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
5. When compilation finishes, click **Download** and save the file to this folder.
6. Run `npm run mindar:catalog` so the frontend catalog includes the new or updated pack.
7. If you add, remove, or reorder targets inside a pack and need custom labels/transforms, update that scene's explicit `targets` metadata.

## Scene-pack runtime

MindAR supports multiple targets inside one `.mind` by uploading several images at compile time. Each image gets an auto-incrementing `targetIndex`, referenced by generated A-Frame anchors:

`MindARStage` generates one anchor for each configured target and attaches A-Frame content as that anchor's child:

```html
<a-entity mindar-image-target="targetIndex: 0" id="emo-anchor-0">
  <a-entity class="anchored-content">
    <a-gltf-model src="#emo-model"></a-gltf-model>
  </a-entity>
</a-entity>
```

Runtime state is exposed through `window.__mindar`:

- `getSceneCatalog()` returns the known scene packs from `mindar-scenes.json`.
- `getCurrentScene()` returns the active scene pack.
- `switchScene(sceneId)` rebuilds MindAR with another `.mind` file.
- `recognizeFrameMock({ sceneId, targetIndex, confidence })` returns a frontend-only mock recognition result for testing scene selection.
- `applyRecognitionResult({ matched, sceneId, targetIndex, confidence })` applies a future cloud/mock recognition result by switching scene packs.
- `setMockSceneId(sceneId)` stores the current debug scene picker choice for `recognizeFrameMock()`.
- `onTargetFound(cb)` receives `{ sceneId, sceneLabel, mindTargetUrl, targetIndex, targetId, label }`.
- `onTargetLost(cb)` receives `{ sceneId, sceneLabel, mindTargetUrl, targetIndex, targetId, label }`.
- `getActiveTargets()` returns all currently tracked targets.
- `getLastTarget()` returns the most recent target metadata.
- `freezeCurrentTarget()` copies the current anchored model into an editable scene-level frozen object.
- `unfreezeCurrentTarget()` hides the frozen object and restores live anchored content.
- `beginFrozenDrag({ pointerId, clientX, clientY })`, `dragFrozenToScreenPoint(...)`, and `endFrozenDrag({ clampToViewport })` move a transparent drag proxy on a fixed camera-depth plane, then sync the frozen object to it.
- `rotateFrozenBy({ yawDelta, pitchDelta })` rotates the frozen parent object for 360-degree GLB inspection without touching animated mesh internals.
- `scaleFrozenBy({ scaleFactor })` scales the frozen object and clamps it inside the visible AR edit area.
- `resetFrozenTransform()` restores the editable final GLB to the transform captured when the final animation frame first became live.
- `getFrozenState()` returns the current frozen transform and source target.

The scan and AR screens currently treat any configured target as an EMO hit. Spatial AR content lives under the MindAR anchor, so it follows the detected image's position, rotation, and scale. MindAR supports multiple targets in one compiled `.mind` pack; multiple packs require a scene selection step through `switchScene(sceneId)` or `applyRecognitionResult()`.

## Frozen edit mode

After scan success, Step 06 shows the configured animated GLB inside `#frozen-ar-object`. The frozen object remains editable even if the physical target moves out of view.

Live final mode uses no mode switch. When the GLB reaches its final animation frame and becomes editable, the UI shows a small dashed-arrow prompt near the model:

- **Tap prompt**: `tap me` in English mode or `点我` in Chinese mode. The prompt hides after the first touch on the editable GLB surface.

After that first touch, two white gesture pills remain visible during the editable final AR state:

- **Move / rotate**: drag the middle camera area with one finger. The pointer moves a transparent proxy object, the animated GLB parent follows it, horizontal drag yaws the model through 360 degrees, upward drag reveals the GLB bottom, and downward drag reveals the GLB top.
- **Scale**: pinch with two fingers. Two-finger gestures do not rotate or translate the model.

The gesture pills are language-specific: English mode shows only `Drag · 360°` and `Two-finger pinch`; Chinese mode shows only `拖动 · 360°` and `双指 · 缩放`. The editable final AR state intentionally avoids the older GLB outer circle, rotating arrows, scaling corner marks, and white dot guide elements.

A reset control sits beside the shutter in editable final mode. It shows `TAP TO RESET` in English mode or `一键还原` in Chinese mode, and calls `resetFrozenTransform()` to restore the GLB to the final-frame transform captured before user drag, rotation, or scale gestures.

When the user taps the shutter in the AR screen, `ARActive` calls `window.__mindar.freezeCurrentTarget()` and locks the current transform for capture/share. Retake calls `unfreezeCurrentTarget()` and returns to editable final AR.

## Anchored AR content

The main Vite WebAR experience now plays the animated Step 06 GLB directly after recognition. The reference flow is Kivicube-like:

1. Recognition chooses a scene pack, then MindAR recognizes one of that pack's image targets.
2. Targets configured with `renderMode: "gltf-only"` load `assets/step06/models/yimao_animation_ultra_fast_growth.glb`.
3. The runtime centers the projected frame-70 mesh at screen center, applies frame 1 before reveal, hides the `Polygon` and `Polygon_2` branch/leaf nodes until frame 52, plays the `Scene` clip from frame 1 to frame 70, clamps the final pose, and keeps the frozen GLB object for bounded proxy-drag move, single-finger 360 inspection, two-finger scale, and capture.
4. The active Step 06 path does not request the old PNG frame sequence.

The runtime intentionally avoids extra studio lights, tone-mapping exposure, generated environment maps, or material brightness overrides for the Step 06 GLB. The model should display from its own textures and material values.

Current audio contract:

- `assets/step06/audio/button-click.mp3` plays for non-final-AR page buttons, including scan controls.
- `assets/step06/audio/bgm.mp3` loops from scan through AR capture/retake/rescan flows.
- `assets/step06/audio/drop-bounce.mp3` overlays the BGM when the GLB timeline reaches frame 1 at 24fps (`0.0417s`).
- `assets/step06/audio/branch-pop.mp3` overlays the BGM when the GLB timeline reaches frame 52 at 24fps (`2.1667s`).
- `assets/step06/audio/shutter.mp3` overlays the BGM when the AR shutter is pressed.

This keeps the prototype frontend-only: no new production dependency, backend, or cloud recognition API is required for the GLB animation or audio marker changes.

For a future Kivicube upload package, export separate platform-friendly images/video/GLB as needed.

## Recognition placeholder

MindAR remains authoritative for known posters/packaging after a scene pack is selected. The future local AI or cloud recognizer should return a `sceneId` and optional `targetIndex`; the Vite runtime applies that through `window.__mindar.applyRecognitionResult()`.
