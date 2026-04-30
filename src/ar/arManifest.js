import { asset } from '../lib/assetUrl.js';
import {
  DEFAULT_RENDER_MODE,
  createDefaultArManifest,
} from './arManifestDefaults.js';

const LOCAL_MANIFEST_URL = '/assets/ar/manifest.json';
const ABSOLUTE_URL_RE = /^(https?:)?\/\//i;
const PASSTHROUGH_URL_RE = /^(data:|blob:|#)/i;

let cachedManifest = null;
let manifestPromise = null;

function clone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeObject(base, override) {
  const next = { ...(isPlainObject(base) ? base : {}) };
  if (!isPlainObject(override)) return next;
  Object.entries(override).forEach(([key, value]) => {
    if (isPlainObject(value) && isPlainObject(next[key])) {
      next[key] = mergeObject(next[key], value);
    } else if (value !== undefined) {
      next[key] = clone(value);
    }
  });
  return next;
}

function normalizeRenderMode(value) {
  if (value === 'sprite-only' || value === 'gltf-only' || value === 'sprite-then-gltf') {
    return value;
  }
  return DEFAULT_RENDER_MODE;
}

function normalizeArray(value, fallback) {
  if (!Array.isArray(value)) return clone(fallback);
  return value.map((part, index) => {
    const next = Number(part);
    const fallbackPart = Array.isArray(fallback) ? fallback[index] : 0;
    return Number.isFinite(next) ? next : fallbackPart;
  });
}

function normalizeAsset(assetLike) {
  if (!isPlainObject(assetLike) || !assetLike.id) return null;
  return {
    ...assetLike,
    id: String(assetLike.id),
    type: assetLike.type || 'model',
    src: resolveArAssetUrl(assetLike.src),
  };
}

function normalizeSprite(spriteLike) {
  const sprite = isPlainObject(spriteLike) ? { ...spriteLike } : {};
  if (Array.isArray(sprite.frameSequenceUrls)) {
    sprite.frameSequenceUrls = sprite.frameSequenceUrls
      .filter(Boolean)
      .map(resolveArAssetUrl);
  }
  ['finalIdleFrameUrl', 'shadowUrl', 'glowUrl'].forEach((key) => {
    if (sprite[key]) sprite[key] = resolveArAssetUrl(sprite[key]);
  });
  return sprite;
}

function normalizeGlb(glbLike, fallbackGlb, targetIndex) {
  const sourceGlb = isPlainObject(glbLike) ? glbLike : {};
  const glb = mergeObject(fallbackGlb, isPlainObject(glbLike) ? glbLike : {});
  if (sourceGlb.src && !sourceGlb.assetId) glb.assetId = `glb-target-${targetIndex}`;
  if (glb.src) glb.src = resolveArAssetUrl(glb.src);
  if (!glb.assetId && glb.src) glb.assetId = `glb-target-${targetIndex}`;
  if (glb.assetId) glb.assetId = String(glb.assetId);
  glb.position = normalizeArray(glb.position, fallbackGlb.position || [0, 0, 0]);
  glb.rotation = normalizeArray(glb.rotation, fallbackGlb.rotation || [0, 0, 0]);
  glb.scale = normalizeArray(glb.scale, fallbackGlb.scale || [1, 1, 1]);
  glb.animation = mergeObject(fallbackGlb.animation || {}, glb.animation || {});
  glb.transition = mergeObject(fallbackGlb.transition || {}, glb.transition || {});
  glb.visibleOnTarget = Boolean(glb.visibleOnTarget);
  glb.showAfterSpriteIntro = glb.showAfterSpriteIntro !== false;
  return glb;
}

function targetIndexFrom(targetIndexOrTarget) {
  if (isPlainObject(targetIndexOrTarget)) return Number(targetIndexOrTarget.targetIndex);
  return Number(targetIndexOrTarget);
}

function findTarget(manifest, targetIndexOrTarget) {
  const idx = targetIndexFrom(targetIndexOrTarget);
  return manifest?.targets?.find((target) => target.targetIndex === idx) || null;
}

export function getArManifestUrl() {
  const envUrl = import.meta.env?.VITE_AR_MANIFEST_URL;
  return envUrl ? resolveArAssetUrl(envUrl) : resolveArAssetUrl(LOCAL_MANIFEST_URL);
}

export function resolveArAssetUrl(url) {
  if (!url || typeof url !== 'string') return url;
  if (ABSOLUTE_URL_RE.test(url) || PASSTHROUGH_URL_RE.test(url)) return url;
  return asset(url);
}

export function normalizeArManifest(raw) {
  const defaults = createDefaultArManifest();
  const source = isPlainObject(raw) ? raw : {};
  const defaultTarget = mergeObject(defaults.defaultTarget, source.defaultTarget || {});
  defaultTarget.renderMode = normalizeRenderMode(defaultTarget.renderMode);
  defaultTarget.sprite = normalizeSprite(defaultTarget.sprite);
  defaultTarget.glb = normalizeGlb(defaultTarget.glb, defaults.defaultTarget.glb, 0);

  const rawTargets = Array.isArray(source.targets) && source.targets.length ? source.targets : defaults.targets;
  const fallbackTargetsByIndex = new Map(defaults.targets.map((target) => [target.targetIndex, target]));
  const targets = rawTargets
    .map((targetLike, orderIndex) => {
      const targetSource = isPlainObject(targetLike) ? targetLike : {};
      const targetIndex = Number.isFinite(Number(targetSource.targetIndex))
        ? Number(targetSource.targetIndex)
        : orderIndex;
      const fallback = fallbackTargetsByIndex.get(targetIndex) || {};
      const mergedTarget = mergeObject(defaultTarget, targetSource);
      mergedTarget.targetIndex = targetIndex;
      mergedTarget.targetId = String(targetSource.targetId || fallback.targetId || `target-${targetIndex}`);
      mergedTarget.label = String(targetSource.label || fallback.label || mergedTarget.targetId);
      mergedTarget.renderMode = normalizeRenderMode(targetSource.renderMode || defaultTarget.renderMode);
      mergedTarget.sprite = normalizeSprite(mergeObject(defaultTarget.sprite, targetSource.sprite || {}));
      mergedTarget.glb = normalizeGlb(targetSource.glb, defaultTarget.glb, targetIndex);
      return mergedTarget;
    })
    .filter((target) => Number.isFinite(target.targetIndex))
    .sort((a, b) => a.targetIndex - b.targetIndex);

  const assetMap = new Map();
  [...(defaults.assets || []), ...(Array.isArray(source.assets) ? source.assets : [])]
    .map(normalizeAsset)
    .filter(Boolean)
    .forEach((item) => assetMap.set(item.id, item));

  targets.forEach((target) => {
    const glb = target.glb;
    if (!glb?.assetId || !glb.src) return;
    if (!assetMap.has(glb.assetId)) {
      assetMap.set(glb.assetId, {
        id: glb.assetId,
        type: 'model',
        src: glb.src,
      });
    }
  });

  return {
    ...source,
    schemaVersion: Number(source.schemaVersion) || defaults.schemaVersion,
    mindTargetUrl: resolveArAssetUrl(source.mindTargetUrl || defaults.mindTargetUrl),
    assets: Array.from(assetMap.values()),
    defaultTarget,
    targets,
  };
}

export async function loadArManifest({ force = false } = {}) {
  if (!force && cachedManifest) return cachedManifest;
  if (!force && manifestPromise) return manifestPromise;

  manifestPromise = fetch(getArManifestUrl(), { cache: 'no-cache' })
    .then((response) => {
      if (!response.ok) throw new Error(`AR manifest request failed: ${response.status}`);
      return response.json();
    })
    .then((raw) => {
      cachedManifest = normalizeArManifest(raw);
      return cachedManifest;
    })
    .catch((error) => {
      cachedManifest = normalizeArManifest(createDefaultArManifest());
      cachedManifest.__fallback = true;
      cachedManifest.__warning = String(error?.message || error);
      return cachedManifest;
    })
    .finally(() => {
      manifestPromise = null;
    });

  return manifestPromise;
}

export function getCachedArManifest() {
  return cachedManifest;
}

export function getTargetSpriteConfig(manifest, targetIndexOrTarget) {
  return clone(findTarget(manifest, targetIndexOrTarget)?.sprite || manifest?.defaultTarget?.sprite || {});
}

export function getTargetGlbConfig(manifest, targetIndexOrTarget) {
  return clone(findTarget(manifest, targetIndexOrTarget)?.glb || manifest?.defaultTarget?.glb || null);
}

export function getTargetRenderMode(manifest, targetIndexOrTarget) {
  return normalizeRenderMode(findTarget(manifest, targetIndexOrTarget)?.renderMode || manifest?.defaultTarget?.renderMode);
}
