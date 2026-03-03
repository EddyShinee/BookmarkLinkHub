import { useCallback, useEffect, useRef, useState } from 'react';
import { createApi } from 'unsplash-js';
import { chromeStorageAdapter } from '../lib/chromeStorageAdapter';

type TimeOfDayMode = 'off' | 'by_time_of_day';

export interface UseUnsplashBackgroundOptions {
  enabled: boolean;
  scope: 'landing' | 'dashboard';
  baseQuery?: string | null;
  timeOfDayMode?: TimeOfDayMode;
  morningQuery?: string | null;
  noonQuery?: string | null;
  eveningQuery?: string | null;
  intervalHours?: number | null;
}

interface UnsplashBackgroundState {
  imageUrl: string | null;
  thumbUrl: string | null;
  authorName: string | null;
  authorUsername: string | null;
  authorLink: string | null;
  unsplashLink: string | null;
  lastFetchedAt: number | null;
}

const STORAGE_KEY_PREFIX = 'unsplash_background_';

const UNSPLASH_ACCESS_KEY =
  (import.meta as any).env?.VITE_UNSPLASH_ACCESS_KEY as string | undefined;

const unsplashClient = UNSPLASH_ACCESS_KEY
  ? createApi({
      accessKey: UNSPLASH_ACCESS_KEY,
    })
  : null;

function pickQuery(
  baseQuery: string | null | undefined,
  mode: TimeOfDayMode,
  morningQuery?: string | null,
  noonQuery?: string | null,
  eveningQuery?: string | null
): string | undefined {
  if (mode !== 'by_time_of_day') {
    return baseQuery ?? undefined;
  }
  const hour = new Date().getHours();
  if (hour < 12) {
    return (morningQuery || baseQuery || undefined) ?? undefined;
  }
  if (hour < 18) {
    return (noonQuery || baseQuery || undefined) ?? undefined;
  }
  return (eveningQuery || baseQuery || undefined) ?? undefined;
}

export function useUnsplashBackground(options: UseUnsplashBackgroundOptions) {
  const {
    enabled,
    scope,
    baseQuery = null,
    timeOfDayMode = 'off',
    morningQuery = null,
    noonQuery = null,
    eveningQuery = null,
    intervalHours = null,
  } = options;

  const [state, setState] = useState<UnsplashBackgroundState>({
    imageUrl: null,
    thumbUrl: null,
    authorName: null,
    authorUsername: null,
    authorLink: null,
    unsplashLink: null,
    lastFetchedAt: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const storageKey = `${STORAGE_KEY_PREFIX}${scope}`;

  const loadFromCache = useCallback(async () => {
    try {
      const raw = await chromeStorageAdapter.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as UnsplashBackgroundState;
      if (parsed && parsed.imageUrl) {
        setState(parsed);
      }
    } catch {
      // ignore cache errors
    }
  }, [storageKey]);

  const persist = useCallback(
    (next: UnsplashBackgroundState) => {
      setState(next);
      chromeStorageAdapter.setItem(storageKey, JSON.stringify(next));
    },
    [storageKey]
  );

  const fetchOnce = useCallback(
    async (reason: 'initial' | 'interval' | 'manual') => {
      if (!enabled) return;
      const queryToUse = pickQuery(baseQuery, timeOfDayMode, morningQuery, noonQuery, eveningQuery);

      if (!unsplashClient) {
        setError('VITE_UNSPLASH_ACCESS_KEY is missing. Please configure it in .env');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const result = await unsplashClient.photos.getRandom({
          query: queryToUse,
          orientation: 'landscape',
          count: 1,
        });

        if (result.type === 'error') {
          setError(`Unsplash error: ${result.errors?.join(', ')}`);
          return;
        }

        const data = result.response;
        const first = Array.isArray(data) ? data[0] : data;

        if (!first || !first.urls) {
          setError('Unexpected Unsplash response shape');
          return;
        }

        const imageUrl =
          first.urls.full ||
          first.urls.regular ||
          first.urls.raw ||
          first.urls.small ||
          first.urls.thumb ||
          null;

        const thumbUrl =
          first.urls.thumb || first.urls.small || first.urls.regular || imageUrl;

        const nextState: UnsplashBackgroundState = {
          imageUrl,
          thumbUrl,
          authorName: (first as any).user?.name ?? null,
          authorUsername: (first as any).user?.username ?? null,
          authorLink: (first as any).user?.links?.html ?? null,
          unsplashLink: (first as any).links?.html ?? null,
          lastFetchedAt: Date.now(),
        };

        persist(nextState);
      } catch (err: any) {
        setError(err?.message ?? String(err));
      } finally {
        setLoading(false);
      }
    },
    [enabled, baseQuery, timeOfDayMode, morningQuery, noonQuery, eveningQuery, persist]
  );

  // Initial load from cache, then optional initial fetch.
  useEffect(() => {
    if (!enabled) return;
    loadFromCache().then(() => {
      // Nếu chưa có ảnh trong cache thì fetch lần đầu.
      setState((current) => {
        if (current.imageUrl) return current;
        fetchOnce('initial');
        return current;
      });
    });
  }, [enabled, loadFromCache, fetchOnce]);

  // Interval auto refresh
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!enabled) return;
    const hours = intervalHours ?? 0;
    if (hours <= 0) return;
    const ms = hours * 60 * 60 * 1000;
    timerRef.current = setInterval(() => {
      fetchOnce('interval');
    }, ms);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, intervalHours, fetchOnce]);

  const refresh = useCallback(() => {
    if (!enabled) return;
    fetchOnce('manual');
  }, [enabled, fetchOnce]);

  return {
    imageUrl: state.imageUrl,
    thumbUrl: state.thumbUrl,
    authorName: state.authorName,
    authorUsername: state.authorUsername,
    authorLink: state.authorLink,
    unsplashLink: state.unsplashLink,
    lastFetchedAt: state.lastFetchedAt,
    loading,
    error,
    refresh,
  };
}

