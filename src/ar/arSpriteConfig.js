import { introFps, introFrameUrls } from '../lib/step06Assets.js';
import { asset } from '../lib/assetUrl.js';

const FINAL_IDLE_FRAME = asset('/assets/step06/sequence/1_0300.png');
const CHARACTER_PLANE_SIZE = [0.95, 0.95];

export const spriteDefaults = {
  frameSequenceUrls: introFrameUrls,
  finalIdleFrameUrl: FINAL_IDLE_FRAME,
  shadowUrl: null,
  glowUrl: null,
  frameRate: introFps,
  enterDurationMs: 120,
  enterFromPosition: [0, 0, 0],
  enterToPosition:   [0, 0, 0],
  enterFromScale:    [1, 1, 1],
  enterToScale:      [1, 1, 1],
  enterEasing: 'easeOutBack',
  idleFloatToZ: 0,
  idleFloatDurationMs: 1800,
  shadowOpacity: 0,
  shadowSize: [0.72, 0.24],
  characterPlaneSize: CHARACTER_PLANE_SIZE,
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
  characterPlaneSize: CHARACTER_PLANE_SIZE,
  shadowSize: [0.72, 0.24],
  shadowOpacity: 0,
};
