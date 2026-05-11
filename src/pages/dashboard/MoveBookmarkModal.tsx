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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-sidebar border border-white/10 rounded-xl shadow-xl w-full max-w-[420px] max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 px-3 pt-2.5 pb-2 border-b border-white/10">
          <h3 className="text-sm font-semibold text-white mb-0.5">
            {t.moveBookmarkModalTitle}
          </h3>
          {bookmark && (
            <p className="text-[11px] text-text-muted truncate mb-2">
              {bookmark.title || bookmark.url}
            </p>
          )}
          <div className="relative">
            <span className="material-icons-round absolute left-2 top-1/2 -translate-y-1/2 text-text-muted text-[13px] pointer-events-none">
              search
            </span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.moveBookmarkSearchPlaceholder}
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-white placeholder:text-text-muted focus:ring-2 focus:ring-accent/40 focus:border-accent/40"
            />
          </div>
        </div>
        <div className="scrollbar-none flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="p-2 pb-2.5">
            {loading ? (
              <p className="text-[11px] text-text-muted py-4 text-center">{t.loadingAuth}</p>
            ) : !hasResults ? (
              <p className="text-[11px] text-text-muted py-4 text-center">{t.moveBookmarkNoResults}</p>
            ) : (
              filtered.map(({ board, categories: cats }) => (
                <div key={board.id} className="mb-1.5 last:mb-0 rounded-lg border border-white/10 bg-white/5 p-1.5">
                  <p className="text-sm font-bold text-white tracking-wide px-2 py-1.5 mb-1">
                    {board.name}
                  </p>
                  <div className="space-y-0.5">
                    {cats.length === 0 && (
                      <p className="px-2 py-1.5 text-[11px] text-text-muted">{t.moveBookmarkNoCategory}</p>
                    )}
                    {cats.map((cat) => {
                      const isCurrent = bookmark?.category_id === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          disabled={isCurrent}
                          onClick={() => { onMove(cat.id, board.id); onClose(); }}
                          className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-left text-xs transition ${
                            isCurrent
                              ? 'cursor-not-allowed bg-white/5 text-text-muted border border-white/10'
                              : 'text-text-secondary hover:bg-white/10 hover:text-white border border-transparent'
                          }`}
                        >
                          <span className="font-medium truncate flex-1 min-w-0 text-sm">{cat.name}</span>
                          {isCurrent && (
                            <span className="text-[10px] text-text-muted flex-shrink-0 px-1.5 py-0.5 rounded bg-white/5">
                              {t.moveBookmarkCurrent}
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
        <div className="flex-shrink-0 p-2 border-t border-white/10">
          <button type="button" onClick={onClose} className="w-full px-3 py-1.5 rounded-lg text-xs border border-white/10 text-text-secondary hover:bg-white/10">
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
