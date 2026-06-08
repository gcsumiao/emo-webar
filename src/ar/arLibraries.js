import { asset } from '../lib/assetUrl.js';

const AFRAME_VENDOR_URL = asset('/vendor/aframe-1.6.0.min.js');
const MINDAR_VENDOR_URL = asset('/vendor/mindar-image-aframe-1.2.5.prod.js');

let librariesPromise = null;
let aframePromise = null;

function loadScriptOnce({ id, src, isReady }) {
  if (isReady?.()) return Promise.resolve();

  const existing = document.getElementById(id);
  if (existing) {
    if (existing.dataset.loaded === 'true') return Promise.resolve();
    return new Promise((resolve, reject) => {
      if (isReady?.()) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

export function ensureAFrameLibrary() {
  if (aframePromise) return aframePromise;

  aframePromise = loadScriptOnce({
    id: 'emo-aframe-runtime',
    src: AFRAME_VENDOR_URL,
    isReady: () => Boolean(window.AFRAME),
  })
    .then(() => import('./components/index.js'))
    .then(() => window.AFRAME);

  return aframePromise;
}

export function ensureArLibraries() {
  if (librariesPromise) return librariesPromise;

  librariesPromise = ensureAFrameLibrary()
    .then(() => loadScriptOnce({
      id: 'emo-mindar-runtime',
      src: MINDAR_VENDOR_URL,
      isReady: () => Boolean(window.AFRAME?.components?.['mindar-image']),
    }))
    .then(() => window.AFRAME);

  return librariesPromise;
}
