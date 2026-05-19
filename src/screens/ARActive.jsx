import React from 'react';
import { LangChip, FrostButton, TOKENS, FONT_MONO, langFont, t } from '../components/ui.jsx';
import { arAudio } from '../lib/arAudio.js';
import { createARPhoto, createFramedARPhoto } from '../lib/arCapture.js';
import { asset } from '../lib/assetUrl.js';
import { useViewport } from '../lib/viewport.js';
import { clampScaleFactor, pointerDistance } from '../ar/frozenControls.js';
import { getARRuntime, isKivicubeRuntime } from '../ar/arRuntime.js';

const FLASH_MS = 240;
const PHOTO_FRAME_URL = asset('/assets/site-ui/photo-frame.svg');
const SINGLE_FINGER_YAW_SENSITIVITY = 0.16;
const SINGLE_FINGER_PITCH_SENSITIVITY = 0.12;
const CUE_TAP = 'tap';
const CUE_GESTURES = 'gestures';
const CUE_HIDDEN = 'hidden';

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

function readDebugFlag() {
  try {
    return new URLSearchParams(window.location.search).get('debug') === '1';
  } catch {
    return false;
  }
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  if (max < min) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
}

function resolveInteractionAnchor(diagnostics, viewport, isLandscapePhone) {
  const width = viewport.width || 390;
  const height = viewport.height || 844;
  const center = diagnostics?.meshCenterNdc || diagnostics?.glbNdc;
  const rawX = Number(center?.x);
  const rawY = Number(center?.y);
  const fallbackY = height * (isLandscapePhone ? 0.5 : 0.46);
  const centerX = Number.isFinite(rawX) ? ((rawX + 1) / 2) * width : width / 2;
  const centerY = Number.isFinite(rawY) ? ((1 - rawY) / 2) * height : fallbackY;
  const projected = diagnostics?.glbProjectedSize;
  const projectedWidth = Number(projected?.width) * width / 2;
  const projectedHeight = Number(projected?.height) * height / 2;
  const projectedSize = Math.max(projectedWidth, projectedHeight);
  const defaultSize = isLandscapePhone ? 142 : 190;
  const cueSize = clampNumber(
    projectedSize > 24 ? projectedSize : defaultSize,
    isLandscapePhone ? 108 : 132,
    isLandscapePhone ? 214 : 260
  );
  const minX = cueSize / 2 + 16;
  const maxX = width - cueSize / 2 - 16;
  const minY = cueSize / 2 + (isLandscapePhone ? 54 : 92);
  const maxY = height - cueSize / 2 - (isLandscapePhone ? 86 : 154);

  return {
    x: clampNumber(centerX, minX, maxX),
    y: clampNumber(centerY, minY, maxY),
    size: cueSize,
    viewportWidth: width,
    viewportHeight: height,
  };
}

