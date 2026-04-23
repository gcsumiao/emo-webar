// Scan, AR active, denied, error, loading screens

const SCAN_SCENE_URL = 'assets/scan/scene-01.jpg';
const SCAN_OUTLINE_URL = 'assets/scan/yimao-outline.png';
// Outline aspect (w/h) = 0.961. Frames hug the real inflatable in scene-01.jpg.
// Photo-mapped inflatable bbox in phone coords: left≈59 top≈484 width≈280 height≈273.
const SCAN_SEARCHING_FRAME = { left: 74, top: 484, width: 242, height: 252 };
const SCAN_LOCKED_FRAME = { left: 50, top: 462, width: 290, height: 302 };

const SCENE_COVER_STYLE = {
  backgroundImage: `url(${SCAN_SCENE_URL})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center center',
  backgroundRepeat: 'no-repeat',
};

function SceneBackdrop({ darkness = 0, blur = 0 }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        ...SCENE_COVER_STYLE,
        filter: blur ? `blur(${blur}px)` : 'none',
        transform: blur ? 'scale(1.04)' : 'none',
      }}
    >
      {darkness > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(180deg, rgba(13,16,20,${darkness * 0.78}) 0%, rgba(13,16,20,${darkness}) 100%)`,
          }}
        />
      )}
    </div>
  );
}

function MaskedSilhouette({ frame, color = 'rgba(255,225,234,0.98)', inset = 0, opacity = 1, backgroundClone = false }) {
  const width = Math.max(8, frame.width - inset * 2);
  const height = Math.max(8, frame.height - inset * 2);
  const left = frame.left + inset;
  const top = frame.top + inset;
  return (
    <div
      style={{
        position: 'absolute',
        ...(backgroundClone ? { inset: 0 } : { left, top, width, height }),
        ...(backgroundClone ? SCENE_COVER_STYLE : { background: color }),
        opacity,
        WebkitMaskImage: `url(${SCAN_OUTLINE_URL})`,
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: backgroundClone ? `${left}px ${top}px` : 'center center',
        WebkitMaskSize: `${width}px ${height}px`,
        maskImage: `url(${SCAN_OUTLINE_URL})`,
        maskRepeat: 'no-repeat',
        maskPosition: backgroundClone ? `${left}px ${top}px` : 'center center',
        maskSize: `${width}px ${height}px`,
        pointerEvents: 'none',
      }}
    />
  );
}

function ScanTargetFrame({ frame, locked = false }) {
  return (
    <>
      <MaskedSilhouette
        frame={frame}
        color={locked ? 'rgba(255,217,229,0.58)' : 'rgba(255,233,240,0.52)'}
      />
      <MaskedSilhouette frame={frame} backgroundClone inset={locked ? 5 : 4} />
      <div
        style={{
          position: 'absolute',
          left: frame.left - 8,
          top: frame.top - 8,
          width: frame.width + 16,
          height: frame.height + 16,
          filter: locked ? 'drop-shadow(0 0 12px rgba(242,156,176,0.38))' : 'drop-shadow(0 0 8px rgba(242,156,176,0.26))',
          borderRadius: 28,
          pointerEvents: 'none',
        }}
      />
    </>
  );
}

function ScanSweepLine({ frame }) {
  const width = Math.max(8, frame.width);
  const height = Math.max(8, frame.height);
  return (
    <div
      style={{
        position: 'absolute',
        left: frame.left,
        top: frame.top,
        width,
        height,
        pointerEvents: 'none',
        overflow: 'hidden',
        WebkitMaskImage: `url(${SCAN_OUTLINE_URL})`,
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center center',
        WebkitMaskSize: `${width}px ${height}px`,
        maskImage: `url(${SCAN_OUTLINE_URL})`,
        maskRepeat: 'no-repeat',
        maskPosition: 'center center',
        maskSize: `${width}px ${height}px`,
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
          background: 'rgba(255,243,247,0.88)',
          boxShadow: '0 0 14px rgba(255,243,247,0.76)',
          animation: 'scan-sweep 4.8s ease-in-out infinite',
        }}
      />
    </div>
  );
}

