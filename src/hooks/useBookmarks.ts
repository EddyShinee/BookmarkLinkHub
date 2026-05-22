import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { readUserDataSnapshot, writeUserDataSnapshot } from '../lib/userDataSnapshot';

/** Matches schema: bookmarks (id, category_id, url, title, description, tags, sort_order) */
export interface Bookmark {
  id: string;
  category_id: string;
  url: string;
  title: string;
  description?: string | null;
  tags?: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Matches schema: categories (id, board_id, column_id, name, color, icon, bg_opacity, sort_order) */
export interface Category {
  id: string;
  board_id: string;
  column_id?: string | null;
  name: string;
  color?: string | null;
  icon?: string | null;
  bg_opacity?: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  bookmarks?: Bookmark[];
}

/** Matches schema: boards (id, user_id, name, sort_order, category_columns, category_sort_order) */
export interface Board {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  category_columns?: number | null;
  category_sort_order?: string | null;
  created_at: string;
  updated_at: string;
  categories?: Category[];
}

type CachePolicy = 'cache-first' | 'stale-while-revalidate';

export function useBookmarks(
  userId: string | undefined,
  options?: { cachePolicy?: CachePolicy }
) {
  const [boards, setBoardsState] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const cachePolicy = options?.cachePolicy ?? 'stale-while-revalidate';

  const setBoards = useCallback(
    (value: Board[] | ((prev: Board[]) => Board[])) => {
      setBoardsState((prev) => {
        const next = typeof value === 'function' ? (value as (prev: Board[]) => Board[])(prev) : value;
        if (userIdRef.current) {
          writeUserDataSnapshot(userIdRef.current, { boards: next });
        }
        return next;
      });
    },
    []
  );

  const fetchBoards = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!userId) {
      setBoardsState([]);
      setLoading(false);
      setHasLoaded(true);
      return;
    }
    if (!silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from('boards')
        .select('id, name, sort_order, category_columns, category_sort_order')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });
      if (e) throw e;
      if (userIdRef.current !== userId) return;
      const nextBoards = (data ?? []) as Board[];
      setBoards(nextBoards);
    } catch (e) {
      if (userIdRef.current !== userId) return;
      setError(e instanceof Error ? e : new Error(String(e)));
      if (!silent) {
        setBoardsState([]);
      }
    } finally {
      if (userIdRef.current === userId) {
        if (!silent) {
          setLoading(false);
        }
        setHasLoaded(true);
      }
    }
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    setHasLoaded(false);
    setError(null);
    if (!userId) {
      setBoardsState([]);
      setLoading(false);
      setHasLoaded(true);
      return () => {
        cancelled = true;
      };
    }
    setLoading(true);
    (async () => {
      const cached = await readUserDataSnapshot(userId);
      if (cancelled) return;
      const cachedBoards = cached?.boards as Board[] | undefined;
      if (cachedBoards) {
        setBoardsState(cachedBoards);
        setLoading(false);
        setHasLoaded(true);
      }
      if (!cachedBoards || cachePolicy === 'stale-while-revalidate') {
        fetchBoards({ silent: !!cachedBoards });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchBoards, cachePolicy]);

  return { boards, setBoards, loading, error, hasLoaded, refetch: fetchBoards };
}
