import { primeImage } from './step06Assets.js';

const FRAME_WHITE = 'rgba(255,255,255,0.96)';
const FRAME_PINK = 'rgba(244,183,200,0.92)';

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

function drawContain(ctx, source, cx, cy, maxWidth, rotationDeg, scale) {
  if (!sourceReady(source)) return false;
  const { width: sw, height: sh } = sourceSize(source);
  const width = maxWidth;
  const height = width * (sh / sw);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotationDeg * Math.PI) / 180);
  ctx.scale(scale, scale);
  ctx.drawImage(source, -width / 2, -height / 2, width, height);
  ctx.restore();
  return true;
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
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
  if (drawCover(ctx, video, 0, 0, cssWidth, cssHeight)) return;

  const canvas = getArCanvas();
  drawCover(ctx, canvas, 0, 0, cssWidth, cssHeight);
}

function drawPhotoFrame(ctx, cssWidth, cssHeight) {
  const inset = Math.max(10, Math.min(cssWidth, cssHeight) * 0.025);
  const whiteWidth = Math.max(8, Math.min(cssWidth, cssHeight) * 0.026);
  const pinkWidth = Math.max(5, Math.min(cssWidth, cssHeight) * 0.014);
  const radius = Math.max(22, Math.min(cssWidth, cssHeight) * 0.055);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = FRAME_WHITE;
  ctx.lineWidth = whiteWidth;
  drawRoundedRect(ctx, inset, inset, cssWidth - inset * 2, cssHeight - inset * 2, radius);
  ctx.stroke();

  ctx.strokeStyle = FRAME_PINK;
  ctx.lineWidth = pinkWidth;
  const innerInset = inset + whiteWidth * 0.8;
  drawRoundedRect(ctx, innerInset, innerInset, cssWidth - innerInset * 2, cssHeight - innerInset * 2, radius * 0.72);
  ctx.stroke();
  ctx.restore();
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not create AR photo blob.'));
    }, 'image/png');
  });
}

export async function createARPhoto({ spriteSrc, visualTransform, isLandscapePhone }) {
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

  const spriteImage = await primeImage(spriteSrc);
  const transform = visualTransform || {};
  drawContain(
    ctx,
    spriteImage,
    cssWidth / 2 + (transform.x || 0),
    cssHeight * (isLandscapePhone ? 0.47 : 0.44) + (transform.y || 0),
    Math.min(cssWidth * 0.72, 420),
    transform.rotation || 0,
    transform.scale || 1
  );

  drawPhotoFrame(ctx, cssWidth, cssHeight);

  const blob = await canvasToBlob(canvas);
  const filename = `emo-ar-${Date.now()}.png`;
  const file = typeof File === 'function'
    ? new File([blob], filename, { type: 'image/png' })
    : null;
  return {
    blob,
    file,
    url: URL.createObjectURL(blob),
    width: canvas.width,
    height: canvas.height,
  };
}
