import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

function mergeColumnLists(prev: BoardColumn[], incoming: BoardColumn[]): BoardColumn[] {
  if (prev.length === 0 || incoming.length === 0) return incoming;
  if (prev[0].board_id !== incoming[0].board_id) return incoming;
  if (
    prev.length === incoming.length &&
    prev.every(
      (c, i) =>
        c.id === incoming[i].id &&
        c.sort_order === incoming[i].sort_order &&
        c.name === incoming[i].name
    )
  ) {
    return prev;
  }
  return incoming;
}

export function useBoardColumns(boardId: string | null, expectedColumns?: number | null) {
  const [columns, setColumnsState] = useState<BoardColumn[]>([]);
  const [loadedBoardId, setLoadedBoardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const boardIdRef = useRef(boardId);
  boardIdRef.current = boardId;
  const loadedBoardIdRef = useRef(loadedBoardId);
  loadedBoardIdRef.current = loadedBoardId;
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

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

  const commitColumns = useCallback((board: string, incoming: BoardColumn[]) => {
    setColumnsState((prev) => {
      const merged = mergeColumnLists(prev, incoming);
      writeBoardSnapshot(board, { columns: merged });
      return merged;
    });
    setLoadedBoardId(board);
  }, []);

  const fetchColumns = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!boardId) {
      setColumnsState([]);
      setLoadedBoardId(null);
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
      commitColumns(boardId, next);
    } catch (e) {
      if (boardIdRef.current !== boardId) return;
      setError(e instanceof Error ? e : new Error(String(e)));
      if (!silent) {
        setColumnsState([]);
        setLoadedBoardId(boardId);
      }
    } finally {
      if (boardIdRef.current === boardId) {
        if (!silent) {
          setLoading(false);
        }
      }
    }
  }, [boardId, commitColumns]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    if (!boardId) {
      setColumnsState([]);
      setLoadedBoardId(null);
      setLoading(false);
      return;
    }

    const current = columnsRef.current;
    const alreadyReady =
      loadedBoardIdRef.current === boardId &&
      (typeof expectedColumns !== 'number' || current.length === expectedColumns);
    if (!alreadyReady) {
      setLoading(true);
    }

    (async () => {
      let hadCache = false;
      const cached = await readBoardSnapshot(boardId);
      if (cancelled || boardIdRef.current !== boardId) return;
      const cachedColumns = cached?.columns as BoardColumn[] | undefined;
      const cacheMatchesExpected =
        Array.isArray(cachedColumns) &&
        (typeof expectedColumns !== 'number' || cachedColumns.length === expectedColumns) &&
        cachedColumns.length > 0 &&
        (cachedColumns[0]?.board_id === boardId || !cachedColumns[0]?.board_id);

      if (cacheMatchesExpected) {
        setColumnsState(cachedColumns);
        setLoadedBoardId(boardId);
        setLoading(false);
        hadCache = true;
      }

      if (!cancelled) {
        await fetchColumns({ silent: hadCache });
        if (!cancelled && boardIdRef.current === boardId) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [boardId, expectedColumns, fetchColumns]);

  const visible = loadedBoardId === boardId;
  const visibleColumns = useMemo(
    () => (visible ? columns : []),
    [visible, columns]
  );

  return {
    columns: visibleColumns,
    setColumns,
    loading: !!boardId && (!visible || loading),
    error,
    refetch: fetchColumns,
    loadedBoardId,
  };
}
