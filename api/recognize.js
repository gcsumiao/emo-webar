import { decodeRecognitionImage, recognizeImage } from '../server/cloudRecognition.js';

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const contentLength = Number(request.headers.get('content-length') || 0);
    const maxRequestBytes = Number(process.env.AR_RECOGNITION_MAX_REQUEST_BYTES || 4_000_000);
    if (contentLength > maxRequestBytes) {
      return Response.json({
        error: 'Recognition request is too large.',
        maxRequestBytes,
      }, { status: 413 });
    }

    try {
      const body = await readBody(request);
      const url = new URL(request.url);
      const tenant = body.tenant || url.searchParams.get('tenant') || process.env.AR_DEFAULT_TENANT || 'emo';
      const location = body.location || url.searchParams.get('location') || process.env.AR_DEFAULT_LOCATION || 'store-a';
      const image = decodeRecognitionImage(body);
      const result = await recognizeImage(image, {
        tenant,
        location,
        maxCandidates: body.maxCandidates,
      });

      return Response.json(result, {
        headers: {
          'Cache-Control': 'no-store',
        },
      });
    } catch (error) {
      const status = Number(error?.status) || 500;
      if (status >= 500) console.warn('[AR recognize] recognition failed:', error);
      return Response.json({
        schemaVersion: 1,
        matched: false,
        source: 'cloud-recognition',
        recognitionMode: 'cloud-first',
        error: status >= 500 ? 'Recognition failed.' : String(error?.message || error),
      }, { status });
    }
  },
};
