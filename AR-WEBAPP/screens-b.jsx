// Scan, AR active, denied, error, loading screens

// Flower-shaped (sakura) viewfinder matches the reference video 10249.MP4.
// Coordinates are in the 390×820 phone frame.
const SCAN_FLOWER_FRAME = { cx: 195, cy: 430, size: 270 };
const INTRO_FRAME_RANGES = [[9, 65], [242, 261]];
const INTRO_FRAME_URLS = INTRO_FRAME_RANGES.flatMap(([start, end]) =>
  Array.from(
    { length: end - start + 1 },
    (_, i) => `assets/step06/intro-hq/1_${String(start + i).padStart(4, '0')}.png`
  )
);
const INTRO_DURATION_MS = Math.round((INTRO_FRAME_URLS.length / 30) * 1000);
const AR_BGM_URL = 'assets/step06/audio/bgm-10249.m4a';
const AR_SHUTTER_URL = 'assets/step06/audio/shutter-10249.m4a';
const AR_INTRO_CUE_SECONDS = 4;

const EMOARAudio = (() => {
  let bgm = null;
  let shutter = null;
  let bgmLoopStart = null;

  function makeAudio(url) {
    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.playsInline = true;
    return audio;
  }

  function getBgm() {
    if (!bgm) {
      bgm = makeAudio(AR_BGM_URL);
      bgm.addEventListener('timeupdate', () => {
        if (bgmLoopStart === null) return;
        if (!Number.isFinite(bgm.duration) || bgm.duration <= bgmLoopStart) return;
        if (bgm.currentTime >= bgm.duration - 0.08) {
          try { bgm.currentTime = bgmLoopStart; } catch {}
          bgm.play().catch(() => {});
        }
      });
      bgm.addEventListener('ended', () => {
        if (bgmLoopStart === null) return;
        try { bgm.currentTime = bgmLoopStart; } catch {}
        bgm.play().catch(() => {});
      });
    }
    return bgm;
  }

  function getShutter() {
    if (!shutter) shutter = makeAudio(AR_SHUTTER_URL);
    return shutter;
  }

  function playFrom(seconds, { loop = false } = {}) {
    const audio = getBgm();
    bgmLoopStart = loop ? seconds : null;
    audio.loop = false;
    try { audio.currentTime = seconds; } catch {}
    audio.play().catch(() => {});
  }

  return {
    preload: () => {
      getBgm().load();
      getShutter().load();
    },
    startScan: () => playFrom(0, { loop: true }),
    cueARIntro: () => playFrom(AR_INTRO_CUE_SECONDS, { loop: true }),
    playShutter: () => {
      const audio = getShutter();
      try { audio.currentTime = 0; } catch {}
      audio.play().catch(() => {});
    },
    stop: () => {
      bgmLoopStart = null;
      [bgm, shutter].forEach((audio) => {
        if (!audio) return;
        audio.pause();
        try { audio.currentTime = 0; } catch {}
      });
    },
  };
})();

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
const MANUAL_LOCK_DELAY_MS = 3000;

