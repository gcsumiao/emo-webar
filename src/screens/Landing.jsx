import { LangChip, PillBtn, SectionLabel, TOKENS, FONT_MONO, langFont, t } from '../components/ui.jsx';
import { asset } from '../lib/assetUrl.js';

export function Landing({ lang = 'zh', setLang }) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg, #FFE4EA 0%, #FCD5DE 40%, #F8BCCB 100%)' }}>
      <div className="top-controls">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src={asset('/assets/mascot/m_sprout.png')} alt="" style={{ width: 30, height: 30, objectFit: 'contain' }} />
          <div style={{ fontFamily: langFont(lang), fontWeight: 800, fontSize: 16, color: TOKENS.ink }}>{t(lang, '一毛', 'EMO')}</div>
        </div>
        <LangChip lang={lang} onToggle={setLang} />
      </div>

      <div style={{ position: 'absolute', top: '10dvh', left: 0, right: 0, height: '44dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <img
          src={asset('/assets/mascot-face-emoji.png')}
          alt=""
          style={{ width: 'min(112vw, 620px)', height: 'auto', animation: 'face-bob 5s ease-in-out infinite', filter: 'drop-shadow(0 30px 40px rgba(229,109,137,0.2))' }}
        />
      </div>

      <div style={{ position: 'absolute', top: '54dvh', left: 0, right: 0, textAlign: 'center', padding: '0 24px' }}>
        <div style={{ fontFamily: lang === 'en' ? FONT_MONO : langFont(lang), fontSize: 11, letterSpacing: lang === 'en' ? '0.18em' : '0.2em', color: TOKENS.pinkDeep, textTransform: 'uppercase' }}>
          {t(lang, 'AR 限定 · CAMPAIGN', 'AR LIMITED · CAMPAIGN')}
        </div>
        <h1 style={{ margin: '8px 0 4px', fontFamily: langFont(lang), fontWeight: 800, fontSize: 'clamp(28px, 8vw, 40px)', lineHeight: 1.1, color: TOKENS.ink, letterSpacing: 0 }}>
          {t(lang, '一毛来和你玩', 'EMO wants to play.')}
        </h1>
        <div style={{ fontFamily: langFont(lang), fontSize: lang === 'en' ? 13 : 14, color: TOKENS.ink60, marginTop: 2 }}>
          {t(lang, '限定 AR 互动体验', 'Limited AR campaign')}
        </div>
      </div>

      <div className="bottom-controls" style={{ maxWidth: 560, margin: '0 auto', background: '#fff', borderRadius: 28, padding: '16px 18px 14px', boxShadow: '0 20px 40px rgba(229,109,137,0.22), 0 2px 8px rgba(0,0,0,0.04)', pointerEvents: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <SectionLabel lang={lang} zh="这样玩" en="How it works" />
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: TOKENS.ink30, letterSpacing: '0.1em' }}>{t(lang, '3 步', '3 STEPS')}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 18 }}>
          {[
            { n: 1, zh: '开启相机', en: 'Camera' },
            { n: 2, zh: '对准目标', en: 'Aim' },
            { n: 3, zh: '一毛出现', en: 'EMO!' },
          ].map((step) => (
            <div key={step.n} style={{ padding: '8px 6px 10px', borderRadius: 14, background: TOKENS.creamDeep, textAlign: 'center', minWidth: 0 }}>
              <div style={{ width: 20, height: 20, borderRadius: 999, background: TOKENS.ink, color: TOKENS.cream, fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>{step.n}</div>
              <div style={{ fontFamily: langFont(lang), fontSize: lang === 'en' ? 10.5 : 11, fontWeight: 700, color: TOKENS.ink, lineHeight: 1.3 }}>{t(lang, step.zh, step.en)}</div>
            </div>
          ))}
        </div>
        <PillBtn lang={lang} zh="开始体验" en="Begin" onClick={() => window.__setProtoState?.('permission')} />
      </div>
    </div>
  );
}
