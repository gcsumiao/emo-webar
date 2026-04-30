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

## What The Manifest Controls

The manifest can change model URLs, sprite frame URLs, target labels, per-target transforms, animation clip names, and sprite-to-GLB transition timing without changing frontend code.

It does not add new image targets to an existing MindAR target file. New target images still require generating a new `.mind` file and updating `mindTargetUrl` plus the target order in `targets`.

## Render Modes

- `sprite-only`: play the PNG sprite intro and keep the PNG final pose.
- `gltf-only`: reveal the GLB model without keeping the PNG sprite final pose.
- `sprite-then-gltf`: play the PNG sprite intro, reveal the GLB at the configured transform, then hide the sprite.

## Sprite To GLB Transition

The PNG sprite intro and the GLB model are separate runtime layers. They are made continuous by matching the final sprite pose to the initial GLB transform and using a short crossfade or hide delay during handoff.

The PNG sequence is not converted into a GLB. If a future intro needs true 3D motion, author that animation in Blender or another 3D tool and export it inside the GLB.

## GLB Animation

Animations must be embedded in the GLB. Name clips clearly, for example:

```text
Intro
Idle
Tap
Outro
```

The manifest can reference `introClip` and `idleClip`. If the configured clip names do not exist, the model still appears and the runtime emits a missing-animation diagnostic instead of crashing.
