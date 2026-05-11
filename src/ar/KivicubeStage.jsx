import React from 'react';
import { getKivicubeConfig } from './kivicubeConfig.js';
import { ensureKivicubePlugin } from './kivicubeLoader.js';

const IFRAME_ALLOW = 'xr-spatial-tracking; camera; microphone; autoplay; fullscreen; gyroscope; accelerometer';

function createDiagnostics() {
  return {
    provider: 'kivicube',
    status: 'idle',
    lastEvent: '',
    activeTargetId: '',
    collectionId: '',
    sceneId: '',
    downloadProgress: null,
    modelError: '',
  };
}

function detailMessage(detail) {
  if (!detail) return '';
  if (typeof detail === 'string') return detail;
  if (detail.message) return String(detail.message);
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

function clone(value) {
  if (!value) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

export function KivicubeStage({ active, visible, onDiagnostics }) {
  const iframeRef = React.useRef(null);
  const collectionApiRef = React.useRef(null);
  const sceneApiRef = React.useRef(null);
  const collectionInfoRef = React.useRef(null);
  const sceneInfoRef = React.useRef(null);
  const statusRef = React.useRef('idle');
  const diagnosticsRef = React.useRef(createDiagnostics());
  const foundCallbacksRef = React.useRef(new Set());
  const lostCallbacksRef = React.useRef(new Set());
  const statusCallbacksRef = React.useRef(new Set());
  const lastTrackedPayloadRef = React.useRef(null);
  const isTrackedRef = React.useRef(false);

  React.useEffect(() => {
    if (!active) return undefined;

    const iframe = iframeRef.current;
    if (!iframe) return undefined;

    let cancelled = false;
    const { collectionId, openProps } = getKivicubeConfig();

    const pushDiagnostics = (patch = {}) => {
      diagnosticsRef.current = {
        ...diagnosticsRef.current,
        provider: 'kivicube',
        collectionId,
        ...patch,
      };
      onDiagnostics?.(diagnosticsRef.current);
      if (patch.lastEvent || patch.modelError) console.info('[Kivicube-AR]', diagnosticsRef.current);
    };

    const setStatus = (nextStatus, patch = {}) => {
      statusRef.current = nextStatus;
      pushDiagnostics({ status: nextStatus, lastEvent: nextStatus, ...patch });
      statusCallbacksRef.current.forEach((cb) => {
        try { cb(nextStatus); } catch (error) { console.error(error); }
      });
    };

    const buildTrackedPayload = () => {
      const sceneInfo = sceneInfoRef.current || {};
      const sceneId = sceneInfo.sceneId || diagnosticsRef.current.sceneId || null;
      return {
        provider: 'kivicube',
        targetId: sceneId,
        targetIndex: null,
        sceneId,
        sceneInfo: clone(sceneInfoRef.current),
      };
    };

    const runtime = {
      provider: 'kivicube',
      getStatus: () => statusRef.current,
      isReady: () => Boolean(collectionApiRef.current),
      getCollectionApi: () => collectionApiRef.current,
      getSceneApi: () => sceneApiRef.current,
      getCollectionInfo: () => collectionInfoRef.current,
      getSceneInfo: () => sceneInfoRef.current,
      getCurrentScene: () => sceneInfoRef.current,
      getLastTarget: () => lastTrackedPayloadRef.current,
      getActiveTargets: () => (
        isTrackedRef.current && lastTrackedPayloadRef.current
          ? [lastTrackedPayloadRef.current]
          : []
      ),
      onStatus: (cb) => {
        statusCallbacksRef.current.add(cb);
        cb(statusRef.current);
        return () => statusCallbacksRef.current.delete(cb);
      },
      onTargetFound: (cb) => {
        foundCallbacksRef.current.add(cb);
        return () => foundCallbacksRef.current.delete(cb);
      },
      onTargetLost: (cb) => {
        lostCallbacksRef.current.add(cb);
        return () => lostCallbacksRef.current.delete(cb);
      },
      takePhoto: async () => {
        if (sceneApiRef.current?.takePhoto) return await sceneApiRef.current.takePhoto();
        if (collectionApiRef.current?.takePhoto) return await collectionApiRef.current.takePhoto();
        throw new Error('Kivicube takePhoto API is not ready.');
      },
      openScene: async (sceneId) => {
        if (!collectionApiRef.current?.openScene) throw new Error('Kivicube collection API is not ready.');
        return await collectionApiRef.current.openScene(sceneId);
      },
      backToScan: async () => {
        if (!collectionApiRef.current?.backToScan) return null;
        return await collectionApiRef.current.backToScan();
      },
      restartScan: async () => {
        if (!collectionApiRef.current?.backToScan) return null;
        return await collectionApiRef.current.backToScan();
      },
      playSpriteIntro: async () => null,
      stopSpriteIntro: () => null,
      showFinalSprite: () => null,
      hideSprite: () => null,
      hideFinalObject: () => null,
      showFinalObject: () => null,
      freezeCurrentTarget: () => null,
      unfreezeCurrentTarget: () => null,
      getFrozenState: () => null,
      getSpriteState: () => ({ phase: statusRef.current, activeTargetIndex: null, frameIndex: 0 }),
      setFrozenTransform: () => null,
      moveFrozenByScreenDelta: () => null,
      rotateFrozenBy: () => null,
      scaleFrozenBy: () => null,
      rotateLiveBy: () => ({ yaw: 0, targetsActive: isTrackedRef.current ? 1 : 0 }),
      getLiveYaw: () => 0,
    };

    window.__ar = runtime;

    const handleReady = (event) => {
      collectionApiRef.current = event.detail?.api || null;
      collectionInfoRef.current = event.detail?.collectionInfo || null;
      setStatus('collection-ready', {
        collectionId: collectionInfoRef.current?.collectionId || collectionId,
      });
    };

    const handleIncompatibility = (event) => {
      setStatus('incompatibility', { modelError: detailMessage(event.detail) || 'Kivicube incompatibility' });
    };

    const handleCloudarStart = () => {
      setStatus('scanning');
    };

    const handleCloudarEnd = (event) => {
      const sceneId = event.detail?.sceneId || '';
      setStatus('matched', { sceneId, activeTargetId: sceneId });
    };

    const handleSceneReady = (event) => {
      sceneApiRef.current = event.detail?.api || null;
      sceneInfoRef.current = event.detail?.sceneInfo || null;
      const sceneId = sceneInfoRef.current?.sceneId || diagnosticsRef.current.sceneId || '';
      setStatus('scene-ready', { sceneId, activeTargetId: sceneId });
    };

    const handleSceneDestroy = (event) => {
      sceneApiRef.current = null;
      sceneInfoRef.current = null;
      isTrackedRef.current = false;
      setStatus('scene-destroy', { sceneId: event.detail?.sceneId || '', activeTargetId: '' });
    };

    const handleDownloadAssetStart = () => {
      setStatus('download-asset-start', { downloadProgress: 0 });
    };

    const handleDownloadAssetProgress = (event) => {
      pushDiagnostics({
        status: statusRef.current,
        lastEvent: 'download-asset-progress',
        downloadProgress: typeof event.detail === 'number' ? event.detail : null,
      });
    };

    const handleDownloadAssetEnd = () => {
      setStatus('download-asset-end', { downloadProgress: 1 });
    };

    const handleLoadSceneStart = () => {
      setStatus('load-scene-start');
    };

    const handleLoadSceneEnd = () => {
      setStatus('load-scene-end');
    };

    const handleSceneStart = () => {
      setStatus('scene-start');
    };

    const handleTracked = () => {
      isTrackedRef.current = true;
      const payload = buildTrackedPayload();
      lastTrackedPayloadRef.current = payload;
      setStatus('found', { activeTargetId: payload.sceneId || '' });
      foundCallbacksRef.current.forEach((cb) => {
        try { cb(payload); } catch (error) { console.error(error); }
      });
    };

    const handleLostTrack = () => {
      isTrackedRef.current = false;
      setStatus('lostTrack');
      const payload = lastTrackedPayloadRef.current;
      lostCallbacksRef.current.forEach((cb) => {
        try { cb(payload); } catch (error) { console.error(error); }
      });
    };

    const eventHandlers = [
      ['ready', handleReady],
      ['incompatibility', handleIncompatibility],
      ['cloudarStart', handleCloudarStart],
      ['cloudarEnd', handleCloudarEnd],
      ['sceneReady', handleSceneReady],
      ['sceneDestroy', handleSceneDestroy],
      ['downloadAssetStart', handleDownloadAssetStart],
      ['downloadAssetProgress', handleDownloadAssetProgress],
      ['downloadAssetEnd', handleDownloadAssetEnd],
      ['loadSceneStart', handleLoadSceneStart],
      ['loadSceneEnd', handleLoadSceneEnd],
      ['sceneStart', handleSceneStart],
      ['tracked', handleTracked],
      ['lostTrack', handleLostTrack],
    ];

    eventHandlers.forEach(([eventName, handler]) => iframe.addEventListener(eventName, handler));

    const openCollection = async () => {
      if (!collectionId) {
        setStatus('config-error', { modelError: 'VITE_KIVICUBE_COLLECTION_ID is required for Kivicube AR mode.' });
        return;
      }

      try {
        setStatus('loading-plugin');
        const plugin = await ensureKivicubePlugin();
        if (cancelled) return;
        setStatus('opening-collection');
        await plugin.openKivicubeCollection(iframe, openProps);
      } catch (error) {
        if (cancelled) return;
        console.error('[Kivicube-AR] open failed', error);
        setStatus('error', { modelError: String(error?.message || error) });
      }
    };

    openCollection();

    return () => {
      cancelled = true;
      eventHandlers.forEach(([eventName, handler]) => iframe.removeEventListener(eventName, handler));
      try {
        const plugin = window.kivicubeIframePlugin;
        if (plugin?.destroyKivicubeCollection) {
          Promise.resolve(plugin.destroyKivicubeCollection(iframe)).catch((error) => {
            console.warn('[Kivicube-AR] destroy failed', error);
          });
        }
      } catch (error) {
        console.warn('[Kivicube-AR] destroy failed', error);
      }
      iframe.src = 'about:blank';
      collectionApiRef.current = null;
      sceneApiRef.current = null;
      collectionInfoRef.current = null;
      sceneInfoRef.current = null;
      isTrackedRef.current = false;
      foundCallbacksRef.current.clear();
      lostCallbacksRef.current.clear();
      statusCallbacksRef.current.clear();
      if (window.__ar?.provider === 'kivicube') delete window.__ar;
    };
  }, [active, onDiagnostics]);

  return (
    <iframe
      ref={iframeRef}
      title="Kivicube AR"
      className="ar-layer"
      allow={IFRAME_ALLOW}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        border: 0,
        visibility: visible ? 'visible' : 'hidden',
      }}
    />
  );
}
