import React from 'react';
import { LangChip, FrostButton, TOKENS, FONT_MONO, langFont, t } from '../components/ui.jsx';
import { arAudio } from '../lib/arAudio.js';
import { createARPhoto } from '../lib/arCapture.js';
import { useViewport } from '../lib/viewport.js';
import { clampScaleFactor, normalizeAngleDelta, pointerAngle, pointerDistance } from '../ar/frozenControls.js';
import { getARRuntime, isKivicubeRuntime } from '../ar/arRuntime.js';

const FLASH_MS = 240;
const SINGLE_FINGER_YAW_SENSITIVITY = 0.16;
const SINGLE_FINGER_PITCH_SENSITIVITY = 0.12;
const TWO_FINGER_YAW_SENSITIVITY = 0.18;
const TWO_FINGER_PITCH_SENSITIVITY = 0.14;
const TWO_FINGER_TWIST_SENSITIVITY = 0.75;

function formatVector(value, digits = 2) {
  if (!value) return '-';
  const x = Number(value.x);
  const y = Number(value.y);
  const z = Number(value.z);
  if (![x, y, z].every(Number.isFinite)) return '-';
  return `${x.toFixed(digits)}, ${y.toFixed(digits)}, ${z.toFixed(digits)}`;
}

function formatNumber(value, digits = 2) {
  const next = Number(value);
  return Number.isFinite(next) ? next.toFixed(digits) : '-';
}

function formatArrayVector(value, digits = 2) {
  if (!Array.isArray(value)) return '-';
  return value.map((part) => Number(part).toFixed(digits)).join(', ');
}

function formatLayerInfo(value) {
  if (!value) return '-';
  const canvas = value.canvas;
  const video = value.video;
  return `c${value.canvasCount || 0}:${canvas?.z || '-'} ${canvas?.width || 0}x${canvas?.height || 0} / v${value.videoCount || 0}:${video?.z || '-'} ${video?.width || 0}x${video?.height || 0}`;
}

function pointerCenter(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function readDebugFlag() {
  try {
    return new URLSearchParams(window.location.search).get('debug') === '1';
  } catch {
    return false;
  }
}

async function dataUrlToPhoto(dataUrl) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const filename = `emo-ar-${Date.now()}.png`;
  const file = typeof File === 'function'
    ? new File([blob], filename, { type: blob.type || 'image/png' })
    : null;
  return {
    blob,
    file,
    url: URL.createObjectURL(blob),
    width: null,
    height: null,
    source: 'kivicube',
  };
}

