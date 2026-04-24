// Shared tokens + landing / QR / permission screens

const TOKENS = {
  pink: '#F29CB0',
  pinkDeep: '#E56D89',
  pinkSoft: '#FCE3EA',
  cream: '#FFF7F0',
  creamDeep: '#FBEDE0',
  ink: '#1F1A1F',
  ink60: 'rgba(31,26,31,0.6)',
  ink30: 'rgba(31,26,31,0.3)',
  green: '#A9D45A',
};

const FONT_ZH = "'Noto Sans SC', 'PingFang SC', system-ui, sans-serif";
const FONT_EN = "'Gantari', 'Inter', system-ui, sans-serif";
const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace";

function t(lang, zh, en) {
  return lang === 'en' ? en : zh;
}

function langFont(lang) {
  return lang === 'en' ? FONT_EN : FONT_ZH;
}

function PillBtn({ lang = 'zh', zh, en, variant = 'primary', icon, onClick, style = {} }) {
  const primary = variant === 'primary';
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        padding: '14px 20px',
        borderRadius: 999,
        border: primary ? 'none' : `1px solid ${TOKENS.ink30}`,
        background: primary ? TOKENS.ink : 'transparent',
        color: primary ? TOKENS.cream : TOKENS.ink,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        cursor: 'pointer',
        boxShadow: primary ? '0 8px 20px rgba(31,26,31,0.18)' : 'none',
        ...style,
      }}
    >
      {icon}
      <div
        style={{
          fontFamily: langFont(lang),
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: lang === 'en' ? '0.01em' : '0.04em',
        }}
      >
        {t(lang, zh, en)}
      </div>
    </button>
  );
}

