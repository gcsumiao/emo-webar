export const KIVICUBE_PLUGIN_SRC = 'https://www.kivicube.com/lib/iframe-plugin.js';

function readEnv(name) {
  return import.meta.env?.[name];
}

function parseBoolean(value, fallback) {
  if (value == null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;
  return fallback;
}

export function getArProvider() {
  const explicitProvider = String(readEnv('VITE_AR_PROVIDER') || '').trim().toLowerCase();
  if (explicitProvider) return explicitProvider;
  if (readEnv('VITE_KIVICUBE_COLLECTION_ID')) return 'kivicube';
  return 'mindar';
}

export function getKivicubeConfig() {
  const collectionId = String(readEnv('VITE_KIVICUBE_COLLECTION_ID') || '').trim();
  const cameraPosition = String(readEnv('VITE_KIVICUBE_CAMERA_POSITION') || 'back').trim() || 'back';

  return {
    collectionId,
    openProps: {
      collectionId,
      hideLogo: parseBoolean(readEnv('VITE_KIVICUBE_HIDE_LOGO'), true),
      hideTitle: parseBoolean(readEnv('VITE_KIVICUBE_HIDE_TITLE'), true),
      hideLoading: parseBoolean(readEnv('VITE_KIVICUBE_HIDE_LOADING'), true),
      hideScan: parseBoolean(readEnv('VITE_KIVICUBE_HIDE_SCAN'), true),
      hideTakePhoto: parseBoolean(readEnv('VITE_KIVICUBE_HIDE_TAKE_PHOTO'), true),
      cameraPosition,
    },
  };
}
