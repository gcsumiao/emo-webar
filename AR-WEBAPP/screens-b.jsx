// Scan, AR active, denied, error, loading screens

// Camera viewfinder background (dark gradient mimicking camera feed)
function CameraFeed({ children, mode = 'looking' }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: mode === 'active'
        ? 'linear-gradient(170deg, #36404a 0%, #1c2329 60%, #0a0d11 100%)'
        : 'linear-gradient(180deg, #2b343d 0%, #131821 100%)',
      overflow: 'hidden',
    }}>
      {/* faux camera noise/pattern */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.12,
        background: 'repeating-linear-gradient(35deg, transparent 0, transparent 3px, rgba(255,255,255,0.08) 3px, rgba(255,255,255,0.08) 4px)',
      }}/>
      {/* simulated target poster (light rectangle) */}
      {mode === 'looking' && (
        <div style={{
          position: 'absolute', left: '50%', top: '54%', transform: 'translate(-50%,-50%) rotate(-3deg)',
          width: 180, height: 240, borderRadius: 10,
          background: 'linear-gradient(180deg, #f4d5dd 0%, #e9b5c4 100%)',
          boxShadow: '0 14px 30px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: 'rgba(31,26,31,0.4)', letterSpacing: '0.2em', marginBottom: 6 }}>POSTER</div>
          <img src="assets/mascot/m_idle.png" style={{ width: 80, height: 80, objectFit: 'contain' }}/>
          <div style={{ fontFamily: FONT_ZH, fontSize: 13, fontWeight: 700, color: TOKENS.ink, marginTop: 8 }}>一毛的奇遇</div>
          <div style={{ fontFamily: FONT_EN, fontSize: 9, color: TOKENS.ink60, marginTop: 2 }}>EMO · AR</div>
          <div style={{
            position: 'absolute', left: 8, bottom: 8, width: 24, height: 24,
            background: '#fff', borderRadius: 3,
            backgroundImage: 'linear-gradient(90deg, #000 1px, transparent 1px), linear-gradient(#000 1px, transparent 1px)',
            backgroundSize: '4px 4px',
          }} />
        </div>
      )}
      {children}
    </div>
  );
}

