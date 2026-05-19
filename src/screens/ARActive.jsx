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
const COACHMARK_MS = 1500;
const TAP_REVEAL_MS = 2500;
const CUE_IDLE = 'idle';
const CUE_COACHMARK = 'coachmark';
const CUE_REVEALED = 'revealed';
const CUE_ROTATING = 'rotating';
const CUE_SCALING = 'scaling';
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

function IconExpand({ size = 18, color = '#fff', sw = 1.6 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path d="M3 8V3h5M19 14v5h-5M14 3h5v5M8 19H3v-5" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GestureTextChip({ icon, lang, zh, en, caption, style = {} }) {
  const main = t(lang, zh, en);
  return (
    <div
      style={{
        position: 'absolute',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 11px 7px 9px',
        borderRadius: 999,
        background: 'rgba(0,0,0,0.54)',
        border: '0.5px solid rgba(255,255,255,0.16)',
        color: '#fff',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        boxShadow: '0 6px 18px rgba(0,0,0,0.2)',
        animation: 'ar-cue-pop 340ms cubic-bezier(.22,1,.36,1) both',
        ...style,
      }}
    >
      {icon}
      <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <span
          style={{
            fontFamily: langFont(lang),
            fontSize: 10.5,
            fontWeight: 700,
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          {main}
        </span>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 7.5,
            fontWeight: 800,
            color: 'rgba(255,255,255,0.62)',
            letterSpacing: 0,
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          {caption}
        </span>
      </span>
    </div>
  );
}

function GestureHintRail({ lang, isLandscapePhone }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: `calc(var(--safe-bottom) + ${isLandscapePhone ? 86 : 126}px)`,
        transform: 'translateX(-50%)',
        width: 'fit-content',
        maxWidth: 'min(82vw, 360px)',
        minHeight: 36,
        padding: '7px 12px 7px 10px',
        borderRadius: 999,
        background: 'rgba(255,255,255,0.16)',
        border: '0.5px solid rgba(255,255,255,0.22)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        color: '#fff',
        boxShadow: '0 10px 28px rgba(0,0,0,0.18)',
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.18)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 auto',
        }}
      >
        <IconExpand size={12} />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 7,
          flexWrap: 'wrap',
          fontFamily: langFont(lang),
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1.15,
          textShadow: '0 1px 3px rgba(0,0,0,0.36)',
          minWidth: 0,
        }}
      >
        <span>{t(lang, '点击一毛开始互动', 'Tap EMO to play')}</span>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 8.5,
            fontWeight: 700,
            opacity: 0.68,
            letterSpacing: 0,
          }}
        >
          TAP TO PLAY
        </span>
      </div>
    </div>
  );
}

