import React from 'react';
import { LangChip, PillBtn, SectionLabel, TOKENS, FONT_MONO, langFont, t } from '../components/ui.jsx';
import { asset } from '../lib/assetUrl.js';

export function Permission({ lang = 'zh', setLang }) {
  const [probing, setProbing] = React.useState(false);

  const requestCamera = React.useCallback(async () => {
    if (probing) return;
    setProbing(true);
    if (!navigator.mediaDevices?.getUserMedia) {
      window.__setProtoState?.('error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      stream.getTracks().forEach((track) => track.stop());
      window.__setProtoState?.('loading');
    } catch (error) {
      const denied = error && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
      window.__setProtoState?.(denied ? 'denied' : 'error');
    } finally {
      setProbing(false);
    }
  }, [probing]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: TOKENS.cream }}>
      <div className="top-controls">
        <button type="button" data-interactive="true" onClick={() => window.__setProtoState?.('landing')} style={{ width: 38, height: 38, borderRadius: 999, border: 'none', background: 'rgba(31,26,31,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M10 2L4 7l6 5" stroke={TOKENS.ink} strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>
        </button>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: '0.18em', color: TOKENS.ink30 }}>{t(lang, '第 2 / 4 步', 'STEP 2 / 4')}</div>
        <LangChip lang={lang} onToggle={setLang} />
      </div>

      <div style={{ position: 'absolute', top: '19dvh', left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 'min(42vw, 172px)', aspectRatio: '1', borderRadius: 40, background: '#fff', boxShadow: '0 20px 40px rgba(242,156,176,0.3), inset 0 0 0 1px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <svg width="70" height="58" viewBox="0 0 70 58" fill="none">
            <rect x="2" y="10" width="66" height="46" rx="10" stroke={TOKENS.ink} strokeWidth="2.5" fill={TOKENS.pinkSoft} />
            <path d="M22 10 L26 2 L44 2 L48 10" stroke={TOKENS.ink} strokeWidth="2.5" fill="#fff" strokeLinejoin="round" />
            <circle cx="35" cy="33" r="13" stroke={TOKENS.ink} strokeWidth="2.5" fill="#fff" />
            <circle cx="35" cy="33" r="6" fill={TOKENS.pinkDeep} />
          </svg>
          <img src={asset('/assets/mascot/m_sprout.png')} alt="" style={{ position: 'absolute', right: -24, bottom: -18, width: 86, height: 86, objectFit: 'contain', filter: 'drop-shadow(0 8px 10px rgba(229,109,137,0.3))' }} />
        </div>
      </div>

      <div style={{ position: 'absolute', top: '47dvh', left: 0, right: 0, padding: '0 28px', textAlign: 'center' }}>
        <h2 style={{ margin: 0, fontFamily: langFont(lang), fontSize: 'clamp(24px, 7vw, 34px)', fontWeight: 800, color: TOKENS.ink, letterSpacing: 0 }}>{t(lang, '需要使用相机', 'Camera access needed')}</h2>
        <p style={{ margin: '18px auto 0', maxWidth: 420, fontFamily: langFont(lang), fontSize: lang === 'en' ? 13 : 14, lineHeight: 1.65, color: TOKENS.ink60, whiteSpace: 'pre-line' }}>
          {t(lang, '我们只在本次扫描中使用相机画面，\n不会上传或保存任何图像。', 'The camera stays on-device. Nothing is recorded.')}
        </p>
      </div>

      <div style={{ position: 'absolute', left: 'max(22px, calc(var(--safe-left) + 22px))', right: 'max(22px, calc(var(--safe-right) + 22px))', bottom: 'calc(var(--safe-bottom) + 138px)', maxWidth: 520, margin: '0 auto', padding: '12px 14px', borderRadius: 18, background: '#fff', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 6px 16px rgba(0,0,0,0.04)' }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: TOKENS.pinkSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="16" viewBox="0 0 14 16" fill="none"><path d="M7 1L1 3v5c0 4 3 6 6 7 3-1 6-3 6-7V3L7 1z" stroke={TOKENS.pinkDeep} strokeWidth="1.6" fill="none" strokeLinejoin="round" /></svg>
        </div>
        <SectionLabel lang={lang} zh="隐私说明" en="Privacy note" style={{ fontSize: 12 }} />
      </div>

      <div className="bottom-controls" style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'auto' }}>
        <PillBtn lang={lang} zh={probing ? '正在请求…' : '允许访问'} en={probing ? 'Requesting…' : 'Allow camera'} onClick={requestCamera} disabled={probing} />
        <PillBtn lang={lang} zh="暂不使用" en="Not now" variant="ghost" onClick={() => window.__setProtoState?.('denied')} />
      </div>
    </div>
  );
}
