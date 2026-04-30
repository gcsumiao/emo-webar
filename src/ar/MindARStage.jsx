import React from 'react';
import { aframeAssets, isDebugMode, debugGlbAssetId } from './aframeAssets.js';
import {
  getTargetGlbConfig,
  getTargetRenderMode,
  loadArManifest,
} from './arManifest.js';
import { arTargets } from './arTargets.js';
import { spriteConfigForTarget, FROZEN_SPRITE_DEFAULTS } from './arSpriteConfig.js';
import './components/index.js';

const PERSISTENT_SPRITE_CONFIG_KEY = 'persistent-sprite';
const PERSISTENT_GLB_CONFIG_KEY = 'persistent-glb';
const FROZEN_SPRITE_POSITION = { x: 0, y: -0.02, z: -1.18 };
const FROZEN_SPRITE_SCALE = { x: 1, y: 1, z: 1 };
const FROZEN_SPRITE_SCALE_MIN = 0.25;
const FROZEN_SPRITE_SCALE_MAX = 2.4;

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

function buildGlbMarkup(target, glb, renderMode) {
  if (!(renderMode === 'gltf-only' || renderMode === 'sprite-then-gltf') || !glb) return '';
  const modelAttr = buildGltfModelAttr(glb);
  if (!modelAttr) return '';
  const visible = glb.visibleOnTarget ? 'true' : 'false';
  return `
    <a-entity id="live-glb-${escapeAttr(target.targetIndex)}"
      class="anchored-content glb-content"
      visible="${visible}"
      position="${escapeAttr(vectorAttr(glb.position, [0, 0, 0]))}"
      rotation="${escapeAttr(vectorAttr(glb.rotation, [0, 0, 0]))}"
      scale="${escapeAttr(vectorAttr(glb.scale, [1, 1, 1]))}"
      gltf-model="${escapeAttr(modelAttr)}"
      gltf-transition-model="configKey: ${escapeAttr(gltfConfigKey(target.targetIndex))}"></a-entity>
  `;
}

