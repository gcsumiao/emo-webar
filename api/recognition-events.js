import { recordRecognitionEvent } from '../server/arScenes.js';

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

    const body = await readBody(request);
    const url = new URL(request.url);
    const tenant = body.tenant || url.searchParams.get('tenant') || process.env.AR_DEFAULT_TENANT || 'emo';
    const location = body.location || url.searchParams.get('location') || process.env.AR_DEFAULT_LOCATION || 'store-a';
    const userAgent = request.headers.get('user-agent') || '';

    try {
      const event = await recordRecognitionEvent({
        tenant,
        location,
        sceneId: body.sceneId || body.scene?.sceneId || '',
        targetIndex: body.targetIndex,
        confidence: body.confidence,
        source: body.source || 'mindar',
        userAgent,
      });

      return Response.json({
        ok: true,
        recorded: Boolean(event?.id),
        eventId: event?.id || null,
        createdAt: event?.created_at || null,
      });
    } catch (error) {
      console.warn('[AR recognition-events] event was not recorded:', error);
      return Response.json({
        ok: false,
        recorded: false,
        error: 'Recognition event was not recorded.',
      }, { status: 503 });
    }
  },
};
