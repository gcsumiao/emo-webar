import React from 'react';
import { LangChip, FrostButton, TOKENS, langFont, t } from '../components/ui.jsx';
import { useScanGeometry } from '../lib/viewport.js';

const MANUAL_LOCK_DELAY_MS = 3000;

function FlowerViewfinder({ cx, cy, size, color = TOKENS.pink, strokeWidth = 2.4 }) {
  const r = 0.30 * size;
  const d = 0.25 * size;
  const lobes = [0, 1, 2, 3, 4].map((i) => {
    const theta = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return { x: size / 2 + Math.cos(theta) * d, y: size / 2 + Math.sin(theta) * d };
  });
  const filterId = `flower-outline-${Math.round(size)}-${strokeWidth}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{
        position: 'absolute',
        left: cx - size / 2,
        top: cy - size / 2,
        pointerEvents: 'none',
        overflow: 'visible',
        filter: 'drop-shadow(0 0 6px rgba(242,156,176,0.45))',
      }}
    >
      <defs>
        <filter id={filterId} x="-5%" y="-5%" width="110%" height="110%">
          <feMorphology in="SourceGraphic" operator="erode" radius={strokeWidth / 2} result="eroded" />
          <feComposite in="SourceGraphic" in2="eroded" operator="out" />
        </filter>
      </defs>
      <g filter={`url(#${filterId})`}>
        {lobes.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={r} fill={color} />)}
      </g>
    </svg>
  );
}

function ScanSweepOverlay({ active = true }) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', opacity: active ? 1 : 0, transition: 'opacity 220ms ease', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, height: 4, marginTop: -2, borderRadius: 999, background: 'rgba(255,255,255,0.9)', boxShadow: '0 0 18px rgba(255,255,255,0.86), 0 0 42px rgba(242,156,176,0.58)', animation: 'scan-sweep 2.8s ease-in-out infinite' }} />
    </div>
  );
}

export function Scan({ lang = 'zh', setLang }) {
  const [scanState, setScanState] = React.useState('searching');
  const [showManualLock, setShowManualLock] = React.useState(false);
  const geometry = useScanGeometry();
  const isLocked = scanState === 'locked';
  const isLandscapePhone = geometry.orientation === 'landscape' && !geometry.isTablet && geometry.height < 520;

  React.useEffect(() => {
    let cancelled = false;
    let retryTimer = null;
    let offFound = null;
    let offLost = null;

    const bindMindAR = () => {
      if (cancelled) return;
      const mindar = window.__mindar;
      if (!mindar?.onTargetFound || !mindar?.onTargetLost) {
        retryTimer = window.setTimeout(bindMindAR, 80);
        return;
      }
      offFound = mindar.onTargetFound(() => {
        setShowManualLock(false);
        setScanState('locked');
      });
      offLost = mindar.onTargetLost(() => {
        setScanState((current) => current === 'locked' ? current : 'searching');
      });
    };

    bindMindAR();
    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      offFound?.();
      offLost?.();
    };
  }, []);

  React.useEffect(() => {
    if (isLocked) {
      setShowManualLock(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setShowManualLock(true), MANUAL_LOCK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isLocked]);

  React.useEffect(() => {
    if (!isLocked) return undefined;
    const timer = setTimeout(() => window.__setProtoState?.('ar'), 600);
    return () => clearTimeout(timer);
  }, [isLocked]);

  const scanHintStyle = {
    position: 'absolute',
    left: '50%',
    bottom: `calc(var(--safe-bottom) + ${isLandscapePhone ? 22 : 138}px)`,
    transform: 'translateX(-50%)',
    padding: '9px 16px',
    borderRadius: 999,
    background: 'rgba(0,0,0,0.26)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    color: 'rgba(255,255,255,0.86)',
    fontFamily: langFont(lang),
    fontSize: 11,
    whiteSpace: 'nowrap',
  };

  const scanHintText = isLocked
    ? t(lang, '已锁定，一毛出现中…', 'Locked · EMO is appearing…')
    : isLandscapePhone
      ? t(lang, '横屏模式 · 对准目标', 'Landscape · aim at target')
      : t(lang, '对准目标，自动扫描', 'Aim at the target · auto scanning');

  const lockManually = React.useCallback(() => {
    setShowManualLock(false);
    setScanState('locked');
  }, []);

  const lockButtonSize = isLandscapePhone ? 92 : 108;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: 'transparent' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: isLocked ? 0 : 1, transition: 'opacity 320ms ease-out', pointerEvents: 'none' }}>
        <FlowerViewfinder cx={geometry.scanCenterX} cy={geometry.scanCenterY} size={geometry.scanSize} />
      </div>
      <ScanSweepOverlay active={!isLocked} />
      <div className="top-controls">
        <FrostButton onClick={() => window.__setProtoState?.('landing')}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M10 2L4 7l6 5" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>
        </FrostButton>
        <LangChip lang={lang} onToggle={setLang} light />
      </div>

      {showManualLock && !isLocked && (
        <button
          type="button"
          aria-label={t(lang, '一键锁定目标', 'Tap to lock target')}
          onClick={lockManually}
          style={{
            position: 'absolute',
            left: geometry.scanCenterX,
            top: geometry.scanCenterY,
            transform: 'translate(-50%, -50%)',
            width: lockButtonSize,
            height: lockButtonSize,
            borderRadius: 999,
            border: 'none',
            background: 'rgba(31,26,31,0.78)',
            color: '#fff',
            fontFamily: langFont(lang),
            fontSize: isLandscapePhone ? 11 : 12,
            fontWeight: 800,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            boxShadow: '0 0 0 2px rgba(255,255,255,0.86), 0 0 0 7px rgba(244,183,200,0.34), 0 18px 36px rgba(0,0,0,0.34)',
            cursor: 'pointer',
            pointerEvents: 'auto',
            zIndex: 8,
            padding: 0,
          }}
        >
          <svg aria-hidden="true" width="32" height="32" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="9" fill="none" stroke="#fff" strokeWidth="2.2" />
            <circle cx="16" cy="16" r="2.8" fill={TOKENS.pink} />
            <path d="M16 3.5v6M16 22.5v6M3.5 16h6M22.5 16h6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          <span>{t(lang, '一键锁定', 'Tap to lock')}</span>
        </button>
      )}
      <div style={{ ...scanHintStyle, pointerEvents: 'none' }}>
        {scanHintText}
      </div>
    </div>
  );
}