// ─── SCREEN 3: Scan — looking for target ──────────────────────
function ScreenScan() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#000' }}>
      <CameraFeed mode="looking" />

      {/* Dim overlay around reticle */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <defs>
          <mask id="reticleMask">
            <rect width="100%" height="100%" fill="white"/>
            <rect x="50%" y="50%" width="240" height="300" rx="18" transform="translate(-120,-150)" fill="black"/>
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.45)" mask="url(#reticleMask)"/>
      </svg>

      {/* Reticle corners */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
        width: 240, height: 300, pointerEvents: 'none',
      }}>
        {[
          { top: 0, left: 0, rotate: 0 },
          { top: 0, right: 0, rotate: 90 },
          { bottom: 0, right: 0, rotate: 180 },
          { bottom: 0, left: 0, rotate: 270 },
        ].map((pos, i) => (
          <svg key={i} width="32" height="32" style={{ position: 'absolute', ...pos, transform: `rotate(${pos.rotate}deg)` }}>
            <path d="M2 14 L2 2 L14 2" stroke={TOKENS.pink} strokeWidth="3" fill="none" strokeLinecap="round"/>
          </svg>
        ))}
        {/* scan line */}
        <div style={{
          position: 'absolute', left: 6, right: 6, top: '50%', height: 2,
          background: `linear-gradient(90deg, transparent 0%, ${TOKENS.pink} 50%, transparent 100%)`,
          animation: 'scan-sweep 2.2s ease-in-out infinite',
          boxShadow: `0 0 12px ${TOKENS.pink}`,
        }}/>
      </div>

      <IOSStatusBar dark />

      {/* Top chrome */}
      <div style={{
        position: 'absolute', top: 58, left: 16, right: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button style={{
          width: 38, height: 38, borderRadius: 999, border: 'none',
          background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M10 2L4 7l6 5" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round"/></svg>
        </button>

        <div style={{
          padding: '8px 14px', borderRadius: 999,
          background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: 999, background: TOKENS.pink, boxShadow: `0 0 8px ${TOKENS.pink}`, animation: 'pulse 1.4s infinite' }}/>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: '#fff', letterSpacing: '0.16em' }}>SCANNING</div>
        </div>

        <button style={{
          width: 38, height: 38, borderRadius: 999, border: 'none',
          background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 1v14M1 8h14" stroke="#fff" strokeWidth="1.5"/><circle cx="8" cy="8" r="6.5" stroke="#fff" strokeWidth="1.2" fill="none"/></svg>
        </button>
      </div>

      {/* Title above reticle */}
      <div style={{
        position: 'absolute', top: 130, left: 0, right: 0, textAlign: 'center',
      }}>
        <div style={{ fontFamily: FONT_ZH, fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '0.01em' }}>寻找一毛</div>
        <div style={{ fontFamily: FONT_EN, fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontWeight: 500 }}>Look for EMO</div>
      </div>

      {/* Bottom hint card */}
      <div style={{
        position: 'absolute', left: 16, right: 16, bottom: 110,
        padding: '14px 16px', borderRadius: 22,
        background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '0.5px solid rgba(255,255,255,0.2)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="3" y="5" width="14" height="10" rx="2" stroke="#fff" strokeWidth="1.5"/>
            <circle cx="10" cy="10" r="2.5" fill="#fff"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT_ZH, fontSize: 13.5, fontWeight: 600, color: '#fff' }}>
            将相机对准活动海报
          </div>
          <div style={{ fontFamily: FONT_EN, fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
            Aim at the event poster
          </div>
        </div>
      </div>

      {/* Tip strip */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 58, textAlign: 'center',
        fontFamily: FONT_MONO, fontSize: 10, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.14em',
      }}>
        保持平稳 · HOLD STEADY · 光线充足效果最好
      </div>
    </div>
  );
}

// ─── SCREEN 4: AR Active ──────────────────────────────────────
function ScreenARActive() {
  const [introPhase, setIntroPhase] = React.useState('boot');
  const audioRef = React.useRef(null);
  const audioStartedRef = React.useRef(false);
  const handoffTimerRef = React.useRef(null);

  React.useEffect(() => {
    Step06Assets.preload({ full: true });
    const bootTimer = setTimeout(() => setIntroPhase('intro'), 220);
    return () => {
      clearTimeout(bootTimer);
      clearTimeout(handoffTimerRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, []);

  React.useEffect(() => {
    if (introPhase !== 'intro' || audioStartedRef.current) return undefined;
    const audio = Step06Assets.createAudio();
    audioRef.current = audio;
    audioStartedRef.current = true;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }, [introPhase]);

  const handleIntroComplete = React.useCallback(() => {
    setIntroPhase('handoff');
    clearTimeout(handoffTimerRef.current);
    handoffTimerRef.current = setTimeout(() => setIntroPhase('idle3d'), 220);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#000' }}>
      <CameraFeed mode="active" />

      {/* Environment: faux plaza floor */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%',
        background: 'linear-gradient(180deg, rgba(245,225,215,0.15) 0%, rgba(60,48,48,0.3) 100%)',
        backdropFilter: 'blur(2px)',
      }}/>

      {/* Ground marker under mascot */}
      <div style={{
        position: 'absolute', left: '50%', bottom: '32%', transform: 'translateX(-50%)',
        width: 220, height: 38, borderRadius: '50%',
        background: 'radial-gradient(closest-side, rgba(242,156,176,0.7), rgba(242,156,176,0))',
      }}/>
      {/* Ring on ground */}
      <svg width="240" height="80" style={{ position: 'absolute', left: '50%', bottom: '30%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
        <ellipse cx="120" cy="40" rx="110" ry="16" stroke={TOKENS.pink} strokeWidth="1.2" strokeDasharray="3 5" fill="none" opacity="0.7"/>
      </svg>

      {/* Mascot — centered, with sprout-grow sequence (matches reference video) */}
      <div style={{
        position: 'absolute', left: '50%', bottom: '34%', transform: 'translateX(-50%)',
        width: 260, height: 260,
        animation: 'mascot-appear 900ms cubic-bezier(.22,1,.36,1) both',
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          opacity: introPhase === 'idle3d' ? 0 : 1,
          transition: 'opacity 220ms ease',
        }}>
          <Step06SequencePlayer
            size={260}
            fps={24}
            autoplay={introPhase === 'intro'}
            onComplete={handleIntroComplete}
          />
        </div>

        <div style={{
          position: 'absolute',
          inset: 0,
          opacity: introPhase === 'idle3d' ? 1 : 0,
          transition: 'opacity 220ms ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <ModelViewerIdle
            size={260}
            src={step06GlbUrl}
            active={introPhase === 'idle3d'}
          />
        </div>

        {/* Orbiting text ring — matches the circular caption in the reference video */}
        <svg viewBox="0 0 260 260" style={{
          position: 'absolute', left: '50%', top: '50%',
          width: 260, height: 260,
          animation: 'orbit-spin 16s linear infinite',
          pointerEvents: 'none',
        }}>
          <defs>
            <path id="orbitPath" d="M 130,130 m -118,0 a 118,118 0 1,1 236,0 a 118,118 0 1,1 -236,0"/>
          </defs>
          <text fill="#fff" style={{
            fontFamily: FONT_ZH, fontSize: 13, fontWeight: 600, letterSpacing: '0.28em',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))',
          }}>
            <textPath href="#orbitPath" startOffset="0">
              一毛来和你玩 · EMO IS HERE · 国金天地 AR 限定 · LIFE PLAZA · 
            </textPath>
          </text>
        </svg>
      </div>

      {/* Sparkles */}
      {[
        { x: '22%', y: '28%', size: 16, color: TOKENS.pink, delay: 0 },
        { x: '78%', y: '24%', size: 12, color: '#fff', delay: 0.3 },
        { x: '16%', y: '48%', size: 10, color: TOKENS.green, delay: 0.6 },
        { x: '82%', y: '46%', size: 14, color: TOKENS.pink, delay: 0.9 },
      ].map((s, i) => (
        <svg key={i} width={s.size} height={s.size} style={{
          position: 'absolute', left: s.x, top: s.y,
          animation: `twinkle 2s ${s.delay}s infinite`,
        }}>
          <path d={`M${s.size/2} 0 L${s.size*0.6} ${s.size*0.4} L${s.size} ${s.size/2} L${s.size*0.6} ${s.size*0.6} L${s.size/2} ${s.size} L${s.size*0.4} ${s.size*0.6} L0 ${s.size/2} L${s.size*0.4} ${s.size*0.4} Z`} fill={s.color}/>
        </svg>
      ))}

      <IOSStatusBar dark />

      {/* Top chrome — tracking confirmed chip */}
      <div style={{
        position: 'absolute', top: 58, left: 16, right: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button style={{
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
          <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: '#fff', letterSpacing: '0.16em' }}>TRACKING</div>
        </div>

        <div style={{
          padding: '6px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.18)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          fontFamily: FONT_MONO, fontSize: 11, color: '#fff',
        }}>中/EN</div>
      </div>

      {/* Caption banner */}
      <div style={{
        position: 'absolute', top: 120, left: '50%', transform: 'translateX(-50%)',
        padding: '10px 18px', borderRadius: 999,
        background: '#fff',
        display: 'flex', alignItems: 'center', gap: 10,
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
        animation: 'mascot-appear 900ms 200ms cubic-bezier(.22,1,.36,1) both',
      }}>
        <img src="assets/mascot/m_sprout.png" style={{ width: 28, height: 28, objectFit: 'contain' }}/>
        <div>
          <div style={{ fontFamily: FONT_ZH, fontSize: 13, fontWeight: 700, color: TOKENS.ink, lineHeight: 1 }}>一毛来啦！</div>
          <div style={{ fontFamily: FONT_EN, fontSize: 9.5, color: TOKENS.ink60, marginTop: 2, lineHeight: 1 }}>EMO is here!</div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div style={{
        position: 'absolute', left: 16, right: 16, bottom: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      }}>
        <div style={{
          padding: '10px 14px', borderRadius: 999,
          background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)', border: '0.5px solid rgba(255,255,255,0.15)',
          fontFamily: FONT_ZH, fontSize: 11, color: 'rgba(255,255,255,0.9)',
        }}>
          轻轻移动手机 · Move around
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {/* Share */}
          <button style={{
            width: 52, height: 52, borderRadius: 999, border: 'none',
            background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 2v10M5 6l4-4 4 4M3 12v3h12v-3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {/* Capture — big */}
          <button style={{
            width: 64, height: 64, borderRadius: 999, border: '3px solid #fff',
            background: TOKENS.pink, cursor: 'pointer',
            boxShadow: '0 0 0 2px rgba(255,255,255,0.3), 0 8px 24px rgba(0,0,0,0.4)',
          }}>
          </button>
        </div>
      </div>

      {/* Home indicator hint */}
      <div style={{
        position: 'absolute', left: '50%', bottom: 8, transform: 'translateX(-50%)',
        width: 140, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.7)',
      }}/>
    </div>
  );
}

// ─── SCREEN 5: Permission Denied ──────────────────────────────
function ScreenDenied() {
  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
      background: `linear-gradient(180deg, #FFF4F4 0%, ${TOKENS.cream} 100%)`,
    }}>
      <IOSStatusBar />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px 0' }}>
        <button style={{
          width: 36, height: 36, borderRadius: 999, border: 'none',
          background: 'rgba(31,26,31,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M10 2L4 7l6 5" stroke={TOKENS.ink} strokeWidth="1.8" fill="none" strokeLinecap="round"/></svg>
        </button>
        <LangChip />
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
        <h2 style={{ margin: 0, fontFamily: FONT_ZH, fontSize: 24, fontWeight: 800, color: TOKENS.ink }}>
          未获得相机权限
        </h2>
        <div style={{ fontFamily: FONT_EN, fontSize: 13.5, color: TOKENS.ink60, marginTop: 6, fontWeight: 500 }}>
          Camera access is blocked
        </div>
        <p style={{ margin: '16px 12px 0', fontFamily: FONT_ZH, fontSize: 13.5, lineHeight: 1.6, color: TOKENS.ink60 }}>
          要让一毛出现，请在浏览器设置中<br/>开启相机权限。
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
          <div style={{ fontFamily: FONT_ZH, fontSize: 12, fontWeight: 700, color: TOKENS.ink }}>如何开启相机</div>
          <div style={{ fontFamily: FONT_EN, fontSize: 10, color: TOKENS.ink60 }}>How to enable</div>
        </div>
        {[
          { zh: '点击浏览器地址栏的锁图标', en: 'Tap the lock icon in the address bar' },
          { zh: '在「相机」一项选择「允许」', en: 'Set Camera to "Allow"' },
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
              <div style={{ fontFamily: FONT_ZH, fontSize: 12, fontWeight: 500, color: TOKENS.ink }}>{s.zh}</div>
              <div style={{ fontFamily: FONT_EN, fontSize: 10, color: TOKENS.ink60, marginTop: 1 }}>{s.en}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ position: 'absolute', left: 16, right: 16, bottom: 28, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PillBtn zh="重新尝试" en="Try again" icon={
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 7a5 5 0 1 0 1.5-3.5M2 2v3h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
          </svg>
        }/>
      </div>
    </div>
  );
}

// ─── SCREEN 6: Loading / Error (two states in one card) ───────
function ScreenLoading() {
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
        <div style={{ width: 220, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
          <div style={{
            width: '64%', height: '100%',
            background: `linear-gradient(90deg, ${TOKENS.pink} 0%, ${TOKENS.pinkDeep} 100%)`,
            borderRadius: 999,
            boxShadow: `0 0 10px ${TOKENS.pink}`,
          }}/>
        </div>

        <div style={{ marginTop: 18, textAlign: 'center' }}>
          <div style={{ fontFamily: FONT_ZH, fontSize: 18, fontWeight: 700, color: '#fff' }}>正在准备一毛…</div>
          <div style={{ fontFamily: FONT_EN, fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>Waking up EMO…</div>
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
        首次加载约需 3–5 秒 · FIRST LOAD
      </div>
    </div>
  );
}

function ScreenError() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: TOKENS.cream }}>
      <IOSStatusBar />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px 0' }}>
        <button style={{
          width: 36, height: 36, borderRadius: 999, border: 'none',
          background: 'rgba(31,26,31,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M10 2L4 7l6 5" stroke={TOKENS.ink} strokeWidth="1.8" fill="none" strokeLinecap="round"/></svg>
        </button>
        <LangChip />
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
        <h2 style={{ margin: 0, fontFamily: FONT_ZH, fontSize: 24, fontWeight: 800, color: TOKENS.ink }}>
          出了点小状况
        </h2>
        <div style={{ fontFamily: FONT_EN, fontSize: 13.5, color: TOKENS.ink60, marginTop: 6, fontWeight: 500 }}>
          Something went sideways
        </div>
        <p style={{ margin: '14px 16px 0', fontFamily: FONT_ZH, fontSize: 13.5, lineHeight: 1.6, color: TOKENS.ink60 }}>
          无法加载 AR 内容，请检查网络后重试。
        </p>
        <p style={{ margin: '6px 16px 0', fontFamily: FONT_EN, fontSize: 11.5, lineHeight: 1.5, color: TOKENS.ink30, fontStyle: 'italic' }}>
          Couldn't load the AR scene. Check your connection and try again.
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
        <PillBtn zh="重新加载" en="Reload" icon={
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 7a5 5 0 1 0 1.5-3.5M2 2v3h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
          </svg>
        }/>
        <PillBtn zh="联系客服" en="Contact support" variant="ghost" />
      </div>
    </div>
  );
}

Object.assign(window, { ScreenScan, ScreenARActive, ScreenDenied, ScreenLoading, ScreenError });
