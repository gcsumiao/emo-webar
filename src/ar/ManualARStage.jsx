import React from 'react';
import { ensureAFrameLibrary } from './arLibraries.js';
import {
  getRuntimeSceneManifest,
  getSceneCatalog,
  getTargetGlbConfig,
  getTargetRenderMode,
  loadArManifest,
} from './arManifest.js';
import { DEFAULT_GLB_INTERACTION } from './arManifestDefaults.js';
import { requestCameraPreview } from '../lib/cameraPreview.js';

const RUNTIME_READY_EVENT = 'emo-mindar-runtime-ready';
const MODEL_READY_EVENT = 'emo-ar-model-ready';
const MANUAL_GLB_CONFIG_KEY = 'manual-glb';
const MANUAL_OBJECT_POSITION = { x: 0, y: -0.02, z: -1.18 };
const MANUAL_OBJECT_ROTATION = { x: 0, y: 0, z: 0 };
const MANUAL_OBJECT_SCALE = { x: 1, y: 1, z: 1 };
const MANUAL_MODEL_READY_TIMEOUT_MS = 10000;
const MANUAL_MODEL_PRELOAD_TIMEOUT_MS = 15000;
const FALLBACK_TARGET_INDEX = 0;

function ensureGltfRegistry() {
  if (!window.__gltfRegistry) {
    window.__gltfRegistry = { configs: new Map() };
  }
  return window.__gltfRegistry;
}

function clone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function vectorAttr(value, fallback = [0, 0, 0]) {
  const source = Array.isArray(value) ? value : fallback;
  return source.map((part, index) => {
    const next = Number(part);
    return Number.isFinite(next) ? next : fallback[index] || 0;
  }).join(' ');
}

function parseVector(value, fallback) {
  if (Array.isArray(value)) {
    return {
      x: Number.isFinite(Number(value[0])) ? Number(value[0]) : fallback.x,
      y: Number.isFinite(Number(value[1])) ? Number(value[1]) : fallback.y,
      z: Number.isFinite(Number(value[2])) ? Number(value[2]) : fallback.z,
    };
  }
  if (value && typeof value === 'object') {
    return {
      x: Number.isFinite(Number(value.x)) ? Number(value.x) : fallback.x,
      y: Number.isFinite(Number(value.y)) ? Number(value.y) : fallback.y,
      z: Number.isFinite(Number(value.z)) ? Number(value.z) : fallback.z,
    };
  }
  const parts = String(value || '').trim().split(/\s+/).map(Number);
  return {
    x: Number.isFinite(parts[0]) ? parts[0] : fallback.x,
    y: Number.isFinite(parts[1]) ? parts[1] : fallback.y,
    z: Number.isFinite(parts[2]) ? parts[2] : fallback.z,
  };
}

function formatDegrees(value) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function normalizeDegrees(value) {
  const next = Number(value || 0);
  if (!Number.isFinite(next)) return 0;
  return ((next % 360) + 360) % 360;
}

function normalizePitchRange(range) {
  const min = Array.isArray(range) ? Number(range[0]) : DEFAULT_GLB_INTERACTION.pitchRange[0];
  const max = Array.isArray(range) ? Number(range[1]) : DEFAULT_GLB_INTERACTION.pitchRange[1];
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
    return DEFAULT_GLB_INTERACTION.pitchRange;
  }
  return [min, max];
}

function clampPitchDegrees(value, range = DEFAULT_GLB_INTERACTION.pitchRange) {
  const next = Number(value || 0);
  if (!Number.isFinite(next)) return 0;
  const [min, max] = normalizePitchRange(range);
  return Math.max(min, Math.min(max, next));
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  if (max < min) return (min + max) / 2;
  return Math.max(min, Math.min(max, value));
}

function readAnimationStartFrame(animation = {}) {
  const frame = Number(animation.initialFrame ?? animation.startFrame);
  return Number.isFinite(frame) ? Math.max(0, frame) : 0;
}

function readAnimationEndFrame(animation = {}) {
  const frame = Number(animation.endFrame ?? animation.finalFrame ?? animation.stopFrame);
  return Number.isFinite(frame) ? Math.max(0, frame) : null;
}

function buildGltfModelAttr(glb) {
  if (glb?.src) return `url(${glb.src})`;
  if (glb?.assetId) return `#${glb.assetId}`;
  return '';
}

function createDiagnostics() {
  return {
    status: 'idle',
    provider: 'manual',
    sceneLoaded: false,
    assetsLoaded: true,
    activeTargetId: '',
    frozen: false,
    contentMode: null,
    glbPhase: 'idle',
    modelReady: false,
    modelSrc: '',
    modelError: '',
    lastError: '',
    position: null,
    rotation: null,
    scale: null,
    glbScale: null,
    glbBounds: null,
    glbProjectedSize: null,
    meshCenterNdc: null,
    gltfMarkerId: '',
    gltfMarkerAudio: '',
    gltfMarkerAudioPlayed: null,
    gltfMarkerElapsedSec: null,
    cameraFacingMode: 'environment',
    cameraSwitching: false,
    animationStartFrame: null,
    animationEndFrame: null,
    finalYaw: 0,
    finalPitch: 0,
    lastEvent: '',
  };
}

function readSearchParam(name) {
  try {
    return new URLSearchParams(window.location.search).get(name) || null;
  } catch {
    return null;
  }
}