function InteractionCueLayer({ cue, anchor, lang, isLandscapePhone }) {
  if (cue === CUE_HIDDEN) return null;
  const isCoachmark = cue === CUE_COACHMARK;
  const isIdle = cue === CUE_IDLE;
  const isRevealed = cue === CUE_REVEALED;
  const isRotating = cue === CUE_ROTATING;
  const isScaling = cue === CUE_SCALING;

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
        @keyframes ar-cue-breathe {
          0%, 100% { opacity: 0.46; transform: scale(0.98); }
          50% { opacity: 0.9; transform: scale(1.035); }
        }
        @keyframes ar-cue-pop {
          0% { opacity: 0; transform: scale(0.82) translateY(8px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes ar-cue-orbit {
          to { transform: rotate(360deg); }
        }
        @keyframes ar-cue-fade {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>

      {isCoachmark && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 50% 45%, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.22) 72%)',
            animation: 'ar-cue-fade 260ms ease-out both',
          }}
        />
      )}

      <div
        style={{
          position: 'absolute',
          left: anchor.x,
          top: anchor.y,
          width: anchor.size,
          height: anchor.size,
          transform: 'translate(-50%, -50%)',
        }}
      >
        {(isCoachmark || isIdle) && (
          <>
            <div
              style={{
                position: 'absolute',
                inset: '-6%',
                borderRadius: '50%',
                border: `1.5px dashed ${isCoachmark ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.52)'}`,
                boxShadow: isCoachmark ? `0 0 24px ${TOKENS.pink}44` : 'none',
                animation: 'ar-cue-breathe 2.4s ease-in-out infinite',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 2,
                right: 5,
                transform: 'translate(28%, -20%)',
                width: 28,
                height: 28,
                borderRadius: 999,
                background: 'rgba(0,0,0,0.48)',
                border: '0.5px solid rgba(255,255,255,0.18)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 16px rgba(0,0,0,0.22)',
              }}
            >
              <IconRotate360 size={14} />
            </div>
          </>
        )}

        {isRotating && (
          <>
            <svg
              viewBox="0 0 120 120"
              style={{
                position: 'absolute',
                inset: '-13%',
                width: '126%',
                height: '126%',
                overflow: 'visible',
              }}
            >
              <circle cx="60" cy="60" r="52" stroke="rgba(255,255,255,0.18)" strokeWidth="1" fill="none" strokeDasharray="3 6" />
              <g style={{ transformOrigin: '60px 60px', animation: 'ar-cue-orbit 1.2s linear infinite' }}>
                <circle cx="60" cy="60" r="52" stroke={TOKENS.pink} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeDasharray="74 253" />
              </g>
            </svg>
            <div
              style={{
                position: 'absolute',
                left: -13,
                top: '52%',
                width: 40,
                height: 40,
                borderRadius: 999,
                background: 'radial-gradient(closest-side, rgba(255,255,255,0.56), rgba(255,255,255,0))',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 2,
                top: '56%',
                width: 14,
                height: 14,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.92)',
                boxShadow: '0 0 0 5px rgba(255,255,255,0.18)',
              }}
            />
            <svg style={{ position: 'absolute', left: 20, top: '47%', width: 64, height: 32 }} viewBox="0 0 64 32">
              <path d="M 2 17 Q 28 2, 56 16" stroke={TOKENS.pink} strokeWidth="2.2" fill="none" strokeLinecap="round" />
              <path d="M 51 10 L 59 16 L 51 22" stroke={TOKENS.pink} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        )}

        {isScaling && (
          <>
            <div
              style={{
                position: 'absolute',
                inset: '-8%',
                borderRadius: '50%',
                border: `1px solid ${TOKENS.pink}88`,
                boxShadow: `0 0 26px ${TOKENS.pink}33`,
              }}
            />
            {[
              { x: -0.38, y: -0.38, rot: 0 },
              { x: 0.38, y: -0.38, rot: 90 },
              { x: 0.38, y: 0.38, rot: 180 },
              { x: -0.38, y: 0.38, rot: 270 },
            ].map((point, index) => (
              <svg
                key={index}
                width="24"
                height="24"
                viewBox="0 0 22 22"
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: `translate(${anchor.size * point.x - 12}px, ${anchor.size * point.y - 12}px) rotate(${point.rot}deg)`,
                }}
              >
                <path d="M2 8V2h6M8 2L2 8" stroke={TOKENS.pink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            ))}
            <div
              style={{
                position: 'absolute',
                left: -26,
                top: -24,
                width: 16,
                height: 16,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.92)',
                boxShadow: '0 0 0 6px rgba(255,255,255,0.18)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                right: -26,
                bottom: -24,
                width: 16,
                height: 16,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.92)',
                boxShadow: '0 0 0 6px rgba(255,255,255,0.18)',
              }}
            />
          </>
        )}
      </div>

      {isRevealed && (
        <div
          style={{
            position: 'absolute',
            right: 'calc(var(--safe-right) + 16px)',
            bottom: `calc(var(--safe-bottom) + ${isLandscapePhone ? 76 : 126}px)`,
            maxWidth: 'calc(100vw - 32px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
            gap: 6,
            animation: 'ar-cue-pop 340ms cubic-bezier(.22,1,.36,1) both',
          }}
        >
          <GestureTextChip
            icon={<IconRotate360 size={13} />}
            lang={lang}
            zh="拖动旋转"
            en="Drag to rotate"
            caption="DRAG"
            style={{ position: 'relative' }}
          />
          <GestureTextChip
            icon={<IconPinch size={13} />}
            lang={lang}
            zh="捏合缩放"
            en="Pinch to scale"
            caption="PINCH"
            style={{ position: 'relative', animationDelay: '90ms' }}
          />
        </div>
      )}

      {(isCoachmark || isIdle) && (
        <GestureHintRail lang={lang} isLandscapePhone={isLandscapePhone} />
      )}

      {isCoachmark && (
        <>
          <div
            style={{
              position: 'absolute',
              right: 'calc(var(--safe-right) + 16px)',
              top: 'calc(var(--safe-top) + 66px)',
              fontFamily: FONT_MONO,
              fontSize: 8.5,
              color: 'rgba(255,255,255,0.62)',
              letterSpacing: 0,
              textShadow: '0 1px 3px rgba(0,0,0,0.34)',
            }}
          >
            1.5s · TAP TO SKIP
          </div>
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
  const pointersRef = React.useRef(new Map());
  const gestureRef = React.useRef({ lastDistance: null, dragPointerId: null });
  const flashTimerRef = React.useRef(null);
  const cueTimerRef = React.useRef(null);
  const interactionCueRef = React.useRef(CUE_HIDDEN);
  const hasShownCoachmarkRef = React.useRef(false);
  const hasCompletedGestureRef = React.useRef(false);
  const gestureHadMotionRef = React.useRef(false);
  const debugMode = React.useMemo(readDebugFlag, []);
  const viewport = useViewport();
  const isLandscapePhone = viewport.orientation === 'landscape' && !viewport.isTablet && viewport.height < 520;
  const interactionAnchor = React.useMemo(
    () => resolveInteractionAnchor(diagnostics, viewport, isLandscapePhone),
    [diagnostics, isLandscapePhone, viewport]
  );
  const isActiveGestureCue = interactionCue === CUE_ROTATING || interactionCue === CUE_SCALING;

  const clearCueTimer = React.useCallback(() => {
    window.clearTimeout(cueTimerRef.current);
    cueTimerRef.current = null;
  }, []);

  const setCue = React.useCallback((nextCue) => {
    interactionCueRef.current = nextCue;
    setInteractionCue(nextCue);
  }, []);

  const scheduleCue = React.useCallback((nextCue, delayMs) => {
    clearCueTimer();
    cueTimerRef.current = window.setTimeout(() => {
      if (!hasCompletedGestureRef.current) setCue(nextCue);
    }, delayMs);
  }, [clearCueTimer, setCue]);

  const showTapReveal = React.useCallback(() => {
    if (hasCompletedGestureRef.current) return;
    setCue(CUE_REVEALED);
    scheduleCue(CUE_IDLE, TAP_REVEAL_MS);
  }, [scheduleCue, setCue]);

  const hideInteractionCue = React.useCallback(() => {
    clearCueTimer();
    setCue(CUE_HIDDEN);
  }, [clearCueTimer, setCue]);

  const markGestureCompleted = React.useCallback(() => {
    if (!hasCompletedGestureRef.current) {
      hasCompletedGestureRef.current = true;
    }
    gestureHadMotionRef.current = true;
    clearCueTimer();
  }, [clearCueTimer]);

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

  React.useEffect(() => {
    const shouldPrimeCue = arPhase === 'glb-entering' || arPhase === 'final-live';
    if (!shouldPrimeCue) {
      hideInteractionCue();
      return;
    }
    if (hasCompletedGestureRef.current) {
      setCue(CUE_HIDDEN);
      return;
    }
    if (!hasShownCoachmarkRef.current) {
      hasShownCoachmarkRef.current = true;
      setCue(CUE_COACHMARK);
      scheduleCue(CUE_IDLE, COACHMARK_MS);
      return;
    }
    if (interactionCueRef.current === CUE_HIDDEN) {
      setCue(CUE_IDLE);
    }
  }, [arPhase, hideInteractionCue, scheduleCue, setCue]);

  React.useEffect(() => {
    interactionCueRef.current = interactionCue;
  }, [interactionCue]);

  React.useEffect(() => () => {
    clearCueTimer();
  }, [clearCueTimer]);

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
  const shouldShowInteractionCue = !isCaptured && !isCapturing && (arPhase === 'glb-entering' || canEdit);

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
    if (points.length >= 2) {
      clearCueTimer();
      setCue(CUE_SCALING);
      gestureRef.current.lastDistance = pointerDistance(points[0], points[1]);
      gestureRef.current.dragPointerId = null;
      runtime?.endFrozenDrag?.({ clampToViewport: false });
    } else {
      gestureHadMotionRef.current = false;
      showTapReveal();
      gestureRef.current.lastDistance = null;
      gestureRef.current.dragPointerId = event.pointerId;
      const state = runtime?.beginFrozenDrag?.({ pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY });
      if (state) setFrozenState(state);
    }
  }, [canEdit, clearCueTimer, setCue, showTapReveal]);

  const handlePointerMove = React.useCallback((event) => {
    if (!canEdit) return;
    const prev = pointersRef.current.get(event.pointerId);
    if (!prev) return;
    event.preventDefault();
    const next = { x: event.clientX, y: event.clientY };
    pointersRef.current.set(event.pointerId, next);
    const points = Array.from(pointersRef.current.values());

    if (points.length >= 2) {
      setCue(CUE_SCALING);
      const distance = pointerDistance(points[0], points[1]);
      const runtime = getARRuntime();
      let updatedState = null;
      if (gestureRef.current.lastDistance) {
        if (Math.abs(distance - gestureRef.current.lastDistance) > 0.4) {
          markGestureCompleted();
        }
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
        if (Math.hypot(dx, dy) > 0.4) {
          setCue(CUE_ROTATING);
          markGestureCompleted();
        }
        updatedState = runtime?.rotateFrozenBy?.({
          pointerDeltaX: dx,
          pointerDeltaY: dy,
          yawDelta: dx * SINGLE_FINGER_YAW_SENSITIVITY,
          pitchDelta: dy * SINGLE_FINGER_PITCH_SENSITIVITY,
        }) || updatedState;
      }
      if (updatedState) setFrozenState(updatedState);
    }
  }, [canEdit, markGestureCompleted, setCue]);

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
      setCue(CUE_SCALING);
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
      if (points.length === 0 && canEdit) {
        if (hasCompletedGestureRef.current || gestureHadMotionRef.current) {
          hideInteractionCue();
        } else if (interactionCueRef.current !== CUE_REVEALED) {
          setCue(CUE_IDLE);
        }
      }
    }
  }, [canEdit, hideInteractionCue, setCue]);

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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto' }}>
            <button
              type="button"
              onClick={captureFrame}
              onPointerDown={hideInteractionCue}
              disabled={!isLive || isCapturing}
              style={{
                pointerEvents: 'auto',
                width: isLandscapePhone ? 54 : 68,
                height: isLandscapePhone ? 54 : 68,
                borderRadius: 999,
                border: '5px solid rgba(255,255,255,0.94)',
                background: 'rgba(255,255,255,0.18)',
                cursor: isLive && !isCapturing ? 'pointer' : 'default',
                boxShadow: '0 0 0 3px rgba(255,255,255,0.24), 0 10px 28px rgba(0,0,0,0.42)',
                opacity: isActiveGestureCue ? 0.58 : isLive && !isCapturing ? 1 : 0.55,
                transform: `scale(${isActiveGestureCue ? 0.92 : 1})`,
                transition: 'transform 220ms cubic-bezier(.22,1,.36,1), opacity 220ms ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              <div style={{ width: isLandscapePhone ? 34 : 46, height: isLandscapePhone ? 34 : 46, borderRadius: 999, background: '#fff' }} />
            </button>
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
