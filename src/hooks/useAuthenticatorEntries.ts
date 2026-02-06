import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface AuthenticatorEntry {
  id: string;
  user_id: string;
  issuer: string;
  account_name: string;
  secret: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useAuthenticatorEntries(userId: string | undefined) {
  const [entries, setEntries] = useState<AuthenticatorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!userId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from('authenticator_entries')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });
      if (e) throw e;
      setEntries((data ?? []) as AuthenticatorEntry[]);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const addEntry = useCallback(
    async (issuer: string, accountName: string, secret: string) => {
      if (!userId) return;
      const maxOrder = entries.length === 0 ? 0 : Math.max(...entries.map((e) => e.sort_order), 0);
      const { data, error: e } = await supabase
        .from('authenticator_entries')
        .insert({
          user_id: userId,
          issuer: issuer.trim() || 'Unknown',
          account_name: accountName.trim() || 'Account',
          secret: secret.trim(),
          sort_order: maxOrder + 1,
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();
      if (e) throw e;
      setEntries((prev) => [...prev, data as AuthenticatorEntry].sort((a, b) => a.sort_order - b.sort_order));
      return data as AuthenticatorEntry;
    },
    [userId, entries]
  );

  const deleteEntry = useCallback(async (id: string) => {
    const { error: e } = await supabase.from('authenticator_entries').delete().eq('id', id);
    if (e) throw e;
    setEntries((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const updateOrder = useCallback(async (ordered: AuthenticatorEntry[]) => {
    setEntries(ordered);
    const now = new Date().toISOString();
    for (let i = 0; i < ordered.length; i++) {
      const { error } = await supabase
        .from('authenticator_entries')
        .update({ sort_order: i, updated_at: now })
        .eq('id', ordered[i].id);
      if (error) {
        fetchEntries();
        return;
      }
    }
  }, [fetchEntries]);

  return { entries, setEntries, loading, error, refetch: fetchEntries, addEntry, deleteEntry, updateOrder };
}
