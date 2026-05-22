import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Board, Category } from '../hooks/useBookmarks';
import { supabase } from '../lib/supabaseClient';

interface BookmarkModalProps {
  open: boolean;
  categories: Category[];
  boards: Board[];
  defaultBoardId?: string | null;
  editBookmark: { id: string; url: string; title: string; description?: string | null; category_id: string } | null;
  initialUrl?: string;
  initialTitle?: string;
  defaultCategoryId?: string | null;
  onClose: () => void;
  onSave: (data: { url: string; title: string; description: string; category_id: string }, id?: string) => Promise<void>;
}

export default function BookmarkModal({
  open,
  categories,
  boards,
  defaultBoardId,
  editBookmark,
  initialUrl = '',
  initialTitle = '',
  defaultCategoryId,
  onClose,
  onSave,
}: BookmarkModalProps) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [boardId, setBoardId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [boardSearch, setBoardSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const initializedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      initializedRef.current = null;
      return;
    }
    const initKey = editBookmark?.id ?? 'new';
    if (initializedRef.current === initKey) return;
    initializedRef.current = initKey;

    const defaultCategories = allCategories.length ? allCategories : categories;
    const editCategory = editBookmark
      ? defaultCategories.find((c) => c.id === editBookmark.category_id) ??
        categories.find((c) => c.id === editBookmark.category_id)
      : undefined;
    const resolvedBoardId =
      editCategory?.board_id ??
      (defaultBoardId ?? undefined) ??
      categories[0]?.board_id ??
      boards[0]?.id ??
      '';
    setUrl(editBookmark?.url ?? initialUrl);
    setTitle(editBookmark?.title ?? initialTitle);
    setDescription(editBookmark?.description ?? '');
    setBoardId(resolvedBoardId);
    setCategoryId(editBookmark?.category_id ?? defaultCategoryId ?? '');
    setBoardSearch('');
    setCategorySearch('');
  }, [open, editBookmark?.id, initialUrl, initialTitle, defaultCategoryId, defaultBoardId, categories, boards, allCategories]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const boardIds = boards.map((b) => b.id);
    if (boardIds.length <= 1) {
      setAllCategories(categories);
      return;
    }
    setCategoriesLoading(true);
    (async () => {
      try {
        const { data } = await supabase
          .from('categories')
          .select('id, board_id, name, sort_order')
          .in('board_id', boardIds)
          .order('sort_order', { ascending: true });
        if (!cancelled) {
          setAllCategories((data ?? []) as Category[]);
        }
      } finally {
        if (!cancelled) setCategoriesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, boards, categories]);

  const categoriesForBoard = useMemo(
    () => (boardId ? allCategories.filter((c) => c.board_id === boardId) : []),
    [allCategories, boardId]
  );

  const filteredBoards = useMemo(() => {
    const q = boardSearch.trim().toLowerCase();
    return q ? boards.filter((b) => b.name.toLowerCase().includes(q)) : boards;
  }, [boards, boardSearch]);

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    return q
      ? categoriesForBoard.filter((c) => c.name.toLowerCase().includes(q))
      : categoriesForBoard;
  }, [categoriesForBoard, categorySearch]);

  const selectedBoardName = useMemo(
    () => boards.find((b) => b.id === boardId)?.name ?? '',
    [boards, boardId]
  );
  const selectedCategoryName = useMemo(
    () => categoriesForBoard.find((c) => c.id === categoryId)?.name ?? '',
    [categoriesForBoard, categoryId]
  );

  useEffect(() => {
    if (!open) return;
    if (!boardId) return;
    if (categoriesLoading) return;
    if (categoriesForBoard.length === 0) {
      if (!categoryId) return;
      setCategoryId('');
      return;
    }
    if (categoryId && categoriesForBoard.some((c) => c.id === categoryId)) return;
    if (categoriesForBoard.length > 0) {
      setCategoryId(categoriesForBoard[0].id);
    }
  }, [open, boardId, categoriesForBoard, categoryId, categoriesLoading]);

  useEffect(() => {
    if (!open) return;
    setCategorySearch('');
  }, [open, boardId]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !title.trim() || !boardId || !categoryId) return;
    setSaving(true);
    try {
      await onSave({ url: url.trim(), title: title.trim(), description: description.trim(), category_id: categoryId }, editBookmark?.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-sidebar border border-white/10 rounded-xl shadow-xl w-full max-w-md p-4 max-h-[90vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-white mb-3">{editBookmark ? 'Sửa Bookmark' : 'Thêm Bookmark'}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">URL *</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white placeholder-text-muted focus:ring-2 focus:ring-accent/40"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Tiêu đề *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tên bookmark"
              className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white placeholder-text-muted focus:ring-2 focus:ring-accent/40"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Mô tả</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tùy chọn"
              className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white placeholder-text-muted focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Board</label>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 space-y-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]">
              <div className="flex items-center justify-between text-[11px] text-text-muted">
                <span>Đang chọn</span>
                <span className="text-white/90 font-medium truncate max-w-[220px]">{selectedBoardName || '—'}</span>
              </div>
              <div className="relative">
                <span className="material-icons-round absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-[13px] pointer-events-none">
                  search
                </span>
                <input
                  type="text"
                  value={boardSearch}
                  onChange={(e) => setBoardSearch(e.target.value)}
                  placeholder="Tìm nhanh theo tên board..."
                  className="w-full pl-8 pr-2.5 py-2 rounded-xl text-xs bg-white/10 border border-white/10 text-white placeholder:text-text-muted focus:ring-2 focus:ring-accent/40 focus:border-accent/40"
                />
              </div>
              <div className="max-h-40 overflow-y-auto overscroll-contain rounded-xl border border-white/5 bg-white/[0.03] p-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {filteredBoards.length === 0 ? (
                  <p className="text-[11px] text-text-muted px-2 py-3 text-center">Không tìm thấy board</p>
                ) : (
                  <div className="space-y-1">
                    {filteredBoards.map((b) => {
                      const isSelected = boardId === b.id;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setBoardId(b.id)}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs transition ${
                            isSelected
                              ? 'border-accent bg-accent/30 text-white shadow-[0_0_0_1px_rgba(129,140,248,0.45)] ring-1 ring-accent/70'
                              : 'border-transparent text-text-secondary hover:bg-white/8 hover:text-white'
                          }`}
                        >
                          <span className={`h-2.5 w-2.5 rounded-full ${isSelected ? 'bg-accent shadow-[0_0_0_3px_rgba(129,140,248,0.2)]' : 'bg-white/20'}`} />
                          <span className="flex-1 min-w-0 truncate text-sm font-medium">{b.name}</span>
                          {isSelected && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/30 text-accent font-semibold tracking-wide">
                              Đang chọn
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Category</label>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 space-y-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]">
              <div className="flex items-center justify-between text-[11px] text-text-muted">
                <span>Đang chọn</span>
                <span className="text-white/90 font-medium truncate max-w-[220px]">{selectedCategoryName || '—'}</span>
              </div>
              <div className="relative">
                <span className="material-icons-round absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-[13px] pointer-events-none">
                  search
                </span>
                <input
                  type="text"
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  placeholder="Tìm nhanh theo tên category..."
                  className="w-full pl-8 pr-2.5 py-2 rounded-xl text-xs bg-white/10 border border-white/10 text-white placeholder:text-text-muted focus:ring-2 focus:ring-accent/40 focus:border-accent/40"
                />
              </div>
              <div className="max-h-40 overflow-y-auto overscroll-contain rounded-xl border border-white/5 bg-white/[0.03] p-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {filteredCategories.length === 0 && !categoriesLoading ? (
                  <p className="text-[11px] text-text-muted px-2 py-3 text-center">Không tìm thấy category</p>
                ) : (
                  <div className="space-y-1">
                    {filteredCategories.map((c) => {
                      const isSelected = categoryId === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setCategoryId(c.id)}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs transition ${
                            isSelected
                              ? 'border-accent bg-accent/30 text-white shadow-[0_0_0_1px_rgba(129,140,248,0.45)] ring-1 ring-accent/70'
                              : 'border-transparent text-text-secondary hover:bg-white/8 hover:text-white'
                          }`}
                        >
                          <span className={`h-2.5 w-2.5 rounded-full ${isSelected ? 'bg-accent shadow-[0_0_0_3px_rgba(129,140,248,0.2)]' : 'bg-white/20'}`} />
                          <span className="flex-1 min-w-0 truncate text-sm font-medium">{c.name}</span>
                          {isSelected && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/30 text-accent font-semibold tracking-wide">
                              Đang chọn
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            {categoriesLoading && (
              <p className="text-[11px] text-text-muted mt-1">Đang tải category...</p>
            )}
            {!categoriesLoading && boardId && categoriesForBoard.length === 0 && (
              <p className="text-[11px] text-text-muted mt-1">Board này chưa có category.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full px-3 py-2 rounded-xl text-xs border border-white/15 text-text-secondary hover:bg-white/10 hover:text-white transition shadow-sm"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving || !url.trim() || !title.trim()}
              className="w-full px-3 py-2 rounded-xl text-xs bg-accent text-white hover:bg-accent/90 disabled:opacity-50 shadow-sm shadow-accent/30"
            >
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
