import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface Card {
  id: string;
  board_id: string;
  column_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useCards(boardId: string | null) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchCards = useCallback(async () => {
    if (!boardId) {
      setCards([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from('cards')
        .select('*')
        .eq('board_id', boardId)
        .order('sort_order', { ascending: true });
      if (e) throw e;
      setCards((data ?? []) as Card[]);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  return { cards, setCards, loading, error, refetch: fetchCards };
}

