import { chromeStorageAdapter } from './chromeStorageAdapter';

export interface PopupSearchResult {
  id: string;
  title: string;
  url: string;
  categoryName: string;
}

interface PopupSearchCache {
  version: number;
  updatedAt: number;
  query: string;
  results: PopupSearchResult[];
}

const CACHE_VERSION = 1;
const CACHE_TTL_MS = 1000 * 60 * 5;
const memoryCache = new Map<string, PopupSearchCache>();

const cacheKey = (userId: string | undefined) => `popup_search_cache_${userId ?? 'guest'}`;

const isFresh = (updatedAt: number) => Date.now() - updatedAt < CACHE_TTL_MS;

export async function readPopupSearchCache(
  userId: string | undefined,
  query: string
): Promise<PopupSearchCache | null> {
  const key = cacheKey(userId);
  const memory = memoryCache.get(key);
  if (memory && memory.version === CACHE_VERSION && isFresh(memory.updatedAt) && memory.query === query) {
    return memory;
  }
  const raw = await chromeStorageAdapter.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PopupSearchCache;
    if (
      parsed?.version === CACHE_VERSION &&
      typeof parsed.updatedAt === 'number' &&
      isFresh(parsed.updatedAt) &&
      parsed.query === query
    ) {
      memoryCache.set(key, parsed);
      return parsed;
    }
  } catch {
    // ignore cache parse errors
  }
  return null;
}

export function writePopupSearchCache(
  userId: string | undefined,
  query: string,
  results: PopupSearchResult[]
): void {
  const key = cacheKey(userId);
  const next: PopupSearchCache = {
    version: CACHE_VERSION,
    updatedAt: Date.now(),
    query,
    results,
  };
  memoryCache.set(key, next);
  chromeStorageAdapter.setItem(key, JSON.stringify(next));
}