function IconRotate360({ size = 18, color = '#fff', sw = 1.6 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path d="M3.5 11a7.5 7.5 0 0 1 13-5.2M18.5 11a7.5 7.5 0 0 1-13 5.2" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <path d="M16.6 3.4v3h-3M5.4 18.6v-3h3" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPinch({ size = 18, color = '#fff', sw = 1.6 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path d="M4 9V4h5M18 13v5h-5" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 4.5l5 5M17.5 17.5l-5-5" stroke={color} strokeWidth={sw} strokeLinecap="round" />
    </svg>
  );
}

function IconResetArrow({ size = 24, color = TOKENS.pink, sw = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M17.7 7.2A7 7 0 1 1 12 5" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <path d="M17.7 3.8v3.4h-3.4" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GestureTextChip({ icon, lang, zh, en, style = {} }) {
  const main = t(lang, zh, en);
  return (
    <div
      style={{
        position: 'absolute',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '8px 12px 8px 10px',
        borderRadius: 999,
        background: 'rgba(255,255,255,0.94)',
        border: '0.5px solid rgba(0,0,0,0.06)',
        color: 'rgba(24,24,28,0.9)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        boxShadow: '0 8px 22px rgba(0,0,0,0.14)',
        animation: 'ar-cue-pop 340ms cubic-bezier(.22,1,.36,1) both',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {icon}
      <span
        style={{
          fontFamily: langFont(lang),
          fontSize: 13,
          fontWeight: 800,
          lineHeight: 1,
        }}
      >
        {main}
      </span>
    </div>
  );
}

function ResetControl({ lang, isLandscapePhone, onReset }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: `calc(50% + ${isLandscapePhone ? 48 : 64}px)`,
        top: isLandscapePhone ? 0 : 2,
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: isLandscapePhone ? 6 : 8,
        pointerEvents: 'auto',
      }}
    >
      <button
        type="button"
        onClick={onReset}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        aria-label={t(lang, '一键还原', 'Tap to reset')}
        style={{
          width: isLandscapePhone ? 46 : 54,
          height: isLandscapePhone ? 46 : 54,
          borderRadius: 999,
          border: '0.5px solid rgba(255,255,255,0.14)',
          background: 'rgba(48,48,50,0.78)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          boxShadow: '0 10px 28px rgba(0,0,0,0.28)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        <IconResetArrow size={isLandscapePhone ? 21 : 24} />
      </button>
      <div
        style={{
          fontFamily: lang === 'en' ? FONT_MONO : langFont(lang),
          fontSize: lang === 'en' ? 9.5 : 11,
          fontWeight: lang === 'en' ? 800 : 700,
          lineHeight: 1,
          letterSpacing: 0,
          color: 'rgba(255,255,255,0.78)',
          textShadow: '0 1px 5px rgba(0,0,0,0.34)',
          whiteSpace: 'nowrap',
        }}
      >
        {t(lang, '一键还原', 'TAP TO RESET')}
      </div>
    </div>
  );
}

function TapPrompt({ anchor, lang, isLandscapePhone }) {
  const width = anchor.viewportWidth || 390;
  const height = anchor.viewportHeight || 844;
  const left = clampNumber(anchor.x - anchor.size * 0.54, 18, width - 132);
  const top = clampNumber(anchor.y + anchor.size * 0.2, isLandscapePhone ? 72 : 104, height - (isLandscapePhone ? 130 : 210));

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: 124,
        height: 82,
        color: 'rgba(255,255,255,0.94)',
        animation: 'ar-cue-pop 340ms cubic-bezier(.22,1,.36,1) both',
      }}
    >
      <svg width="124" height="82" viewBox="0 0 124 82" fill="none" aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <path d="M12 58 C38 39, 69 24, 108 10" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 7" />
        <path d="M99 7 L109 9 L104 18" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          fontFamily: langFont(lang),
          fontSize: 15,
          fontWeight: 900,
          lineHeight: 1,
          textShadow: '0 1px 3px rgba(0,0,0,0.36)',
        }}
      >
        {t(lang, '点我', 'tap me')}
      </div>
    </div>
  );
}

