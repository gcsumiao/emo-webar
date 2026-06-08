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
