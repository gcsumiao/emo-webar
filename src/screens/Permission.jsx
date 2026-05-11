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
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: TOKENS.emoPinkLight }}>
      <div className="top-controls">
        <button type="button" data-interactive="true" onClick={() => window.__setProtoState?.('landing')} style={{ width: 38, height: 38, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M10 2L4 7l6 5" stroke={TOKENS.ink} strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>
        </button>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: '0.42em', color: 'rgba(31,26,31,0.28)' }}>{t(lang, '第 2 / 4 步', 'STEP 2 / 4')}</div>
        <LangChip lang={lang} onToggle={setLang} />
      </div>

      <img src={asset('/assets/site-ui/camera-graphic.svg')} alt="" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', pointerEvents: 'none' }} />

      <div style={{ position: 'absolute', top: '51dvh', left: 0, right: 0, padding: '0 28px', textAlign: 'center' }}>
        <h2 style={{ margin: 0, fontFamily: langFont(lang), fontSize: 'clamp(28px, 8vw, 40px)', fontWeight: 900, color: TOKENS.emoTextPink, letterSpacing: 0 }}>{t(lang, '需要使用相机', 'Camera access needed')}</h2>
        <p style={{ margin: '8px auto 0', maxWidth: 520, fontFamily: langFont(lang), fontSize: lang === 'en' ? 15 : 14.5, fontWeight: 800, lineHeight: 1.45, color: '#fff', whiteSpace: 'pre-line' }}>
          {t(lang, '我们只在本次扫描中使用相机画面，\n不会上传或保存任何图像。', 'The camera stays on-device. Nothing is recorded.')}
        </p>
      </div>

      <div style={{ position: 'absolute', left: 'max(22px, calc(var(--safe-left) + 22px))', right: 'max(22px, calc(var(--safe-right) + 22px))', bottom: 'calc(var(--safe-bottom) + 138px)', maxWidth: 560, margin: '0 auto', padding: '12px 16px', borderRadius: 18, border: `2px solid ${TOKENS.emoGray}`, background: '#fff', display: 'flex', alignItems: 'center', gap: 12, boxShadow: 'none' }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: TOKENS.pinkSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="16" viewBox="0 0 14 16" fill="none"><path d="M7 1L1 3v5c0 4 3 6 6 7 3-1 6-3 6-7V3L7 1z" stroke={TOKENS.emoPink} strokeWidth="1.6" fill="none" strokeLinejoin="round" /></svg>
        </div>
        <SectionLabel lang={lang} zh="隐私说明" en="Privacy note" style={{ fontSize: 13, color: TOKENS.emoPink }} />
      </div>

      <div className="bottom-controls" style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'auto' }}>
        <PillBtn lang={lang} zh={probing ? '正在请求…' : '允许访问'} en={probing ? 'Requesting…' : 'Allow Camera'} onClick={requestCamera} disabled={probing} style={{ background: TOKENS.emoPink, color: '#fff', boxShadow: 'none' }} />
        <PillBtn lang={lang} zh="暂不使用" en="Not now" variant="ghost" onClick={() => window.__setProtoState?.('denied')} style={{ background: '#fff', color: TOKENS.emoPink, border: `2px solid ${TOKENS.emoPinkLight}`, boxShadow: 'none' }} />
      </div>
    </div>
  );
}
