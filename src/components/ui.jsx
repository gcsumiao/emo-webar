import React from 'react';

export const TOKENS = {
  pink: '#F29CB0',
  pinkDeep: '#E56D89',
  pinkSoft: '#FCE3EA',
  emoPink: '#EAA4C4',
  emoPinkLight: '#FFDCEA',
  emoTextPink: '#DB86B1',
  emoGray: '#DCDDDD',
  cream: '#FFF7F0',
  creamDeep: '#FBEDE0',
  ink: '#1F1A1F',
  ink60: 'rgba(31,26,31,0.6)',
  ink30: 'rgba(31,26,31,0.3)',
  green: '#A9D45A',
};

export const FONT_ZH = "'PingFang SC', 'Microsoft YaHei', 'Heiti SC', system-ui, sans-serif";
export const FONT_EN = "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
export const FONT_MONO = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
export const GLASS_BUTTON_CLASS = 'glass-button';

const GLASS_BLUR = 'saturate(160%) blur(18px)';

const GLASS_BUTTON_TONES = {
  pink: {
    background: 'linear-gradient(135deg, rgba(234,164,196,0.86), rgba(242,156,176,0.62))',
    border: '1px solid rgba(255,255,255,0.58)',
    color: '#fff',
    boxShadow: [
      'inset 0 1px 0 rgba(255,255,255,0.56)',
      'inset 0 -12px 26px rgba(219,134,177,0.18)',
      '0 16px 34px rgba(219,134,177,0.34)',
      '0 4px 12px rgba(31,26,31,0.08)',
    ].join(', '),
  },
  light: {
    background: 'linear-gradient(135deg, rgba(255,255,255,0.72), rgba(255,220,234,0.42))',
    border: '1px solid rgba(255,255,255,0.68)',
    color: TOKENS.ink,
    boxShadow: [
      'inset 0 1px 0 rgba(255,255,255,0.82)',
      'inset 0 -10px 24px rgba(242,156,176,0.11)',
      '0 12px 28px rgba(219,134,177,0.18)',
      '0 2px 8px rgba(31,26,31,0.05)',
    ].join(', '),
  },
  lightPink: {
    background: 'linear-gradient(135deg, rgba(255,255,255,0.76), rgba(255,220,234,0.58))',
    border: '1px solid rgba(255,255,255,0.72)',
    color: TOKENS.emoPink,
    boxShadow: [
      'inset 0 1px 0 rgba(255,255,255,0.86)',
      'inset 0 -10px 24px rgba(234,164,196,0.13)',
      '0 12px 26px rgba(219,134,177,0.16)',
      '0 2px 8px rgba(31,26,31,0.045)',
    ].join(', '),
  },
  dark: {
    background: 'linear-gradient(135deg, rgba(54,50,54,0.68), rgba(16,14,18,0.42))',
    border: '1px solid rgba(255,255,255,0.22)',
    color: '#fff',
    boxShadow: [
      'inset 0 1px 0 rgba(255,255,255,0.22)',
      'inset 0 -12px 28px rgba(0,0,0,0.18)',
      '0 14px 34px rgba(0,0,0,0.32)',
      '0 2px 10px rgba(242,156,176,0.12)',
    ].join(', '),
  },
  subtleLight: {
    background: 'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,220,234,0.1))',
    border: '1px solid rgba(255,255,255,0.26)',
    color: TOKENS.ink60,
    boxShadow: [
      'inset 0 1px 0 rgba(255,255,255,0.38)',
      '0 6px 18px rgba(219,134,177,0.08)',
    ].join(', '),
  },
  subtleDark: {
    background: 'linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.06))',
    border: '1px solid rgba(255,255,255,0.16)',
    color: 'rgba(255,255,255,0.86)',
    boxShadow: [
      'inset 0 1px 0 rgba(255,255,255,0.2)',
      '0 8px 22px rgba(0,0,0,0.16)',
    ].join(', '),
  },
};

