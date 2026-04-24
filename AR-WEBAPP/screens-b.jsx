// Scan, AR active, denied, error, loading screens

// Flower-shaped (sakura) viewfinder matches the reference video 10249.MP4.
// Coordinates are in the 390×820 phone frame.
const SCAN_FLOWER_FRAME = { cx: 195, cy: 430, size: 270 };
const INTRO_FRAME_RANGES = [[9, 80], [190, 300]];
const INTRO_FRAME_URLS = INTRO_FRAME_RANGES.flatMap(([start, end]) =>
  Array.from(
    { length: end - start + 1 },
    (_, i) => `assets/step06/intro-hq/1_${String(start + i).padStart(4, '0')}.png`
  )
);
const INTRO_DURATION_MS = Math.round((INTRO_FRAME_URLS.length / 30) * 1000);

// Pink 5-lobed sakura viewfinder outline — shape matches 10249.MP4.
// Five filled circles unioned, then a morphological erosion is composited out
// to yield a uniform-width outline of the union silhouette.
function FlowerViewfinder({ cx, cy, size, color = TOKENS.pink, strokeWidth = 2.4 }) {
  // Render in raw pixel units so feMorphology radius is interpretable.
  // r > d ensures the central region is covered by every lobe (no inner hole).
  const r = 0.30 * size;
  const d = 0.25 * size;
  const lobes = [0, 1, 2, 3, 4].map((i) => {
    const theta = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return { x: size / 2 + Math.cos(theta) * d, y: size / 2 + Math.sin(theta) * d };
  });
  const filterId = `flower-outline-${size}-${strokeWidth}`;
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
        {lobes.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={r} fill={color} />
        ))}
      </g>
    </svg>
  );
}

function ScanSweepOverlay({ active = true }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        opacity: active ? 1 : 0,
        transition: 'opacity 220ms ease',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: 4,
          marginTop: -2,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.9)',
          boxShadow: '0 0 18px rgba(255,255,255,0.86), 0 0 42px rgba(242,156,176,0.58)',
          animation: 'scan-sweep 2.8s ease-in-out infinite',
        }}
      />
    </div>
  );
}

