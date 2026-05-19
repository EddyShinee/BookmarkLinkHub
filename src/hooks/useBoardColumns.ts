import { useCallback, useEffect, useRef, useState } from 'react';
import { readBoardSnapshot, writeBoardSnapshot } from '../lib/dashboardBoardSnapshot';
import { supabase } from '../lib/supabaseClient';

export interface BoardColumn {
  id: string;
  board_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useBoardColumns(boardId: string | null, expectedColumns?: number | null) {
  const [columns, setColumnsState] = useState<BoardColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const boardIdRef = useRef(boardId);
  boardIdRef.current = boardId;

  const setColumns = useCallback(
    (value: BoardColumn[] | ((prev: BoardColumn[]) => BoardColumn[])) => {
      setColumnsState((prev) => {
        const next = typeof value === 'function'
          ? (value as (prev: BoardColumn[]) => BoardColumn[])(prev)
          : value;
        if (boardIdRef.current) {
          writeBoardSnapshot(boardIdRef.current, { columns: next });
        }
        return next;
      });
    },
    []
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
      if (boardIdRef.current) {
        writeBoardSnapshot(boardIdRef.current, { columns: next });
      }
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
  }, [boardId]);

  useEffect(() => {
    let cancelled = false;
    setColumnsState([]);
    setLoading(!!boardId);
    setError(null);
    if (!boardId) {
      setLoading(false);
      return;
    }
    (async () => {
      let hadCache = false;
      const hasExpected = typeof expectedColumns === 'number';
      if (hasExpected) {
        const cached = await readBoardSnapshot(boardId);
        const cachedColumns = cached?.columns as BoardColumn[] | undefined;
        if (!cancelled && cachedColumns && cachedColumns.length === expectedColumns) {
          setColumnsState(cachedColumns);
          setLoading(false);
          hadCache = true;
        }
      }
      if (!cancelled) {
        fetchColumns({ silent: hadCache });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [boardId, expectedColumns, fetchColumns]);

  return { columns, setColumns, loading, error, refetch: fetchColumns };
}

