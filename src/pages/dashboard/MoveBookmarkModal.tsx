import React, { useEffect, useRef, useState } from 'react';
import type { Bookmark, Board } from '../../hooks/useBookmarks';
import { useSettings } from '../../contexts/SettingsContext';
import { getT } from '../../lib/i18n';
import { supabase } from '../../lib/supabaseClient';

export function MoveBookmarkModal({
  open,
  bookmark,
  boards,
  onClose,
  onMove,
}: {
  open: boolean;
  bookmark: Bookmark | null;
  boards: Board[];
  onClose: () => void;
  onMove: (categoryId: string, boardId: string) => void;
}) {
  const { locale } = useSettings();
  const t = getT(locale);
  const [allCategories, setAllCategories] = useState<{ id: string; name: string; board_id: string; sort_order: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const boardIds = boards.map((b) => b.id).join(',');

  useEffect(() => {
    if (!open || !bookmark || boards.length === 0) {
      setAllCategories([]);
      setSearchQuery('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const ids = boards.map((b) => b.id);
      const { data } = await supabase
        .from('categories')
        .select('id, name, board_id, sort_order')
        .in('board_id', ids)
        .order('sort_order', { ascending: true });
      if (!cancelled && data) setAllCategories((data ?? []) as { id: string; name: string; board_id: string; sort_order: number }[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, bookmark?.id, boardIds]);

  useEffect(() => {
    if (open) {
      const id = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [open]);

  if (!open) return null;

  const boardOrder = [...boards].sort((a, b) => a.sort_order - b.sort_order);
  const categoriesByBoard = boardOrder.map((board) => ({
    board,
    categories: allCategories.filter((c) => c.board_id === board.id).sort((a, b) => a.sort_order - b.sort_order),
  }));

  const q = searchQuery.trim().toLowerCase();
  const filtered =
    q === ''
      ? categoriesByBoard
      : categoriesByBoard
          .map(({ board, categories }) => {
            const boardMatches = board.name.toLowerCase().includes(q);
            const categoriesFiltered = boardMatches
              ? categories
              : categories.filter((c) => c.name.toLowerCase().includes(q));
            return { board, categories: categoriesFiltered };
          })
          .filter((x) => x.categories.length > 0 || x.board.name.toLowerCase().includes(q));

  const hasResults = filtered.length > 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#0b1220] border border-white/10 rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.55)] w-full max-w-[520px] max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 text-accent flex items-center justify-center shadow-[0_0_16px_rgba(129,140,248,0.35)]">
              <span className="material-symbols-outlined text-[20px]">drive_file_move</span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-white">{t.moveBookmarkModalTitle}</h3>
              {bookmark && (
                <p className="text-[11px] text-text-muted truncate mt-0.5">
                  {bookmark.title || bookmark.url}
                </p>
              )}
            </div>
          </div>
          <div className="relative mt-3">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[16px] pointer-events-none">
              search
            </span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.moveBookmarkSearchPlaceholder}
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-white/5 border border-white/10 text-white placeholder:text-text-muted focus:ring-2 focus:ring-accent/40 focus:border-accent/40"
            />
          </div>
        </div>
        <div className="scrollbar-none flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="p-3 space-y-3">
            {loading ? (
              <p className="text-[11px] text-text-muted py-6 text-center">{t.loadingAuth}</p>
            ) : !hasResults ? (
              <p className="text-[11px] text-text-muted py-6 text-center">{t.moveBookmarkNoResults}</p>
            ) : (
              filtered.map(({ board, categories: cats }) => (
                <div key={board.id} className="rounded-xl border border-white/10 bg-white/[0.04] overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
                    <span className="material-symbols-outlined text-[16px] text-[#256af4]">folder</span>
                    <p className="text-sm font-semibold text-white truncate">{board.name}</p>
                  </div>
                  <div className="p-2 space-y-1">
                    {cats.length === 0 && (
                      <p className="px-2 py-2 text-[11px] text-text-muted">{t.moveBookmarkNoCategory}</p>
                    )}
                    {cats.map((cat) => {
                      const isCurrent = bookmark?.category_id === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          disabled={isCurrent}
                          onClick={() => { onMove(cat.id, board.id); onClose(); }}
                          className={`group flex items-center gap-2 w-full px-3 py-2 rounded-lg text-left text-xs transition border ${
                            isCurrent
                              ? 'cursor-not-allowed border-accent/40 bg-accent/15 text-white'
                              : 'border-transparent text-text-secondary hover:bg-white/10 hover:text-white hover:border-white/15'
                          }`}
                        >
                          <span className="flex-1 min-w-0 text-sm font-medium truncate">{cat.name}</span>
                          {isCurrent ? (
                            <span className="text-[10px] text-accent flex-shrink-0 px-2 py-0.5 rounded-full bg-accent/15 border border-accent/30">
                              {t.moveBookmarkCurrent}
                            </span>
                          ) : (
                            <span className="material-symbols-outlined text-[16px] text-white/30 group-hover:text-white/70">
                              chevron_right
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="flex-shrink-0 p-3 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-3 py-2 rounded-xl text-xs border border-white/10 text-text-secondary hover:bg-white/10"
          >
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