function FrostButton({ children, onClick, disabled = false, style = {}, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        height: 38,
        borderRadius: 999,
        border: 'none',
        background: 'rgba(255,255,255,0.18)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        color: '#fff',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        opacity: disabled ? 0.72 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ─── SCREEN 3: Scan — looking for target ──────────────────────
// Drives from the shared MindAR runtime (window.__mindar). Only decoration:
// a pink flower-shaped viewfinder that fades out on targetFound.
function ScreenScan({ lang = 'zh', setLang }) {
  const [scanState, setScanState] = React.useState('searching');
  const [mindarStatus, setMindarStatus] = React.useState(() => window.__mindar?.getStatus?.() || 'idle');
  const lockTimerRef = React.useRef(null);
  const isLocked = scanState === 'locked';
  const isFocusing = scanState === 'focusing';

  React.useEffect(() => {
    const mindar = window.__mindar;
    if (!mindar) return undefined;
    const offStatus = mindar.onStatus?.(setMindarStatus) || (() => {});
    const offFound = mindar.onTargetFound(() => setScanState('locked'));
    const offLost  = mindar.onTargetLost(() => {
      setScanState((current) => current === 'locked' ? current : 'searching');
    });
    return () => { offStatus(); offFound(); offLost(); };
  }, []);

  React.useEffect(() => {
    if (!isLocked) return undefined;
    const t = setTimeout(() => {
      window.__setProtoState?.('ar');
    }, 600);
    return () => clearTimeout(t);
  }, [isLocked]);

  React.useEffect(() => () => clearTimeout(lockTimerRef.current), []);

  const lockTarget = React.useCallback(() => {
    if (scanState !== 'searching') return;
    setScanState('focusing');
    window.__mindar?.focusCamera?.();
    clearTimeout(lockTimerRef.current);
    lockTimerRef.current = setTimeout(() => setScanState('locked'), 780);
  }, [scanState]);

  const statusLabel = isLocked
    ? t(lang, '已锁定', 'LOCKED')
    : isFocusing
    ? t(lang, '对焦中', 'FOCUS')
    : mindarStatus === 'loading'
    ? t(lang, '启动中', 'STARTING')
    : t(lang, '扫描中', 'SCANNING');

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: 'transparent' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backdropFilter: isFocusing ? 'blur(2.5px)' : 'blur(0px)',
          WebkitBackdropFilter: isFocusing ? 'blur(2.5px)' : 'blur(0px)',
          transition: 'backdrop-filter 220ms ease, -webkit-backdrop-filter 220ms ease',
          pointerEvents: 'none',
        }}
      />

      <div style={{
        position: 'absolute', inset: 0,
        opacity: isLocked ? 0 : 1,
        transition: 'opacity 320ms ease-out',
        pointerEvents: 'none',
        transform: isFocusing ? 'scale(1.035)' : 'scale(1)',
        transformOrigin: `${SCAN_FLOWER_FRAME.cx}px ${SCAN_FLOWER_FRAME.cy}px`,
      }}>
        <FlowerViewfinder
          cx={SCAN_FLOWER_FRAME.cx}
          cy={SCAN_FLOWER_FRAME.cy}
          size={SCAN_FLOWER_FRAME.size}
        />
      </div>

      <ScanSweepOverlay active={!isLocked} />

      <IOSStatusBar dark />

      <div style={{
        position: 'absolute', top: 58, left: 16, right: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <FrostButton onClick={() => window.__setProtoState?.('landing')} style={{ width: 38, padding: 0 }}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M10 2L4 7l6 5" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round"/></svg>
        </FrostButton>

        <div style={{
          padding: '8px 14px',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.16)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          border: isLocked ? `0.5px solid rgba(169,212,90,0.5)` : 'none',
        }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: isLocked ? TOKENS.green : TOKENS.pink,
            boxShadow: `0 0 8px ${isLocked ? TOKENS.green : TOKENS.pink}`,
            animation: isLocked ? 'none' : 'pulse 1.4s infinite',
          }}/>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: '#fff', letterSpacing: '0.16em' }}>
            {statusLabel}
          </div>
        </div>

        <FrostButton
          onClick={lockTarget}
          disabled={scanState !== 'searching'}
          title="Lock target"
          style={{ minWidth: 78, gap: 8, padding: '0 12px' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 1v14M1 8h14" stroke="#fff" strokeWidth="1.5"/><circle cx="8" cy="8" r="6.5" stroke="#fff" strokeWidth="1.2" fill="none"/></svg>
          <span style={{ fontFamily: lang === 'en' ? FONT_MONO : FONT_ZH, fontSize: 11, fontWeight: 700 }}>
            {isLocked ? t(lang, '已锁定', 'LOCKED') : t(lang, '锁定', 'TARGET')}
          </span>
        </FrostButton>
      </div>

      <div style={{
        position: 'absolute',
        left: '50%',
        bottom: 138,
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
      }}>
        {isFocusing
          ? t(lang, '正在对焦，自动锁定…', 'Focusing · locking target…')
          : t(lang, '对准目标，自动扫描', 'Aim at the target · auto scanning')}
      </div>
    </div>
  );
}

function OrbitTextRing({ lang = 'zh', size = 300, frozen = false }) {
  const radius = size / 2 - 18;
  const cx = size / 2;
  const cy = size / 2;
  const pathId = `orbit-ring-path-${lang}-${size}`;
  const pathD =
    `M ${cx - radius},${cy} ` +
    `a ${radius},${radius} 0 1,1 ${radius * 2},0 ` +
    `a ${radius},${radius} 0 1,1 -${radius * 2},0`;
  const phrase = lang === 'en'
    ? 'EMO IS HERE · IFS PLAZA AR LIMITED · '
    : '国金天地一毛来和你玩 · ';
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: size,
        height: size,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        animation: 'orbit-spin 22s linear infinite',
        animationPlayState: frozen ? 'paused' : 'running',
        filter: 'drop-shadow(0 0 6px rgba(242,156,176,0.55))',
        zIndex: 3,
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
        <defs>
          <path id={pathId} d={pathD} fill="none" />
        </defs>
        <text
          style={{
            fontFamily: lang === 'en' ? FONT_MONO : FONT_ZH,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: lang === 'en' ? '0.28em' : '0.22em',
            fill: 'rgba(255,255,255,0.82)',
          }}
        >
          <textPath href={`#${pathId}`} startOffset="0">
            {phrase.repeat(3)}
          </textPath>
        </text>
      </svg>
    </div>
  );
}

