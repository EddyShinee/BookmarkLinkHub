import React from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Xóa',
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="bg-sidebar border border-white/10 rounded-xl shadow-xl w-full max-w-sm p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-white mb-1.5">{title}</h3>
        <p className="text-xs text-text-secondary mb-4">{message}</p>
        <div className="flex justify-end gap-1.5">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs border border-white/10 text-text-secondary hover:bg-white/10">
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${danger ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-accent text-white hover:bg-accent/90'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
