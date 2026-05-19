import fs from 'node:fs/promises';
import path from 'node:path';
import { createImageDescriptor, compareDescriptors } from './recognitionDescriptor.js';

const DEFAULT_INDEX_PATH = path.join(process.cwd(), 'public', 'assets', 'ar', 'recognition-index.json');
const DEFAULT_MAX_DECODED_BYTES = 3_500_000;
const DEFAULT_MIN_CONFIDENCE = 0.76;
const DEFAULT_MIN_SCENE_MARGIN = 0.02;
const DEFAULT_STRONG_CONFIDENCE = 0.93;

let cachedIndex = null;
let cachedIndexPromise = null;

function asNumber(value, fallback) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseDataUrl(value) {
  const match = String(value || '').match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) return null;
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || '';
  return isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload));
}

export function decodeRecognitionImage(body = {}) {
  const maxBytes = asNumber(process.env.AR_RECOGNITION_MAX_IMAGE_BYTES, DEFAULT_MAX_DECODED_BYTES);
  let buffer = null;

  if (body.imageDataUrl) buffer = parseDataUrl(body.imageDataUrl);
  if (!buffer && body.imageBase64) buffer = Buffer.from(String(body.imageBase64), 'base64');
  if (!buffer || !buffer.length) {
    const error = new Error('Recognition request requires imageDataUrl or imageBase64.');
    error.status = 400;
    throw error;
  }
  if (buffer.length > maxBytes) {
    const error = new Error(`Recognition image is too large. Max decoded bytes: ${maxBytes}.`);
    error.status = 413;
    throw error;
  }
  return buffer;
}

export async function loadRecognitionIndex({ force = false } = {}) {
  if (!force && cachedIndex) return cachedIndex;
  if (!force && cachedIndexPromise) return cachedIndexPromise;

  const indexPath = process.env.AR_RECOGNITION_INDEX_PATH || DEFAULT_INDEX_PATH;
  cachedIndexPromise = fs.readFile(indexPath, 'utf8')
    .then((text) => JSON.parse(text))
    .then((index) => {
      cachedIndex = {
        ...index,
        targets: Array.isArray(index.targets) ? index.targets : [],
      };
      return cachedIndex;
    })
    .catch((error) => {
      if (error?.code !== 'ENOENT') console.warn('[AR recognition] index unavailable:', error);
      cachedIndex = {
        schemaVersion: 1,
        algorithm: 'emo-recognition-v1',
        source: 'missing-index',
        targets: [],
      };
      return cachedIndex;
    })
    .finally(() => {
      cachedIndexPromise = null;
    });

  return cachedIndexPromise;
}

export async function recognizeImage(input, {
  tenant = 'emo',
  location = 'store-a',
  maxCandidates = 5,
} = {}) {
  const index = await loadRecognitionIndex();
  const targets = index.targets || [];
  const descriptor = await createImageDescriptor(input);
  const minConfidence = clamp(
    asNumber(process.env.AR_RECOGNITION_MIN_CONFIDENCE, DEFAULT_MIN_CONFIDENCE),
    0,
    1
  );
  const minSceneMargin = clamp(
    asNumber(process.env.AR_RECOGNITION_MIN_SCENE_MARGIN, DEFAULT_MIN_SCENE_MARGIN),
    0,
    1
  );
  const strongConfidence = clamp(
    asNumber(process.env.AR_RECOGNITION_STRONG_CONFIDENCE, DEFAULT_STRONG_CONFIDENCE),
    0,
    1
  );

  if (!targets.length) {
    return {
      schemaVersion: 1,
      matched: false,
      source: 'cloud-recognition',
      recognitionMode: 'cloud-first',
      tenant,
      location,
      reason: 'recognition-index-empty',
      indexTargetCount: 0,
    };
  }

  const scored = targets
    .map((target) => ({
      target,
      score: compareDescriptors(descriptor, target.descriptor),
    }))
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (Math.abs(scoreDiff) > 0.005) return scoreDiff;
      if (a.target.sceneId === 'targets' && b.target.sceneId !== 'targets') return 1;
      if (b.target.sceneId === 'targets' && a.target.sceneId !== 'targets') return -1;
      return 0;
    });
  const best = scored[0] || null;
  const bestDifferentScene = scored.find((item) => item.target.sceneId !== best?.target.sceneId) || null;
  const sceneMargin = best ? best.score - (bestDifferentScene?.score || 0) : 0;
  const matched = Boolean(
    best &&
    best.score >= minConfidence &&
    (sceneMargin >= minSceneMargin || best.score >= strongConfidence)
  );
  const candidates = scored.slice(0, Math.max(1, Number(maxCandidates) || 5)).map(({ target, score }) => ({
    sceneId: target.sceneId,
    targetId: target.targetId,
    targetIndex: target.targetIndex,
    label: target.label,
    confidence: score,
  }));

  if (!matched) {
    return {
      schemaVersion: 1,
      matched: false,
      source: 'cloud-recognition',
      recognitionMode: 'cloud-first',
      tenant,
      location,
      confidence: best?.score || 0,
      scoreMargin: sceneMargin,
      threshold: minConfidence,
      sceneMarginThreshold: minSceneMargin,
      strongConfidenceThreshold: strongConfidence,
      candidates,
    };
  }

  const target = best.target;
  return {
    schemaVersion: 1,
    matched: true,
    source: 'cloud-recognition',
    recognitionMode: 'cloud-first',
    tenant,
    location,
    sceneId: target.sceneId,
    targetId: target.targetId,
    targetIndex: target.targetIndex,
    label: target.label,
    confidence: best.score,
    scoreMargin: sceneMargin,
    mindFileUrl: target.mindFileUrl,
    mindTargetUrl: target.mindFileUrl,
    sourceImageUrl: target.sourceImageUrl || '',
    candidates,
  };
}
