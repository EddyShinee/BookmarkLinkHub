import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Category, Bookmark } from './useBookmarks';

export function useCategories(boardId: string | null) {
  const [categories, setCategories] = useState<(Category & { bookmarks: Bookmark[] })[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const boardIdRef = useRef(boardId);
  boardIdRef.current = boardId;

  useEffect(() => {
    setCategories([]);
    setLoading(true);
  }, [boardId]);

  const fetchCategories = useCallback(async () => {
    if (!boardId) {
      setCategories([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: cats, error: e1 } = await supabase
        .from('categories')
        .select('*')
        .eq('board_id', boardId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (e1) throw e1;
      if (boardIdRef.current !== boardId) return;
      const list = (cats ?? []) as Category[];
      if (list.length === 0) {
        setCategories([]);
        setLoading(false);
        return;
      }
      const { data: bms, error: e2 } = await supabase
        .from('bookmarks')
        .select('*')
        .in('category_id', list.map((c) => c.id))
        .order('sort_order', { ascending: true });
      if (e2) throw e2;
      if (boardIdRef.current !== boardId) return;
      const bookmarks = (bms ?? []) as Bookmark[];
      const byCategory = list.map((cat) => ({
        ...cat,
        bookmarks: bookmarks.filter((b) => b.category_id === cat.id),
      }));
      setCategories(byCategory);
    } catch (e) {
      if (boardIdRef.current !== boardId) return;
      setError(e instanceof Error ? e : new Error(String(e)));
      setCategories([]);
    } finally {
      if (boardIdRef.current === boardId) {
        setLoading(false);
      }
    }
  }, [boardId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return { categories, setCategories, loading, error, refetch: fetchCategories };
}