export function glassButtonStyle({ tone = 'light', shape = 'pill', disabled = false } = {}) {
  const palette = GLASS_BUTTON_TONES[tone] || GLASS_BUTTON_TONES.light;
  const radius = shape === 'soft' ? 18 : 999;

  return {
    borderRadius: radius,
    border: palette.border,
    background: palette.background,
    color: palette.color,
    backdropFilter: GLASS_BLUR,
    WebkitBackdropFilter: GLASS_BLUR,
    boxShadow: palette.boxShadow,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.62 : 1,
    WebkitTapHighlightColor: 'transparent',
  };
}

export function glassIconButtonStyle({ tone = 'light', size = 40, disabled = false } = {}) {
  return {
    ...glassButtonStyle({ tone, shape: 'circle', disabled }),
    width: size,
    height: size,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  };
}

export function t(lang, zh, en) {
  return lang === 'en' ? en : zh;
}

export function langFont(lang) {
  return lang === 'en' ? FONT_EN : FONT_ZH;
}

function GitHubMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 98 96" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M48.85 0C21.88 0 0 22 0 49.16c0 21.71 14 40.13 33.43 46.64 2.43.45 3.32-1.06 3.32-2.37 0-1.17-.04-4.25-.07-8.35-13.6 2.97-16.47-6.59-16.47-6.59-2.22-5.68-5.43-7.19-5.43-7.19-4.44-3.06.34-3 .34-3 4.91.35 7.49 5.07 7.49 5.07 4.36 7.52 11.43 5.35 14.22 4.09.44-3.18 1.7-5.35 3.1-6.58-10.86-1.24-22.28-5.46-22.28-24.31 0-5.37 1.91-9.76 5.04-13.2-.5-1.25-2.18-6.25.48-13.02 0 0 4.11-1.32 13.44 5.04a46.43 46.43 0 0 1 24.48 0c9.33-6.36 13.43-5.04 13.43-5.04 2.67 6.77.99 11.77.49 13.02 3.14 3.44 5.03 7.83 5.03 13.2 0 18.9-11.44 23.05-22.34 24.27 1.75 1.52 3.31 4.52 3.31 9.11 0 6.58-.06 11.89-.06 13.5 0 1.32.88 2.85 3.36 2.36C83.98 89.27 98 70.86 98 49.16 98 22 76.13 0 48.85 0Z" />
    </svg>
  );
}

const GITHUB_CREDIT_PLACEMENTS = {
  inline: {},
  'lower-left': {
    position: 'absolute',
    left: 'calc(var(--safe-left) + 18px)',
    bottom: 'calc(var(--safe-bottom) + 22px)',
  },
  'ar-live-lower-left': {
    position: 'absolute',
    left: 'calc(var(--safe-left) + 20px)',
    bottom: 'calc(var(--safe-bottom) + 24px)',
  },
  'polaroid-lower-left': {
    position: 'absolute',
    left: 'calc(var(--safe-left) + 4px)',
    bottom: 'calc(var(--safe-bottom) + 4px)',
  },
};

