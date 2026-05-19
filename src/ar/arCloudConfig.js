const DEFAULT_SCENE_API_URL = '/api/scenes';
const DEFAULT_RECOGNITION_API_URL = '/api/recognize';
const DEFAULT_RECOGNITION_EVENTS_URL = '/api/recognition-events';

function readSearchParam(name) {
  try {
    return new URLSearchParams(window.location.search).get(name) || '';
  } catch {
    return '';
  }
}

function readEnv(name) {
  try {
    return import.meta.env?.[name] || '';
  } catch {
    return '';
  }
}

function buildUrl(url, params = {}) {
  if (!url) return '';
  const base = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'http://localhost';
  const next = new URL(url, base);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      next.searchParams.set(key, String(value));
    }
  });
  return next.origin === base ? `${next.pathname}${next.search}` : next.toString();
}

export function getArTenant() {
  return readSearchParam('tenant') || readEnv('VITE_AR_TENANT') || 'emo';
}

export function getArLocation() {
  return readSearchParam('location') || readEnv('VITE_AR_LOCATION') || 'store-a';
}

export function getSceneApiUrl() {
  const configured = readEnv('VITE_AR_SCENE_API_URL');
  const url = configured === 'off' || configured === 'false'
    ? ''
    : configured || DEFAULT_SCENE_API_URL;
  return buildUrl(url, {
    tenant: getArTenant(),
    location: getArLocation(),
  });
}

export function getRecognitionApiUrl() {
  const configured = readEnv('VITE_AR_RECOGNITION_API_URL');
  const url = configured === 'off' || configured === 'false'
    ? ''
    : configured || DEFAULT_RECOGNITION_API_URL;
  return buildUrl(url);
}

export function getRecognitionEventsUrl() {
  const configured = readEnv('VITE_AR_RECOGNITION_EVENTS_URL');
  const url = configured === 'off' || configured === 'false'
    ? ''
    : configured || DEFAULT_RECOGNITION_EVENTS_URL;
  return buildUrl(url);
}

export function hasFixedSceneSelection() {
  return Boolean(readSearchParam('scene') || readSearchParam('mockScene'));
}
