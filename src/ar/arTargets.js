import {
  DEFAULT_GLB_CONFIG,
  DEFAULT_TARGETS,
} from './arManifestDefaults.js';

export const LIVE_ANCHORED_GLB_SCALE = DEFAULT_GLB_CONFIG.scale[0];

export const defaultAnchoredAr = {
  type: 'model',
  assetId: DEFAULT_GLB_CONFIG.assetId,
  position: [...DEFAULT_GLB_CONFIG.position],
  rotation: [0, 0, 0],
  scale: [
    LIVE_ANCHORED_GLB_SCALE,
    LIVE_ANCHORED_GLB_SCALE,
    LIVE_ANCHORED_GLB_SCALE,
  ],
  floatTo: [0, 0, 0.12],
};

export const arTargets = DEFAULT_TARGETS.map((target) => ({
  ...target,
  ...defaultAnchoredAr,
}));
