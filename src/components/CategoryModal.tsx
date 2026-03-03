import React, { useEffect, useRef, useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { getT } from '../lib/i18n';

const CATEGORY_COLORS = [
  '#818CF8', '#10B981', '#A855F7', '#FB923C', '#EC4899', '#3B82F6', '#EAB308', '#06B6D4', '#F43F5E', '#8B5CF6',
  '#0EA5E9', '#22C55E', '#F97316', '#6366F1', '#14B8A6', '#EF4444', '#84CC16', '#7C3AED', '#0284C7', '#DC2626',
  '#64748B', '#FACC15', '#E11D48', '#059669',
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
  initialOpenMoveModal?: boolean;
}

export default function CategoryModal({ open, boardId, editCategory, boards = [], onClose, onSave, onMoveToBoard, initialOpenMoveModal }: CategoryModalProps) {
  const settings = useSettings();
  const t = getT(settings.locale);
  const [name, setName] = useState('');
  const [useCustomColor, setUseCustomColor] = useState(false);
  const [color, setColor] = useState('#818CF8');
  const [bgOpacity, setBgOpacity] = useState(15);
  const [saving, setSaving] = useState(false);
  const [moveToBoardModalOpen, setMoveToBoardModalOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
      setMoveToBoardModalOpen(!!initialOpenMoveModal);
    }
  }, [open, editCategory?.name, editCategory?.color, initialOpenMoveModal]);

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

  const handleMoveTo = (targetBoardId: string) => {
    if (editCategory?.id && onMoveToBoard) {
      onMoveToBoard(editCategory.id, targetBoardId);
      setMoveToBoardModalOpen(false);
      onClose();
    }
  };

  if (initialOpenMoveModal && editCategory && canMoveTo) {
    return (
      <MoveToBoardModalContent
          title={t.moveToBoardModalTitle}
          categoryName={editCategory.name}
          currentBoardId={editCategory.board_id}
          boards={boards}
          searchPlaceholder={t.moveToBoardSearchPlaceholder}
          currentLabel={t.moveBookmarkCurrent}
          noResultsLabel={t.moveBookmarkNoResults}
          cancelLabel={t.cancel}
          onSelect={(boardId) => handleMoveTo(boardId)}
          onClose={onClose}
          searchInputRef={searchInputRef}
        />
    );
  }

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
                <div className="grid grid-cols-8 gap-1.5 mb-2">
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
                    max={100}
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
              <button
                type="button"
                onClick={() => setMoveToBoardModalOpen(true)}
                className="w-full px-3 py-2 rounded-lg text-sm border border-accent/50 text-accent hover:bg-accent/10 flex items-center justify-center gap-2"
              >
                <span className="material-icons-round text-[18px]">drive_file_move</span>
                {t.moveToBoardModalTitle}
              </button>
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

      {moveToBoardModalOpen && canMoveTo && (
        <MoveToBoardModalContent
          title={t.moveToBoardModalTitle}
          categoryName={editCategory?.name ?? ''}
          currentBoardId={editCategory?.board_id}
          boards={boards}
          searchPlaceholder={t.moveToBoardSearchPlaceholder}
          currentLabel={t.moveBookmarkCurrent}
          noResultsLabel={t.moveBookmarkNoResults}
          cancelLabel={t.cancel}
          onSelect={(boardId) => handleMoveTo(boardId)}
          onClose={() => setMoveToBoardModalOpen(false)}
          searchInputRef={searchInputRef}
        />
      )}
    </div>
  );
}

function MoveToBoardModalContent({
  title,
  categoryName,
  currentBoardId,
  boards,
  searchPlaceholder,
  currentLabel,
  noResultsLabel,
  cancelLabel,
  onSelect,
  onClose,
  searchInputRef,
}: {
  title: string;
  categoryName: string;
  currentBoardId?: string;
  boards: BoardOption[];
  searchPlaceholder: string;
  currentLabel: string;
  noResultsLabel: string;
  cancelLabel: string;
  onSelect: (boardId: string) => void;
  onClose: () => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const boardOrder = [...boards].sort((a, b) => a.sort_order - b.sort_order);
  const q = searchQuery.trim().toLowerCase();
  const filtered = q === '' ? boardOrder : boardOrder.filter((b) => b.name.toLowerCase().includes(q));
  const hasResults = filtered.length > 0;

  useEffect(() => {
    setSearchQuery('');
    const id = setTimeout(() => searchInputRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <div
        className="bg-sidebar border border-white/10 rounded-xl shadow-xl w-full max-w-[420px] max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 px-3 pt-2.5 pb-2 border-b border-white/10">
          <h3 className="text-sm font-semibold text-white mb-0.5">{title}</h3>
          <p className="text-[11px] text-text-muted truncate mb-2">{categoryName}</p>
          <div className="relative">
            <span className="material-icons-round absolute left-2 top-1/2 -translate-y-1/2 text-text-muted text-[13px] pointer-events-none">
              search
            </span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-white placeholder:text-text-muted focus:ring-2 focus:ring-accent/40 focus:border-accent/40"
            />
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="p-2 pb-2.5">
            {!hasResults ? (
              <p className="text-[11px] text-text-muted py-4 text-center">{noResultsLabel}</p>
            ) : (
              filtered.map((board) => {
                const isCurrent = currentBoardId === board.id;
                return (
                  <div key={board.id} className="mb-1.5 last:mb-0 rounded-lg border border-white/10 bg-white/5 p-1.5">
                    <button
                      type="button"
                      disabled={isCurrent}
                      onClick={() => onSelect(board.id)}
                      className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-left text-xs transition ${
                        isCurrent
                          ? 'cursor-not-allowed bg-white/5 text-text-muted border border-white/10'
                          : 'text-text-secondary hover:bg-white/10 hover:text-white border border-transparent'
                      }`}
                    >
                      <span className="font-medium truncate flex-1 min-w-0 text-sm">{board.name}</span>
                      {isCurrent && (
                        <span className="text-[10px] text-text-muted flex-shrink-0 px-1.5 py-0.5 rounded bg-white/5">
                          {currentLabel}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="flex-shrink-0 p-2 border-t border-white/10">
          <button type="button" onClick={onClose} className="w-full px-3 py-1.5 rounded-lg text-xs border border-white/10 text-text-secondary hover:bg-white/10">
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
