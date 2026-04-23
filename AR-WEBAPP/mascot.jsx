// Real 3D mascot helpers + step06 runtime assets.

const STEP06_MANIFEST_URL = 'assets/step06/manifest.json';
const step06ManifestDefaults = {
  introImageUrl: 'assets/step06/intro/yimao-intro.apng',
  introPosterUrl: 'assets/step06/intro/yimao-intro-poster.png',
  introDurationMs: 10004,
  audioUrl: 'assets/step06/audio/yimao-intro.m4a',
  glbUrl: 'assets/step06/models/yimao-sitting.glb',
  width: 1024,
  height: 1024,
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
      primeImage(loaded.introPosterUrl);
      primeImage(loaded.introImageUrl);

      if (!warmAudio) {
        warmAudio = new Audio(loaded.audioUrl);
        warmAudio.preload = full ? 'auto' : 'metadata';
        warmAudio.playsInline = true;
        try { warmAudio.load(); } catch {}
      }
    });
  }

  function createAudio() {
    const audio = new Audio(manifest.audioUrl);
    audio.preload = 'auto';
    audio.playsInline = true;
    return audio;
  }

  return {
    loadManifest,
    preload,
    createAudio,
    getManifest: () => manifest,
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
  fps = 24,
  autoplay = false,
  onComplete,
  className = '',
  style = {},
}) {
  const [manifest, setManifest] = React.useState(() => Step06Assets.getManifest());
  const [ready, setReady] = React.useState(false);
  const [imageFailed, setImageFailed] = React.useState(false);
  const [playbackKey, setPlaybackKey] = React.useState(0);
  const completeTimerRef = React.useRef(null);

  React.useEffect(() => {
    let off = false;
    Step06Assets.preload({ full: false });
    Step06Assets.loadManifest().then((loaded) => {
      if (off) return;
      setManifest(loaded);
      const probeUrl = loaded.introImageUrl;
      const image = new Image();
      image.onload = () => {
        if (!off) {
          setImageFailed(false);
          setReady(true);
        }
      };
      image.onerror = () => {
        if (!off) {
          setImageFailed(true);
          setReady(true);
        }
      };
      image.src = probeUrl;
    });
    return () => { off = true; };
  }, []);

  React.useEffect(() => {
    clearTimeout(completeTimerRef.current);
    if (!autoplay || !ready) return undefined;

    setPlaybackKey((value) => value + 1);
    completeTimerRef.current = window.setTimeout(() => {
      onComplete?.();
    }, manifest.introDurationMs);

    return () => {
      clearTimeout(completeTimerRef.current);
    };
  }, [autoplay, fps, manifest.introDurationMs, onComplete, ready]);

  const src = autoplay && !imageFailed ? manifest.introImageUrl : manifest.introPosterUrl;

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
      <img
        key={playbackKey}
        src={src}
        alt="Yi Mao intro animation"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
          opacity: ready ? 1 : 0,
        }}
      />
    </div>
  );
}

function ModelViewerIdle({ size = 260, src = step06GlbUrl, active = false, style = {} }) {
  const [viewerReady, setViewerReady] = React.useState(
    !!window.customElements?.get('model-viewer')
  );

  React.useEffect(() => {
    if (viewerReady || !window.customElements?.whenDefined) return undefined;
    let off = false;
    window.customElements.whenDefined('model-viewer').then(() => {
      if (!off) setViewerReady(true);
    });
    return () => { off = true; };
  }, [viewerReady]);

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
            src,
            alt: 'Yi Mao 3D idle model',
            autoplay: '',
            'auto-rotate': '',
            'rotation-per-second': '12deg',
            'interaction-prompt': 'none',
            'camera-controls': '',
            'disable-zoom': '',
            exposure: '1.08',
            shadowIntensity: '0',
            style: viewerStyle,
          })
        : (
          <img
            src="assets/mascot/m_sprout.png"
            alt="Yi Mao idle fallback"
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
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
