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
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border min-w-[280px] max-w-[90vw] transition-all duration-300"
      style={{
        backgroundColor: isSuccess
          ? 'rgba(16, 185, 129, 0.95)'
          : isError
          ? 'rgba(239, 68, 68, 0.95)'
          : 'rgba(37, 99, 235, 0.95)',
        borderColor: isSuccess
          ? 'rgba(16, 185, 129, 0.6)'
          : isError
          ? 'rgba(239, 68, 68, 0.6)'
          : 'rgba(37, 99, 235, 0.6)',
      }}
      role="status"
      aria-live="polite"
    >
      <span
        className="material-symbols-outlined text-white shrink-0"
        style={{ fontSize: 22 }}
      >
        {isSuccess ? 'check_circle' : isError ? 'error' : 'info'}
      </span>
      <p className="text-white text-sm font-medium flex-1">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="p-0.5 rounded text-white/80 hover:text-white hover:bg-white/20 transition shrink-0"
        aria-label="Đóng"
      >
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
}
