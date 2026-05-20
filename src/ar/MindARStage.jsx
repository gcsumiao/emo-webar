import React from 'react';
import { aframeAssets, isDebugMode, debugGlbAssetId } from './aframeAssets.js';
import {
  getRuntimeSceneManifest,
  getSceneCatalog,
  getTargetGlbConfig,
  getTargetRenderMode,
  loadArManifest,
} from './arManifest.js';
import { arTargets } from './arTargets.js';
import { DEFAULT_GLB_INTERACTION } from './arManifestDefaults.js';
import { spriteConfigForTarget, FROZEN_SPRITE_DEFAULTS } from './arSpriteConfig.js';
import './components/index.js';

const PERSISTENT_SPRITE_CONFIG_KEY = 'persistent-sprite';
const PERSISTENT_GLB_CONFIG_KEY = 'persistent-glb';
const FROZEN_SPRITE_POSITION = { x: 0, y: -0.02, z: -1.18 };
const FROZEN_SPRITE_ROTATION = { x: 0, y: 0, z: 0 };
const FROZEN_SPRITE_SCALE = { x: 1, y: 1, z: 1 };
const FROZEN_SPRITE_SCALE_MIN = 0.25;
const FROZEN_SPRITE_SCALE_MAX = 2.4;
const FINAL_BASE_RENDER_DEPTH = Math.abs(FROZEN_SPRITE_POSITION.z);
const FINAL_NEAR_DEPTH_MULTIPLIER = 1.2;
const DROP_ENTER_MARGIN_RATIO = 0.16;
const GLB_INITIAL_CENTER_NDC = { x: 0, y: 0 };
const GLB_LIGHT_RIG_ID = 'glb-light-rig';
const GLB_LIGHT_TARGET_ID_PREFIX = 'glb-light-target';
const GLB_LIGHT_DEFAULT_TARGET_POSITION = [0, -0.02, -FINAL_BASE_RENDER_DEPTH];
const GLB_LIGHT_PRESETS = {
  'soft-product-face': [
    { id: 'ambient', type: 'ambient', color: '#fff7fa', intensity: 0.055 },
    { id: 'hemisphere', type: 'hemisphere', color: '#fff9fc', groundColor: '#bc416f', intensity: 0.1 },
    { id: 'key', type: 'directional', color: '#fff9fb', intensity: 0.82, position: [-0.96, 1.05, -0.38], targetPosition: [-0.06, 0.06, -FINAL_BASE_RENDER_DEPTH] },
    { id: 'face-spot', type: 'spot', color: '#fff0f4', intensity: 0.24, position: [-0.46, 0.2, -0.72], targetPosition: [-0.08, -0.03, -FINAL_BASE_RENDER_DEPTH], angle: 44, penumbra: 0.98, distance: 2.1, decay: 1.55 },
    { id: 'face-sheen', type: 'point', color: '#fff4f7', intensity: 0.034, position: [-0.22, 0.06, -0.82], distance: 1.35, decay: 1.9 },
    { id: 'face-center-fill', type: 'spot', color: '#fff3f6', intensity: 0.14, position: [-0.03, -0.03, -0.78], targetPosition: [-0.01, -0.12, -FINAL_BASE_RENDER_DEPTH], angle: 50, penumbra: 0.99, distance: 2.15, decay: 1.85 },
    { id: 'right-fill', type: 'point', color: '#e66f99', intensity: 0.009, position: [0.7, -0.08, -0.76], distance: 2.1, decay: 2.15 },
    { id: 'lower-lift', type: 'point', color: '#c94d7a', intensity: 0.006, position: [-0.04, -0.5, -0.82], distance: 1.7, decay: 2.25 },
    { id: 'rim', type: 'directional', color: '#eaf3ff', intensity: 0.045, position: [0.82, 0.16, 0.34], targetPosition: [0.05, 0, -FINAL_BASE_RENDER_DEPTH] },
  ],
};

function ensureSpriteRegistry() {
  if (!window.__spriteRegistry) {
    window.__spriteRegistry = { configs: new Map(), textureCache: new Map() };
  }
  return window.__spriteRegistry;
}

function ensureGltfRegistry() {
  if (!window.__gltfRegistry) {
    window.__gltfRegistry = { configs: new Map() };
  }
  return window.__gltfRegistry;
}

function spriteConfigKey(targetIndex) {
  return `target-${targetIndex}`;
}

function gltfConfigKey(targetIndex) {
  return `glb-target-${targetIndex}`;
}

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function clone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function cloneTarget(target) {
  return clone(target);
}

function readInitialSceneId() {
  try {
    return new URLSearchParams(window.location.search).get('scene') || null;
  } catch {
    return null;
  }
}

function readSearchParam(name) {
  try {
    return new URLSearchParams(window.location.search).get(name) || null;
  } catch {
    return null;
  }
}

function normalizeCameraFacingMode(value) {
  return value === 'user' ? 'user' : 'environment';
}

function cameraFacingConstraint(facingMode, exact = false) {
  const nextFacingMode = normalizeCameraFacingMode(facingMode);
  return exact ? { exact: nextFacingMode } : { ideal: nextFacingMode };
}

