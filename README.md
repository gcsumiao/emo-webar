# EMO WebAR

This is a Vite + React WebAR prototype using local MindAR image tracking and a manifest-driven scene configuration.

## Local Development

```bash
npm install
npm run dev
```

MindAR uses the local AR manifest at `/assets/ar/manifest.json`.
That manifest points to `/assets/ar/mindar-scenes.json`, which selects one compiled `.mind` scene pack at a time.

## Manifest Notes

Set `VITE_AR_MANIFEST_URL` to load a remote manifest instead of the local default:

```env
VITE_AR_MANIFEST_URL=https://your-cdn.com/ar/manifest.json
```

This does not add new image targets by itself. New target images still require compiling a `.mind` pack and regenerating the scene catalog:

```bash
npm run mindar:catalog
npm run mindar:catalog:check
```

Use `?debug=1` to show the scan-screen scene picker, `?scene=气模` to start on a specific scene pack, or `?mockScene=水箱` to test the mock recognition handoff.

## Build

```bash
npm install
npm run build
```
