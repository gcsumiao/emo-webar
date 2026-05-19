# AR Manifest

The MindAR runtime loads AR target and render configuration from a JSON manifest.
The default local manifest lives at:

```text
public/assets/ar/manifest.json
```

To use a remote manifest, set:

```env
VITE_AR_MANIFEST_URL=https://your-cdn.com/ar/manifest.json
```

If `VITE_AR_MANIFEST_URL` is unset, the app requests `/assets/ar/manifest.json`.
If that request fails or returns invalid JSON, the frontend falls back to the built-in EMO defaults.

## Scene Catalog

The app now separates scene recognition from local MindAR tracking. The manifest points to a generated scene catalog:

```json
{
  "sceneCatalogUrl": "/assets/ar/mindar-scenes.json",
  "defaultSceneId": "targets",
  "mindTargetUrl": "/assets/mindar/targets.mind"
}
```

`mindTargetUrl` and `targets` remain supported for the original single-scene contract. When `sceneCatalogUrl` is present, the runtime loads the catalog and chooses one scene pack at a time.

The catalog shape is:

```json
{
  "schemaVersion": 1,
  "defaultSceneId": "targets",
  "scenes": [
    {
      "sceneId": "气模",
      "label": "气模",
      "mindTargetUrl": "/assets/mindar/气模targets.mind",
      "targetCount": 28
    }
  ]
}
```

For scenes without explicit `targets`, the runtime generates target metadata as `${sceneId}-${targetIndex}`. The default `targets` scene keeps the existing EMO target IDs and labels from `public/assets/ar/manifest.json`.

## What The Manifest Controls

The manifest can change model URLs, sprite frame URLs, target labels, per-target transforms, animation clip names, and sprite-to-GLB transition timing without changing frontend code.

It does not merge image targets at runtime. Each `.mind` file is a scene pack, and MindAR tracks only the active pack. A cloud or mock recognition result should choose `sceneId`; the frontend then loads that scene pack and lets MindAR handle local image tracking.

To add a new target pack:

1. Add the compiled `.mind` file to `public/assets/mindar`.
2. Run `npm run mindar:catalog`.
3. Run `npm run mindar:catalog:check`.
4. Add explicit target labels/transforms only if that scene needs custom behavior.

## Runtime Scene API

The local MindAR runtime exposes:

```js
window.__mindar.getSceneCatalog()
window.__mindar.getCurrentScene()
window.__mindar.switchScene(sceneId)
window.__mindar.recognizeFrameMock({ sceneId, targetIndex, confidence })
window.__mindar.applyRecognitionResult({ matched, sceneId, targetIndex, confidence })
window.__mindar.setMockSceneId(sceneId)
```

`switchScene(sceneId)` stops the current MindAR system, rebuilds the A-Frame scene with that scene's `mindTargetUrl`, and restarts scanning when the AR layer is active.

`applyRecognitionResult()` is the frontend placeholder for the future Kivicube-like recognition response. It switches scenes when `matched: true` and `sceneId` is provided; MindAR target-found events remain authoritative for local tracking.

`recognizeFrameMock()` is a frontend-only scene selection adapter for testing the future cloud recognition handoff. It returns `{ matched, sceneId, targetIndex, confidence, source: "mock" }`, reading `sceneId` from the function argument first, then `?mockScene=...`, then the debug scene picker state. It does not confirm a target by itself; it only selects the scene pack that MindAR should track locally.

For local testing:

- `?scene=气模&debug=1` starts directly on the `气模` scene pack.
- `?mockScene=水箱&debug=1` starts normally, then applies a mock recognition result for `水箱`.
- `?debug=1` shows a scene picker on the scan screen; choosing a scene calls `recognizeFrameMock()` and `applyRecognitionResult()`.

Target found/lost callbacks receive payloads that include:

```js
{
  sceneId,
  sceneLabel,
  mindTargetUrl,
  targetIndex,
  targetId,
  label
}
```

## Render Modes