function buildSpriteGroupMarkup(target, spriteConfig, glbConfig, renderMode) {
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
    ${buildGlbMarkup(target, glbConfig, renderMode)}
  `;
}

function buildFrozenSpriteMarkup() {
  const idleSrc = escapeAttr(FROZEN_SPRITE_DEFAULTS.finalIdleFrameUrl);
  const charW = FROZEN_SPRITE_DEFAULTS.characterPlaneSize[0];
  const charH = FROZEN_SPRITE_DEFAULTS.characterPlaneSize[1];
  const shadowW = FROZEN_SPRITE_DEFAULTS.shadowSize[0];
  const shadowH = FROZEN_SPRITE_DEFAULTS.shadowSize[1];
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
          material="shader: flat; transparent: true; opacity: 0; alphaTest: 0.02; side: double; depthWrite: false; color: #ffffff; src: ${idleSrc}"
          sprite-sequence="configKey: ${PERSISTENT_SPRITE_CONFIG_KEY}; autoplay: false"></a-plane>
      </a-entity>
      <a-entity id="frozen-ar-model"
        class="glb-content"
        visible="false"
        gltf-transition-model="configKey: ${PERSISTENT_GLB_CONFIG_KEY}"></a-entity>
    </a-entity>
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
    frameIndex: 0,
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

    const setStatus = (nextStatus) => {
      statusRef.current = nextStatus;
      pushDiagnostics({ status: nextStatus, lastEvent: `status:${nextStatus}` });
    };

    const setup = async () => {
      const container = containerRef.current;
      if (!container || sceneRef.current) return;

      pushDiagnostics({ status: 'manifest-loading', lastEvent: 'manifest-loading' });
      const manifest = await loadArManifest();
      if (cancelled || !containerRef.current) return;

      pushDiagnostics({
        status: 'manifest-loaded',
        lastEvent: 'manifest-loaded',
        manifestWarning: manifest.__fallback ? manifest.__warning || 'Using default AR manifest fallback.' : '',
      });

      const spriteRegistry = ensureSpriteRegistry();
      const gltfRegistry = ensureGltfRegistry();
      const targets = manifest.targets?.length ? manifest.targets : arTargets;
      targets.forEach((target) => {
        const spriteConfig = spriteConfigForTarget(manifest, target.targetIndex);
        const glbConfig = getTargetGlbConfig(manifest, target.targetIndex);
        spriteRegistry.configs.set(spriteConfigKey(target.targetIndex), spriteConfig);
        gltfRegistry.configs.set(gltfConfigKey(target.targetIndex), glbConfig);
      });
      spriteRegistry.configs.set(PERSISTENT_SPRITE_CONFIG_KEY, spriteConfigForTarget(manifest, targets[0]?.targetIndex ?? 0));
      gltfRegistry.configs.set(PERSISTENT_GLB_CONFIG_KEY, getTargetGlbConfig(manifest, targets[0]?.targetIndex ?? 0));

      const anchorMarkup = targets.map((target) => {
        const spriteConfig = spriteConfigForTarget(manifest, target.targetIndex);
        const glbConfig = getTargetGlbConfig(manifest, target.targetIndex);
        const renderMode = getTargetRenderMode(manifest, target.targetIndex);
        return `<a-entity mindar-image-target="targetIndex: ${target.targetIndex}" id="emo-anchor-${target.targetIndex}">
          ${buildSpriteGroupMarkup(target, spriteConfig, glbConfig, renderMode)}
        </a-entity>`;
      }).join('');

      container.innerHTML = `
        <a-scene embedded
          mindar-image="imageTargetSrc: ${escapeAttr(manifest.mindTargetUrl)}; autoStart: false; uiLoading: no; uiScanning: no; uiError: no;"
          vr-mode-ui="enabled: false"
          device-orientation-permission-ui="enabled: false"
          renderer="colorManagement: true; physicallyCorrectLights: true; alpha: true; preserveDrawingBuffer: true"
          style="position:absolute; inset:0; width:100%; height:100%; pointer-events:none;">
          <a-assets timeout="15000">${buildAFrameAssetsMarkup(manifest)}</a-assets>
          <a-entity light="type: ambient; color: #ffffff; intensity: 1.15"></a-entity>
          <a-entity light="type: directional; color: #ffffff; intensity: 0.75" position="1 2 1"></a-entity>
          <a-camera id="emo-camera" position="0 0 0" look-controls="enabled: false">
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

      sceneRef.current = scene;

      const foundCbs = new Set();
      const lostCbs = new Set();
      const statusCbs = new Set();
      const activeTargets = new Map();
      const lostTimers = new Map();
      let lastTarget = null;
      let activeFinalMode = null;
      let liveYawOffset = 0;
      const frozenState = {
        active: false,
        sourceTarget: null,
        contentMode: null,
        position: { ...FROZEN_SPRITE_POSITION },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { ...FROZEN_SPRITE_SCALE },
      };

      const setRuntimeStatus = (nextStatus) => {
        statusRef.current = nextStatus;
        pushDiagnostics({ status: nextStatus, lastEvent: `status:${nextStatus}` });
        statusCbs.forEach((cb) => {
          try { cb(nextStatus); } catch (error) { console.error(error); }
        });
      };

      const getTargetConfig = (targetIndex) => {
        const idx = targetIndex ?? lastTarget?.targetIndex ?? activeTargets.keys().next().value ?? targets[0]?.targetIndex;
        const target = targets.find((item) => item.targetIndex === idx) || targets[0] || null;
        return target ? cloneTarget(target) : null;
      };

      const getCurrentTargetConfig = () => getTargetConfig();
      const getCurrentRenderMode = () => getTargetRenderMode(manifest, getCurrentTargetConfig()?.targetIndex ?? targets[0]?.targetIndex ?? 0);
      const getCurrentSpriteConfig = () => spriteConfigForTarget(manifest, getCurrentTargetConfig()?.targetIndex ?? targets[0]?.targetIndex ?? 0);
      const getCurrentGlbConfig = () => getTargetGlbConfig(manifest, getCurrentTargetConfig()?.targetIndex ?? targets[0]?.targetIndex ?? 0);

      const cloneFrozenState = () => ({
        active: frozenState.active,
        contentMode: frozenState.contentMode,
        sourceTarget: frozenState.sourceTarget ? cloneTarget(frozenState.sourceTarget) : null,
        position: { ...frozenState.position },
        rotation: { ...frozenState.rotation },
        scale: { ...frozenState.scale },
      });

      const applyFrozenState = () => {
        if (!frozenObject?.object3D) return false;
        const THREE = getThree();
        if (!THREE) return false;
        frozenObject.object3D.position.set(frozenState.position.x, frozenState.position.y, frozenState.position.z);
        frozenObject.object3D.rotation.set(
          THREE.MathUtils.degToRad(frozenState.rotation.x),
          THREE.MathUtils.degToRad(frozenState.rotation.y),
          THREE.MathUtils.degToRad(frozenState.rotation.z)
        );
        frozenObject.object3D.scale.set(frozenState.scale.x, frozenState.scale.y, frozenState.scale.z);
        frozenObject.setAttribute('visible', frozenState.active ? 'true' : 'false');
        pushDiagnostics({
          frozen: frozenState.active,
          position: { ...frozenState.position },
          rotation: { ...frozenState.rotation },
          scale: { ...frozenState.scale },
          lastEvent: 'frozen-transform',
        });
        return true;
      };

      const waitForPersistentSpriteReady = () => new Promise((resolve) => {
        const ready = () => getPersistentIntroAnim() && getPersistentSeq() && frozenCharacter?.getObject3D('mesh');
        if (ready()) {
          resolve(true);
          return;
        }
        let attempts = 0;
        const check = () => {
          attempts += 1;
          if (ready()) {
            resolve(true);
            return;
          }
          if (attempts >= 90) {
            resolve(false);
            return;
          }
          window.requestAnimationFrame(check);
        };
        window.requestAnimationFrame(check);
      });

      const waitForPersistentModelReady = (timeoutMs = 3000) => new Promise((resolve) => {
        const comp = getPersistentModelComp();
        if (comp?.isReady?.()) {
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
        const onReady = () => finish(true);
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
        const spriteConfig = spriteConfigForTarget(manifest, targetIndex);
        spriteRegistry.configs.set(PERSISTENT_SPRITE_CONFIG_KEY, spriteConfig);
        getPersistentSeq()?.reloadConfig?.(PERSISTENT_SPRITE_CONFIG_KEY);
        getPersistentIntroAnim()?.reloadConfig?.(PERSISTENT_SPRITE_CONFIG_KEY);
        return spriteConfig;
      };

      const hideFinalModel = () => {
        getPersistentModelComp()?.hide?.({ crossfadeMs: 0 });
        frozenModel?.setAttribute('visible', 'false');
        activeFinalMode = activeFinalMode === 'gltf' ? null : activeFinalMode;
        pushDiagnostics({ glbPhase: 'hidden', lastEvent: 'glb-hidden' });
      };

      const applyPersistentGlbTransform = (glb, transformOverride = {}) => {
        if (!frozenModel) return;
        const transform = mergeTransformConfig(glb, transformOverride);
        frozenModel.setAttribute('position', vectorAttr(transform.position, [0, 0, 0]));
        frozenModel.setAttribute('rotation', vectorAttr(transform.rotation, [0, 0, 0]));
        frozenModel.setAttribute('scale', vectorAttr(transform.scale, [1, 1, 1]));
      };

      const revealModelAfterSprite = async (targetIndex, transformOverride = {}) => {
        const idx = targetIndex ?? lastTarget?.targetIndex ?? activeTargets.keys().next().value ?? targets[0]?.targetIndex ?? 0;
        const sourceTarget = getTargetConfig(idx);
        const glb = getTargetGlbConfig(manifest, idx);
        if (!frozenModel || !glb) return cloneFrozenState();
        const modelAttr = buildGltfModelAttr(glb);
        if (!modelAttr) {
          pushDiagnostics({ glbPhase: 'missing', modelError: `No GLB configured for target ${idx}`, lastEvent: `glb-missing:${idx}` });
          return cloneFrozenState();
        }

        gltfRegistry.configs.set(PERSISTENT_GLB_CONFIG_KEY, glb);
        frozenModel.setAttribute('gltf-transition-model', 'configKey', PERSISTENT_GLB_CONFIG_KEY);
        getPersistentModelComp()?.reloadConfig?.(PERSISTENT_GLB_CONFIG_KEY);
        frozenModel.setAttribute('gltf-model', modelAttr);
        applyPersistentGlbTransform(glb, transformOverride);

        frozenState.active = true;
        frozenState.contentMode = 'gltf';
        frozenState.sourceTarget = sourceTarget ? cloneTarget(sourceTarget) : null;
        frozenState.position = { ...FROZEN_SPRITE_POSITION };
        frozenState.rotation = { x: 0, y: liveYawOffset, z: 0 };
        frozenState.scale = { ...FROZEN_SPRITE_SCALE };
        activeFinalMode = 'gltf';
        setLiveContentVisible(false);
        applyFrozenState();
        pushDiagnostics({ glbPhase: 'loading', spritePhase: 'handoff', lastEvent: `glb-loading:${idx}` });

        const ready = await waitForPersistentModelReady(3000);
        const comp = getPersistentModelComp();
        if (!ready || !comp) {
          frozenState.contentMode = 'sprite';
          activeFinalMode = 'sprite';
          getPersistentIntroAnim()?.enterFinalIdle?.();
          applyFrozenState();
          pushDiagnostics({ glbPhase: 'error', modelError: `persistent GLB not ready for target ${idx}`, lastEvent: `glb-timeout:${idx}` });
          return cloneFrozenState();
        }

        frozenModel.setAttribute('visible', 'true');
        await comp.show?.({ crossfadeMs: glb.transition?.crossfadeMs });
        pushDiagnostics({ glbPhase: 'visible', frozenModelLoaded: true, lastEvent: `glb-visible:${idx}` });
        await comp.playIntroThenIdle?.();
        const clipNames = comp.getAnimationNames?.() || [];
        pushDiagnostics({
          glbPhase: clipNames.length ? 'idle' : 'visible',
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

      const playSpriteIntro = async (targetIndex) => {
        const idx = targetIndex ?? lastTarget?.targetIndex ?? activeTargets.keys().next().value ?? targets[0]?.targetIndex ?? 0;
        const renderMode = getTargetRenderMode(manifest, idx);
        const sourceTarget = getTargetConfig(idx);
        if (renderMode === 'gltf-only') {
          pushDiagnostics({ spritePhase: 'hidden', lastEvent: `sprite-skipped:${idx}` });
          return revealModelAfterSprite(idx);
        }

        configurePersistentSprite(idx);
        frozenState.active = true;
        frozenState.contentMode = 'sprite';
        frozenState.sourceTarget = sourceTarget ? cloneTarget(sourceTarget) : null;
        frozenState.position = { ...FROZEN_SPRITE_POSITION };
        frozenState.rotation = { x: 0, y: liveYawOffset, z: 0 };
        frozenState.scale = { ...FROZEN_SPRITE_SCALE };
        activeFinalMode = 'sprite';
        hideFinalModel();
        setLiveContentVisible(false);
        applyFrozenState();

        const ready = await waitForPersistentSpriteReady();
        const introAnim = getPersistentIntroAnim();
        const seq = getPersistentSeq();
        if (!ready || !introAnim || !seq) {
          pushDiagnostics({ modelError: 'persistent sprite not ready', lastEvent: `sprite-intro-missing:${idx}` });
          return cloneFrozenState();
        }
        const sequenceDone = seq?.frames?.length && frozenCharacter
          ? new Promise((resolve) => {
            let settled = false;
            const finish = () => {
              if (settled) return;
              settled = true;
              window.clearTimeout(timeoutId);
              frozenCharacter.removeEventListener('sprite-sequence-end', finish);
              resolve();
            };
            const frameCount = seq.frames.length;
            const fps = seq.fps || 30;
            const timeoutId = window.setTimeout(finish, Math.ceil((frameCount / fps) * 1000) + 750);
            frozenCharacter.addEventListener('sprite-sequence-end', finish, { once: true });
          })
          : Promise.resolve();
        introAnim.reset?.();
        pushDiagnostics({ spritePhase: 'entering', lastEvent: `sprite-intro-play:${idx}` });
        const transformDone = introAnim.playIntro();
        await Promise.all([transformDone, sequenceDone]);

        if (renderMode === 'sprite-then-gltf') {
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
        if (frozenState.active || persistentIntro?.state === 'entering' || persistentIntro?.state === 'final') {
          return {
            phase: persistentIntro?.state || 'idle',
            activeTargetIndex: lastTarget?.targetIndex ?? frozenState.sourceTarget?.targetIndex ?? null,
            frameIndex: persistentSeq?.frameIdx || 0,
          };
        }
        const idx = lastTarget?.targetIndex ?? activeTargets.keys().next().value;
        if (idx == null) return { phase: 'hidden', activeTargetIndex: null, frameIndex: 0 };
        const anchor = findAnchorByIndex(idx);
        const introAnim = getIntroAnim(anchor);
        const seq = getSpriteSeq(anchor);
        return {
          phase: introAnim?.state || 'idle',
          activeTargetIndex: idx,
          frameIndex: seq?.frameIdx || 0,
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
        setLiveContentVisible(false);
        if (activeFinalMode === 'gltf') {
          frozenModel?.setAttribute('visible', 'true');
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
        const sys = scene.systems && scene.systems['mindar-image-system'];
        if (!sys || !startedRef.current) {
          setRuntimeStatus(scene.hasLoaded ? 'ready' : 'idle');
          return snapshot;
        }

        setRuntimeStatus('restarting');
        Promise.resolve()
          .then(() => {
            try { sys.stop(); } catch {}
            startedRef.current = false;
          })
          .then(() => new Promise((resolve) => window.setTimeout(resolve, 80)))
          .then(() => sys.start())
          .then(() => {
            startedRef.current = true;
            setRuntimeStatus('running');
          })
          .catch((error) => {
            console.error('[MindAR] restart failed', error);
            startedRef.current = false;
            pushDiagnostics({ modelError: String(error?.message || error), lastEvent: 'restart-failed' });
            setRuntimeStatus('error');
          });
        return snapshot;
      };

      const setFrozenTransform = (transform = {}) => {
        if (!frozenState.active) return cloneFrozenState();
        if (transform.position) frozenState.position = parseVector(transform.position, frozenState.position);
        if (transform.rotation) frozenState.rotation = parseVector(transform.rotation, frozenState.rotation);
        if (transform.scale) frozenState.scale = parseVector(transform.scale, frozenState.scale);
        applyFrozenState();
        return cloneFrozenState();
      };

      const moveFrozenByScreenDelta = ({ dx = 0, dy = 0, pixelsPerWorldUnit } = {}) => {
        if (!frozenState.active) return cloneFrozenState();
        const viewportWidth = window.innerWidth || 390;
        const ratio = pixelsPerWorldUnit || Math.max(360, viewportWidth * 1.1);
        frozenState.position = {
          x: frozenState.position.x + dx / ratio,
          y: frozenState.position.y - dy / ratio,
          z: frozenState.position.z,
        };
        applyFrozenState();
        return cloneFrozenState();
      };

      const rotateFrozenBy = ({ yawDelta = 0 } = {}) => {
        if (!frozenState.active) return cloneFrozenState();
        const nextYaw = ((frozenState.rotation.y + Number(yawDelta || 0)) % 360 + 360) % 360;
        frozenState.rotation = { ...frozenState.rotation, y: nextYaw };
        applyFrozenState();
        return cloneFrozenState();
      };

      const scaleFrozenBy = ({ scaleFactor = 1 } = {}) => {
        if (!frozenState.active) return cloneFrozenState();
        const factor = Number.isFinite(Number(scaleFactor)) ? Number(scaleFactor) : 1;
        const next = Math.max(FROZEN_SPRITE_SCALE_MIN, Math.min(FROZEN_SPRITE_SCALE_MAX, frozenState.scale.x * factor));
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
      frozenModel?.addEventListener('gltf-animation-missing', onGltfMissing);

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
        getTargetConfig,
        getCurrentTargetConfig,
        getCurrentRenderMode,
        getCurrentSpriteConfig,
        getCurrentGlbConfig,
        getGlbAnimationNames: () => getPersistentModelComp()?.getAnimationNames?.() || [],
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
        playGlbIntro,
        playGlbIdle,
        restartScan,
        setFrozenTransform,
        getFrozenState: cloneFrozenState,
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
          const sys = scene.systems && scene.systems['mindar-image-system'];
          if (!sys) throw new Error('mindar-image-system not ready');
          setRuntimeStatus('loading');
          if (navigator.mediaDevices?.getUserMedia) {
            let probeStream = null;
            try {
              probeStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' } },
                audio: false,
              });
            } catch (error) {
              setRuntimeStatus('camera-denied');
              throw error;
            } finally {
              probeStream?.getTracks?.().forEach((track) => track.stop());
            }
          }
          await sys.start();
          startedRef.current = true;
          setRuntimeStatus('running');
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
