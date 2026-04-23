// Shared tokens + bilingual landing and permission screens
// Landing uses the big "emoji face" screenshot as hero (per user brief).

const TOKENS = {
  pink: '#F29CB0',
  pinkDeep: '#E56D89',
  pinkSoft: '#FCE3EA',
  cream: '#FFF7F0',
  creamDeep: '#FBEDE0',
  ink: '#1F1A1F',
  ink60: 'rgba(31,26,31,0.6)',
  ink30: 'rgba(31,26,31,0.3)',
  green: '#A9D45A',
};

const FONT_ZH = "'Noto Sans SC', 'PingFang SC', system-ui, sans-serif";
const FONT_EN = "'Gantari', 'Inter', system-ui, sans-serif";
const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace";

function PillBtn({ zh, en, variant = 'primary', icon, onClick, style = {} }) {
  const primary = variant === 'primary';
  return (
    <button onClick={onClick} style={{
      width: '100%', padding: '14px 20px', borderRadius: 999,
      border: primary ? 'none' : `1px solid ${TOKENS.ink30}`,
      background: primary ? TOKENS.ink : 'transparent',
      color: primary ? TOKENS.cream : TOKENS.ink,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      cursor: 'pointer', boxShadow: primary ? '0 8px 20px rgba(31,26,31,0.18)' : 'none',
      ...style,
    }}>
      {icon}
      <div style={{ fontFamily: FONT_ZH, fontSize: 16, fontWeight: 600, letterSpacing: '0.04em' }}>
        {zh} <span style={{ opacity: 0.5, fontWeight: 400, fontFamily: FONT_EN, marginLeft: 6 }}>{en}</span>
      </div>
    </button>
  );
}

function LangChip() {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '6px 10px', borderRadius: 999,
      background: 'rgba(31,26,31,0.06)', color: TOKENS.ink60,
      fontFamily: FONT_MONO, fontSize: 11, fontWeight: 500,
    }}>
      中 / EN
    </div>
  );
}

