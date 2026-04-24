// Real 3D mascot helpers + step06 runtime assets.

const STEP06_MANIFEST_URL = 'assets/step06/manifest.json';
const step06ManifestDefaults = {
  frameUrls: [],
  frameCount: 292,
  introDurationMs: 10004,
  frameDurationMs: 34,
  audioUrl: 'assets/step06/audio/yimao-intro.m4a',
  glbUrl: 'assets/step06/models/yimao-sitting.glb',
  finalFrameUrl: 'assets/step06/sequence/1_0300.png',
  width: 768,
  height: 768,
  fps: 29.188,
};
const step06AudioUrl = step06ManifestDefaults.audioUrl;
const step06GlbUrl = step06ManifestDefaults.glbUrl;

const Step06Assets = (() => {
  let manifest = { ...step06ManifestDefaults };
  let manifestPromise = null;
  const imageCache = new Map();
  let warmAudio = null;

  function primeImage(url) {
    if (!url) return Promise.resolve(null);
    if (imageCache.has(url)) return imageCache.get(url);
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.decoding = 'async';
      image.src = url;
    });
    imageCache.set(url, promise);
    return promise;
  }

  function loadManifest() {
    if (manifestPromise) return manifestPromise;
    manifestPromise = fetch(STEP06_MANIFEST_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`Step06 manifest request failed: ${response.status}`);
        return response.json();
      })
      .then((loaded) => {
        manifest = { ...step06ManifestDefaults, ...loaded };
        return manifest;
      })
      .catch(() => manifest);
    return manifestPromise;
  }

  function preload({ full = false } = {}) {
    loadManifest().then((loaded) => {
      if (loaded.frameUrls.length) {
        primeImage(loaded.frameUrls[0]);
        primeImage(loaded.finalFrameUrl || loaded.frameUrls[loaded.frameUrls.length - 1]);
        if (full) loaded.frameUrls.forEach(primeImage);
      }

      if (!warmAudio) {
        warmAudio = new Audio(loaded.audioUrl);
        warmAudio.preload = full ? 'auto' : 'metadata';
        warmAudio.playsInline = true;
        try { warmAudio.load(); } catch {}
      }
    });
  }

  function frameNumberFromUrl(url) {
    const match = String(url || '').match(/1_(\d+)\.png$/);
    return match ? Number(match[1]) : null;
  }

  function getFrameUrlsInRange(startFrame, endFrame) {
    const hasRange = Number.isFinite(startFrame) && Number.isFinite(endFrame);
    if (!hasRange) return manifest.frameUrls;
    return manifest.frameUrls.filter((url) => {
      const frameNumber = frameNumberFromUrl(url);
      return frameNumber !== null && frameNumber >= startFrame && frameNumber <= endFrame;
    });
  }

  function preloadRange({ startFrame, endFrame } = {}) {
    loadManifest().then((loaded) => {
      const urls = loaded.frameUrls.filter((url) => {
        const frameNumber = frameNumberFromUrl(url);
        return frameNumber !== null && frameNumber >= startFrame && frameNumber <= endFrame;
      });
      urls.forEach(primeImage);
      if (urls[0]) primeImage(urls[0]);
      if (urls[urls.length - 1]) primeImage(urls[urls.length - 1]);
    });
  }

  function preloadUrls(urls = [], { eagerCount = 24 } = {}) {
    if (!Array.isArray(urls) || !urls.length) return;
    const eagerUrls = urls.slice(0, eagerCount);
    eagerUrls.forEach(primeImage);
    primeImage(urls[urls.length - 1]);

    const restUrls = urls.slice(eagerCount);
    const schedule = window.requestIdleCallback || ((cb) => window.setTimeout(cb, 80));
    let index = 0;
    const loadBatch = () => {
      restUrls.slice(index, index + 12).forEach(primeImage);
      index += 12;
      if (index < restUrls.length) schedule(loadBatch);
    };
    schedule(loadBatch);
  }

  function createAudio() {
    const audio = new Audio(manifest.audioUrl);
    audio.preload = 'auto';
    audio.playsInline = true;
    return audio;
  }

  function getFrameUrl(index) {
    return manifest.frameUrls[index] || manifest.finalFrameUrl || manifest.frameUrls[manifest.frameUrls.length - 1] || null;
  }

  return {
    loadManifest,
    preload,
    preloadRange,
    preloadUrls,
    createAudio,
    getManifest: () => manifest,
    getFrameUrl,
    getFrameUrlsInRange,
  };
})();

function Mascot3D({ size = 220, state = 'idle', animate = 'bob', style = {}, shadow = true }) {
  const src = {
    small: 'assets/mascot/m_small.png',
    idle: 'assets/mascot/m_idle.png',
    mid: 'assets/mascot/m_mid.png',
    sprout: 'assets/mascot/m_sprout.png',
  }[state] || 'assets/mascot/m_sprout.png';
  const animClass = animate === 'bob' ? 'mascot-bob' : animate === 'pop' ? 'mascot-pop' : '';
  return (
    <div style={{ width: size, height: size, position: 'relative', display: 'inline-block', ...style }} className={animClass}>
      <img src={src} style={{
        width: '100%', height: '100%', objectFit: 'contain', display: 'block',
        filter: shadow ? 'drop-shadow(0 16px 18px rgba(229,109,137,0.28))' : 'none',
      }}/>
    </div>
  );
}

