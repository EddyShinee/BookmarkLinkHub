import { chromeStorageAdapter } from './chromeStorageAdapter';

export interface CachedBoard {
  id: string;
  user_id?: string;
  name: string;
  sort_order: number;
  category_columns?: number | null;
  category_sort_order?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CachedAuthenticatorEntry {
  id: string;
  user_id: string;
  issuer: string;
  account_name: string;
  secret: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface UserDataSnapshot {
  version: number;
  updatedAt: number;
  boards?: CachedBoard[];
  authenticatorEntries?: CachedAuthenticatorEntry[];
}

const SNAPSHOT_VERSION = 1;
const SNAPSHOT_TTL_MS = 1000 * 60 * 10;
const snapshotMemoryCache = new Map<string, UserDataSnapshot>();

const snapshotKey = (userId: string) => `user_data_snapshot_${userId}`;

const isSnapshotFresh = (updatedAt: number) =>
  Date.now() - updatedAt < SNAPSHOT_TTL_MS;

export async function readUserDataSnapshot(userId: string): Promise<UserDataSnapshot | null> {
  const key = snapshotKey(userId);
  const memory = snapshotMemoryCache.get(key);
  if (memory && memory.version === SNAPSHOT_VERSION && isSnapshotFresh(memory.updatedAt)) {
    return memory;
  }
  const cached = await chromeStorageAdapter.getItem(key);
  if (!cached) return null;
  try {
    const parsed = JSON.parse(cached) as UserDataSnapshot;
    if (
      parsed?.version === SNAPSHOT_VERSION &&
      typeof parsed.updatedAt === 'number' &&
      isSnapshotFresh(parsed.updatedAt)
    ) {
      snapshotMemoryCache.set(key, parsed);
      return parsed;
    }
  } catch {
    // ignore cache parse errors
  }
  return null;
}

export function writeUserDataSnapshot(
  userId: string,
  patch: Pick<UserDataSnapshot, 'boards' | 'authenticatorEntries'>
): void {
  const key = snapshotKey(userId);
  const base = snapshotMemoryCache.get(key);
  const next: UserDataSnapshot = {
    version: SNAPSHOT_VERSION,
    updatedAt: Date.now(),
    boards: patch.boards ?? base?.boards,
    authenticatorEntries: patch.authenticatorEntries ?? base?.authenticatorEntries,
  };
  snapshotMemoryCache.set(key, next);
  chromeStorageAdapter.setItem(key, JSON.stringify(next));
}
