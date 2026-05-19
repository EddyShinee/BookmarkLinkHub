import React, { useEffect, useMemo, useState } from 'react';
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
  const [saving, setSaving] = useState(false);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  useEffect(() => {
    if (open) {
      const defaultCategories = allCategories.length ? allCategories : categories;
      const editCategory = editBookmark
        ? defaultCategories.find((c) => c.id === editBookmark.category_id) ?? categories.find((c) => c.id === editBookmark.category_id)
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
    }
  }, [
    open,
    editBookmark,
    initialUrl,
    initialTitle,
    defaultCategoryId,
    defaultBoardId,
    categories,
    boards,
    allCategories,
  ]);

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

  useEffect(() => {
    if (!open) return;
    if (!boardId) return;
    if (categoriesForBoard.length === 0) {
      setCategoryId('');
      return;
    }
    if (!categoriesForBoard.some((c) => c.id === categoryId)) {
      setCategoryId(categoriesForBoard[0].id);
    }
  }, [open, boardId, categoriesForBoard, categoryId]);

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
      <div className="bg-sidebar border border-white/10 rounded-xl shadow-xl w-full max-w-md p-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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
            <select
              value={boardId}
              onChange={(e) => setBoardId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white focus:ring-2 focus:ring-accent/40"
            >
              {boards.map((b) => (
                <option key={b.id} value={b.id} className="bg-sidebar">{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white focus:ring-2 focus:ring-accent/40"
            >
              {categoriesForBoard.map((c) => (
                <option key={c.id} value={c.id} className="bg-sidebar">{c.name}</option>
              ))}
            </select>
            {categoriesLoading && (
              <p className="text-[11px] text-text-muted mt-1">Đang tải category...</p>
            )}
            {!categoriesLoading && boardId && categoriesForBoard.length === 0 && (
              <p className="text-[11px] text-text-muted mt-1">Board này chưa có category.</p>
            )}
          </div>
          <div className="flex justify-end gap-1.5 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs border border-white/10 text-text-secondary hover:bg-white/10">
              Hủy
            </button>
            <button type="submit" disabled={saving || !url.trim() || !title.trim()} className="px-3 py-1.5 rounded-lg text-xs bg-accent text-white hover:bg-accent/90 disabled:opacity-50">
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