function InteractionCueLayer({ cue, anchor, lang, isLandscapePhone }) {
  if (cue === CUE_HIDDEN) return null;
  const isTap = cue === CUE_TAP;
  const isGestures = cue === CUE_GESTURES;
  const width = anchor.viewportWidth || 390;
  const height = anchor.viewportHeight || 844;
  const upperPill = {
    left: clampNumber(anchor.x + anchor.size * 0.18, 12, width - (lang === 'en' ? 156 : 116)),
    top: clampNumber(anchor.y - anchor.size * 0.42, isLandscapePhone ? 56 : 92, height - 184),
  };
  const lowerPill = {
    left: clampNumber(anchor.x - anchor.size * 0.56, 12, width - (lang === 'en' ? 168 : 118)),
    top: clampNumber(anchor.y + anchor.size * 0.36, isLandscapePhone ? 88 : 126, height - (isLandscapePhone ? 122 : 196)),
  };

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 16,
        pointerEvents: 'none',
      }}
    >
      <style>{`
        @keyframes ar-cue-pop {
          0% { opacity: 0; transform: scale(0.82) translateY(8px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      {isTap && <TapPrompt anchor={anchor} lang={lang} isLandscapePhone={isLandscapePhone} />}

      {isGestures && (
        <>
          <GestureTextChip
            icon={<IconRotate360 size={14} color="rgba(24,24,28,0.82)" sw={1.8} />}
            lang={lang}
            zh="拖动 · 360°"
            en="Drag · 360°"
            style={{
              left: upperPill.left,
              top: upperPill.top,
            }}
          />
          <GestureTextChip
            icon={<IconPinch size={14} color="rgba(24,24,28,0.82)" sw={1.8} />}
            lang={lang}
            zh="双指 · 缩放"
            en="Two-finger pinch"
            style={{
              left: lowerPill.left,
              top: lowerPill.top,
              animationDelay: '90ms',
            }}
          />
        </>
      )}
    </div>
  );
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
  const [framedPhoto, setFramedPhoto] = React.useState(null);
  const [interactionCue, setInteractionCue] = React.useState(CUE_HIDDEN);
  const [hasInteractedWithGlb, setHasInteractedWithGlb] = React.useState(false);
  const pointersRef = React.useRef(new Map());
  const gestureRef = React.useRef({ lastDistance: null, dragPointerId: null });
  const flashTimerRef = React.useRef(null);
  const debugMode = React.useMemo(readDebugFlag, []);
  const viewport = useViewport();
  const isLandscapePhone = viewport.orientation === 'landscape' && !viewport.isTablet && viewport.height < 520;
  const interactionAnchor = React.useMemo(
    () => resolveInteractionAnchor(diagnostics, viewport, isLandscapePhone),
    [diagnostics, isLandscapePhone, viewport]
  );

  const setCue = React.useCallback((nextCue) => {
    setInteractionCue(nextCue);
  }, []);

  const hideInteractionCue = React.useCallback(() => {
    setCue(CUE_HIDDEN);
  }, [setCue]);

  const markGlbInteracted = React.useCallback(() => {
    setHasInteractedWithGlb(true);
    setCue(CUE_GESTURES);
  }, [setCue]);

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
      setHasInteractedWithGlb(false);
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

  React.useEffect(() => {
    if (arPhase === 'final-live') {
      setCue(hasInteractedWithGlb ? CUE_GESTURES : CUE_TAP);
      return;
    }
    setCue(CUE_HIDDEN);
  }, [arPhase, hasInteractedWithGlb, setCue]);

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
  const shouldShowInteractionCue = !isCaptured && !isCapturing && canEdit;

  const clearCapturedPhoto = React.useCallback(() => {
    setCapturedPhoto((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
    setFramedPhoto((current) => {
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

    hideInteractionCue();
    setArPhase('capturing-frame');
    try {
      arAudio.playShutter();
      const next = await runtime?.freezeCurrentTarget?.();
      if (next) setFrozenState(next);
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
      const photo = isKivicubeRuntime(runtime) && runtime?.takePhoto
        ? await dataUrlToPhoto(await runtime.takePhoto())
        : await createARPhoto();
      let nextFramed = null;
      try {
        nextFramed = await createFramedARPhoto(photo, PHOTO_FRAME_URL);
      } catch (frameErr) {
        console.error('[EMO-AR] frame composition failed', frameErr);
      }
      clearCapturedPhoto();
      setCapturedPhoto(photo);
      setFramedPhoto(nextFramed);
      setArPhase('captured-frame');
    } catch (error) {
      console.error('[EMO-AR] capture failed', error);
      setArPhase('final-live');
    }
  }, [arPhase, clearCapturedPhoto, hideInteractionCue]);

  const resetFrozenTransform = React.useCallback((event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (arPhase !== 'final-live') return;
    const next = getARRuntime()?.resetFrozenTransform?.();
    if (next) setFrozenState(next);
  }, [arPhase]);

  const exitAR = React.useCallback(async () => {
    window.clearTimeout(flashTimerRef.current);
    clearCapturedPhoto();
    const runtime = getARRuntime();
    const next = await (runtime?.restartScan?.() || runtime?.hideFinalObject?.() || null);
    setFrozenState(next);
    window.__setProtoState?.('scan');
  }, [clearCapturedPhoto]);

  const goHome = React.useCallback(async () => {
    window.clearTimeout(flashTimerRef.current);
    clearCapturedPhoto();
    const runtime = getARRuntime();
    const next = await (runtime?.hideFinalObject?.() || null);
    if (next) setFrozenState(next);
    window.__setProtoState?.('landing');
  }, [clearCapturedPhoto]);

  const shareFrame = React.useCallback(async () => {
    const sharePhoto = framedPhoto || capturedPhoto;
    if (sharePhoto?.url) {
      const fileData = {
        title: 'EMO AR',
        text: lang === 'en' ? 'I found EMO in AR.' : '我在 AR 里遇见了一毛。',
        files: sharePhoto.file ? [sharePhoto.file] : [],
      };
      let canShareFile = false;
      try {
        canShareFile = Boolean(sharePhoto.file && navigator.canShare?.(fileData));
      } catch {}
      if (canShareFile && navigator.share) {
        try { await navigator.share(fileData); } catch {}
        return;
      }

      const link = document.createElement('a');
      link.href = sharePhoto.url;
      link.download = sharePhoto.file?.name || 'emo-ar-photo.png';
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
  }, [capturedPhoto, framedPhoto, lang]);

  const handlePointerDown = React.useCallback((event) => {
    if (!canEdit) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = Array.from(pointersRef.current.values());
    const runtime = getARRuntime();
    markGlbInteracted();
    if (points.length >= 2) {
      gestureRef.current.lastDistance = pointerDistance(points[0], points[1]);
      gestureRef.current.dragPointerId = null;
      runtime?.endFrozenDrag?.({ clampToViewport: false });
    } else {
      gestureRef.current.lastDistance = null;
      gestureRef.current.dragPointerId = event.pointerId;
      const state = runtime?.beginFrozenDrag?.({ pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY });
      if (state) setFrozenState(state);
    }
  }, [canEdit, markGlbInteracted]);

  const handlePointerMove = React.useCallback((event) => {
    if (!canEdit) return;
    const prev = pointersRef.current.get(event.pointerId);
    if (!prev) return;
    event.preventDefault();
    const next = { x: event.clientX, y: event.clientY };
    pointersRef.current.set(event.pointerId, next);
    const points = Array.from(pointersRef.current.values());

    if (points.length >= 2) {
      markGlbInteracted();
      const distance = pointerDistance(points[0], points[1]);
      const runtime = getARRuntime();
      let updatedState = null;
      if (gestureRef.current.lastDistance) {
        const scaleFactor = clampScaleFactor(distance / gestureRef.current.lastDistance);
        updatedState = runtime?.scaleFrozenBy?.({ scaleFactor }) || updatedState;
      }
      if (updatedState) setFrozenState(updatedState);
      gestureRef.current.lastDistance = distance;
      gestureRef.current.dragPointerId = null;
    } else if (points.length === 1) {
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      gestureRef.current.lastDistance = null;
      const runtime = getARRuntime();
      let updatedState = runtime?.dragFrozenToScreenPoint?.({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        clampToViewport: false,
      }) || null;
      if (dx || dy) {
        if (Math.hypot(dx, dy) > 0.4) markGlbInteracted();
        updatedState = runtime?.rotateFrozenBy?.({
          pointerDeltaX: dx,
          pointerDeltaY: dy,
          yawDelta: dx * SINGLE_FINGER_YAW_SENSITIVITY,
          pitchDelta: dy * SINGLE_FINGER_PITCH_SENSITIVITY,
        }) || updatedState;
      }
      if (updatedState) setFrozenState(updatedState);
    }
  }, [canEdit, markGlbInteracted]);

  const handlePointerUp = React.useCallback((event) => {
    const wasDragPointer = gestureRef.current.dragPointerId === event.pointerId;
    pointersRef.current.delete(event.pointerId);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const entries = Array.from(pointersRef.current.entries());
    const points = entries.map(([, point]) => point);
    const runtime = getARRuntime();
    if (wasDragPointer) {
      const state = runtime?.endFrozenDrag?.({ clampToViewport: true });
      if (state) setFrozenState(state);
    }
    if (points.length >= 2) {
      markGlbInteracted();
      gestureRef.current.lastDistance = pointerDistance(points[0], points[1]);
      gestureRef.current.dragPointerId = null;
    } else if (points.length === 1 && canEdit) {
      const [nextPointerId, point] = entries[0];
      gestureRef.current.lastDistance = null;
      gestureRef.current.dragPointerId = nextPointerId;
      const state = runtime?.beginFrozenDrag?.({ pointerId: nextPointerId, clientX: point.x, clientY: point.y });
      if (state) setFrozenState(state);
    } else {
      gestureRef.current.lastDistance = null;
      gestureRef.current.dragPointerId = null;
    }
  }, [canEdit, markGlbInteracted]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: 'transparent' }}>
      {capturedPhoto?.url && !isCaptured && !isCapturing && (
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
          aria-label="Drag to move and rotate EMO; pinch to scale"
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

      {shouldShowInteractionCue && (
        <InteractionCueLayer
          cue={interactionCue}
          anchor={interactionAnchor}
          lang={lang}
          isLandscapePhone={isLandscapePhone}
        />
      )}

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: `calc(var(--safe-bottom) + ${isLandscapePhone ? 18 : 80}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isLandscapePhone ? 8 : 14, pointerEvents: 'none', zIndex: 12 }}>
        {!isCaptured && !isCapturing && (arPhase === 'scanning-success' || arPhase === 'glb-entering') && (
          <div style={{ padding: '10px 16px', borderRadius: 999, background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '0.5px solid rgba(255,255,255,0.15)', fontFamily: langFont(lang), fontSize: 11, color: 'rgba(255,255,255,0.92)', maxWidth: 'min(84vw, 360px)', textAlign: 'center' }}>
            {t(lang, '一毛出现中…', 'EMO is appearing…')}
          </div>
        )}
        {isCaptured ? null : isLive ? (
          <div style={{ position: 'relative', width: isLandscapePhone ? 178 : 232, height: isLandscapePhone ? 72 : 88, pointerEvents: 'auto' }}>
            <button
              type="button"
              onClick={captureFrame}
              onPointerDown={hideInteractionCue}
              disabled={!isLive || isCapturing}
              style={{
                pointerEvents: 'auto',
                position: 'absolute',
                left: '50%',
                top: 0,
                transform: 'translateX(-50%)',
                width: isLandscapePhone ? 54 : 68,
                height: isLandscapePhone ? 54 : 68,
                borderRadius: 999,
                border: '5px solid rgba(255,255,255,0.94)',
                background: 'rgba(255,255,255,0.18)',
                cursor: isLive && !isCapturing ? 'pointer' : 'default',
                boxShadow: '0 0 0 3px rgba(255,255,255,0.24), 0 10px 28px rgba(0,0,0,0.42)',
                opacity: isLive && !isCapturing ? 1 : 0.55,
                transition: 'transform 220ms cubic-bezier(.22,1,.36,1), opacity 220ms ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              <div style={{ width: isLandscapePhone ? 34 : 46, height: isLandscapePhone ? 34 : 46, borderRadius: 999, background: '#fff' }} />
            </button>
            {canEdit && (
              <ResetControl
                lang={lang}
                isLandscapePhone={isLandscapePhone}
                onReset={resetFrozenTransform}
              />
            )}
          </div>
        ) : null}
      </div>

      {isCapturing && (
        <CapturingOverlay backdropUrl={capturedPhoto?.url} lang={lang} />
      )}

      {isCaptured && framedPhoto?.url && (
        <PolaroidPreviewOverlay
          backdropUrl={capturedPhoto?.url}
          framedPhotoUrl={framedPhoto.url}
          lang={lang}
          onHome={goHome}
          onRetake={captureFrame}
          onShare={shareFrame}
        />
      )}

      {debugMode && (
        <div style={{ position: 'absolute', top: 'calc(var(--safe-top) + 72px)', right: 'calc(var(--safe-right) + 12px)', zIndex: 18, padding: '8px 10px', borderRadius: 10, background: 'rgba(0,0,0,0.62)', border: '0.5px solid rgba(255,255,255,0.18)', fontFamily: FONT_MONO, fontSize: 9.5, lineHeight: 1.45, color: '#fff', textAlign: 'left', pointerEvents: 'none', maxWidth: 248 }}>
          <div>phase: <b style={{ color: TOKENS.green }}>{arPhase}</b></div>
          <div>ar: <b style={{ color: TOKENS.green }}>{diagnostics?.status || '-'}</b></div>
          <div>glb: <b style={{ color: TOKENS.green }}>{diagnostics?.glbPhase || '-'}</b> · mode {diagnostics?.contentMode || '-'}</div>
          <div>gesture: single-finger move/rotate + pinch scale</div>
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
          <div>targetNdc: {formatVector(diagnostics?.glbCenterTargetNdc, 2)}</div>
          <div>animFrames: {formatNumber(diagnostics?.animationStartFrame, 0)} to {formatNumber(diagnostics?.animationEndFrame, 0)}</div>
          <div>yaw/pitch: {formatNumber(diagnostics?.finalYaw, 1)} / {formatNumber(diagnostics?.finalPitch, 1)}</div>
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

function CapturingOverlay({ backdropUrl, lang }) {
  return (
    <div
      aria-live="polite"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 34,
        overflow: 'hidden',
        background: '#000',
        pointerEvents: 'auto',
      }}
    >
      {backdropUrl && (
        <img
          aria-hidden="true"
          src={backdropUrl}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            inset: '-12%',
            width: '124%',
            height: '124%',
            objectFit: 'cover',
            filter: 'blur(20px) brightness(1.05) saturate(1.05)',
          }}
        />
      )}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(80% 60% at 50% 50%, rgba(252,213,222,0.18) 0%, rgba(0,0,0,0) 70%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width: 168,
          height: 168,
          borderRadius: 28,
          background: 'rgba(40,38,40,0.86)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 58,
            height: 58,
            borderRadius: 999,
            border: '3.5px solid rgba(255,255,255,0.18)',
            borderTopColor: 'rgba(255,255,255,0.92)',
            animation: 'capture-spin 1s linear infinite',
          }}
        />
        <div
          style={{
            fontFamily: langFont(lang),
            fontSize: 15,
            fontWeight: 600,
            color: '#fff',
            letterSpacing: '0.06em',
          }}
        >
          {t(lang, '拍照中', 'Capturing')}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 90,
          textAlign: 'center',
          fontFamily: FONT_MONO,
          fontSize: 10,
          color: 'rgba(255,255,255,0.55)',
          letterSpacing: '0.18em',
        }}
      >
        {t(lang, '正在生成你的拍立得 · GENERATING POLAROID', 'GENERATING POLAROID · CREATING YOUR KEEPSAKE')}
      </div>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 38,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: 999,
            border: '5px solid rgba(255,255,255,0.64)',
            background: 'rgba(255,255,255,0.16)',
            opacity: 0.72,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: 46, height: 46, borderRadius: 999, background: 'rgba(255,255,255,0.78)' }} />
        </div>
      </div>
      <style>{`
        @keyframes capture-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function PolaroidPreviewOverlay({ backdropUrl, framedPhotoUrl, lang, onHome, onRetake, onShare }) {
  return (
    <div
      data-interactive="true"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 34,
        overflow: 'hidden',
        background: '#000',
        pointerEvents: 'auto',
      }}
    >
      {backdropUrl && (
        <img
          aria-hidden="true"
          src={backdropUrl}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            inset: '-12%',
            width: '124%',
            height: '124%',
            objectFit: 'cover',
            filter: 'blur(22px) brightness(1.05) saturate(1.05)',
          }}
        />
      )}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(255,247,240,0.12)',
        }}
      />
      <button
        type="button"
        aria-label={t(lang, '返回首页', 'Back home')}
        title={t(lang, '返回首页', 'Back home')}
        onClick={onHome}
        style={{
          position: 'absolute',
          top: 'calc(var(--safe-top) + 18px)',
          left: 'calc(var(--safe-left) + 18px)',
          zIndex: 38,
          width: 44,
          height: 44,
          borderRadius: 999,
          border: '0.5px solid rgba(255,255,255,0.58)',
          background: 'rgba(255,255,255,0.88)',
          color: TOKENS.ink,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 10px 28px rgba(0,0,0,0.18)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          cursor: 'pointer',
        }}
      >
        <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M3.25 8.75 10 3l6.75 5.75" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.2 8.25v7.2c0 .55.45 1 1 1h7.6c.55 0 1-.45 1-1v-7.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8.25 16.35v-4.1c0-.42.34-.75.75-.75h2c.41 0 .75.33.75.75v4.1" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 'min(78vw, 320px)',
          aspectRatio: '1080 / 1920',
          transform: 'translate(-50%, -52%)',
          animation: 'polaroid-in 700ms cubic-bezier(.22,1,.36,1) both',
          filter: 'none',
          pointerEvents: 'none',
        }}
      >
        <img
          src={framedPhotoUrl}
          alt=""
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: `calc(var(--safe-bottom) + 38px)`,
          display: 'flex',
          gap: 10,
          pointerEvents: 'auto',
        }}
      >
        <ActionPill
          variant="ghost"
          lang={lang}
          zh="重新拍照"
          en="Retake"
          onClick={onRetake}
          icon={(
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7a5 5 0 1 0 1.5-3.5M2 2v3h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none"/>
            </svg>
          )}
        />
        <ActionPill
          variant="primary"
          lang={lang}
          zh="分享"
          en="Share"
          onClick={onShare}
          icon={(
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1.5v8M4 4.5l3-3 3 3M2 9v3h10V9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          )}
        />
      </div>
      <style>{`
        @keyframes polaroid-in {
          0%   { opacity: 0; transform: translate(-50%, -52%) scale(0.6); }
          60%  { opacity: 1; transform: translate(-50%, -52%) scale(1.04); }
          100% { opacity: 1; transform: translate(-50%, -52%) scale(1); }
        }
      `}</style>
    </div>
  );
}

function ActionPill({ variant = 'primary', lang, zh, en, onClick, icon }) {
  const label = t(lang, zh, en);
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '14px 16px',
        borderRadius: 999,
        border: 'none',
        background: TOKENS.ink,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        cursor: 'pointer',
        boxShadow: '0 10px 28px rgba(0,0,0,0.22)',
      }}
    >
      {icon}
      <span style={{ display: 'inline-flex', alignItems: 'baseline' }}>
        <span style={{ fontFamily: langFont(lang), fontSize: 14, fontWeight: 700, letterSpacing: '0.02em' }}>
          {label}
        </span>
      </span>
    </button>
  );
}
