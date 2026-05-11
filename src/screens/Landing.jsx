import React from 'react';
import { LangChip, PillBtn, SectionLabel, TOKENS, FONT_MONO, t } from '../components/ui.jsx';
import { asset } from '../lib/assetUrl.js';
import { useViewport } from '../lib/viewport.js';

export function Landing({ lang = 'zh', setLang }) {
  const viewport = useViewport();
  const isLandscapePhone = viewport.orientation === 'landscape' && !viewport.isTablet && viewport.height < 520;
  const titleSrc = lang === 'en'
    ? asset('/assets/site-ui/home-title-en.svg')
    : asset('/assets/site-ui/home-title-zh.svg');

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg, #FFE4EA 0%, #FCD5DE 40%, #F8BCCB 100%)' }}>
      <img src={titleSrc} alt="" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', transform: 'translateX(-17vw)', pointerEvents: 'none', zIndex: 2, display: isLandscapePhone ? 'none' : 'block' }} />
      <img src={asset('/assets/site-ui/home-slogan.svg')} alt="" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', transform: 'translateY(11dvh)', pointerEvents: 'none', zIndex: 4, display: isLandscapePhone ? 'none' : 'block' }} />

      <div style={{ position: 'absolute', top: 'calc(var(--safe-top) + 15dvh)', right: 'calc(var(--safe-right) + 16px)', zIndex: 6, pointerEvents: 'auto' }}>
        <LangChip lang={lang} onToggle={setLang} />
      </div>

      <div style={{ position: 'absolute', top: isLandscapePhone ? '-18dvh' : '19dvh', left: 0, right: 0, height: isLandscapePhone ? '62dvh' : '38dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', zIndex: 1, opacity: isLandscapePhone ? 0.38 : 1 }}>
        <img
          src={asset('/assets/mascot-face-emoji.png')}
          alt=""
          style={{ width: isLandscapePhone ? 'min(54vw, 420px)' : 'min(94vw, 500px)', height: 'auto', animation: 'face-bob 5s ease-in-out infinite', filter: 'drop-shadow(0 30px 40px rgba(229,109,137,0.2))' }}
        />
      </div>

      <div className="bottom-controls" style={{ maxWidth: 560, margin: '0 auto', background: '#fff', borderRadius: 28, padding: '16px 18px 14px', boxShadow: '0 20px 40px rgba(229,109,137,0.22), 0 2px 8px rgba(0,0,0,0.04)', pointerEvents: 'auto', zIndex: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <SectionLabel lang={lang} zh="这样玩" en="How it works" style={{ color: TOKENS.emoPink, fontSize: 14 }} />
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: 'rgba(31,26,31,0.28)', letterSpacing: '0.16em' }}>{t(lang, '3 步', '3 STEPS')}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 18 }}>
          {[
            { n: 1, zh: '开启相机', en: 'Camera' },
            { n: 2, zh: '对准目标', en: 'Aim' },
            { n: 3, zh: '一毛出现', en: 'EMO!' },
          ].map((step) => (
            <div key={step.n} style={{ padding: '10px 6px 11px', borderRadius: 14, background: TOKENS.emoPinkLight, textAlign: 'center', minWidth: 0 }}>
              <div style={{ width: 20, height: 20, borderRadius: 999, background: TOKENS.emoPink, color: '#fff', fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>{step.n}</div>
              <div style={{ fontSize: lang === 'en' ? 12 : 11.5, fontWeight: 800, color: TOKENS.emoPink, lineHeight: 1.25 }}>{t(lang, step.zh, step.en)}</div>
            </div>
          ))}
        </div>
        <PillBtn
          lang={lang}
          zh="开始体验"
          en="Begin"
          icon={<span aria-hidden="true" style={{ width: 0, height: 0, borderTop: '7px solid transparent', borderBottom: '7px solid transparent', borderLeft: '9px solid #fff', display: 'block' }} />}
          onClick={() => window.__setProtoState?.('permission')}
          style={{ background: TOKENS.emoPink, color: '#fff', boxShadow: 'none' }}
        />
      </div>
    </div>
  );
}
