export const defaultAnchoredAr = {
  type: 'model',
  assetId: 'emo-model',
  position: [0, 0, 0.08],
  rotation: [0, 0, 0],
  scale: [0.18, 0.18, 0.18],
  floatTo: [0, 0, 0.13],
};

export const arTargets = [
  { targetIndex: 0, targetId: 'emo-scene-airmodel-01', label: 'EMO installation photo 01' },
  { targetIndex: 1, targetId: 'emo-scene-airmodel-02', label: 'EMO installation photo 02' },
  { targetIndex: 2, targetId: 'emo-pillow', label: 'EMO pillow product' },
  { targetIndex: 3, targetId: 'emo-plush-charm-01', label: 'EMO plush charm 01' },
  { targetIndex: 4, targetId: 'emo-plush-charm-02', label: 'EMO plush charm 02' },
  { targetIndex: 5, targetId: 'emo-front', label: 'EMO front poster' },
].map((target) => ({ ...target, ...defaultAnchoredAr }));