// ─── SCREEN 3: Scan — looking for target ──────────────────────
function ScreenScan({ lang = 'zh', setLang }) {
  const [scanState, setScanState] = React.useState('searching');
  const frame = scanState === 'searching' ? SCAN_SEARCHING_FRAME : SCAN_LOCKED_FRAME;
  const showSweep = scanState === 'searching';
  const isLocked = scanState === 'locked';

  const lockTarget = React.useCallback(() => {
    setScanState((current) => current === 'searching' ? 'locked' : current);
  }, []);

  React.useEffect(() => {
    if (!isLocked) return undefined;
    const t = setTimeout(() => {
      window.__setProtoState?.('ar');
    }, 900);
    return () => clearTimeout(t);
  }, [isLocked]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#000' }}>
      <SceneBackdrop darkness={0.14} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,10,14,0.12) 0%, rgba(8,10,14,0.28) 100%)' }} />

      <div style={{ position: 'absolute', inset: 0, transition: 'all 420ms cubic-bezier(.22,1,.36,1)' }}>
        <ScanTargetFrame frame={frame} locked={scanState !== 'searching'} />
      </div>

      {showSweep && <ScanSweepLine frame={frame} />}

      <IOSStatusBar dark />

      <div style={{
        position: 'absolute', top: 58, left: 16, right: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button
          type="button"
          onClick={() => window.__setProtoState?.('landing')}
          style={{
          width: 38, height: 38, borderRadius: 999, border: 'none',
          background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M10 2L4 7l6 5" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round"/></svg>
        </button>

        <div style={{
          padding: '8px 14px', borderRadius: 999,
          background: isLocked ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.16)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', gap: 8,
          border: isLocked ? `0.5px solid rgba(169,212,90,0.5)` : 'none',
          transition: 'background 220ms ease, border-color 220ms ease',
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: 999,
            background: isLocked ? TOKENS.green : TOKENS.pink,
            boxShadow: `0 0 8px ${isLocked ? TOKENS.green : TOKENS.pink}`,
            animation: isLocked ? 'none' : 'pulse 1.4s infinite',
          }}/>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: '#fff', letterSpacing: '0.16em' }}>
            {isLocked ? t(lang, '已锁定', 'LOCKED') : t(lang, '扫描中', 'SCANNING')}
          </div>
        </div>

        <button
          type="button"
          onClick={lockTarget}
          style={{
          minWidth: 78, height: 38, borderRadius: 999, border: 'none',
          background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 8, color: '#fff', padding: '0 12px',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 1v14M1 8h14" stroke="#fff" strokeWidth="1.5"/><circle cx="8" cy="8" r="6.5" stroke="#fff" strokeWidth="1.2" fill="none"/></svg>
          <span style={{ fontFamily: lang === 'en' ? FONT_MONO : FONT_ZH, fontSize: 11, fontWeight: 700 }}>
            {scanState === 'searching' ? t(lang, '锁定', 'TARGET') : t(lang, '已锁定', 'LOCKED')}
          </span>
        </button>
      </div>

    </div>
  );
}

function OrbitTextRing({ lang = 'zh', size = 360, frozen = false }) {
  const radius = size / 2 - 18;
  const cx = size / 2;
  const cy = size / 2;
  const pathId = 'orbit-ring-path';
  const pathD =
    `M ${cx - radius},${cy} ` +
    `a ${radius},${radius} 0 1,1 ${radius * 2},0 ` +
    `a ${radius},${radius} 0 1,1 -${radius * 2},0`;
  const phrase = lang === 'en'
    ? 'EMO IS HERE · IFS PLAZA AR LIMITED · '
    : '一毛来和你玩 · 国金天地 AR 限定 · ';
  const ringText = phrase.repeat(3);
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
            textTransform: lang === 'en' ? 'uppercase' : 'none',
          }}
        >
          <textPath href={`#${pathId}`} startOffset="0">
            {ringText}
          </textPath>
        </text>
      </svg>
    </div>
  );
}

