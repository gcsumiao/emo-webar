import React from 'react';
import { LangChip, FrostButton, TOKENS, langFont, t } from '../components/ui.jsx';
import { getARRuntime } from '../ar/arRuntime.js';
import {
  getArLocation,
  getArTenant,
  getRecognitionApiUrl,
  getRecognitionEventsUrl,
  hasFixedSceneSelection,
} from '../ar/arCloudConfig.js';
import { asset } from '../lib/assetUrl.js';
import { captureRecognitionFrame } from '../lib/cloudRecognitionCapture.js';
import { useScanGeometry } from '../lib/viewport.js';

const MANUAL_LOCK_DELAY_MS = 3000;
const RUNTIME_READY_EVENT = 'emo-mindar-runtime-ready';
const CLOUD_RECOGNITION_INITIAL_DELAY_MS = 650;
const CLOUD_RECOGNITION_INTERVAL_MS = 1300;
const CLOUD_RECOGNITION_RETRY_MS = 700;
const SCAN_FRAME_BOUNDS = {
  x: 219,
  y: 505,
  width: 642,
  height: 634,
  viewBoxWidth: 1080,
  viewBoxHeight: 1920,
};
const SCAN_WINDOW_HORIZONTAL_PADDING_RATIO = 0.035;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getScanFrameMetrics(size) {
  const targetWidth = size * 1.22;
  const scale = targetWidth / SCAN_FRAME_BOUNDS.width;
  const outlineWidth = SCAN_FRAME_BOUNDS.width * scale;
  const outlineHeight = SCAN_FRAME_BOUNDS.height * scale;
  return {
    scale,
    frameWidth: SCAN_FRAME_BOUNDS.viewBoxWidth * scale,
    frameHeight: SCAN_FRAME_BOUNDS.viewBoxHeight * scale,
    frameCenterX: (SCAN_FRAME_BOUNDS.x + SCAN_FRAME_BOUNDS.width / 2) * scale,
    frameCenterY: (SCAN_FRAME_BOUNDS.y + SCAN_FRAME_BOUNDS.height / 2) * scale,
    outlineWidth,
    outlineHeight,
    outlineHalfHeight: outlineHeight / 2,
  };
}

function getScanWindowRect(cx, cy, size) {
  const { outlineWidth, outlineHeight } = getScanFrameMetrics(size);
  const horizontalPadding = outlineWidth * SCAN_WINDOW_HORIZONTAL_PADDING_RATIO;
  return {
    left: cx - outlineWidth / 2 - horizontalPadding,
    top: cy - outlineHeight / 2,
    width: outlineWidth + horizontalPadding * 2,
    height: outlineHeight,
  };
}

function ScanFrameViewfinder({ cx, cy, size }) {
  const { frameWidth, frameHeight, frameCenterX, frameCenterY } = getScanFrameMetrics(size);
  return (
    <img
      src={asset('/assets/site-ui/scan-frame.svg')}
      alt=""
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: cx - frameCenterX,
        top: cy - frameCenterY,
        width: frameWidth,
        height: frameHeight,
        pointerEvents: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    />
  );
}

function ScanWindowOverlay({ cx, cy, size, active = true }) {
  const rect = getScanWindowRect(cx, cy, size);
  const cornerLength = clamp(rect.width * 0.085, 24, 42);
  const cornerStroke = clamp(rect.width * 0.008, 3, 5);
  const cornerRadius = cornerStroke;
  const cornerColor = 'rgba(246, 168, 190, 0.96)';
  const cornerBase = {
    position: 'absolute',
    width: cornerLength,
    height: cornerLength,
    boxSizing: 'border-box',
    borderColor: cornerColor,
    filter: 'drop-shadow(0 0 12px rgba(246,168,190,0.46))',
  };
  const sweepInset = Math.max(cornerStroke, 2);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        opacity: active ? 1 : 0,
        transition: 'opacity 220ms ease',
        pointerEvents: 'none',
        zIndex: 3,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          boxShadow: '0 0 0 9999px rgba(6, 10, 16, 0.36)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: rect.left + sweepInset,
          top: rect.top + sweepInset,
          width: rect.width - sweepInset * 2,
          height: rect.height - sweepInset * 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: 4,
            marginTop: -2,
            borderRadius: 999,
            background: 'linear-gradient(90deg, rgba(246,168,190,0), rgba(255,255,255,0.95) 14%, rgba(246,168,190,0.98) 50%, rgba(255,255,255,0.95) 86%, rgba(246,168,190,0))',
            boxShadow: '0 0 18px rgba(255,255,255,0.86), 0 0 42px rgba(242,156,176,0.58)',
            animation: 'scan-sweep 2.8s ease-in-out infinite',
          }}
        />
      </div>
      <div style={{ ...cornerBase, left: rect.left, top: rect.top, borderTop: `${cornerStroke}px solid`, borderLeft: `${cornerStroke}px solid`, borderTopLeftRadius: cornerRadius }} />
      <div style={{ ...cornerBase, left: rect.left + rect.width - cornerLength, top: rect.top, borderTop: `${cornerStroke}px solid`, borderRight: `${cornerStroke}px solid`, borderTopRightRadius: cornerRadius }} />
      <div style={{ ...cornerBase, left: rect.left, top: rect.top + rect.height - cornerLength, borderBottom: `${cornerStroke}px solid`, borderLeft: `${cornerStroke}px solid`, borderBottomLeftRadius: cornerRadius }} />
      <div style={{ ...cornerBase, left: rect.left + rect.width - cornerLength, top: rect.top + rect.height - cornerLength, borderBottom: `${cornerStroke}px solid`, borderRight: `${cornerStroke}px solid`, borderBottomRightRadius: cornerRadius }} />
    </div>
  );
}

