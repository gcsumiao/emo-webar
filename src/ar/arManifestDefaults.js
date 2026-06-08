export const DEFAULT_MIND_TARGET_URL = '/assets/mindar/targets.mind';

export const DEFAULT_SCENE_CATALOG_URL = '/assets/ar/mindar-scenes.json';

export const DEFAULT_SCENE_ID = 'targets';

export const DEFAULT_GLB_ASSET_ID = 'emo-model';

export const DEFAULT_GLB_URL = '/assets/step06/models/yimao_animation_ultra_fast_growth.glb';

export const DEFAULT_GLB_INTERACTION = {
  rotationMode: 'pivot-trackball',
  pivot: 'boundsCenter',
  pitchRange: [-180, 180],
  yawSensitivity: 0.16,
  pitchSensitivity: 0.12,
  minScale: 0.25,
  maxScale: 2.4,
  screenBoundsMode: 'center-anchor',
  screenMarginNdc: 0,
  screenEdgePaddingPx: 0,
  nearPlaneMargin: 0.08,
};

export const DEFAULT_GLB_LIGHTING = {
  enabled: true,
  preset: 'soft-product-face',
  intensityScale: 1,
};

export const DEFAULT_GLB_MATERIAL_PROFILE = {
  enabled: true,
  preserveOriginal: true,
  rules: [
    {
      nodeNames: ['Polygon_3'],
      metalness: 0,
      roughness: 0.37,
      specularIntensity: 0.55,
      envMapIntensity: 0.24,
      emissive: '#f6b0bd',
      emissiveIntensity: 0.22,
    },
  ],
};

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
  position: [0, 0, 0.02],
  rotation: [0, -90, 0],
  scale: [0.24, 0.24, 0.24],
  visibleOnTarget: false,
  showAfterSpriteIntro: false,
  animation: {
    playMode: 'all-clips-once',
    clips: ['Scene'],
    introClip: null,
    idleClip: null,
    fps: 24,
    startFrame: 1,
    endFrame: 70,
    hiddenNodesUntilFrame: ['Polygon', 'Polygon_2'],
    revealHiddenNodesFrame: 52,
    markers: [
      { id: 'drop-bounce', frame: 1, audio: 'drop-bounce' },
      { id: 'branch-pop', frame: 52, audio: 'branch-pop' },
    ],
    loopIdle: false,
    clampIntroWhenFinished: true,
    crossFadeMs: 0,
    timeScale: 1,
  },
  transition: {
    crossfadeMs: 0,
    spriteHideDelayMs: 0,
    flashMs: 0,
  },
  interaction: { ...DEFAULT_GLB_INTERACTION },
  lighting: { ...DEFAULT_GLB_LIGHTING },
  materialProfile: { ...DEFAULT_GLB_MATERIAL_PROFILE },
};

export const DEFAULT_RENDER_MODE = 'gltf-only';

export function createDefaultArManifest() {
  return {
    schemaVersion: 1,
    sceneCatalogUrl: DEFAULT_SCENE_CATALOG_URL,
    defaultSceneId: DEFAULT_SCENE_ID,
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