function getThree() {
  return window.THREE || window.AFRAME?.THREE;
}

function normalizeCameraFacingMode(value) {
  return value === 'user' ? 'user' : 'environment';
}

export function ManualARStage({ prepared = false, visible = false, preloadModel = false, onDiagnostics }) {
  const containerRef = React.useRef(null);
  const preloadModelRef = React.useRef(preloadModel);
  const diagnosticsRef = React.useRef(createDiagnostics());

  const pushDiagnostics = React.useCallback((patch = {}) => {
    diagnosticsRef.current = { ...diagnosticsRef.current, ...patch };
    onDiagnostics?.(diagnosticsRef.current);
    if (patch.lastEvent || patch.modelError || patch.lastError) {
      console.info('[EMO-AR manual]', diagnosticsRef.current);
    }
  }, [onDiagnostics]);

  React.useEffect(() => {
    preloadModelRef.current = preloadModel;
    if (preloadModel) window.__ar?.preloadFinalModel?.();
  }, [preloadModel]);

  React.useEffect(() => {
    if (!prepared) return undefined;

    let cancelled = false;
    let cleanupScene = null;
    let manifest = null;
    let runtimeManifest = null;
    let currentSceneId = readSearchParam('scene') || readSearchParam('mockScene') || null;
    let cameraFacingMode = 'environment';
    const statusCbs = new Set();

    const setRuntimeStatus = (nextStatus) => {
      pushDiagnostics({ status: nextStatus, lastEvent: `status:${nextStatus}` });
      statusCbs.forEach((cb) => {
        try { cb(nextStatus); } catch (error) { console.error(error); }
      });
    };

    const setup = async () => {
      const container = containerRef.current;
      if (!container) return;

      pushDiagnostics({ status: 'libraries-loading', lastEvent: 'manual-aframe-loading' });
      await ensureAFrameLibrary();
      if (cancelled || !containerRef.current) return;
      pushDiagnostics({ status: 'libraries-loaded', lastEvent: 'manual-aframe-loaded' });

      pushDiagnostics({ status: 'manifest-loading', lastEvent: 'manual-manifest-loading' });
      manifest = await loadArManifest();
      if (cancelled || !containerRef.current) return;

      runtimeManifest = getRuntimeSceneManifest(manifest, currentSceneId);
      const activeScene = runtimeManifest.currentScene || null;
      currentSceneId = activeScene?.sceneId || runtimeManifest.defaultSceneId || null;

      pushDiagnostics({
        status: 'manifest-loaded',
        sceneId: currentSceneId || '',
        sceneLabel: activeScene?.label || '',
        manifestWarning: manifest.__warning || (manifest.__fallback ? 'Using default AR manifest fallback.' : ''),
        lastEvent: `manual-scene-selected:${currentSceneId || 'default'}`,
      });

      const gltfRegistry = ensureGltfRegistry();
      const targets = runtimeManifest.targets?.length
        ? runtimeManifest.targets.map(clone)
        : [{ targetIndex: FALLBACK_TARGET_INDEX, targetId: 'manual-target', label: 'Manual target' }];
      const initialTargetIndex = targets[0]?.targetIndex ?? FALLBACK_TARGET_INDEX;
      gltfRegistry.configs.set(MANUAL_GLB_CONFIG_KEY, getTargetGlbConfig(runtimeManifest, initialTargetIndex));

      container.innerHTML = `
        <a-scene embedded
          vr-mode-ui="enabled: false"
          device-orientation-permission-ui="enabled: false"
          renderer="colorManagement: true; alpha: true; preserveDrawingBuffer: true"
          light="defaultLightsEnabled: true"
          style="position:absolute; inset:0; width:100%; height:100%; pointer-events:none; background:transparent;">
          <a-assets timeout="15000"></a-assets>
          <a-camera id="manual-camera" position="0 0 0" look-controls="enabled: false">
            <a-entity id="manual-ar-object" visible="false" position="${MANUAL_OBJECT_POSITION.x} ${MANUAL_OBJECT_POSITION.y} ${MANUAL_OBJECT_POSITION.z}">
              <a-entity id="manual-ar-model"
                class="glb-content"
                visible="false"
                gltf-transition-model="configKey: ${MANUAL_GLB_CONFIG_KEY}"></a-entity>
            </a-entity>
          </a-camera>
        </a-scene>
      `;

      const scene = container.querySelector('a-scene');
      const frozenObject = container.querySelector('#manual-ar-object');
      const frozenModel = container.querySelector('#manual-ar-model');

      let persistentModelAttr = '';
      let persistentModelSrc = '';
      let persistentModelTargetIndex = initialTargetIndex;
      let lastModelReadyEventKey = '';
      let lastTarget = targets[0] ? clone(targets[0]) : null;
      let mockSceneId = readSearchParam('mockScene') || '';
      let initialGlbFrozenState = null;
      const dragState = {
        active: false,
        pointerId: null,
        startPoint: null,
        startPosition: null,
      };
      const frozenState = {
        active: false,
        sourceTarget: null,
        contentMode: null,
        position: { ...MANUAL_OBJECT_POSITION },
        rotation: { ...MANUAL_OBJECT_ROTATION },
        scale: { ...MANUAL_OBJECT_SCALE },
      };

      const getTargetConfig = (targetIndex) => {
        const idx = Number.isFinite(Number(targetIndex))
          ? Number(targetIndex)
          : lastTarget?.targetIndex ?? initialTargetIndex;
        const activeTargets = runtimeManifest?.targets?.length ? runtimeManifest.targets : targets;
        const target = activeTargets.find((item) => item.targetIndex === idx) || activeTargets[0] || null;
        return target ? clone(target) : null;
      };

      const getCurrentTargetConfig = () => getTargetConfig();
      const getCurrentGlbConfig = () => getTargetGlbConfig(
        runtimeManifest,
        getCurrentTargetConfig()?.targetIndex ?? initialTargetIndex
      );
      const getCurrentRenderMode = () => getTargetRenderMode(
        runtimeManifest,
        getCurrentTargetConfig()?.targetIndex ?? initialTargetIndex
      );
      const readInteractionConfig = () => ({
        ...DEFAULT_GLB_INTERACTION,
        ...(getCurrentGlbConfig()?.interaction || {}),
      });
      const getScaleMin = () => {
        const min = Number(readInteractionConfig().minScale);
        return Number.isFinite(min) && min > 0 ? min : DEFAULT_GLB_INTERACTION.minScale;
      };
      const getScaleMax = () => {
        const max = Number(readInteractionConfig().maxScale);
        return Number.isFinite(max) && max > 0 ? Math.max(getScaleMin(), max) : DEFAULT_GLB_INTERACTION.maxScale;
      };
      const cloneFrozenState = () => ({
        active: frozenState.active,
        contentMode: frozenState.contentMode,
        sourceTarget: frozenState.sourceTarget ? clone(frozenState.sourceTarget) : null,
        position: { ...frozenState.position },
        rotation: { ...frozenState.rotation },
        scale: { ...frozenState.scale },
      });
      const getPersistentModelComp = () => frozenModel?.components?.['gltf-transition-model'] || null;
      const isFinalModelReady = (targetIndex = persistentModelTargetIndex) => {
        const idx = Number.isFinite(Number(targetIndex)) ? Number(targetIndex) : persistentModelTargetIndex;
        return persistentModelTargetIndex === idx && Boolean(getPersistentModelComp()?.isReady?.());
      };
      const dispatchFinalModelReady = (targetIndex = persistentModelTargetIndex) => {
        if (!isFinalModelReady(targetIndex)) return false;
        const key = `${targetIndex}:${persistentModelAttr}`;
        if (lastModelReadyEventKey === key) return true;
        lastModelReadyEventKey = key;
        window.dispatchEvent(new CustomEvent(MODEL_READY_EVENT, {
          detail: {
            provider: 'manual',
            targetIndex,
            modelSrc: persistentModelSrc,
            scene: getCurrentScene(),
          },
        }));
        return true;
      };
      const syncRenderMatrices = () => {
        scene.camera?.updateMatrixWorld?.(true);
        scene.object3D?.updateMatrixWorld?.(true);
        frozenObject?.object3D?.updateMatrixWorld?.(true);
      };
      const projectWorldVector = (vector) => {
        const camera = scene.camera;
        if (!camera || !vector) return null;
        syncRenderMatrices();
        const projected = vector.clone().project(camera);
        return { x: projected.x, y: projected.y, z: projected.z };
      };
      const readMeshBounds = () => {
        const THREE = getThree();
        const model = getPersistentModelComp()?.model || frozenModel?.getObject3D?.('mesh');
        if (!THREE || !model) return null;
        syncRenderMatrices();
        const box = new THREE.Box3().setFromObject(model);
        if (box.isEmpty()) return null;
        return box;
      };
      const readMeshCenterProjection = () => {
        const THREE = getThree();
        const box = readMeshBounds();
        if (!THREE || !box) return null;
        const center = new THREE.Vector3();
        box.getCenter(center);
        return projectWorldVector(center);
      };
      const readMeshProjectedSize = () => {
        const THREE = getThree();
        const box = readMeshBounds();
        if (!THREE || !box) return null;
        const corners = [
          [box.min.x, box.min.y, box.min.z],
          [box.min.x, box.min.y, box.max.z],
          [box.min.x, box.max.y, box.min.z],
          [box.min.x, box.max.y, box.max.z],
          [box.max.x, box.min.y, box.min.z],
          [box.max.x, box.min.y, box.max.z],
          [box.max.x, box.max.y, box.min.z],
          [box.max.x, box.max.y, box.max.z],
        ].map(([x, y, z]) => projectWorldVector(new THREE.Vector3(x, y, z))).filter(Boolean);
        if (!corners.length) return null;
        const xs = corners.map((point) => point.x);
        const ys = corners.map((point) => point.y);
        return {
          width: Math.max(...xs) - Math.min(...xs),
          height: Math.max(...ys) - Math.min(...ys),
        };
      };
      const readRenderDiagnostics = (lastEvent = 'manual-render') => {
        const comp = getPersistentModelComp();
        const glb = getCurrentGlbConfig();
        return {
          provider: 'manual',
          frozen: frozenState.active,
          contentMode: frozenState.contentMode,
          position: { ...frozenState.position },
          rotation: { ...frozenState.rotation },
          scale: { ...frozenState.scale },
          finalYaw: frozenState.rotation.y,
          finalPitch: frozenState.rotation.x,
          modelReady: Boolean(comp?.isReady?.()),
          modelSrc: persistentModelSrc,
          glbScale: glb?.scale || null,
          glbBounds: comp?.getBounds?.() || null,
          meshCenterNdc: readMeshCenterProjection(),
          glbProjectedSize: readMeshProjectedSize(),
          animationStartFrame: glb?.animation ? readAnimationStartFrame(glb.animation) : null,
          animationEndFrame: glb?.animation ? readAnimationEndFrame(glb.animation) : null,
          lastEvent,
        };
      };
      const applyFrozenObjectTransform = () => {
        if (!frozenObject?.object3D) return false;
        const THREE = getThree();
        if (!THREE) return false;
        frozenObject.object3D.position.set(
          frozenState.position.x,
          frozenState.position.y,
          frozenState.position.z
        );
        frozenObject.object3D.rotation.set(
          THREE.MathUtils.degToRad(formatDegrees(frozenState.rotation.x)),
          THREE.MathUtils.degToRad(formatDegrees(frozenState.rotation.y)),
          THREE.MathUtils.degToRad(formatDegrees(frozenState.rotation.z))
        );
        frozenObject.object3D.scale.set(frozenState.scale.x, frozenState.scale.y, frozenState.scale.z);
        frozenObject.setAttribute('visible', frozenState.active ? 'true' : 'false');
        return true;
      };
      const applyFrozenState = (lastEvent = 'manual-frozen-transform') => {
        const pitchRange = readInteractionConfig().pitchRange;
        const clampedPitch = clampPitchDegrees(frozenState.rotation.x, pitchRange);
        if (clampedPitch !== frozenState.rotation.x) {
          frozenState.rotation = { ...frozenState.rotation, x: clampedPitch };
        }
        applyFrozenObjectTransform();
        pushDiagnostics(readRenderDiagnostics(lastEvent));
        return cloneFrozenState();
      };
      const resetFrozenDefaults = (sourceTarget = null) => {
        dragState.active = false;
        dragState.pointerId = null;
        dragState.startPoint = null;
        dragState.startPosition = null;
        frozenState.active = true;
        frozenState.contentMode = 'gltf';
        frozenState.sourceTarget = sourceTarget ? clone(sourceTarget) : null;
        frozenState.position = { ...MANUAL_OBJECT_POSITION };
        frozenState.rotation = { ...MANUAL_OBJECT_ROTATION };
        frozenState.scale = { ...MANUAL_OBJECT_SCALE };
      };
      const rememberInitialGlbFrozenState = () => {
        initialGlbFrozenState = cloneFrozenState();
      };
      const applyPersistentGlbTransform = (glb) => {
        if (!frozenModel) return;
        frozenModel.setAttribute('position', vectorAttr(glb?.position, [0, 0, 0]));
        frozenModel.setAttribute('rotation', vectorAttr(glb?.rotation, [0, 0, 0]));
        frozenModel.setAttribute('scale', vectorAttr(glb?.scale, [1, 1, 1]));
      };
      const configurePersistentGlb = (targetIndex = initialTargetIndex) => {
        const idx = Number.isFinite(Number(targetIndex)) ? Number(targetIndex) : initialTargetIndex;
        const glb = getTargetGlbConfig(runtimeManifest, idx);
        if (!glb) {
          const message = `No GLB configured for manual target ${idx}`;
          pushDiagnostics({ glbPhase: 'missing', modelReady: false, modelError: message, lastError: message, lastEvent: `manual-glb-missing:${idx}` });
          return null;
        }
        const modelAttr = buildGltfModelAttr(glb);
        if (!modelAttr) {
          const message = `No GLB source configured for manual target ${idx}`;
          pushDiagnostics({ glbPhase: 'missing', modelReady: false, modelError: message, lastError: message, lastEvent: `manual-glb-source-missing:${idx}` });
          return null;
        }
        const modelSrc = glb.src || modelAttr;
        const attrChanged = persistentModelAttr !== modelAttr;
        persistentModelAttr = modelAttr;
        persistentModelSrc = modelSrc;
        persistentModelTargetIndex = idx;
        if (attrChanged) lastModelReadyEventKey = '';
        gltfRegistry.configs.set(MANUAL_GLB_CONFIG_KEY, glb);
        frozenModel.setAttribute('gltf-transition-model', 'configKey', MANUAL_GLB_CONFIG_KEY);
        const comp = getPersistentModelComp();
        if (attrChanged) comp?.resetLoadState?.();
        comp?.reloadConfig?.(MANUAL_GLB_CONFIG_KEY);
        applyPersistentGlbTransform(glb);
        if (attrChanged || !frozenModel.getAttribute('gltf-model')) {
          frozenModel.setAttribute('gltf-model', modelAttr);
        }
        pushDiagnostics({
          glbPhase: comp?.isReady?.() ? 'preloaded' : 'preloading',
          modelReady: Boolean(comp?.isReady?.()),
          modelSrc,
          modelError: '',
          lastError: '',
          glbScale: glb.scale || null,
          animationStartFrame: glb.animation ? readAnimationStartFrame(glb.animation) : null,
          animationEndFrame: glb.animation ? readAnimationEndFrame(glb.animation) : null,
          lastEvent: `manual-glb-preload:${idx}`,
        });
        if (comp?.isReady?.()) dispatchFinalModelReady(idx);
        return { idx, glb, modelAttr, modelSrc };
      };
      const waitForPersistentModelReady = (timeoutMs = MANUAL_MODEL_READY_TIMEOUT_MS) => new Promise((resolve) => {
        const comp = getPersistentModelComp();
        if (comp?.isReady?.()) {
          pushDiagnostics({ ...readRenderDiagnostics('manual-glb-ready-existing'), frozenModelLoaded: true });
          dispatchFinalModelReady(persistentModelTargetIndex);
          resolve(true);
          return;
        }
        let settled = false;
        const finish = (ready) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeoutId);
          frozenModel?.removeEventListener('gltf-transition-ready', onReady);
          if (ready) dispatchFinalModelReady(persistentModelTargetIndex);
          resolve(ready);
        };
        const onReady = () => {
          pushDiagnostics({ ...readRenderDiagnostics('manual-gltf-transition-ready'), frozenModelLoaded: true, modelReady: true });
          finish(true);
        };
        const timeoutId = window.setTimeout(() => finish(Boolean(getPersistentModelComp()?.isReady?.())), timeoutMs);
        frozenModel?.addEventListener('gltf-transition-ready', onReady, { once: true });
      });
      const preloadPersistentGlb = async (targetIndex = initialTargetIndex) => {
        const configured = configurePersistentGlb(targetIndex);
        if (!configured) return false;
        return waitForPersistentModelReady(MANUAL_MODEL_PRELOAD_TIMEOUT_MS);
      };
      const hideFinalObject = () => {
        dragState.active = false;
        dragState.pointerId = null;
        dragState.startPoint = null;
        dragState.startPosition = null;
        frozenState.active = false;
        frozenState.sourceTarget = null;
        frozenState.contentMode = null;
        frozenState.position = { ...MANUAL_OBJECT_POSITION };
        frozenState.rotation = { ...MANUAL_OBJECT_ROTATION };
        frozenState.scale = { ...MANUAL_OBJECT_SCALE };
        initialGlbFrozenState = null;
        getPersistentModelComp()?.stopAllAnimations?.();
        getPersistentModelComp()?.hide?.({ crossfadeMs: 0 });
        frozenModel?.setAttribute('visible', 'false');
        applyFrozenObjectTransform();
        pushDiagnostics({ ...readRenderDiagnostics('manual-hidden'), glbPhase: 'hidden' });
        return cloneFrozenState();
      };
      const revealModel = async (targetIndex = initialTargetIndex) => {
        const idx = Number.isFinite(Number(targetIndex)) ? Number(targetIndex) : initialTargetIndex;
        const target = getTargetConfig(idx);
        if (target) lastTarget = clone(target);
        const configured = configurePersistentGlb(idx);
        if (!configured) return cloneFrozenState();
        const { glb, modelSrc } = configured;
        resetFrozenDefaults(target);
        applyFrozenState(`manual-glb-loading:${idx}`);
        pushDiagnostics({
          activeTargetId: target?.targetId || '',
          glbPhase: getPersistentModelComp()?.isReady?.() ? 'preloaded' : 'loading',
          modelSrc,
          lastEvent: `manual-glb-loading:${idx}`,
        });

        const ready = await waitForPersistentModelReady(MANUAL_MODEL_READY_TIMEOUT_MS);
        const comp = getPersistentModelComp();
        if (!ready || !comp) {
          const message = `manual GLB not ready for target ${idx}`;
          frozenState.active = false;
          applyFrozenObjectTransform();
          pushDiagnostics({ glbPhase: 'error', modelReady: false, modelError: message, lastError: message, lastEvent: `manual-glb-timeout:${idx}` });
          return cloneFrozenState();
        }

        const animation = glb.animation || {};
        const animationStartFrame = readAnimationStartFrame(animation);
        const animationEndFrame = readAnimationEndFrame(animation);
        const animationFrameOptions = { clips: animation.clips, fps: animation.fps };
        comp.applyAnimationFrame?.(animationEndFrame ?? animationStartFrame, animationFrameOptions);
        frozenModel.setAttribute('visible', 'true');
        applyFrozenState(`manual-glb-before-show:${idx}`);
        comp.applyAnimationFrame?.(animationStartFrame, animationFrameOptions);
        await comp.show?.({ crossfadeMs: glb.transition?.crossfadeMs });
        pushDiagnostics({ ...readRenderDiagnostics(`manual-glb-visible:${idx}`), glbPhase: 'visible', frozenModelLoaded: true, modelReady: true, modelSrc });
        await comp.playIntroThenIdle?.();
        applyFrozenState(`manual-glb-idle:${idx}`);
        rememberInitialGlbFrozenState();
        pushDiagnostics({ ...readRenderDiagnostics(`manual-glb-idle:${idx}`), glbPhase: comp.getAnimationNames?.().length ? 'idle' : 'visible' });
        return cloneFrozenState();
      };
      const restartScan = () => {
        const snapshot = hideFinalObject();
        setRuntimeStatus('running');
        return snapshot;
      };
      const resetFrozenTransform = () => {
        if (!initialGlbFrozenState || !frozenState.active) return cloneFrozenState();
        frozenState.active = initialGlbFrozenState.active;
        frozenState.contentMode = initialGlbFrozenState.contentMode;
        frozenState.sourceTarget = initialGlbFrozenState.sourceTarget ? clone(initialGlbFrozenState.sourceTarget) : null;
        frozenState.position = { ...initialGlbFrozenState.position };
        frozenState.rotation = { ...initialGlbFrozenState.rotation };
        frozenState.scale = { ...initialGlbFrozenState.scale };
        return applyFrozenState('manual-frozen-reset');
      };
      const setFrozenTransform = (transform = {}) => {
        if (!frozenState.active) return cloneFrozenState();
        if (transform.position) frozenState.position = parseVector(transform.position, frozenState.position);
        if (transform.rotation) frozenState.rotation = parseVector(transform.rotation, frozenState.rotation);
        if (transform.scale) frozenState.scale = parseVector(transform.scale, frozenState.scale);
        return applyFrozenState('manual-frozen-set');
      };
      const moveFrozenByScreenDelta = ({ dx = 0, dy = 0, pixelsPerWorldUnit, clampToViewport = true } = {}) => {
        if (!frozenState.active) return cloneFrozenState();
        const viewportWidth = window.innerWidth || 390;
        const ratio = pixelsPerWorldUnit || Math.max(360, viewportWidth * 1.1);
        frozenState.position = {
          ...frozenState.position,
          x: frozenState.position.x + Number(dx || 0) / ratio,
          y: frozenState.position.y - Number(dy || 0) / ratio,
        };
        return clampToViewport ? applyFrozenState('manual-frozen-move') : (applyFrozenObjectTransform(), cloneFrozenState());
      };
      const rotateFrozenBy = ({ yawDelta = 0, pitchDelta = 0, pointerDeltaX = null, pointerDeltaY = null } = {}) => {
        if (!frozenState.active) return cloneFrozenState();
        const interaction = readInteractionConfig();
        const resolvedYawDelta = Number.isFinite(Number(pointerDeltaX))
          ? Number(pointerDeltaX) * (Number(interaction.yawSensitivity) || 0)
          : Number(yawDelta || 0);
        const resolvedPitchDelta = Number.isFinite(Number(pointerDeltaY))
          ? Number(pointerDeltaY) * (Number(interaction.pitchSensitivity) || 0)
          : Number(pitchDelta || 0);
        frozenState.rotation = {
          ...frozenState.rotation,
          x: clampPitchDegrees(frozenState.rotation.x + resolvedPitchDelta, interaction.pitchRange),
          y: normalizeDegrees(frozenState.rotation.y + resolvedYawDelta),
        };
        return applyFrozenState('manual-frozen-rotate');
      };
      const scaleFrozenBy = ({ scaleFactor = 1 } = {}) => {
        if (!frozenState.active) return cloneFrozenState();
        const factor = Number.isFinite(Number(scaleFactor)) ? Number(scaleFactor) : 1;
        const next = clampNumber(frozenState.scale.x * factor, getScaleMin(), getScaleMax());
        frozenState.scale = { x: next, y: next, z: next };
        return applyFrozenState('manual-frozen-scale');
      };
      const beginFrozenDrag = ({ pointerId = null, clientX = 0, clientY = 0 } = {}) => {
        if (!frozenState.active) return cloneFrozenState();
        dragState.active = true;
        dragState.pointerId = pointerId;
        dragState.startPoint = { x: Number(clientX) || 0, y: Number(clientY) || 0 };
        dragState.startPosition = { ...frozenState.position };
        pushDiagnostics({ lastEvent: 'manual-drag-start' });
        return cloneFrozenState();
      };
      const dragFrozenToScreenPoint = ({ pointerId = null, clientX = 0, clientY = 0, clampToViewport = true } = {}) => {
        if (!frozenState.active || !dragState.active || !dragState.startPoint || !dragState.startPosition) return cloneFrozenState();
        if (dragState.pointerId != null && pointerId != null && pointerId !== dragState.pointerId) return cloneFrozenState();
        const viewportWidth = window.innerWidth || 390;
        const ratio = Math.max(360, viewportWidth * 1.1);
        frozenState.position = {
          ...dragState.startPosition,
          x: dragState.startPosition.x + ((Number(clientX) || 0) - dragState.startPoint.x) / ratio,
          y: dragState.startPosition.y - ((Number(clientY) || 0) - dragState.startPoint.y) / ratio,
        };
        return clampToViewport ? applyFrozenState('manual-drag-move') : (applyFrozenObjectTransform(), cloneFrozenState());
      };
      const endFrozenDrag = ({ clampToViewport = true } = {}) => {
        dragState.active = false;
        dragState.pointerId = null;
        dragState.startPoint = null;
        dragState.startPosition = null;
        if (clampToViewport) applyFrozenState('manual-drag-end');
        else pushDiagnostics({ lastEvent: 'manual-drag-end' });
        return cloneFrozenState();
      };
      const switchCameraFacing = async (nextFacingMode) => {
        const targetFacingMode = normalizeCameraFacingMode(
          nextFacingMode || (cameraFacingMode === 'environment' ? 'user' : 'environment')
        );
        pushDiagnostics({ cameraFacingMode: targetFacingMode, cameraSwitching: true, lastEvent: `manual-camera-switching:${targetFacingMode}` });
        try {
          await requestCameraPreview({ facingMode: targetFacingMode });
          cameraFacingMode = targetFacingMode;
          pushDiagnostics({ cameraFacingMode, cameraSwitching: false, lastEvent: `manual-camera-switched:${cameraFacingMode}` });
          return { facingMode: cameraFacingMode, frozenState: cloneFrozenState() };
        } catch (error) {
          const message = String(error?.message || error);
          pushDiagnostics({ cameraSwitching: false, cameraError: message, lastError: message, lastEvent: 'manual-camera-switch-failed' });
          throw error;
        }
      };
      const getCurrentScene = () => runtimeManifest?.currentScene ? clone(runtimeManifest.currentScene) : null;
      const setMockSceneId = (sceneId) => {
        mockSceneId = sceneId == null ? '' : String(sceneId);
        pushDiagnostics({ mockSceneId, lastEvent: mockSceneId ? `manual-mock-scene-set:${mockSceneId}` : 'manual-mock-scene-cleared' });
        return mockSceneId;
      };
      const switchScene = (sceneId) => {
        const requestedId = sceneId == null ? manifest.defaultSceneId : String(sceneId);
        runtimeManifest = getRuntimeSceneManifest(manifest, requestedId);
        currentSceneId = runtimeManifest.currentScene?.sceneId || runtimeManifest.defaultSceneId || currentSceneId;
        lastTarget = getTargetConfig(FALLBACK_TARGET_INDEX);
        pushDiagnostics({
          sceneId: currentSceneId || '',
          sceneLabel: runtimeManifest.currentScene?.label || '',
          lastEvent: `manual-scene-switched:${currentSceneId || 'default'}`,
        });
        return Promise.resolve(getCurrentScene());
      };
      const recognizeFrameMock = async ({ sceneId, targetIndex, confidence } = {}) => {
        const requestedSceneId = sceneId || mockSceneId;
        if (!requestedSceneId) {
          return { matched: true, sceneId: currentSceneId, targetIndex: targetIndex ?? initialTargetIndex, confidence: 1, source: 'manual' };
        }
        const matchedScene = (manifest.scenes || []).find((item) => item.sceneId === String(requestedSceneId)) || null;
        if (!matchedScene) return { matched: false, sceneId: String(requestedSceneId), targetIndex: null, confidence: 0, source: 'manual' };
        return {
          matched: true,
          sceneId: matchedScene.sceneId,
          targetIndex: targetIndex ?? initialTargetIndex,
          confidence: confidence ?? 1,
          source: 'manual',
        };
      };
      const applyRecognitionResult = async (result = {}) => {
        if (!result?.matched) {
          pushDiagnostics({ lastEvent: 'manual-recognition-miss' });
          return { matched: false, scene: getCurrentScene() };
        }
        const requestedSceneId = result.sceneId || currentSceneId || manifest.defaultSceneId;
        if (requestedSceneId && requestedSceneId !== currentSceneId) await switchScene(requestedSceneId);
        const idx = Number.isFinite(Number(result.targetIndex)) ? Number(result.targetIndex) : initialTargetIndex;
        const target = getTargetConfig(idx);
        if (target) lastTarget = clone(target);
        pushDiagnostics({
          activeTargetId: target?.targetId || '',
          lastEvent: `manual-recognition-applied:${requestedSceneId || 'default'}`,
        });
        return {
          matched: true,
          scene: getCurrentScene(),
          target: target ? clone(target) : null,
          confidence: result.confidence ?? null,
        };
      };
      const getFinalModelDebug = () => ({
        targetIndex: persistentModelTargetIndex,
        modelSrc: persistentModelSrc,
        modelAttr: persistentModelAttr,
        ready: Boolean(getPersistentModelComp()?.isReady?.()),
        visible: Boolean(frozenModel?.object3D?.visible),
        bounds: getPersistentModelComp()?.getBounds?.() || null,
        animations: getPersistentModelComp()?.getAnimationNames?.() || [],
        meshCenterNdc: readMeshCenterProjection(),
      });

      const onGltfLoaded = () => {
        window.requestAnimationFrame(() => {
          pushDiagnostics({ ...readRenderDiagnostics('manual-gltf-model-loaded'), glbPhase: getPersistentModelComp()?.isReady?.() ? 'loaded' : diagnosticsRef.current.glbPhase });
        });
      };
      const onGltfError = (event) => {
        const message = event.detail?.error?.message || event.detail?.message || 'Manual GLB model failed to load';
        pushDiagnostics({ glbPhase: 'error', modelReady: false, modelSrc: persistentModelSrc, modelError: message, lastError: message, lastEvent: 'manual-gltf-model-error' });
      };
      const onGltfMarker = (event) => {
        const detail = event.detail || {};
        pushDiagnostics({
          gltfMarkerId: detail.id || '',
          gltfMarkerAudio: detail.audioName || detail.audio || '',
          gltfMarkerElapsedSec: detail.elapsedSec ?? detail.timeSec ?? null,
          lastEvent: `manual-gltf-marker:${detail.id || detail.frame || ''}`,
        });
      };
      const onGltfMarkerAudio = (event) => {
        const detail = event.detail || {};
        pushDiagnostics({
          gltfMarkerId: detail.id || '',
          gltfMarkerAudio: detail.audioName || detail.audio || '',
          gltfMarkerAudioPlayed: Boolean(detail.audioPlayed),
          gltfMarkerElapsedSec: detail.elapsedSec ?? detail.timeSec ?? null,
          lastEvent: `manual-gltf-marker-audio:${detail.id || detail.frame || ''}:${detail.audioPlayed ? 'played' : 'blocked'}`,
        });
      };
      frozenModel?.addEventListener('model-loaded', onGltfLoaded);
      frozenModel?.addEventListener('model-error', onGltfError);
      frozenModel?.addEventListener('gltf-animation-marker', onGltfMarker);
      frozenModel?.addEventListener('gltf-animation-marker-audio', onGltfMarkerAudio);

      window.__ar = {
        provider: 'manual',
        scene,
        targets: targets.map(clone),
        getManifest: () => manifest,
        getSceneCatalog: () => getSceneCatalog(manifest),
        getCurrentScene,
        switchScene,
        recognizeFrameMock,
        applyRecognitionResult,
        getMockSceneId: () => mockSceneId,
        setMockSceneId,
        getTargetConfig,
        getCurrentTargetConfig,
        getCurrentRenderMode,
        getCurrentGlbConfig,
        isFinalModelReady,
        getGlbAnimationNames: () => getPersistentModelComp()?.getAnimationNames?.() || [],
        getCameraFacingMode: () => cameraFacingMode,
        switchCameraFacing,
        getStatus: () => diagnosticsRef.current.status,
        getActiveTargets: () => lastTarget ? [clone(lastTarget)] : [],
        getLastTarget: () => lastTarget ? clone(lastTarget) : null,
        freezeCurrentTarget: () => cloneFrozenState(),
        unfreezeCurrentTarget: () => cloneFrozenState(),
        showFinalObject: (transform = {}) => {
          resetFrozenDefaults(lastTarget);
          if (transform.position || transform.rotation || transform.scale) setFrozenTransform(transform);
          frozenModel?.setAttribute('visible', 'true');
          return applyFrozenState('manual-show-final-object');
        },
        hideFinalObject,
        showFinalModel: revealModel,
        preloadFinalModel: (targetIndex) => preloadPersistentGlb(targetIndex ?? initialTargetIndex),
        hideFinalModel: hideFinalObject,
        revealModelAfterSprite: revealModel,
        getFinalModelDebug,
        playGlbIntro: revealModel,
        playGlbIdle: async (targetIndex) => {
          if (!getPersistentModelComp()?.isReady?.()) await revealModel(targetIndex);
          return getPersistentModelComp()?.playIdle?.();
        },
        restartScan,
        setFrozenTransform,
        resetFrozenTransform,
        getFrozenState: cloneFrozenState,
        beginFrozenDrag,
        dragFrozenToScreenPoint,
        endFrozenDrag,
        moveFrozenByScreenDelta,
        rotateFrozenBy,
        scaleFrozenBy,
        setLiveContentVisible: () => {},
        rotateLiveBy: () => ({ yaw: 0, targetsActive: lastTarget ? 1 : 0 }),
        playSpriteIntro: revealModel,
        stopSpriteIntro: () => {},
        showFinalSprite: () => {},
        hideSprite: () => {},
        getSpriteState: () => ({ phase: frozenState.active ? 'final' : 'hidden', activeTargetIndex: lastTarget?.targetIndex ?? null, frameIndex: 0 }),
        isReady: () => scene.hasLoaded === true,
        onStatus: (cb) => {
          statusCbs.add(cb);
          cb(diagnosticsRef.current.status);
          return () => statusCbs.delete(cb);
        },
        onTargetFound: () => () => {},
        onTargetLost: () => () => {},
        start: async () => {
          setRuntimeStatus('running');
          return { facingMode: cameraFacingMode, frozenState: cloneFrozenState() };
        },
        stop: () => {
          hideFinalObject();
          setRuntimeStatus(scene.hasLoaded ? 'ready' : 'idle');
        },
      };

      if (preloadModelRef.current) preloadPersistentGlb(initialTargetIndex);

      const onSceneLoaded = () => {
        pushDiagnostics({ sceneLoaded: true, status: 'ready', liveModelLoaded: true, lastEvent: 'manual-scene-loaded' });
        setRuntimeStatus('ready');
        window.dispatchEvent(new CustomEvent(RUNTIME_READY_EVENT, {
          detail: { scene: getCurrentScene(), provider: 'manual' },
        }));
      };
      if (scene.hasLoaded) onSceneLoaded();
      else scene.addEventListener('loaded', onSceneLoaded, { once: true });

      cleanupScene = () => {
        frozenModel?.removeEventListener('model-loaded', onGltfLoaded);
        frozenModel?.removeEventListener('model-error', onGltfError);
        frozenModel?.removeEventListener('gltf-animation-marker', onGltfMarker);
        frozenModel?.removeEventListener('gltf-animation-marker-audio', onGltfMarkerAudio);
        scene.removeEventListener('loaded', onSceneLoaded);
        try { hideFinalObject(); } catch {}
        if (window.__ar && window.__ar.scene === scene) delete window.__ar;
        container.innerHTML = '';
      };
    };

    setup().catch((error) => {
      if (cancelled) return;
      const message = String(error?.message || error);
      console.error('[Manual AR] setup failed', error);
      pushDiagnostics({ status: 'error', modelError: message, lastError: message, lastEvent: 'manual-setup-failed' });
      window.__setProtoState?.('error');
    });

    return () => {
      cancelled = true;
      cleanupScene?.();
      pushDiagnostics({ status: 'idle', lastEvent: 'manual-cleanup' });
    };
  }, [prepared, pushDiagnostics]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="ar-layer"
      style={{
        visibility: visible ? 'visible' : 'hidden',
      }}
    />
  );
}