// ─── SCREEN 1: Landing — big emoji face as hero ───────────────
function ScreenLanding() {
  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
      background: `linear-gradient(180deg, #FFE4EA 0%, #FCD5DE 40%, #F8BCCB 100%)`,
    }}>
      <IOSStatusBar />

      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="assets/mascot/m_sprout.png" style={{ width: 28, height: 28, objectFit: 'contain' }}/>
          <div style={{ fontFamily: FONT_ZH, fontWeight: 800, fontSize: 15, color: TOKENS.ink }}>
            一毛 <span style={{ fontFamily: FONT_EN, fontWeight: 500, opacity: 0.55, marginLeft: 4, fontSize: 12 }}>EMO</span>
          </div>
        </div>
        <LangChip />
      </div>

      {/* Giant emoji face fills upper portion */}
      <div style={{
        position: 'absolute', top: 80, left: 0, right: 0, height: 380,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        <img src="assets/mascot-face-emoji.png" style={{
          width: '110%', maxWidth: 520, height: 'auto',
          animation: 'face-bob 5s ease-in-out infinite',
          filter: 'drop-shadow(0 30px 40px rgba(229,109,137,0.2))',
        }}/>
      </div>

      {/* floating cloud bits */}
      <div style={{ position: 'absolute', top: 60, left: 28, width: 42, height: 14, borderRadius: 20, background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }} />
      <div style={{ position: 'absolute', top: 100, right: 28, width: 28, height: 10, borderRadius: 20, background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }} />

      {/* copy block */}
      <div style={{ position: 'absolute', top: 440, left: 0, right: 0, textAlign: 'center', padding: '0 24px' }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.2em', color: TOKENS.pinkDeep, textTransform: 'uppercase' }}>
          AR 限定 · CAMPAIGN
        </div>
        <h1 style={{
          margin: '8px 0 4px', fontFamily: FONT_ZH, fontWeight: 800,
          fontSize: 30, lineHeight: 1.1, color: TOKENS.ink, letterSpacing: '-0.01em',
        }}>
          一毛来和你玩
        </h1>
        <div style={{ fontFamily: FONT_EN, fontSize: 14, color: TOKENS.ink60, marginTop: 2 }}>
          Yi Mao wants to play.
        </div>
      </div>

      {/* CTA card */}
      <div style={{
        position: 'absolute', left: 16, right: 16, bottom: 24,
        background: '#fff', borderRadius: 28, padding: '16px 18px 14px',
        boxShadow: '0 20px 40px rgba(229,109,137,0.22), 0 2px 8px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ fontFamily: FONT_ZH, fontSize: 13, fontWeight: 700, color: TOKENS.ink }}>这样玩</div>
            <div style={{ fontFamily: FONT_EN, fontSize: 10, color: TOKENS.ink60, marginTop: 1 }}>How it works</div>
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: TOKENS.ink30, letterSpacing: '0.1em' }}>3 STEPS</div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {[
            { n: 1, zh: '开启相机', en: 'Camera' },
            { n: 2, zh: '对准海报', en: 'Aim' },
            { n: 3, zh: '一毛出现', en: 'EMO!' },
          ].map((s) => (
            <div key={s.n} style={{
              flex: 1, padding: '8px 6px', borderRadius: 14,
              background: TOKENS.creamDeep, textAlign: 'center',
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: 999, background: TOKENS.ink,
                color: TOKENS.cream, fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 6px',
              }}>{s.n}</div>
              <div style={{ fontFamily: FONT_ZH, fontSize: 11, fontWeight: 600, color: TOKENS.ink }}>{s.zh}</div>
              <div style={{ fontFamily: FONT_EN, fontSize: 9, color: TOKENS.ink60, marginTop: 1 }}>{s.en}</div>
            </div>
          ))}
        </div>
        <PillBtn zh="开始体验" en="Begin" icon={
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M5 2l7 6-7 6V2z" fill="currentColor"/>
          </svg>
        }/>
      </div>
    </div>
  );
}

// ─── SCREEN 2: Permission ─────────────────────────────────────
function ScreenPermission() {
  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
      background: TOKENS.cream,
    }}>
      <IOSStatusBar />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px 0' }}>
        <button style={{
          width: 36, height: 36, borderRadius: 999, border: 'none',
          background: 'rgba(31,26,31,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M10 2L4 7l6 5" stroke={TOKENS.ink} strokeWidth="1.8" fill="none" strokeLinecap="round"/></svg>
        </button>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: '0.18em', color: TOKENS.ink30 }}>STEP 2 / 4</div>
        <LangChip />
      </div>

      {/* Illustration: camera + peeking mascot (real 3D) */}
      <div style={{ marginTop: 30, position: 'relative', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: 160, height: 160, borderRadius: 40, background: '#fff',
          boxShadow: '0 20px 40px rgba(242,156,176,0.3), inset 0 0 0 1px rgba(0,0,0,0.04)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          <svg width="70" height="58" viewBox="0 0 70 58" fill="none">
            <rect x="2" y="10" width="66" height="46" rx="10" stroke={TOKENS.ink} strokeWidth="2.5" fill={TOKENS.pinkSoft}/>
            <path d="M22 10 L26 2 L44 2 L48 10" stroke={TOKENS.ink} strokeWidth="2.5" fill="#fff" strokeLinejoin="round"/>
            <circle cx="35" cy="33" r="13" stroke={TOKENS.ink} strokeWidth="2.5" fill="#fff"/>
            <circle cx="35" cy="33" r="6" fill={TOKENS.pinkDeep}/>
            <circle cx="56" cy="20" r="2" fill={TOKENS.ink}/>
          </svg>
          <div style={{ position: 'absolute', right: -26, bottom: -20, transform: 'rotate(10deg)' }}>
            <img src="assets/mascot/m_sprout.png" style={{ width: 86, height: 86, objectFit: 'contain', filter: 'drop-shadow(0 8px 10px rgba(229,109,137,0.3))' }}/>
          </div>
          <svg width="200" height="200" style={{ position: 'absolute', inset: -20, pointerEvents: 'none' }}>
            <circle cx="100" cy="100" r="94" stroke={TOKENS.pinkDeep} strokeWidth="1.2" strokeDasharray="3 6" fill="none" opacity="0.5"/>
          </svg>
        </div>
      </div>

      <div style={{ padding: '56px 28px 0', textAlign: 'center' }}>
        <h2 style={{ margin: 0, fontFamily: FONT_ZH, fontSize: 26, fontWeight: 800, color: TOKENS.ink, letterSpacing: '-0.01em' }}>
          需要使用相机
        </h2>
        <div style={{ fontFamily: FONT_EN, fontSize: 14, color: TOKENS.ink60, marginTop: 6, fontWeight: 500 }}>
          Camera access needed
        </div>
        <p style={{ margin: '18px 22px 0', fontFamily: FONT_ZH, fontSize: 14, lineHeight: 1.65, color: TOKENS.ink60 }}>
          我们只在本次扫描中使用相机画面，<br/>不会上传或保存任何图像。
        </p>
        <p style={{ margin: '10px 22px 0', fontFamily: FONT_EN, fontSize: 12, lineHeight: 1.55, color: TOKENS.ink30, fontStyle: 'italic' }}>
          The camera stays on-device. Nothing is recorded.
        </p>
      </div>

      <div style={{
        position: 'absolute', left: 22, right: 22, bottom: 140,
        padding: '12px 14px', borderRadius: 18, background: '#fff',
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 6px 16px rgba(0,0,0,0.04)',
      }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: TOKENS.pinkSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
            <path d="M7 1L1 3v5c0 4 3 6 6 7 3-1 6-3 6-7V3L7 1z" stroke={TOKENS.pinkDeep} strokeWidth="1.6" fill="none" strokeLinejoin="round"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT_ZH, fontSize: 12, fontWeight: 600, color: TOKENS.ink }}>隐私说明</div>
          <div style={{ fontFamily: FONT_EN, fontSize: 10.5, color: TOKENS.ink60, marginTop: 1 }}>Privacy note · view details</div>
        </div>
        <svg width="8" height="12" viewBox="0 0 8 12"><path d="M1 1l6 5-6 5" stroke={TOKENS.ink30} strokeWidth="1.8" fill="none" strokeLinecap="round"/></svg>
      </div>

      <div style={{ position: 'absolute', left: 16, right: 16, bottom: 28, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PillBtn zh="允许访问" en="Allow camera" />
        <PillBtn zh="暂不使用" en="Not now" variant="ghost" />
      </div>
    </div>
  );
}

// ─── NEW SCREEN: QR entry (matches start of reference video) ──
function ScreenQR() {
  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
      background: `linear-gradient(180deg, ${TOKENS.cream} 0%, #FBE3EA 100%)`,
    }}>
      <IOSStatusBar />
      <div style={{ padding: '60px 24px 0', textAlign: 'center' }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: '0.22em', color: TOKENS.pinkDeep }}>SCAN · 扫一扫</div>
        <h2 style={{ margin: '10px 0 4px', fontFamily: FONT_ZH, fontSize: 24, fontWeight: 800, color: TOKENS.ink }}>
          扫描海报上的二维码
        </h2>
        <div style={{ fontFamily: FONT_EN, fontSize: 13, color: TOKENS.ink60 }}>Scan the QR on the poster</div>
      </div>

      <div style={{
        position: 'absolute', top: 180, left: '50%', transform: 'translateX(-50%)',
        width: 220, height: 220, borderRadius: 28, background: '#fff',
        boxShadow: '0 20px 40px rgba(229,109,137,0.2)',
        padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* fake QR */}
        <div style={{
          width: '100%', height: '100%', borderRadius: 10,
          background: `
            linear-gradient(#1F1A1F,#1F1A1F) center/100% 4px no-repeat,
            repeating-conic-gradient(${TOKENS.ink} 0% 25%, #fff 0% 50%) 50% / 12px 12px
          `,
          position: 'relative', overflow: 'hidden',
        }}>
          {[[0,0],[0,1],[1,0]].map(([r,c],i) => (
            <div key={i} style={{
              position: 'absolute', width: 48, height: 48,
              top: r ? 'auto' : 8, bottom: r ? 8 : 'auto',
              left: c ? 'auto' : 8, right: c ? 8 : 'auto',
              background: '#fff', border: `6px solid ${TOKENS.ink}`, borderRadius: 4,
            }}/>
          ))}
          <div style={{
            position: 'absolute', inset: '40%', width: 40, height: 40, borderRadius: 10,
            background: TOKENS.pinkDeep, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <img src="assets/mascot/m_sprout.png" style={{ width: 32, height: 32, objectFit: 'contain' }}/>
          </div>
        </div>
      </div>

      <div style={{
        position: 'absolute', left: 24, right: 24, bottom: 100, textAlign: 'center',
        fontFamily: FONT_ZH, fontSize: 13, color: TOKENS.ink60, lineHeight: 1.6,
      }}>
        打开微信或相机<br/>
        <span style={{ fontFamily: FONT_EN, fontSize: 11, color: TOKENS.ink30 }}>Open WeChat or Camera · tap the banner</span>
      </div>

      <div style={{
        position: 'absolute', left: 16, right: 16, bottom: 28,
        padding: '12px 16px', borderRadius: 18, background: TOKENS.ink, color: TOKENS.cream,
        fontFamily: FONT_MONO, fontSize: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>emo.ar/scan</span>
        <span style={{ opacity: 0.6 }}>→ open in browser</span>
      </div>
    </div>
  );
}

Object.assign(window, { TOKENS, FONT_ZH, FONT_EN, FONT_MONO, PillBtn, LangChip, ScreenLanding, ScreenPermission, ScreenQR });
