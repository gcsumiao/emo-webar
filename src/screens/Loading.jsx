import React from 'react';
import { GitHubCredit, TOKENS, FONT_MONO, langFont, t } from '../components/ui.jsx';
import { Mascot3D } from '../components/Mascot.jsx';
import { useViewport } from '../lib/viewport.js';

export function Loading({ lang = 'zh', hasCameraPreview = false }) {
  const viewport = useViewport();
  const isLandscapePhone = viewport.orientation === 'landscape' && !viewport.isTablet && viewport.height < 520;
  const background = hasCameraPreview ? 'rgba(13,15,19,0.34)' : '#0d0f13';
  const overlay = hasCameraPreview
    ? 'linear-gradient(180deg, rgba(0,0,0,0.16), rgba(13,15,19,0.42))'
    : 'radial-gradient(80% 50% at 50% 40%, #2a2028 0%, #0d0f13 70%)';
  const mascotSize = isLandscapePhone ? 96 : 160;
  const mascotGap = isLandscapePhone ? 16 : 28;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background }}>
      <div style={{ position: 'absolute', inset: 0, background: overlay }} />
      <GitHubCredit tone="light" placement="lower-left" />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        <div style={{ marginBottom: mascotGap, lineHeight: 0 }}>
          <Mascot3D state="sprout" size={mascotSize} animate="bob" loadingOptimized />
        </div>
        <div style={{ width: 220, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, ${TOKENS.pink} 0%, ${TOKENS.pinkDeep} 100%)`, borderRadius: 999, boxShadow: `0 0 10px ${TOKENS.pink}`, animation: 'loading-bar-fill 1.8s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)', width: '40%', animation: 'loading-bar-shimmer 1.6s ease-in-out infinite', mixBlendMode: 'screen' }} />
        </div>
        <div style={{ marginTop: 18, textAlign: 'center', fontFamily: langFont(lang), fontSize: 18, fontWeight: 700, color: '#fff' }}>{t(lang, '唤醒一毛中…', 'Waking up EMO…')}</div>
        <div style={{ marginTop: 8, textAlign: 'center', fontFamily: FONT_MONO, fontSize: 10, lineHeight: 1.4, color: 'rgba(255,255,255,0.48)', letterSpacing: '0.18em' }}>
          {t(lang, '首次加载约需 3-5 秒', 'FIRST LOAD · 3-5 SECONDS')}
        </div>
      </div>
    </div>
  );
}
