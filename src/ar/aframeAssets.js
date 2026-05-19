import { asset } from '../lib/assetUrl.js';

const debugMode = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('debug') === '1';

const debugAssets = [
  { id: 'emo-model', type: 'model', src: asset('/assets/step06/models/yimao_animation_ultra_fast_growth.glb') },
];

export const aframeAssets = debugMode ? debugAssets : [];
export const debugGlbAssetId = debugAssets[0].id;
export const isDebugMode = debugMode;
