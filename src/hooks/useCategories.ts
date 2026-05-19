import { useState, useEffect, useCallback, useRef } from 'react';
import { readBoardSnapshot, writeBoardSnapshot } from '../lib/dashboardBoardSnapshot';
import { supabase } from '../lib/supabaseClient';
import type { Category, Bookmark } from './useBookmarks';

type CategoryWithBookmarks = Category & { bookmarks: Bookmark[] };

export function useCategories(boardId: string | null) {
  const [categories, setCategoriesState] = useState<CategoryWithBookmarks[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const boardIdRef = useRef(boardId);
  boardIdRef.current = boardId;

  const setCategories = useCallback(
    (value: CategoryWithBookmarks[] | ((prev: CategoryWithBookmarks[]) => CategoryWithBookmarks[])) => {
      setCategoriesState((prev) => {
        const next = typeof value === 'function'
          ? (value as (prev: CategoryWithBookmarks[]) => CategoryWithBookmarks[])(prev)
          : value;
        if (boardIdRef.current) {
          writeBoardSnapshot(boardIdRef.current, { categories: next });
        }
        return next;
      });
    },
    []
  );

  const fetchCategories = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!boardId) {
      setCategoriesState([]);
      setLoading(false);
      return;
    }
    if (!silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const { data: cats, error: e1 } = await supabase
        .from('categories')
        .select('id, board_id, column_id, name, color, icon, sort_order')
        .eq('board_id', boardId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (e1) throw e1;
      if (boardIdRef.current !== boardId) return;
      const list = (cats ?? []) as Category[];
      if (list.length === 0) {
        setCategoriesState([]);
        if (boardIdRef.current) {
          writeBoardSnapshot(boardIdRef.current, { categories: [] });
        }
        if (!silent) {
          setLoading(false);
        }
        return;
      }
      const { data: bms, error: e2 } = await supabase
        .from('bookmarks')
        .select('id, category_id, url, title, description, tags, sort_order')
        .in('category_id', list.map((c) => c.id))
        .order('sort_order', { ascending: true });
      if (e2) throw e2;
      if (boardIdRef.current !== boardId) return;
      const bookmarks = (bms ?? []) as Bookmark[];
      const bookmarksByCategory = new Map<string, Bookmark[]>();
      for (const bookmark of bookmarks) {
        const bucket = bookmarksByCategory.get(bookmark.category_id);
        if (bucket) {
          bucket.push(bookmark);
        } else {
          bookmarksByCategory.set(bookmark.category_id, [bookmark]);
        }
      }
      const byCategory = list.map((cat) => ({
        ...cat,
        bookmarks: bookmarksByCategory.get(cat.id) ?? [],
      }));
      setCategoriesState(byCategory);
      if (boardIdRef.current) {
        writeBoardSnapshot(boardIdRef.current, { categories: byCategory });
      }
    } catch (e) {
      if (boardIdRef.current !== boardId) return;
      setError(e instanceof Error ? e : new Error(String(e)));
      if (!silent) {
        setCategoriesState([]);
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
    setCategoriesState([]);
    setLoading(!!boardId);
    setError(null);
    if (!boardId) {
      setLoading(false);
      return;
    }
    (async () => {
      let hadCache = false;
      const cached = await readBoardSnapshot(boardId);
      const cachedCategories = cached?.categories as CategoryWithBookmarks[] | undefined;
      if (!cancelled && cachedCategories) {
        setCategoriesState(cachedCategories);
        setLoading(false);
        hadCache = true;
      }
      if (!cancelled) {
        fetchCategories({ silent: hadCache });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [boardId, fetchCategories]);

  return { categories, setCategories, loading, error, refetch: fetchCategories };
}