// ─── SCREEN 4: AR Active ──────────────────────────────────────
function ScreenARActive({ lang = 'zh', setLang }) {
  const [arPhase, setArPhase] = React.useState('intro-playing');

  React.useEffect(() => {
    Step06Assets.preloadUrls(INTRO_FRAME_URLS);
  }, []);

  const handleIntroComplete = React.useCallback(() => {
    setArPhase('final-live');
  }, []);

  const captureFrame = React.useCallback(() => {
    setArPhase((current) => current === 'captured-frame' ? 'final-live' : 'captured-frame');
  }, []);

  const shareFrame = React.useCallback(async () => {
    const shareData = {
      title: 'EMO AR',
      text: lang === 'en' ? 'I found EMO in AR.' : '我在 AR 里遇见了一毛。',
      url: window.location.href,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
      return;
    }
    try { await navigator.clipboard?.writeText?.(shareData.url); } catch {}
  }, [lang]);

  const isCaptured = arPhase === 'captured-frame';
  const isLive = arPhase === 'final-live' || isCaptured;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: 'transparent' }}>
      <div style={{
        position: 'absolute',
        left: '50%',
        top: isLive ? '47%' : '49%',
        transform: 'translate(-50%, -50%)',
        width: 600,
        height: 600,
        pointerEvents: 'none',
        transition: 'top 420ms ease-out, transform 420ms ease-out',
      }}>
        <Step06SequencePlayer
          size={600}
          autoplay={arPhase === 'intro-playing'}
          holdLastFrame
          frameUrls={INTRO_FRAME_URLS}
          durationMs={INTRO_DURATION_MS}
          onComplete={handleIntroComplete}
          style={{ transform: 'translateY(-54px)', filter: 'none' }}
        />
        {isLive && (
          <OrbitTextRing
            lang={lang}
            size={250}
            frozen={isCaptured}
          />
        )}
      </div>

      <IOSStatusBar dark />

      <div style={{
        position: 'absolute', top: 58, left: 16, right: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <FrostButton onClick={() => window.__setProtoState?.('landing')} style={{ width: 38, padding: 0 }}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 3l8 8M11 3l-8 8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
        </FrostButton>

        <div style={{
          padding: '8px 14px',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.2)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          border: `0.5px solid rgba(169,212,90,0.5)`,
        }}>
          <div style={{ width: 7, height: 7, borderRadius: 999, background: TOKENS.green, boxShadow: `0 0 8px ${TOKENS.green}` }}/>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: '#fff', letterSpacing: '0.16em' }}>
            {isCaptured ? t(lang, '已拍照', 'CAPTURED') : t(lang, '实景已锁定', 'LOCKED')}
          </div>
        </div>

        <LangChip lang={lang} onToggle={setLang} />
      </div>

      <div style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 80,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        pointerEvents: 'none',
      }}>
        <div style={{
          padding: '10px 16px',
          borderRadius: 999,
          background: 'rgba(0,0,0,0.32)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '0.5px solid rgba(255,255,255,0.15)',
          fontFamily: langFont(lang),
          fontSize: 11,
          color: 'rgba(255,255,255,0.92)',
          maxWidth: 320,
          textAlign: 'center',
        }}>
          {arPhase === 'intro-playing'
            ? t(lang, '一毛出现中…', 'EMO is appearing…')
            : isCaptured
            ? t(lang, '已定格，可再次按下返回实时画面', 'Captured · tap shutter again for live view')
            : t(lang, '拍下一毛并分享', 'Capture & share EMO')}
        </div>
        {isCaptured ? (
          <div style={{ display: 'flex', gap: 12, pointerEvents: 'auto' }}>
            <button
              type="button"
              onClick={captureFrame}
              style={{
                minWidth: 112,
                height: 42,
                borderRadius: 999,
                border: 'none',
                background: '#1F1A1F',
                color: '#FAF6F1',
                fontFamily: langFont(lang),
                fontSize: 13,
                fontWeight: 800,
                boxShadow: '0 10px 28px rgba(0,0,0,0.28)',
                cursor: 'pointer',
              }}
            >
              {t(lang, '重新拍照', 'Retake')}
            </button>
            <button
              type="button"
              onClick={shareFrame}
              style={{
                minWidth: 112,
                height: 42,
                borderRadius: 999,
                border: 'none',
                background: '#1F1A1F',
                color: '#FAF6F1',
                fontFamily: langFont(lang),
                fontSize: 13,
                fontWeight: 800,
                boxShadow: '0 10px 28px rgba(0,0,0,0.28)',
                cursor: 'pointer',
              }}
            >
              {t(lang, '分享好友', 'Share')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={captureFrame}
            disabled={!isLive}
            style={{
              pointerEvents: 'auto',
              width: 68,
              height: 68,
              borderRadius: 999,
              border: '3px solid #fff',
              background: TOKENS.pink,
              cursor: isLive ? 'pointer' : 'default',
              boxShadow: '0 0 0 2px rgba(255,255,255,0.3), 0 10px 28px rgba(0,0,0,0.42)',
              opacity: isLive ? 1 : 0.55,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            <div style={{
              width: 20,
              height: 20,
              borderRadius: 999,
              background: '#fff',
            }}/>
          </button>
        )}
      </div>

      {isCaptured && (
        <div style={{
          position: 'absolute',
          left: 38,
          right: 38,
          top: 138,
          bottom: 188,
          borderRadius: 28,
          border: '14px solid rgba(255,255,255,0.96)',
          boxShadow: '0 28px 60px rgba(0,0,0,0.28), inset 0 0 0 10px rgba(244,183,200,0.9)',
          pointerEvents: 'none',
        }}/>
      )}

      <div style={{
        position: 'absolute', left: '50%', bottom: 8, transform: 'translateX(-50%)',
        width: 140, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.7)',
      }}/>
    </div>
  );
}

