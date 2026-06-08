import React from 'react';
import { STATES, HAPPY_PATH } from './app/flowConfig.js';
import { ManualARStage } from './ar/ManualARStage.jsx';
import { Landing } from './screens/Landing.jsx';
import { Permission } from './screens/Permission.jsx';
import { Loading } from './screens/Loading.jsx';
import { Scan } from './screens/Scan.jsx';
import { ARActive } from './screens/ARActive.jsx';
import { Denied } from './screens/Denied.jsx';
import { ErrorScreen } from './screens/Error.jsx';
import { arAudio } from './lib/arAudio.js';
import { preloadStep06 } from './lib/step06Assets.js';
import { stopCameraPreview, subscribeCameraPreview } from './lib/cameraPreview.js';

const RUNTIME_READY_EVENT = 'emo-mindar-runtime-ready';
const MIN_LOADING_MS = 900;
const LazyMindARStage = React.lazy(() => import('./ar/MindARStage.jsx').then((module) => ({
  default: module.MindARStage,
})));

function waitForRuntimeReady() {
  const runtime = window.__ar || window.__mindar;
  if (runtime?.isReady?.()) return Promise.resolve();
  return new Promise((resolve) => {
    window.addEventListener(RUNTIME_READY_EVENT, resolve, { once: true });
  });
}

function readArMode() {
  try {
    return new URLSearchParams(window.location.search).get('mode') === 'mindar' ? 'mindar' : 'manual';
  } catch {
    return 'manual';
  }
}

function IcpFooter() {
  return (
    <a
      className="icp-footer"
      href="https://beian.miit.gov.cn/"
      target="_blank"
      rel="noreferrer"
      aria-label="工信部备案查询：鄂ICP备2026028745号-1"
      data-interactive="true"
    >
      鄂ICP备2026028745号-1
    </a>
  );
}

function CameraPreviewLayer({ stream }) {
  const videoRef = React.useRef(null);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    video.srcObject = stream || null;
    if (stream) {
      video.play?.().catch(() => {});
    }
    return () => {
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [stream]);

  if (!stream) return null;

  return (
    <video
      ref={videoRef}
      aria-hidden="true"
      muted
      playsInline
      autoPlay
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        width: '100vw',
        height: '100dvh',
        objectFit: 'cover',
        background: '#000',
        pointerEvents: 'none',
      }}
    />
  );
}

function ScreenFor({ state, lang, setLang, diagnostics, hasCameraPreview }) {
  switch (state) {
    case 'landing':
      return <Landing lang={lang} setLang={setLang} />;
    case 'permission':
      return <Permission lang={lang} setLang={setLang} />;
    case 'loading':
      return <Loading lang={lang} setLang={setLang} hasCameraPreview={hasCameraPreview} />;
    case 'scan':
      return <Scan lang={lang} setLang={setLang} />;
    case 'ar':
      return <ARActive lang={lang} setLang={setLang} diagnostics={diagnostics} />;
    case 'denied':
      return <Denied lang={lang} setLang={setLang} />;
    case 'error':
      return <ErrorScreen lang={lang} setLang={setLang} />;
    default:
      return <Landing lang={lang} setLang={setLang} />;
  }
}

