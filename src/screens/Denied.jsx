import { LangChip, PillBtn, TOKENS, langFont, t } from '../components/ui.jsx';
import { Mascot3D } from '../components/Mascot.jsx';

export function Denied({ lang = 'zh', setLang }) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: `linear-gradient(180deg, #FFF4F4 0%, ${TOKENS.cream} 100%)` }}>
      <div className="top-controls">
        <button type="button" data-interactive="true" onClick={() => window.__setProtoState?.('landing')} style={{ width: 38, height: 38, borderRadius: 999, border: 'none', background: 'rgba(31,26,31,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M10 2L4 7l6 5" stroke={TOKENS.ink} strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>
        </button>
        <LangChip lang={lang} onToggle={setLang} />
      </div>
      <div style={{ marginTop: '18dvh', position: 'relative', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 190, height: 190, borderRadius: '50%', background: 'radial-gradient(closest-side, #FFE5EA, rgba(255,229,234,0) 80%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Mascot3D state="idle" size={170} animate="bob" />
        </div>
      </div>
      <div style={{ padding: '34px 28px 0', textAlign: 'center' }}>
        <h2 style={{ margin: 0, fontFamily: langFont(lang), fontSize: lang === 'en' ? 23 : 24, fontWeight: 800, color: TOKENS.ink }}>{t(lang, '未获得相机权限', 'Camera access is blocked')}</h2>
        <p style={{ margin: '16px auto 0', maxWidth: 420, fontFamily: langFont(lang), fontSize: 13.5, lineHeight: 1.6, color: TOKENS.ink60 }}>{t(lang, '要让一毛出现，请在浏览器设置中开启相机权限。', 'To let EMO appear, enable camera access in your browser settings.')}</p>
      </div>
      <div className="bottom-controls" style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'auto' }}>
        <PillBtn lang={lang} zh="重新尝试" en="Try again" onClick={() => window.__setProtoState?.('permission')} />
      </div>
    </div>
  );
}
