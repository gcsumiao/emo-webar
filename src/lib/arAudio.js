import { asset } from './assetUrl.js';

const AR_BGM_URL = asset('/assets/step06/audio/bgm-10249.m4a');
const AR_SHUTTER_URL = asset('/assets/step06/audio/shutter-10249.m4a');
const AR_INTRO_CUE_SECONDS = 4;

let bgm = null;
let shutter = null;
let bgmLoopStart = null;

function makeAudio(url) {
  const audio = new Audio(url);
  audio.preload = 'auto';
  audio.playsInline = true;
  return audio;
}

function getBgm() {
  if (!bgm) {
    bgm = makeAudio(AR_BGM_URL);
    bgm.addEventListener('timeupdate', () => {
      if (bgmLoopStart === null) return;
      if (!Number.isFinite(bgm.duration) || bgm.duration <= bgmLoopStart) return;
      if (bgm.currentTime >= bgm.duration - 0.08) {
        try {
          bgm.currentTime = bgmLoopStart;
        } catch {}
        bgm.play().catch(() => {});
      }
    });
    bgm.addEventListener('ended', () => {
      if (bgmLoopStart === null) return;
      try {
        bgm.currentTime = bgmLoopStart;
      } catch {}
      bgm.play().catch(() => {});
    });
  }
  return bgm;
}

function getShutter() {
  if (!shutter) shutter = makeAudio(AR_SHUTTER_URL);
  return shutter;
}

function playFrom(seconds, { loop = false } = {}) {
  const audio = getBgm();
  bgmLoopStart = loop ? seconds : null;
  audio.loop = false;
  try {
    audio.currentTime = seconds;
  } catch {}
  audio.play().catch(() => {});
}

export const arAudio = {
  preload: () => {
    getBgm().load();
    getShutter().load();
  },
  startScan: () => playFrom(0, { loop: true }),
  cueARIntro: () => playFrom(AR_INTRO_CUE_SECONDS, { loop: true }),
  playShutter: () => {
    const audio = getShutter();
    try {
      audio.currentTime = 0;
    } catch {}
    audio.play().catch(() => {});
  },
  stop: () => {
    bgmLoopStart = null;
    [bgm, shutter].forEach((audio) => {
      if (!audio) return;
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch {}
    });
  },
};
