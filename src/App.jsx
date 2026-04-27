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
import { introFrameUrls, preloadStep06, preloadUrls } from './lib/step06Assets.js';

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
  const [state, setStateRaw] = React.useState(() => {
    try {
      const savedState = localStorage.getItem('emo_proto_state');
      return STATES.some((item) => item.key === savedState) ? savedState : 'landing';
    } catch {
      return 'landing';
    }
  });
  const [lang, setLangRaw] = React.useState(() => {
    try {
      return localStorage.getItem('emo_proto_lang') || 'zh';
    } catch {
      return 'zh';
    }
  });
  const [nonce, setNonce] = React.useState(0);
  const [diagnostics, setDiagnostics] = React.useState(null);

  const setState = React.useCallback((nextState) => {
    setStateRaw(nextState);
    setNonce((value) => value + 1);
    try {
      localStorage.setItem('emo_proto_state', nextState);
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
      preloadStep06({ full: false });
      const timer = setTimeout(() => setState('scan'), 2200);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [state, setState]);

  React.useEffect(() => {
    arAudio.preload();
    if (state === 'scan' || state === 'ar') {
      preloadStep06({ full: false });
      preloadUrls(introFrameUrls);
    }
    if (state === 'scan') arAudio.startScan();
    else if (state === 'ar') arAudio.cueARIntro();
    else arAudio.stop();
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
      <MindARStage active={arActive} visible={arActive} onDiagnostics={handleDiagnostics} />
      <div key={nonce} className="ui-layer screen-enter">
        <ScreenFor state={state} lang={lang} setLang={setLang} diagnostics={diagnostics} />
      </div>
    </div>
  );
}
