export const DEFAULT_MIND_TARGET_URL = '/assets/mindar/targets.mind';

export const DEFAULT_GLB_ASSET_ID = 'emo-model';

export const DEFAULT_GLB_URL = '/assets/step06/models/yimao-final.glb';

export const DEFAULT_TARGETS = [
  {
    targetIndex: 0,
    targetId: 'emo-scene-airmodel-01',
    label: 'EMO installation photo 01',
  },
  {
    targetIndex: 1,
    targetId: 'emo-scene-airmodel-02',
    label: 'EMO installation photo 02',
  },
  {
    targetIndex: 2,
    targetId: 'emo-pillow',
    label: 'EMO pillow product',
  },
  {
    targetIndex: 3,
    targetId: 'emo-plush-charm-01',
    label: 'EMO plush charm 01',
  },
  {
    targetIndex: 4,
    targetId: 'emo-plush-charm-02',
    label: 'EMO plush charm 02',
  },
  {
    targetIndex: 5,
    targetId: 'emo-front',
    label: 'EMO front poster',
  },
];

export const DEFAULT_GLB_CONFIG = {
  assetId: DEFAULT_GLB_ASSET_ID,
  src: DEFAULT_GLB_URL,
  position: [0, 0, 0.08],
  rotation: [0, 0, 0],
  scale: [0.95, 0.95, 0.95],
  visibleOnTarget: false,
  showAfterSpriteIntro: true,
  animation: {
    introClip: null,
    idleClip: 'Idle',
    loopIdle: true,
    clampIntroWhenFinished: true,
    crossFadeMs: 180,
    timeScale: 1,
  },
  transition: {
    crossfadeMs: 180,
    spriteHideDelayMs: 80,
    flashMs: 120,
  },
};

export const DEFAULT_RENDER_MODE = 'sprite-only';

export function createDefaultArManifest() {
  return {
    schemaVersion: 1,
    mindTargetUrl: DEFAULT_MIND_TARGET_URL,
    assets: [
      {
        id: DEFAULT_GLB_ASSET_ID,
        type: 'model',
        src: DEFAULT_GLB_URL,
      },
    ],
    defaultTarget: {
      renderMode: DEFAULT_RENDER_MODE,
      glb: { ...DEFAULT_GLB_CONFIG },
      sprite: {},
    },
    targets: DEFAULT_TARGETS.map((target) => ({ ...target })),
  };
}
