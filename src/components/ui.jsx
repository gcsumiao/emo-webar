export const TOKENS = {
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

export const FONT_ZH = "'Noto Sans SC', 'PingFang SC', system-ui, sans-serif";
export const FONT_EN = "'Gantari', 'Inter', system-ui, sans-serif";
export const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace";

export function t(lang, zh, en) {
  return lang === 'en' ? en : zh;
}

export function langFont(lang) {
  return lang === 'en' ? FONT_EN : FONT_ZH;
}

export function PillBtn({ lang = 'zh', zh, en, variant = 'primary', icon, onClick, disabled = false, style = {} }) {
  const primary = variant === 'primary';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        minHeight: 48,
        padding: '14px 20px',
        borderRadius: 999,
        border: primary ? 'none' : `1px solid ${TOKENS.ink30}`,
        background: primary ? TOKENS.ink : 'rgba(255,255,255,0.64)',
        color: primary ? TOKENS.cream : TOKENS.ink,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        cursor: disabled ? 'default' : 'pointer',
        boxShadow: primary ? '0 8px 20px rgba(31,26,31,0.18)' : 'none',
        opacity: disabled ? 0.68 : 1,
        ...style,
      }}
    >
      {icon}
      <div
        style={{
          fontFamily: langFont(lang),
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: lang === 'en' ? 0 : '0.04em',
        }}
      >
        {t(lang, zh, en)}
      </div>
    </button>
  );
}

export function LangChip({ lang = 'zh', onToggle, light = false }) {
  return (
    <div
      data-interactive="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: 4,
        borderRadius: 999,
        background: light ? 'rgba(255,255,255,0.18)' : 'rgba(31,26,31,0.06)',
        backdropFilter: light ? 'blur(12px)' : 'none',
        WebkitBackdropFilter: light ? 'blur(12px)' : 'none',
        color: light ? 'rgba(255,255,255,0.86)' : TOKENS.ink60,
      }}
    >
      {[
        { key: 'zh', label: '中' },
        { key: 'en', label: 'EN' },
      ].map((option) => (
        <button
          type="button"
          key={option.key}
          onClick={() => onToggle?.(option.key)}
          style={{
            minWidth: option.key === 'en' ? 44 : 34,
            height: 30,
            padding: '0 10px',
            borderRadius: 999,
            border: 'none',
            background: lang === option.key ? '#fff' : 'transparent',
            color: lang === option.key ? TOKENS.ink : light ? '#fff' : TOKENS.ink60,
            fontFamily: option.key === 'en' ? FONT_MONO : FONT_ZH,
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: lang === option.key ? '0 2px 10px rgba(31,26,31,0.08)' : 'none',
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SectionLabel({ lang, zh, en, style = {} }) {
  return (
    <div
      style={{
        fontFamily: langFont(lang),
        fontSize: 13,
        fontWeight: 700,
        color: TOKENS.ink,
        ...style,
      }}
    >
      {t(lang, zh, en)}
    </div>
  );
}

export function FrostButton({ children, onClick, disabled = false, style = {}, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      data-interactive="true"
      style={{
        width: 40,
        height: 40,
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

export function IOSStatusBar({ dark = false, time = '9:41' }) {
  const c = dark ? '#fff' : '#000';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `calc(var(--safe-top) + 8px) calc(var(--safe-right) + 24px) 10px calc(var(--safe-left) + 24px)`,
        position: 'relative',
        zIndex: 12,
        width: '100%',
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          fontFamily: '-apple-system, "SF Pro", system-ui',
          fontWeight: 700,
          fontSize: 17,
          lineHeight: '22px',
          color: c,
        }}
      >
        {time}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <svg width="19" height="12" viewBox="0 0 19 12">
          <rect x="0" y="7.5" width="3.2" height="4.5" rx="0.7" fill={c} />
          <rect x="4.8" y="5" width="3.2" height="7" rx="0.7" fill={c} />
          <rect x="9.6" y="2.5" width="3.2" height="9.5" rx="0.7" fill={c} />
          <rect x="14.4" y="0" width="3.2" height="12" rx="0.7" fill={c} />
        </svg>
        <svg width="17" height="12" viewBox="0 0 17 12">
          <path d="M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z" fill={c} />
          <path d="M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z" fill={c} />
          <circle cx="8.5" cy="10.5" r="1.5" fill={c} />
        </svg>
        <svg width="27" height="13" viewBox="0 0 27 13">
          <rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke={c} strokeOpacity="0.35" fill="none" />
          <rect x="2" y="2" width="20" height="9" rx="2" fill={c} />
          <path d="M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z" fill={c} fillOpacity="0.4" />
        </svg>
      </div>
    </div>
  );
}