function readDebugFlag() {
  try {
    return new URLSearchParams(window.location.search).get('debug') === '1';
  } catch {
    return false;
  }
}

function postRecognitionEvent(target) {
  const url = getRecognitionEventsUrl();
  if (!url || !target) return;

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant: getArTenant(),
      location: getArLocation(),
      sceneId: target.sceneId,
      targetIndex: target.targetIndex,
      confidence: 1,
      source: 'mindar',
    }),
    keepalive: true,
  }).catch((error) => {
    console.warn('[EMO-AR] recognition event logging failed', error);
  });
}

export function Scan({ lang = 'zh', setLang }) {
  const [scanState, setScanState] = React.useState('searching');
  const [showManualLock, setShowManualLock] = React.useState(false);
  const [sceneCatalog, setSceneCatalog] = React.useState([]);
  const [selectedSceneId, setSelectedSceneId] = React.useState('');
  const manualSceneLockedRef = React.useRef(false);
  const geometryRef = React.useRef(null);
  const debugMode = React.useMemo(readDebugFlag, []);
  const geometry = useScanGeometry();
  React.useEffect(() => {
    geometryRef.current = geometry;
  }, [geometry]);
  const isLocked = scanState === 'locked';
  const isLandscapePhone = geometry.orientation === 'landscape' && !geometry.isTablet && geometry.height < 520;
  const scanControlGap = isLandscapePhone ? 12 : 18;
  const scanFrameMetrics = getScanFrameMetrics(geometry.scanSize);
  const scanFrameBottom = geometry.scanCenterY + scanFrameMetrics.outlineHalfHeight;
  const scanControlTopRaw = scanFrameBottom + scanControlGap;
  const scanControlTop = isLandscapePhone
    ? Math.min(scanControlTopRaw, geometry.height - 128)
    : scanControlTopRaw;

  React.useEffect(() => {
    let cancelled = false;
    let retryTimer = null;
    let mockRecognitionTimer = null;
    let cloudRecognitionTimer = null;
    let cloudRecognitionInFlight = false;
    let hasLockedTarget = false;
    let hasCloudScene = false;
    let offFound = null;
    let offLost = null;
    let boundRuntime = null;

    const clearCloudRecognition = () => {
      window.clearTimeout(cloudRecognitionTimer);
      cloudRecognitionTimer = null;
    };

    const shouldSkipCloudRecognition = () => (
      hasFixedSceneSelection() || manualSceneLockedRef.current
    );

    const startCloudRecognition = () => {
      clearCloudRecognition();
      const url = getRecognitionApiUrl();
      if (!url || shouldSkipCloudRecognition()) return;

      const schedule = (delay = CLOUD_RECOGNITION_INTERVAL_MS) => {
        clearCloudRecognition();
        if (cancelled || hasLockedTarget || hasCloudScene || shouldSkipCloudRecognition()) return;
        cloudRecognitionTimer = window.setTimeout(runRecognition, delay);
      };

      const runRecognition = async () => {
        if (cancelled || hasLockedTarget || hasCloudScene || cloudRecognitionInFlight || shouldSkipCloudRecognition()) return;
        const runtime = getARRuntime();
        if (!runtime?.applyRecognitionResult) {
          schedule(CLOUD_RECOGNITION_RETRY_MS);
          return;
        }
        if (runtime.getActiveTargets?.().length) {
          schedule(CLOUD_RECOGNITION_INTERVAL_MS);
          return;
        }

        const latestGeometry = geometryRef.current;
        const cropRect = latestGeometry
          ? getScanWindowRect(latestGeometry.scanCenterX, latestGeometry.scanCenterY, latestGeometry.scanSize)
          : null;
        const frame = captureRecognitionFrame({ cropRect });
        if (!frame?.imageDataUrl) {
          schedule(CLOUD_RECOGNITION_RETRY_MS);
          return;
        }

        cloudRecognitionInFlight = true;
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tenant: getArTenant(),
              location: getArLocation(),
              imageDataUrl: frame.imageDataUrl,
              maxCandidates: debugMode ? 5 : 3,
            }),
          });
          if (!response.ok) throw new Error(`Cloud recognition failed: ${response.status}`);
          const result = await response.json();
          if (cancelled) return;
          if (result?.matched) {
            hasCloudScene = true;
            manualSceneLockedRef.current = true;
            setShowManualLock(false);
            setSelectedSceneId(result.sceneId || '');
            setScanState('scene-loading');
            await runtime.applyRecognitionResult(result);
            return;
          }
        } catch (error) {
          console.warn('[EMO-AR] cloud recognition failed', error);
        } finally {
          cloudRecognitionInFlight = false;
        }

        schedule(CLOUD_RECOGNITION_INTERVAL_MS);
      };

      schedule(CLOUD_RECOGNITION_INITIAL_DELAY_MS);
    };

    const clearRuntimeSubscriptions = () => {
      offFound?.();
      offLost?.();
      offFound = null;
      offLost = null;
    };

    const bindRuntime = () => {
      if (cancelled) return;
      const runtime = getARRuntime();
      if (!runtime?.onTargetFound || !runtime?.onTargetLost) {
        retryTimer = window.setTimeout(bindRuntime, 80);
        return;
      }
      if (runtime === boundRuntime) return;

      clearRuntimeSubscriptions();
      boundRuntime = runtime;
      const catalog = runtime.getSceneCatalog?.() || [];
      setSceneCatalog(catalog);
      setSelectedSceneId(runtime.getMockSceneId?.() || runtime.getCurrentScene?.()?.sceneId || catalog[0]?.sceneId || '');

      offFound = runtime.onTargetFound((target) => {
        hasLockedTarget = true;
        clearCloudRecognition();
        setShowManualLock(false);
        setScanState('locked');
        postRecognitionEvent(target);
      });
      offLost = runtime.onTargetLost(() => {
        setScanState((current) => current === 'locked' ? current : 'searching');
      });

      startCloudRecognition();

      window.clearTimeout(mockRecognitionTimer);
      if (runtime.getMockSceneId?.()) {
        mockRecognitionTimer = window.setTimeout(async () => {
          try {
            const result = await runtime.recognizeFrameMock?.({ collectionId: runtime.collectionId });
            if (cancelled || !result?.matched) return;
            runtime.applyRecognitionResult?.(result);
          } catch (error) {
            console.warn('[EMO-AR] mock cloud recognition failed', error);
          }
        }, 120);
      }
    };

    window.addEventListener(RUNTIME_READY_EVENT, bindRuntime);
    bindRuntime();
    return () => {
      cancelled = true;
      clearCloudRecognition();
      window.removeEventListener(RUNTIME_READY_EVENT, bindRuntime);
      window.clearTimeout(retryTimer);
      window.clearTimeout(mockRecognitionTimer);
      clearRuntimeSubscriptions();
    };
  }, []);

  React.useEffect(() => {
    if (isLocked) {
      setShowManualLock(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setShowManualLock(true), MANUAL_LOCK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isLocked]);

  React.useEffect(() => {
    if (!isLocked) return undefined;
    const timer = setTimeout(() => window.__setProtoState?.('ar'), 600);
    return () => clearTimeout(timer);
  }, [isLocked]);

  const scanControlStyle = {
    position: 'absolute',
    left: '50%',
    top: scanControlTop,
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: isLandscapePhone ? 12 : 16,
    pointerEvents: 'none',
    zIndex: 8,
  };

  const scanHintStyle = {
    padding: '9px 16px',
    borderRadius: 999,
    background: 'rgba(0,0,0,0.26)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    color: 'rgba(255,255,255,0.86)',
    fontFamily: langFont(lang),
    fontSize: 11,
    whiteSpace: 'nowrap',
  };

  const scanHintText = isLocked
    ? t(lang, '已锁定，一毛出现中…', 'Locked · EMO is appearing…')
    : scanState === 'scene-loading'
      ? t(lang, '已识别，正在加载 AR…', 'Recognized · loading AR…')
    : isLandscapePhone
      ? t(lang, '横屏模式 · 云端识别中', 'Landscape · cloud scanning')
      : t(lang, '对准目标，云端识别', 'Aim at the target · cloud scanning');

  const lockManually = React.useCallback(() => {
    manualSceneLockedRef.current = true;
    setShowManualLock(false);
    setScanState('locked');
  }, []);

  const applyDebugScene = React.useCallback(async (event) => {
    const sceneId = event.target.value;
    manualSceneLockedRef.current = true;
    setSelectedSceneId(sceneId);
    setShowManualLock(false);
    setScanState('searching');
    const runtime = getARRuntime();
    try {
      runtime?.setMockSceneId?.(sceneId);
      const result = await runtime?.recognizeFrameMock?.({ sceneId });
      if (result?.matched) await runtime?.applyRecognitionResult?.(result);
      const nextRuntime = getARRuntime();
      setSceneCatalog(nextRuntime?.getSceneCatalog?.() || sceneCatalog);
      setSelectedSceneId(nextRuntime?.getMockSceneId?.() || nextRuntime?.getCurrentScene?.()?.sceneId || sceneId);
    } catch (error) {
      console.warn('[EMO-AR] debug scene switch failed', error);
    }
  }, [sceneCatalog]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: 'transparent' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: isLocked ? 0 : 1, transition: 'opacity 320ms ease-out', pointerEvents: 'none' }}>
        <ScanFrameViewfinder cx={geometry.scanCenterX} cy={geometry.scanCenterY} size={geometry.scanSize} />
      </div>
      <ScanWindowOverlay cx={geometry.scanCenterX} cy={geometry.scanCenterY} size={geometry.scanSize} active={!isLocked} />
      <div className="top-controls">
        <FrostButton onClick={() => window.__setProtoState?.('landing')}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M10 2L4 7l6 5" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>
        </FrostButton>
        <LangChip lang={lang} onToggle={setLang} light />
      </div>

      {debugMode && sceneCatalog.length > 0 && (
        <div style={debugScenePickerStyle(isLandscapePhone)}>
          <label htmlFor="emo-debug-scene" style={{ opacity: 0.72 }}>
            Scene
          </label>
          <select
            id="emo-debug-scene"
            value={selectedSceneId}
            onChange={applyDebugScene}
            style={debugSceneSelectStyle(lang)}
          >
            {sceneCatalog.map((scene) => (
              <option key={scene.sceneId} value={scene.sceneId}>
                {scene.label || scene.sceneId}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={scanControlStyle}>
        <div style={scanHintStyle}>
          {scanHintText}
        </div>
        {showManualLock && !isLocked && (
          <button
            type="button"
            aria-label={t(lang, '一键锁定目标', 'Tap to lock target')}
            onClick={lockManually}
            style={{
              minWidth: 112,
              minHeight: 88,
              border: 'none',
              background: 'transparent',
              color: '#fff',
              fontFamily: langFont(lang),
              fontSize: isLandscapePhone ? 12 : 13,
              fontWeight: 800,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              cursor: 'pointer',
              pointerEvents: 'auto',
              padding: '8px 12px',
              textShadow: '0 2px 8px rgba(0,0,0,0.55)',
            }}
          >
            <svg aria-hidden="true" width="46" height="46" viewBox="0 0 32 32" style={{ filter: 'drop-shadow(0 3px 9px rgba(0,0,0,0.48))' }}>
              <circle cx="16" cy="16" r="9" fill="none" stroke="#fff" strokeWidth="2.4" />
              <circle cx="16" cy="16" r="2.8" fill={TOKENS.pink} />
              <path d="M16 3.5v6M16 22.5v6M3.5 16h6M22.5 16h6" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
            <span>{t(lang, '一键锁定', 'Tap to lock')}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function debugScenePickerStyle(isLandscapePhone) {
  return {
    position: 'absolute',
    top: `calc(var(--safe-top) + ${isLandscapePhone ? 56 : 72}px)`,
    left: 'calc(var(--safe-left) + 14px)',
    zIndex: 18,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    borderRadius: 12,
    background: 'rgba(0,0,0,0.42)',
    border: '0.5px solid rgba(255,255,255,0.18)',
    color: '#fff',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 10,
    pointerEvents: 'auto',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  };
}

function debugSceneSelectStyle(lang) {
  return {
    maxWidth: 150,
    height: 28,
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.26)',
    background: 'rgba(255,255,255,0.94)',
    color: '#1f1a1f',
    fontFamily: langFont(lang),
    fontSize: 12,
    fontWeight: 700,
  };
}