- `gltf-only`: reveal the configured GLB directly after target recognition. This is the current Step 06 default.
- `sprite-only`: legacy mode that plays a sprite intro and keeps the sprite final pose.
- `sprite-then-gltf`: legacy mode that plays a sprite intro, reveals the GLB at the configured transform, then hides the sprite.

## Step 06 GLB Flow

Step 06 now uses `assets/step06/models/yimao_animation_ultra_fast_growth.glb` directly after scan success. The runtime uses the configured end frame to center the final projected mesh in the middle of the screen, then plays the configured animation window once and clamps that final pose. The frozen GLB object remains editable for move, 360-degree inspection, scale, capture, retake, and rescan.

The old PNG frame sequence is no longer part of the active Step 06 path.

The WebAR runtime does not add studio lighting, tone-mapping exposure, generated environment maps, or material brightness overrides to the final GLB. The configured model should carry the intended material and texture appearance itself so the AR layer renders it as close as possible to the source GLB.

## GLB Transform Space

The `defaultTarget.glb.position`, `rotation`, and `scale` values place the model inside the frozen camera-space AR object after recognition. They are model-relative offsets used for the final handoff pose, separate from the frozen parent transform that user gestures move, rotate, and scale during editing.

Final GLB interaction uses a transparent drag proxy, following the same separation used by Three.js DragControls examples: the pointer moves a proxy on a fixed camera-depth plane, and the GLB parent follows that proxy while the animated GLB nodes continue to play locally. Single-finger drag moves the model and rotates the frozen parent for 360-degree inspection: horizontal drag controls yaw, upward drag pitches the view to reveal the GLB bottom, and downward drag reveals the GLB top. Two-finger pinch only scales the model. The runtime clamps the projected GLB bounds so the editable model cannot be dragged off screen.

The runtime drag API accepts pointer positions and applies the same default bounds check on drag end:

```js
window.__mindar.beginFrozenDrag({ pointerId, clientX, clientY })
window.__mindar.dragFrozenToScreenPoint({ pointerId, clientX, clientY })
window.__mindar.endFrozenDrag({ clampToViewport: true })
window.__mindar.rotateFrozenBy({ yawDelta, pitchDelta })
window.__mindar.scaleFrozenBy({ scaleFactor })
```

## GLB Animation

Animations must be embedded in the GLB. Name clips clearly, for example:

```text
Intro
Idle
Tap
Outro
```

The manifest can reference `introClip` and `idleClip`, or use `playMode: "all-clips-once"` with a `clips` array when a GLB exports multiple clips that must start together:

```json
{
  "animation": {
    "playMode": "all-clips-once",
    "clips": ["Scene"],
    "fps": 24,
    "startFrame": 1,
    "endFrame": 70,
    "hiddenNodesUntilFrame": ["Polygon", "Polygon_2"],
    "revealHiddenNodesFrame": 52,
    "markers": [
      { "id": "drop-bounce", "frame": 1, "audio": "drop-bounce" },
      { "id": "branch-pop", "frame": 52, "audio": "branch-pop" }
    ],
    "clampIntroWhenFinished": true,
    "timeScale": 1
  }
}
```

Marker `frame` values are converted with `frame / fps`; Step 06 starts the `Scene` clip at frame 1 (`0.0417s`), plays `drop-bounce.mp3` immediately at that start frame, plays `branch-pop.mp3` at frame 52 (`2.1667s`), and stops/clamps playback at frame 70 (`2.9167s`). `hiddenNodesUntilFrame` keeps the branch and leaf nodes hidden until `revealHiddenNodesFrame`, preventing them from flashing before their growth animation. If configured clip names do not exist, the model still appears and the runtime emits a missing-animation diagnostic instead of crashing.

## Runtime Debug API

The local MindAR runtime exposes:

```js
window.__mindar.getFinalModelDebug()
```

`getFinalModelDebug()` reports the active GLB source, ready state, bounds, animation clip names, animation frame window, final yaw/pitch, and projected mesh center for checking final screen placement.
