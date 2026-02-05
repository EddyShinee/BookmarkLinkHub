import React, { useEffect, useState } from 'react';

interface BoardModalProps {
  open: boolean;
  editBoard: { id: string; name: string } | null;
  onClose: () => void;
  onSave: (name: string, id?: string) => Promise<void>;
}

export default function BoardModal({ open, editBoard, onClose, onSave }: BoardModalProps) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setName(editBoard?.name ?? '');
  }, [open, editBoard?.name]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(name.trim(), editBoard?.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-sidebar border border-white/10 rounded-xl shadow-xl w-full max-w-sm p-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-white mb-3">{editBoard ? 'Sửa Board' : 'Thêm Board'}</h3>
        <form onSubmit={handleSubmit}>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">Tên board</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Công việc"
            className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white placeholder-text-muted focus:ring-2 focus:ring-accent/40 focus:border-accent/40 mb-3"
            autoFocus
          />
          <div className="flex justify-end gap-1.5">
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs border border-white/10 text-text-secondary hover:bg-white/10">
              Hủy
            </button>
            <button type="submit" disabled={saving || !name.trim()} className="px-3 py-1.5 rounded-lg text-xs bg-accent text-white hover:bg-accent/90 disabled:opacity-50">
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
