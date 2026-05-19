import { getScenesPayload } from '../server/arScenes.js';

function readQuery(request) {
  const url = new URL(request.url);
  return {
    tenant: url.searchParams.get('tenant') || process.env.AR_DEFAULT_TENANT || 'emo',
    location: url.searchParams.get('location') || process.env.AR_DEFAULT_LOCATION || 'store-a',
    limit: Number(url.searchParams.get('limit') || process.env.AR_SCENE_MAX_RESULTS || 0),
  };
}

export default {
  async fetch(request) {
    if (request.method !== 'GET') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const query = readQuery(request);
    const payload = await getScenesPayload(query);
    const seconds = Math.max(0, Number(process.env.AR_SCENE_CACHE_SECONDS || 60));

    return Response.json(payload, {
      headers: {
        'Cache-Control': `s-maxage=${seconds}, stale-while-revalidate=300`,
      },
    });
  },
};