function ScreenScan({ lang = 'zh', setLang }) {
  const [scanState, setScanState] = React.useState('searching');
  const [showManualLock, setShowManualLock] = React.useState(false);
  const isLocked = scanState === 'locked';
  const isFocusing = scanState === 'focusing';

  React.useEffect(() => {
    const mindar = window.__mindar;
    if (!mindar) return undefined;
    const offFound = mindar.onTargetFound(() => {
      setShowManualLock(false);
      setScanState('locked');
    });
    const offLost  = mindar.onTargetLost(() => {
      setScanState((current) => current === 'locked' ? current : 'searching');
    });
    return () => { offFound(); offLost(); };
  }, []);

  React.useEffect(() => {
    if (isLocked) {
      setShowManualLock(false);
      return undefined;
    }
    const t = setTimeout(() => setShowManualLock(true), MANUAL_LOCK_DELAY_MS);
    return () => clearTimeout(t);
  }, [isLocked]);

  React.useEffect(() => {
    if (!isLocked) return undefined;
    const t = setTimeout(() => {
      window.__setProtoState?.('ar');
    }, 600);
    return () => clearTimeout(t);
  }, [isLocked]);

  const scanControlStyle = {
    position: 'absolute',
    left: '50%',
    bottom: 138,
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
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
    : isFocusing
      ? t(lang, '正在对焦，自动锁定…', 'Focusing · locking target…')
      : t(lang, '对准目标，自动扫描', 'Aim at the target · auto scanning');

  const lockManually = React.useCallback(() => {
    setShowManualLock(false);
    setScanState('locked');
  }, []);

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

        <div style={{ flex: 1 }} />

        <LangChip lang={lang} onToggle={setLang} />
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
              fontSize: 13,
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

// ─── SCREEN 4: AR Active ──────────────────────────────────────
function ScreenARActive({ lang = 'zh', setLang }) {
  const [arPhase, setArPhase] = React.useState('intro-playing');
  const [frozenState, setFrozenState] = React.useState(() => window.__mindar?.getFrozenState?.() || null);
  const pointersRef = React.useRef(new Map());
  const gestureRef = React.useRef({ lastAngle: null });

  React.useEffect(() => {
    Step06Assets.preloadUrls(INTRO_FRAME_URLS);
  }, []);

  React.useEffect(() => () => {
    window.__mindar?.unfreezeCurrentTarget?.();
  }, []);

  const handleIntroComplete = React.useCallback(() => {
    setArPhase('final-live');
  }, []);

  const captureFrame = React.useCallback(() => {
    setArPhase((current) => {
      if (current === 'captured-frame') {
        const nextFrozenState = window.__mindar?.unfreezeCurrentTarget?.() || null;
        setFrozenState(nextFrozenState);
        console.log('[EMO-AR] unfreeze', nextFrozenState);
        return 'final-live';
      }
      EMOARAudio.playShutter();
      const nextFrozenState = window.__mindar?.freezeCurrentTarget?.() || null;
      setFrozenState(nextFrozenState);
      console.log('[EMO-AR] freeze', nextFrozenState);
      return 'captured-frame';
    });
  }, []);

  const exitAR = React.useCallback(() => {
    window.__mindar?.unfreezeCurrentTarget?.();
    window.__setProtoState?.('landing');
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

  const handleFrozenPointerDown = React.useCallback((event) => {
    if (!isLive) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      gestureRef.current.lastAngle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    } else {
      gestureRef.current.lastAngle = null;
    }
  }, [isLive]);

  const handleFrozenPointerMove = React.useCallback((event) => {
    if (!isLive) return;
    const prev = pointersRef.current.get(event.pointerId);
    if (!prev) return;
    event.preventDefault();
    const next = { x: event.clientX, y: event.clientY };
    pointersRef.current.set(event.pointerId, next);

    if (pointersRef.current.size >= 2) {
      const [a, b] = Array.from(pointersRef.current.values()).slice(0, 2);
      const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      if (gestureRef.current.lastAngle != null) {
        let delta = angle - gestureRef.current.lastAngle;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        const yawDelta = -delta;
        if (isCaptured) {
          const nextFrozenState = window.__mindar?.rotateFrozenBy?.({ yawDelta });
          if (nextFrozenState) {
            setFrozenState(nextFrozenState);
            console.log('[EMO-AR] rotate frozen', { yawDelta, yaw: nextFrozenState.rotation?.y });
          }
        } else {
          const liveResult = window.__mindar?.rotateLiveBy?.({ yawDelta });
          if (liveResult) console.log('[EMO-AR] rotate live', { yawDelta, yaw: liveResult.yaw });
        }
      }
      gestureRef.current.lastAngle = angle;
    } else if (pointersRef.current.size === 1 && isCaptured) {
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const nextFrozenState = window.__mindar?.moveFrozenByScreenDelta?.({ dx, dy });
      if (nextFrozenState) {
        setFrozenState(nextFrozenState);
        console.log('[EMO-AR] move', { dx, dy, position: nextFrozenState.position });
      }
    }
  }, [isCaptured, isLive]);

  const handleFrozenPointerUp = React.useCallback((event) => {
    pointersRef.current.delete(event.pointerId);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (pointersRef.current.size < 2) gestureRef.current.lastAngle = null;
  }, []);

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
        opacity: arPhase === 'intro-playing' ? 1 : 0,
        transition: 'top 420ms ease-out, transform 420ms ease-out, opacity 320ms ease-out',
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
      </div>

      <IOSStatusBar dark />

      <div style={{
        position: 'absolute', top: 58, left: 16, right: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <FrostButton onClick={exitAR} style={{ width: 38, padding: 0 }}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 3l8 8M11 3l-8 8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
        </FrostButton>

        <LangChip lang={lang} onToggle={setLang} />
      </div>

      {isLive && (
        <div
          aria-label={isCaptured
            ? 'Drag to move EMO; twist with two fingers to rotate'
            : 'Twist with two fingers to rotate EMO'}
          onPointerDown={handleFrozenPointerDown}
          onPointerMove={handleFrozenPointerMove}
          onPointerUp={handleFrozenPointerUp}
          onPointerCancel={handleFrozenPointerUp}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 96,
            bottom: 220,
            zIndex: 4,
            pointerEvents: 'auto',
            touchAction: 'none',
            cursor: 'grab',
          }}
        />
      )}

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
        {!isCaptured && (
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
              : t(lang, '双指旋转一毛 · 拍下并分享', 'Twist with two fingers · Capture & share')}
          </div>
        )}
        {isCaptured ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, pointerEvents: 'auto' }}>
            <div style={{ display: 'flex', gap: 12 }}>
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

      {/* TEMP DEBUG OVERLAY — remove once frozen edit is verified on device */}
      <div style={{
        position: 'absolute',
        top: 100,
        right: 12,
        zIndex: 10,
        padding: '8px 10px',
        borderRadius: 10,
        background: 'rgba(0,0,0,0.62)',
        border: '0.5px solid rgba(255,255,255,0.18)',
        fontFamily: FONT_MONO,
        fontSize: 9.5,
        lineHeight: 1.45,
        color: '#fff',
        textAlign: 'left',
        pointerEvents: 'none',
        maxWidth: 180,
      }}>
        <div>phase: <b style={{ color: '#A9D45A' }}>{arPhase}</b></div>
        <div>frozen: <b style={{ color: frozenState?.active ? '#A9D45A' : '#E56D89' }}>{String(!!frozenState?.active)}</b></div>
        {frozenState && (
          <>
            <div>pos: {frozenState.position ? `${frozenState.position.x.toFixed(2)}, ${frozenState.position.y.toFixed(2)}, ${frozenState.position.z.toFixed(2)}` : '—'}</div>
            <div>rot: {frozenState.rotation ? `${frozenState.rotation.x.toFixed(0)}, ${frozenState.rotation.y.toFixed(0)}, ${frozenState.rotation.z.toFixed(0)}` : '—'}</div>
          </>
        )}
      </div>

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
            {t(lang, '唤醒一毛中…', 'Waking up EMO…')}
          </div>
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
  EMOARAudio,
  EMO_INTRO_FRAME_URLS: INTRO_FRAME_URLS,
});