function LangChip({ lang = 'zh', onToggle }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: 4,
        borderRadius: 999,
        background: 'rgba(31,26,31,0.06)',
        color: TOKENS.ink60,
        position: 'relative',
        zIndex: 6,
      }}
    >
      {[
        { key: 'zh', label: '中' },
        { key: 'en', label: 'EN' },
      ].map((option) => (
        <button
          key={option.key}
          onClick={() => onToggle?.(option.key)}
          style={{
            minWidth: option.key === 'en' ? 44 : 34,
            height: 28,
            padding: '0 10px',
            borderRadius: 999,
            border: 'none',
            background: lang === option.key ? '#fff' : 'transparent',
            color: lang === option.key ? TOKENS.ink : TOKENS.ink60,
            fontFamily: option.key === 'en' ? FONT_MONO : FONT_ZH,
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: lang === option.key ? '0 2px 10px rgba(31,26,31,0.08)' : 'none',
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SectionLabel({ lang, zh, en, style = {} }) {
  return (
    <div
      style={{
        fontFamily: langFont(lang),
        fontSize: 13,
        fontWeight: 700,
        color: TOKENS.ink,
        ...style,
      }}
    >
      {t(lang, zh, en)}
    </div>
  );
}

function BodyCopy({ lang, zh, en, style = {} }) {
  return (
    <div
      style={{
        fontFamily: langFont(lang),
        fontSize: lang === 'en' ? 13 : 14,
        lineHeight: 1.6,
        color: TOKENS.ink60,
        ...style,
      }}
    >
      {t(lang, zh, en)}
    </div>
  );
}

function ScreenLanding({ lang = 'zh', setLang }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #FFE4EA 0%, #FCD5DE 40%, #F8BCCB 100%)',
      }}
    >
      <IOSStatusBar />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="assets/mascot/m_sprout.png" style={{ width: 28, height: 28, objectFit: 'contain' }} />
          <div
            style={{
              fontFamily: langFont(lang),
              fontWeight: 800,
              fontSize: 15,
              color: TOKENS.ink,
            }}
          >
            {t(lang, '一毛', 'EMO')}
          </div>
        </div>
        <LangChip lang={lang} onToggle={setLang} />
      </div>

      <div
        style={{
          position: 'absolute',
          top: 80,
          left: 0,
          right: 0,
          height: 380,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <img
          src="assets/mascot-face-emoji.png"
          style={{
            width: '110%',
            maxWidth: 520,
            height: 'auto',
            animation: 'face-bob 5s ease-in-out infinite',
            filter: 'drop-shadow(0 30px 40px rgba(229,109,137,0.2))',
          }}
        />
      </div>

      <div style={{ position: 'absolute', top: 60, left: 28, width: 42, height: 14, borderRadius: 20, background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }} />
      <div style={{ position: 'absolute', top: 100, right: 28, width: 28, height: 10, borderRadius: 20, background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }} />

      <div style={{ position: 'absolute', top: 440, left: 0, right: 0, textAlign: 'center', padding: '0 24px' }}>
        <div
          style={{
            fontFamily: lang === 'en' ? FONT_MONO : FONT_ZH,
            fontSize: 11,
            letterSpacing: lang === 'en' ? '0.18em' : '0.2em',
            color: TOKENS.pinkDeep,
            textTransform: 'uppercase',
          }}
        >
          {t(lang, 'AR 限定 · CAMPAIGN', 'AR LIMITED · CAMPAIGN')}
        </div>
        <h1
          style={{
            margin: '8px 0 4px',
            fontFamily: langFont(lang),
            fontWeight: 800,
            fontSize: lang === 'en' ? 28 : 30,
            lineHeight: 1.1,
            color: TOKENS.ink,
            letterSpacing: '-0.01em',
          }}
        >
          {t(lang, '一毛来和你玩', 'EMO wants to play.')}
        </h1>
        <div
          style={{
            fontFamily: langFont(lang),
            fontSize: lang === 'en' ? 13 : 14,
            color: TOKENS.ink60,
            marginTop: 2,
          }}
        >
          {t(lang, '限定 AR 互动体验', 'Limited AR campaign')}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 24,
          background: '#fff',
          borderRadius: 28,
          padding: '16px 18px 14px',
          boxShadow: '0 20px 40px rgba(229,109,137,0.22), 0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <SectionLabel lang={lang} zh="这样玩" en="How it works" />
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: TOKENS.ink30, letterSpacing: '0.1em' }}>
            {t(lang, '3 步', '3 STEPS')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {[
            { n: 1, zh: '开启相机', en: 'Camera' },
            { n: 2, zh: '对准目标', en: 'Aim' },
            { n: 3, zh: '一毛出现', en: 'EMO!' },
          ].map((step) => (
            <div
              key={step.n}
              style={{
                flex: 1,
                padding: '8px 6px 10px',
                borderRadius: 14,
                background: TOKENS.creamDeep,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  background: TOKENS.ink,
                  color: TOKENS.cream,
                  fontFamily: FONT_MONO,
                  fontSize: 10.5,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 8px',
                }}
              >
                {step.n}
              </div>
              <div
                style={{
                  fontFamily: langFont(lang),
                  fontSize: lang === 'en' ? 10.5 : 11,
                  fontWeight: 600,
                  color: TOKENS.ink,
                  lineHeight: 1.3,
                }}
              >
                {t(lang, step.zh, step.en)}
              </div>
            </div>
          ))}
        </div>
        <PillBtn
          lang={lang}
          zh="开始体验"
          en="Begin"
          onClick={() => window.__setProtoState?.('permission')}
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M5 2l7 6-7 6V2z" fill="currentColor" />
            </svg>
          }
        />
      </div>
    </div>
  );
}

function ScreenPermission({ lang = 'zh', setLang }) {
  const [probing, setProbing] = React.useState(false);

  // Ask the browser for camera access up front so we can route the user to
  // `denied`/`error` before MindAR boots. We immediately release the probe
  // stream — MindAR's start() will request its own.
  const requestCamera = React.useCallback(async () => {
    if (probing) return;
    setProbing(true);
    if (!navigator.mediaDevices?.getUserMedia) {
      window.__setProtoState?.('error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });
      stream.getTracks().forEach((track) => track.stop());
      window.__setProtoState?.('loading');
    } catch (err) {
      const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      window.__setProtoState?.(denied ? 'denied' : 'error');
    } finally {
      setProbing(false);
    }
  }, [probing]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: TOKENS.cream,
      }}
    >
      <IOSStatusBar />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px 0' }}>
        <button
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            border: 'none',
            background: 'rgba(31,26,31,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path d="M10 2L4 7l6 5" stroke={TOKENS.ink} strokeWidth="1.8" fill="none" strokeLinecap="round" />
          </svg>
        </button>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: '0.18em', color: TOKENS.ink30 }}>
          {t(lang, '第 2 / 4 步', 'STEP 2 / 4')}
        </div>
        <LangChip lang={lang} onToggle={setLang} />
      </div>

      <div style={{ marginTop: 30, position: 'relative', display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            width: 160,
            height: 160,
            borderRadius: 40,
            background: '#fff',
            boxShadow: '0 20px 40px rgba(242,156,176,0.3), inset 0 0 0 1px rgba(0,0,0,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <svg width="70" height="58" viewBox="0 0 70 58" fill="none">
            <rect x="2" y="10" width="66" height="46" rx="10" stroke={TOKENS.ink} strokeWidth="2.5" fill={TOKENS.pinkSoft} />
            <path d="M22 10 L26 2 L44 2 L48 10" stroke={TOKENS.ink} strokeWidth="2.5" fill="#fff" strokeLinejoin="round" />
            <circle cx="35" cy="33" r="13" stroke={TOKENS.ink} strokeWidth="2.5" fill="#fff" />
            <circle cx="35" cy="33" r="6" fill={TOKENS.pinkDeep} />
            <circle cx="56" cy="20" r="2" fill={TOKENS.ink} />
          </svg>
          <div style={{ position: 'absolute', right: -26, bottom: -20, transform: 'rotate(10deg)' }}>
            <img src="assets/mascot/m_sprout.png" style={{ width: 86, height: 86, objectFit: 'contain', filter: 'drop-shadow(0 8px 10px rgba(229,109,137,0.3))' }} />
          </div>
          <svg width="200" height="200" style={{ position: 'absolute', inset: -20, pointerEvents: 'none' }}>
            <circle cx="100" cy="100" r="94" stroke={TOKENS.pinkDeep} strokeWidth="1.2" strokeDasharray="3 6" fill="none" opacity="0.5" />
          </svg>
        </div>
      </div>

      <div style={{ padding: '56px 28px 0', textAlign: 'center' }}>
        <h2
          style={{
            margin: 0,
            fontFamily: langFont(lang),
            fontSize: lang === 'en' ? 24 : 26,
            fontWeight: 800,
            color: TOKENS.ink,
            letterSpacing: '-0.01em',
          }}
        >
          {t(lang, '需要使用相机', 'Camera access needed')}
        </h2>
        <p
          style={{
            margin: '18px 22px 0',
            fontFamily: langFont(lang),
            fontSize: lang === 'en' ? 13 : 14,
            lineHeight: 1.65,
            color: TOKENS.ink60,
          }}
        >
          {t(
            lang,
            '我们只在本次扫描中使用相机画面，\n不会上传或保存任何图像。',
            'The camera stays on-device. Nothing is recorded.'
          )}
        </p>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 22,
          right: 22,
          bottom: 140,
          padding: '12px 14px',
          borderRadius: 18,
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 6px 16px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ width: 32, height: 32, borderRadius: 10, background: TOKENS.pinkSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
            <path d="M7 1L1 3v5c0 4 3 6 6 7 3-1 6-3 6-7V3L7 1z" stroke={TOKENS.pinkDeep} strokeWidth="1.6" fill="none" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <SectionLabel lang={lang} zh="隐私说明" en="Privacy note" style={{ fontSize: 12 }} />
        </div>
        <svg width="8" height="12" viewBox="0 0 8 12">
          <path d="M1 1l6 5-6 5" stroke={TOKENS.ink30} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </svg>
      </div>

      <div style={{ position: 'absolute', left: 16, right: 16, bottom: 28, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PillBtn lang={lang} zh="允许访问" en="Allow camera" onClick={requestCamera} />
        <PillBtn lang={lang} zh="暂不使用" en="Not now" variant="ghost" onClick={() => window.__setProtoState?.('denied')} />
      </div>
    </div>
  );
}

function ScreenQR({ lang = 'zh' }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: `linear-gradient(180deg, ${TOKENS.cream} 0%, #FBE3EA 100%)`,
      }}
    >
      <IOSStatusBar />
      <div style={{ padding: '60px 24px 0', textAlign: 'center' }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.22em', color: TOKENS.pinkDeep }}>
          {t(lang, 'SCAN · 扫一扫', 'SCAN')}
        </div>
        <h2
          style={{
            margin: '10px 0 4px',
            fontFamily: langFont(lang),
            fontSize: lang === 'en' ? 22 : 24,
            fontWeight: 800,
            color: TOKENS.ink,
          }}
        >
          {t(lang, '扫描海报上的二维码', 'Scan the QR on the poster')}
        </h2>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 180,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 220,
          height: 220,
          borderRadius: 28,
          background: '#fff',
          boxShadow: '0 20px 40px rgba(229,109,137,0.2)',
          padding: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 10,
            background: `
              linear-gradient(#1F1A1F,#1F1A1F) center/100% 4px no-repeat,
              repeating-conic-gradient(${TOKENS.ink} 0% 25%, #fff 0% 50%) 50% / 12px 12px
            `,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {[[0, 0], [0, 1], [1, 0]].map(([r, c], i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: 48,
                height: 48,
                top: r ? 'auto' : 8,
                bottom: r ? 8 : 'auto',
                left: c ? 'auto' : 8,
                right: c ? 8 : 'auto',
                background: '#fff',
                border: `6px solid ${TOKENS.ink}`,
                borderRadius: 4,
              }}
            />
          ))}
          <div
            style={{
              position: 'absolute',
              inset: '40%',
              width: 40,
              height: 40,
              borderRadius: 10,
              background: TOKENS.pinkDeep,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img src="assets/mascot/m_sprout.png" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 24,
          right: 24,
          bottom: 100,
          textAlign: 'center',
          fontFamily: langFont(lang),
          fontSize: lang === 'en' ? 12 : 13,
          color: TOKENS.ink60,
          lineHeight: 1.6,
        }}
      >
        {t(lang, '打开微信或相机扫描二维码', 'Open WeChat or Camera to scan')}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 28,
          padding: '12px 16px',
          borderRadius: 18,
          background: TOKENS.ink,
          color: TOKENS.cream,
          fontFamily: FONT_MONO,
          fontSize: 11,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>emo.ar/scan</span>
        <span style={{ opacity: 0.6 }}>{t(lang, '→ 浏览器打开', '→ open in browser')}</span>
      </div>
    </div>
  );
}

Object.assign(window, {
  TOKENS,
  FONT_ZH,
  FONT_EN,
  FONT_MONO,
  t,
  langFont,
  PillBtn,
  LangChip,
  ScreenLanding,
  ScreenPermission,
  ScreenQR,
});
