import React from 'react';
import { aframeAssets } from './aframeAssets.js';
import { arTargets, defaultAnchoredAr } from './arTargets.js';

const MIND_TARGET_URL = '/assets/mindar/targets.mind';
const FROZEN_GLB_POSITION = { x: 0, y: -0.04, z: -1.18 };
const FROZEN_GLB_SCALE = { x: 0.48, y: 0.48, z: 0.48 };

function vectorToAttr(value, fallback = [0, 0, 0]) {
  const source = Array.isArray(value) ? value : fallback;
  return source.map((part, index) => Number.isFinite(Number(part)) ? Number(part) : fallback[index]).join(' ');
}

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function cloneTarget(target) {
  return JSON.parse(JSON.stringify(target));
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

function buildAFrameAssetsMarkup() {
  return aframeAssets.map((asset) => {
    const id = escapeAttr(asset.id);
    const src = escapeAttr(asset.src);
    if (asset.type === 'model') return `<a-asset-item id="${id}" src="${src}"></a-asset-item>`;
    if (asset.type === 'video') {
      return `<video id="${id}" src="${src}" preload="auto" loop muted playsinline webkit-playsinline crossorigin="anonymous"></video>`;
    }
    return `<img id="${id}" src="${src}" crossorigin="anonymous">`;
  }).join('');
}

function buildAnchoredContentMarkup(target) {
  const targetId = escapeAttr(target.targetId);
  const label = escapeAttr(target.label);
  const position = escapeAttr(vectorToAttr(target.position, defaultAnchoredAr.position));
  const rotation = escapeAttr(vectorToAttr(target.rotation, defaultAnchoredAr.rotation));
  const scale = escapeAttr(vectorToAttr(target.scale, defaultAnchoredAr.scale));
  const floatTo = escapeAttr(vectorToAttr(target.floatTo, defaultAnchoredAr.floatTo));
  const assetId = escapeAttr(target.assetId || defaultAnchoredAr.assetId);

  return `
    <a-entity class="anchored-content" data-target-id="${targetId}" data-label="${label}">
      <a-gltf-model
        class="live-ar-model"
        src="#${assetId}"
        position="${position}"
        rotation="${rotation}"
        scale="${scale}"
        animation__float="property: position; dir: alternate; dur: 1800; easing: easeInOutSine; loop: true; to: ${floatTo}">
      </a-gltf-model>
    </a-entity>
  `;
}

function buildFrozenContentMarkup() {
  const assetId = escapeAttr(defaultAnchoredAr.assetId);
  return `
    <a-entity id="frozen-ar-object" visible="false" position="${FROZEN_GLB_POSITION.x} ${FROZEN_GLB_POSITION.y} ${FROZEN_GLB_POSITION.z}" rotation="0 0 0">
      <a-gltf-model
        id="frozen-ar-model"
        src="#${assetId}"
        position="0 0 0"
        rotation="0 0 0"
        scale="${FROZEN_GLB_SCALE.x} ${FROZEN_GLB_SCALE.y} ${FROZEN_GLB_SCALE.z}">
      </a-gltf-model>
      <a-box
        id="frozen-debug-cube"
        visible="false"
        position="0 0 0"
        scale="0.16 0.16 0.16"
        material="color: #F29CB0; opacity: 0.65; transparent: true">
      </a-box>
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
    status: 'idle',
    lastEvent: '',
    activeTargetId: '',
    frozen: false,
    position: null,
    rotation: null,
    scale: null,
  };
}

function getThree() {
  return window.THREE || window.AFRAME?.THREE;
}

export function MindARStage({ active, visible, onDiagnostics }) {
  const containerRef = React.useRef(null);
  const sceneRef = React.useRef(null);
  const startedRef = React.useRef(false);
  const statusRef = React.useRef('idle');
  const diagnosticsRef = React.useRef(createDiagnostics());

  React.useEffect(() => {
    const pushDiagnostics = (patch = {}) => {
      diagnosticsRef.current = { ...diagnosticsRef.current, ...patch };
      onDiagnostics?.(diagnosticsRef.current);
      if (patch.lastEvent || patch.modelError) console.info('[EMO-AR]', diagnosticsRef.current);
    };

    const container = containerRef.current;
    if (!container || sceneRef.current) return undefined;

    const anchorMarkup = arTargets.map((target) => (
      `<a-entity mindar-image-target="targetIndex: ${target.targetIndex}" id="emo-anchor-${target.targetIndex}">
        ${buildAnchoredContentMarkup(target)}
      </a-entity>`
    )).join('');

    container.innerHTML = `
      <a-scene embedded
        mindar-image="imageTargetSrc: ${MIND_TARGET_URL}; autoStart: false; uiLoading: no; uiScanning: no; uiError: no;"
        vr-mode-ui="enabled: false"
        device-orientation-permission-ui="enabled: false"
        renderer="colorManagement: true; physicallyCorrectLights: true"
        style="position:absolute; inset:0; width:100%; height:100%; pointer-events:none;">
        <a-assets timeout="15000">${buildAFrameAssetsMarkup()}</a-assets>
        <a-entity light="type: ambient; color: #ffffff; intensity: 1.15"></a-entity>
        <a-entity light="type: directional; color: #ffffff; intensity: 0.75" position="1 2 1"></a-entity>
        <a-camera id="emo-camera" position="0 0 0" look-controls="enabled: false">
          ${buildFrozenContentMarkup()}
        </a-camera>
        ${anchorMarkup}
      </a-scene>
    `;

    const scene = container.querySelector('a-scene');
    const assets = container.querySelector('a-assets');
    const frozenObject = container.querySelector('#frozen-ar-object');
    const frozenModel = container.querySelector('#frozen-ar-model');
    const debugCube = container.querySelector('#frozen-debug-cube');
    const liveModels = Array.from(container.querySelectorAll('.live-ar-model'));
    const anchors = arTargets.map((target) => ({
      target,
      element: container.querySelector(`#emo-anchor-${target.targetIndex}`),
      onFound: null,
      onLost: null,
    })).filter(({ element }) => element);

    sceneRef.current = scene;

    const foundCbs = new Set();
    const lostCbs = new Set();
    const statusCbs = new Set();
    const activeTargets = new Map();
    let lastTarget = null;
    let liveYawOffset = 0;
    const frozenState = {
      active: false,
      sourceTarget: null,
      position: { ...FROZEN_GLB_POSITION },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { ...FROZEN_GLB_SCALE },
    };

    const cloneFrozenState = () => ({
      active: frozenState.active,
      sourceTarget: frozenState.sourceTarget ? cloneTarget(frozenState.sourceTarget) : null,
      position: { ...frozenState.position },
      rotation: { ...frozenState.rotation },
      scale: { ...frozenState.scale },
    });

    const setStatus = (nextStatus) => {
      statusRef.current = nextStatus;
      pushDiagnostics({ status: nextStatus, lastEvent: `status:${nextStatus}` });
      statusCbs.forEach((cb) => {
        try {
          cb(nextStatus);
        } catch (error) {
          console.error(error);
        }
      });
    };

    const applyFrozenState = () => {
      if (!frozenObject?.object3D || !frozenModel?.object3D) return false;
      const THREE = getThree();
      if (!THREE) return false;
      frozenObject.object3D.position.set(frozenState.position.x, frozenState.position.y, frozenState.position.z);
      frozenObject.object3D.rotation.set(
        THREE.MathUtils.degToRad(frozenState.rotation.x),
        THREE.MathUtils.degToRad(frozenState.rotation.y),
        THREE.MathUtils.degToRad(frozenState.rotation.z)
      );
      frozenModel.object3D.scale.set(frozenState.scale.x, frozenState.scale.y, frozenState.scale.z);
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
      liveModels.forEach((node) => {
        node.setAttribute('rotation', `0 ${liveYawOffset} 0`);
        if (node.object3D) node.object3D.rotation.y = THREE.MathUtils.degToRad(liveYawOffset);
      });
    };

    const stopLiveSpin = () => {
      liveModels.forEach((node) => {
        if (node.hasAttribute('animation__spin')) node.removeAttribute('animation__spin');
      });
    };

    const freezeCurrentTarget = () => {
      if (!frozenObject || !frozenModel) return null;
      const sourceTarget = lastTarget || activeTargets.values().next().value || arTargets[0];
      const fallbackScale = parseVector(sourceTarget?.scale || defaultAnchoredAr.scale, frozenState.scale);
      frozenState.active = true;
      frozenState.sourceTarget = sourceTarget ? cloneTarget(sourceTarget) : null;
      frozenState.position = { ...FROZEN_GLB_POSITION };
      frozenState.rotation = { x: 0, y: liveYawOffset, z: 0 };
      frozenState.scale = {
        x: fallbackScale.x > 0 ? fallbackScale.x : FROZEN_GLB_SCALE.x,
        y: fallbackScale.y > 0 ? fallbackScale.y : FROZEN_GLB_SCALE.y,
        z: fallbackScale.z > 0 ? fallbackScale.z : FROZEN_GLB_SCALE.z,
      };
      setLiveContentVisible(false);
      applyFrozenState();
      return cloneFrozenState();
    };

    const unfreezeCurrentTarget = () => {
      frozenState.active = false;
      frozenState.sourceTarget = null;
      setLiveContentVisible(true);
      applyFrozenState();
      return cloneFrozenState();
    };

    const showFinalObject = (transform = {}) => {
      if (!frozenObject || !frozenModel) return null;
      frozenState.active = true;
      frozenState.sourceTarget = lastTarget ? cloneTarget(lastTarget) : null;
      frozenState.position = transform.position
        ? parseVector(transform.position, FROZEN_GLB_POSITION)
        : { ...FROZEN_GLB_POSITION };
      frozenState.rotation = transform.rotation
        ? parseVector(transform.rotation, { x: 0, y: 0, z: 0 })
        : { x: 0, y: 0, z: 0 };
      frozenState.scale = transform.scale
        ? parseVector(transform.scale, FROZEN_GLB_SCALE)
        : { ...FROZEN_GLB_SCALE };
      setLiveContentVisible(false);
      applyFrozenState();
      return cloneFrozenState();
    };

    const hideFinalObject = () => {
      frozenState.active = false;
      frozenState.sourceTarget = null;
      applyFrozenState();
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
      const next = Math.max(0.04, Math.min(1.2, frozenState.scale.x * factor));
      frozenState.scale = { x: next, y: next, z: next };
      applyFrozenState();
      return cloneFrozenState();
    };

    const rotateLiveBy = ({ yawDelta = 0 } = {}) => {
      stopLiveSpin();
      liveYawOffset = ((liveYawOffset + Number(yawDelta || 0)) % 360 + 360) % 360;
      applyLiveYaw();
      return { yaw: liveYawOffset, targetsActive: activeTargets.size };
    };

    const onFound = (target) => {
      const payload = cloneTarget(target);
      activeTargets.set(target.targetIndex, payload);
      lastTarget = payload;
      setStatus('found');
      pushDiagnostics({ activeTargetId: target.targetId, lastEvent: `target-found:${target.targetId}` });
      foundCbs.forEach((cb) => {
        try {
          cb(payload);
        } catch (error) {
          console.error(error);
        }
      });
    };

    const onLost = (target) => {
      const payload = cloneTarget(target);
      activeTargets.delete(target.targetIndex);
      setStatus(activeTargets.size > 0 ? 'found' : (startedRef.current ? 'lost' : 'ready'));
      pushDiagnostics({ activeTargetId: activeTargets.size ? diagnosticsRef.current.activeTargetId : '', lastEvent: `target-lost:${target.targetId}` });
      lostCbs.forEach((cb) => {
        try {
          cb(payload);
        } catch (error) {
          console.error(error);
        }
      });
    };

    anchors.forEach((anchor) => {
      anchor.onFound = () => onFound(anchor.target);
      anchor.onLost = () => onLost(anchor.target);
      anchor.element.addEventListener('targetFound', anchor.onFound);
      anchor.element.addEventListener('targetLost', anchor.onLost);
    });

    assets?.addEventListener('loaded', () => pushDiagnostics({ assetsLoaded: true, modelAssetLoaded: true, lastEvent: 'assets-loaded' }), { once: true });
    scene.addEventListener('loaded', () => {
      pushDiagnostics({ sceneLoaded: true, lastEvent: 'scene-loaded' });
      if (!startedRef.current && statusRef.current === 'idle') setStatus('ready');
    }, { once: true });
    [...liveModels, frozenModel].forEach((node) => {
      node?.addEventListener('model-loaded', () => {
        pushDiagnostics({
          liveModelLoaded: diagnosticsRef.current.liveModelLoaded || node !== frozenModel,
          frozenModelLoaded: diagnosticsRef.current.frozenModelLoaded || node === frozenModel,
          lastEvent: node === frozenModel ? 'frozen-model-loaded' : 'live-model-loaded',
        });
      });
      node?.addEventListener('model-error', (event) => {
        debugCube?.setAttribute('visible', 'true');
        pushDiagnostics({ modelError: String(event?.detail?.src || event?.message || 'model-error'), lastEvent: 'model-error' });
      });
    });

    window.__mindar = {
      scene,
      anchors: anchors.map(({ element }) => element),
      targets: arTargets.map(cloneTarget),
      getStatus: () => statusRef.current,
      getActiveTargets: () => Array.from(activeTargets.values()).map(cloneTarget),
      getLastTarget: () => lastTarget ? cloneTarget(lastTarget) : null,
      freezeCurrentTarget,
      unfreezeCurrentTarget,
      showFinalObject,
      hideFinalObject,
      setFrozenTransform,
      getFrozenState: cloneFrozenState,
      moveFrozenByScreenDelta,
      rotateFrozenBy,
      scaleFrozenBy,
      setLiveContentVisible,
      rotateLiveBy,
      getLiveYaw: () => liveYawOffset,
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
        setStatus('loading');
        if (navigator.mediaDevices?.getUserMedia) {
          let probeStream = null;
          try {
            probeStream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: { ideal: 'environment' } },
              audio: false,
            });
          } catch (error) {
            setStatus('camera-denied');
            throw error;
          } finally {
            probeStream?.getTracks?.().forEach((track) => track.stop());
          }
        }
        await sys.start();
        startedRef.current = true;
        setStatus('running');
      },
      stop: () => {
        const sys = scene.systems && scene.systems['mindar-image-system'];
        if (sys) sys.stop();
        startedRef.current = false;
        activeTargets.clear();
        unfreezeCurrentTarget();
        setStatus(scene.hasLoaded ? 'ready' : 'idle');
      },
    };

    return () => {
      try {
        const sys = scene.systems && scene.systems['mindar-image-system'];
        if (sys && startedRef.current) sys.stop();
      } catch {}
      anchors.forEach((anchor) => {
        anchor.element.removeEventListener('targetFound', anchor.onFound);
        anchor.element.removeEventListener('targetLost', anchor.onLost);
      });
      if (window.__mindar && window.__mindar.scene === scene) delete window.__mindar;
      container.innerHTML = '';
      sceneRef.current = null;
      startedRef.current = false;
    };
  }, [onDiagnostics]);

  React.useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return undefined;

    let cancelled = false;
    const startIfNeeded = async () => {
      if (startedRef.current) return;
      try {
        if (!scene.hasLoaded) {
          await new Promise((resolve) => scene.addEventListener('loaded', resolve, { once: true }));
        }
        if (cancelled) return;
        await window.__mindar?.start();
      } catch (error) {
        console.error('[MindAR] start failed', error);
        const message = String(error?.name || error?.message || error);
        if (/NotAllowed|Permission|denied/i.test(message)) window.__setProtoState?.('denied');
        else window.__setProtoState?.('error');
      }
    };

    if (active) startIfNeeded();
    else if (startedRef.current) window.__mindar?.stop();

    return () => {
      cancelled = true;
    };
  }, [active]);

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
