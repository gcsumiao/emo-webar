# EMO WebAR

This is a Vite + React WebAR prototype using local MindAR image tracking and a manifest-driven scene configuration.

## Local Development

```bash
npm install
npm run dev
```

MindAR uses the local AR manifest at `/assets/ar/manifest.json`.
That manifest points to `/assets/ar/mindar-scenes.json`, which selects one compiled `.mind` scene pack at a time.

For the Vercel API + Postgres scene flow, run the database and use Vercel dev:

```bash
docker compose up -d postgres
npm run db:migrate
npm run db:seed:scenes
vercel dev
```

`npm run dev` still works as a frontend-only fallback, but `/api/*` routes are only available through Vercel dev or a Vercel deployment.

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

Cloud recognition now has two layers. The Vercel `/api/recognize` route stays
lightweight and proxies frames to `AR_RECOGNITION_SERVICE_URL`. The OpenCV
service builds its feature index from the source target images; the source
images stay outside this repo and are mounted into Docker only for indexing:

```bash
npm run recognition:opencv:index
npm run recognition:service
```

Set `AR_RECOGNITION_SERVICE_URL=http://localhost:8000` for local `vercel dev`,
or to the deployed HTTPS recognition service in Vercel.

Use `?debug=1` to show the scan-screen scene picker, `?scene=气模` to start on a specific scene pack, or `?mockScene=水箱` to test the mock recognition handoff.

The cloud scene and recognition APIs are documented in `docs/cloud-scene-api.md`.

## Build

```bash
npm install
npm run build
```
