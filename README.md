# EMO WebAR

This is a Vite + React WebAR prototype using local MindAR image tracking and a manifest-driven scene configuration.

## Local Development

```bash
npm install
npm run dev
```

MindAR uses the local target manifest and `/assets/mindar/targets.mind`.
The app requests `/assets/ar/manifest.json` by default.

## Manifest Notes

Set `VITE_AR_MANIFEST_URL` to load a remote manifest instead of the local default:

```env
VITE_AR_MANIFEST_URL=https://your-cdn.com/ar/manifest.json
```

This does not add new image targets by itself. New target images still require recompiling `targets.mind` and keeping the manifest target order in sync.

## Build

```bash
npm install
npm run build
```
