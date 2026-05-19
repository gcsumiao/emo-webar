import { asset } from '../lib/assetUrl.js';
import { getSceneApiUrl } from './arCloudConfig.js';
import {
  DEFAULT_GLB_INTERACTION,
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

function normalizeNumber(value, fallback, min = -Infinity, max = Infinity) {
  const next = Number(value);
  const resolved = Number.isFinite(next) ? next : fallback;
  return Math.max(min, Math.min(max, resolved));
}

function normalizeGlbInteraction(interactionLike, fallbackInteraction = DEFAULT_GLB_INTERACTION) {
  const merged = mergeObject(DEFAULT_GLB_INTERACTION, mergeObject(fallbackInteraction, interactionLike || {}));
  const pitchRange = normalizeArray(merged.pitchRange, DEFAULT_GLB_INTERACTION.pitchRange);
  const minPitch = Number(pitchRange[0]);
  const maxPitch = Number(pitchRange[1]);
  const normalizedPitchRange = Number.isFinite(minPitch) && Number.isFinite(maxPitch) && maxPitch >= minPitch
    ? [minPitch, maxPitch]
    : [...DEFAULT_GLB_INTERACTION.pitchRange];
  const minScale = normalizeNumber(merged.minScale, DEFAULT_GLB_INTERACTION.minScale, 0.01);
  const maxScale = Math.max(
    minScale,
    normalizeNumber(merged.maxScale, DEFAULT_GLB_INTERACTION.maxScale, minScale)
  );

  return {
    rotationMode: merged.rotationMode === 'pivot-trackball' ? 'pivot-trackball' : DEFAULT_GLB_INTERACTION.rotationMode,
    pivot: merged.pivot === 'boundsCenter' ? 'boundsCenter' : DEFAULT_GLB_INTERACTION.pivot,
    pitchRange: normalizedPitchRange,
    yawSensitivity: normalizeNumber(merged.yawSensitivity, DEFAULT_GLB_INTERACTION.yawSensitivity, 0),
    pitchSensitivity: normalizeNumber(merged.pitchSensitivity, DEFAULT_GLB_INTERACTION.pitchSensitivity, 0),
    minScale,
    maxScale,
    screenMarginNdc: normalizeNumber(merged.screenMarginNdc, DEFAULT_GLB_INTERACTION.screenMarginNdc, 0, 0.45),
    nearPlaneMargin: normalizeNumber(merged.nearPlaneMargin, DEFAULT_GLB_INTERACTION.nearPlaneMargin, 0),
  };
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

function normalizeSceneCatalogFromApi(payload) {
  if (!isPlainObject(payload) || !Array.isArray(payload.scenes)) return null;
  return {
    schemaVersion: Number(payload.schemaVersion) || 1,
    defaultSceneId: payload.defaultSceneId || payload.scenes[0]?.sceneId || payload.scenes[0]?.id || 'targets',
    recognitionMode: payload.recognitionMode || 'client-scene-rotation',
    tenant: payload.tenant || '',
    location: payload.location || '',
    source: payload.source || 'api',
    scenes: payload.scenes.map((scene) => ({
      ...scene,
      mindTargetUrl: scene.mindTargetUrl || scene.mindFileUrl || scene.mindTargetSrc || scene.url,
    })),
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
  glb.interaction = normalizeGlbInteraction(glb.interaction, fallbackGlb.interaction);
  glb.visibleOnTarget = Boolean(glb.visibleOnTarget);
  glb.showAfterSpriteIntro = glb.showAfterSpriteIntro !== false;
  return glb;
}

function positiveInteger(value, fallback = 0) {
  const next = Number(value);
  return Number.isInteger(next) && next > 0 ? next : fallback;
}

function basenameFromUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const cleanUrl = url.split(/[?#]/)[0];
  const basename = cleanUrl.slice(cleanUrl.lastIndexOf('/') + 1);
  try {
    return decodeURIComponent(basename);
  } catch {
    return basename;
  }
}

function sceneIdFromMindTargetUrl(url) {
  const basename = basenameFromUrl(url);
  if (!basename) return '';
  const stem = basename.replace(/\.mind$/i, '');
  if (stem === 'targets') return 'targets';
  return stem.replace(/targets$/i, '') || stem;
}

function labelForScene(sceneId) {
  return sceneId === 'targets' ? 'Default EMO targets' : sceneId;
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

function normalizeTarget(targetLike, orderIndex, {
  defaultTarget,
  fallbackTargetsByIndex,
  scene,
}) {
  const targetSource = isPlainObject(targetLike) ? targetLike : {};
  const targetIndex = Number.isFinite(Number(targetSource.targetIndex))
    ? Number(targetSource.targetIndex)
    : orderIndex;
  if (!Number.isFinite(targetIndex)) return null;

  const fallback = fallbackTargetsByIndex.get(targetIndex) || {};
  const mergedTarget = mergeObject(defaultTarget, targetSource);
  mergedTarget.targetIndex = targetIndex;
  mergedTarget.targetId = String(targetSource.targetId || fallback.targetId || `${scene.sceneId}-${targetIndex}`);
  mergedTarget.label = String(targetSource.label || fallback.label || mergedTarget.targetId);
  mergedTarget.sceneId = scene.sceneId;
  mergedTarget.sceneLabel = scene.label;
  mergedTarget.mindTargetUrl = scene.mindTargetUrl;
  mergedTarget.renderMode = normalizeRenderMode(targetSource.renderMode || defaultTarget.renderMode);
  mergedTarget.sprite = normalizeSprite(mergeObject(defaultTarget.sprite, targetSource.sprite || {}));
  mergedTarget.glb = normalizeGlb(targetSource.glb, defaultTarget.glb, targetIndex);
  return mergedTarget;
}

function normalizeTargets(rawTargets, {
  defaultTarget,
  fallbackTargetsByIndex,
  scene,
}) {
  return rawTargets
    .map((targetLike, orderIndex) => {
      return normalizeTarget(targetLike, orderIndex, {
        defaultTarget,
        fallbackTargetsByIndex,
        scene,
      });
    })
    .filter(Boolean)
    .sort((a, b) => a.targetIndex - b.targetIndex);
}

function generatedTargets(targetCount) {
  return Array.from({ length: targetCount }, (_, targetIndex) => ({ targetIndex }));
}

function normalizeScene(sceneLike, orderIndex, context) {
  const sceneSource = isPlainObject(sceneLike) ? sceneLike : {};
  const rawMindTargetUrl = sceneSource.mindTargetUrl || sceneSource.mindFileUrl || sceneSource.mindTargetSrc || sceneSource.url || context.fallbackMindTargetUrl;
  const sceneId = String(sceneSource.sceneId || sceneSource.id || sceneIdFromMindTargetUrl(rawMindTargetUrl) || `scene-${orderIndex}`);
  const scene = {
    ...sceneSource,
    sceneId,
    label: String(sceneSource.label || labelForScene(sceneId)),
    mindTargetUrl: resolveArAssetUrl(rawMindTargetUrl),
    targetCount: positiveInteger(sceneSource.targetCount),
  };

  const preserveManifestTargets = sceneId === context.defaultSceneId || rawMindTargetUrl === context.fallbackMindTargetUrl;
  const rawSceneTargets = Array.isArray(sceneSource.targets) && sceneSource.targets.length
    ? sceneSource.targets
    : preserveManifestTargets && context.manifestTargets.length
      ? context.manifestTargets
      : generatedTargets(scene.targetCount);

  const fallbackTargetsByIndex = preserveManifestTargets
    ? context.fallbackTargetsByIndex
    : new Map();
  scene.targets = normalizeTargets(rawSceneTargets, {
    defaultTarget: context.defaultTarget,
    fallbackTargetsByIndex,
    scene,
  });
  scene.targetCount = positiveInteger(scene.targetCount, scene.targets.length);
  return scene;
}

function normalizeScenes(source, sceneCatalog, context) {
  const catalogScenes = Array.isArray(sceneCatalog?.scenes) ? sceneCatalog.scenes : [];
  const sourceScenes = Array.isArray(source.scenes) ? source.scenes : [];
  const rawScenes = [...catalogScenes, ...sourceScenes];
  const sceneMap = new Map();

  if (!rawScenes.length) {
    rawScenes.push({
      sceneId: context.defaultSceneId,
      label: labelForScene(context.defaultSceneId),
      mindTargetUrl: context.fallbackMindTargetUrl,
      targets: context.manifestTargets,
    });
  }

  rawScenes.forEach((sceneLike, orderIndex) => {
    const scene = normalizeScene(sceneLike, orderIndex, context);
    sceneMap.set(scene.sceneId, scene);
  });

  return Array.from(sceneMap.values());
}

function addTargetAssets(assetMap, targets) {
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
}

function getCatalogUrlFromSource(raw) {
  const defaults = createDefaultArManifest();
  const source = isPlainObject(raw) ? raw : {};
  const catalogUrl = source.sceneCatalogUrl !== undefined
    ? source.sceneCatalogUrl
    : defaults.sceneCatalogUrl;
  return catalogUrl ? resolveArAssetUrl(catalogUrl) : null;
}

export function normalizeArManifest(raw, { sceneCatalog = null, catalogWarning = '' } = {}) {
  const defaults = createDefaultArManifest();
  const source = isPlainObject(raw) ? raw : {};
  const defaultSceneId = String(source.defaultSceneId || sceneCatalog?.defaultSceneId || defaults.defaultSceneId || 'targets');
  const fallbackMindTargetUrl = source.mindTargetUrl || defaults.mindTargetUrl;
  const defaultTarget = mergeObject(defaults.defaultTarget, source.defaultTarget || {});
  defaultTarget.renderMode = normalizeRenderMode(defaultTarget.renderMode);
  defaultTarget.sprite = normalizeSprite(defaultTarget.sprite);
  defaultTarget.glb = normalizeGlb(defaultTarget.glb, defaults.defaultTarget.glb, 0);

  const baseScene = {
    sceneId: defaultSceneId,
    label: labelForScene(defaultSceneId),
    mindTargetUrl: resolveArAssetUrl(fallbackMindTargetUrl),
  };
  const rawTargets = Array.isArray(source.targets) && source.targets.length ? source.targets : defaults.targets;
  const fallbackTargetsByIndex = new Map(defaults.targets.map((target) => [target.targetIndex, target]));
  const manifestTargets = normalizeTargets(rawTargets, {
    defaultTarget,
    fallbackTargetsByIndex,
    scene: baseScene,
  });

  const scenes = normalizeScenes(source, sceneCatalog, {
    defaultTarget,
    defaultSceneId,
    fallbackMindTargetUrl,
    fallbackTargetsByIndex,
    manifestTargets,
  });

  const resolvedDefaultScene = scenes.find((scene) => scene.sceneId === defaultSceneId) || scenes[0] || null;
  const targets = resolvedDefaultScene?.targets?.length ? resolvedDefaultScene.targets : manifestTargets;

  const assetMap = new Map();
  [...(defaults.assets || []), ...(Array.isArray(source.assets) ? source.assets : [])]
    .map(normalizeAsset)
    .filter(Boolean)
    .forEach((item) => assetMap.set(item.id, item));

  addTargetAssets(assetMap, targets);
  scenes.forEach((scene) => addTargetAssets(assetMap, scene.targets || []));

  const manifest = {
    ...source,
    schemaVersion: Number(source.schemaVersion) || defaults.schemaVersion,
    sceneCatalogUrl: getCatalogUrlFromSource(source),
    defaultSceneId: resolvedDefaultScene?.sceneId || defaultSceneId,
    mindTargetUrl: resolvedDefaultScene?.mindTargetUrl || resolveArAssetUrl(fallbackMindTargetUrl),
    assets: Array.from(assetMap.values()),
    defaultTarget,
    scenes,
    targets,
  };

  if (catalogWarning) manifest.__warning = catalogWarning;
  return manifest;
}

export async function loadArManifest({ force = false } = {}) {
  if (!force && cachedManifest) return cachedManifest;
  if (!force && manifestPromise) return manifestPromise;

  manifestPromise = fetch(getArManifestUrl(), { cache: 'no-cache' })
    .then((response) => {
      if (!response.ok) throw new Error(`AR manifest request failed: ${response.status}`);
      return response.json();
    })
    .then(async (raw) => {
      let sceneCatalog = null;
      const catalogWarnings = [];
      const sceneApiUrl = getSceneApiUrl();
      if (sceneApiUrl) {
        try {
          const response = await fetch(sceneApiUrl, { cache: 'no-cache' });
          if (!response.ok) throw new Error(`AR scene API request failed: ${response.status}`);
          sceneCatalog = normalizeSceneCatalogFromApi(await response.json());
          if (!sceneCatalog) throw new Error('AR scene API returned an invalid scene catalog.');
        } catch (error) {
          catalogWarnings.push(String(error?.message || error));
          sceneCatalog = null;
        }
      }

      const catalogUrl = getCatalogUrlFromSource(raw);
      if (!sceneCatalog && catalogUrl) {
        try {
          const response = await fetch(catalogUrl, { cache: 'no-cache' });
          if (!response.ok) throw new Error(`AR scene catalog request failed: ${response.status}`);
          sceneCatalog = await response.json();
        } catch (error) {
          catalogWarnings.push(String(error?.message || error));
        }
      }
      cachedManifest = normalizeArManifest(raw, {
        sceneCatalog,
        catalogWarning: catalogWarnings.join(' | '),
      });
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

export function getSceneCatalog(manifest) {
  return clone(manifest?.scenes || []);
}

export function getSceneById(manifest, sceneId) {
  const scenes = manifest?.scenes || [];
  if (!scenes.length) return null;
  const id = sceneId == null ? manifest?.defaultSceneId : String(sceneId);
  return scenes.find((scene) => scene.sceneId === id) || scenes.find((scene) => scene.sceneId === manifest?.defaultSceneId) || scenes[0] || null;
}

export function getRuntimeSceneManifest(manifest, sceneId) {
  const scene = getSceneById(manifest, sceneId);
  if (!scene) return manifest;
  return {
    ...manifest,
    mindTargetUrl: scene.mindTargetUrl || manifest.mindTargetUrl,
    targets: Array.isArray(scene.targets) && scene.targets.length ? scene.targets : manifest.targets,
    currentScene: clone(scene),
  };
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
