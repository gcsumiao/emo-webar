import React from 'react';
import { LangChip, FrostButton, TOKENS, langFont, t } from '../components/ui.jsx';
import { getARRuntime } from '../ar/arRuntime.js';
import { asset } from '../lib/assetUrl.js';
import { useScanGeometry } from '../lib/viewport.js';

const MANUAL_LOCK_DELAY_MS = 3000;
const SCAN_FRAME_BOUNDS = {
  x: 219,
  y: 505,
  width: 642,
  height: 634,
  viewBoxWidth: 1080,
  viewBoxHeight: 1920,
};

function ScanFrameViewfinder({ cx, cy, size }) {
  const targetWidth = size * 1.22;
  const scale = targetWidth / SCAN_FRAME_BOUNDS.width;
  const frameWidth = SCAN_FRAME_BOUNDS.viewBoxWidth * scale;
  const frameHeight = SCAN_FRAME_BOUNDS.viewBoxHeight * scale;
  const frameCenterX = (SCAN_FRAME_BOUNDS.x + SCAN_FRAME_BOUNDS.width / 2) * scale;
  const frameCenterY = (SCAN_FRAME_BOUNDS.y + SCAN_FRAME_BOUNDS.height / 2) * scale;

  return (
    <img
      src={asset('/assets/site-ui/scan-frame.svg')}
      alt=""
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: cx - frameCenterX,
        top: cy - frameCenterY,
        width: frameWidth,
        height: frameHeight,
        pointerEvents: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    />
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
  const scanControlOffset = isLandscapePhone ? 8 : 12;

  React.useEffect(() => {
    let cancelled = false;
    let retryTimer = null;
    let mockRecognitionTimer = null;
    let offFound = null;
    let offLost = null;

    const bindRuntime = () => {
      if (cancelled) return;
      const runtime = getARRuntime();
      if (!runtime?.onTargetFound || !runtime?.onTargetLost) {
        retryTimer = window.setTimeout(bindRuntime, 80);
        return;
      }
      offFound = runtime.onTargetFound(() => {
        setShowManualLock(false);
        setScanState('locked');
      });
      offLost = runtime.onTargetLost(() => {
        setScanState((current) => current === 'locked' ? current : 'searching');
      });
      mockRecognitionTimer = window.setTimeout(async () => {
        try {
          const result = await runtime.recognizeFrameMock?.({ collectionId: runtime.collectionId });
          if (cancelled || !result?.matched) return;
          runtime.applyRecognitionResult?.(result);
        } catch (error) {
          console.warn('[EMO-AR] mock cloud recognition failed', error);
        }
      }, 120);
    };

    bindRuntime();
    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      window.clearTimeout(mockRecognitionTimer);
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

  const scanControlStyle = {
    position: 'absolute',
    left: '50%',
    top: geometry.scanCenterY + geometry.scanSize / 2 + scanControlOffset,
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: isLandscapePhone ? 12 : 16,
    pointerEvents: 'none',
    zIndex: 8,
  };

  const scanHintStyle = {
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

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: 'transparent' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: isLocked ? 0 : 1, transition: 'opacity 320ms ease-out', pointerEvents: 'none' }}>
        <ScanFrameViewfinder cx={geometry.scanCenterX} cy={geometry.scanCenterY} size={geometry.scanSize} />
      </div>
      <ScanSweepOverlay active={!isLocked} />
      <div className="top-controls">
        <FrostButton onClick={() => window.__setProtoState?.('landing')}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M10 2L4 7l6 5" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>
        </FrostButton>
        <LangChip lang={lang} onToggle={setLang} light />
      </div>

      <div style={scanControlStyle}>
        <div style={scanHintStyle}>
          {scanHintText}
        </div>
        {showManualLock && !isLocked && (
          <button
            type="button"
            aria-label={t(lang, '一键锁定目标', 'Tap to lock target')}
            onClick={lockManually}
            style={{
              minWidth: 112,
              minHeight: 88,
              border: 'none',
              background: 'transparent',
              color: '#fff',
              fontFamily: langFont(lang),
              fontSize: isLandscapePhone ? 12 : 13,
              fontWeight: 800,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              cursor: 'pointer',
              pointerEvents: 'auto',
              padding: '8px 12px',
              textShadow: '0 2px 8px rgba(0,0,0,0.55)',
            }}
          >
            <svg aria-hidden="true" width="46" height="46" viewBox="0 0 32 32" style={{ filter: 'drop-shadow(0 3px 9px rgba(0,0,0,0.48))' }}>
              <circle cx="16" cy="16" r="9" fill="none" stroke="#fff" strokeWidth="2.4" />
              <circle cx="16" cy="16" r="2.8" fill={TOKENS.pink} />
              <path d="M16 3.5v6M16 22.5v6M3.5 16h6M22.5 16h6" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
            <span>{t(lang, '一键锁定', 'Tap to lock')}</span>
          </button>
        )}
      </div>
    </div>
  );
}
