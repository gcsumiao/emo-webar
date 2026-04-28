import { introFrameUrls } from '../lib/step06Assets.js';

const FINAL_IDLE_FRAME = '/assets/step06/intro-hq/1_0261.png';

export const spriteDefaults = {
  frameSequenceUrls: introFrameUrls,
  finalIdleFrameUrl: FINAL_IDLE_FRAME,
  shadowUrl: null,
  glowUrl: null,
  frameRate: 30,
  enterDurationMs: 700,
  enterFromPosition: [0, 0, 0.03],
  enterToPosition:   [0, 0, 0.14],
  enterFromScale:    [0.001, 0.001, 0.001],
  enterToScale:      [0.45, 0.45, 0.45],
  enterEasing: 'easeOutBack',
  idleFloatToZ: 0.17,
  idleFloatDurationMs: 1800,
  shadowOpacity: 0.22,
  shadowSize: [0.42, 0.18],
  characterPlaneSize: [0.45, 0.45],
  billboardYOnly: false,
};

export const spriteOverridesByTarget = {
  // Per-target overrides go here, e.g. 0: { finalIdleFrameUrl: '...' }
};

export function spriteConfigFor(targetIndex) {
  return { ...spriteDefaults, ...(spriteOverridesByTarget[targetIndex] || {}) };
}

export const FROZEN_SPRITE_DEFAULTS = {
  finalIdleFrameUrl: FINAL_IDLE_FRAME,
  characterPlaneSize: [0.45, 0.45],
  shadowSize: [0.42, 0.18],
  shadowOpacity: 0.22,
};
