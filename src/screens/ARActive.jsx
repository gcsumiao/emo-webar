import React from 'react';
import { LangChip, FrostButton, TOKENS, FONT_MONO, langFont, t } from '../components/ui.jsx';
import { arAudio } from '../lib/arAudio.js';
import { createARPhoto } from '../lib/arCapture.js';
import { introFps, introFrameUrls, preloadUrls } from '../lib/step06Assets.js';
import { useViewport } from '../lib/viewport.js';
import { clampScaleFactor, pointerDistance } from '../ar/frozenControls.js';
import { getARRuntime, isKivicubeRuntime } from '../ar/arRuntime.js';

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
  const [spriteState, setSpriteState] = React.useState(() => getARRuntime()?.getSpriteState?.() || null);
  const [visualFrameIndex, setVisualFrameIndex] = React.useState(0);
  const [visualFrames, setVisualFrames] = React.useState(introFrameUrls);
  const [currentRenderMode, setCurrentRenderMode] = React.useState('sprite-only');
  const [visualTransform, setVisualTransform] = React.useState({ x: 0, y: 0, scale: 1, rotation: 0 });
  const [capturedPhoto, setCapturedPhoto] = React.useState(null);
  const pointersRef = React.useRef(new Map());
  const gestureRef = React.useRef({ lastDistance: null });
  const flashTimerRef = React.useRef(null);
  const visualRafRef = React.useRef(null);
  const debugMode = React.useMemo(readDebugFlag, []);
  const viewport = useViewport();

  React.useEffect(() => {
    preloadUrls(introFrameUrls, { eagerCount: 48 });
  }, []);

  // Drive the scanning-success → sprite-entering → final-live transition on mount.
  React.useEffect(() => {
    let cancelled = false;
    let retryTimer = null;

    const playVisualIntro = (frames, fps) => new Promise((resolve) => {
      window.cancelAnimationFrame(visualRafRef.current);
      setVisualTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
      setVisualFrameIndex(0);
      const startedAt = performance.now();
      const frameMs = 1000 / (fps || introFps);
      const tick = (now) => {
        if (cancelled) {
          resolve();
          return;
        }
        const idx = Math.min(frames.length - 1, Math.floor((now - startedAt) / frameMs));
        setVisualFrameIndex(idx);
        if (idx >= frames.length - 1) {
          resolve();
          return;
        }
        visualRafRef.current = window.requestAnimationFrame(tick);
      };
      visualRafRef.current = window.requestAnimationFrame(tick);
    });

    const startIntro = () => {
      const runtime = getARRuntime();
      if (!runtime?.playSpriteIntro) {
        retryTimer = window.setTimeout(startIntro, 80);
        return;
      }
      const target = runtime.getLastTarget?.() || runtime.getActiveTargets?.()?.[0] || null;
      const targetIndex = target?.targetIndex;
      const spriteConfig = runtime.getCurrentSpriteConfig?.() || null;
      const frames = spriteConfig?.frameSequenceUrls?.length ? spriteConfig.frameSequenceUrls : introFrameUrls;
      const fps = spriteConfig?.frameRate || introFps;
      setVisualFrames(frames);
      preloadUrls(frames, { eagerCount: 48 });
      setCurrentRenderMode(runtime.getCurrentRenderMode?.() || 'sprite-only');
      setArPhase('scanning-success');
      flashTimerRef.current = window.setTimeout(() => {
        if (cancelled) return;
        setArPhase('sprite-entering');
        arAudio.cueARIntro();
        const arPromise = runtime.playSpriteIntro?.(targetIndex).catch?.(() => null) || Promise.resolve();
        const visualPromise = playVisualIntro(frames, fps);
        Promise.all([arPromise, visualPromise]).then(() => {
          if (cancelled) return;
          const nextRenderMode = runtime.getCurrentRenderMode?.() || 'sprite-only';
          setCurrentRenderMode(nextRenderMode);
          setArPhase('final-live');
          setVisualFrameIndex(frames.length - 1);
          setFrozenState(runtime.getFrozenState?.() || null);
          setSpriteState(runtime.getSpriteState?.() || null);
        });
      }, FLASH_MS);
    };

    startIntro();

    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      window.clearTimeout(flashTimerRef.current);
      window.cancelAnimationFrame(visualRafRef.current);
    };
  }, []);

  // On unmount, reset frozen object & sprite state so the scene is clean if user re-enters.
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
  const visualSpriteSrc = visualFrames[visualFrameIndex] || visualFrames[visualFrames.length - 1] || introFrameUrls[introFrameUrls.length - 1];

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
      const renderMode = runtime?.getCurrentRenderMode?.() || currentRenderMode;
      if (renderMode === 'sprite-then-gltf' || renderMode === 'gltf-only') {
        await runtime?.showFinalModel?.();
      }
      const next = await runtime?.freezeCurrentTarget?.();
      if (next) setFrozenState(next);
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
      const photo = isKivicubeRuntime(runtime) && runtime?.takePhoto
        ? await dataUrlToPhoto(await runtime.takePhoto())
        : await createARPhoto({
          spriteSrc: visualSpriteSrc,
          visualTransform,
          isLandscapePhone,
          includeSpriteOverlay: renderMode === 'sprite-only',
        });
      clearCapturedPhoto();
      setCapturedPhoto(photo);
      setArPhase('captured-frame');
    } catch (error) {
      console.error('[EMO-AR] capture failed', error);
      setArPhase('final-live');
    }
  }, [arPhase, clearCapturedPhoto, currentRenderMode, isLandscapePhone, visualSpriteSrc, visualTransform]);

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

  const handlePointerDown = React.useCallback((event) => {
    if (!canEdit) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = Array.from(pointersRef.current.values());
    if (points.length >= 2) {
      gestureRef.current.lastDistance = pointerDistance(points[0], points[1]);
    } else {
      gestureRef.current.lastDistance = null;
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
      if (gestureRef.current.lastDistance) {
        const scaleFactor = clampScaleFactor(distance / gestureRef.current.lastDistance);
        setVisualTransform((current) => ({ ...current, scale: Math.max(0.35, Math.min(2.4, current.scale * scaleFactor)) }));
        const r = getARRuntime()?.scaleFrozenBy?.({ scaleFactor });
        if (r) setFrozenState(r);
      }
      gestureRef.current.lastDistance = distance;
    } else if (points.length === 1) {
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const yawDelta = dx * 0.35;
      setVisualTransform((current) => ({
        ...current,
        x: current.x + dx,
        y: current.y + dy,
        rotation: current.rotation + yawDelta,
      }));
      const runtime = getARRuntime();
      const r = runtime?.moveFrozenByScreenDelta?.({ dx, dy });
      if (r) setFrozenState(r);
      const rr = runtime?.rotateFrozenBy?.({ yawDelta });
      if (rr) setFrozenState(rr);
    }
  }, [canEdit]);

  const handlePointerUp = React.useCallback((event) => {
    pointersRef.current.delete(event.pointerId);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (pointersRef.current.size < 2) {
      gestureRef.current.lastDistance = null;
    }
  }, []);

  // Poll sprite state for diagnostics overlay (debug only).
  React.useEffect(() => {
    if (!debugMode) return undefined;
    const id = window.setInterval(() => {
      setSpriteState(getARRuntime()?.getSpriteState?.() || null);
    }, 250);
    return () => window.clearInterval(id);
  }, [debugMode]);

  const flashOpacity = arPhase === 'scanning-success' ? 0.85 : 0;
  const finalUsesSpriteOverlay = currentRenderMode === 'sprite-only'
    || (currentRenderMode !== 'gltf-only' && frozenState?.contentMode !== 'gltf');
  const showVisualSprite = arPhase === 'sprite-entering'
    || ((arPhase === 'final-live' || isCapturing) && finalUsesSpriteOverlay);

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

      {showVisualSprite && (
        <img
          aria-hidden="true"
          src={visualSpriteSrc}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            left: '50%',
            top: isLandscapePhone ? '47%' : '44%',
            width: 'min(72vw, 420px)',
            height: 'auto',
            transform: `translate(-50%, -50%) translate(${visualTransform.x}px, ${visualTransform.y}px) rotate(${visualTransform.rotation}deg) scale(${visualTransform.scale})`,
            transformOrigin: '50% 58%',
            zIndex: 3,
            pointerEvents: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            filter: 'none',
            opacity: 1,
          }}
        />
      )}

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
          aria-label="Drag with one finger to move and rotate EMO; pinch with two fingers to scale"
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
        {!isCaptured && (
          <div style={{ padding: '10px 16px', borderRadius: 999, background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '0.5px solid rgba(255,255,255,0.15)', fontFamily: langFont(lang), fontSize: 11, color: 'rgba(255,255,255,0.92)', maxWidth: 'min(84vw, 360px)', textAlign: 'center' }}>
            {arPhase === 'scanning-success' || arPhase === 'sprite-entering'
              ? t(lang, '一毛出现中…', 'EMO is appearing…')
              : isCapturing
                ? t(lang, '照片生成中…', 'Creating photo…')
                : t(lang, '单指拖动 / 旋转 · 双指缩放 · 拍下并固定', 'One finger moves / rotates · two fingers scale · capture to lock')}
          </div>
        )}
        {isCaptured ? (
          <div style={{ display: 'flex', gap: 12, pointerEvents: 'auto' }}>
            <button type="button" onClick={captureFrame} style={actionButtonStyle(lang)}>{t(lang, '重新拍照', 'Retake')}</button>
            <button type="button" onClick={shareFrame} style={actionButtonStyle(lang)}>{t(lang, '分享好友', 'Share')}</button>
          </div>
        ) : (
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
        )}
      </div>

      {debugMode && (
        <div style={{ position: 'absolute', top: 'calc(var(--safe-top) + 72px)', right: 'calc(var(--safe-right) + 12px)', zIndex: 18, padding: '8px 10px', borderRadius: 10, background: 'rgba(0,0,0,0.62)', border: '0.5px solid rgba(255,255,255,0.18)', fontFamily: FONT_MONO, fontSize: 9.5, lineHeight: 1.45, color: '#fff', textAlign: 'left', pointerEvents: 'none', maxWidth: 220 }}>
          <div>phase: <b style={{ color: TOKENS.green }}>{arPhase}</b></div>
          <div>ar: <b style={{ color: TOKENS.green }}>{diagnostics?.status || '-'}</b></div>
          <div>sprite: <b style={{ color: TOKENS.green }}>{spriteState?.phase || '-'}</b> · frame {spriteState?.frameIndex ?? 0}</div>
          <div>visual: frame {visualFrameIndex}</div>
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
