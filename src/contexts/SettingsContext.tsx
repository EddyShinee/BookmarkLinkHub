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
} from '../lib/settings';

interface SettingsContextValue extends AppSettings {
  setLocale: (v: Locale) => void;
  setCategoryColumns: (v: 2 | 3 | 4 | 5 | 6) => void;
  setTheme: (v: Theme) => void;
  setBackgroundColor: (v: string) => void;
  setCategoryCardHeight: (v: CategoryCardHeight) => void;
  setOpenLinkIn: (v: OpenLinkIn) => void;
  setDragDrop: (v: Partial<DragDropSettings>) => void;
   setCategoryColorFillContent: (v: boolean) => void;
  persist: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    chrome.storage.local.get([SETTINGS_STORAGE_KEY], (result) => {
      const stored = result[SETTINGS_STORAGE_KEY];
      if (stored && typeof stored === 'object') {
        setSettings({ ...DEFAULT_SETTINGS, ...stored });
      }
      setLoaded(true);
    });
  }, []);

  const persist = useCallback((next: AppSettings) => {
    chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: next });
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
    setTheme: (v) => update({ theme: v }),
    setBackgroundColor: (v) => update({ backgroundColor: v }),
    setCategoryCardHeight: (v) => update({ categoryCardHeight: v }),
    setOpenLinkIn: (v) => update({ openLinkIn: v }),
    setDragDrop: (v) => update({ dragDrop: { ...settings.dragDrop, ...v } }),
    setCategoryColorFillContent: (v) => update({ categoryColorFillContent: v }),
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
