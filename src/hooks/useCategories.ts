import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { readBoardSnapshot, writeBoardSnapshot } from '../lib/dashboardBoardSnapshot';
import { supabase } from '../lib/supabaseClient';
import type { Category, Bookmark } from './useBookmarks';

type CategoryWithBookmarks = Category & { bookmarks: Bookmark[] };
type CachePolicy = 'cache-first' | 'stale-while-revalidate';

function hasBookmarksPayload(cats: unknown): cats is CategoryWithBookmarks[] {
  if (!Array.isArray(cats)) return false;
  return cats.every((c) => Array.isArray((c as CategoryWithBookmarks).bookmarks));
}

function allBookmarksEmpty(cats: CategoryWithBookmarks[]): boolean {
  return cats.length > 0 && cats.every((c) => c.bookmarks.length === 0);
}

function sameBookmarks(a: Bookmark[] | undefined, b: Bookmark[]): boolean {
  const left = a ?? [];
  if (left === b) return true;
  if (left.length !== b.length) return false;
  for (let i = 0; i < left.length; i++) {
    const x = left[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.sort_order !== y.sort_order ||
      x.title !== y.title ||
      x.url !== y.url ||
      x.category_id !== y.category_id
    ) {
      return false;
    }
  }
  return true;
}

/** Merge network payload onto current list by id so column/sort stay put when unchanged. */
export function mergeCategoryLists(
  prev: CategoryWithBookmarks[],
  incoming: CategoryWithBookmarks[]
): CategoryWithBookmarks[] {
  if (prev.length === 0 || incoming.length === 0) return incoming;
  if (prev[0].board_id !== incoming[0].board_id) return incoming;

  const prevById = new Map(prev.map((c) => [c.id, c]));
  return incoming.map((cat) => {
    const existing = prevById.get(cat.id);
    if (!existing) return cat;

    const incomingColumn = cat.column_id ?? null;
    // Keep a locally assigned column/sort when the server still reports null (orphan persist in flight).
    const keepLocalOrphanAssignment = incomingColumn == null && (existing.column_id ?? null) != null;
    const nextColumnId = keepLocalOrphanAssignment ? existing.column_id ?? null : incomingColumn;
    const nextSortOrder = keepLocalOrphanAssignment ? existing.sort_order : cat.sort_order;
    const bookmarks = sameBookmarks(existing.bookmarks, cat.bookmarks)
      ? existing.bookmarks
      : cat.bookmarks;

    if (
      existing.name === cat.name &&
      existing.color === cat.color &&
      existing.icon === cat.icon &&
      existing.sort_order === nextSortOrder &&
      (existing.column_id ?? null) === nextColumnId &&
      existing.created_at === cat.created_at &&
      bookmarks === existing.bookmarks
    ) {
      return existing;
    }

    return {
      ...existing,
      ...cat,
      column_id: nextColumnId,
      sort_order: nextSortOrder,
      bookmarks,
    };
  });
}

export function useCategories(
  boardId: string | null,
  options?: { cachePolicy?: CachePolicy }
) {
  const [categories, setCategoriesState] = useState<CategoryWithBookmarks[]>([]);
  const [loadedBoardId, setLoadedBoardId] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const boardIdRef = useRef(boardId);
  boardIdRef.current = boardId;
  const cachePolicy = options?.cachePolicy ?? 'stale-while-revalidate';

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

  const commitCategories = useCallback((board: string, next: CategoryWithBookmarks[]) => {
    setCategoriesState((prev) => {
      const merged = mergeCategoryLists(prev, next);
      writeBoardSnapshot(board, { categories: merged });
      return merged;
    });
    setLoadedBoardId(board);
    setHasFetched(true);
  }, []);

  const fetchCategories = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!boardId) {
      setCategoriesState([]);
      setLoadedBoardId(null);
      setHasFetched(false);
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
        .select('id, board_id, column_id, name, color, icon, sort_order, created_at')
        .eq('board_id', boardId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (e1) throw e1;
      if (boardIdRef.current !== boardId) return;
      const list = (cats ?? []) as Category[];
      if (list.length === 0) {
        setCategoriesState([]);
        writeBoardSnapshot(boardId, { categories: [] });
        setLoadedBoardId(boardId);
        setHasFetched(true);
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
      commitCategories(boardId, byCategory);
    } catch (e) {
      if (boardIdRef.current !== boardId) return;
      setError(e instanceof Error ? e : new Error(String(e)));
      if (!silent) {
        setCategoriesState([]);
        setLoadedBoardId(boardId);
      }
      setHasFetched(true);
    } finally {
      if (boardIdRef.current === boardId) {
        if (!silent) {
          setLoading(false);
        }
      }
    }
  }, [boardId, commitCategories]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    if (!boardId) {
      setCategoriesState([]);
      setLoadedBoardId(null);
      setHasFetched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setHasFetched(false);
    (async () => {
      const cached = await readBoardSnapshot(boardId);
      if (cancelled || boardIdRef.current !== boardId) return;
      const cachedCategories = cached?.categories as CategoryWithBookmarks[] | undefined;
      const cacheReady = hasBookmarksPayload(cachedCategories);
      const cacheAllEmpty = cacheReady && allBookmarksEmpty(cachedCategories);
      const willFetch = !cacheReady || cachePolicy === 'stale-while-revalidate';
      const canPaintCache = cacheReady && !(cacheAllEmpty && willFetch);

      if (canPaintCache) {
        setCategoriesState(cachedCategories);
        setLoadedBoardId(boardId);
        setLoading(false);
      }

      if (willFetch) {
        await fetchCategories({ silent: canPaintCache });
        if (!cancelled && boardIdRef.current === boardId) {
          setLoading(false);
        }
      } else {
        setHasFetched(true);
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [boardId, fetchCategories, cachePolicy]);

  const visible = loadedBoardId === boardId;
  const visibleCategories = useMemo(
    () => (visible ? categories : []),
    [visible, categories]
  );

  return {
    categories: visibleCategories,
    setCategories,
    loading: !!boardId && (!visible || loading),
    error,
    refetch: fetchCategories,
    loadedBoardId,
    hasFetched: visible && hasFetched,
  };
}
