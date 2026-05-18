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

const POLAROID = {
  width: 1080,
  ribbon: 98,
  photoHeight: 1178,
  footerHeight: 378,
  pink: '#F29CB0',
  pinkSoft: '#FFE4EC',
  pinkDeep: '#E56D89',
  glyphCrop: { x: 305, y: 884, width: 472, height: 70 },
  cornerSakuraRotations: [-18, 22, -12, 28],
};

POLAROID.framedHeight = POLAROID.ribbon * 2 + POLAROID.photoHeight;
POLAROID.height = POLAROID.framedHeight + POLAROID.footerHeight;

function tintedStripCanvas(frameImage, crop, color) {
  const c = document.createElement('canvas');
  c.width = crop.width;
  c.height = crop.height;
  const x = c.getContext('2d');
  if (!x) return null;
  x.drawImage(frameImage, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color;
  x.fillRect(0, 0, crop.width, crop.height);
  return c;
}

function tileGlyphHorizontal(ctx, glyph, x0, y0, totalWidth, glyphHeight, count, edgeGap) {
  const aspect = glyph.width / glyph.height;
  const drawH = glyphHeight;
  const drawW = drawH * aspect;
  const usable = totalWidth - edgeGap * 2;
  if (drawW * count > usable) {
    const scaled = usable / count;
    const newW = Math.max(120, scaled * 0.92);
    const newH = newW / aspect;
    for (let i = 0; i < count; i++) {
      const slotW = usable / count;
      const dx = x0 + edgeGap + i * slotW + (slotW - newW) / 2;
      const dy = y0 + (drawH - newH) / 2;
      ctx.drawImage(glyph, dx, dy, newW, newH);
    }
    return;
  }
  const itemsW = count * drawW;
  const spacing = count > 1 ? (usable - itemsW) / (count - 1) : 0;
  for (let i = 0; i < count; i++) {
    const dx = x0 + edgeGap + i * (drawW + spacing);
    const dy = y0;
    ctx.drawImage(glyph, dx, dy, drawW, drawH);
  }
}

function tileGlyphVertical(ctx, glyph, x0, y0, stripWidth, totalHeight, count, edgeGap, direction) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, stripWidth, totalHeight);
  ctx.clip();
  const centerX = x0 + stripWidth / 2;
  const centerY = y0 + totalHeight / 2;
  ctx.translate(centerX, centerY);
  ctx.rotate(direction === 'down' ? Math.PI / 2 : -Math.PI / 2);
  const glyphH = Math.min(stripWidth - 28, 56);
  tileGlyphHorizontal(ctx, glyph, -totalHeight / 2, -glyphH / 2, totalHeight, glyphH, count, edgeGap);
  ctx.restore();
}

function drawSakura(ctx, cx, cy, radius, rotationDeg) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotationDeg * Math.PI) / 180);
  ctx.fillStyle = '#fff';
  const petalRx = radius * 0.40;
  const petalRy = radius * 0.60;
  const petalCy = -radius * 0.46;
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.rotate((i * 72 * Math.PI) / 180);
    ctx.beginPath();
    ctx.ellipse(0, petalCy, petalRx, petalRy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = POLAROID.pinkDeep;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPolaroidFrame(ctx, photoImage, width, height, frameImage = null) {
  const { ribbon, photoHeight, framedHeight, pink, pinkSoft, pinkDeep, glyphCrop } = POLAROID;
  const photoX = ribbon;
  const photoY = ribbon;
  const photoW = width - ribbon * 2;
  const photoH = photoHeight;

  // White card background
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);

  // Soft pink inner tint behind the ribbons
  ctx.fillStyle = pinkSoft;
  ctx.fillRect(0, 0, width, framedHeight);

  // Photo into inner window (3:4)
  drawCover(ctx, photoImage, photoX, photoY, photoW, photoH);

  // Pink ribbon ring on four sides
  ctx.fillStyle = pink;
  ctx.fillRect(0, 0, width, ribbon);
  ctx.fillRect(0, framedHeight - ribbon, width, ribbon);
  ctx.fillRect(0, ribbon, ribbon, photoH);
  ctx.fillRect(width - ribbon, ribbon, ribbon, photoH);

  if (sourceReady(frameImage)) {
    const whiteGlyph = tintedStripCanvas(frameImage, glyphCrop, '#ffffff');
    const pinkGlyph = tintedStripCanvas(frameImage, glyphCrop, pinkDeep);
    const glyphH = 44;
    const horGap = 140;
    const verGap = 140;
    if (whiteGlyph) {
      tileGlyphHorizontal(ctx, whiteGlyph, 0, (ribbon - glyphH) / 2, width, glyphH, 3, horGap);
      tileGlyphHorizontal(ctx, whiteGlyph, 0, framedHeight - ribbon + (ribbon - glyphH) / 2, width, glyphH, 3, horGap);
      tileGlyphVertical(ctx, whiteGlyph, 0, 0, ribbon, framedHeight, 3, verGap, 'up');
      tileGlyphVertical(ctx, whiteGlyph, width - ribbon, 0, ribbon, framedHeight, 3, verGap, 'down');
    }

    // Corner sakura — four flowers at the ribbon/photo seams
    const sakuraR = ribbon * 0.46;
    const inset = ribbon - sakuraR * 0.55;
    const [rotTL, rotTR, rotBL, rotBR] = POLAROID.cornerSakuraRotations;
    drawSakura(ctx, inset, inset, sakuraR, rotTL);
    drawSakura(ctx, width - inset, inset, sakuraR, rotTR);
    drawSakura(ctx, inset, framedHeight - inset, sakuraR, rotBL);
    drawSakura(ctx, width - inset, framedHeight - inset, sakuraR, rotBR);

    // Footer: hairlines + centered pinkDeep brand strip
    if (pinkGlyph) {
      const footerCenterY = framedHeight + POLAROID.footerHeight / 2;
      const stripH = 128;
      const aspect = pinkGlyph.width / pinkGlyph.height;
      const stripW = stripH * aspect;
      const stripX = (width - stripW) / 2;
      const gap = 52;
      const hairY = footerCenterY;
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = pinkDeep;
      ctx.fillRect(96, hairY, stripX - gap - 96, 2);
      ctx.fillRect(stripX + stripW + gap, hairY, width - 96 - (stripX + stripW + gap), 2);
      ctx.restore();
      ctx.drawImage(pinkGlyph, stripX, footerCenterY - stripH / 2, stripW, stripH);
    }
  }
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

  const width = POLAROID.width;
  const height = POLAROID.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('Canvas 2D context is unavailable.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  drawPolaroidFrame(ctx, photoImage, width, height, frameImage);

  return canvasToPhoto(canvas, 'emo-ar-framed', 'framed');
}
