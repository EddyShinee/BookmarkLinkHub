import React, { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  open: boolean;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type, open, onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    if (!open || !message) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [open, message, duration, onClose]);

  if (!open || !message) return null;

  const isSuccess = type === 'success';
  const isError = type === 'error';

  const accent = isSuccess
    ? {
        glow: 'from-emerald-400/35 via-teal-300/15 to-cyan-400/20',
        stripe: 'bg-gradient-to-b from-emerald-200 via-teal-300 to-cyan-400',
        icon: 'text-emerald-100',
        glyph: 'check_circle' as const,
      }
    : isError
      ? {
          glow: 'from-rose-500/35 via-red-400/15 to-orange-400/20',
          stripe: 'bg-gradient-to-b from-rose-200 via-rose-400 to-orange-400',
          icon: 'text-rose-100',
          glyph: 'error' as const,
        }
      : {
          glow: 'from-violet-500/35 via-fuchsia-400/15 to-indigo-400/20',
          stripe: 'bg-gradient-to-b from-violet-200 via-fuchsia-400 to-indigo-400',
          icon: 'text-violet-100',
          glyph: 'info' as const,
        };

  return (
    <div className="fixed bottom-16 inset-x-0 z-[300] flex justify-center px-4 pointer-events-none">
      <div className="toast-pop-in pointer-events-auto relative max-w-[min(90vw,440px)] min-w-[min(100%,300px)]">
        {/* soft colored bloom behind glass */}
        <div
          className={`pointer-events-none absolute -inset-3 rounded-[22px] bg-gradient-to-br ${accent.glow} opacity-70 blur-2xl`}
          aria-hidden
        />
        <div
          className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-white/25 bg-gradient-to-b from-white/[0.16] to-white/[0.06] px-4 py-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-1px_0_rgba(0,0,0,0.08)] backdrop-blur-2xl backdrop-saturate-150 ring-1 ring-white/10"
          role="status"
          aria-live="polite"
        >
          {/* top specular */}
          <div
            className="pointer-events-none absolute inset-x-4 top-0 h-px rounded-full bg-gradient-to-r from-transparent via-white/45 to-transparent"
            aria-hidden
          />
          {/* inner frost */}
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl bg-slate-950/[0.18]"
            aria-hidden
          />

          <div
            className={`relative h-10 w-1 shrink-0 rounded-full ${accent.stripe} shadow-[0_0_14px_rgba(255,255,255,0.25)]`}
            aria-hidden
          />

          <span
            className={`relative shrink-0 material-symbols-outlined ${accent.icon} drop-shadow-[0_1px_6px_rgba(0,0,0,0.35)]`}
            style={{ fontSize: 24 }}
          >
            {accent.glyph}
          </span>
          <p className="relative flex-1 text-sm font-medium leading-snug tracking-tight text-white/95 [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">
            {message}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="relative shrink-0 rounded-full border border-white/20 bg-white/[0.08] p-1.5 text-white/90 backdrop-blur-sm transition hover:border-white/35 hover:bg-white/[0.18] hover:text-white"
            aria-label="Đóng"
          >
            <span className="material-symbols-outlined block text-[18px] leading-none">close</span>
          </button>
        </div>
      </div>
    </div>
  );
}
