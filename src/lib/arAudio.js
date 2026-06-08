import { asset } from './assetUrl.js';

const AR_BGM_URL = asset('/assets/step06/audio/bgm.mp3');
const AR_DROP_BOUNCE_URL = asset('/assets/step06/audio/drop-bounce.mp3');
const AR_BRANCH_POP_URL = asset('/assets/step06/audio/branch-pop.mp3');
const AR_SHUTTER_URL = asset('/assets/step06/audio/shutter.mp3');
const UI_BUTTON_URL = asset('/assets/step06/audio/button-click.mp3');

let bgm = null;
let dropBouncePool = null;
let branchPopPool = null;
let shutterPool = null;
let buttonClickPool = null;
let arEffectsPreloaded = false;
let shutterPreloaded = false;
let uiClickPreloaded = false;
let bgmPreloaded = false;
let bgmPrimed = false;
let effectsPrimed = false;
let unlockPromise = null;
let currentState = 'unknown';

const ONE_SHOT_POOL_SIZE = 4;
const DIAGNOSTIC_LIMIT = 20;

function makeAudio(url) {
  const audio = new Audio(url);
  audio.preload = 'auto';
  audio.playsInline = true;
  return audio;
}

function makeAudioPool(url, size = ONE_SHOT_POOL_SIZE) {
  return Array.from({ length: size }, () => makeAudio(url));
}

function getBgm() {
  if (!bgm) {
    bgm = makeAudio(AR_BGM_URL);
    bgm.loop = true;
  }
  return bgm;
}

function getBranchPop() {
  if (!branchPopPool) branchPopPool = makeAudioPool(AR_BRANCH_POP_URL);
  return branchPopPool;
}

function getDropBounce() {
  if (!dropBouncePool) dropBouncePool = makeAudioPool(AR_DROP_BOUNCE_URL);
  return dropBouncePool;
}

function getShutter() {
  if (!shutterPool) shutterPool = makeAudioPool(AR_SHUTTER_URL);
  return shutterPool;
}

function getButtonClick() {
  if (!buttonClickPool) buttonClickPool = makeAudioPool(UI_BUTTON_URL);
  return buttonClickPool;
}

function getDiagnostics() {
  if (typeof window === 'undefined') return null;
  if (!window.__emoAudioDiagnostics) {
    window.__emoAudioDiagnostics = {
      failures: [],
      lastFailure: null,
      markers: [],
      lastMarker: null,
    };
  }
  return window.__emoAudioDiagnostics;
}

function recordPlayFailure(audio, error, context = {}) {
  if (context.action === 'button-click' && error?.name === 'AbortError') return;

  const diagnostics = getDiagnostics();
  const failure = {
    at: new Date().toISOString(),
    action: context.action || 'play',
    state: context.state || currentState,
    src: audio?.currentSrc || audio?.src || context.src || '',
    name: error?.name || 'Error',
    message: error?.message || String(error || 'Unknown audio playback error'),
  };

  if (diagnostics) {
    diagnostics.lastFailure = failure;
    diagnostics.failures.push(failure);
    if (diagnostics.failures.length > DIAGNOSTIC_LIMIT) {
      diagnostics.failures.splice(0, diagnostics.failures.length - DIAGNOSTIC_LIMIT);
    }
  }

  if (typeof console !== 'undefined') {
    console.warn('[EMO audio] play() failed', failure);
  }
}

function playAudio(audio, context) {
  if (!audio) return Promise.resolve(false);
  let playPromise;
  try {
    audio.__emoPendingPlay = true;
    playPromise = audio.play();
  } catch (error) {
    audio.__emoPendingPlay = false;
    recordPlayFailure(audio, error, context);
    return Promise.resolve(false);
  }

  if (!playPromise || typeof playPromise.catch !== 'function') {
    audio.__emoPendingPlay = false;
    return Promise.resolve(true);
  }

  return playPromise
    .then(() => {
      audio.__emoPendingPlay = false;
      return true;
    })
    .catch((error) => {
      audio.__emoPendingPlay = false;
      recordPlayFailure(audio, error, context);
      return false;
    });
}

function safeLoadAudio(audio) {
  if (!audio || audio.__emoPendingPlay || (!audio.paused && !audio.ended)) return;
  try {
    audio.load();
  } catch {}
}

function preloadUiClick() {
  if (uiClickPreloaded) return;
  uiClickPreloaded = true;
  getButtonClick().forEach(safeLoadAudio);
}

function preloadArEffects({ includeShutter = true } = {}) {
  if (!arEffectsPreloaded) {
    arEffectsPreloaded = true;
    [...getDropBounce(), ...getBranchPop()].forEach(safeLoadAudio);
  }
  if (includeShutter && !shutterPreloaded) {
    shutterPreloaded = true;
    getShutter().forEach(safeLoadAudio);
  }
}

function preloadAudio({ includeBgm = false, includeUi = false, includeShutter = true } = {}) {
  preloadArEffects({ includeShutter });
  if (includeUi) preloadUiClick();
  if (includeBgm && !bgmPreloaded) {
    bgmPreloaded = true;
    safeLoadAudio(getBgm());
  }
}

