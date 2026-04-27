import { IOSStatusBar, LangChip, PillBtn, TOKENS, langFont, t } from '../components/ui.jsx';
import { Mascot3D } from '../components/Mascot.jsx';

export function ErrorScreen({ lang = 'zh', setLang }) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: TOKENS.cream }}>
      <IOSStatusBar />
      <div className="top-controls">
        <button type="button" data-interactive="true" onClick={() => window.__setProtoState?.('landing')} style={{ width: 38, height: 38, borderRadius: 999, border: 'none', background: 'rgba(31,26,31,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M10 2L4 7l6 5" stroke={TOKENS.ink} strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>
        </button>
        <LangChip lang={lang} onToggle={setLang} />
      </div>
      <div style={{ marginTop: '20dvh', display: 'flex', justifyContent: 'center' }}><Mascot3D state="sprout" size={180} animate="bob" /></div>
      <div style={{ padding: '34px 28px 0', textAlign: 'center' }}>
        <h2 style={{ margin: 0, fontFamily: langFont(lang), fontSize: lang === 'en' ? 23 : 24, fontWeight: 800, color: TOKENS.ink }}>{t(lang, '出了点小状况', 'Something went sideways')}</h2>
        <p style={{ margin: '14px auto 0', maxWidth: 420, fontFamily: langFont(lang), fontSize: 13.5, lineHeight: 1.6, color: TOKENS.ink60 }}>{t(lang, '无法加载 AR 内容，请检查网络后重试。', "Couldn't load the AR scene. Check your connection and try again.")}</p>
      </div>
      <div className="bottom-controls" style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'auto' }}>
        <PillBtn lang={lang} zh="重新加载" en="Reload" onClick={() => window.__setProtoState?.('loading')} />
        <PillBtn lang={lang} zh="返回首页" en="Back home" variant="ghost" onClick={() => window.__setProtoState?.('landing')} />
      </div>
    </div>
  );
}
