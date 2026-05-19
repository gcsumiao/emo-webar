async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function jsonResponse(body, init = {}) {
  return Response.json(body, {
    ...init,
    headers: {
      'Cache-Control': 'no-store',
      ...(init.headers || {}),
    },
  });
}

function missResponse(body = {}, init = {}) {
  return jsonResponse({
    schemaVersion: 1,
    matched: false,
    source: 'recognition-service-proxy',
    recognitionMode: 'cloud-first',
    arMode: 'screen-space',
    ...body,
  }, init);
}

function serviceEndpoint() {
  const base = process.env.AR_RECOGNITION_SERVICE_URL || '';
  if (!base.trim()) return null;
  try {
    const parsed = new URL(base);
    if (parsed.pathname.replace(/\/+$/, '').endsWith('/recognize')) return parsed.toString();
    return new URL('recognize', base.endsWith('/') ? base : `${base}/`).toString();
  } catch {
    return null;
  }
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
    }

    const contentLength = Number(request.headers.get('content-length') || 0);
    const maxRequestBytes = Number(process.env.AR_RECOGNITION_MAX_REQUEST_BYTES || 4_000_000);
    if (contentLength > maxRequestBytes) {
      return jsonResponse({
        error: 'Recognition request is too large.',
        maxRequestBytes,
      }, { status: 413 });
    }

    const endpoint = serviceEndpoint();
    if (!endpoint) {
      return missResponse({
        reason: 'recognition-service-unconfigured',
        error: 'AR_RECOGNITION_SERVICE_URL is not configured.',
      });
    }

    let tenant = process.env.AR_DEFAULT_TENANT || 'emo';
    let location = process.env.AR_DEFAULT_LOCATION || 'store-a';
    try {
      const body = await readBody(request);
      const url = new URL(request.url);
      tenant = body.tenant || url.searchParams.get('tenant') || tenant;
      location = body.location || url.searchParams.get('location') || location;
      const timeoutMs = Number(process.env.AR_RECOGNITION_PROXY_TIMEOUT_MS || 6_000);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...body,
            tenant,
            location,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        console.warn('[AR recognize] recognition service returned non-OK response:', response.status, detail);
        return missResponse({
          tenant,
          location,
          reason: `recognition-service-${response.status}`,
          error: 'Recognition service failed.',
        });
      }

      const result = await response.json();
      return jsonResponse({
        schemaVersion: 1,
        source: result.source || 'opencv-recognition-service',
        recognitionMode: 'cloud-first',
        tenant,
        location,
        arMode: result.arMode || 'screen-space',
        ...result,
      });
    } catch (error) {
      const aborted = error?.name === 'AbortError';
      if (!aborted) console.warn('[AR recognize] recognition service proxy failed:', error);
      return missResponse({
        tenant,
        location,
        reason: aborted ? 'recognition-service-timeout' : 'recognition-service-error',
        error: aborted ? 'Recognition service timed out.' : 'Recognition service is unavailable.',
      });
    }
  },
};
