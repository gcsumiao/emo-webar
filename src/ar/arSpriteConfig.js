import { getTargetSpriteConfig } from './arManifest.js';

const CHARACTER_PLANE_SIZE = [0.95, 0.95];

export const spriteDefaults = {
  frameSequenceUrls: [],
  finalIdleFrameUrl: null,
  shadowUrl: null,
  glowUrl: null,
  frameRate: 24,
  enterDurationMs: 0,
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

export function createSpriteConfig(overrides = {}) {
  const hasFrameSequence = Array.isArray(overrides.frameSequenceUrls);
  return {
    ...spriteDefaults,
    ...overrides,
    frameSequenceUrls: hasFrameSequence ? overrides.frameSequenceUrls : spriteDefaults.frameSequenceUrls,
    frameRate: overrides.frameRate || spriteDefaults.frameRate,
    finalIdleFrameUrl: overrides.finalIdleFrameUrl || spriteDefaults.finalIdleFrameUrl,
  };
}

export function spriteConfigFor(targetIndex) {
  return createSpriteConfig(spriteOverridesByTarget[targetIndex] || {});
}

export function spriteConfigForTarget(manifest, targetIndexOrTarget) {
  return createSpriteConfig(getTargetSpriteConfig(manifest, targetIndexOrTarget) || {});
}

export const FROZEN_SPRITE_DEFAULTS = {
  finalIdleFrameUrl: null,
  characterPlaneSize: CHARACTER_PLANE_SIZE,
  shadowSize: [0.72, 0.24],
  shadowOpacity: 0,
};
