import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Category, Bookmark } from './useBookmarks';

export function useCategories(boardId: string | null) {
  const [categories, setCategories] = useState<(Category & { bookmarks: Bookmark[] })[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchCategories = useCallback(async () => {
    if (!boardId) {
      setCategories([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: cats, error: e1 } = await supabase
        .from('categories')
        .select('*')
        .eq('board_id', boardId)
        .order('sort_order', { ascending: true });
      if (e1) throw e1;
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
      const bookmarks = (bms ?? []) as Bookmark[];
      const byCategory = list.map((cat) => ({
        ...cat,
        bookmarks: bookmarks.filter((b) => b.category_id === cat.id),
      }));
      setCategories(byCategory);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return { categories, setCategories, loading, error, refetch: fetchCategories };
}
