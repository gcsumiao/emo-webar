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

const ONE_SHOT_POOL_SIZE = 4;

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

function playOneShot(pool) {
  const items = Array.isArray(pool) ? pool : [pool];
  const audio = items.find((item) => item.paused || item.ended) || items[0];
  if (!audio) return;
  try {
    audio.currentTime = 0;
  } catch {}
  audio.play().catch(() => {});
}

function startBgm({ restart = false } = {}) {
  const audio = getBgm();
  if (restart || audio.ended) {
    try {
      audio.currentTime = 0;
    } catch {}
  }
  audio.play().catch(() => {});
}

export const arAudio = {
  preload: () => {
    if (preloaded) return;
    preloaded = true;
    getBgm().load();
    [...getDropBounce(), ...getBranchPop(), ...getShutter(), ...getButtonClick()].forEach((audio) => audio.load());
  },
  startScan: () => startBgm(),
  cueARIntro: () => startBgm(),
  playDropBounce: () => playOneShot(getDropBounce()),
  playBranchPop: () => playOneShot(getBranchPop()),
  playShutter: () => playOneShot(getShutter()),
  playButtonClick: () => playOneShot(getButtonClick()),
  stop: () => {
    [bgm, ...(dropBouncePool || []), ...(branchPopPool || []), ...(shutterPool || [])].forEach((audio) => {
      if (!audio) return;
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch {}
    });
  },
};