export function GitHubCredit({
  href = 'https://github.com/gcsumiao/emo-webar',
  label = 'gcsumiao',
  placement = 'lower-left',
  tone = 'dark',
  clickable = true,
  style = {},
}) {
  const [active, setActive] = React.useState(false);
  const light = tone === 'light';
  const color = light ? '#fff' : TOKENS.ink;
  const background = light ? 'rgba(255,255,255,0.08)' : 'rgba(31,26,31,0.04)';
  const activeBackground = light ? 'rgba(255,255,255,0.14)' : 'rgba(31,26,31,0.065)';
  const commonStyle = {
    ...GITHUB_CREDIT_PLACEMENTS[placement],
    zIndex: 11,
    minHeight: 30,
    padding: '6px 10px 6px 9px',
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    color,
    opacity: active ? 0.78 : 0.38,
    background: active ? activeBackground : background,
    border: light ? '0.5px solid rgba(255,255,255,0.12)' : '0.5px solid rgba(31,26,31,0.025)',
    textDecoration: 'none',
    fontFamily: FONT_EN,
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    pointerEvents: clickable ? 'auto' : 'none',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    transition: 'opacity 160ms ease, background 160ms ease',
    WebkitTapHighlightColor: 'transparent',
    ...style,
  };
  const content = (
    <>
      <GitHubMark size={17} />
      <span>{label}</span>
    </>
  );

  if (!clickable) {
    return (
      <div aria-hidden="true" style={commonStyle}>
        {content}
      </div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      data-interactive="true"
      aria-label={`Open ${label} on GitHub`}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      onPointerDown={() => setActive(true)}
      onPointerUp={() => setActive(false)}
      onPointerCancel={() => setActive(false)}
      style={commonStyle}
    >
      {content}
    </a>
  );
}

export function PillBtn({ lang = 'zh', zh, en, variant = 'primary', icon, onClick, disabled = false, style = {} }) {
  const primary = variant === 'primary';
  return (
    <button
      className={GLASS_BUTTON_CLASS}
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...glassButtonStyle({ tone: primary ? 'pink' : 'lightPink', disabled }),
        width: '100%',
        minHeight: 48,
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
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
        background: light ? 'rgba(18,17,20,0.3)' : 'rgba(255,255,255,0.44)',
        border: light ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.68)',
        backdropFilter: GLASS_BLUR,
        WebkitBackdropFilter: GLASS_BLUR,
        boxShadow: light
          ? 'inset 0 1px 0 rgba(255,255,255,0.16), 0 10px 26px rgba(0,0,0,0.16)'
          : 'inset 0 1px 0 rgba(255,255,255,0.82), 0 10px 24px rgba(219,134,177,0.12)',
        color: light ? 'rgba(255,255,255,0.72)' : TOKENS.ink30,
      }}
    >
      {[
        { key: 'zh', label: '中' },
        { key: 'en', label: 'EN' },
      ].map((option) => {
        const selected = lang === option.key;
        return (
          <button
            className={GLASS_BUTTON_CLASS}
            type="button"
            key={option.key}
            onClick={() => onToggle?.(option.key)}
            style={{
              ...glassButtonStyle({
                tone: selected ? (light ? 'light' : 'lightPink') : (light ? 'subtleDark' : 'subtleLight'),
              }),
              minWidth: option.key === 'en' ? 44 : 34,
              height: 30,
              padding: '0 10px',
              border: selected
                ? '1px solid rgba(255,255,255,0.82)'
                : light
                  ? '1px solid rgba(255,255,255,0.08)'
                  : '1px solid rgba(31,26,31,0.06)',
              background: selected
                ? (light
                  ? 'linear-gradient(135deg, rgba(255,255,255,0.92), rgba(255,230,240,0.78))'
                  : 'linear-gradient(135deg, rgba(255,255,255,0.94), rgba(255,233,242,0.82))')
                : (light
                  ? 'linear-gradient(135deg, rgba(28,26,30,0.42), rgba(18,16,20,0.26))'
                  : 'linear-gradient(135deg, rgba(220,221,221,0.28), rgba(255,255,255,0.14))'),
              color: selected ? TOKENS.ink : light ? 'rgba(255,255,255,0.54)' : TOKENS.ink30,
              boxShadow: selected
                ? [
                  'inset 0 1px 0 rgba(255,255,255,0.92)',
                  'inset 0 -10px 22px rgba(234,164,196,0.14)',
                  light ? '0 10px 22px rgba(0,0,0,0.22)' : '0 10px 22px rgba(219,134,177,0.2)',
                ].join(', ')
                : 'inset 0 1px 0 rgba(255,255,255,0.16), 0 4px 12px rgba(31,26,31,0.04)',
              fontFamily: option.key === 'en' ? FONT_MONO : FONT_ZH,
              fontSize: 11,
              fontWeight: selected ? 800 : 700,
              opacity: selected ? 1 : 0.76,
            }}
          >
            {option.label}
          </button>
        );
      })}
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

export function FrostButton({ children, onClick, disabled = false, style = {}, title, tone = 'dark' }) {
  return (
    <button
      className={GLASS_BUTTON_CLASS}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      data-interactive="true"
      style={{
        ...glassIconButtonStyle({ tone, size: 40, disabled }),
        ...style,
      }}
    >
      {children}
    </button>
  );
}
