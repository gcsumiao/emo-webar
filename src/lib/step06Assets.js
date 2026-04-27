const STEP06_MANIFEST_URL = '/assets/step06/manifest.json';

const manifestDefaults = {
  frameUrls: [],
  frameCount: 292,
  introDurationMs: 10004,
  frameDurationMs: 34,
  audioUrl: '/assets/step06/audio/yimao-intro.m4a',
  glbUrl: '/assets/step06/models/yimao-sitting.glb',
  finalFrameUrl: '/assets/step06/sequence/1_0300.png',
  width: 768,
  height: 768,
  fps: 29.188,
};

let manifest = { ...manifestDefaults };
let manifestPromise = null;
const imageCache = new Map();
let warmAudio = null;

function normalizeAssetUrl(url) {
  if (!url) return url;
  if (/^(https?:)?\/\//.test(url) || url.startsWith('/')) return url;
  return `/${url}`;
}

function normalizeManifest(loaded) {
  const next = { ...manifestDefaults, ...loaded };
  next.frameUrls = (next.frameUrls || []).map(normalizeAssetUrl);
  next.audioUrl = normalizeAssetUrl(next.audioUrl);
  next.glbUrl = normalizeAssetUrl(next.glbUrl);
  next.finalFrameUrl = normalizeAssetUrl(next.finalFrameUrl);
  return next;
}

export function primeImage(url) {
  if (!url) return Promise.resolve(null);
  const normalized = normalizeAssetUrl(url);
  if (imageCache.has(normalized)) return imageCache.get(normalized);
  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.decoding = 'async';
    image.src = normalized;
  });
  imageCache.set(normalized, promise);
  return promise;
}

export function loadStep06Manifest() {
  if (manifestPromise) return manifestPromise;
  manifestPromise = fetch(STEP06_MANIFEST_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`Step06 manifest request failed: ${response.status}`);
      return response.json();
    })
    .then((loaded) => {
      manifest = normalizeManifest(loaded);
      return manifest;
    })
    .catch(() => manifest);
  return manifestPromise;
}

export function preloadStep06({ full = false } = {}) {
  loadStep06Manifest().then((loaded) => {
    if (loaded.frameUrls.length) {
      primeImage(loaded.frameUrls[0]);
      primeImage(loaded.finalFrameUrl || loaded.frameUrls[loaded.frameUrls.length - 1]);
      if (full) loaded.frameUrls.forEach(primeImage);
    }

    if (!warmAudio) {
      warmAudio = new Audio(loaded.audioUrl);
      warmAudio.preload = full ? 'auto' : 'metadata';
      warmAudio.playsInline = true;
      try {
        warmAudio.load();
      } catch {}
    }
  });
}

function frameNumberFromUrl(url) {
  const match = String(url || '').match(/1_(\d+)\.png$/);
  return match ? Number(match[1]) : null;
}

export function getFrameUrlsInRange(startFrame, endFrame) {
  const hasRange = Number.isFinite(startFrame) && Number.isFinite(endFrame);
  if (!hasRange) return manifest.frameUrls;
  return manifest.frameUrls.filter((url) => {
    const frameNumber = frameNumberFromUrl(url);
    return frameNumber !== null && frameNumber >= startFrame && frameNumber <= endFrame;
  });
}

export function preloadUrls(urls = [], { eagerCount = 24 } = {}) {
  if (!Array.isArray(urls) || !urls.length) return;
  const normalizedUrls = urls.map(normalizeAssetUrl);
  normalizedUrls.slice(0, eagerCount).forEach(primeImage);
  primeImage(normalizedUrls[normalizedUrls.length - 1]);

  const restUrls = normalizedUrls.slice(eagerCount);
  const schedule = window.requestIdleCallback || ((cb) => window.setTimeout(cb, 80));
  let index = 0;
  const loadBatch = () => {
    restUrls.slice(index, index + 12).forEach(primeImage);
    index += 12;
    if (index < restUrls.length) schedule(loadBatch);
  };
  schedule(loadBatch);
}

export function getStep06Manifest() {
  return manifest;
}

export function getStep06FrameUrl(index) {
  return manifest.frameUrls[index] || manifest.finalFrameUrl || manifest.frameUrls[manifest.frameUrls.length - 1] || null;
}

export const introFrameRanges = [[9, 56], [242, 261]];
export const introFrameUrls = introFrameRanges.flatMap(([start, end]) =>
  Array.from({ length: end - start + 1 }, (_, i) => `/assets/step06/intro-hq/1_${String(start + i).padStart(4, '0')}.png`)
);
export const introDurationMs = Math.round((introFrameUrls.length / 30) * 1000);
