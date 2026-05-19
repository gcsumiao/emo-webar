function sourceReady(source) {
  if (!source) return false;
  if (source instanceof HTMLVideoElement) {
    return source.readyState >= 2 && source.videoWidth > 0 && source.videoHeight > 0;
  }
  if (source instanceof HTMLCanvasElement) {
    return source.width > 0 && source.height > 0;
  }
  if (source instanceof HTMLImageElement) {
    return source.complete && source.naturalWidth > 0 && source.naturalHeight > 0;
  }
  return false;
}

function sourceSize(source) {
  if (source instanceof HTMLVideoElement) {
    return { width: source.videoWidth, height: source.videoHeight };
  }
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  return { width: source.width, height: source.height };
}

function drawCover(ctx, source, dx, dy, dw, dh) {
  if (!sourceReady(source)) return false;
  const { width: sw, height: sh } = sourceSize(source);
  const scale = Math.max(dw / sw, dh / sh);
  const cw = dw / scale;
  const ch = dh / scale;
  const sx = (sw - cw) / 2;
  const sy = (sh - ch) / 2;
  try {
    ctx.drawImage(source, sx, sy, cw, ch, dx, dy, dw, dh);
    return true;
  } catch {
    return false;
  }
}

function getCameraVideo() {
  const videos = Array.from(document.querySelectorAll('.ar-layer video, a-scene video, video'));
  return videos.find((video) => sourceReady(video)) || null;
}

function getArCanvas() {
  const canvases = Array.from(document.querySelectorAll('.ar-layer canvas, a-scene canvas, canvas'));
  return canvases.find((canvas) => sourceReady(canvas)) || null;
}

function drawBackground(ctx, cssWidth, cssHeight) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  const video = getCameraVideo();
  drawCover(ctx, video, 0, 0, cssWidth, cssHeight);
  const canvas = getArCanvas();
  drawCover(ctx, canvas, 0, 0, cssWidth, cssHeight);
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not create AR photo blob.'));
    }, 'image/png');
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load image: ${src}`));
    image.src = src;
  });
}

async function canvasToPhoto(canvas, filenamePrefix, source) {
  const blob = await canvasToBlob(canvas);
  const filename = `${filenamePrefix}-${Date.now()}.png`;
  const file = typeof File === 'function'
    ? new File([blob], filename, { type: 'image/png' })
    : null;
  return {
    blob,
    file,
    url: URL.createObjectURL(blob),
    width: canvas.width,
    height: canvas.height,
    source,
  };
}

export async function createARPhoto() {
  const cssWidth = window.innerWidth || document.documentElement.clientWidth || 390;
  const cssHeight = window.innerHeight || document.documentElement.clientHeight || 844;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D context is unavailable.');

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  drawBackground(ctx, cssWidth, cssHeight);

  return canvasToPhoto(canvas, 'emo-ar', 'mindar');
}

export async function createFramedARPhoto(photo, frameUrl = null) {
  if (!photo?.url) throw new Error('Cannot create framed photo without a captured image.');
  const [photoImage, frameImage] = await Promise.all([
    loadImage(photo.url),
    frameUrl ? loadImage(frameUrl).catch(() => null) : Promise.resolve(null),
  ]);

  const photoWidth = photoImage.naturalWidth || photo.width || 1080;
  const photoHeight = photoImage.naturalHeight || photo.height || 1920;
  const canvasWidth = photoWidth;
  const canvasHeight = sourceReady(frameImage) && frameImage.naturalWidth > 0
    ? Math.round(photoWidth * (frameImage.naturalHeight / frameImage.naturalWidth))
    : photoHeight;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D context is unavailable.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  drawCover(ctx, photoImage, 0, 0, photoWidth, photoHeight);
  if (sourceReady(frameImage)) {
    ctx.drawImage(frameImage, 0, 0, canvasWidth, canvasHeight);
  }

  return canvasToPhoto(canvas, 'emo-ar-framed', 'framed');
}