function Step06SequencePlayer({
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
  const [manifest, setManifest] = React.useState(() => Step06Assets.getManifest());
  const [ready, setReady] = React.useState(false);
  const [frameIndex, setFrameIndex] = React.useState(0);
  const rafRef = React.useRef(null);
  const startRef = React.useRef(0);
  const completedRef = React.useRef(false);

  React.useEffect(() => {
    let off = false;
    Step06Assets.preload({ full: false });
    Step06Assets.loadManifest().then((loaded) => {
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
      Step06Assets.preload({ full: false });
      Step06Assets.loadManifest().then(() => {
        if (!off) {
          Step06Assets.getFrameUrl(0);
          setReady(true);
        }
      });
      if (probeUrl) {
        const image = new Image();
        image.onload = () => !off && setReady(true);
        image.onerror = () => !off && setReady(true);
        image.src = probeUrl;
      } else {
        setReady(true);
      }
    });
    return () => { off = true; };
  }, [frameStart, frameEnd, frameUrls]);

  const playbackFrames = React.useMemo(() => {
    if (Array.isArray(frameUrls) && frameUrls.length) {
      return frameUrls;
    }
    if (!Number.isFinite(frameStart) || !Number.isFinite(frameEnd)) {
      return manifest.frameUrls;
    }
    return Step06Assets.getFrameUrlsInRange(frameStart, frameEnd);
  }, [manifest.frameUrls, frameStart, frameEnd, frameUrls]);

  const playbackDurationMs = durationMs || (
    playbackFrames.length && manifest.frameDurationMs
      ? Math.max(900, playbackFrames.length * manifest.frameDurationMs)
      : manifest.introDurationMs
  );

  React.useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (!autoplay || !ready || !playbackFrames.length) {
      // If the sequence already finished and caller wants the final frame held,
      // don't reset back to frame 0 when autoplay flips off.
      if (!(holdLastFrame && completedRef.current)) {
        setFrameIndex(0);
      }
      return undefined;
    }

    if (!(holdLastFrame && completedRef.current)) {
      setFrameIndex(0);
    }
    startRef.current = 0;

    const tick = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(1, elapsed / playbackDurationMs);
      const nextIndex = Math.min(
        playbackFrames.length - 1,
        Math.floor(progress * playbackFrames.length)
      );
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

function applyYimaoMaterial(viewer) {
  const materials = viewer?.model?.materials || [];
  materials.forEach((material) => {
    const pbr = material.pbrMetallicRoughness;
    pbr?.setBaseColorFactor?.([1.0, 0.49, 0.61, 1.0]);
    pbr?.setMetallicFactor?.(0);
    pbr?.setRoughnessFactor?.(0.82);
    material.setEmissiveFactor?.([0.02, 0.0, 0.01]);
  });
}

function ModelViewerIdle({ size = 260, src = step06GlbUrl, active = false, style = {} }) {
  const [viewerReady, setViewerReady] = React.useState(
    !!window.customElements?.get('model-viewer')
  );
  const viewerRef = React.useRef(null);

  React.useEffect(() => {
    if (viewerReady || !window.customElements?.whenDefined) return undefined;
    let off = false;
    window.customElements.whenDefined('model-viewer').then(() => {
      if (!off) setViewerReady(true);
    });
    return () => { off = true; };
  }, [viewerReady]);

  React.useEffect(() => {
    if (!viewerReady) return undefined;
    const viewer = viewerRef.current;
    if (!viewer) return undefined;
    const recolor = () => applyYimaoMaterial(viewer);
    viewer.addEventListener('load', recolor);
    requestAnimationFrame(recolor);
    return () => viewer.removeEventListener('load', recolor);
  }, [src, viewerReady]);

  const viewerStyle = {
    width: '100%',
    height: '100%',
    background: 'transparent',
    display: 'block',
    filter: 'drop-shadow(0 18px 22px rgba(229,109,137,0.24))',
  };

  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transformOrigin: '50% 100%',
        animation: active ? 'sprout-bob 3.4s ease-in-out infinite' : 'none',
        ...style,
      }}
    >
      {viewerReady
        ? React.createElement('model-viewer', {
            ref: viewerRef,
            src,
            alt: '一毛 3D 模型',
            'camera-controls': '',
            'interaction-prompt': 'none',
            'disable-zoom': '',
            exposure: '0.72',
            shadowIntensity: '0.08',
            'camera-orbit': '0deg 78deg 115%',
            'field-of-view': '30deg',
            style: viewerStyle,
          })
        : (
          <img
            src="assets/mascot/m_sprout.png"
            alt="一毛模型回退图"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
              filter: 'sepia(0.38) saturate(1.35) hue-rotate(314deg) brightness(1.08)',
            }}
          />
        )}
    </div>
  );
}

function MascotAppearSequence(props) {
  return <Step06SequencePlayer {...props} />;
}

function EmojiFace({ size = 200, style = {} }) {
  return (
    <img src="assets/mascot-face-emoji.png" style={{
      width: size, height: 'auto', display: 'block', ...style,
    }}/>
  );
}

Object.assign(window, {
  Mascot3D,
  MascotAppearSequence,
  Step06SequencePlayer,
  Step06Assets,
  ModelViewerIdle,
  EmojiFace,
  step06AudioUrl,
  step06GlbUrl,
});

window.Mascot = (props) => <Mascot3D state="sprout" {...props} />;
window.MascotHead = ({ size = 64, style = {} }) => (
  <img src="assets/mascot/m_sprout.png" style={{ width: size, height: size, objectFit: 'contain', ...style }}/>
);
