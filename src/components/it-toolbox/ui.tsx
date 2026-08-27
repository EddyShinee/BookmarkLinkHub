import React, { useCallback, useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { getT } from '../../lib/i18n';

export function useToolboxChrome() {
  const settings = useSettings();
  const isLight = settings.theme === 'light';
  return {
    isLight,
    t: getT(settings.locale),
    inputClass: isLight
      ? 'border-black/[0.08] bg-white text-slate-900 placeholder-slate-400 focus:ring-accent/40 focus:border-accent/60 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
      : 'border-white/[0.08] bg-white/[0.045] text-white placeholder-text-muted focus:ring-accent/50 focus:border-accent/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
    panelClass: isLight
      ? 'border-black/[0.07] bg-gradient-to-br from-white via-white to-slate-50 shadow-[0_8px_30px_rgba(15,23,42,0.06)]'
      : 'border-white/[0.08] bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
    headingClass: isLight ? 'text-slate-900' : 'text-white',
    mutedClass: isLight ? 'text-slate-500' : 'text-text-muted',
    codeClass: isLight
      ? 'border-black/10 bg-slate-100 text-slate-800'
      : 'border-white/10 bg-black/20 text-white/85',
    chipIdle: isLight
      ? 'bg-black/[0.04] border-black/10 text-slate-600 hover:text-slate-900'
      : 'bg-white/5 border-white/10 text-text-muted hover:text-white',
  };
}

export function Label({ children }: { children: React.ReactNode }) {
  const { mutedClass } = useToolboxChrome();
  return (
    <label className={`block text-[10px] font-semibold uppercase tracking-wider mb-1 ${mutedClass}`}>
      {children}
    </label>
  );
}

export function CopyButton({
  text,
  className = '',
}: {
  text: string;
  className?: string;
}) {
  const { t, isLight } = useToolboxChrome();
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      } catch {
        // ignore
      }
    },
    [text]
  );

  return (
    <button
      type="button"
      onClick={copy}
      disabled={!text}
      title={copied ? t.copied : t.itToolboxCopy}
      className={`inline-flex items-center justify-center h-7 w-7 rounded-md text-xs border transition disabled:opacity-40 ${
        copied
          ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-500'
          : isLight
            ? 'border-black/10 bg-white/80 text-slate-500 hover:text-slate-900 hover:bg-black/[0.04]'
            : 'border-white/10 bg-black/30 text-text-muted hover:text-white hover:bg-white/10'
      } ${className}`}
      aria-label={t.itToolboxCopy}
    >
      <span className="material-symbols-outlined text-[15px] leading-none">
        {copied ? 'check' : 'content_copy'}
      </span>
    </button>
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
  className = '',
  error,
  readOnly,
  copyable,
}: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  error?: boolean;
  readOnly?: boolean;
  copyable?: boolean;
}) {
  const { inputClass } = useToolboxChrome();
  const showCopy = copyable ?? readOnly;
  return (
    <div className={`relative min-h-0 ${className.includes('flex-1') ? 'flex-1 flex flex-col' : ''}`}>
      <textarea
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        readOnly={readOnly}
        placeholder={placeholder}
        rows={rows}
        className={`w-full px-3.5 py-2.5 rounded-xl border text-xs focus:ring-2 focus:ring-offset-0 resize-y font-mono leading-relaxed ${inputClass} ${
          showCopy ? 'pr-10' : ''
        } ${error ? 'border-red-500/60' : ''} ${className}`}
      />
      {showCopy && (
        <CopyButton text={value} className="absolute top-2 right-2" />
      )}
    </div>
  );
}

export function ToolboxInput({
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const { inputClass } = useToolboxChrome();
  return (
    <input
      {...props}
      className={`w-full px-3.5 py-2.5 rounded-xl border text-xs ${inputClass} ${className}`}
    />
  );
}

const BTN_VARIANTS = {
  primary: 'bg-gradient-to-b from-accent/30 to-accent/15 border-accent/50 text-accent hover:from-accent/40 hover:to-accent/20 hover:text-white shadow-[0_8px_20px_rgba(129,140,248,0.18)]',
  success: 'bg-gradient-to-b from-emerald-500/30 to-emerald-500/10 border-emerald-500/50 text-emerald-400 hover:from-emerald-500/40 hover:to-emerald-500/20 hover:text-white shadow-[0_8px_20px_rgba(16,185,129,0.16)]',
  warning: 'bg-gradient-to-b from-amber-500/30 to-amber-500/10 border-amber-500/50 text-amber-400 hover:from-amber-500/40 hover:to-amber-500/20 hover:text-white shadow-[0_8px_20px_rgba(245,158,11,0.16)]',
  info: 'bg-gradient-to-b from-sky-500/30 to-sky-500/10 border-sky-500/50 text-sky-400 hover:from-sky-500/40 hover:to-sky-500/20 hover:text-white shadow-[0_8px_20px_rgba(14,165,233,0.16)]',
  neutral: 'bg-white/5 border-white/10 text-text-secondary hover:bg-white/10 hover:text-white',
} as const;

const BTN_VARIANTS_LIGHT: typeof BTN_VARIANTS = {
  primary: 'bg-gradient-to-b from-indigo-50 to-white border-accent/40 text-indigo-600 hover:from-indigo-100 shadow-[0_6px_16px_rgba(99,102,241,0.12)]',
  success: 'bg-gradient-to-b from-emerald-50 to-white border-emerald-500/40 text-emerald-700 hover:from-emerald-100 shadow-[0_6px_16px_rgba(16,185,129,0.1)]',
  warning: 'bg-gradient-to-b from-amber-50 to-white border-amber-500/40 text-amber-700 hover:from-amber-100 shadow-[0_6px_16px_rgba(245,158,11,0.1)]',
  info: 'bg-gradient-to-b from-sky-50 to-white border-sky-500/40 text-sky-700 hover:from-sky-100 shadow-[0_6px_16px_rgba(14,165,233,0.1)]',
  neutral: 'bg-white border-black/10 text-slate-700 hover:bg-slate-50 shadow-sm',
};

export function ActionBtn({
  onClick,
  children,
  disabled,
  variant = 'neutral',
  compact,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  variant?: keyof typeof BTN_VARIANTS;
  compact?: boolean;
}) {
  const { isLight } = useToolboxChrome();
  const variants = isLight ? BTN_VARIANTS_LIGHT : BTN_VARIANTS;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center rounded-xl font-semibold border disabled:opacity-50 transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 ${
        compact ? 'min-w-0 px-2.5 py-1 text-[11px]' : 'min-w-[9rem] px-4 py-2.5 text-sm'
      } ${variants[variant]}`}
    >
      {children}
    </button>
  );
}
