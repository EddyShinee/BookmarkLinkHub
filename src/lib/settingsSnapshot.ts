import { SETTINGS_STORAGE_KEY, type AppSettings } from './settings';

interface SettingsSnapshot {
  version: number;
  updatedAt: number;
  settings: Partial<AppSettings>;
}

const SNAPSHOT_VERSION = 1;
const SNAPSHOT_TTL_MS = 1000 * 60 * 60 * 24;
const snapshotKey = `${SETTINGS_STORAGE_KEY}_snapshot`;

const isSnapshotFresh = (updatedAt: number) => Date.now() - updatedAt < SNAPSHOT_TTL_MS;

export function readSettingsSnapshot(): Partial<AppSettings> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(snapshotKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SettingsSnapshot;
    if (
      parsed?.version === SNAPSHOT_VERSION &&
      typeof parsed.updatedAt === 'number' &&
      isSnapshotFresh(parsed.updatedAt)
    ) {
      return parsed.settings ?? null;
    }
  } catch {
    // ignore cache errors
  }
  return null;
}

export function writeSettingsSnapshot(settings: AppSettings): void {
  if (typeof window === 'undefined') return;
  const snapshot: SettingsSnapshot = {
    version: SNAPSHOT_VERSION,
    updatedAt: Date.now(),
    settings,
  };
  try {
    window.localStorage.setItem(snapshotKey, JSON.stringify(snapshot));
  } catch {
    // ignore cache errors
  }
}
