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

export const FONT_ZH = "'Source Han Sans CN', 'Noto Sans SC', 'PingFang SC', system-ui, sans-serif";
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
