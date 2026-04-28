import React from 'react';
import { LangChip, FrostButton, TOKENS, FONT_MONO, langFont, t } from '../components/ui.jsx';
import { arAudio } from '../lib/arAudio.js';
import { introFrameUrls, preloadUrls } from '../lib/step06Assets.js';
import { useViewport } from '../lib/viewport.js';
import { clampScaleFactor, normalizeAngleDelta, pointerAngle, pointerDistance } from '../ar/frozenControls.js';

const FLASH_MS = 240;

function formatVector(value, digits = 2) {
  if (!value) return '-';
  return `${value.x.toFixed(digits)}, ${value.y.toFixed(digits)}, ${value.z.toFixed(digits)}`;
}

function readDebugFlag() {
  try {
    return new URLSearchParams(window.location.search).get('debug') === '1';
  } catch {
    return false;
  }
}

export function ARActive({ lang = 'zh', setLang, diagnostics }) {
  const [arPhase, setArPhase] = React.useState('scanning-success');
  const [frozenState, setFrozenState] = React.useState(() => window.__mindar?.getFrozenState?.() || null);
  const [spriteState, setSpriteState] = React.useState(() => window.__mindar?.getSpriteState?.() || null);
  const pointersRef = React.useRef(new Map());
  const gestureRef = React.useRef({ lastAngle: null, lastDistance: null });
  const flashTimerRef = React.useRef(null);
  const debugMode = React.useMemo(readDebugFlag, []);
  const viewport = useViewport();

  React.useEffect(() => {
    preloadUrls(introFrameUrls);
  }, []);

  // Drive the scanning-success → sprite-entering → final-live transition on mount.
  React.useEffect(() => {
    const mindar = window.__mindar;
    if (!mindar) return undefined;
    let cancelled = false;
    const target = mindar.getLastTarget?.() || mindar.getActiveTargets?.()?.[0] || null;
    const targetIndex = target?.targetIndex;
    setArPhase('scanning-success');
    flashTimerRef.current = window.setTimeout(() => {
      if (cancelled) return;
      setArPhase('sprite-entering');
      arAudio.cueARIntro();
      mindar.playSpriteIntro?.(targetIndex).then(() => {
        if (cancelled) return;
        setArPhase('final-live');
        setSpriteState(mindar.getSpriteState?.() || null);
      });
    }, FLASH_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(flashTimerRef.current);
    };
  }, []);

  // On unmount, reset frozen object & sprite state so the scene is clean if user re-enters.
  React.useEffect(() => () => {
    window.__mindar?.hideFinalObject?.();
  }, []);

  // Subscribe to MindAR status changes for the lost-grace UI ("losing", "lost").
  React.useEffect(() => {
    const mindar = window.__mindar;
    if (!mindar?.onStatus) return undefined;
    const off = mindar.onStatus((status) => {
      if (status === 'lost') {
        // Long loss → bounce back to scanner.
        window.__setProtoState?.('scan');
      }
    });
    return () => { off?.(); };
  }, []);

  const isCaptured = arPhase === 'captured-frame';
  const isLive = arPhase === 'final-live' || isCaptured;
  const isLosing = diagnostics?.status === 'losing' && isLive && !isCaptured;
  const isLandscapePhone = viewport.orientation === 'landscape' && !viewport.isTablet && viewport.height < 520;

  const captureFrame = React.useCallback(() => {
    setArPhase((current) => {
      if (current === 'captured-frame') {
        const next = window.__mindar?.unfreezeCurrentTarget?.();
        if (next) setFrozenState(next);
        return 'final-live';
      }
      arAudio.playShutter();
      const next = window.__mindar?.freezeCurrentTarget?.();
      if (next) setFrozenState(next);
      return 'captured-frame';
    });
  }, []);

  const exitAR = React.useCallback(() => {
    window.clearTimeout(flashTimerRef.current);
    const next = window.__mindar?.hideFinalObject?.() || null;
    setFrozenState(next);
    window.__setProtoState?.('scan');
  }, []);

  const shareFrame = React.useCallback(async () => {
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
  }, [lang]);

  const handlePointerDown = React.useCallback((event) => {
    if (!isLive) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = Array.from(pointersRef.current.values());
    if (points.length >= 2) {
      gestureRef.current.lastAngle = pointerAngle(points[0], points[1]);
      gestureRef.current.lastDistance = pointerDistance(points[0], points[1]);
    } else {
      gestureRef.current.lastAngle = null;
      gestureRef.current.lastDistance = null;
    }
  }, [isLive]);

  const handlePointerMove = React.useCallback((event) => {
    if (!isLive) return;
    const prev = pointersRef.current.get(event.pointerId);
    if (!prev) return;
    event.preventDefault();
    const next = { x: event.clientX, y: event.clientY };
    pointersRef.current.set(event.pointerId, next);
    const points = Array.from(pointersRef.current.values());

    if (points.length >= 2) {
      const angle = pointerAngle(points[0], points[1]);
      const distance = pointerDistance(points[0], points[1]);
      if (gestureRef.current.lastAngle != null) {
        const yawDelta = -normalizeAngleDelta(angle - gestureRef.current.lastAngle);
        if (isCaptured) {
          const r = window.__mindar?.rotateFrozenBy?.({ yawDelta });
          if (r) setFrozenState(r);
        } else {
          window.__mindar?.rotateLiveBy?.({ yawDelta });
        }
      }
      if (gestureRef.current.lastDistance && isCaptured) {
        const scaleFactor = clampScaleFactor(distance / gestureRef.current.lastDistance);
        const r = window.__mindar?.scaleFrozenBy?.({ scaleFactor });
        if (r) setFrozenState(r);
      }
      gestureRef.current.lastAngle = angle;
      gestureRef.current.lastDistance = distance;
    } else if (points.length === 1 && isCaptured) {
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const r = window.__mindar?.moveFrozenByScreenDelta?.({ dx, dy });
      if (r) setFrozenState(r);
    }
  }, [isLive, isCaptured]);

  const handlePointerUp = React.useCallback((event) => {
    pointersRef.current.delete(event.pointerId);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (pointersRef.current.size < 2) {
      gestureRef.current.lastAngle = null;
      gestureRef.current.lastDistance = null;
    }
  }, []);

  // Poll sprite state for diagnostics overlay (debug only).
  React.useEffect(() => {
    if (!debugMode) return undefined;
    const id = window.setInterval(() => {
      setSpriteState(window.__mindar?.getSpriteState?.() || null);
    }, 250);
    return () => window.clearInterval(id);
  }, [debugMode]);

  const capturedFrameStyle = {
    position: 'absolute',
    left: '50%',
    top: isLandscapePhone ? 'calc(var(--safe-top) + 74px)' : 'calc(var(--safe-top) + 138px)',
    bottom: isLandscapePhone ? 'calc(var(--safe-bottom) + 78px)' : 'calc(var(--safe-bottom) + 188px)',
    transform: 'translateX(-50%)',
    width: 'min(78vw, 560px)',
    borderRadius: 'clamp(20px, 6vw, 34px)',
    border: 'clamp(8px, 3vw, 14px) solid rgba(255,255,255,0.96)',
    boxShadow: '0 28px 60px rgba(0,0,0,0.28), inset 0 0 0 clamp(6px, 2vw, 10px) rgba(244,183,200,0.9)',
    pointerEvents: 'none',
  };

  const flashOpacity = arPhase === 'scanning-success' ? 0.85 : 0;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: 'transparent' }}>
      {/* Scanning-success flash: short, screen-wide, fades quickly. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(closest-side, rgba(255,255,255,0.85), rgba(244,183,200,0.4) 55%, rgba(244,183,200,0) 75%)',
          opacity: flashOpacity,
          transition: `opacity ${FLASH_MS}ms ease-out`,
          pointerEvents: 'none',
          zIndex: 6,
        }}
      />

      <div className="top-controls">
        <FrostButton onClick={exitAR} title={t(lang, '返回扫描', 'Back to scan')}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M10 2L4 7l6 5" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>
        </FrostButton>
        <LangChip lang={lang} onToggle={setLang} light />
      </div>

      {(isLive || arPhase === 'sprite-entering') && (
        <div
          data-interactive="true"
          aria-label={isCaptured ? 'Drag to move EMO; pinch to scale; twist with two fingers to rotate' : 'Twist with two fingers to rotate EMO'}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            position: 'absolute',
            left: isCaptured ? '11vw' : 0,
            right: isCaptured ? '11vw' : 0,
            top: isCaptured ? capturedFrameStyle.top : 'calc(var(--safe-top) + 96px)',
            bottom: isCaptured ? capturedFrameStyle.bottom : 'calc(var(--safe-bottom) + 220px)',
            zIndex: 4,
            pointerEvents: 'auto',
            touchAction: 'none',
            cursor: 'grab',
          }}
        />
      )}

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: `calc(var(--safe-bottom) + ${isLandscapePhone ? 18 : 80}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isLandscapePhone ? 8 : 14, pointerEvents: 'none', zIndex: 12 }}>
        <div style={{ padding: '10px 16px', borderRadius: 999, background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '0.5px solid rgba(255,255,255,0.15)', fontFamily: langFont(lang), fontSize: 11, color: 'rgba(255,255,255,0.92)', maxWidth: 'min(84vw, 360px)', textAlign: 'center' }}>
          {isLosing
            ? t(lang, '请移回目标…', 'Move back to the target…')
            : arPhase === 'scanning-success' || arPhase === 'sprite-entering'
              ? t(lang, '一毛出现中…', 'EMO is appearing…')
              : isCaptured
                ? t(lang, '单指拖动 · 双指旋转 / 缩放一毛', 'Drag · twist / pinch EMO')
                : t(lang, '双指旋转一毛 · 拍下并分享', 'Twist with two fingers · Capture & share')}
        </div>
        {isCaptured ? (
          <div style={{ display: 'flex', gap: 12, pointerEvents: 'auto' }}>
            <button type="button" onClick={captureFrame} style={actionButtonStyle(lang)}>{t(lang, '重新拍照', 'Retake')}</button>
            <button type="button" onClick={shareFrame} style={actionButtonStyle(lang)}>{t(lang, '分享好友', 'Share')}</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={captureFrame}
            disabled={!isLive}
            style={{
              pointerEvents: 'auto',
              width: isLandscapePhone ? 54 : 68,
              height: isLandscapePhone ? 54 : 68,
              borderRadius: 999,
              border: '3px solid #fff',
              background: TOKENS.pink,
              cursor: isLive ? 'pointer' : 'default',
              boxShadow: '0 0 0 2px rgba(255,255,255,0.3), 0 10px 28px rgba(0,0,0,0.42)',
              opacity: isLive ? 1 : 0.55,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            <div style={{ width: 20, height: 20, borderRadius: 999, background: '#fff' }} />
          </button>
        )}
      </div>

      {isCaptured && <div style={capturedFrameStyle} />}

      {debugMode && (
        <div style={{ position: 'absolute', top: 'calc(var(--safe-top) + 72px)', right: 'calc(var(--safe-right) + 12px)', zIndex: 18, padding: '8px 10px', borderRadius: 10, background: 'rgba(0,0,0,0.62)', border: '0.5px solid rgba(255,255,255,0.18)', fontFamily: FONT_MONO, fontSize: 9.5, lineHeight: 1.45, color: '#fff', textAlign: 'left', pointerEvents: 'none', maxWidth: 220 }}>
          <div>phase: <b style={{ color: TOKENS.green }}>{arPhase}</b></div>
          <div>mindar: <b style={{ color: TOKENS.green }}>{diagnostics?.status || '-'}</b></div>
          <div>sprite: <b style={{ color: TOKENS.green }}>{spriteState?.phase || '-'}</b> · frame {spriteState?.frameIndex ?? 0}</div>
          <div>activeTarget: {spriteState?.activeTargetIndex ?? '-'}</div>
          <div>edit: <b style={{ color: frozenState?.active ? TOKENS.green : TOKENS.pinkDeep }}>{String(!!frozenState?.active)}</b></div>
          {frozenState && (
            <>
              <div>pos: {formatVector(frozenState.position)}</div>
              <div>rot: {formatVector(frozenState.rotation, 0)}</div>
              <div>scale: {formatVector(frozenState.scale)}</div>
            </>
          )}
          {diagnostics?.modelError && <div style={{ color: '#ffbac8' }}>model-error</div>}
        </div>
      )}
    </div>
  );
}

function actionButtonStyle(lang) {
  return {
    minWidth: 112,
    height: 42,
    borderRadius: 999,
    border: 'none',
    background: '#1F1A1F',
    color: '#FAF6F1',
    fontFamily: langFont(lang),
    fontSize: 13,
    fontWeight: 800,
    boxShadow: '0 10px 28px rgba(0,0,0,0.28)',
    cursor: 'pointer',
  };
}
