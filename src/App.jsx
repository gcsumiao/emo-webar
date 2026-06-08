import React from 'react';
import { STATES, HAPPY_PATH } from './app/flowConfig.js';
import { MindARStage } from './ar/MindARStage.jsx';
import { Landing } from './screens/Landing.jsx';
import { Permission } from './screens/Permission.jsx';
import { Loading } from './screens/Loading.jsx';
import { Scan } from './screens/Scan.jsx';
import { ARActive } from './screens/ARActive.jsx';
import { Denied } from './screens/Denied.jsx';
import { ErrorScreen } from './screens/Error.jsx';
import { arAudio } from './lib/arAudio.js';
import { asset } from './lib/assetUrl.js';
import { preloadStep06 } from './lib/step06Assets.js';

function SiteFontFaces() {
  return (
    <style>
      {`
        @font-face {
          font-family: "Source Han Sans CN";
          src: url("${asset('/assets/fonts/SourceHanSansCN-Heavy.otf')}") format("opentype");
          font-weight: 800 900;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: "Source Han Sans CN";
          src: url("${asset('/assets/fonts/SourceHanSansCN-Bold.otf')}") format("opentype");
          font-weight: 700;
          font-style: normal;
          font-display: swap;
        }
      `}
    </style>
  );
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

function ScreenFor({ state, lang, setLang, diagnostics }) {
  switch (state) {
    case 'landing':
      return <Landing lang={lang} setLang={setLang} />;
    case 'permission':
      return <Permission lang={lang} setLang={setLang} />;
    case 'loading':
      return <Loading lang={lang} setLang={setLang} />;
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
  const [lang, setLangRaw] = React.useState(() => {
    try {
      return localStorage.getItem('emo_proto_lang') || 'en';
    } catch {
      return 'en';
    }
  });
  const [nonce, setNonce] = React.useState(0);
  const [diagnostics, setDiagnostics] = React.useState(null);

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

  React.useEffect(() => {
    window.__setProtoState = setState;
    return () => {
      if (window.__setProtoState === setState) delete window.__setProtoState;
    };
  }, [setState]);

  React.useEffect(() => {
    if (state === 'loading') {
      preloadStep06({ full: true });
      const timer = setTimeout(() => setState('scan'), 2200);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [state, setState]);

  React.useEffect(() => {
    arAudio.setState(state);
    arAudio.preload();
    if (state === 'scan' || state === 'ar') {
      preloadStep06({ full: true });
    }
    if (state === 'scan') arAudio.startScan();
    else if (state === 'ar') arAudio.cueARIntro();
    else if (state !== 'loading') arAudio.stop();
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
      void arAudio.unlock(event);
      arAudio.playButtonClick();
    };
    const playClickSound = (event) => {
      const control = findInteractiveControl(event);
      if (!control) return;
      if (control === lastPointerSound.control && performance.now() - lastPointerSound.time < 600) return;
      void arAudio.unlock(event);
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

  const arActive = state === 'scan' || state === 'ar';

  return (
    <div className="app-shell">
      <SiteFontFaces />
      <MindARStage active={arActive} visible={arActive} onDiagnostics={handleDiagnostics} />
      <div key={nonce} className="ui-layer screen-enter">
        <ScreenFor state={state} lang={lang} setLang={setLang} diagnostics={diagnostics} />
      </div>
      <IcpFooter />
    </div>
  );
}
