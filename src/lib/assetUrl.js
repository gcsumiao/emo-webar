// Resolve a public asset path under Vite's BASE_URL so the same code works
// at the dev-server root ("/") and under a GitHub Pages subpath
// (e.g. "/emo-webar/").
const RAW_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
export const ASSET_BASE = RAW_BASE.replace(/\/$/, '');

export function asset(path) {
  if (!path) return path;
  // Absolute (http/https/protocol-relative) and data URIs pass through.
  if (/^([a-z]+:)?\/\//i.test(path) || path.startsWith('data:')) return path;
  // Already prefixed with the configured base — leave alone.
  if (ASSET_BASE && path.startsWith(`${ASSET_BASE}/`)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return ASSET_BASE + normalized;
}
