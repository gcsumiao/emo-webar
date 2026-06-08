# AR Manifest

The default runtime is a manual AR trigger that loads render configuration from a JSON manifest, shows the live camera preview, and reveals the configured GLB when the user taps the lock button. The legacy MindAR image-tracking runtime remains available with `?mode=mindar`.
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

The app separates scene selection from rendering. In default manual mode, the selected scene/target is a trigger payload only; no `.mind` pack is loaded. In legacy `?mode=mindar`, the selected scene pack is loaded and MindAR handles local image tracking.

The manifest points to a generated scene catalog:

```json
{
  "sceneCatalogUrl": "/assets/ar/mindar-scenes.json",
  "defaultSceneId": "targets",
  "mindTargetUrl": "/assets/mindar/targets.mind"
}
```

`mindTargetUrl` and `targets` remain supported for the original single-scene contract. When `sceneCatalogUrl` is present, the runtime loads the catalog and chooses one scene at a time. Default manual mode uses the scene metadata but does not fetch `mindTargetUrl`; legacy MindAR mode fetches the active scene's `.mind` pack.

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

The manifest can change model URLs, sprite frame URLs, target labels, per-target transforms, animation clip names, GLB lighting/material tuning, and sprite-to-GLB transition timing without changing frontend code.

It does not merge image targets at runtime. Each `.mind` file is a scene pack for legacy MindAR mode, and MindAR tracks only the active pack. A cloud, mock, or manual recognition result should choose `sceneId` and optional `targetIndex`; default manual mode uses that result to reveal the scene GLB directly.

To add a new target pack:

1. Add the compiled `.mind` file to `public/assets/mindar`.
2. Run `npm run mindar:catalog`.
3. Run `npm run mindar:catalog:check`.
4. Add explicit target labels/transforms only if that scene needs custom behavior.

## Runtime Scene API

Default mode exposes the active runtime as `window.__ar`. Compatibility helpers should use `getARRuntime()`, which resolves `window.__ar || window.__mindar`.

```js
window.__ar.getSceneCatalog()
window.__ar.getCurrentScene()
window.__ar.switchScene(sceneId)
window.__ar.recognizeFrameMock({ sceneId, targetIndex, confidence })
window.__ar.applyRecognitionResult({ matched, sceneId, targetIndex, confidence })
window.__ar.setMockSceneId(sceneId)
```

In default manual mode, `switchScene(sceneId)` updates the active manifest scene without loading a `.mind` file. In legacy `?mode=mindar`, `window.__mindar.switchScene(sceneId)` stops the current MindAR system, rebuilds the A-Frame scene with that scene's `mindTargetUrl`, and restarts scanning when the AR layer is active.

`applyRecognitionResult()` is the frontend placeholder for the future Kivicube-like recognition response. It switches scenes when `matched: true` and `sceneId` is provided. Default manual mode treats this as enough to reveal the GLB after the user taps the lock button; legacy MindAR mode still uses target-found events for local tracking.

`recognizeFrameMock()` is a frontend-only scene selection adapter for testing the future cloud recognition handoff. It returns `{ matched, sceneId, targetIndex, confidence, source }`, reading `sceneId` from the function argument first, then `?mockScene=...`, then the debug scene picker state. In manual mode this can select the GLB target directly; in legacy MindAR mode it only selects the scene pack that MindAR should track locally.

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

## First-Open Loading Flow

The permission screen separates camera authorization from AR startup. When the user taps the camera permission button, the app first requests a plain `getUserMedia()` preview stream and shows that video behind the loading UI. Default manual mode keeps that preview stream as the camera background, then overlays the GLB after the user taps the lock button.

Loading is staged to reduce first-open contention:

- Landing loads only the regular page UI.
- Permission does not prepare A-Frame, MindAR, the AR manifest, the active `.mind` target pack, GLB, or BGM.
- After camera approval, default manual mode shows the preview stream immediately, loads A-Frame plus the GLB transition component, fetches the manifest, preloads short AR sound effects, fetches the Step 06 GLB into cache, and asks the hidden A-Frame GLB entity to parse it.
- BGM is not requested during landing, permission, loading, or scan preload; it starts only when AR playback explicitly cues it.
- Legacy `?mode=mindar` keeps the older MindAR startup path for regression testing.

When legacy MindAR starts, it attempts to reuse the preview stream for the first camera start. After MindAR has taken over, the preview video element is detached without stopping the camera tracks.

The WebAR runtime applies the configured GLB lighting and material profile to the final GLB. The default `soft-product-face` profile adds neutral, pink-balanced camera-space product lighting without adding a virtual ground plane, so the AR layer keeps the live camera background while giving the model stronger face volume, a soft right-edge/bottom falloff, and the source GLB's pink body texture.

## GLB Lighting And Material Profile

The optional `glb.lighting` object controls the camera-space light rig used for the final editable GLB:

```json
{
  "lighting": {
    "enabled": true,
    "preset": "soft-product-face",
    "intensityScale": 1
  }
}
```