// ─── SCREEN 4: AR Active ──────────────────────────────────────
function ScreenARActive({ lang = 'zh', setLang }) {
  const [arPhase, setArPhase] = React.useState('intro-playing');
  const audioRef = React.useRef(null);

  React.useEffect(() => {
    Step06Assets.preload({ full: true });
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, []);

  React.useEffect(() => {
    if (arPhase !== 'intro-playing') return undefined;
    const audio = Step06Assets.createAudio();
    audioRef.current = audio;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }, [arPhase]);

  const handleIntroComplete = React.useCallback(() => {
    setArPhase('final-live-3d');
  }, []);

  const captureFrame = React.useCallback(() => {
    setArPhase((current) => current === 'captured-frame' ? 'final-live-3d' : 'captured-frame');
  }, []);

  const isLive3D = arPhase === 'final-live-3d' || arPhase === 'captured-frame';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#000' }}>
      <SceneBackdrop darkness={0.48} />

      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, rgba(6,8,12,0.08) 0%, rgba(6,8,12,0.22) 30%, rgba(6,8,12,0.55) 100%)',
      }}/>

      <div style={{
        position: 'absolute', left: '50%', bottom: '22%', transform: 'translateX(-50%)',
        width: 360, height: 460,
        animation: 'mascot-appear 820ms cubic-bezier(.22,1,.36,1) both',
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          opacity: isLive3D ? 0 : 1,
          transition: 'opacity 420ms ease-out',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible',
        }}>
          {/* PNG mascot occupies ~35% of its 768×768 frame (bbox y≈[350,620], center≈63%).
              Container 740 → visible mascot ≈ 258px, matches GLB at size 280.
              translateY shifts off-center mascot onto wrapper's vertical middle. */}
          <Step06SequencePlayer
            size={740}
            autoplay={arPhase === 'intro-playing'}
            onComplete={handleIntroComplete}
            style={{ transform: 'translateY(-98px)' }}
          />
        </div>

        <div style={{
          position: 'absolute',
          inset: 0,
          opacity: isLive3D ? 1 : 0,
          transition: 'opacity 460ms ease-out',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: isLive3D ? 'mascot-settle 520ms ease-out both' : 'none',
        }}>
          <ModelViewerIdle
            size={280}
            src={step06GlbUrl}
            active={isLive3D}
            style={{ position: 'relative', zIndex: 2, pointerEvents: arPhase === 'captured-frame' ? 'none' : 'auto' }}
          />
        </div>

        {isLive3D && (
          <OrbitTextRing
            lang={lang}
            size={280}
            frozen={arPhase === 'captured-frame'}
          />
        )}
      </div>

      {isLive3D && (
        <div style={{
          position: 'absolute', left: '50%', bottom: '26%', transform: 'translateX(-50%)',
          width: 220, height: 40, borderRadius: '50%',
          background: 'radial-gradient(closest-side, rgba(242,156,176,0.48), rgba(242,156,176,0))',
          animation: 'glow-pulse 3.2s ease-in-out infinite',
          animationPlayState: arPhase === 'captured-frame' ? 'paused' : 'running',
        }}/>
      )}

      <IOSStatusBar dark />

      <div style={{
        position: 'absolute', top: 58, left: 16, right: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button
          type="button"
          onClick={() => window.__setProtoState?.('landing')}
          style={{
          width: 38, height: 38, borderRadius: 999, border: 'none',
          background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 3l8 8M11 3l-8 8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
        </button>

        <div style={{
          padding: '8px 14px', borderRadius: 999,
          background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', gap: 8,
          border: `0.5px solid rgba(169,212,90,0.5)`,
        }}>
          <div style={{ width: 7, height: 7, borderRadius: 999, background: TOKENS.green, boxShadow: `0 0 8px ${TOKENS.green}` }}/>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: '#fff', letterSpacing: '0.16em' }}>
            {arPhase === 'captured-frame' ? t(lang, '已拍照', 'CAPTURED') : t(lang, '实景已锁定', 'LOCKED')}
          </div>
        </div>

        <LangChip lang={lang} onToggle={setLang} />
      </div>

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 80,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        pointerEvents: 'none',
      }}>
        <div style={{
          padding: '10px 16px', borderRadius: 999,
          background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)', border: '0.5px solid rgba(255,255,255,0.15)',
          fontFamily: langFont(lang), fontSize: 11, color: 'rgba(255,255,255,0.92)',
          maxWidth: 320, textAlign: 'center',
        }}>
          {arPhase === 'intro-playing'
            ? t(lang, '一毛出现中…', 'EMO is appearing…')
            : arPhase === 'captured-frame'
            ? t(lang, '已定格，可再次按下返回实时画面', 'Captured · tap shutter again for live view')
            : t(lang, '拍下一毛并分享', 'Capture & share EMO')}
        </div>
        <button
          type="button"
          onClick={captureFrame}
          disabled={!isLive3D}
          style={{
            pointerEvents: 'auto',
            width: 68, height: 68, borderRadius: 999, border: '3px solid #fff',
            background: TOKENS.pink, cursor: isLive3D ? 'pointer' : 'default',
            boxShadow: '0 0 0 2px rgba(255,255,255,0.3), 0 10px 28px rgba(0,0,0,0.42)',
            opacity: isLive3D ? 1 : 0.55,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0,
          }}>
          <div style={{
            width: 20,
            height: 20,
            borderRadius: arPhase === 'captured-frame' ? 4 : 999,
            background: '#fff',
          }}/>
        </button>
      </div>

      {arPhase === 'captured-frame' && (
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

Object.assign(window, { ScreenScan, ScreenARActive, ScreenDenied, ScreenLoading, ScreenError });
