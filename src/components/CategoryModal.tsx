import React, { useEffect, useState } from 'react';

const CATEGORY_COLORS = [
  '#818CF8', '#10B981', '#A855F7', '#FB923C', '#EC4899', '#3B82F6', '#EAB308', '#06B6D4', '#F43F5E', '#8B5CF6',
];

export interface BoardOption {
  id: string;
  name: string;
  sort_order: number;
}

interface CategoryModalProps {
  open: boolean;
  boardId: string | null;
  editCategory: { id: string; name: string; color?: string | null; bg_opacity?: number | null; board_id?: string } | null;
  boards?: BoardOption[];
  onClose: () => void;
  onSave: (name: string, color: string | null, id?: string) => Promise<void>;
  onMoveToBoard?: (categoryId: string, targetBoardId: string) => void;
}

export default function CategoryModal({ open, boardId, editCategory, boards = [], onClose, onSave, onMoveToBoard }: CategoryModalProps) {
  const [name, setName] = useState('');
  const [useCustomColor, setUseCustomColor] = useState(false);
  const [color, setColor] = useState('#818CF8');
  const [bgOpacity, setBgOpacity] = useState(15);
  const [saving, setSaving] = useState(false);
  const [moveToBoardId, setMoveToBoardId] = useState<string>('');

  useEffect(() => {
    if (open) {
      setName(editCategory?.name ?? '');
      if (editCategory?.color && editCategory.color.length === 9) {
        const base = editCategory.color.slice(0, 7);
        const alphaHex = editCategory.color.slice(7, 9);
        const alpha = parseInt(alphaHex, 16);
        const pct = Math.round((alpha / 255) * 100);
        setUseCustomColor(true);
        setColor(base);
        setBgOpacity(Number.isFinite(pct) ? pct : 15);
      } else if (editCategory?.color) {
        setUseCustomColor(true);
        setColor(editCategory.color);
        setBgOpacity(15);
      } else {
        setUseCustomColor(false);
        setColor('#818CF8');
        setBgOpacity(15);
      }
      setMoveToBoardId('');
    }
  }, [open, editCategory?.name, editCategory?.color]);

  if (!open) return null;

  const otherBoards = editCategory?.board_id
    ? boards.filter((b) => b.id !== editCategory.board_id).sort((a, b) => a.sort_order - b.sort_order)
    : boards.slice().sort((a, b) => a.sort_order - b.sort_order);
  const canMoveTo = !!editCategory && otherBoards.length > 0 && onMoveToBoard;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const finalColor = useCustomColor
        ? `${color}${Math.round((bgOpacity / 100) * 255)
            .toString(16)
            .padStart(2, '0')}`
        : null;
      await onSave(name.trim(), finalColor, editCategory?.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleMoveTo = () => {
    if (editCategory?.id && moveToBoardId && onMoveToBoard) {
      onMoveToBoard(editCategory.id, moveToBoardId);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-sidebar border border-white/10 rounded-xl shadow-xl w-full max-w-sm p-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-white mb-3">{editCategory ? 'Sửa Category' : 'Thêm Category'}</h3>
        <form onSubmit={handleSubmit}>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">Tên category</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Admin Portals"
            className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white placeholder-text-muted focus:ring-2 focus:ring-accent/40 focus:border-accent/40 mb-3"
            autoFocus
          />
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-text-secondary">Màu category</label>
              <div className="flex items-center gap-2 text-[11px] text-text-muted">
                <button
                  type="button"
                  onClick={() => setUseCustomColor(false)}
                  className={`px-2 py-0.5 rounded-full border text-[11px] ${
                    !useCustomColor
                      ? 'border-accent bg-accent/20 text-accent'
                      : 'border-white/10 text-text-muted hover:border-white/30'
                  }`}
                >
                  Mặc định
                </button>
                <button
                  type="button"
                  onClick={() => setUseCustomColor(true)}
                  className={`px-2 py-0.5 rounded-full border text-[11px] ${
                    useCustomColor
                      ? 'border-accent bg-accent/20 text-accent'
                      : 'border-white/10 text-text-muted hover:border-white/30'
                  }`}
                >
                  Tuỳ chỉnh
                </button>
              </div>
            </div>
            {useCustomColor && (
              <>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {CATEGORY_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-md transition ring-2 ring-offset-1 ring-offset-sidebar ${
                        color === c ? 'ring-white' : 'ring-transparent hover:ring-white/30'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-text-secondary">Độ đậm nền (Opacity)</span>
                    <span className="text-[11px] text-text-muted">{bgOpacity}%</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={40}
                    step={1}
                    value={bgOpacity}
                    onChange={(e) => setBgOpacity(Number(e.target.value))}
                    className="w-full accent-accent"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-text-muted">Xem trước:</span>
                  <div
                    className="flex-1 px-3 py-2 rounded-lg border border-white/10 text-[11px] text-white/90"
                    style={{
                      backgroundColor: `${color}${Math.round((bgOpacity / 100) * 255)
                        .toString(16)
                        .padStart(2, '0')}`,
                    }}
                  >
                    Category preview
                  </div>
                </div>
              </>
            )}
          </div>
          {canMoveTo && (
            <div className="mb-3">
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Di chuyển sang board</label>
              <select
                value={moveToBoardId}
                onChange={(e) => setMoveToBoardId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white focus:ring-2 focus:ring-accent/40 focus:border-accent/40"
              >
                <option value="">— Chọn board —</option>
                {otherBoards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              {moveToBoardId && (
                <button
                  type="button"
                  onClick={handleMoveTo}
                  className="mt-1.5 w-full px-3 py-1.5 rounded-lg text-xs border border-accent/50 text-accent hover:bg-accent/10 flex items-center justify-center gap-1.5"
                >
                  <span className="material-icons-round text-[14px]">drive_file_move</span>
                  Move to &quot;{otherBoards.find((x) => x.id === moveToBoardId)?.name}&quot;
                </button>
              )}
            </div>
          )}
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
