// Resolve a public asset path under Vite's BASE_URL so the same code works
// at the dev-server root ("/") and under a GitHub Pages subpath
// (e.g. "/emo-webar/").
const RAW_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
const BUILD_APP_VERSION = typeof __EMO_APP_VERSION__ !== 'undefined' ? __EMO_APP_VERSION__ : '';
const ASSET_VERSION =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APP_VERSION) ||
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA) ||
  BUILD_APP_VERSION ||
  '';
export const ASSET_BASE = RAW_BASE.replace(/\/$/, '');

function withAssetVersion(url) {
  if (!ASSET_VERSION || /[?&]v=/.test(url)) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(ASSET_VERSION)}`;
}

export function asset(path) {
  if (!path) return path;
  // Absolute (http/https/protocol-relative) and data URIs pass through.
  if (/^([a-z]+:)?\/\//i.test(path) || path.startsWith('data:')) return path;
  // Already prefixed with the configured base — leave alone.
  if (ASSET_BASE && path.startsWith(`${ASSET_BASE}/`)) return withAssetVersion(path);
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return withAssetVersion(ASSET_BASE + normalized);
}
