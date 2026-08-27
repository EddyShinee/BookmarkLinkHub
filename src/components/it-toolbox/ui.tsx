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
      ? 'border-black/10 bg-white text-slate-900 placeholder-slate-400 focus:ring-accent/35 focus:border-accent/40'
      : 'border-white/10 bg-white/5 text-white placeholder-text-muted focus:ring-accent/40 focus:border-accent/40',
    panelClass: isLight
      ? 'border-black/10 bg-black/[0.03]'
      : 'border-white/10 bg-white/[0.02]',
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
        className={`w-full px-3 py-2 rounded-lg border text-xs focus:ring-2 resize-y font-mono ${inputClass} ${
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
      className={`w-full px-3 py-2 rounded-lg border text-xs ${inputClass} ${className}`}
    />
  );
}

const BTN_VARIANTS = {
  primary: 'bg-accent/20 border-accent/50 text-accent hover:bg-accent/30 hover:text-white',
  success: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/30 hover:text-white',
  warning: 'bg-amber-500/20 border-amber-500/50 text-amber-500 hover:bg-amber-500/30 hover:text-white',
  info: 'bg-sky-500/20 border-sky-500/50 text-sky-500 hover:bg-sky-500/30 hover:text-white',
  neutral: 'bg-white/5 border-white/10 text-text-secondary hover:bg-white/10 hover:text-white',
} as const;

const BTN_VARIANTS_LIGHT: typeof BTN_VARIANTS = {
  primary: 'bg-accent/15 border-accent/40 text-accent hover:bg-accent/25',
  success: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/20',
  warning: 'bg-amber-500/10 border-amber-500/40 text-amber-700 hover:bg-amber-500/20',
  info: 'bg-sky-500/10 border-sky-500/40 text-sky-700 hover:bg-sky-500/20',
  neutral: 'bg-black/[0.04] border-black/10 text-slate-700 hover:bg-black/[0.07]',
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
      className={`flex items-center justify-center rounded-lg font-medium border disabled:opacity-50 transition ${
        compact ? 'min-w-0 px-2.5 py-1 text-[11px]' : 'min-w-[8.5rem] px-4 py-2 text-sm'
      } ${variants[variant]}`}
    >
      {children}
    </button>
  );
}
