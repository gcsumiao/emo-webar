import React from 'react';
import { getFrameUrlsInRange, getStep06Manifest, loadStep06Manifest, preloadStep06, preloadUrls } from '../lib/step06Assets.js';

export function Step06SequencePlayer({
  size = 260,
  autoplay = false,
  onComplete,
  holdLastFrame = false,
  frameStart = null,
  frameEnd = null,
  frameUrls = null,
  durationMs = null,
  className = '',
  style = {},
}) {
  const [manifest, setManifest] = React.useState(() => getStep06Manifest());
  const [ready, setReady] = React.useState(false);
  const [frameIndex, setFrameIndex] = React.useState(0);
  const rafRef = React.useRef(null);
  const startRef = React.useRef(0);
  const completedRef = React.useRef(false);

  React.useEffect(() => {
    let off = false;
    preloadStep06({ full: false });
    loadStep06Manifest().then((loaded) => {
      if (off) return;
      setManifest(loaded);
      const rangeUrls = Array.isArray(frameUrls) && frameUrls.length
        ? frameUrls
        : Number.isFinite(frameStart) && Number.isFinite(frameEnd)
          ? loaded.frameUrls.filter((url) => {
              const match = String(url || '').match(/1_(\d+)\.png$/);
              const frameNumber = match ? Number(match[1]) : null;
              return frameNumber !== null && frameNumber >= frameStart && frameNumber <= frameEnd;
            })
          : loaded.frameUrls;
      const probeUrl = rangeUrls[0] || loaded.frameUrls[0] || loaded.finalFrameUrl;
      if (rangeUrls.length) preloadUrls(rangeUrls);
      if (probeUrl) {
        const image = new Image();
        image.onload = () => !off && setReady(true);
        image.onerror = () => !off && setReady(true);
        image.src = probeUrl;
      } else {
        setReady(true);
      }
    });
    return () => {
      off = true;
    };
  }, [frameStart, frameEnd, frameUrls]);

  const playbackFrames = React.useMemo(() => {
    if (Array.isArray(frameUrls) && frameUrls.length) return frameUrls;
    if (!Number.isFinite(frameStart) || !Number.isFinite(frameEnd)) return manifest.frameUrls;
    return getFrameUrlsInRange(frameStart, frameEnd);
  }, [manifest.frameUrls, frameStart, frameEnd, frameUrls]);

  const playbackDurationMs = durationMs || (
    playbackFrames.length && manifest.frameDurationMs
      ? Math.max(900, playbackFrames.length * manifest.frameDurationMs)
      : manifest.introDurationMs
  );

  React.useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (!autoplay || !ready || !playbackFrames.length) {
      if (!(holdLastFrame && completedRef.current)) setFrameIndex(0);
      return undefined;
    }

    if (!(holdLastFrame && completedRef.current)) setFrameIndex(0);
    startRef.current = 0;

    const tick = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(1, elapsed / playbackDurationMs);
      const nextIndex = Math.min(playbackFrames.length - 1, Math.floor(progress * playbackFrames.length));
      setFrameIndex(nextIndex);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        completedRef.current = true;
        onComplete?.();
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [autoplay, playbackFrames, playbackDurationMs, onComplete, ready, holdLastFrame]);

  const currentSrc = playbackFrames[frameIndex] || playbackFrames[playbackFrames.length - 1] || manifest.finalFrameUrl;

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'inline-block',
        filter: 'drop-shadow(0 18px 22px rgba(229,109,137,0.32))',
        ...style,
      }}
    >
      {currentSrc && (
        <img
          src={currentSrc}
          alt="一毛动画帧"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
            opacity: ready ? 1 : 0,
          }}
        />
      )}
    </div>
  );
}
