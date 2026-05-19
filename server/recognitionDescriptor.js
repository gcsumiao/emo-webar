import sharp from 'sharp';

const VECTOR_SIZE = 32;
const HISTOGRAM_SIZE = 64;
const COLOR_BUCKETS = 4;

function round(value, digits = 5) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function bitsToHex(bits) {
  let hex = '';
  for (let index = 0; index < bits.length; index += 4) {
    const nibble = bits.slice(index, index + 4).padEnd(4, '0');
    hex += Number.parseInt(nibble, 2).toString(16);
  }
  return hex;
}

function popcount4(value) {
  let count = 0;
  let next = value;
  while (next) {
    count += next & 1;
    next >>= 1;
  }
  return count;
}

export function hexHammingDistance(left = '', right = '') {
  const length = Math.min(left.length, right.length);
  let distance = Math.abs(left.length - right.length) * 4;
  for (let index = 0; index < length; index += 1) {
    const a = Number.parseInt(left[index], 16);
    const b = Number.parseInt(right[index], 16);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      distance += popcount4(a ^ b);
    }
  }
  return distance;
}

function normalizeVector(values) {
  const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const centered = values.map((value) => value - mean);
  const magnitude = Math.sqrt(centered.reduce((sum, value) => sum + value * value, 0)) || 1;
  return centered.map((value) => round(value / magnitude, 5));
}

function buildAverageHash(values) {
  const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  return bitsToHex(values.map((value) => (value >= mean ? '1' : '0')).join(''));
}

function buildColorHistogram(rgb) {
  const histogram = Array.from({ length: HISTOGRAM_SIZE }, () => 0);
  for (let index = 0; index < rgb.length; index += 3) {
    const r = Math.min(COLOR_BUCKETS - 1, Math.floor((rgb[index] / 256) * COLOR_BUCKETS));
    const g = Math.min(COLOR_BUCKETS - 1, Math.floor((rgb[index + 1] / 256) * COLOR_BUCKETS));
    const b = Math.min(COLOR_BUCKETS - 1, Math.floor((rgb[index + 2] / 256) * COLOR_BUCKETS));
    histogram[(r * COLOR_BUCKETS * COLOR_BUCKETS) + (g * COLOR_BUCKETS) + b] += 1;
  }
  const total = Math.max(1, rgb.length / 3);
  return histogram.map((value) => round(value / total, 5));
}

export async function createImageDescriptor(input) {
  const image = sharp(input, { failOn: 'none' }).rotate();
  const metadata = await image.metadata();
  const luma = await image
    .clone()
    .resize(VECTOR_SIZE, VECTOR_SIZE, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer();
  const lumaValues = Array.from(luma, (value) => value / 255);
  const rgb = await image
    .clone()
    .resize(64, 64, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer();

  return {
    algorithm: 'emo-recognition-v1',
    size: VECTOR_SIZE,
    width: metadata.width || null,
    height: metadata.height || null,
    vector: normalizeVector(lumaValues),
    hash: buildAverageHash(lumaValues),
    histogram: buildColorHistogram(rgb),
  };
}

export function compareDescriptors(left, right) {
  if (!left?.vector?.length || !right?.vector?.length) return 0;
  const length = Math.min(left.vector.length, right.vector.length);
  let dot = 0;
  for (let index = 0; index < length; index += 1) {
    dot += Number(left.vector[index] || 0) * Number(right.vector[index] || 0);
  }
  const vectorScore = Math.max(0, Math.min(1, dot));
  const hashBits = Math.max(1, Math.min(left.hash?.length || 0, right.hash?.length || 0) * 4);
  const hashScore = Math.max(0, 1 - (hexHammingDistance(left.hash, right.hash) / hashBits));
  const histLength = Math.min(left.histogram?.length || 0, right.histogram?.length || 0);
  let histIntersection = 0;
  for (let index = 0; index < histLength; index += 1) {
    histIntersection += Math.min(Number(left.histogram[index] || 0), Number(right.histogram[index] || 0));
  }

  return round((vectorScore * 0.65) + (hashScore * 0.2) + (Math.min(1, histIntersection) * 0.15), 5);
}
