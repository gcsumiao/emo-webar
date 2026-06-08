# EMO WebAR

This is a Vite + React WebAR prototype using a manifest-driven AR scene configuration. The default flow uses a manual "lock target" trigger over a live camera preview; legacy local MindAR image tracking is still available with `?mode=mindar`.

## Local Development

```bash
npm install
npm run dev
```

The AR runtime uses the local manifest at `/assets/ar/manifest.json`.
That manifest points to `/assets/ar/mindar-scenes.json`, which provides scene metadata for the default manual trigger and selects compiled `.mind` scene packs in legacy MindAR mode.

## Manifest Notes

Set `VITE_AR_MANIFEST_URL` to load a remote manifest instead of the local default:

```env
VITE_AR_MANIFEST_URL=https://your-cdn.com/ar/manifest.json
```

This does not add new image targets by itself. Default manual mode can reveal a configured GLB from scene metadata without image recognition. Legacy MindAR image targets still require compiling a `.mind` pack and regenerating the scene catalog:

```bash
npm run mindar:catalog
npm run mindar:catalog:check
```

Use `?debug=1` to show the scan-screen scene picker, `?scene=气模` to start on a specific scene, `?mockScene=水箱` to test the mock recognition handoff, or `?mode=mindar` to run the legacy image-tracking path.

## QR Code

The deployed QR code points to `https://www.emoar.fun/`.

Editable source assets:

- `/qr-code/qr-code-styling.png`
- `/qr-code/options.json`

Deployed public assets:

- `/assets/qr/emoar-qr-code.png`
- `/assets/qr/options.json`

To update the QR code, edit the source config in `qr-code/options.json`, regenerate the PNG with `qr-code-styling`, then copy both files into `public/assets/qr`.
Keep `imageOptions.imageSize` at or below `0.5`; the `qr-code-styling` documentation notes that larger center images are not recommended for scan reliability.

## Build

```bash
npm install
npm run build
```

## ECS Deployment

GitHub Actions can deploy the Vite `dist/` build to Alibaba Cloud ECS while keeping the existing GitHub Pages workflow.
The ECS workflow builds for the domain root with `VITE_BASE=/`, then syncs `dist/` to Nginx on the server.

See [docs/ecs-deploy.md](docs/ecs-deploy.md) for required GitHub Secrets, ECS setup, Nginx config, DNS, HTTPS, and verification steps.
