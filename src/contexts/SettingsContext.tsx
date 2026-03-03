import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  SETTINGS_STORAGE_KEY,
  DEFAULT_SETTINGS,
  type AppSettings,
  type Locale,
  type Theme,
  type CategoryCardHeight,
  type OpenLinkIn,
  type DragDropSettings,
  type CategorySortOrder,
  type TimeFormat,
} from '../lib/settings';
import { chromeStorageAdapter } from '../lib/chromeStorageAdapter';

interface SettingsContextValue extends AppSettings {
  setLocale: (v: Locale) => void;
  setCategoryColumns: (v: 2 | 3 | 4 | 5 | 6) => void;
  setCategorySortOrder: (v: CategorySortOrder) => void;
  setTheme: (v: Theme) => void;
  setBackgroundColor: (v: string) => void;
  setBackgroundMode: (v: 'color' | 'image') => void;
  setBackgroundImageUrl: (v: string | null) => void;
  setBackgroundOverlayOpacity: (v: number) => void;
  setCategoryCardHeight: (v: CategoryCardHeight) => void;
  setOpenLinkIn: (v: OpenLinkIn) => void;
  setDragDrop: (v: Partial<DragDropSettings>) => void;
  setCategoryColorFillContent: (v: boolean) => void;
  setStartOnLanding: (v: boolean) => void;
  setTimeFormat: (v: TimeFormat) => void;
  setShowLandingPomodoro: (v: boolean) => void;
  setShowLandingTodos: (v: boolean) => void;
  setHeaderSidebarColorEffect: (v: boolean) => void;
  persist: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const raw = await chromeStorageAdapter.getItem(SETTINGS_STORAGE_KEY);
      let stored: Partial<AppSettings> | null = null;
      if (raw != null) {
        try {
          stored = JSON.parse(raw) as Partial<AppSettings>;
        } catch {
          // ignore invalid JSON
        }
      }
      if (stored && typeof stored === 'object') {
        setSettings({ ...DEFAULT_SETTINGS, ...stored });
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const root = document.documentElement;
    root.classList.toggle('dark', settings.theme === 'dark');
    root.classList.toggle('light', settings.theme === 'light');
  }, [loaded, settings.theme]);

  const persist = useCallback((next: AppSettings) => {
    chromeStorageAdapter.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const update = useCallback(
    (patch: Partial<AppSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const value: SettingsContextValue = {
    ...settings,
    setLocale: (v) => update({ locale: v }),
    setCategoryColumns: (v) => update({ categoryColumns: v }),
    setCategorySortOrder: (v) => update({ categorySortOrder: v }),
    setTheme: (v) => update({ theme: v }),
    setBackgroundColor: (v) => update({ backgroundColor: v }),
    setBackgroundMode: (v) => update({ backgroundMode: v }),
    setBackgroundImageUrl: (v) => update({ backgroundImageUrl: v }),
    setBackgroundOverlayOpacity: (v) => update({ backgroundOverlayOpacity: v }),
    setCategoryCardHeight: (v) => update({ categoryCardHeight: v }),
    setOpenLinkIn: (v) => update({ openLinkIn: v }),
    setDragDrop: (v) => update({ dragDrop: { ...settings.dragDrop, ...v } }),
    setCategoryColorFillContent: (v) => update({ categoryColorFillContent: v }),
    setStartOnLanding: (v) => update({ startOnLanding: v }),
    setTimeFormat: (v) => update({ timeFormat: v }),
    setShowLandingPomodoro: (v) => update({ showLandingPomodoro: v }),
    setShowLandingTodos: (v) => update({ showLandingTodos: v }),
    setHeaderSidebarColorEffect: (v) => update({ headerSidebarColorEffect: v }),
    persist: () => persist(settings),
  };

  if (!loaded) return null;

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