function withCameraFacingConstraint(constraints, facingMode, exact = false) {
  const next = constraints && typeof constraints === 'object' ? { ...constraints } : {};
  if (next.video === false) return next;
  const facingModeConstraint = cameraFacingConstraint(facingMode, exact);
  next.video = next.video && typeof next.video === 'object'
    ? { ...next.video, facingMode: facingModeConstraint }
    : { facingMode: facingModeConstraint };
  return next;
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
  if (min > max) return (min + max) / 2;
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

function mergeTransformConfig(glb, transformOverride = {}) {
  return {
    position: transformOverride.position || glb?.position || [0, 0, 0],
    rotation: transformOverride.rotation || glb?.rotation || [0, 0, 0],
    scale: transformOverride.scale || glb?.scale || [1, 1, 1],
  };
}

function getThree() {
  return window.THREE || window.AFRAME?.THREE;
}

function buildGltfModelAttr(glb) {
  if (glb?.assetId) return `#${glb.assetId}`;
  if (glb?.src) return `url(${glb.src})`;
  return '';
}

function formatAttrNumber(value, fallback = 0) {
  const next = Number(value);
  const resolved = Number.isFinite(next) ? next : fallback;
  return Number(resolved.toFixed(4)).toString();
}

function lightSafeId(value) {
  return String(value || 'light').replace(/[^a-z0-9_-]/gi, '');
}

function lightTargetId(light) {
  return `${GLB_LIGHT_TARGET_ID_PREFIX}-${lightSafeId(light.id || light.type)}`;
}

function buildGlbLightEntity(light, intensityScale = 1) {
  const lightParts = [
    `type: ${light.type}`,
    `color: ${light.color || '#ffffff'}`,
    `intensity: ${formatAttrNumber((light.intensity ?? 1) * intensityScale, 1)}`,
    'castShadow: false',
  ];
  if (light.groundColor) lightParts.push(`groundColor: ${light.groundColor}`);
  if (Number.isFinite(Number(light.distance))) lightParts.push(`distance: ${formatAttrNumber(light.distance)}`);
  if (Number.isFinite(Number(light.decay))) lightParts.push(`decay: ${formatAttrNumber(light.decay, 1)}`);
  if (Number.isFinite(Number(light.angle))) lightParts.push(`angle: ${formatAttrNumber(light.angle)}`);
  if (Number.isFinite(Number(light.penumbra))) lightParts.push(`penumbra: ${formatAttrNumber(light.penumbra)}`);
  if (Array.isArray(light.targetPosition)) lightParts.push(`target: #${lightTargetId(light)}`);

  const position = Array.isArray(light.position) ? vectorAttr(light.position, [0, 0, 0]) : '0 0 0';
  const className = `glb-light glb-light-${lightSafeId(light.id || light.type)}`;
  return `<a-entity class="${escapeAttr(className)}" position="${escapeAttr(position)}" light="${escapeAttr(lightParts.join('; '))}"></a-entity>`;
}

function buildGlbLightTargetEntity(light) {
  if (!Array.isArray(light.targetPosition)) return '';
  const targetPosition = vectorAttr(light.targetPosition, GLB_LIGHT_DEFAULT_TARGET_POSITION);
  return `<a-entity id="${escapeAttr(lightTargetId(light))}" class="glb-light-target" position="${escapeAttr(targetPosition)}"></a-entity>`;
}

function buildGlbLightRigContents(lighting = {}) {
  const enabled = lighting?.enabled !== false;
  if (!enabled) return '';

  const presetName = GLB_LIGHT_PRESETS[lighting?.preset] ? lighting.preset : 'soft-product-face';
  const intensityScale = Number.isFinite(Number(lighting?.intensityScale)) ? Math.max(0, Number(lighting.intensityScale)) : 1;
  const lights = GLB_LIGHT_PRESETS[presetName] || GLB_LIGHT_PRESETS['soft-product-face'];
  return `
    ${lights.map(buildGlbLightTargetEntity).join('')}
    ${lights.map((light) => buildGlbLightEntity(light, intensityScale)).join('')}
  `;
}

function buildGlbLightRigMarkup(lighting = {}) {
  const presetName = GLB_LIGHT_PRESETS[lighting?.preset] ? lighting.preset : 'soft-product-face';
  const presetAttr = lighting?.enabled === false ? '' : ` data-preset="${escapeAttr(presetName)}"`;
  return `<a-entity id="${GLB_LIGHT_RIG_ID}"${presetAttr}>${buildGlbLightRigContents(lighting)}</a-entity>`;
}

function buildAFrameAssetsMarkup(manifest) {
  const assetMap = new Map();
  [...(manifest.assets || []), ...aframeAssets].forEach((item) => {
    if (item?.id && item?.src) assetMap.set(item.id, item);
  });

  return Array.from(assetMap.values()).map((item) => {
    const id = escapeAttr(item.id);
    const src = escapeAttr(item.src);
    if (item.type === 'model') return `<a-asset-item id="${id}" src="${src}"></a-asset-item>`;
    if (item.type === 'video') {
      return `<video id="${id}" src="${src}" preload="auto" loop muted playsinline webkit-playsinline crossorigin="anonymous"></video>`;
    }
    return `<img id="${id}" src="${src}" crossorigin="anonymous">`;
  }).join('');
}

function buildSpriteGroupMarkup(target, spriteConfig) {
  const targetId = escapeAttr(target.targetId);
  const label = escapeAttr(target.label);
  const configKey = escapeAttr(spriteConfigKey(target.targetIndex));
  const charW = spriteConfig.characterPlaneSize?.[0] ?? 0.45;
  const charH = spriteConfig.characterPlaneSize?.[1] ?? 0.45;
  const shadowW = spriteConfig.shadowSize?.[0] ?? 0.42;
  const shadowH = spriteConfig.shadowSize?.[1] ?? 0.18;
  const enterFrom = spriteConfig.enterFromPosition || [0, 0, 0.03];
  const billboardAttr = spriteConfig.billboardYOnly ? 'billboard-y' : '';
  const debugGlbMarkup = isDebugMode
    ? `<a-gltf-model class="debug-live-glb" src="#${escapeAttr(debugGlbAssetId)}"
         position="0.25 0 0.05" scale="0.075 0.075 0.075"></a-gltf-model>`
    : '';
  return `
    <a-entity class="anchored-content sprite-anchored-content" data-target-id="${targetId}" data-label="${label}">
      <a-plane class="sprite-shadow"
        position="0 0 0.005"
        rotation="-90 0 0"
        width="${shadowW}" height="${shadowH}"
        material="shader: flat; transparent: true; opacity: 0; color: #1a0a14"></a-plane>
      <a-entity class="sprite-content"
        position="${escapeAttr(enterFrom.join(' '))}"
        sprite-intro-anim="configKey: ${configKey}">
        <a-plane class="sprite-character" ${billboardAttr}
          width="${charW}" height="${charH}"
          material="shader: flat; transparent: true; opacity: 0; alphaTest: 0.02; side: double; depthWrite: false; color: #ffffff"
          sprite-sequence="configKey: ${configKey}; autoplay: false"></a-plane>
      </a-entity>
      ${debugGlbMarkup}
    </a-entity>
  `;
}

function buildFrozenSpriteMarkup() {
  const idleSrc = FROZEN_SPRITE_DEFAULTS.finalIdleFrameUrl
    ? escapeAttr(FROZEN_SPRITE_DEFAULTS.finalIdleFrameUrl)
    : '';
  const spriteMaterial = `shader: flat; transparent: true; opacity: 0; alphaTest: 0.02; side: double; depthWrite: false; color: #ffffff${idleSrc ? `; src: ${idleSrc}` : ''}`;
  const charW = FROZEN_SPRITE_DEFAULTS.characterPlaneSize[0];
  const charH = FROZEN_SPRITE_DEFAULTS.characterPlaneSize[1];
  const shadowW = FROZEN_SPRITE_DEFAULTS.shadowSize[0];
  const shadowH = FROZEN_SPRITE_DEFAULTS.shadowSize[1];
  const debugGlbMarker = isDebugMode
    ? '<a-entity id="debug-glb-marker" visible="false" position="0 0 0"></a-entity>'
    : '';
  return `
    <a-entity id="frozen-ar-object" visible="false" position="${FROZEN_SPRITE_POSITION.x} ${FROZEN_SPRITE_POSITION.y} ${FROZEN_SPRITE_POSITION.z}" rotation="0 0 0">
      <a-plane class="sprite-shadow frozen-shadow"
        position="0 -0.36 -0.02"
        rotation="-70 0 0"
        width="${shadowW}" height="${shadowH}"
        material="shader: flat; transparent: true; opacity: 0; color: #1a0a14; depthWrite: false"></a-plane>
      <a-entity id="persistent-sprite-content" class="sprite-content"
        position="0 0 0"
        sprite-intro-anim="configKey: ${PERSISTENT_SPRITE_CONFIG_KEY}">
        <a-plane id="frozen-sprite-character" class="sprite-character"
          width="${charW}" height="${charH}"
          material="${spriteMaterial}"
          sprite-sequence="configKey: ${PERSISTENT_SPRITE_CONFIG_KEY}; autoplay: false"></a-plane>
      </a-entity>
      <a-entity id="frozen-glb-rotation-pivot" position="0 0 0" rotation="0 0 0">
        <a-entity id="frozen-glb-model-offset" position="0 0 0">
          <a-entity id="frozen-ar-model"
            class="glb-content"
            visible="false"
            gltf-transition-model="configKey: ${PERSISTENT_GLB_CONFIG_KEY}"></a-entity>
        </a-entity>
      </a-entity>
      ${debugGlbMarker}
    </a-entity>
    <a-entity id="frozen-drag-proxy" visible="false"></a-entity>
  `;
}

function createDiagnostics() {
  return {
    sceneLoaded: false,
    assetsLoaded: false,
    modelAssetLoaded: false,
    liveModelLoaded: false,
    frozenModelLoaded: false,
    modelError: '',
    manifestWarning: '',
    status: 'idle',
    lastEvent: '',
    activeTargetId: '',
    frozen: false,
    position: null,
    rotation: null,
    scale: null,
    spritePhase: 'idle',
    glbPhase: 'idle',
    contentMode: null,
    glbBounds: null,
    glbScale: null,
    glbWorld: null,
    glbNdc: null,
    glbCenterTargetNdc: null,
    markerNdc: null,
    meshCenterNdc: null,
    glbProjectedSize: null,
    animationStartFrame: null,
    animationEndFrame: null,
    finalYaw: null,
    finalPitch: null,
    debugMarkerWorld: null,
    cameraNear: null,
    finalRenderDepth: null,
    layerInfo: null,
    modelSrc: '',
    modelReady: false,
    lastError: '',
    frameIndex: 0,
    frameCount: 0,
    textureLoadedCount: 0,
    textureErrorCount: 0,
    texturePendingCount: 0,
    textureReady: false,
    textureWarning: '',
    sceneId: '',
    sceneLabel: '',
    mindTargetUrl: '',
    mockSceneId: '',
    cameraFacingMode: 'environment',
    cameraSwitching: false,
    cameraError: '',
  };
}

export function MindARStage({ active, visible, onDiagnostics }) {
  const containerRef = React.useRef(null);
  const sceneRef = React.useRef(null);
  const startedRef = React.useRef(false);
  const statusRef = React.useRef('idle');
  const activeRef = React.useRef(active);
  const diagnosticsRef = React.useRef(createDiagnostics());

  const pushDiagnostics = React.useCallback((patch = {}) => {
    diagnosticsRef.current = { ...diagnosticsRef.current, ...patch };
    onDiagnostics?.(diagnosticsRef.current);
    if (patch.lastEvent || patch.modelError || patch.manifestWarning) {
      console.info('[EMO-AR]', diagnosticsRef.current);
    }
  }, [onDiagnostics]);

  const startIfNeeded = React.useCallback(async () => {
    const scene = sceneRef.current;
    if (!scene || startedRef.current) return;
    try {
      if (!scene.hasLoaded) {
        await new Promise((resolve) => scene.addEventListener('loaded', resolve, { once: true }));
      }
      await window.__mindar?.start();
    } catch (error) {
      console.error('[MindAR] start failed', error);
      const message = String(error?.name || error?.message || error);
      if (/NotAllowed|Permission|denied/i.test(message)) window.__setProtoState?.('denied');
      else window.__setProtoState?.('error');
    }
  }, []);

  React.useEffect(() => {
    activeRef.current = active;
    if (active) startIfNeeded();
    else if (startedRef.current) window.__mindar?.stop();
  }, [active, startIfNeeded]);

  React.useEffect(() => {
    if (!active) return undefined;

    let cancelled = false;
    let cleanupScene = null;
    let manifest = null;
    let currentSceneId = readInitialSceneId();
    let sceneSwitchQueue = Promise.resolve();
    let cameraSwitchQueue = Promise.resolve();
    let cameraFacingMode = 'environment';
    const foundCbs = new Set();
    const lostCbs = new Set();
    const statusCbs = new Set();

    const setStatus = (nextStatus) => {
      statusRef.current = nextStatus;
      pushDiagnostics({ status: nextStatus, lastEvent: `status:${nextStatus}` });
    };

    const setup = async (requestedSceneId = currentSceneId) => {
      const container = containerRef.current;
      if (!container || sceneRef.current) return;

      if (!manifest) {
        pushDiagnostics({ status: 'manifest-loading', lastEvent: 'manifest-loading' });
        manifest = await loadArManifest();
        if (cancelled || !containerRef.current) return;

        pushDiagnostics({
          status: 'manifest-loaded',
          lastEvent: 'manifest-loaded',
          manifestWarning: manifest.__warning || (manifest.__fallback ? 'Using default AR manifest fallback.' : ''),
        });
      }

      const runtimeManifest = getRuntimeSceneManifest(manifest, requestedSceneId);
      const activeScene = runtimeManifest.currentScene || null;
      currentSceneId = activeScene?.sceneId || runtimeManifest.defaultSceneId || null;
      pushDiagnostics({
        sceneId: currentSceneId || '',
        sceneLabel: activeScene?.label || '',
        mindTargetUrl: runtimeManifest.mindTargetUrl || '',
        lastEvent: `scene-selected:${currentSceneId || 'default'}`,
      });

      const spriteRegistry = ensureSpriteRegistry();
      const gltfRegistry = ensureGltfRegistry();
      const targets = (runtimeManifest.targets?.length ? runtimeManifest.targets : arTargets).map((target) => ({
        ...target,
        sceneId: target.sceneId || activeScene?.sceneId || currentSceneId || '',
        sceneLabel: target.sceneLabel || activeScene?.label || '',
        mindTargetUrl: target.mindTargetUrl || runtimeManifest.mindTargetUrl,
      }));
      targets.forEach((target) => {
        const spriteConfig = spriteConfigForTarget(runtimeManifest, target.targetIndex);
        const glbConfig = getTargetGlbConfig(runtimeManifest, target.targetIndex);
        spriteRegistry.configs.set(spriteConfigKey(target.targetIndex), spriteConfig);
        gltfRegistry.configs.set(gltfConfigKey(target.targetIndex), glbConfig);
      });
      const initialTargetIndex = targets[0]?.targetIndex ?? 0;
      const initialGlbConfig = getTargetGlbConfig(runtimeManifest, initialTargetIndex);
      spriteRegistry.configs.set(PERSISTENT_SPRITE_CONFIG_KEY, spriteConfigForTarget(runtimeManifest, targets[0]?.targetIndex ?? 0));
      gltfRegistry.configs.set(PERSISTENT_GLB_CONFIG_KEY, initialGlbConfig);

      const anchorMarkup = targets.map((target) => {
        const spriteConfig = spriteConfigForTarget(runtimeManifest, target.targetIndex);
        return `<a-entity mindar-image-target="targetIndex: ${target.targetIndex}" id="emo-anchor-${target.targetIndex}">
          ${buildSpriteGroupMarkup(target, spriteConfig)}
        </a-entity>`;
      }).join('');

      container.innerHTML = `
        <a-scene embedded
          mindar-image="imageTargetSrc: ${escapeAttr(runtimeManifest.mindTargetUrl)}; autoStart: false; uiLoading: no; uiScanning: no; uiError: no;"
          vr-mode-ui="enabled: false"
          device-orientation-permission-ui="enabled: false"
          renderer="colorManagement: true; alpha: true; preserveDrawingBuffer: true"
          light="defaultLightsEnabled: ${initialGlbConfig?.lighting?.enabled === false ? 'true' : 'false'}"
          style="position:absolute; inset:0; width:100%; height:100%; pointer-events:none;">
          <a-assets timeout="15000">${buildAFrameAssetsMarkup(runtimeManifest)}</a-assets>
          <a-camera id="emo-camera" position="0 0 0" look-controls="enabled: false">
            ${buildGlbLightRigMarkup(initialGlbConfig?.lighting)}
            ${buildFrozenSpriteMarkup()}
          </a-camera>
          ${anchorMarkup}
        </a-scene>
      `;

      const scene = container.querySelector('a-scene');
      const assets = container.querySelector('a-assets');
      const frozenObject = container.querySelector('#frozen-ar-object');
      const frozenCharacter = container.querySelector('#frozen-sprite-character');
      const persistentSpriteContent = container.querySelector('#persistent-sprite-content');
      const frozenModel = container.querySelector('#frozen-ar-model');
      const frozenGlbPivot = container.querySelector('#frozen-glb-rotation-pivot');
      const frozenGlbModelOffset = container.querySelector('#frozen-glb-model-offset');
      const glbLightRig = container.querySelector(`#${GLB_LIGHT_RIG_ID}`);
      const dragProxy = container.querySelector('#frozen-drag-proxy');
      const debugGlbMarker = container.querySelector('#debug-glb-marker');
      const anchors = targets.map((target) => ({
        target,
        element: container.querySelector(`#emo-anchor-${target.targetIndex}`),
        onFound: null,
        onLost: null,
      })).filter(({ element }) => element);

      const getSpriteContent = (anchor) => anchor?.element?.querySelector('.sprite-content') || null;
      const getCharacterEl = (anchor) => anchor?.element?.querySelector('.sprite-character') || null;
      const getIntroAnim = (anchor) => getSpriteContent(anchor)?.components?.['sprite-intro-anim'] || null;
      const getSpriteSeq = (anchor) => getCharacterEl(anchor)?.components?.['sprite-sequence'] || null;
      const findAnchorByIndex = (idx) => anchors.find((a) => a.target.targetIndex === idx) || null;
      const getPersistentIntroAnim = () => persistentSpriteContent?.components?.['sprite-intro-anim'] || null;
      const getPersistentSeq = () => frozenCharacter?.components?.['sprite-sequence'] || null;
      const getPersistentModelComp = () => frozenModel?.components?.['gltf-transition-model'] || null;
      const applyGlbLighting = (glb) => {
        const lighting = glb?.lighting || {};
        scene.setAttribute('light', `defaultLightsEnabled: ${lighting.enabled === false ? 'true' : 'false'}`);
        if (!glbLightRig) return;
        const presetName = GLB_LIGHT_PRESETS[lighting?.preset] ? lighting.preset : 'soft-product-face';
        if (lighting.enabled === false) glbLightRig.removeAttribute('data-preset');
        else glbLightRig.setAttribute('data-preset', presetName);
        glbLightRig.innerHTML = buildGlbLightRigContents(lighting);
      };
      const plainVector = (vector) => vector
        ? { x: vector.x, y: vector.y, z: vector.z }
        : null;
      const readCameraNear = () => {
        const near = Number(scene.camera?.near);
        return Number.isFinite(near) && near > 0 ? near : null;
      };
      const getFinalRenderDepth = () => Math.max(
        FINAL_BASE_RENDER_DEPTH,
        (readCameraNear() || 0) * FINAL_NEAR_DEPTH_MULTIPLIER
      );
      const getFinalDepthRatio = () => getFinalRenderDepth() / FINAL_BASE_RENDER_DEPTH;
      const toRenderedFrozenPosition = (position) => {
        const ratio = getFinalDepthRatio();
        return {
          x: position.x * ratio,
          y: position.y * ratio,
          z: -getFinalRenderDepth(),
        };
      };
      const toRenderedFrozenScale = (scale) => {
        const ratio = getFinalDepthRatio();
        return {
          x: scale.x * ratio,
          y: scale.y * ratio,
          z: scale.z * ratio,
        };
      };
      const withViewportDropMotion = (spriteConfig) => {
        const next = clone(spriteConfig) || {};
        const THREE = getThree();
        const depth = getFinalRenderDepth();
        const fovDeg = Number(scene.camera?.fov) || 60;
        const fovRad = THREE?.MathUtils?.degToRad
          ? THREE.MathUtils.degToRad(fovDeg)
          : fovDeg * Math.PI / 180;
        const visibleHalfHeight = Math.tan(fovRad / 2) * depth;
        const parentPosition = toRenderedFrozenPosition(FROZEN_SPRITE_POSITION);
        const parentScale = toRenderedFrozenScale(FROZEN_SPRITE_SCALE);
        const characterHeight = Number(next.characterPlaneSize?.[1]) || FROZEN_SPRITE_DEFAULTS.characterPlaneSize[1] || 0.95;
        const halfHeightWorld = characterHeight * parentScale.y * 0.5;
        const marginWorld = Math.max(0.05, characterHeight * parentScale.y * DROP_ENTER_MARGIN_RATIO);
        const startY = (visibleHalfHeight + halfHeightWorld + marginWorld - parentPosition.y) / (parentScale.y || 1);
        const frameCount = Array.isArray(next.frameSequenceUrls) ? next.frameSequenceUrls.length : 0;
        const fps = Number(next.frameRate) || 30;
        return {
          ...next,
          enterFromPosition: [0, startY, 0],
          enterToPosition: [0, 0, 0],
          enterFromScale: [1, 1, 1],
          enterToScale: [1, 1, 1],
          enterDurationMs: frameCount ? Math.round((frameCount / fps) * 1000) : 0,
          idleFloatToZ: 0,
        };
      };
      const syncRenderMatrices = () => {
        scene.camera?.updateMatrixWorld?.(true);
        scene.object3D?.updateMatrixWorld?.(true);
      };
      const projectWorldVector = (vector) => {
        const camera = scene.camera;
        if (!camera || !vector) return null;
        syncRenderMatrices();
        return plainVector(vector.clone().project(camera));
      };
      const readEditBoundsNdc = () => {
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 390;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 844;
        const layerRect = container?.getBoundingClientRect?.() || null;
        const editSurface = document.querySelector('[data-ar-edit-surface="true"]');
        const surfaceRect = editSurface?.getBoundingClientRect?.() || null;
        const hasUsableRect = (rectLike) => (
          rectLike
          && Number.isFinite(rectLike.left)
          && Number.isFinite(rectLike.right)
          && Number.isFinite(rectLike.top)
          && Number.isFinite(rectLike.bottom)
          && rectLike.right > rectLike.left
          && rectLike.bottom > rectLike.top
        );
        const rect = hasUsableRect(layerRect)
          ? layerRect
          : hasUsableRect(surfaceRect)
            ? surfaceRect
            : {
                left: 0,
                right: viewportWidth,
                top: 0,
                bottom: viewportHeight,
              };
        const interaction = frozenState?.contentMode === 'gltf' ? readInteractionConfig() : {};
        const edgePaddingPx = frozenState?.contentMode === 'gltf'
          ? Math.max(0, Number(interaction.screenEdgePaddingPx) || 0)
          : 0;
        const left = clampNumber(rect.left + edgePaddingPx, 0, viewportWidth);
        const right = clampNumber(rect.right - edgePaddingPx, 0, viewportWidth);
        const top = clampNumber(rect.top + edgePaddingPx, 0, viewportHeight);
        const bottom = clampNumber(rect.bottom - edgePaddingPx, 0, viewportHeight);
        if (right <= left || bottom <= top) return null;
        let minX = (left / viewportWidth) * 2 - 1;
        let maxX = (right / viewportWidth) * 2 - 1;
        let minY = 1 - (bottom / viewportHeight) * 2;
        let maxY = 1 - (top / viewportHeight) * 2;
        const marginNdc = frozenState?.contentMode === 'gltf'
          ? Math.max(0, Math.min(0.45, Number(interaction.screenMarginNdc) || 0))
          : 0;
        if (marginNdc > 0 && maxX - minX > marginNdc * 2 && maxY - minY > marginNdc * 2) {
          minX += marginNdc;
          maxX -= marginNdc;
          minY += marginNdc;
          maxY -= marginNdc;
        }
        return { minX, maxX, minY, maxY };
      };
      const readModelProjectionBounds = () => {
        const THREE = getThree();
        const model = getPersistentModelComp()?.model || frozenModel?.getObject3D?.('mesh') || frozenObject?.object3D;
        if (!THREE || !model) return null;
        syncRenderMatrices();
        const box = new THREE.Box3().setFromObject(model);
        if (box.isEmpty()) return null;
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
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        return {
          minX,
          maxX,
          minY,
          maxY,
          centerX: (minX + maxX) / 2,
          centerY: (minY + maxY) / 2,
          width: maxX - minX,
          height: maxY - minY,
        };
      };
      const readModelCameraDepthBounds = () => {
        const THREE = getThree();
        const model = getPersistentModelComp()?.model || frozenModel?.getObject3D?.('mesh') || frozenObject?.object3D;
        if (!THREE || !model || !scene.camera) return null;
        syncRenderMatrices();
        const box = new THREE.Box3().setFromObject(model);
        if (box.isEmpty()) return null;
        const corners = [
          [box.min.x, box.min.y, box.min.z],
          [box.min.x, box.min.y, box.max.z],
          [box.min.x, box.max.y, box.min.z],
          [box.min.x, box.max.y, box.max.z],
          [box.max.x, box.min.y, box.min.z],
          [box.max.x, box.min.y, box.max.z],
          [box.max.x, box.max.y, box.min.z],
          [box.max.x, box.max.y, box.max.z],
        ].map(([x, y, z]) => {
          const cameraSpace = new THREE.Vector3(x, y, z);
          scene.camera.worldToLocal(cameraSpace);
          return -cameraSpace.z;
        }).filter((depth) => Number.isFinite(depth));
        if (!corners.length) return null;
        return {
          minDepth: Math.min(...corners),
          maxDepth: Math.max(...corners),
          centerDepth: corners.reduce((sum, depth) => sum + depth, 0) / corners.length,
        };
      };
      const projectedVector = (object3D) => {
        const THREE = getThree();
        if (!THREE || !object3D) return null;
        syncRenderMatrices();
        const vector = new THREE.Vector3();
        object3D.getWorldPosition(vector);
        return projectWorldVector(vector);
      };
      const readMeshCenterProjection = () => {
        const THREE = getThree();
        const model = getPersistentModelComp()?.model || frozenModel?.getObject3D?.('mesh');
        if (!THREE || !model) return null;
        syncRenderMatrices();
        const box = new THREE.Box3().setFromObject(model);
        if (box.isEmpty()) return null;
        const center = new THREE.Vector3();
        box.getCenter(center);
        return projectWorldVector(center);
      };
      const readMeshProjectedSize = () => {
        const THREE = getThree();
        const model = getPersistentModelComp()?.model || frozenModel?.getObject3D?.('mesh');
        if (!THREE || !model) return null;
        syncRenderMatrices();
        const box = new THREE.Box3().setFromObject(model);
        if (box.isEmpty()) return null;
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
      const readLayerInfo = () => {
        const read = (el) => {
          if (!el) return null;
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return {
            z: style.zIndex,
            position: style.position,
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        };
        const canvas = container.querySelector('canvas') || document.querySelector('canvas.a-canvas, canvas');
        const video = container.querySelector('video') || document.querySelector('video[playsinline], video');
        return {
          canvas: read(canvas),
          video: read(video),
          canvasCount: document.querySelectorAll('canvas').length,
          videoCount: document.querySelectorAll('video').length,
        };
      };
      const configureDebugGlbMarker = () => {
        if (!debugGlbMarker?.object3D) return;
        debugGlbMarker.object3D.traverse((node) => {
          node.frustumCulled = false;
        });
      };
      const readRenderDiagnostics = (lastEvent = 'render-diagnostics') => {
        const THREE = getThree();
        syncRenderMatrices();
        const projectionDiagnostics = frozenState.active
          ? {
              glbNdc: projectedVector(frozenModel?.object3D),
              meshCenterNdc: readMeshCenterProjection(),
              glbProjectedSize: readMeshProjectedSize(),
            }
          : {};
        if (!isDebugMode) {
          return {
            cameraNear: readCameraNear(),
            finalRenderDepth: getFinalRenderDepth(),
            ...projectionDiagnostics,
            lastEvent,
          };
        }
        const glbWorld = THREE && frozenModel?.object3D
          ? plainVector(frozenModel.object3D.getWorldPosition(new THREE.Vector3()))
          : null;
        const markerWorld = THREE && debugGlbMarker?.object3D
          ? plainVector(debugGlbMarker.object3D.getWorldPosition(new THREE.Vector3()))
          : null;
        return {
          cameraNear: readCameraNear(),
          finalRenderDepth: getFinalRenderDepth(),
          glbWorld,
          ...projectionDiagnostics,
          glbCenterTargetNdc: { ...GLB_INITIAL_CENTER_NDC },
          markerNdc: projectedVector(debugGlbMarker?.object3D),
          debugMarkerWorld: markerWorld,
          layerInfo: readLayerInfo(),
          lastEvent,
        };
      };
      const pushRenderDiagnostics = (lastEvent = 'render-diagnostics') => {
        pushDiagnostics(readRenderDiagnostics(lastEvent));
      };

      sceneRef.current = scene;

      const activeTargets = new Map();
      const lostTimers = new Map();
      let lastTarget = null;
      let activeFinalMode = null;
      let liveYawOffset = 0;
      let persistentModelAttr = '';
      let persistentModelSrc = '';
      let persistentModelTargetIndex = targets[0]?.targetIndex ?? 0;
      const frozenState = {
        active: false,
        sourceTarget: null,
        contentMode: null,
        position: { ...FROZEN_SPRITE_POSITION },
        rotation: { ...FROZEN_SPRITE_ROTATION },
        scale: { ...FROZEN_SPRITE_SCALE },
      };
      const dragProxyState = {
        active: false,
        pointerId: null,
        plane: null,
        startPoint: null,
        startPosition: null,
      };
      let glbScaleSafetyLimit = Infinity;
      let initialGlbFrozenState = null;

      const resetGlbScaleSafetyLimit = () => {
        glbScaleSafetyLimit = Infinity;
      };

      const clearInitialGlbFrozenState = () => {
        initialGlbFrozenState = null;
      };

      const rememberGlbScaleSafetyLimit = (scale) => {
        const next = Number(scale);
        if (Number.isFinite(next) && next > 0) {
          glbScaleSafetyLimit = Math.min(glbScaleSafetyLimit, next);
        }
      };

      const resetGlbPivotTransform = () => {
        if (!frozenGlbPivot?.object3D || !frozenGlbModelOffset?.object3D) return false;
        frozenGlbPivot.object3D.position.set(0, 0, 0);
        frozenGlbPivot.object3D.rotation.set(0, 0, 0);
        frozenGlbModelOffset.object3D.position.set(0, 0, 0);
        return true;
      };

      const applyGlbPivotRotation = () => {
        const THREE = getThree();
        if (!THREE || !frozenGlbPivot?.object3D) return false;
        if (frozenState.contentMode !== 'gltf') {
          frozenGlbPivot.object3D.rotation.set(0, 0, 0);
          return true;
        }
        frozenGlbPivot.object3D.rotation.set(
          THREE.MathUtils.degToRad(frozenState.rotation.x),
          THREE.MathUtils.degToRad(frozenState.rotation.y),
          0
        );
        return true;
      };

      const refreshGlbInteractionPivot = () => {
        const THREE = getThree();
        const model = getPersistentModelComp()?.model || frozenModel?.getObject3D?.('mesh');
        if (!THREE || !model || !frozenObject?.object3D || !frozenGlbPivot?.object3D || !frozenGlbModelOffset?.object3D) return false;
        resetGlbPivotTransform();
        syncRenderMatrices();
        const box = new THREE.Box3().setFromObject(model);
        if (box.isEmpty()) return false;
        const centerWorld = new THREE.Vector3();
        box.getCenter(centerWorld);
        const centerLocal = frozenObject.object3D.worldToLocal(centerWorld.clone());
        frozenGlbPivot.object3D.position.copy(centerLocal);
        frozenGlbModelOffset.object3D.position.copy(centerLocal.clone().multiplyScalar(-1));
        applyGlbPivotRotation();
        syncRenderMatrices();
        return true;
      };

      const applyFrozenObjectTransform = () => {
        if (!frozenObject?.object3D) return false;
        const THREE = getThree();
        if (!THREE) return false;
        const renderedPosition = toRenderedFrozenPosition(frozenState.position);
        const renderedScale = toRenderedFrozenScale(frozenState.scale);
        frozenObject.object3D.position.set(renderedPosition.x, renderedPosition.y, renderedPosition.z);
        const parentPitch = frozenState.contentMode === 'gltf' ? 0 : frozenState.rotation.x;
        const parentYaw = frozenState.contentMode === 'gltf' ? 0 : frozenState.rotation.y;
        frozenObject.object3D.rotation.set(
          THREE.MathUtils.degToRad(parentPitch),
          THREE.MathUtils.degToRad(parentYaw),
          THREE.MathUtils.degToRad(frozenState.rotation.z)
        );
        frozenObject.object3D.scale.set(renderedScale.x, renderedScale.y, renderedScale.z);
        frozenObject.setAttribute('visible', frozenState.active ? 'true' : 'false');
        applyGlbPivotRotation();
        return true;
      };

      const moveFrozenByNdcDelta = (deltaNdcX = 0, deltaNdcY = 0) => {
        const THREE = getThree();
        if (!THREE || !scene.camera) return false;
        const depth = getFinalRenderDepth();
        const ratio = getFinalDepthRatio();
        const fovDeg = Number(scene.camera?.fov) || 60;
        const fovRad = THREE.MathUtils?.degToRad
          ? THREE.MathUtils.degToRad(fovDeg)
          : fovDeg * Math.PI / 180;
        const halfHeight = Math.tan(fovRad / 2) * depth;
        const halfWidth = halfHeight * ((window.innerWidth || 390) / (window.innerHeight || 844));
        frozenState.position = {
          ...frozenState.position,
          x: frozenState.position.x + (deltaNdcX * halfWidth) / ratio,
          y: frozenState.position.y + (deltaNdcY * halfHeight) / ratio,
        };
        return true;
      };

      const centerFrozenModelAtNdc = (target = GLB_INITIAL_CENTER_NDC, options = {}) => {
        if (!frozenState.active) return false;
        const center = readMeshCenterProjection();
        if (!center) return false;
        const deltaNdcX = Number(target.x || 0) - center.x;
        const deltaNdcY = Number(target.y || 0) - center.y;
        if (Math.abs(deltaNdcX) < 0.001 && Math.abs(deltaNdcY) < 0.001) return false;
        const changed = moveFrozenByNdcDelta(deltaNdcX, deltaNdcY);
        if (!changed) return false;
        applyFrozenObjectTransform();
        if (options.clampToViewport !== false && clampFrozenToEditBounds()) applyFrozenObjectTransform();
        pushDiagnostics({
          glbCenterTargetNdc: { ...target },
          meshCenterNdc: readMeshCenterProjection(),
          ...readRenderDiagnostics(options.lastEvent || 'glb-centered'),
        });
        return true;
      };

      const clampFrozenToEditBounds = () => {
        if (!frozenState.active) return false;
        const THREE = getThree();
        if (!THREE || !scene.camera) return false;
        const editBounds = readEditBoundsNdc();
        let modelBounds = readModelProjectionBounds();
        if (!editBounds || !modelBounds) return false;
        const editWidth = editBounds.maxX - editBounds.minX;
        const editHeight = editBounds.maxY - editBounds.minY;
        let changed = false;
        if (modelBounds.width > editWidth || modelBounds.height > editHeight) {
          const fitFactor = Math.min(editWidth / modelBounds.width, editHeight / modelBounds.height) * 0.98;
          const minScale = frozenState.contentMode === 'gltf' ? getScaleMin() : FROZEN_SPRITE_SCALE_MIN;
          const nextScale = Math.max(minScale, frozenState.scale.x * fitFactor);
          if (Number.isFinite(nextScale) && nextScale < frozenState.scale.x) {
            frozenState.scale = { x: nextScale, y: nextScale, z: nextScale };
            if (frozenState.contentMode === 'gltf') rememberGlbScaleSafetyLimit(nextScale);
            applyFrozenObjectTransform();
            modelBounds = readModelProjectionBounds() || modelBounds;
            changed = true;
          }
        }
        const targetCenterX = modelBounds.width >= editWidth
          ? (editBounds.minX + editBounds.maxX) / 2
          : clampNumber(
            modelBounds.centerX,
            editBounds.minX + modelBounds.width / 2,
            editBounds.maxX - modelBounds.width / 2
          );
        const targetCenterY = modelBounds.height >= editHeight
          ? (editBounds.minY + editBounds.maxY) / 2
          : clampNumber(
            modelBounds.centerY,
            editBounds.minY + modelBounds.height / 2,
            editBounds.maxY - modelBounds.height / 2
          );
        const deltaNdcX = targetCenterX - modelBounds.centerX;
        const deltaNdcY = targetCenterY - modelBounds.centerY;
        if (Math.abs(deltaNdcX) < 0.001 && Math.abs(deltaNdcY) < 0.001) return changed;
        return moveFrozenByNdcDelta(deltaNdcX, deltaNdcY) || changed;
      };

      const clampFrozenToDepthBounds = () => {
        if (!frozenState.active || frozenState.contentMode !== 'gltf') return false;
        const depthBounds = readModelCameraDepthBounds();
        if (!depthBounds) return false;
        const safeMinDepth = (readCameraNear() || 0.01) + (Number(readInteractionConfig().nearPlaneMargin) || 0);
        if (depthBounds.minDepth >= safeMinDepth) return false;
        const nearSpan = Math.max(0.001, depthBounds.centerDepth - depthBounds.minDepth);
        const allowedSpan = Math.max(0.001, depthBounds.centerDepth - safeMinDepth);
        const fitFactor = Math.max(0.05, Math.min(1, (allowedSpan / nearSpan) * 0.96));
        const nextScale = Math.max(getScaleMin(), frozenState.scale.x * fitFactor);
        if (!Number.isFinite(nextScale) || nextScale >= frozenState.scale.x - 0.0001) return false;
        frozenState.scale = { x: nextScale, y: nextScale, z: nextScale };
        rememberGlbScaleSafetyLimit(nextScale);
        applyFrozenObjectTransform();
        return true;
      };

      const setRuntimeStatus = (nextStatus) => {
        statusRef.current = nextStatus;
        pushDiagnostics({ status: nextStatus, lastEvent: `status:${nextStatus}` });
        statusCbs.forEach((cb) => {
          try { cb(nextStatus); } catch (error) { console.error(error); }
        });
      };

      const getMindARSystem = () => {
        const sys = scene.systems && scene.systems['mindar-image-system'];
        if (!sys) throw new Error('mindar-image-system not ready');
        return sys;
      };

      const probeCameraFacingMode = async (facingMode, exact = false) => {
        if (!navigator.mediaDevices?.getUserMedia) return;
        let probeStream = null;
        try {
          probeStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: cameraFacingConstraint(facingMode, exact) },
            audio: false,
          });
        } finally {
          probeStream?.getTracks?.().forEach((track) => track.stop());
        }
      };

      const runWithCameraFacingMode = async (facingMode, exact, task) => {
        const mediaDevices = navigator.mediaDevices;
        const nativeGetUserMedia = mediaDevices?.getUserMedia;
        if (!nativeGetUserMedia) return task();

        const originalGetUserMedia = nativeGetUserMedia.bind(mediaDevices);
        const patchedGetUserMedia = (constraints) => originalGetUserMedia(
          withCameraFacingConstraint(constraints, facingMode, exact)
        );
        let patched = false;
        try {
          mediaDevices.getUserMedia = patchedGetUserMedia;
          patched = mediaDevices.getUserMedia === patchedGetUserMedia;
        } catch {}

        try {
          return await task();
        } finally {
          if (patched) {
            try {
              mediaDevices.getUserMedia = nativeGetUserMedia;
            } catch {}
          }
        }
      };

      const clearTrackingStateForCameraRestart = () => {
        activeTargets.clear();
        lostTimers.forEach(({ dim, hide }) => {
          window.clearTimeout(dim);
          window.clearTimeout(hide);
        });
        lostTimers.clear();
      };

      const startMindARCamera = async ({
        facingMode = cameraFacingMode,
        exact = false,
        status = 'loading',
        finalStatus = 'running',
        clearError = true,
      } = {}) => {
        const sys = getMindARSystem();
        const nextFacingMode = normalizeCameraFacingMode(facingMode);
        if (status) setRuntimeStatus(status);
        try {
          await probeCameraFacingMode(nextFacingMode, exact);
          await runWithCameraFacingMode(nextFacingMode, exact, () => sys.start());
          cameraFacingMode = nextFacingMode;
          startedRef.current = true;
          pushDiagnostics({
            cameraFacingMode,
            cameraSwitching: false,
            ...(clearError ? { cameraError: '', lastError: '' } : {}),
            lastEvent: `camera-started:${cameraFacingMode}`,
          });
          setRuntimeStatus(finalStatus);
          return { facingMode: cameraFacingMode, frozenState: cloneFrozenState() };
        } catch (error) {
          startedRef.current = false;
          throw error;
        }
      };

      const stopMindARCameraForSwitch = async () => {
        const sys = getMindARSystem();
        if (startedRef.current) {
          try {
            await Promise.resolve(sys.stop());
          } catch {}
        }
        startedRef.current = false;
        clearTrackingStateForCameraRestart();
      };

      const switchCameraFacing = (nextFacingMode) => {
        cameraSwitchQueue = cameraSwitchQueue.catch(() => null).then(async () => {
          const previousFacingMode = cameraFacingMode;
          const targetFacingMode = normalizeCameraFacingMode(
            nextFacingMode || (previousFacingMode === 'environment' ? 'user' : 'environment')
          );
          const finalStatus = frozenState.active ? 'persistent' : 'running';
          setRuntimeStatus('camera-switching');
          pushDiagnostics({
            cameraFacingMode: targetFacingMode,
            cameraSwitching: true,
            lastError: '',
            lastEvent: `camera-switching:${targetFacingMode}`,
          });

          try {
            await stopMindARCameraForSwitch();
            return await startMindARCamera({
              facingMode: targetFacingMode,
              exact: true,
              status: null,
              finalStatus,
            });
          } catch (error) {
            const message = String(error?.message || error);
            console.error('[MindAR] camera switch failed', error);
            pushDiagnostics({
              cameraFacingMode: previousFacingMode,
              cameraSwitching: false,
              lastError: message,
              cameraError: message,
              lastEvent: `camera-switch-failed:${targetFacingMode}`,
            });
            try {
              await startMindARCamera({
                facingMode: previousFacingMode,
                exact: false,
                status: null,
                finalStatus,
                clearError: false,
              });
            } catch (restoreError) {
              const restoreMessage = String(restoreError?.message || restoreError);
              console.error('[MindAR] camera restore failed', restoreError);
              pushDiagnostics({
                cameraFacingMode: previousFacingMode,
                cameraSwitching: false,
                lastError: restoreMessage,
                cameraError: restoreMessage,
                lastEvent: 'camera-restore-failed',
              });
              setRuntimeStatus('error');
            }
            throw error;
          }
        });
        return cameraSwitchQueue;
      };

      const getTargetConfig = (targetIndex) => {
        const idx = targetIndex ?? lastTarget?.targetIndex ?? activeTargets.keys().next().value ?? targets[0]?.targetIndex;
        const target = targets.find((item) => item.targetIndex === idx) || targets[0] || null;
        return target ? cloneTarget(target) : null;
      };

      const getCurrentTargetConfig = () => getTargetConfig();
      const getCurrentRenderMode = () => getTargetRenderMode(runtimeManifest, getCurrentTargetConfig()?.targetIndex ?? targets[0]?.targetIndex ?? 0);
      const getCurrentSpriteConfig = () => spriteConfigForTarget(runtimeManifest, getCurrentTargetConfig()?.targetIndex ?? targets[0]?.targetIndex ?? 0);
      const getCurrentGlbConfig = () => getTargetGlbConfig(runtimeManifest, getCurrentTargetConfig()?.targetIndex ?? targets[0]?.targetIndex ?? 0);
      const readInteractionConfig = () => ({
        ...DEFAULT_GLB_INTERACTION,
        ...(getCurrentGlbConfig()?.interaction || {}),
      });
      const getScaleMin = () => {
        const min = Number(readInteractionConfig().minScale);
        return Number.isFinite(min) && min > 0 ? min : FROZEN_SPRITE_SCALE_MIN;
      };
      const getScaleMax = () => {
        const max = Number(readInteractionConfig().maxScale);
        return Number.isFinite(max) && max > 0 ? Math.max(getScaleMin(), max) : FROZEN_SPRITE_SCALE_MAX;
      };
      const readAnimationDiagnostics = (glb = getCurrentGlbConfig()) => ({
        animationStartFrame: glb?.animation ? readAnimationStartFrame(glb.animation) : null,
        animationEndFrame: glb?.animation ? readAnimationEndFrame(glb.animation) : null,
        finalYaw: frozenState.rotation.y,
        finalPitch: frozenState.rotation.x,
      });

      const cloneFrozenState = () => ({
        active: frozenState.active,
        contentMode: frozenState.contentMode,
        sourceTarget: frozenState.sourceTarget ? cloneTarget(frozenState.sourceTarget) : null,
        position: { ...frozenState.position },
        rotation: { ...frozenState.rotation },
        scale: { ...frozenState.scale },
      });

      const rememberInitialGlbFrozenState = () => {
        initialGlbFrozenState = frozenState.active && frozenState.contentMode === 'gltf'
          ? cloneFrozenState()
          : null;
      };

      const applyFrozenState = () => {
        if (!frozenObject?.object3D) return false;
        const pitchRange = frozenState.contentMode === 'gltf'
          ? readInteractionConfig().pitchRange
          : [-75, 75];
        const clampedPitch = clampPitchDegrees(frozenState.rotation.x, pitchRange);
        if (clampedPitch !== frozenState.rotation.x) {
          frozenState.rotation = { ...frozenState.rotation, x: clampedPitch };
        }
        if (!applyFrozenObjectTransform()) return false;
        if (clampFrozenToDepthBounds()) applyFrozenObjectTransform();
        if (clampFrozenToEditBounds()) applyFrozenObjectTransform();
        if (clampFrozenToDepthBounds()) applyFrozenObjectTransform();
        pushDiagnostics({
          frozen: frozenState.active,
          contentMode: frozenState.contentMode,
          position: { ...frozenState.position },
          rotation: { ...frozenState.rotation },
          scale: { ...frozenState.scale },
          ...readAnimationDiagnostics(),
          ...readRenderDiagnostics('frozen-transform'),
        });
        return true;
      };

      const getPersistentSpriteReadiness = () => {
        const introAnim = getPersistentIntroAnim();
        const seq = getPersistentSeq();
        const mesh = frozenCharacter?.getObject3D('mesh');
        const textureReadiness = seq?.getTextureReadiness?.() || {
          frameCount: seq?.frames?.length || 0,
          loadedCount: 0,
          errorCount: 0,
          pendingCount: seq?.frames?.length || 0,
          ready: false,
        };
        return {
          ready: Boolean(introAnim && seq && mesh && textureReadiness.ready),
          componentsReady: Boolean(introAnim && seq && mesh),
          textureReadiness,
        };
      };

      const pushSpriteReadinessDiagnostics = (readiness, lastEvent) => {
        const textureReadiness = readiness?.textureReadiness || {};
        const textureWarning = readiness?.timedOut
          ? `Sprite texture preload timed out: ${textureReadiness.loadedCount || 0}/${textureReadiness.frameCount || 0} loaded`
          : textureReadiness.errorCount
            ? `Sprite texture load errors: ${textureReadiness.errorCount}`
            : '';
        pushDiagnostics({
          frameCount: textureReadiness.frameCount || 0,
          textureLoadedCount: textureReadiness.loadedCount || 0,
          textureErrorCount: textureReadiness.errorCount || 0,
          texturePendingCount: textureReadiness.pendingCount || 0,
          textureReady: Boolean(textureReadiness.ready),
          textureWarning,
          lastEvent,
        });
      };

      const waitForPersistentSpriteReady = (timeoutMs = 5000) => new Promise((resolve) => {
        const initial = getPersistentSpriteReadiness();
        if (initial.ready) {
          resolve({ ...initial, timedOut: false });
          return;
        }
        const startedAt = performance.now();
        const check = () => {
          const next = getPersistentSpriteReadiness();
          if (next.ready) {
            resolve({ ...next, timedOut: false });
            return;
          }
          if (performance.now() - startedAt >= timeoutMs) {
            resolve({ ...next, timedOut: true });
            return;
          }
          window.requestAnimationFrame(check);
        };
        window.requestAnimationFrame(check);
      });

      const waitForPersistentModelReady = (timeoutMs = 3000) => new Promise((resolve) => {
        const comp = getPersistentModelComp();
        if (comp?.isReady?.()) {
          pushDiagnostics({
            frozenModelLoaded: true,
            modelReady: true,
            modelSrc: persistentModelSrc,
            glbBounds: comp.getBounds?.() || null,
            glbScale: getCurrentGlbConfig()?.scale || null,
            lastEvent: 'glb-ready-existing',
          });
          resolve(true);
          return;
        }
        let settled = false;
        const finish = (ready) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeoutId);
          frozenModel?.removeEventListener('gltf-transition-ready', onReady);
          resolve(ready);
        };
        const onReady = (event) => {
          pushDiagnostics({
            frozenModelLoaded: true,
            modelReady: true,
            modelSrc: persistentModelSrc,
            glbBounds: event.detail?.bounds || getPersistentModelComp()?.getBounds?.() || null,
            glbScale: getCurrentGlbConfig()?.scale || null,
            lastEvent: 'gltf-transition-ready',
          });
          finish(true);
        };
        const timeoutId = window.setTimeout(() => finish(Boolean(getPersistentModelComp()?.isReady?.())), timeoutMs);
        frozenModel?.addEventListener('gltf-transition-ready', onReady, { once: true });
      });

      const setLiveContentVisible = (visibleLive) => {
        anchors.forEach((anchor) => {
          anchor.element.querySelectorAll('.anchored-content').forEach((node) => {
            node.setAttribute('visible', visibleLive ? 'true' : 'false');
          });
        });
        pushDiagnostics({ lastEvent: visibleLive ? 'live-content-visible' : 'live-content-hidden' });
      };

      const applyLiveYaw = () => {
        const THREE = getThree();
        if (!THREE) return;
        anchors.forEach((anchor) => {
          const content = getSpriteContent(anchor);
          if (!content?.object3D) return;
          content.object3D.rotation.y = THREE.MathUtils.degToRad(liveYawOffset);
        });
      };

      const cancelLostGrace = (targetIndex) => {
        const t = lostTimers.get(targetIndex);
        if (!t) return;
        window.clearTimeout(t.dim);
        window.clearTimeout(t.hide);
        lostTimers.delete(targetIndex);
      };

      const configurePersistentSprite = (targetIndex) => {
        const spriteConfig = withViewportDropMotion(spriteConfigForTarget(runtimeManifest, targetIndex));
        spriteRegistry.configs.set(PERSISTENT_SPRITE_CONFIG_KEY, spriteConfig);
        getPersistentSeq()?.reloadConfig?.(PERSISTENT_SPRITE_CONFIG_KEY);
        getPersistentIntroAnim()?.reloadConfig?.(PERSISTENT_SPRITE_CONFIG_KEY);
        return spriteConfig;
      };

      const hideFinalModel = () => {
        getPersistentModelComp()?.hide?.({ crossfadeMs: 0 });
        frozenModel?.setAttribute('visible', 'false');
        debugGlbMarker?.setAttribute('visible', 'false');
        resetGlbPivotTransform();
        resetGlbScaleSafetyLimit();
        clearInitialGlbFrozenState();
        activeFinalMode = activeFinalMode === 'gltf' ? null : activeFinalMode;
        pushDiagnostics({ glbPhase: 'hidden', lastEvent: 'glb-hidden' });
      };

      const applyPersistentGlbTransform = (glb, transformOverride = {}) => {
        if (!frozenModel) return;
        const transform = mergeTransformConfig(glb, transformOverride);
        frozenModel.setAttribute('position', vectorAttr(transform.position, [0, 0, 0]));
        frozenModel.setAttribute('rotation', vectorAttr(transform.rotation, [0, 0, 0]));
        frozenModel.setAttribute('scale', vectorAttr(transform.scale, [1, 1, 1]));
        if (debugGlbMarker) {
          debugGlbMarker.setAttribute('position', vectorAttr(transform.position, [0, 0, 0]));
          debugGlbMarker.setAttribute('rotation', vectorAttr(transform.rotation, [0, 0, 0]));
          configureDebugGlbMarker();
        }
        if (getPersistentModelComp()?.isReady?.()) refreshGlbInteractionPivot();
      };

      const getFinalModelDebug = () => {
        const comp = getPersistentModelComp();
        return {
          targetIndex: persistentModelTargetIndex,
          modelSrc: persistentModelSrc,
          modelAttr: persistentModelAttr,
          ready: Boolean(comp?.isReady?.()),
          visible: Boolean(frozenModel?.object3D?.visible),
          bounds: comp?.getBounds?.() || null,
          animations: comp?.getAnimationNames?.() || [],
          meshCenterNdc: readMeshCenterProjection(),
          ...readAnimationDiagnostics(),
        };
      };

      const configurePersistentGlb = (targetIndex, transformOverride = {}) => {
        const idx = targetIndex ?? lastTarget?.targetIndex ?? activeTargets.keys().next().value ?? targets[0]?.targetIndex ?? 0;
        const glb = getTargetGlbConfig(runtimeManifest, idx);
        if (!frozenModel || !glb) {
          pushDiagnostics({
            glbPhase: 'missing',
            modelReady: false,
            modelError: `No GLB configured for target ${idx}`,
            lastError: `No GLB configured for target ${idx}`,
            lastEvent: `glb-missing:${idx}`,
          });
          return null;
        }

        const modelAttr = buildGltfModelAttr(glb);
        if (!modelAttr) {
          pushDiagnostics({
            glbPhase: 'missing',
            modelReady: false,
            modelError: `No GLB source configured for target ${idx}`,
            lastError: `No GLB source configured for target ${idx}`,
            lastEvent: `glb-missing:${idx}`,
          });
          return null;
        }

        const modelSrc = glb.src || modelAttr;
        const attrChanged = persistentModelAttr !== modelAttr;
        persistentModelAttr = modelAttr;
        persistentModelSrc = modelSrc;
        persistentModelTargetIndex = idx;

        gltfRegistry.configs.set(PERSISTENT_GLB_CONFIG_KEY, glb);
        applyGlbLighting(glb);
        frozenModel.setAttribute('gltf-transition-model', 'configKey', PERSISTENT_GLB_CONFIG_KEY);
        const comp = getPersistentModelComp();
        if (attrChanged) comp?.resetLoadState?.();
        comp?.reloadConfig?.(PERSISTENT_GLB_CONFIG_KEY);
        applyPersistentGlbTransform(glb, transformOverride);

        if (attrChanged || !frozenModel.getAttribute('gltf-model')) {
          frozenModel.setAttribute('gltf-model', modelAttr);
        }

        const ready = Boolean(getPersistentModelComp()?.isReady?.());
        pushDiagnostics({
          glbPhase: ready ? 'preloaded' : 'preloading',
          modelSrc,
          modelReady: ready,
          modelError: '',
          lastError: '',
          glbScale: glb.scale || null,
          ...readAnimationDiagnostics(glb),
          lastEvent: `glb-preload:${idx}`,
        });
        return { idx, glb, modelAttr, modelSrc };
      };

      const revealModelAfterSprite = async (targetIndex, transformOverride = {}) => {
        const idx = targetIndex ?? lastTarget?.targetIndex ?? activeTargets.keys().next().value ?? targets[0]?.targetIndex ?? 0;
        const sourceTarget = getTargetConfig(idx);
        const renderMode = getTargetRenderMode(runtimeManifest, idx);
        const configured = configurePersistentGlb(idx, transformOverride);
        if (!configured) return cloneFrozenState();
        const { glb, modelSrc } = configured;

        clearInitialGlbFrozenState();
        frozenState.active = true;
        frozenState.contentMode = renderMode === 'gltf-only' ? null : (frozenState.contentMode || 'sprite');
        frozenState.sourceTarget = sourceTarget ? cloneTarget(sourceTarget) : null;
        frozenState.position = { ...FROZEN_SPRITE_POSITION };
        frozenState.rotation = { ...FROZEN_SPRITE_ROTATION };
        frozenState.scale = { ...FROZEN_SPRITE_SCALE };
        resetGlbScaleSafetyLimit();
        setLiveContentVisible(false);
        applyFrozenState();
        pushDiagnostics({
          glbPhase: getPersistentModelComp()?.isReady?.() ? 'preloaded' : 'loading',
          spritePhase: renderMode === 'gltf-only' ? 'hidden' : 'handoff',
          modelSrc,
          modelReady: Boolean(getPersistentModelComp()?.isReady?.()),
          lastEvent: `glb-loading:${idx}`,
        });

        const ready = await waitForPersistentModelReady(3000);
        const comp = getPersistentModelComp();
        if (!ready || !comp) {
          frozenState.contentMode = renderMode === 'gltf-only' ? null : 'sprite';
          activeFinalMode = renderMode === 'gltf-only' ? null : 'sprite';
          if (renderMode !== 'gltf-only') getPersistentIntroAnim()?.enterFinalIdle?.();
          applyFrozenState();
          const message = `persistent GLB not ready for target ${idx}`;
          pushDiagnostics({
            glbPhase: 'error',
            modelReady: false,
            modelError: message,
            lastError: message,
            lastEvent: `glb-timeout:${idx}`,
          });
          return cloneFrozenState();
        }

        const animation = glb.animation || {};
        const animationStartFrame = readAnimationStartFrame(animation);
        const animationEndFrame = readAnimationEndFrame(animation);
        const animationFrameOptions = {
          clips: animation.clips,
          fps: animation.fps,
        };
        comp.applyAnimationFrame?.(animationEndFrame ?? animationStartFrame, animationFrameOptions);
        frozenState.contentMode = 'gltf';
        activeFinalMode = 'gltf';
        refreshGlbInteractionPivot();
        applyFrozenState();
        frozenModel.setAttribute('visible', 'true');
        debugGlbMarker?.setAttribute('visible', 'true');
        configureDebugGlbMarker();
        centerFrozenModelAtNdc(GLB_INITIAL_CENTER_NDC, { lastEvent: `glb-centered-final-frame:${idx}` });
        comp.applyAnimationFrame?.(animationStartFrame, animationFrameOptions);
        pushRenderDiagnostics(`glb-before-show:${idx}`);
        await comp.show?.({ crossfadeMs: glb.transition?.crossfadeMs });
        pushRenderDiagnostics(`glb-after-show:${idx}`);
        pushDiagnostics({
          glbPhase: 'visible',
          frozenModelLoaded: true,
          modelReady: true,
          modelSrc,
          ...readAnimationDiagnostics(glb),
          lastEvent: `glb-visible:${idx}`,
        });
        await comp.playIntroThenIdle?.();
        refreshGlbInteractionPivot();
        applyFrozenState();
        centerFrozenModelAtNdc(GLB_INITIAL_CENTER_NDC, { lastEvent: `glb-centered-after-end:${idx}` });
        rememberInitialGlbFrozenState();
        const clipNames = comp.getAnimationNames?.() || [];
        pushDiagnostics({
          glbPhase: clipNames.length ? 'idle' : 'visible',
          meshCenterNdc: readMeshCenterProjection(),
          ...readAnimationDiagnostics(glb),
          lastEvent: clipNames.length ? `glb-idle:${idx}` : `glb-no-clips:${idx}`,
        });

        const hideDelay = Number(glb.transition?.spriteHideDelayMs ?? 80);
        window.setTimeout(() => {
          getPersistentIntroAnim()?.hide?.();
          getPersistentSeq()?.stop?.();
          pushDiagnostics({ spritePhase: 'hidden', lastEvent: `sprite-hidden-after-glb:${idx}` });
        }, Math.max(0, hideDelay));

        return cloneFrozenState();
      };

      const showFinalModel = async (targetIndex, transformOverride = {}) => revealModelAfterSprite(targetIndex, transformOverride);
      const playGlbIntro = async (targetIndex) => {
        const idx = targetIndex ?? lastTarget?.targetIndex ?? targets[0]?.targetIndex ?? 0;
        await revealModelAfterSprite(idx);
        return getPersistentModelComp()?.playIntroThenIdle?.();
      };
      const playGlbIdle = async (targetIndex) => {
        const idx = targetIndex ?? lastTarget?.targetIndex ?? targets[0]?.targetIndex ?? 0;
        if (!getPersistentModelComp()?.isReady?.()) await revealModelAfterSprite(idx);
        return getPersistentModelComp()?.playIdle?.();
      };

      const playSpriteIntro = async (targetIndex, options = {}) => {
        const idx = targetIndex ?? lastTarget?.targetIndex ?? activeTargets.keys().next().value ?? targets[0]?.targetIndex ?? 0;
        const onStart = typeof options?.onStart === 'function' ? options.onStart : null;
        const renderMode = getTargetRenderMode(runtimeManifest, idx);
        const sourceTarget = getTargetConfig(idx);
        if (renderMode === 'gltf-only') {
          pushDiagnostics({ spritePhase: 'hidden', lastEvent: `sprite-skipped:${idx}` });
          return revealModelAfterSprite(idx);
        }

        configurePersistentSprite(idx);
        hideFinalModel();
        if (renderMode === 'sprite-then-gltf') configurePersistentGlb(idx);
        frozenState.active = true;
        frozenState.contentMode = 'sprite';
        frozenState.sourceTarget = sourceTarget ? cloneTarget(sourceTarget) : null;
        frozenState.position = { ...FROZEN_SPRITE_POSITION };
        frozenState.rotation = { x: 0, y: liveYawOffset, z: 0 };
        frozenState.scale = { ...FROZEN_SPRITE_SCALE };
        activeFinalMode = 'sprite';
        setLiveContentVisible(false);
        applyFrozenState();

        const readiness = await waitForPersistentSpriteReady();
        pushSpriteReadinessDiagnostics(readiness, readiness.timedOut ? `sprite-textures-timeout:${idx}` : `sprite-textures-ready:${idx}`);
        const introAnim = getPersistentIntroAnim();
        const seq = getPersistentSeq();
        if (!readiness.componentsReady || !introAnim || !seq) {
          pushDiagnostics({ modelError: 'persistent sprite not ready', lastEvent: `sprite-intro-missing:${idx}` });
          return cloneFrozenState();
        }
        const sequenceDone = seq?.frames?.length && frozenCharacter
          ? new Promise((resolve) => {
            let settled = false;
            const finish = () => {
              if (settled) return;
              settled = true;
              frozenCharacter.removeEventListener('sprite-sequence-end', finish);
              frozenCharacter.removeEventListener('sprite-sequence-started', handleStarted);
              resolve();
            };
            const handleStarted = () => {
              const textureReadiness = seq.getTextureReadiness?.() || {};
              pushDiagnostics({
                spritePhase: 'playing',
                frameIndex: seq.frameIdx || 0,
                frameCount: seq.frames?.length || 0,
                textureLoadedCount: textureReadiness.loadedCount || 0,
                textureErrorCount: textureReadiness.errorCount || 0,
                texturePendingCount: textureReadiness.pendingCount || 0,
                textureReady: Boolean(textureReadiness.ready),
                lastEvent: `sprite-sequence-start:${idx}`,
              });
              try { onStart?.(); } catch (error) { console.error(error); }
            };
            const frameCount = seq.frames.length;
            pushDiagnostics({ frameCount, frameIndex: 0 });
            frozenCharacter.addEventListener('sprite-sequence-started', handleStarted, { once: true });
            frozenCharacter.addEventListener('sprite-sequence-end', finish, { once: true });
          })
          : Promise.resolve().then(() => { try { onStart?.(); } catch (error) { console.error(error); } });
        introAnim.reset?.();
        pushDiagnostics({ spritePhase: 'entering', lastEvent: `sprite-intro-play:${idx}` });
        const transformDone = introAnim.playIntro();
        await Promise.all([transformDone, sequenceDone]);

        if (renderMode === 'sprite-then-gltf') {
          introAnim.enterFinalIdle?.();
          pushDiagnostics({ spritePhase: 'handoff', lastEvent: `sprite-glb-handoff:${idx}` });
          return revealModelAfterSprite(idx);
        }

        introAnim.enterFinalIdle?.();
        setLiveContentVisible(false);
        applyFrozenState();
        pushDiagnostics({ spritePhase: 'final', frameIndex: seq?.frameIdx || 0, lastEvent: `sprite-intro-end:${idx}` });
        return cloneFrozenState();
      };

      const stopSpriteIntro = (targetIndex) => {
        const apply = (anchor) => {
          const introAnim = getIntroAnim(anchor);
          const seq = getSpriteSeq(anchor);
          if (introAnim) introAnim.stopIntro();
          if (seq) seq.stop();
        };
        if (targetIndex == null) anchors.forEach(apply);
        else apply(findAnchorByIndex(targetIndex));
        getPersistentIntroAnim()?.stopIntro?.();
        getPersistentSeq()?.stop?.();
      };

      const showFinalSprite = (targetIndex) => {
        const idx = targetIndex ?? lastTarget?.targetIndex ?? activeTargets.keys().next().value ?? targets[0]?.targetIndex ?? 0;
        const anchor = findAnchorByIndex(idx);
        const introAnim = getIntroAnim(anchor);
        if (introAnim) {
          introAnim.enterFinalIdle();
          pushDiagnostics({ spritePhase: 'final', lastEvent: `sprite-final:${idx}` });
        }
      };

      const hideSprite = (targetIndex) => {
        if (targetIndex == null) {
          anchors.forEach((anchor) => getIntroAnim(anchor)?.hide());
          getPersistentIntroAnim()?.hide?.();
        } else {
          getIntroAnim(findAnchorByIndex(targetIndex))?.hide();
        }
        pushDiagnostics({ spritePhase: 'hidden', lastEvent: 'sprite-hidden' });
      };

      const getSpriteState = () => {
        const persistentIntro = getPersistentIntroAnim();
        const persistentSeq = getPersistentSeq();
        const persistentTextureReadiness = persistentSeq?.getTextureReadiness?.() || null;
        if (frozenState.active || persistentIntro?.state === 'entering' || persistentIntro?.state === 'final') {
          return {
            phase: persistentIntro?.state || 'idle',
            activeTargetIndex: lastTarget?.targetIndex ?? frozenState.sourceTarget?.targetIndex ?? null,
            frameIndex: persistentSeq?.frameIdx || 0,
            frameCount: persistentSeq?.frames?.length || 0,
            textureLoadedCount: persistentTextureReadiness?.loadedCount || 0,
            textureErrorCount: persistentTextureReadiness?.errorCount || 0,
            texturePendingCount: persistentTextureReadiness?.pendingCount || 0,
            textureReady: Boolean(persistentTextureReadiness?.ready),
          };
        }
        const idx = lastTarget?.targetIndex ?? activeTargets.keys().next().value;
        if (idx == null) return { phase: 'hidden', activeTargetIndex: null, frameIndex: 0 };
        const anchor = findAnchorByIndex(idx);
        const introAnim = getIntroAnim(anchor);
        const seq = getSpriteSeq(anchor);
        const textureReadiness = seq?.getTextureReadiness?.() || null;
        return {
          phase: introAnim?.state || 'idle',
          activeTargetIndex: idx,
          frameIndex: seq?.frameIdx || 0,
          frameCount: seq?.frames?.length || 0,
          textureLoadedCount: textureReadiness?.loadedCount || 0,
          textureErrorCount: textureReadiness?.errorCount || 0,
          texturePendingCount: textureReadiness?.pendingCount || 0,
          textureReady: Boolean(textureReadiness?.ready),
        };
      };

      const freezeCurrentTarget = () => {
        if (!frozenObject || !frozenCharacter) return null;
        if (frozenState.active) return cloneFrozenState();
        const sourceTarget = lastTarget || activeTargets.values().next().value || targets[0];
        frozenState.active = true;
        frozenState.sourceTarget = sourceTarget ? cloneTarget(sourceTarget) : null;
        frozenState.contentMode = activeFinalMode || 'sprite';
        frozenState.position = { ...FROZEN_SPRITE_POSITION };
        frozenState.rotation = { x: 0, y: liveYawOffset, z: 0 };
        frozenState.scale = { ...FROZEN_SPRITE_SCALE };
        setLiveContentVisible(false);
        applyFrozenState();
        return cloneFrozenState();
      };

      const unfreezeCurrentTarget = () => {
        if (!frozenState.active) return cloneFrozenState();
        setLiveContentVisible(false);
        applyFrozenState();
        return cloneFrozenState();
      };

      const showFinalObject = (transform = {}) => {
        if (!frozenObject || !frozenCharacter) return null;
        frozenState.active = true;
        frozenState.contentMode = activeFinalMode || 'sprite';
        frozenState.sourceTarget = lastTarget ? cloneTarget(lastTarget) : null;
        frozenState.position = transform.position
          ? parseVector(transform.position, FROZEN_SPRITE_POSITION)
          : { ...FROZEN_SPRITE_POSITION };
        frozenState.rotation = transform.rotation
          ? parseVector(transform.rotation, { x: 0, y: 0, z: 0 })
          : { x: 0, y: 0, z: 0 };
        frozenState.scale = transform.scale
          ? parseVector(transform.scale, FROZEN_SPRITE_SCALE)
          : { ...FROZEN_SPRITE_SCALE };
        resetGlbScaleSafetyLimit();
        setLiveContentVisible(false);
        if (activeFinalMode === 'gltf') {
          frozenModel?.setAttribute('visible', 'true');
          debugGlbMarker?.setAttribute('visible', 'true');
          refreshGlbInteractionPivot();
        } else {
          getPersistentIntroAnim()?.enterFinalIdle?.();
        }
        applyFrozenState();
        return cloneFrozenState();
      };

      const hideFinalObject = () => {
        frozenState.active = false;
        frozenState.sourceTarget = null;
        frozenState.contentMode = null;
        activeFinalMode = null;
        getPersistentIntroAnim()?.reset?.();
        getPersistentSeq()?.stop?.();
        getPersistentModelComp()?.stopAllAnimations?.();
        getPersistentModelComp()?.hide?.({ crossfadeMs: 0 });
        frozenModel?.setAttribute('visible', 'false');
        debugGlbMarker?.setAttribute('visible', 'false');
        resetGlbPivotTransform();
        resetGlbScaleSafetyLimit();
        clearInitialGlbFrozenState();
        applyFrozenState();
        return cloneFrozenState();
      };

      const resetSceneForScan = () => {
        activeTargets.clear();
        lastTarget = null;
        liveYawOffset = 0;
        lostTimers.forEach(({ dim, hide }) => { window.clearTimeout(dim); window.clearTimeout(hide); });
        lostTimers.clear();
        anchors.forEach((anchor) => {
          getIntroAnim(anchor)?.reset?.();
          getSpriteSeq(anchor)?.stop?.();
        });
        hideFinalObject();
        setLiveContentVisible(true);
        applyLiveYaw();
        pushDiagnostics({
          activeTargetId: '',
          spritePhase: 'idle',
          glbPhase: 'idle',
          frameIndex: 0,
          lastEvent: 'scan-reset',
        });
        return cloneFrozenState();
      };

      const restartScan = () => {
        const snapshot = resetSceneForScan();
        try {
          getMindARSystem();
        } catch {
          setRuntimeStatus(scene.hasLoaded ? 'ready' : 'idle');
          return snapshot;
        }
        if (!startedRef.current) {
          setRuntimeStatus(scene.hasLoaded ? 'ready' : 'idle');
          return snapshot;
        }

        setRuntimeStatus('restarting');
        Promise.resolve()
          .then(() => stopMindARCameraForSwitch())
          .then(() => new Promise((resolve) => window.setTimeout(resolve, 80)))
          .then(() => startMindARCamera({ facingMode: cameraFacingMode, exact: false, status: null, finalStatus: 'running' }))
          .catch((error) => {
            console.error('[MindAR] restart failed', error);
            startedRef.current = false;
            pushDiagnostics({ modelError: String(error?.message || error), lastEvent: 'restart-failed' });
            setRuntimeStatus('error');
          });
        return snapshot;
      };

      const getCurrentScene = () => activeScene ? clone(activeScene) : null;
      const getMockSceneId = () => {
        const urlSceneId = readSearchParam('mockScene');
        if (urlSceneId) return urlSceneId;
        if (typeof window !== 'undefined' && window.__emoMockSceneId) return String(window.__emoMockSceneId);
        return '';
      };
      const setMockSceneId = (sceneId) => {
        const nextSceneId = sceneId == null ? '' : String(sceneId);
        if (typeof window !== 'undefined') window.__emoMockSceneId = nextSceneId;
        pushDiagnostics({ mockSceneId: nextSceneId, lastEvent: nextSceneId ? `mock-scene-set:${nextSceneId}` : 'mock-scene-cleared' });
        return nextSceneId;
      };
      const switchScene = (sceneId) => {
        const nextSwitch = sceneSwitchQueue.catch(() => null).then(async () => {
          const requestedId = sceneId == null ? manifest.defaultSceneId : String(sceneId);
          const exactScene = (manifest.scenes || []).find((item) => item.sceneId === requestedId) || null;
          if (sceneId != null && !exactScene) throw new Error(`Unknown MindAR scene: ${requestedId}`);
          const nextRuntimeManifest = getRuntimeSceneManifest(manifest, exactScene?.sceneId || requestedId);
          const nextScene = nextRuntimeManifest.currentScene || null;
          if (!nextScene) throw new Error(`Unknown MindAR scene: ${requestedId}`);
          if (nextScene.sceneId === currentSceneId && sceneRef.current) return clone(nextScene);

          setRuntimeStatus('scene-switching');
          cleanupScene?.();
          cleanupScene = null;
          await new Promise((resolve) => window.setTimeout(resolve, 0));
          if (cancelled) return null;
          await setup(nextScene.sceneId);
          return window.__mindar?.getCurrentScene?.() || clone(nextScene);
        });
        sceneSwitchQueue = nextSwitch.catch((error) => {
          const message = String(error?.message || error);
          console.error('[MindAR] scene switch failed', error);
          pushDiagnostics({ modelError: message, lastError: message, lastEvent: 'scene-switch-failed' });
          throw error;
        });
        return sceneSwitchQueue;
      };

      const recognizeFrameMock = async ({ sceneId, targetIndex, confidence } = {}) => {
        const requestedSceneId = sceneId || getMockSceneId();
        if (!requestedSceneId) {
          pushDiagnostics({ lastEvent: 'mock-recognition-idle' });
          return {
            matched: false,
            sceneId: null,
            targetIndex: null,
            confidence: null,
            source: 'mock',
          };
        }

        const matchedScene = (manifest.scenes || []).find((item) => item.sceneId === String(requestedSceneId)) || null;
        if (!matchedScene) {
          const message = `Unknown mock MindAR scene: ${requestedSceneId}`;
          pushDiagnostics({ mockSceneId: String(requestedSceneId), modelError: message, lastError: message, lastEvent: 'mock-recognition-unknown-scene' });
          return {
            matched: false,
            sceneId: String(requestedSceneId),
            targetIndex: null,
            confidence: 0,
            source: 'mock',
          };
        }

        const urlTargetIndex = readSearchParam('mockTarget');
        const rawTargetIndex = targetIndex ?? urlTargetIndex;
        const parsedTargetIndex = rawTargetIndex == null ? null : Number(rawTargetIndex);
        const nextTargetIndex = Number.isFinite(parsedTargetIndex) ? parsedTargetIndex : null;
        const nextConfidence = Number(confidence);
        pushDiagnostics({
          mockSceneId: matchedScene.sceneId,
          lastEvent: `mock-recognition-hit:${matchedScene.sceneId}`,
        });
        return {
          matched: true,
          sceneId: matchedScene.sceneId,
          targetIndex: nextTargetIndex,
          confidence: Number.isFinite(nextConfidence) ? nextConfidence : 1,
          source: 'mock',
        };
      };

      const applyRecognitionResult = async (result = {}) => {
        if (!result?.matched) {
          pushDiagnostics({ lastEvent: 'recognition-miss' });
          return { matched: false, scene: getCurrentScene() };
        }

        const requestedSceneId = result.sceneId || result.scene?.sceneId || currentSceneId || manifest.defaultSceneId;
        const sceneAfterSwitch = requestedSceneId && requestedSceneId !== currentSceneId
          ? await switchScene(requestedSceneId)
          : getCurrentScene();
        const targetIndex = Number(result.targetIndex);
        const target = Number.isFinite(targetIndex)
          ? window.__mindar?.getTargetConfig?.(targetIndex) || getTargetConfig(targetIndex)
          : null;
        pushDiagnostics({
          activeTargetId: target?.targetId || diagnosticsRef.current.activeTargetId,
          lastEvent: `recognition-applied:${sceneAfterSwitch?.sceneId || requestedSceneId}`,
        });
        return {
          matched: true,
          scene: sceneAfterSwitch,
          target: target ? cloneTarget(target) : null,
          confidence: result.confidence ?? null,
        };
      };

      const screenPointToDragPlaneIntersection = ({ clientX = 0, clientY = 0 } = {}, plane) => {
        const THREE = getThree();
        if (!THREE || !scene.camera || !plane) return null;
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 390;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 844;
        const ndc = new THREE.Vector2(
          (Number(clientX) / viewportWidth) * 2 - 1,
          -(Number(clientY) / viewportHeight) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(ndc, scene.camera);
        const point = new THREE.Vector3();
        return raycaster.ray.intersectPlane(plane, point) ? point : null;
      };

      const beginFrozenDrag = ({ pointerId = null, clientX = 0, clientY = 0 } = {}) => {
        if (!frozenState.active || !frozenObject?.object3D) return cloneFrozenState();
        const THREE = getThree();
        if (!THREE || !scene.camera) return cloneFrozenState();
        syncRenderMatrices();
        const objectWorld = frozenObject.object3D.getWorldPosition(new THREE.Vector3());
        const cameraForward = new THREE.Vector3();
        scene.camera.getWorldDirection(cameraForward);
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(cameraForward, objectWorld);
        const startPoint = screenPointToDragPlaneIntersection({ clientX, clientY }, plane);
        if (!startPoint) return cloneFrozenState();
        dragProxyState.active = true;
        dragProxyState.pointerId = pointerId;
        dragProxyState.plane = plane;
        dragProxyState.startPoint = startPoint.clone();
        dragProxyState.startPosition = { ...frozenState.position };
        resetGlbScaleSafetyLimit();
        if (dragProxy?.object3D) dragProxy.object3D.position.copy(objectWorld);
        pushDiagnostics({ lastEvent: 'drag-proxy-start' });
        return cloneFrozenState();
      };

      const dragFrozenToScreenPoint = ({ pointerId = null, clientX = 0, clientY = 0, clampToViewport = true } = {}) => {
        if (!frozenState.active || !dragProxyState.active || !dragProxyState.plane || !dragProxyState.startPoint || !dragProxyState.startPosition) {
          return cloneFrozenState();
        }
        if (dragProxyState.pointerId != null && pointerId != null && pointerId !== dragProxyState.pointerId) return cloneFrozenState();
        const THREE = getThree();
        const point = screenPointToDragPlaneIntersection({ clientX, clientY }, dragProxyState.plane);
        if (!THREE || !point) return cloneFrozenState();
        const delta = point.clone().sub(dragProxyState.startPoint);
        const ratio = getFinalDepthRatio();
        frozenState.position = {
          ...dragProxyState.startPosition,
          x: dragProxyState.startPosition.x + delta.x / ratio,
          y: dragProxyState.startPosition.y + delta.y / ratio,
        };
        resetGlbScaleSafetyLimit();
        if (dragProxy?.object3D) dragProxy.object3D.position.copy(point);
        if (clampToViewport) applyFrozenState();
        else applyFrozenObjectTransform();
        return cloneFrozenState();
      };

      const endFrozenDrag = ({ clampToViewport = true } = {}) => {
        if (!dragProxyState.active) return cloneFrozenState();
        dragProxyState.active = false;
        dragProxyState.pointerId = null;
        dragProxyState.plane = null;
        dragProxyState.startPoint = null;
        dragProxyState.startPosition = null;
        if (clampToViewport) applyFrozenState();
        pushDiagnostics({ lastEvent: 'drag-proxy-end' });
        return cloneFrozenState();
      };

      const resetFrozenTransform = () => {
        if (!initialGlbFrozenState || !frozenState.active || frozenState.contentMode !== 'gltf') {
          return cloneFrozenState();
        }
        dragProxyState.active = false;
        dragProxyState.pointerId = null;
        dragProxyState.plane = null;
        dragProxyState.startPoint = null;
        dragProxyState.startPosition = null;
        frozenState.active = initialGlbFrozenState.active;
        frozenState.contentMode = initialGlbFrozenState.contentMode;
        frozenState.sourceTarget = initialGlbFrozenState.sourceTarget ? cloneTarget(initialGlbFrozenState.sourceTarget) : null;
        frozenState.position = { ...initialGlbFrozenState.position };
        frozenState.rotation = { ...initialGlbFrozenState.rotation };
        frozenState.scale = { ...initialGlbFrozenState.scale };
        resetGlbScaleSafetyLimit();
        applyFrozenState();
        pushDiagnostics({ lastEvent: 'frozen-reset' });
        return cloneFrozenState();
      };

      const setFrozenTransform = (transform = {}) => {
        if (!frozenState.active) return cloneFrozenState();
        if (transform.position) frozenState.position = parseVector(transform.position, frozenState.position);
        if (transform.rotation) frozenState.rotation = parseVector(transform.rotation, frozenState.rotation);
        if (transform.scale) frozenState.scale = parseVector(transform.scale, frozenState.scale);
        applyFrozenState();
        return cloneFrozenState();
      };

      const moveFrozenByScreenDelta = ({ dx = 0, dy = 0, pixelsPerWorldUnit, clampToViewport = true } = {}) => {
        if (!frozenState.active) return cloneFrozenState();
        const viewportWidth = window.innerWidth || 390;
        const ratio = pixelsPerWorldUnit || Math.max(360, viewportWidth * 1.1);
        frozenState.position = {
          x: frozenState.position.x + dx / ratio,
          y: frozenState.position.y - dy / ratio,
          z: frozenState.position.z,
        };
        resetGlbScaleSafetyLimit();
        if (clampToViewport) applyFrozenState();
        else applyFrozenObjectTransform();
        return cloneFrozenState();
      };

      const rotateFrozenBy = ({ yawDelta = 0, pitchDelta = 0, pointerDeltaX = null, pointerDeltaY = null } = {}) => {
        if (!frozenState.active) return cloneFrozenState();
        resetGlbScaleSafetyLimit();
        const interaction = readInteractionConfig();
        const resolvedYawDelta = Number.isFinite(Number(pointerDeltaX))
          ? Number(pointerDeltaX) * (Number(interaction.yawSensitivity) || 0)
          : Number(yawDelta || 0);
        const resolvedPitchDelta = Number.isFinite(Number(pointerDeltaY))
          ? Number(pointerDeltaY) * (Number(interaction.pitchSensitivity) || 0)
          : Number(pitchDelta || 0);
        const nextYaw = normalizeDegrees(frozenState.rotation.y + resolvedYawDelta);
        const nextPitch = clampPitchDegrees(
          frozenState.rotation.x + resolvedPitchDelta,
          frozenState.contentMode === 'gltf' ? interaction.pitchRange : [-75, 75]
        );
        frozenState.rotation = { ...frozenState.rotation, x: nextPitch, y: nextYaw };
        applyFrozenState();
        return cloneFrozenState();
      };

      const scaleFrozenBy = ({ scaleFactor = 1 } = {}) => {
        if (!frozenState.active) return cloneFrozenState();
        const factor = Number.isFinite(Number(scaleFactor)) ? Number(scaleFactor) : 1;
        const minScale = frozenState.contentMode === 'gltf' ? getScaleMin() : FROZEN_SPRITE_SCALE_MIN;
        const configuredMaxScale = frozenState.contentMode === 'gltf' ? getScaleMax() : FROZEN_SPRITE_SCALE_MAX;
        if (factor < 0.999) resetGlbScaleSafetyLimit();
        const maxScale = frozenState.contentMode === 'gltf' && factor > 1.001 && Number.isFinite(glbScaleSafetyLimit)
          ? Math.min(configuredMaxScale, Math.max(minScale, glbScaleSafetyLimit))
          : configuredMaxScale;
        const next = Math.max(minScale, Math.min(maxScale, frozenState.scale.x * factor));
        frozenState.scale = { x: next, y: next, z: next };
        applyFrozenState();
        return cloneFrozenState();
      };

      const rotateLiveBy = ({ yawDelta = 0 } = {}) => {
        liveYawOffset = ((liveYawOffset + Number(yawDelta || 0)) % 360 + 360) % 360;
        applyLiveYaw();
        return { yaw: liveYawOffset, targetsActive: activeTargets.size };
      };

      const onFound = (target) => {
        cancelLostGrace(target.targetIndex);
        const payload = cloneTarget(target);
        activeTargets.set(target.targetIndex, payload);
        lastTarget = payload;
        const anchor = findAnchorByIndex(target.targetIndex);
        const introAnim = getIntroAnim(anchor);
        if (introAnim?.state === 'final') introAnim.restoreFromLoss();
        setRuntimeStatus('found');
        pushDiagnostics({ activeTargetId: target.targetId, lastEvent: `target-found:${target.targetId}` });
        foundCbs.forEach((cb) => {
          try { cb(payload); } catch (error) { console.error(error); }
        });
      };

      const onLost = (target) => {
        const payload = cloneTarget(target);
        activeTargets.delete(target.targetIndex);
        pushDiagnostics({ activeTargetId: activeTargets.size ? diagnosticsRef.current.activeTargetId : '', lastEvent: `target-lost:${target.targetId}` });
        setRuntimeStatus(frozenState.active ? 'persistent' : 'running');
        lostCbs.forEach((cb) => {
          try { cb(payload); } catch (error) { console.error(error); }
        });
      };

      anchors.forEach((anchor) => {
        anchor.onFound = () => onFound(anchor.target);
        anchor.onLost = () => onLost(anchor.target);
        anchor.element.addEventListener('targetFound', anchor.onFound);
        anchor.element.addEventListener('targetLost', anchor.onLost);
      });

      const onGltfMissing = (event) => {
        pushDiagnostics({ glbPhase: 'missing-animation', lastEvent: `glb-animation-missing:${event.detail?.name || ''}` });
      };
      const onGltfLoaded = () => {
        window.requestAnimationFrame(() => {
          const comp = getPersistentModelComp();
          if (comp?.isReady?.()) refreshGlbInteractionPivot();
          pushDiagnostics({
            frozenModelLoaded: true,
            modelReady: Boolean(comp?.isReady?.()),
            modelSrc: persistentModelSrc,
            glbPhase: comp?.isReady?.() ? 'loaded' : diagnosticsRef.current.glbPhase,
            glbBounds: comp?.getBounds?.() || diagnosticsRef.current.glbBounds || null,
            glbScale: getCurrentGlbConfig()?.scale || null,
            lastEvent: 'gltf-model-loaded',
          });
        });
      };
      const onGltfError = (event) => {
        const message = event.detail?.error?.message || event.detail?.message || 'GLB model failed to load';
        pushDiagnostics({
          glbPhase: 'error',
          modelReady: false,
          modelSrc: persistentModelSrc,
          modelError: message,
          lastError: message,
          lastEvent: 'gltf-model-error',
        });
      };
      const onGltfMarker = (event) => {
        pushDiagnostics({ lastEvent: `gltf-marker:${event.detail?.id || event.detail?.frame || ''}` });
      };
      frozenModel?.addEventListener('gltf-animation-missing', onGltfMissing);
      frozenModel?.addEventListener('gltf-animation-marker', onGltfMarker);
      frozenModel?.addEventListener('model-loaded', onGltfLoaded);
      frozenModel?.addEventListener('model-error', onGltfError);
      configurePersistentGlb(targets[0]?.targetIndex ?? 0);

      assets?.addEventListener('loaded', () => pushDiagnostics({ assetsLoaded: true, modelAssetLoaded: true, lastEvent: 'assets-loaded' }), { once: true });
      scene.addEventListener('loaded', () => {
        pushDiagnostics({ sceneLoaded: true, lastEvent: 'scene-loaded', liveModelLoaded: true });
        if (!startedRef.current && statusRef.current === 'manifest-loaded') setRuntimeStatus('ready');
      }, { once: true });

      window.__mindar = {
        scene,
        anchors: anchors.map(({ element }) => element),
        targets: targets.map(cloneTarget),
        getManifest: () => manifest,
        getSceneCatalog: () => getSceneCatalog(manifest),
        getCurrentScene,
        switchScene,
        recognizeFrameMock,
        applyRecognitionResult,
        getMockSceneId,
        setMockSceneId,
        getTargetConfig,
        getCurrentTargetConfig,
        getCurrentRenderMode,
        getCurrentSpriteConfig,
        getCurrentGlbConfig,
        getGlbAnimationNames: () => getPersistentModelComp()?.getAnimationNames?.() || [],
        getCameraFacingMode: () => cameraFacingMode,
        switchCameraFacing,
        getStatus: () => statusRef.current,
        getActiveTargets: () => Array.from(activeTargets.values()).map(cloneTarget),
        getLastTarget: () => lastTarget ? cloneTarget(lastTarget) : null,
        freezeCurrentTarget,
        unfreezeCurrentTarget,
        showFinalObject,
        hideFinalObject,
        showFinalModel,
        hideFinalModel,
        revealModelAfterSprite,
        getFinalModelDebug,
        playGlbIntro,
        playGlbIdle,
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
        setLiveContentVisible,
        rotateLiveBy,
        getLiveYaw: () => liveYawOffset,
        playSpriteIntro,
        stopSpriteIntro,
        showFinalSprite,
        hideSprite,
        getSpriteState,
        isReady: () => scene.hasLoaded === true,
        onStatus: (cb) => {
          statusCbs.add(cb);
          cb(statusRef.current);
          return () => statusCbs.delete(cb);
        },
        onTargetFound: (cb) => {
          foundCbs.add(cb);
          return () => foundCbs.delete(cb);
        },
        onTargetLost: (cb) => {
          lostCbs.add(cb);
          return () => lostCbs.delete(cb);
        },
        start: async () => {
          try {
            return await startMindARCamera({
              facingMode: cameraFacingMode,
              exact: false,
              status: 'loading',
              finalStatus: 'running',
            });
          } catch (error) {
            const message = String(error?.name || error?.message || error);
            setRuntimeStatus(/NotAllowed|Permission|denied|NotFound|Overconstrained/i.test(message) ? 'camera-denied' : 'error');
            throw error;
          }
        },
        stop: () => {
          const sys = scene.systems && scene.systems['mindar-image-system'];
          if (sys) sys.stop();
          startedRef.current = false;
          activeTargets.clear();
          lostTimers.forEach(({ dim, hide }) => { window.clearTimeout(dim); window.clearTimeout(hide); });
          lostTimers.clear();
          anchors.forEach((anchor) => getIntroAnim(anchor)?.reset());
          hideFinalObject();
          setRuntimeStatus(scene.hasLoaded ? 'ready' : 'idle');
        },
      };

      window.dispatchEvent(new CustomEvent('emo-mindar-runtime-ready', {
        detail: { scene: getCurrentScene() },
      }));

      cleanupScene = () => {
        try {
          const sys = scene.systems && scene.systems['mindar-image-system'];
          if (sys && startedRef.current) sys.stop();
        } catch {}
        anchors.forEach((anchor) => {
          anchor.element.removeEventListener('targetFound', anchor.onFound);
          anchor.element.removeEventListener('targetLost', anchor.onLost);
        });
        frozenModel?.removeEventListener('gltf-animation-missing', onGltfMissing);
        frozenModel?.removeEventListener('gltf-animation-marker', onGltfMarker);
        frozenModel?.removeEventListener('model-loaded', onGltfLoaded);
        frozenModel?.removeEventListener('model-error', onGltfError);
        lostTimers.forEach(({ dim, hide }) => { window.clearTimeout(dim); window.clearTimeout(hide); });
        lostTimers.clear();
        if (window.__mindar && window.__mindar.scene === scene) delete window.__mindar;
        container.innerHTML = '';
        sceneRef.current = null;
        startedRef.current = false;
      };

      if (activeRef.current) startIfNeeded();
    };

    setup();

    return () => {
      cancelled = true;
      cleanupScene?.();
      setStatus('idle');
    };
  }, [active, pushDiagnostics, startIfNeeded]);

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