function recordMarkerAudio(marker, played) {
  const diagnostics = getDiagnostics();
  if (!diagnostics || !marker) return;
  const entry = {
    at: new Date().toISOString(),
    id: marker.id || '',
    frame: marker.frame ?? null,
    timeSec: marker.timeSec ?? null,
    elapsedSec: marker.elapsedSec ?? null,
    audio: marker.audioName || marker.audio || '',
    played: Boolean(played),
  };
  diagnostics.lastMarker = entry;
  diagnostics.markers.push(entry);
  if (diagnostics.markers.length > DIAGNOSTIC_LIMIT) {
    diagnostics.markers.splice(0, diagnostics.markers.length - DIAGNOSTIC_LIMIT);
  }
}

function playOneShot(pool, action, context = {}) {
  const items = Array.isArray(pool) ? pool : [pool];
  const audio = items.find((item) => !item.__emoPendingPlay && (item.paused || item.ended))
    || items.find((item) => !item.__emoPendingPlay)
    || items[0];
  if (!audio) return Promise.resolve(false);
  audio.__emoPrimeToken = null;
  try {
    audio.currentTime = 0;
  } catch {}
  return playAudio(audio, { action, ...context }).then((played) => {
    if (context.marker) recordMarkerAudio(context.marker, played);
    return played;
  });
}

function startBgm({ restart = false } = {}) {
  const audio = getBgm();
  audio.__emoPrimeToken = null;
  audio.muted = false;
  audio.volume = 1;
  if (restart || audio.ended) {
    try {
      audio.currentTime = 0;
    } catch {}
  }
  playAudio(audio, { action: 'bgm' });
}

function primeAudio(audio, action) {
  if (!audio) return Promise.resolve(false);
  if (audio.__emoPendingPlay) return Promise.resolve(false);
  const primeToken = Symbol(action);
  const previousVolume = audio.volume;
  const previousMuted = audio.muted;
  audio.__emoPrimeToken = primeToken;
  audio.muted = true;
  audio.volume = 0;
  return playAudio(audio, { action }).then((started) => {
    if (audio.__emoPrimeToken === primeToken) {
      audio.pause();
      audio.muted = previousMuted;
      audio.volume = previousVolume;
      audio.__emoPrimeToken = null;
      try {
        audio.currentTime = 0;
      } catch {}
    }
    return started;
  });
}

function primeAudioFromPool(pool, action) {
  const items = Array.isArray(pool) ? pool : [pool];
  const audio = items.find((item) => item && !item.__emoPendingPlay && (item.paused || item.ended))
    || items.find((item) => item && !item.__emoPendingPlay)
    || items[1]
    || items[0];
  return primeAudio(audio, action);
}

function stopArAudio() {
  [bgm, ...(dropBouncePool || []), ...(branchPopPool || []), ...(shutterPool || [])].forEach((audio) => {
    if (!audio) return;
    audio.__emoPrimeToken = null;
    audio.pause();
    audio.muted = false;
    audio.volume = 1;
    try {
      audio.currentTime = 0;
    } catch {}
  });
  bgmPrimed = false;
  effectsPrimed = false;
  unlockPromise = null;
}

export const arAudio = {
  setState: (nextState) => {
    currentState = nextState || 'unknown';
  },
  preload: (options) => {
    preloadAudio(options);
  },
  preloadUiClick: () => {
    preloadUiClick();
  },
  primeCameraStartAudio: ({ event, includeBgm = true } = {}) => {
    const trusted = event?.nativeEvent?.isTrusted ?? event?.isTrusted;
    if (trusted === false) return Promise.resolve(false);
    if (effectsPrimed && (!includeBgm || bgmPrimed)) return unlockPromise || Promise.resolve(true);

    preloadUiClick();
    preloadArEffects({ includeShutter: false });
    if (includeBgm && !bgmPreloaded) {
      bgmPreloaded = true;
      safeLoadAudio(getBgm());
    }

    const effectUnlock = Promise.all([
      primeAudioFromPool(getDropBounce(), 'unlock-drop-bounce'),
      primeAudioFromPool(getBranchPop(), 'unlock-branch-pop'),
    ]).then((results) => {
      const started = results.some(Boolean);
      effectsPrimed = started || effectsPrimed;
      return started;
    });

    if (!includeBgm) {
      unlockPromise = effectUnlock;
      return unlockPromise;
    }

    unlockPromise = Promise.all([
      effectUnlock,
      primeAudio(getBgm(), 'unlock-bgm').then((started) => {
        bgmPrimed = started || bgmPrimed;
        return started;
      }),
    ]).then(([effectStarted, bgmStarted]) => effectStarted || bgmStarted);
    return unlockPromise;
  },
  unlock: ({ event, includeBgm = true } = {}) => {
    return arAudio.primeCameraStartAudio({ event, includeBgm });
  },
  startLoadingBgm: (options) => startBgm(options),
  startScan: () => startBgm(),
  cueARIntro: () => startBgm(),
  playDropBounce: (context) => playOneShot(getDropBounce(), 'drop-bounce', context),
  playBranchPop: (context) => playOneShot(getBranchPop(), 'branch-pop', context),
  playShutter: () => playOneShot(getShutter(), 'shutter'),
  playButtonClick: () => playOneShot(getButtonClick(), 'button-click'),
  stopArAudio,
  stop: stopArAudio,
};
