# Cloud Scene API

This project now supports a Kivicube-like cloud-first v1 flow:

1. The frontend captures a compressed camera-frame crop on the scan page.
2. The frontend posts that frame to `/api/recognize`.
3. The API compares the frame against the generated recognition descriptor index.
4. The API returns `sceneId`, `targetId`, `targetIndex`, confidence, and the matching `.mind` URL.
5. The frontend loads that one MindAR scene pack, then MindAR remains the local browser tracker for `targetIndex`.

The older `/api/scenes` endpoint still exists for scene metadata and fallback
catalog loading, but the scan page no longer rotates every `.mind` file by
default.

## Local Database

Start Postgres:

```sh
docker compose up -d postgres
```

If another local Postgres is already listening on port `5432`, run:

```sh
POSTGRES_HOST_PORT=55433 docker compose up -d postgres
DATABASE_URL=postgres://emo:emo@127.0.0.1:55433/emo_ar npm run db:migrate
DATABASE_URL=postgres://emo:emo@127.0.0.1:55433/emo_ar npm run db:seed:scenes
```

Create tables and seed from the existing local catalog:

```sh
npm run db:migrate
npm run db:seed:scenes
```

Default local connection:

```env
DATABASE_URL=postgres://emo:emo@127.0.0.1:5432/emo_ar
```

The seed script reads:

- `public/assets/ar/mindar-scenes.json`
- `public/assets/ar/manifest.json`

It creates the default tenant/location pair `emo/store-a`. Override with:

```sh
AR_SEED_TENANT=emo AR_SEED_LOCATION=store-a npm run db:seed:scenes
```

## API Contract

`GET /api/scenes?tenant=emo&location=store-a`

```json
{
  "schemaVersion": 1,
  "tenant": "emo",
  "location": "store-a",
  "recognitionMode": "client-scene-rotation",
  "source": "postgres",
  "defaultSceneId": "targets",
  "scenes": [
    {
      "sceneId": "气模",
      "label": "气模",
      "mindFileUrl": "/assets/mindar/气模targets.mind",
      "mindTargetUrl": "/assets/mindar/气模targets.mind",
      "targetCount": 28,
      "priority": 10,
      "targets": [
        {
          "targetIndex": 0,
          "targetId": "气模-0",
          "label": "气模 target 0",
          "renderMode": "gltf-only",
          "glb": {},
          "sprite": {},
          "action": {
            "type": "none"
          }
        }
      ]
    }
  ]
}
```

If `DATABASE_URL` is missing or no matching DB rows exist, the API falls back to
the static scene catalog so the prototype remains usable.

`POST /api/recognition-events`

Records the final browser-side MindAR hit:

```json
{
  "tenant": "emo",
  "location": "store-a",
  "sceneId": "气模",
  "targetIndex": 0,
  "confidence": 1,
  "source": "mindar"
}
```

`POST /api/recognize`

Recognizes a compressed scan-frame image against
`public/assets/ar/recognition-index.json`.

Request:

```json
{
  "tenant": "emo",
  "location": "store-a",
  "imageDataUrl": "data:image/jpeg;base64,...",
  "maxCandidates": 3
}
```

Response on match:

```json
{
  "schemaVersion": 1,
  "matched": true,
  "source": "cloud-recognition",
  "recognitionMode": "cloud-first",
  "tenant": "emo",
  "location": "store-a",
  "sceneId": "气模",
  "targetId": "气模-0",
  "targetIndex": 0,
  "label": "01 (1)",
  "confidence": 0.99,
  "scoreMargin": 0.54,
  "mindFileUrl": "/assets/mindar/气模targets.mind",
  "mindTargetUrl": "/assets/mindar/气模targets.mind",
  "sourceImageUrl": "source://一毛AR材料/3.一毛识别图库/气模/01 (1).jpg"
}
```

Response on miss:

```json
{
  "schemaVersion": 1,
  "matched": false,
  "source": "cloud-recognition",
  "recognitionMode": "cloud-first",
  "confidence": 0.61,
  "threshold": 0.76
}
```

The request body should stay under the Vercel Function payload limit. The
frontend sends a 384px JPEG scan crop.

## Recognition Index

Source images stay outside the repo. The local mapping lives in
`recognition/target-sources.json` and currently points at:

```text
/Users/sumiaoc/Downloads/emo-checklist-source-archive
```

Generate the deployable descriptor index:

```sh
npm run recognition:index
npm run recognition:index:check
```

The generated file is:

```text
public/assets/ar/recognition-index.json
```

This file contains descriptors and scene metadata, not the original images.
Docker is not used as image storage. If source images are later moved to Vercel
Blob, S3, or R2, set `AR_RECOGNITION_SOURCE_BASE_URL` before rebuilding the
index so `sourceImageUrl` points to the object-store URLs.

## Frontend Configuration

```env
VITE_AR_SCENE_API_URL=/api/scenes
VITE_AR_RECOGNITION_API_URL=/api/recognize
VITE_AR_TENANT=emo
VITE_AR_LOCATION=store-a
```

Runtime URL parameters override the defaults:

```text
?tenant=emo&location=store-a
```

The frontend still supports:

- `?scene=气模` to force a scene pack.
- `?mockScene=水箱` to test the mock handoff.
- `?debug=1` to show the manual scene picker.

When a fixed scene or mock scene is provided, cloud recognition is skipped.
If `/api/scenes` fails, the runtime falls back to `public/assets/ar/mindar-scenes.json`.

## Vercel + Neon

Use the Vercel Marketplace Neon integration for production. It injects
`DATABASE_URL` into the linked Vercel project.

Recommended Vercel settings:

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables:
  - `DATABASE_URL`
  - `VITE_AR_SCENE_API_URL=/api/scenes`
  - `VITE_AR_RECOGNITION_API_URL=/api/recognize`
  - `VITE_AR_RECOGNITION_EVENTS_URL=off`
  - `VITE_AR_TENANT=emo`
  - `VITE_AR_LOCATION=store-a`
  - `AR_SCENE_CACHE_SECONDS=60`
  - `AR_SCENE_MAX_RESULTS=0`
  - `AR_RECOGNITION_MIN_CONFIDENCE=0.76`
  - `AR_RECOGNITION_MIN_SCENE_MARGIN=0.02`
  - `AR_RECOGNITION_STRONG_CONFIDENCE=0.93`

Set `AR_SCENE_MAX_RESULTS` to a small number such as `8` when a location should
scan only its top-priority scene packs.

Local full-stack development should use:

```sh
vercel dev
```

Plain `npm run dev` still works for frontend-only testing, but `/api/*` routes
will not be available and the app will use the static catalog fallback.