- `enabled: false` removes the custom rig and lets A-Frame use its default lights.
- `preset: "soft-product-face"` adds a low neutral/pink ambient base, a clearer upper-left soft key, a broad pink-white face fill, reduced right/lower fills, rose-pink hemisphere ground light, and a subtle cool back-right rim. The preset creates the right-edge and lower-body falloff through lighting direction and fill balance only; it does not recolor the GLB texture, add noise, or require a different binary model.
- `intensityScale` multiplies the preset intensities. Use values below `1` for darker camera feeds and above `1` for stronger product highlights.

The optional `glb.materialProfile` object lightly tunes GLB materials after load:

```json
{
  "materialProfile": {
    "enabled": true,
    "preserveOriginal": true,
    "rules": [
      {
        "nodeNames": ["Polygon_3"],
        "metalness": 0,
        "roughness": 0.37,
        "specularIntensity": 0.55,
        "envMapIntensity": 0.24,
        "emissive": "#f6b0bd",
        "emissiveIntensity": 0.22
      }
    ]
  }
}
```

Rules can match `nodeNames`, `materialNames`, or both. With `preserveOriginal: true`, the runtime restores each material to the GLB's loaded values before applying matching rules, so non-matching parts such as eyes, mouth, brows, branch, and leaf keep their original material response. The body rule uses a subtle pink emissive lift to brighten the face center without editing the GLB texture. Only properties that exist on the loaded Three.js material are changed, and animation timing/node visibility is unaffected.

## GLB Transform Space

The `defaultTarget.glb.position`, `rotation`, and `scale` values place the model inside the frozen camera-space AR object after recognition. They are model-relative offsets used for the final handoff pose, separate from the frozen parent transform and internal GLB pivot that user gestures adjust during editing.

Final GLB interaction uses a transparent drag proxy, following the same separation used by Three.js DragControls examples: long-press movement drives a proxy on a fixed camera-depth plane, and the GLB parent follows that proxy while the animated GLB nodes continue to play locally. Single-finger drag only rotates an internal GLB pivot for 360-degree inspection. Two-finger pinch only scales the model. Single-finger long-press for about 450ms, then drag, moves the model. During movement and scaling, the runtime keeps the GLB's interaction center recoverable on screen by default while allowing the model body to sit flush with, or partially beyond, the visible AR layer. It also clamps camera near-plane depth so the editable model cannot be scaled into the camera.

The optional `glb.interaction` object controls the final editable GLB behavior. If omitted, these defaults are used:

```json
{
  "interaction": {
    "rotationMode": "pivot-trackball",
    "pivot": "boundsCenter",
    "pitchRange": [-180, 180],
    "yawSensitivity": 0.16,
    "pitchSensitivity": 0.12,
    "minScale": 0.25,
    "maxScale": 2.4,
    "screenBoundsMode": "center-anchor",
    "screenMarginNdc": 0,
    "screenEdgePaddingPx": 0,
    "nearPlaneMargin": 0.08
  }
}
```

`pivot: "boundsCenter"` rotates around the model's current visual bounds center rather than the animated mesh origin. `screenBoundsMode: "center-anchor"` keeps only the model's interaction center inside the editable AR layer, so an enlarged GLB can sit at the edge or partially off screen without being auto-shrunk back into full view. Use `screenBoundsMode: "projected-bounds"` for older scenes that require the whole projected GLB bounds to remain visible. `screenEdgePaddingPx` adds an optional CSS-pixel inset to whichever screen-bounds mode is active, and `screenMarginNdc` remains available as an optional extra inset in normalized device coordinates for scenes that need a wider margin. `minScale` and `maxScale` are the user-facing pinch limits; `nearPlaneMargin` adds world-space distance in front of the camera near plane before scale is reduced to avoid near-plane clipping.

The runtime drag API accepts pointer positions and applies the default bounds check while dragging and on drag end. Use `getARRuntime()` or `window.__ar` in default manual mode; `window.__mindar` is only guaranteed in legacy mode:

```js
window.__ar.beginFrozenDrag({ pointerId, clientX, clientY })
window.__ar.dragFrozenToScreenPoint({ pointerId, clientX, clientY, clampToViewport: true })
window.__ar.endFrozenDrag({ clampToViewport: true })
window.__ar.rotateFrozenBy({ yawDelta, pitchDelta })
window.__ar.scaleFrozenBy({ scaleFactor })
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

Marker audio is best-effort but diagnosed. The `audio` value supports the built-in one-shot names `drop-bounce` and `branch-pop`. When a marker fires, the runtime emits `gltf-animation-marker`; after the matching sound finishes or is blocked by browser audio policy, it emits `gltf-animation-marker-audio`. The app records the marker id, audio name, elapsed animation time, and whether playback succeeded in both AR diagnostics and `window.__emoAudioDiagnostics.markers`.

## Runtime Debug API

The active runtime exposes:

```js
window.__ar.getFinalModelDebug()
```

`getFinalModelDebug()` reports the active GLB source, ready state, bounds, animation clip names, animation frame window, final yaw/pitch, and projected mesh center for checking final screen placement.