// ─── SCREEN 5: Permission Denied ──────────────────────────────
function ScreenDenied({ lang = 'zh', setLang }) {
  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
      background: `linear-gradient(180deg, #FFF4F4 0%, ${TOKENS.cream} 100%)`,
    }}>
      <IOSStatusBar />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px 0' }}>
        <button
          type="button"
          onClick={() => window.__setProtoState?.('landing')}
          style={{
          width: 36, height: 36, borderRadius: 999, border: 'none',
          background: 'rgba(31,26,31,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M10 2L4 7l6 5" stroke={TOKENS.ink} strokeWidth="1.8" fill="none" strokeLinecap="round"/></svg>
        </button>
        <LangChip lang={lang} onToggle={setLang} />
      </div>

      {/* Sad mascot vignette */}
      <div style={{ marginTop: 36, position: 'relative', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: 190, height: 190, borderRadius: '50%',
          background: 'radial-gradient(closest-side, #FFE5EA, rgba(255,229,234,0) 80%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          <div style={{ filter: 'saturate(0.7)', opacity: 0.9 }}>
            <Mascot3D state="idle" size={170} animate="bob" />
          </div>
          {/* no-camera overlay badge */}
          <div style={{
            position: 'absolute', right: 4, bottom: 8,
            width: 62, height: 62, borderRadius: 999, background: '#fff',
            boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="28" height="26" viewBox="0 0 28 26" fill="none">
              <rect x="2" y="6" width="22" height="14" rx="3" stroke={TOKENS.ink} strokeWidth="1.8" fill="#FFE5EA"/>
              <circle cx="13" cy="13" r="3.5" fill={TOKENS.pinkDeep}/>
              <path d="M2 2l24 22" stroke={TOKENS.ink} strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
      </div>

      <div style={{ padding: '34px 28px 0', textAlign: 'center' }}>
        <h2 style={{ margin: 0, fontFamily: langFont(lang), fontSize: lang === 'en' ? 23 : 24, fontWeight: 800, color: TOKENS.ink }}>
          {t(lang, '未获得相机权限', 'Camera access is blocked')}
        </h2>
        <p style={{ margin: '16px 12px 0', fontFamily: langFont(lang), fontSize: lang === 'en' ? 13 : 13.5, lineHeight: 1.6, color: TOKENS.ink60 }}>
          {t(lang, '要让一毛出现，请在浏览器设置中\n开启相机权限。', 'To let EMO appear, enable camera access in your browser settings.')}
        </p>
      </div>

      {/* How-to steps */}
      <div style={{
        position: 'absolute', left: 16, right: 16, bottom: 150,
        borderRadius: 20, background: '#fff',
        boxShadow: '0 8px 20px rgba(0,0,0,0.05)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '10px 16px', background: TOKENS.pinkSoft,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ fontFamily: langFont(lang), fontSize: 12, fontWeight: 700, color: TOKENS.ink }}>
            {t(lang, '如何开启相机', 'How to enable')}
          </div>
        </div>
        {[
          { zh: '点击浏览器地址栏的锁图标', en: 'Tap the lock icon in the address bar' },
          { zh: '在「相机」一项选择「允许」', en: 'Set Camera to Allow' },
          { zh: '返回此页面，点击重试', en: 'Come back and tap Try again' },
        ].map((s, i) => (
          <div key={i} style={{
            padding: '10px 16px', display: 'flex', gap: 12, alignItems: 'center',
            borderTop: i === 0 ? 'none' : '1px solid rgba(31,26,31,0.06)',
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: 999, background: TOKENS.ink, color: '#fff',
              fontFamily: FONT_MONO, fontSize: 10, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>{i+1}</div>
            <div>
              <div style={{ fontFamily: langFont(lang), fontSize: lang === 'en' ? 11.5 : 12, fontWeight: 500, color: TOKENS.ink }}>
                {t(lang, s.zh, s.en)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ position: 'absolute', left: 16, right: 16, bottom: 28, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PillBtn lang={lang} zh="重新尝试" en="Try again" onClick={() => window.__setProtoState?.('permission')} icon={
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 7a5 5 0 1 0 1.5-3.5M2 2v3h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
          </svg>
        }/>
      </div>
    </div>
  );
}

// ─── SCREEN 6: Loading / Error (two states in one card) ───────
function ScreenLoading({ lang = 'zh' }) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#0d0f13' }}>
      <IOSStatusBar dark />
      {/* subtle feed */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(80% 50% at 50% 40%, #2a2028 0%, #0d0f13 70%)',
      }}/>

      {/* center stack */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '0 24px',
      }}>
        {/* bouncing mascot */}
        <div style={{ marginBottom: 28 }}>
          <Mascot3D state="sprout" size={160} animate="bob" />
        </div>

        {/* progress */}
        <div style={{ width: 220, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden', position: 'relative' }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(90deg, ${TOKENS.pink} 0%, ${TOKENS.pinkDeep} 100%)`,
            borderRadius: 999,
            boxShadow: `0 0 10px ${TOKENS.pink}`,
            animation: 'loading-bar-fill 1.8s ease-in-out infinite',
          }}/>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)',
            width: '40%',
            animation: 'loading-bar-shimmer 1.6s ease-in-out infinite',
            mixBlendMode: 'screen',
          }}/>
        </div>

        <div style={{ marginTop: 18, textAlign: 'center' }}>
          <div style={{ fontFamily: langFont(lang), fontSize: 18, fontWeight: 700, color: '#fff' }}>
            {t(lang, '正在准备一毛…', 'Waking up EMO…')}
          </div>
        </div>

        {/* meta chips */}
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          {[
            { k: 'model', v: '3.2 MB' },
            { k: 'scene', v: 'ok' },
            { k: 'ar', v: 'init' },
          ].map((m) => (
            <div key={m.k} style={{
              padding: '4px 10px', borderRadius: 999,
              background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.12)',
              fontFamily: FONT_MONO, fontSize: 10, color: 'rgba(255,255,255,0.7)',
              letterSpacing: '0.08em',
            }}>{m.k} · {m.v}</div>
          ))}
        </div>
      </div>

      {/* footer tip */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 34, textAlign: 'center',
        fontFamily: FONT_MONO, fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.18em',
      }}>
        {t(lang, '首次加载约需 3–5 秒', 'FIRST LOAD · 3–5 SECONDS')}
      </div>
    </div>
  );
}

function ScreenError({ lang = 'zh', setLang }) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: TOKENS.cream }}>
      <IOSStatusBar />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px 0' }}>
        <button
          type="button"
          onClick={() => window.__setProtoState?.('landing')}
          style={{
          width: 36, height: 36, borderRadius: 999, border: 'none',
          background: 'rgba(31,26,31,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M10 2L4 7l6 5" stroke={TOKENS.ink} strokeWidth="1.8" fill="none" strokeLinecap="round"/></svg>
        </button>
        <LangChip lang={lang} onToggle={setLang} />
      </div>

      {/* illustration: mascot with question */}
      <div style={{ marginTop: 44, position: 'relative', display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: 200, height: 200 }}>
          <div style={{
            position: 'absolute', left: '50%', top: '55%', transform: 'translate(-50%,-50%) rotate(-8deg)',
          }}>
            <Mascot3D state="sprout" size={180} animate="bob" />
          </div>
          {/* ? bubble */}
          <div style={{
            position: 'absolute', right: -6, top: 0,
            width: 56, height: 56, borderRadius: 999,
            background: '#fff', border: `2px solid ${TOKENS.ink}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: FONT_ZH, fontSize: 28, fontWeight: 800, color: TOKENS.ink,
            boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
          }}>?
            <div style={{
              position: 'absolute', left: -6, bottom: -10,
              width: 14, height: 14, borderRadius: 999,
              background: '#fff', border: `2px solid ${TOKENS.ink}`,
            }}/>
          </div>
        </div>
      </div>

      <div style={{ padding: '34px 28px 0', textAlign: 'center' }}>
        <h2 style={{ margin: 0, fontFamily: langFont(lang), fontSize: lang === 'en' ? 23 : 24, fontWeight: 800, color: TOKENS.ink }}>
          {t(lang, '出了点小状况', 'Something went sideways')}
        </h2>
        <p style={{ margin: '14px 16px 0', fontFamily: langFont(lang), fontSize: lang === 'en' ? 13 : 13.5, lineHeight: 1.6, color: TOKENS.ink60 }}>
          {t(lang, '无法加载 AR 内容，请检查网络后重试。', "Couldn't load the AR scene. Check your connection and try again.")}
        </p>
      </div>

      {/* error code card — hidden per design review
      <div style={{
        position: 'absolute', left: 28, right: 28, bottom: 140,
        padding: '12px 14px', borderRadius: 14,
        background: TOKENS.ink, color: TOKENS.cream,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontFamily: FONT_MONO, fontSize: 11,
      }}>
        <div style={{ opacity: 0.5, letterSpacing: '0.12em' }}>ERROR</div>
        <div style={{ letterSpacing: '0.1em' }}>AR_SCENE_404 · NET</div>
        <div style={{ opacity: 0.5 }}>↗</div>
      </div>
      */}

      <div style={{ position: 'absolute', left: 16, right: 16, bottom: 28, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PillBtn lang={lang} zh="重新加载" en="Reload" onClick={() => window.__setProtoState?.('loading')} icon={
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 7a5 5 0 1 0 1.5-3.5M2 2v3h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
          </svg>
        }/>
        <PillBtn lang={lang} zh="联系客服" en="Contact support" variant="ghost" onClick={() => window.__setProtoState?.('landing')} />
      </div>
    </div>
  );
}

Object.assign(window, {
  ScreenScan,
  ScreenARActive,
  ScreenDenied,
  ScreenLoading,
  ScreenError,
  EMO_INTRO_FRAME_URLS: INTRO_FRAME_URLS,
});
