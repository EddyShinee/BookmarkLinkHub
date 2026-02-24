import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface BoardColumn {
  id: string;
  board_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useBoardColumns(boardId: string | null) {
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchColumns = useCallback(async () => {
    if (!boardId) {
      setColumns([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from('board_columns')
        .select('*')
        .eq('board_id', boardId)
        .order('sort_order', { ascending: true });
      if (e) throw e;
      setColumns((data ?? []) as BoardColumn[]);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setColumns([]);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    fetchColumns();
  }, [fetchColumns]);

  return { columns, setColumns, loading, error, refetch: fetchColumns };
}

