import React, { useEffect, useMemo } from 'react';
import { useBoardColumns } from '../hooks/useBoardColumns';
import { useCards } from '../hooks/useCards';
import { useCategories } from '../hooks/useCategories';
import { supabase } from '../lib/supabaseClient';

interface BoardKanbanProps {
  boardId: string | null;
}

// Simple, read‑only Kanban view (no drag yet).
// Columns & cards are backed by board_columns + cards tables.
export default function BoardKanban({ boardId }: BoardKanbanProps) {
  const { columns, loading: colsLoading, error: colsError, refetch: refetchColumns } =
    useBoardColumns(boardId);
  const { cards, loading: cardsLoading, error: cardsError, refetch: refetchCards } =
    useCards(boardId);
  const { categories } = useCategories(boardId);

  // On first load: if no columns, create a default one.
  useEffect(() => {
    if (!boardId) return;
    if (colsLoading) return;
    if (columns.length > 0) return;
    (async () => {
      await supabase
        .from('board_columns')
        .insert({ board_id: boardId, name: 'Column 1', sort_order: 0 });
      await refetchColumns();
    })();
  }, [boardId, colsLoading, columns.length, refetchColumns]);

  // One‑time bootstrap: if there are categories but no cards,
  // map each category to a card in the first column.
  useEffect(() => {
    if (!boardId) return;
    if (colsLoading || cardsLoading) return;
    if (!columns.length) return;
    if (cards.length > 0) return;
    if (!categories.length) return;
    const firstCol = columns[0];
    (async () => {
      const payload = categories.map((cat, idx) => ({
        board_id: boardId,
        column_id: firstCol.id,
        title: cat.name,
        description: null,
        sort_order: idx,
      }));
      await supabase.from('cards').insert(payload);
      await refetchCards();
    })();
  }, [boardId, colsLoading, cardsLoading, columns, cards.length, categories, refetchCards]);

  const cardsByColumn = useMemo(() => {
    const map: Record<string, ReturnType<typeof useCards>['cards']> = {};
    for (const col of columns) {
      map[col.id] = [];
    }
    for (const card of cards) {
      if (!map[card.column_id]) map[card.column_id] = [];
      map[card.column_id].push(card);
    }
    return map;
  }, [columns, cards]);

  if (!boardId) {
    return <p className="text-xs text-text-muted py-4">Chọn một board để xem Kanban.</p>;
  }

  if (colsError || cardsError) {
    return (
      <p className="text-xs text-red-400 py-4">
        Lỗi tải Kanban: {(colsError || cardsError)?.message}
      </p>
    );
  }

  if (colsLoading || cardsLoading) {
    return <p className="text-xs text-text-muted py-4">Đang tải Kanban...</p>;
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {columns.map((col) => {
        const colCards = (cardsByColumn[col.id] ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
        return (
          <div
            key={col.id}
            className="w-72 flex-shrink-0 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm flex flex-col max-h-[70vh]"
          >
            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white truncate">{col.name}</h3>
              <span className="text-[11px] text-text-muted">{colCards.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
              {colCards.length === 0 && (
                <p className="text-[11px] text-text-muted px-2 py-1.5 rounded-lg bg-white/5">
                  Chưa có thẻ.
                </p>
              )}
              {colCards.map((card) => (
                <div
                  key={card.id}
                  className="rounded-lg border border-white/10 bg-sidebar/80 px-3 py-2 text-xs text-white shadow-[0_8px_20px_rgba(0,0,0,0.35)]"
                >
                  <p className="font-semibold truncate mb-1">{card.title}</p>
                  {card.description && (
                    <p className="text-[11px] text-text-muted line-clamp-3">{card.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

