import { chromeStorageAdapter } from './chromeStorageAdapter';

export interface PopupUiState {
  version: number;
  updatedAt: number;
  activeTab?: 'authenticator' | 'bookmarks' | 'settings';
  showSettings?: boolean;
  searchOpen?: boolean;
  searchQuery?: string;
}

const STATE_VERSION = 1;
const STATE_TTL_MS = 1000 * 60 * 60 * 24;
const memoryCache = new Map<string, PopupUiState>();

const stateKey = (userId?: string | null) => `popup_ui_state_${userId ?? 'guest'}`;

const isStateFresh = (updatedAt: number) => Date.now() - updatedAt < STATE_TTL_MS;

export async function readPopupUiState(userId?: string | null): Promise<PopupUiState | null> {
  const key = stateKey(userId);
  const memory = memoryCache.get(key);
  if (memory && memory.version === STATE_VERSION && isStateFresh(memory.updatedAt)) {
    return memory;
  }
  const raw = await chromeStorageAdapter.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PopupUiState;
    if (
      parsed?.version === STATE_VERSION &&
      typeof parsed.updatedAt === 'number' &&
      isStateFresh(parsed.updatedAt)
    ) {
      memoryCache.set(key, parsed);
      return parsed;
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

export function writePopupUiState(
  userId: string | undefined,
  patch: Pick<PopupUiState, 'activeTab' | 'showSettings' | 'searchOpen' | 'searchQuery'>
): void {
  const key = stateKey(userId);
  const base = memoryCache.get(key);
  const next: PopupUiState = {
    version: STATE_VERSION,
    updatedAt: Date.now(),
    activeTab: patch.activeTab ?? base?.activeTab,
    showSettings: patch.showSettings ?? base?.showSettings,
    searchOpen: patch.searchOpen ?? base?.searchOpen,
    searchQuery: patch.searchQuery ?? base?.searchQuery,
  };
  memoryCache.set(key, next);
  chromeStorageAdapter.setItem(key, JSON.stringify(next));
}