export function ARActive({ lang = 'zh', setLang, diagnostics }) {
  const [arPhase, setArPhase] = React.useState('scanning-success');
  const [frozenState, setFrozenState] = React.useState(() => getARRuntime()?.getFrozenState?.() || null);
  const [capturedPhoto, setCapturedPhoto] = React.useState(null);
  const pointersRef = React.useRef(new Map());
  const gestureRef = React.useRef({ lastDistance: null, lastCenter: null, lastAngle: null });
  const flashTimerRef = React.useRef(null);
  const debugMode = React.useMemo(readDebugFlag, []);
  const viewport = useViewport();

  // Drive the scanning-success -> glb-entering -> final-live transition on mount.
  React.useEffect(() => {
    let cancelled = false;
    let retryTimer = null;

    const startIntro = () => {
      const runtime = getARRuntime();
      if (!runtime?.showFinalModel) {
        retryTimer = window.setTimeout(startIntro, 80);
        return;
      }
      const target = runtime.getLastTarget?.() || runtime.getActiveTargets?.()?.[0] || null;
      const targetIndex = target?.targetIndex;
      setArPhase('scanning-success');
      flashTimerRef.current = window.setTimeout(() => {
        if (cancelled) return;
        setArPhase('glb-entering');
        arAudio.cueARIntro();
        const arPromise = runtime.showFinalModel?.(targetIndex).catch?.(() => null) || Promise.resolve();
        Promise.resolve(arPromise).then(async () => {
          if (cancelled) return;
          setArPhase('final-live');
          setFrozenState(runtime.getFrozenState?.() || null);
        });
      }, FLASH_MS);
    };

    startIntro();

    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      window.clearTimeout(flashTimerRef.current);
    };
  }, []);

  // On unmount, reset frozen object state so the scene is clean if user re-enters.
  React.useEffect(() => () => {
    getARRuntime()?.hideFinalObject?.();
  }, []);

  React.useEffect(() => () => {
    if (capturedPhoto?.url) URL.revokeObjectURL(capturedPhoto.url);
  }, [capturedPhoto]);

  // Keep the AR scene alive after image tracking is lost; the recognized image is only the trigger.
  React.useEffect(() => {
    const runtime = getARRuntime();
    if (!runtime?.onStatus) return undefined;
    const off = runtime.onStatus(() => {});
    return () => { off?.(); };
  }, []);

  const isCaptured = arPhase === 'captured-frame';
  const isCapturing = arPhase === 'capturing-frame';
  const isLive = arPhase === 'final-live' || isCaptured;
  const canEdit = arPhase === 'final-live';
  const isLandscapePhone = viewport.orientation === 'landscape' && !viewport.isTablet && viewport.height < 520;

  const clearCapturedPhoto = React.useCallback(() => {
    setCapturedPhoto((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
  }, []);

  const captureFrame = React.useCallback(async () => {
    const runtime = getARRuntime();
    if (arPhase === 'captured-frame') {
      clearCapturedPhoto();
      const next = await runtime?.unfreezeCurrentTarget?.();
      if (next) setFrozenState(next);
      setArPhase('final-live');
      return;
    }
    if (arPhase !== 'final-live') return;

    setArPhase('capturing-frame');
    try {
      arAudio.playShutter();
      const next = await runtime?.freezeCurrentTarget?.();
      if (next) setFrozenState(next);
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
      const photo = isKivicubeRuntime(runtime) && runtime?.takePhoto
        ? await dataUrlToPhoto(await runtime.takePhoto())
        : await createARPhoto();
      clearCapturedPhoto();
      setCapturedPhoto(photo);
      setArPhase('captured-frame');
    } catch (error) {
      console.error('[EMO-AR] capture failed', error);
      setArPhase('final-live');
    }
  }, [arPhase, clearCapturedPhoto]);

  const exitAR = React.useCallback(async () => {
    window.clearTimeout(flashTimerRef.current);
    clearCapturedPhoto();
    const runtime = getARRuntime();
    const next = await (runtime?.restartScan?.() || runtime?.hideFinalObject?.() || null);
    setFrozenState(next);
    window.__setProtoState?.('scan');
  }, [clearCapturedPhoto]);

  const shareFrame = React.useCallback(async () => {
    if (capturedPhoto?.url) {
      const fileData = {
        title: 'EMO AR',
        text: lang === 'en' ? 'I found EMO in AR.' : '我在 AR 里遇见了一毛。',
        files: capturedPhoto.file ? [capturedPhoto.file] : [],
      };
      let canShareFile = false;
      try {
        canShareFile = Boolean(capturedPhoto.file && navigator.canShare?.(fileData));
      } catch {}
      if (canShareFile && navigator.share) {
        try { await navigator.share(fileData); } catch {}
        return;
      }

      const link = document.createElement('a');
      link.href = capturedPhoto.url;
      link.download = capturedPhoto.file?.name || 'emo-ar-photo.png';
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }

    const shareData = {
      title: 'EMO AR',
      text: lang === 'en' ? 'I found EMO in AR.' : '我在 AR 里遇见了一毛。',
      url: window.location.href,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
      return;
    }
    try { await navigator.clipboard?.writeText?.(shareData.url); } catch {}
  }, [capturedPhoto, lang]);

  const resetFinalTransform = React.useCallback(() => {
    const next = getARRuntime()?.resetFinalTransform?.();
    if (next) setFrozenState(next);
  }, []);

  const handlePointerDown = React.useCallback((event) => {
    if (!canEdit) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = Array.from(pointersRef.current.values());
    if (points.length >= 2) {
      gestureRef.current.lastDistance = pointerDistance(points[0], points[1]);
      gestureRef.current.lastCenter = pointerCenter(points[0], points[1]);
      gestureRef.current.lastAngle = pointerAngle(points[0], points[1]);
    } else {
      gestureRef.current.lastDistance = null;
      gestureRef.current.lastCenter = null;
      gestureRef.current.lastAngle = null;
    }
  }, [canEdit]);

  const handlePointerMove = React.useCallback((event) => {
    if (!canEdit) return;
    const prev = pointersRef.current.get(event.pointerId);
    if (!prev) return;
    event.preventDefault();
    const next = { x: event.clientX, y: event.clientY };
    pointersRef.current.set(event.pointerId, next);
    const points = Array.from(pointersRef.current.values());

    if (points.length >= 2) {
      const distance = pointerDistance(points[0], points[1]);
      const center = pointerCenter(points[0], points[1]);
      const angle = pointerAngle(points[0], points[1]);
      const runtime = getARRuntime();
      let updatedState = null;
      if (gestureRef.current.lastDistance) {
        const scaleFactor = clampScaleFactor(distance / gestureRef.current.lastDistance);
        updatedState = runtime?.scaleFrozenBy?.({ scaleFactor }) || updatedState;
      }
      if (gestureRef.current.lastCenter) {
        const dx = center.x - gestureRef.current.lastCenter.x;
        const dy = center.y - gestureRef.current.lastCenter.y;
        const twistDelta = gestureRef.current.lastAngle == null
          ? 0
          : normalizeAngleDelta(angle - gestureRef.current.lastAngle);
        const yawDelta = (dx * TWO_FINGER_YAW_SENSITIVITY) + (twistDelta * TWO_FINGER_TWIST_SENSITIVITY);
        const pitchDelta = -dy * TWO_FINGER_PITCH_SENSITIVITY;
        updatedState = runtime?.rotateFrozenBy?.({ yawDelta, pitchDelta }) || updatedState;
      }
      if (updatedState) setFrozenState(updatedState);
      gestureRef.current.lastDistance = distance;
      gestureRef.current.lastCenter = center;
      gestureRef.current.lastAngle = angle;
    } else if (points.length === 1) {
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      gestureRef.current.lastDistance = null;
      gestureRef.current.lastCenter = null;
      gestureRef.current.lastAngle = null;
      const runtime = getARRuntime();
      const moved = runtime?.moveFrozenByScreenDelta?.({ dx, dy });
      const rotated = runtime?.rotateFrozenBy?.({
        yawDelta: dx * SINGLE_FINGER_YAW_SENSITIVITY,
        pitchDelta: -dy * SINGLE_FINGER_PITCH_SENSITIVITY,
      });
      const updatedState = rotated || moved;
      if (updatedState) setFrozenState(updatedState);
    }
  }, [canEdit]);

  const handlePointerUp = React.useCallback((event) => {
    pointersRef.current.delete(event.pointerId);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const points = Array.from(pointersRef.current.values());
    if (points.length >= 2) {
      gestureRef.current.lastDistance = pointerDistance(points[0], points[1]);
      gestureRef.current.lastCenter = pointerCenter(points[0], points[1]);
      gestureRef.current.lastAngle = pointerAngle(points[0], points[1]);
    } else {
      gestureRef.current.lastDistance = null;
      gestureRef.current.lastCenter = null;
      gestureRef.current.lastAngle = null;
    }
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: 'transparent' }}>
      {capturedPhoto?.url && (
        <img
          aria-hidden="true"
          src={capturedPhoto.url}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 8,
            pointerEvents: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        />
      )}

      <div className="top-controls">
        <FrostButton onClick={exitAR} title={t(lang, '返回扫描', 'Back to scan')}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M10 2L4 7l6 5" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>
        </FrostButton>
        <LangChip lang={lang} onToggle={setLang} light />
      </div>

      {canEdit && (
        <div
          data-interactive="true"
          data-ar-edit-surface="true"
          aria-label="Drag to move and rotate EMO; pinch with two fingers to scale"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 'calc(var(--safe-top) + 96px)',
            bottom: 'calc(var(--safe-bottom) + 220px)',
            zIndex: 4,
            pointerEvents: 'auto',
            touchAction: 'none',
            cursor: 'grab',
          }}
        />
      )}

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: `calc(var(--safe-bottom) + ${isLandscapePhone ? 18 : 80}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isLandscapePhone ? 8 : 14, pointerEvents: 'none', zIndex: 12 }}>
        {!isCaptured && (arPhase === 'scanning-success' || arPhase === 'glb-entering' || isCapturing) && (
          <div style={{ padding: '10px 16px', borderRadius: 999, background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '0.5px solid rgba(255,255,255,0.15)', fontFamily: langFont(lang), fontSize: 11, color: 'rgba(255,255,255,0.92)', maxWidth: 'min(84vw, 360px)', textAlign: 'center' }}>
            {arPhase === 'scanning-success' || arPhase === 'glb-entering'
              ? t(lang, '一毛出现中…', 'EMO is appearing…')
              : t(lang, '照片生成中…', 'Creating photo…')}
          </div>
        )}
        {isCaptured ? (
          <div style={{ display: 'flex', gap: 12, pointerEvents: 'auto' }}>
            <button type="button" onClick={captureFrame} style={actionButtonStyle(lang)}>{t(lang, '重新拍照', 'Retake')}</button>
            <button type="button" onClick={shareFrame} style={actionButtonStyle(lang)}>{t(lang, '分享好友', 'Share')}</button>
          </div>
        ) : isLive ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, pointerEvents: 'auto' }}>
            <button
              type="button"
              aria-label={t(lang, '重置人物位置', 'Reset EMO')}
              title={t(lang, '重置', 'Reset')}
              onClick={resetFinalTransform}
              disabled={!isLive || isCapturing}
              style={resetButtonStyle(isLive && !isCapturing)}
            >
              <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none">
                <path d="M8.5 7.2A6.8 6.8 0 1 1 5.4 13" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                <path d="M8.5 3.8v3.4H5.1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={captureFrame}
              disabled={!isLive || isCapturing}
              style={{
                pointerEvents: 'auto',
                width: isLandscapePhone ? 54 : 68,
                height: isLandscapePhone ? 54 : 68,
                borderRadius: 999,
                border: '3px solid #fff',
                background: TOKENS.pink,
                cursor: isLive && !isCapturing ? 'pointer' : 'default',
                boxShadow: '0 0 0 2px rgba(255,255,255,0.3), 0 10px 28px rgba(0,0,0,0.42)',
                opacity: isLive && !isCapturing ? 1 : 0.55,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              <div style={{ width: 20, height: 20, borderRadius: 999, background: '#fff' }} />
            </button>
          </div>
        ) : null}
      </div>

      {debugMode && (
        <div style={{ position: 'absolute', top: 'calc(var(--safe-top) + 72px)', right: 'calc(var(--safe-right) + 12px)', zIndex: 18, padding: '8px 10px', borderRadius: 10, background: 'rgba(0,0,0,0.62)', border: '0.5px solid rgba(255,255,255,0.18)', fontFamily: FONT_MONO, fontSize: 9.5, lineHeight: 1.45, color: '#fff', textAlign: 'left', pointerEvents: 'none', maxWidth: 248 }}>
          <div>phase: <b style={{ color: TOKENS.green }}>{arPhase}</b></div>
          <div>ar: <b style={{ color: TOKENS.green }}>{diagnostics?.status || '-'}</b></div>
          <div>glb: <b style={{ color: TOKENS.green }}>{diagnostics?.glbPhase || '-'}</b> · mode {diagnostics?.contentMode || '-'}</div>
          <div>gesture: mixed-drag</div>
          <div>activeTarget: {diagnostics?.activeTargetId || '-'}</div>
          <div>edit: <b style={{ color: frozenState?.active ? TOKENS.green : TOKENS.pinkDeep }}>{String(!!frozenState?.active)}</b></div>
          {frozenState && (
            <>
              <div>pos: {formatVector(frozenState.position)}</div>
              <div>rot: {formatVector(frozenState.rotation, 0)}</div>
              <div>scale: {formatVector(frozenState.scale)}</div>
            </>
          )}
          <div>glbScale: {formatArrayVector(diagnostics?.glbScale, 3)}</div>
          <div>glbSize: {formatArrayVector(diagnostics?.glbBounds?.size, 3)}</div>
          <div>modelReady: {String(Boolean(diagnostics?.modelReady))}</div>
          <div>modelSrc: {diagnostics?.modelSrc || '-'}</div>
          <div>near/depth: {formatNumber(diagnostics?.cameraNear, 2)} / {formatNumber(diagnostics?.finalRenderDepth, 2)}</div>
          <div>glbNdc: {formatVector(diagnostics?.glbNdc, 2)}</div>
          <div>meshNdc: {formatVector(diagnostics?.meshCenterNdc, 2)}</div>
          <div>glbProj: {formatNumber(diagnostics?.glbProjectedSize?.width, 2)} x {formatNumber(diagnostics?.glbProjectedSize?.height, 2)}</div>
          <div>markerNdc: {formatVector(diagnostics?.markerNdc, 2)}</div>
          <div>marker: {formatVector(diagnostics?.debugMarkerWorld, 2)}</div>
          <div>layers: {formatLayerInfo(diagnostics?.layerInfo)}</div>
          {diagnostics?.textureWarning && <div style={{ color: '#ffbac8' }}>texture: {diagnostics.textureWarning}</div>}
          {diagnostics?.lastError && <div style={{ color: '#ffbac8' }}>last-error: {diagnostics.lastError}</div>}
          {diagnostics?.modelError && <div style={{ color: '#ffbac8' }}>model-error: {diagnostics.modelError}</div>}
        </div>
      )}
    </div>
  );
}

function resetButtonStyle(enabled, active = false) {
  return {
    width: 44,
    height: 44,
    borderRadius: 999,
    border: active ? '1px solid rgba(255,255,255,0.76)' : '1px solid rgba(255,255,255,0.36)',
    background: active ? 'rgba(238,128,158,0.92)' : 'rgba(0,0,0,0.34)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    boxShadow: active
      ? '0 0 0 2px rgba(255,255,255,0.22), 0 8px 22px rgba(0,0,0,0.28)'
      : '0 8px 22px rgba(0,0,0,0.28)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    cursor: enabled ? 'pointer' : 'default',
    opacity: enabled ? 1 : 0.55,
  };
}

function actionButtonStyle(lang) {
  return {
    minWidth: 112,
    height: 42,
    borderRadius: 999,
    border: 'none',
    background: TOKENS.emoPink,
    color: '#fff',
    fontFamily: langFont(lang),
    fontSize: 13,
    fontWeight: 800,
    boxShadow: '0 10px 28px rgba(0,0,0,0.16)',
    cursor: 'pointer',
  };
}
