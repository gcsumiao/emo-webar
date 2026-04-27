import React from 'react';
import { IOSStatusBar, LangChip, FrostButton, TOKENS, FONT_MONO, langFont, t } from '../components/ui.jsx';
import { Step06SequencePlayer } from '../components/SequencePlayer.jsx';
import { arAudio } from '../lib/arAudio.js';
import { introDurationMs, introFrameUrls, preloadUrls } from '../lib/step06Assets.js';
import { useViewport } from '../lib/viewport.js';
import { clampScaleFactor, normalizeAngleDelta, pointerAngle, pointerDistance } from '../ar/frozenControls.js';

function formatVector(value, digits = 2) {
  if (!value) return '-';
  return `${value.x.toFixed(digits)}, ${value.y.toFixed(digits)}, ${value.z.toFixed(digits)}`;
}

export function ARActive({ lang = 'zh', setLang, diagnostics }) {
  const [arPhase, setArPhase] = React.useState('intro-playing');
  const [frozenState, setFrozenState] = React.useState(() => window.__mindar?.getFrozenState?.() || null);
  const pointersRef = React.useRef(new Map());
  const gestureRef = React.useRef({ lastAngle: null, lastDistance: null });
  const viewport = useViewport();

  React.useEffect(() => {
    preloadUrls(introFrameUrls);
  }, []);

  React.useEffect(() => () => {
    window.__mindar?.unfreezeCurrentTarget?.();
  }, []);

  const isCaptured = arPhase === 'captured-frame';
  const isLive = arPhase === 'final-live' || isCaptured;
  const isLandscapePhone = viewport.orientation === 'landscape' && !viewport.isTablet && viewport.height < 520;

  const captureFrame = React.useCallback(() => {
    setArPhase((current) => {
      if (current === 'captured-frame') {
        const nextFrozenState = window.__mindar?.unfreezeCurrentTarget?.() || null;
        setFrozenState(nextFrozenState);
        console.info('[EMO-AR] unfreeze', nextFrozenState);
        return 'final-live';
      }
      arAudio.playShutter();
      const nextFrozenState = window.__mindar?.freezeCurrentTarget?.() || null;
      setFrozenState(nextFrozenState);
      console.info('[EMO-AR] freeze', nextFrozenState);
      return 'captured-frame';
    });
  }, []);

  const exitAR = React.useCallback(() => {
    window.__mindar?.unfreezeCurrentTarget?.();
    window.__setProtoState?.('landing');
  }, []);

  const shareFrame = React.useCallback(async () => {
    const shareData = {
      title: 'EMO AR',
      text: lang === 'en' ? 'I found EMO in AR.' : '我在 AR 里遇见了一毛。',
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {}
      return;
    }
    try {
      await navigator.clipboard?.writeText?.(shareData.url);
    } catch {}
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
          const nextFrozenState = window.__mindar?.rotateFrozenBy?.({ yawDelta });
          if (nextFrozenState) setFrozenState(nextFrozenState);
        } else {
          window.__mindar?.rotateLiveBy?.({ yawDelta });
        }
      }
      if (isCaptured && gestureRef.current.lastDistance) {
        const scaleFactor = clampScaleFactor(distance / gestureRef.current.lastDistance);
        const nextFrozenState = window.__mindar?.scaleFrozenBy?.({ scaleFactor });
        if (nextFrozenState) setFrozenState(nextFrozenState);
      }
      gestureRef.current.lastAngle = angle;
      gestureRef.current.lastDistance = distance;
    } else if (points.length === 1 && isCaptured) {
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const nextFrozenState = window.__mindar?.moveFrozenByScreenDelta?.({ dx, dy });
      if (nextFrozenState) setFrozenState(nextFrozenState);
    }
  }, [isCaptured, isLive]);

  const handlePointerUp = React.useCallback((event) => {
    pointersRef.current.delete(event.pointerId);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (pointersRef.current.size < 2) {
      gestureRef.current.lastAngle = null;
      gestureRef.current.lastDistance = null;
    }
  }, []);

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

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: 'transparent' }}>
      <div style={{ position: 'absolute', left: '50%', top: isLive ? '47%' : '49%', transform: 'translate(-50%, -50%)', width: 'min(154vw, 680px)', height: 'min(154vw, 680px)', pointerEvents: 'none', opacity: arPhase === 'intro-playing' ? 1 : 0, transition: 'top 420ms ease-out, opacity 320ms ease-out' }}>
        <Step06SequencePlayer
          size="100%"
          autoplay={arPhase === 'intro-playing'}
          holdLastFrame
          frameUrls={introFrameUrls}
          durationMs={introDurationMs}
          onComplete={() => setArPhase('final-live')}
          style={{ transform: 'translateY(-9%)', filter: 'none' }}
        />
      </div>

      <IOSStatusBar dark />
      <div className="top-controls">
        <FrostButton onClick={exitAR}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 3l8 8M11 3l-8 8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </FrostButton>
        <LangChip lang={lang} onToggle={setLang} light />
      </div>

      {isLive && (
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
          {arPhase === 'intro-playing'
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

      <div style={{ position: 'absolute', top: 'calc(var(--safe-top) + 72px)', right: 'calc(var(--safe-right) + 12px)', zIndex: 18, padding: '8px 10px', borderRadius: 10, background: 'rgba(0,0,0,0.62)', border: '0.5px solid rgba(255,255,255,0.18)', fontFamily: FONT_MONO, fontSize: 9.5, lineHeight: 1.45, color: '#fff', textAlign: 'left', pointerEvents: 'none', maxWidth: 206 }}>
        <div>phase: <b style={{ color: TOKENS.green }}>{arPhase}</b></div>
        <div>mindar: <b style={{ color: TOKENS.green }}>{diagnostics?.status || '-'}</b></div>
        <div>live: {String(!!diagnostics?.liveModelLoaded)} · frozen: {String(!!diagnostics?.frozenModelLoaded)}</div>
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

      <div style={{ position: 'absolute', left: '50%', bottom: 'calc(var(--safe-bottom) + 8px)', transform: 'translateX(-50%)', width: 140, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.7)' }} />
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
