# OpenCV Recognition Service

This service is the prototype cloud-recognition backend for live scene and
physical-object scans. It uses OpenCV feature matching to identify which known
target the camera frame resembles, then returns `arMode: "screen-space"` so the
frontend can show the GLB without waiting for a MindAR `targetFound` event.

Build the local OpenCV index from the source-image archive:

```sh
npm run recognition:opencv:index
```

Run the service:

```sh
npm run recognition:service
```

Then point the Vercel API proxy at it:

```env
AR_RECOGNITION_SERVICE_URL=http://localhost:8000
```

The source PNG/JPG files are mounted into Docker for index generation only.
They are not stored in the Docker image and should move to Blob/S3/R2 when this
becomes a production service.
