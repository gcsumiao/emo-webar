import { asset } from './assetUrl.js';

const STEP06_MANIFEST_URL = asset('/assets/step06/manifest.json');

const manifestDefaults = {
  audioUrl: asset('/assets/step06/audio/bgm.mp3'),
  glbUrl: asset('/assets/step06/models/yimao_animation_ultra_fast_growth.glb'),
  fps: 24,
};

let manifest = { ...manifestDefaults };
let manifestPromise = null;
let warmAudio = null;
let warmModel = null;

function normalizeAssetUrl(url) {
  if (!url) return url;
  if (/^(https?:)?\/\//.test(url)) return url;
  // Use the BASE_URL-aware helper so paths work under GitHub Pages subpaths.
  return asset(url);
}

function normalizeManifest(loaded) {
  const next = { ...manifestDefaults, ...loaded };
  next.audioUrl = normalizeAssetUrl(next.audioUrl);
  next.glbUrl = normalizeAssetUrl(next.glbUrl);
  return next;
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
  return loadStep06Manifest().then((loaded) => {
    if (!warmAudio) {
      warmAudio = new Audio(loaded.audioUrl);
      warmAudio.preload = full ? 'auto' : 'metadata';
      warmAudio.playsInline = true;
      try {
        warmAudio.load();
      } catch {}
    } else if (full && warmAudio.preload !== 'auto') {
      warmAudio.preload = 'auto';
      try {
        warmAudio.load();
      } catch {}
    }

    if (full && loaded.glbUrl && !warmModel) {
      warmModel = fetch(loaded.glbUrl, { cache: 'force-cache' })
        .then((response) => {
          if (!response.ok) throw new Error(`Step06 GLB preload failed: ${response.status}`);
          return response.arrayBuffer();
        })
        .then(() => true)
        .catch(() => {
          warmModel = null;
          return false;
        });
    }

    return warmModel;
  });
}

export function getStep06Manifest() {
  return manifest;
}
