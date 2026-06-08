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
let preloaded = false;
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
    playPromise = audio.play();
  } catch (error) {
    recordPlayFailure(audio, error, context);
    return Promise.resolve(false);
  }

  if (!playPromise || typeof playPromise.catch !== 'function') {
    return Promise.resolve(true);
  }

  return playPromise
    .then(() => true)
    .catch((error) => {
      recordPlayFailure(audio, error, context);
      return false;
    });
}

function preloadAudio({ includeBgm = false } = {}) {
  if (!preloaded) {
    preloaded = true;
    [...getDropBounce(), ...getBranchPop(), ...getShutter(), ...getButtonClick()].forEach((audio) => audio.load());
  }
  if (includeBgm && !bgmPreloaded) {
    bgmPreloaded = true;
    getBgm().load();
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
  const audio = items.find((item) => item.paused || item.ended) || items[0];
  if (!audio) return Promise.resolve(false);
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
  audio.muted = false;
  audio.volume = 1;
  if (restart || audio.ended) {
    try {
      audio.currentTime = 0;
    } catch {}
  }
  playAudio(audio, { action: 'bgm' });
}

export const arAudio = {
  setState: (nextState) => {
    currentState = nextState || 'unknown';
  },
  preload: (options) => {
    preloadAudio(options);
  },
  unlock: ({ event, includeBgm = true } = {}) => {
    if (event && event.isTrusted === false) return Promise.resolve(false);
    if (effectsPrimed && (!includeBgm || (bgmPrimed && bgm && !bgm.paused))) {
      return unlockPromise || Promise.resolve(true);
    }
    preloadAudio({ includeBgm });

    const buttonAudio = getButtonClick()[0];
    const previousButtonVolume = buttonAudio.volume;
    buttonAudio.volume = 0;
    const effectUnlock = playAudio(buttonAudio, { action: 'unlock-effects' }).then((started) => {
      effectsPrimed = started || effectsPrimed;
      buttonAudio.pause();
      buttonAudio.volume = previousButtonVolume;
      try {
        buttonAudio.currentTime = 0;
      } catch {}
      return started;
    });

    if (!includeBgm) {
      unlockPromise = effectUnlock;
      return unlockPromise;
    }

    const audio = getBgm();
    const previousBgmVolume = audio.volume;
    audio.muted = false;
    audio.volume = 0;
    unlockPromise = Promise.all([
      effectUnlock,
      playAudio(audio, { action: 'unlock-bgm' }).then((started) => {
        bgmPrimed = started;
        return started;
      }),
    ]).then(([effectStarted, bgmStarted]) => {
      audio.volume = previousBgmVolume;
      return effectStarted || bgmStarted;
    });
    return unlockPromise;
  },
  startScan: () => startBgm(),
  cueARIntro: () => startBgm(),
  playDropBounce: (context) => playOneShot(getDropBounce(), 'drop-bounce', context),
  playBranchPop: (context) => playOneShot(getBranchPop(), 'branch-pop', context),
  playShutter: () => playOneShot(getShutter(), 'shutter'),
  playButtonClick: () => playOneShot(getButtonClick(), 'button-click'),
  stop: () => {
    [bgm, ...(dropBouncePool || []), ...(branchPopPool || []), ...(shutterPool || []), ...(buttonClickPool || [])].forEach((audio) => {
      if (!audio) return;
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
  },
};