export default function App() {
  const [state, setStateRaw] = React.useState('landing');
  const arMode = React.useMemo(readArMode, []);
  const [lang, setLangRaw] = React.useState(() => {
    try {
      return localStorage.getItem('emo_proto_lang') || 'en';
    } catch {
      return 'en';
    }
  });
  const [nonce, setNonce] = React.useState(0);
  const [diagnostics, setDiagnostics] = React.useState(null);
  const [cameraPreview, setCameraPreview] = React.useState(null);

  const setState = React.useCallback((nextState) => {
    setStateRaw(nextState);
    setNonce((value) => value + 1);
    try {
      localStorage.removeItem('emo_proto_state');
    } catch {}
  }, []);

  const setLang = React.useCallback((nextLang) => {
    setLangRaw(nextLang);
    try {
      localStorage.setItem('emo_proto_lang', nextLang);
    } catch {}
  }, []);

  const handleDiagnostics = React.useCallback((nextDiagnostics) => {
    setDiagnostics(nextDiagnostics);
  }, []);

  React.useEffect(() => {
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh';
  }, [lang]);

  React.useEffect(() => subscribeCameraPreview(({ stream }) => {
    setCameraPreview(stream || null);
  }), []);

  React.useEffect(() => {
    arAudio.preloadUiClick();
  }, []);

  React.useEffect(() => {
    window.__setProtoState = setState;
    return () => {
      if (window.__setProtoState === setState) delete window.__setProtoState;
    };
  }, [setState]);

  React.useEffect(() => {
    if (state === 'loading') {
      let cancelled = false;
      const minLoading = new Promise((resolve) => {
        window.setTimeout(resolve, MIN_LOADING_MS);
      });
      Promise.all([minLoading, waitForRuntimeReady()])
        .then(() => {
          if (!cancelled) setState('scan');
        });
      return () => {
        cancelled = true;
      };
    }
    return undefined;
  }, [state, setState]);

  React.useEffect(() => {
    arAudio.setState(state);
    if (state === 'scan' || state === 'ar') arAudio.preload({ includeBgm: false });
    if (state === 'permission') {
      preloadStep06({ full: false, includeAudio: false });
    } else if (state === 'loading' || state === 'scan' || state === 'ar') {
      preloadStep06({ full: true, includeAudio: false });
    }
    if (state !== 'loading' && state !== 'scan' && state !== 'ar') arAudio.stopArAudio();
  }, [state]);

  React.useEffect(() => {
    if (state === 'landing' || state === 'denied' || state === 'error') {
      stopCameraPreview();
    }
  }, [state]);

  React.useEffect(() => {
    if (state === 'ar') return undefined;

    let lastPointerSound = { time: 0, control: null };
    const findInteractiveControl = (event) => {
      const target = event.target;
      const control = target?.closest?.('button,[role="button"],[data-interactive="true"]');
      if (!control || !event.currentTarget.documentElement.contains(control)) return null;
      if (control.disabled || control.getAttribute('aria-disabled') === 'true') return null;
      return control;
    };
    const playPointerSound = (event) => {
      const control = findInteractiveControl(event);
      if (!control) return;
      lastPointerSound = { time: performance.now(), control };
      arAudio.playButtonClick();
    };
    const playClickSound = (event) => {
      const control = findInteractiveControl(event);
      if (!control) return;
      if (control === lastPointerSound.control && performance.now() - lastPointerSound.time < 600) return;
      arAudio.playButtonClick();
    };

    document.addEventListener('pointerdown', playPointerSound, true);
    document.addEventListener('click', playClickSound, true);
    return () => {
      document.removeEventListener('pointerdown', playPointerSound, true);
      document.removeEventListener('click', playClickSound, true);
    };
  }, [state]);

  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'ArrowRight') {
        const index = HAPPY_PATH.indexOf(state);
        if (index >= 0 && index < HAPPY_PATH.length - 1) setState(HAPPY_PATH[index + 1]);
      } else if (event.key === 'ArrowLeft') {
        const index = HAPPY_PATH.indexOf(state);
        if (index > 0) setState(HAPPY_PATH[index - 1]);
      } else if (event.key.toLowerCase() === 'r') {
        setState('landing');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, setState]);

  const arPrepared = arMode === 'mindar'
    ? state === 'permission' || state === 'loading' || state === 'scan' || state === 'ar'
    : state === 'loading' || state === 'scan' || state === 'ar';
  const arActive = state === 'scan' || state === 'ar';

  return (
    <div className="app-shell">
      <CameraPreviewLayer stream={cameraPreview} />
      {arMode === 'mindar' ? (
        <React.Suspense fallback={null}>
          <LazyMindARStage
            prepared={arPrepared}
            active={arActive}
            visible={arActive}
            preloadModel={state === 'loading' || state === 'scan' || state === 'ar'}
            onDiagnostics={handleDiagnostics}
          />
        </React.Suspense>
      ) : (
        <ManualARStage
          prepared={arPrepared}
          active={arActive}
          visible={arActive}
          preloadModel={state === 'loading' || state === 'scan' || state === 'ar'}
          onDiagnostics={handleDiagnostics}
        />
      )}
      <div key={nonce} className="ui-layer screen-enter">
        <ScreenFor
          state={state}
          lang={lang}
          setLang={setLang}
          diagnostics={diagnostics}
          hasCameraPreview={Boolean(cameraPreview)}
        />
      </div>
      <IcpFooter />
    </div>
  );
}
