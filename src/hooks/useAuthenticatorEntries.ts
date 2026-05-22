import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { readUserDataSnapshot, writeUserDataSnapshot } from '../lib/userDataSnapshot';

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

type CachePolicy = 'cache-first' | 'stale-while-revalidate';

export function useAuthenticatorEntries(
  userId: string | undefined,
  options?: { cachePolicy?: CachePolicy }
) {
  const [entries, setEntries] = useState<AuthenticatorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const cachePolicy = options?.cachePolicy ?? 'stale-while-revalidate';

  const fetchEntries = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!userId) {
      setEntries([]);
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
        .from('authenticator_entries')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });
      if (e) throw e;
      if (userIdRef.current !== userId) return;
      const nextEntries = (data ?? []) as AuthenticatorEntry[];
      setEntries(nextEntries);
      writeUserDataSnapshot(userId, { authenticatorEntries: nextEntries });
    } catch (e) {
      if (userIdRef.current !== userId) return;
      setError(e instanceof Error ? e : new Error(String(e)));
      if (!silent) {
        setEntries([]);
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
      setEntries([]);
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
      const cachedEntries = cached?.authenticatorEntries as AuthenticatorEntry[] | undefined;
      if (cachedEntries) {
        setEntries(cachedEntries);
        setLoading(false);
        setHasLoaded(true);
      }
      if (!cachedEntries || cachePolicy === 'stale-while-revalidate') {
        fetchEntries({ silent: !!cachedEntries });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchEntries, cachePolicy]);

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
      setEntries((prev) => {
        const next = [...prev, data as AuthenticatorEntry].sort((a, b) => a.sort_order - b.sort_order);
        writeUserDataSnapshot(userId, { authenticatorEntries: next });
        return next;
      });
      return data as AuthenticatorEntry;
    },
    [userId, entries]
  );

  const deleteEntry = useCallback(async (id: string) => {
    const { error: e } = await supabase.from('authenticator_entries').delete().eq('id', id);
    if (e) throw e;
    setEntries((prev) => {
      const next = prev.filter((x) => x.id !== id);
      if (userId) {
        writeUserDataSnapshot(userId, { authenticatorEntries: next });
      }
      return next;
    });
  }, [userId]);

  const updateOrder = useCallback(async (ordered: AuthenticatorEntry[]) => {
    setEntries(ordered);
    if (userId) {
      writeUserDataSnapshot(userId, { authenticatorEntries: ordered });
    }
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
  }, [fetchEntries, userId]);

  return { entries, setEntries, loading, error, hasLoaded, refetch: fetchEntries, addEntry, deleteEntry, updateOrder };
}
