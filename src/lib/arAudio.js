import { asset } from './assetUrl.js';

const AR_BGM_URL = asset('/assets/step06/audio/bgm.mp3');
const AR_DROP_BOUNCE_URL = asset('/assets/step06/audio/drop-bounce.mp3');
const AR_BRANCH_POP_URL = asset('/assets/step06/audio/branch-pop.mp3');
const AR_SHUTTER_URL = asset('/assets/step06/audio/shutter.mp3');
const UI_BUTTON_URL = asset('/assets/step06/audio/button-click.mp3');

let bgm = null;
let dropBounce = null;
let branchPop = null;
let shutter = null;
let buttonClick = null;
let preloaded = false;

function makeAudio(url) {
  const audio = new Audio(url);
  audio.preload = 'auto';
  audio.playsInline = true;
  return audio;
}

function getBgm() {
  if (!bgm) {
    bgm = makeAudio(AR_BGM_URL);
    bgm.loop = true;
  }
  return bgm;
}

function getBranchPop() {
  if (!branchPop) branchPop = makeAudio(AR_BRANCH_POP_URL);
  return branchPop;
}

function getDropBounce() {
  if (!dropBounce) dropBounce = makeAudio(AR_DROP_BOUNCE_URL);
  return dropBounce;
}

function getShutter() {
  if (!shutter) shutter = makeAudio(AR_SHUTTER_URL);
  return shutter;
}

function getButtonClick() {
  if (!buttonClick) buttonClick = makeAudio(UI_BUTTON_URL);
  return buttonClick;
}

function playOneShot(audio) {
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
    getDropBounce().load();
    getBranchPop().load();
    getShutter().load();
    getButtonClick().load();
  },
  startScan: () => startBgm(),
  cueARIntro: () => startBgm(),
  playDropBounce: () => playOneShot(getDropBounce()),
  playBranchPop: () => playOneShot(getBranchPop()),
  playShutter: () => playOneShot(getShutter()),
  playButtonClick: () => playOneShot(getButtonClick()),
  stop: () => {
    [bgm, dropBounce, branchPop, shutter].forEach((audio) => {
      if (!audio) return;
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch {}
    });
  },
};
