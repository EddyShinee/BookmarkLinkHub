import { chromeStorageAdapter } from './chromeStorageAdapter';

export interface CachedBoardColumn {
  id: string;
  board_id: string;
  name: string;
  sort_order: number;
}

export interface CachedBookmark {
  id: string;
  category_id: string;
  url: string;
  title: string;
  description?: string | null;
  tags?: string[];
  sort_order: number;
}

export interface CachedCategory {
  id: string;
  board_id: string;
  column_id?: string | null;
  name: string;
  color?: string | null;
  icon?: string | null;
  bg_opacity?: number | null;
  sort_order: number;
  bookmarks: CachedBookmark[];
}

export interface BoardSnapshot {
  version: number;
  updatedAt: number;
  columns?: CachedBoardColumn[];
  categories?: CachedCategory[];
}

const SNAPSHOT_VERSION = 1;
const SNAPSHOT_TTL_MS = 1000 * 60 * 10;
const snapshotMemoryCache = new Map<string, BoardSnapshot>();

const snapshotKey = (boardId: string) => `dashboard_board_snapshot_${boardId}`;

const isSnapshotFresh = (updatedAt: number) =>
  Date.now() - updatedAt < SNAPSHOT_TTL_MS;

export async function readBoardSnapshot(boardId: string): Promise<BoardSnapshot | null> {
  const key = snapshotKey(boardId);
  const memory = snapshotMemoryCache.get(key);
  if (memory && memory.version === SNAPSHOT_VERSION && isSnapshotFresh(memory.updatedAt)) {
    return memory;
  }
  const cached = await chromeStorageAdapter.getItem(key);
  if (!cached) return null;
  try {
    const parsed = JSON.parse(cached) as BoardSnapshot;
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

export function writeBoardSnapshot(
  boardId: string,
  patch: Pick<BoardSnapshot, 'columns' | 'categories'>
): void {
  const key = snapshotKey(boardId);
  const base = snapshotMemoryCache.get(key);
  const next: BoardSnapshot = {
    version: SNAPSHOT_VERSION,
    updatedAt: Date.now(),
    columns: patch.columns ?? base?.columns,
    categories: patch.categories ?? base?.categories,
  };
  snapshotMemoryCache.set(key, next);
  chromeStorageAdapter.setItem(key, JSON.stringify(next));
}
