import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
import { supabase } from '../lib/supabaseClient';
import { prefetchImage } from '../lib/imageCache';
import { readSettingsSnapshot, writeSettingsSnapshot } from '../lib/settingsSnapshot';

interface SettingsContextValue extends AppSettings {
  setLocale: (v: Locale) => void;
  setCategoryColumns: (v: 2 | 3 | 4 | 5 | 6) => void;
  setCategorySortOrder: (v: CategorySortOrder) => void;
  setTheme: (v: Theme) => void;
  setBackgroundColor: (v: string) => void;
  setBackgroundMode: (v: 'color' | 'image') => void;
  setBackgroundImageUrl: (v: string | null) => void;
  setLandingBackgroundColor: (v: string | null) => void;
  setLandingBackgroundMode: (v: 'color' | 'image') => void;
  setLandingBackgroundImageUrl: (v: string | null) => void;
  setLandingBackgroundOverlayOpacity: (v: number | null) => void;
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
  setAutoBackgroundSource: (v: 'none' | 'unsplash') => void;
  setAutoBackgroundScope: (v: 'landing' | 'dashboard' | 'both') => void;
  setAutoBackgroundQuery: (v: string | null) => void;
  setAutoBackgroundIntervalHoursLanding: (v: number | null) => void;
  setAutoBackgroundTimeOfDayMode: (v: 'off' | 'by_time_of_day') => void;
  setAutoBackgroundMorningQuery: (v: string | null) => void;
  setAutoBackgroundNoonQuery: (v: string | null) => void;
  setAutoBackgroundEveningQuery: (v: string | null) => void;
  persist: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({
  children,
  applyDocumentTheme = true,
}: {
  children: React.ReactNode;
  /** Tắt khi mount trong shadow overlay — không được đụng class `html` của trang host. */
  applyDocumentTheme?: boolean;
}) {
  const cachedSettings = useMemo(() => readSettingsSnapshot(), []);
  const [settings, setSettings] = useState<AppSettings>(() =>
    cachedSettings ? { ...DEFAULT_SETTINGS, ...cachedSettings } : DEFAULT_SETTINGS
  );
  const [loaded, setLoaded] = useState(!!cachedSettings);

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
        const next = { ...DEFAULT_SETTINGS, ...stored };
        setSettings(next);
        writeSettingsSnapshot(next);
      }
      setLoaded(true);
    })();
  }, []);

  // Sau khi đã load từ chrome storage, đồng bộ từ Supabase (nếu có user đăng nhập)
  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('profiles')
          .select('locale, background_color, start_on_landing, settings_json')
          .eq('id', user.id)
          .single();

        if (error || !data) return;

        const serverPatch: Partial<AppSettings> = {};

        if (data.locale) {
          serverPatch.locale = data.locale as Locale;
        }
        if (data.background_color) {
          serverPatch.backgroundColor = data.background_color as string;
        }
        if (typeof data.start_on_landing === 'boolean') {
          serverPatch.startOnLanding = data.start_on_landing as boolean;
        }
        if (data.settings_json && typeof data.settings_json === 'object') {
          Object.assign(serverPatch, data.settings_json as Partial<AppSettings>);
        }

        if (Object.keys(serverPatch).length === 0) return;

        setSettings((prev) => {
          const next = { ...prev, ...serverPatch };
          chromeStorageAdapter.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
          writeSettingsSnapshot(next);
          return next;
        });
      } catch {
        // ignore sync error
      }
    })();
  }, [loaded]);

  useEffect(() => {
    if (!loaded || !applyDocumentTheme) return;
    const root = document.documentElement;
    root.classList.toggle('dark', settings.theme === 'dark');
    root.classList.toggle('light', settings.theme === 'light');
  }, [loaded, settings.theme, applyDocumentTheme]);

  const persist = useCallback((next: AppSettings) => {
    chromeStorageAdapter.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
    writeSettingsSnapshot(next);

    // Đồng bộ lên Supabase (nếu user đã đăng nhập)
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        await supabase
          .from('profiles')
          .update({
            locale: next.locale,
            background_color: next.backgroundColor,
            start_on_landing: next.startOnLanding,
            settings_json: next,
          })
          .eq('id', user.id);
      } catch {
        // ignore sync error
      }
    })();
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
    setLandingBackgroundColor: (v) => update({ landingBackgroundColor: v }),
    setLandingBackgroundMode: (v) => update({ landingBackgroundMode: v }),
    setLandingBackgroundImageUrl: (v) => update({ landingBackgroundImageUrl: v }),
    setLandingBackgroundOverlayOpacity: (v) =>
      update({ landingBackgroundOverlayOpacity: v ?? null }),
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
    setAutoBackgroundSource: (v) => update({ autoBackgroundSource: v }),
    setAutoBackgroundScope: (v) => update({ autoBackgroundScope: v }),
    setAutoBackgroundQuery: (v) => update({ autoBackgroundQuery: v }),
    setAutoBackgroundIntervalHoursLanding: (v) => update({ autoBackgroundIntervalHoursLanding: v }),
    setAutoBackgroundTimeOfDayMode: (v) => update({ autoBackgroundTimeOfDayMode: v }),
    setAutoBackgroundMorningQuery: (v) => update({ autoBackgroundMorningQuery: v }),
    setAutoBackgroundNoonQuery: (v) => update({ autoBackgroundNoonQuery: v }),
    setAutoBackgroundEveningQuery: (v) => update({ autoBackgroundEveningQuery: v }),
    persist: () => persist(settings),
  };

  useEffect(() => {
    if (!loaded) return;
    if (settings.backgroundImageUrl) {
      prefetchImage(settings.backgroundImageUrl);
    }
    if (settings.landingBackgroundImageUrl) {
      prefetchImage(settings.landingBackgroundImageUrl);
    }
  }, [loaded, settings.backgroundImageUrl, settings.landingBackgroundImageUrl]);

  if (!loaded && applyDocumentTheme) return null;

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
