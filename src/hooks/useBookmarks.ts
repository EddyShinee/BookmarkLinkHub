import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

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

/** Matches schema: categories (id, board_id, name, color, icon, bg_opacity, sort_order) */
export interface Category {
  id: string;
  board_id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  bg_opacity?: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  bookmarks?: Bookmark[];
}

/** Matches schema: boards (id, user_id, name, sort_order) */
export interface Board {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  categories?: Category[];
}

export function useBookmarks(userId: string | undefined) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBoards = useCallback(async () => {
    if (!userId) {
      setBoards([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from('boards')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });
      if (e) throw e;
      setBoards((data ?? []) as Board[]);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setBoards([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  return { boards, setBoards, loading, error, refetch: fetchBoards };
}
