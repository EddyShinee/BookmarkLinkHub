import { useCallback, useEffect, useRef, useState } from 'react';
import { chromeStorageAdapter } from '../lib/chromeStorageAdapter';
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
  const [columns, setColumnsState] = useState<BoardColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const boardIdRef = useRef(boardId);
  boardIdRef.current = boardId;
  const cacheKey = boardId ? `dashboard_board_columns_${boardId}` : null;

  const persistCache = useCallback(
    (next: BoardColumn[]) => {
      if (!cacheKey) return;
      chromeStorageAdapter.setItem(
        cacheKey,
        JSON.stringify({ updatedAt: Date.now(), columns: next })
      );
    },
    [cacheKey]
  );

  const setColumns = useCallback(
    (value: BoardColumn[] | ((prev: BoardColumn[]) => BoardColumn[])) => {
      setColumnsState((prev) => {
        const next = typeof value === 'function'
          ? (value as (prev: BoardColumn[]) => BoardColumn[])(prev)
          : value;
        persistCache(next);
        return next;
      });
    },
    [persistCache]
  );

  const fetchColumns = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!boardId) {
      setColumnsState([]);
      setLoading(false);
      return;
    }
    if (!silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from('board_columns')
        .select('id, board_id, name, sort_order')
        .eq('board_id', boardId)
        .order('sort_order', { ascending: true });
      if (e) throw e;
      if (boardIdRef.current !== boardId) return;
      const next = (data ?? []) as BoardColumn[];
      setColumnsState(next);
      persistCache(next);
    } catch (e) {
      if (boardIdRef.current !== boardId) return;
      setError(e instanceof Error ? e : new Error(String(e)));
      if (!silent) {
        setColumnsState([]);
      }
    } finally {
      if (boardIdRef.current === boardId) {
        if (!silent) {
          setLoading(false);
        }
      }
    }
  }, [boardId, persistCache]);

  useEffect(() => {
    let cancelled = false;
    setColumnsState([]);
    setLoading(!!boardId);
    setError(null);
    if (!boardId || !cacheKey) {
      setLoading(false);
      return;
    }
    (async () => {
      let hadCache = false;
      const cached = await chromeStorageAdapter.getItem(cacheKey);
      if (!cancelled && cached) {
        try {
          const parsed = JSON.parse(cached) as { columns?: BoardColumn[] };
          if (parsed?.columns) {
            setColumnsState(parsed.columns);
            setLoading(false);
            hadCache = true;
          }
        } catch {
          // ignore cache parse errors
        }
      }
      if (!cancelled) {
        fetchColumns({ silent: hadCache });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [boardId, cacheKey, fetchColumns]);

  return { columns, setColumns, loading, error, refetch: fetchColumns };
}

