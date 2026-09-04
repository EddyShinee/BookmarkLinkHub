import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../contexts/SettingsContext';
import { useBookmarks } from '../hooks/useBookmarks';
import { useCategories } from '../hooks/useCategories';
import { useAuthenticatorEntries, type AuthenticatorEntry } from '../hooks/useAuthenticatorEntries';
import { getT } from '../lib/i18n';
import { readPopupSearchCache, writePopupSearchCache, type PopupSearchResult } from '../lib/popupSearchCache';
import { readPopupUiState, writePopupUiState } from '../lib/popupUiState';
import { getHostnameCached, getHostnameOrUrl } from '../lib/urlCache';
import Toast from '../components/Toast';
import SpotlightShortcutSetting from '../components/SpotlightShortcutSetting';
import { generateTOTP, getTimeRemaining } from '../lib/totp';

const NEWTAB_PATH = 'src/newtab/index.html';
const TOTP_STEP = 30;

type TabId = 'authenticator' | 'bookmarks' | 'settings';

export default function PopupApp() {
  const { session, loading: authLoading } = useAuth();
  const settings = useSettings();
  const t = getT(settings.locale);
  const userId = session?.user?.id;

  const [activeTab, setActiveTab] = useState<TabId>('authenticator');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [uiStateReady, setUiStateReady] = useState(false);
  const appVersion = React.useMemo(() => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
      return chrome.runtime.getManifest().version;
    }
    return import.meta.env.VITE_APP_VERSION ?? '';
  }, []);

  const openNewTab = useCallback((query?: string) => {
    const url = query
      ? chrome.runtime.getURL(NEWTAB_PATH) + query
      : chrome.runtime.getURL(NEWTAB_PATH);
    chrome.tabs.create({ url });
  }, []);

  const addCurrentPage = useCallback(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.url && !tab.url.startsWith('chrome://')) {
        const q = new URLSearchParams({ add: '1', url: tab.url, title: tab.title ?? '' });
        openNewTab('?' + q.toString());
      }
    });
  }, [openNewTab]);

  useEffect(() => {
    let cancelled = false;
    setUiStateReady(false);
    (async () => {
      const cached = await readPopupUiState(userId);
      if (cancelled) return;
      if (cached?.activeTab) {
        setActiveTab((prev) => (prev === 'authenticator' ? cached.activeTab! : prev));
      }
      if (typeof cached?.searchOpen === 'boolean') {
        setSearchOpen((prev) => (prev ? prev : cached.searchOpen!));
      }
      if (typeof cached?.searchQuery === 'string') {
        setSearchQuery((prev) => (prev === '' ? cached.searchQuery! : prev));
      }
      if (typeof cached?.showSettings === 'boolean') {
        setShowSettings((prev) => (prev ? prev : cached.showSettings!));
      }
      setUiStateReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!uiStateReady) return;
    writePopupUiState(userId, { activeTab, showSettings, searchOpen, searchQuery });
  }, [uiStateReady, userId, activeTab, showSettings, searchOpen, searchQuery]);

  if (authLoading) {
    const t = getT(settings.locale);
    return (
      <div
        className={`w-full h-full flex items-center justify-center ${
          settings.theme === 'light' ? 'bg-white' : 'bg-[#151b28]'
        }`}
      >
        <Toast message={t.loadingAuth} type="info" open={true} onClose={() => {}} />
      </div>
    );
  }

  const isLight = settings.theme === 'light';

  return (
    <div
      className={`w-[360px] h-[500px] rounded-xl shadow-2xl border overflow-hidden flex flex-col font-display ${
        isLight ? 'bg-white border-slate-200' : 'bg-[#151b28] border-white/5'
      }`}
    >
      <header
        className={`flex items-center justify-between px-4 py-3 backdrop-blur-sm border-b z-20 shrink-0 ${
          isLight ? 'bg-white/90 border-slate-200' : 'bg-[#151b28]/95 border-white/5'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[#256af4] rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
            <span className="material-symbols-outlined text-white text-[18px]">hub</span>
          </div>
          <h1
            className={`text-base font-bold tracking-tight ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}
          >
            LinkHub
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setShowSettings(false);
              setActiveTab('bookmarks');
              setSearchOpen((prev) => {
                const next = !prev;
                if (!next) setSearchQuery('');
                return next;
              });
            }}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
              isLight
                ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            aria-label={t.loadingSearch}
          >
            <span className="material-symbols-outlined text-[20px]">search</span>
          </button>
        </div>
      </header>

      <nav
        className={`flex items-center border-b z-10 shrink-0 ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#151b28] border-white/5'
        }`}
      >
        {(
          [
            { id: 'authenticator' as TabId, icon: 'lock', label: 'Authenticator' },
            { id: 'bookmarks' as TabId, icon: 'bookmarks', label: 'Bookmarks' },
            { id: 'settings' as TabId, icon: 'settings', label: t.settings },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setShowSettings(false);
              setSearchOpen(false);
              setSearchQuery('');
              setActiveTab(tab.id);
            }}
            className={`flex-1 py-2.5 flex flex-col items-center justify-center gap-0.5 transition-colors group relative ${
              activeTab === tab.id
                ? isLight
                  ? 'text-[#256af4] bg-slate-100/80'
                  : 'text-[#256af4] bg-white/[0.02]'
                : isLight
                  ? 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] transition-transform ${
                activeTab === tab.id ? 'material-symbols-filled' : 'group-hover:-translate-y-0.5'
              }`}
            >
              {tab.icon}
            </span>
            <span className="text-[10px] font-medium tracking-wide">{tab.label}</span>
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#256af4] shadow-[0_-2px_6px_rgba(37,106,244,0.4)]" />
            )}
          </button>
        ))}
      </nav>

      {showSettings ? (
        <main className="flex-1 overflow-y-auto px-3 pt-3 pb-4 min-h-0">
          <PopupSettingsColumn />
        </main>
      ) : (
        <main
          className={`flex-1 min-h-0 relative ${
            activeTab === 'authenticator' ? 'overflow-hidden' : 'overflow-y-auto px-2 pt-2 pb-20'
          }`}
        >
          {activeTab === 'authenticator' && (
            <PopupAuthenticatorTab userId={userId} openNewTab={openNewTab} t={t} />
          )}
          {activeTab === 'bookmarks' && (
            <PopupBookmarksTab
              userId={userId}
              openNewTab={openNewTab}
              addCurrentPage={addCurrentPage}
              t={t}
              searchOpen={searchOpen}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />
          )}
          {activeTab === 'settings' && <PopupSettingsColumn />}
        </main>
      )}
      <footer
        className={`shrink-0 px-3 py-2 text-[10px] border-t flex items-center justify-between ${
          isLight ? 'text-slate-400 border-slate-200' : 'text-[#64748b] border-white/5'
        }`}
      >
        <span className="uppercase tracking-wider">LinkHub</span>
        <span className="font-mono">{appVersion ? `v${appVersion}` : ''}</span>
      </footer>
    </div>
  );
}

function PopupBookmarksTab({
  userId,
  openNewTab,
  addCurrentPage,
  t,
  searchOpen,
  searchQuery,
  setSearchQuery,
}: {
  userId: string | undefined;
  openNewTab: (q?: string) => void;
  addCurrentPage: () => void;
  t: ReturnType<typeof getT>;
  searchOpen: boolean;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
}) {
  const { boards, loading, hasLoaded } = useBookmarks(userId, { cachePolicy: 'cache-first' });
  const [selectedBoardId, setSelectedBoardId] = React.useState<string | null>(null);
  const effectiveBoardId = selectedBoardId ?? boards[0]?.id ?? null;
  const { categories, loading: catLoading } = useCategories(effectiveBoardId, { cachePolicy: 'cache-first' });
  const [cachedSearchResults, setCachedSearchResults] = React.useState<PopupSearchResult[] | null>(null);
  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Đọc nhanh board đã mở lần gần nhất để load cache sớm hơn.
  React.useEffect(() => {
    if (!userId) {
      setSelectedBoardId(null);
      return;
    }
    let cancelled = false;
    const applyStored = (stored?: string) => {
      if (!stored || cancelled) return;
      setSelectedBoardId((prev) => (prev ?? stored));
    };
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get(['lastSelectedBoardId'], (result) => {
          applyStored(result.lastSelectedBoardId as string | undefined);
        });
      } else if (typeof window !== 'undefined') {
        applyStored(window.localStorage.getItem('lastSelectedBoardId') ?? undefined);
      }
    } catch {
      // ignore cache read errors
    }
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Sau khi có danh sách boards, đảm bảo selectedBoardId hợp lệ.
  React.useEffect(() => {
    if (!userId || boards.length === 0) return;
    if (selectedBoardId && boards.some((b) => b.id === selectedBoardId)) return;
    setSelectedBoardId(boards[0]?.id ?? null);
  }, [userId, boards, selectedBoardId]);

  React.useEffect(() => {
    let cancelled = false;
    if (!userId || !searchOpen || !normalizedQuery) {
      setCachedSearchResults(null);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      const cached = await readPopupSearchCache(userId, normalizedQuery);
      if (cancelled) return;
      setCachedSearchResults(cached?.results ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, searchOpen, normalizedQuery]);

  const allBookmarks = React.useMemo(
    () =>
      categories.flatMap((cat) =>
        (cat.bookmarks ?? []).map((b) => ({
          ...b,
          categoryName: cat.name ?? '',
        }))
      ),
    [categories]
  );

  const filteredBookmarks = React.useMemo(() => {
    if (!normalizedQuery) return allBookmarks;
    return allBookmarks.filter((b) => {
      const title = (b.title ?? '').toLowerCase();
      const url = (b.url ?? '').toLowerCase();
      const host = getHostnameCached(b.url ?? '');
      return (
        title.includes(normalizedQuery) ||
        url.includes(normalizedQuery) ||
        host.includes(normalizedQuery)
      );
    });
  }, [allBookmarks, normalizedQuery]);

  const searchResults = React.useMemo<PopupSearchResult[]>(
    () =>
      filteredBookmarks.map((b) => ({
        id: b.id,
        title: b.title ?? '',
        url: b.url,
        categoryName: b.categoryName ?? '',
      })),
    [filteredBookmarks]
  );

  React.useEffect(() => {
    if (!userId || !searchOpen || !normalizedQuery) return;
    if (loading || catLoading || !hasLoaded) return;
    writePopupSearchCache(userId, normalizedQuery, searchResults);
  }, [userId, searchOpen, normalizedQuery, loading, catLoading, hasLoaded, searchResults]);

  if (!userId) {
    return (
      <div className="py-6 px-3 text-center">
        <p className="text-[#90a4cb] text-sm mb-4">{t.loginToSeeBookmarks}</p>
        <button
          type="button"
          onClick={() => openNewTab()}
          className="py-2 px-4 rounded-lg bg-[#256af4] text-white text-sm font-medium hover:bg-blue-600"
        >
          {t.openLinkHub}
        </button>
      </div>
    );
  }

  const isLoading = loading || catLoading || !hasLoaded;
  const canUseCachedSearch = searchOpen && !!normalizedQuery && cachedSearchResults !== null;
  const resultsToRender = searchOpen
    ? isLoading && canUseCachedSearch
      ? cachedSearchResults ?? []
      : searchResults
    : [];

  return (
    <div className="space-y-2">
      {!searchOpen && (
        <div className="flex gap-2 px-1 pb-2">
          <button
            type="button"
            onClick={() => openNewTab()}
            className="flex-1 py-2 px-3 rounded-lg bg-[#256af4] text-white text-xs font-medium hover:bg-blue-600 shadow-[0_0_20px_-5px_rgba(37,106,244,0.5)]"
          >
            {t.openBookmarksPage}
          </button>
          <button
            type="button"
            onClick={addCurrentPage}
            className="flex-1 py-2 px-3 rounded-lg border border-white/10 text-[#90a4cb] text-xs font-medium hover:bg-white/5 hover:text-white"
          >
            {t.addThisPage}
          </button>
        </div>
      )}

      {searchOpen && (
        <div className="px-1 pb-2">
          <div className="flex items-center gap-2 bg-[#0f172a] border border-white/10 rounded-lg px-2 py-1.5">
            <span className="material-symbols-outlined text-[18px] text-[#64748b]">search</span>
            <input
              type="text"
              autoFocus
              placeholder={t.moveBookmarkSearchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-xs text-white placeholder:text-[#64748b] outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-[#64748b] hover:text-slate-200 text-[16px]"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

      {isLoading && !canUseCachedSearch ? (
        <p className="text-[#90a4cb] text-sm py-4">{t.popupLoading}</p>
      ) : searchOpen ? (
        <div className="space-y-1.5 px-1 pb-2">
          {resultsToRender.length === 0 ? (
            <p className="text-[#64748b] text-xs py-3 text-center">{t.moveBookmarkNoResults}</p>
          ) : (
            resultsToRender.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  chrome.tabs.create({ url: b.url });
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#1e2532] transition-colors border border-transparent hover:border-white/5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-white font-semibold text-sm truncate block">
                    {b.title || 'Untitled'}
                  </span>
                  <span className="text-[#90a4cb] text-[11px] truncate block">
                    {getHostnameOrUrl(b.url)}
                  </span>
                </div>
                <span className="text-[10px] text-[#64748b] uppercase tracking-wide truncate max-w-[80px]">
                  {b.categoryName || 'Category'}
                </span>
              </button>
            ))
          )}
        </div>
      ) : categories.length === 0 ? (
        <p className="text-[#90a4cb] text-sm py-4">{t.popupNoCategories}</p>
      ) : (
        <div className="space-y-4">
          {categories.map((cat) => (
            <section key={cat.id} className="space-y-1">
              <div className="flex items-center gap-2 px-2 py-1.5 sticky top-0 bg-[#151b28]/95 backdrop-blur-sm z-10">
                <span className="material-symbols-outlined text-[16px] text-[#256af4]">folder</span>
                <h3 className="text-[#90a4cb] text-xs font-semibold uppercase tracking-wider truncate">
                  {cat.name || 'Unnamed'}
                </h3>
              </div>
              {(cat.bookmarks ?? []).length === 0 ? (
                <p className="text-[#64748b] text-[11px] px-3 py-1">{t.emptyState}</p>
              ) : (
                <div className="space-y-0.5">
                  {(cat.bookmarks ?? []).map((b) => (
                    <a
                      key={b.id}
                      href={b.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#1e2532] transition-colors border border-transparent hover:border-white/5 group"
                      onClick={(e) => {
                        e.preventDefault();
                        chrome.tabs.create({ url: b.url });
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-white font-semibold text-sm truncate block">
                          {b.title || 'Untitled'}
                        </span>
                        <span className="text-[#90a4cb] text-[11px] truncate block">
                          {getHostnameOrUrl(b.url)}
                        </span>
                      </div>
                      <span className="material-symbols-outlined text-[18px] text-gray-500 group-hover:text-[#256af4]">
                        open_in_new
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function PopupSettingsColumn() {
  const s = useSettings();
  const t = getT(s.locale);

  const toggleBtn = (active: boolean) =>
    active
      ? 'bg-[#256af4] text-white shadow-[0_0_12px_rgba(37,106,244,0.6)]'
      : 'bg-white/5 text-[#cbd5f5] hover:bg-white/10';

  return (
    <div className="space-y-3 text-xs text-white">
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">
          {t.language}
        </p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => s.setLocale('vi')}
            className={`flex-1 py-1.5 rounded-lg font-medium ${toggleBtn(s.locale === 'vi')}`}
          >
            {t.vietnamese}
          </button>
          <button
            type="button"
            onClick={() => s.setLocale('en')}
            className={`flex-1 py-1.5 rounded-lg font-medium ${toggleBtn(s.locale === 'en')}`}
          >
            {t.english}
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">
          {t.categoryColumns}
        </p>
        <div className="flex gap-1.5 flex-wrap">
          {([2, 3, 4, 5, 6] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => s.setCategoryColumns(n)}
              className={`w-8 h-8 rounded-lg text-xs font-medium ${toggleBtn(s.categoryColumns === n)}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">
          {t.categorySortOrder}
        </p>
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => s.setCategorySortOrder('created_asc')}
              className={`flex-1 min-w-[120px] py-1.5 px-2 rounded-lg text-[11px] font-medium ${toggleBtn(
                s.categorySortOrder === 'created_asc'
              )}`}
            >
              {t.categorySortCreatedAsc}
            </button>
            <button
              type="button"
              onClick={() => s.setCategorySortOrder('created_desc')}
              className={`flex-1 min-w-[120px] py-1.5 px-2 rounded-lg text-[11px] font-medium ${toggleBtn(
                s.categorySortOrder === 'created_desc'
              )}`}
            >
              {t.categorySortCreatedDesc}
            </button>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => s.setCategorySortOrder('name_asc')}
              className={`flex-1 min-w-[120px] py-1.5 px-2 rounded-lg text-[11px] font-medium ${toggleBtn(
                s.categorySortOrder === 'name_asc'
              )}`}
            >
              {t.categorySortNameAsc}
            </button>
            <button
              type="button"
              onClick={() => s.setCategorySortOrder('name_desc')}
              className={`flex-1 min-w-[120px] py-1.5 px-2 rounded-lg text-[11px] font-medium ${toggleBtn(
                s.categorySortOrder === 'name_desc'
              )}`}
            >
              {t.categorySortNameDesc}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">
          {t.categoryCardHeight}
        </p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => s.setCategoryCardHeight('auto')}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-[11px] font-medium ${toggleBtn(
              s.categoryCardHeight === 'auto'
            )}`}
          >
            <span className="material-symbols-outlined text-[16px]">vertical_align_top</span>
            {t.byContent}
          </button>
          <button
            type="button"
            onClick={() => s.setCategoryCardHeight('equal')}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-[11px] font-medium ${toggleBtn(
              s.categoryCardHeight === 'equal'
            )}`}
          >
            <span className="material-symbols-outlined text-[16px]">height</span>
            {t.equalHeight}
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">
            {t.categoryColorFillContent}
          </span>
          <button
            type="button"
            onClick={() => s.setCategoryColorFillContent(!s.categoryColorFillContent)}
            className={`min-w-[60px] px-3 py-1 rounded-full text-[11px] font-medium transition ${
              s.categoryColorFillContent
                ? 'bg-[#256af4]/20 text-[#bfdbfe] border border-[#256af4]/40'
                : 'bg-white/10 text-[#cbd5f5] hover:bg-white/15 border border-white/10'
            }`}
          >
            {s.categoryColorFillContent ? t.on : t.off}
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">
          {t.openLink}
        </p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => s.setOpenLinkIn('new_tab')}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-[11px] font-medium ${toggleBtn(
              s.openLinkIn === 'new_tab'
            )}`}
          >
            <span className="material-symbols-outlined text-[16px]">tab</span>
            {t.newTab}
          </button>
          <button
            type="button"
            onClick={() => s.setOpenLinkIn('current_tab')}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-[11px] font-medium ${toggleBtn(
              s.openLinkIn === 'current_tab'
            )}`}
          >
            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            {t.currentTab}
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">
          {t.spotlightShortcut}
        </p>
        <SpotlightShortcutSetting compact />
      </div>

      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">
          {t.dragDrop}
        </p>
        <div className="space-y-1.5">
          {(
            [
              { key: 'board' as const, label: t.moveBoard },
              { key: 'category' as const, label: t.moveCategory },
              { key: 'bookmark' as const, label: t.moveBookmark },
            ] as const
          ).map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between py-0.5">
              <span className="text-[11px] text-[#cbd5f5]">{label}</span>
              <button
                type="button"
                onClick={() => s.setDragDrop({ [key]: !s.dragDrop[key] })}
                className={`min-w-[44px] px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                  s.dragDrop[key] ? 'bg-[#256af4]/20 text-[#bfdbfe]' : 'bg-white/10 text-[#cbd5f5] hover:bg-white/15'
                }`}
              >
                {s.dragDrop[key] ? t.on : t.off}
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">
          {t.startPage}
        </p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => s.setStartOnLanding(true)}
            className={`flex-1 py-1.5 rounded-lg font-medium ${toggleBtn(s.startOnLanding)}`}
          >
            {t.startPageLanding}
          </button>
          <button
            type="button"
            onClick={() => s.setStartOnLanding(false)}
            className={`flex-1 py-1.5 rounded-lg font-medium ${toggleBtn(!s.startOnLanding)}`}
          >
            {t.startPageBookmarks}
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b]">
          {t.displayMode}
        </p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => s.setTheme('dark')}
            className={`flex-1 py-1.5 rounded-lg font-medium flex items-center justify-center gap-1 ${toggleBtn(
              s.theme === 'dark'
            )}`}
          >
            <span className="material-symbols-outlined text-[16px]">dark_mode</span>
            {t.dark}
          </button>
          <button
            type="button"
            onClick={() => s.setTheme('light')}
            className={`flex-1 py-1.5 rounded-lg font-medium flex items-center justify-center gap-1 ${toggleBtn(
              s.theme === 'light'
            )}`}
          >
            <span className="material-symbols-outlined text-[16px]">light_mode</span>
            {t.light}
          </button>
        </div>
      </div>
    </div>
  );
}

function PopupAuthenticatorTab({
  userId,
  openNewTab,
  t,
}: {
  userId: string | undefined;
  openNewTab: (q?: string) => void;
  t: ReturnType<typeof getT>;
}) {
  const { theme } = useSettings();
  const isLight = theme === 'light';
  const { entries, loading, hasLoaded } = useAuthenticatorEntries(userId, { cachePolicy: 'cache-first' });
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!userId) {
    return (
      <div className="h-full overflow-y-auto py-6 px-3 text-center">
        <p className="text-[#90a4cb] text-sm mb-4">{t.loginToUseAuthenticator}</p>
        <button
          type="button"
          onClick={() => openNewTab()}
          className="py-2 px-4 rounded-lg bg-[#256af4] text-white text-sm font-medium hover:bg-blue-600"
        >
          Đăng nhập
        </button>
      </div>
    );
  }

  if (loading || !hasLoaded) {
    return <p className="text-[#90a4cb] text-sm py-6 px-3">{t.popupLoading}</p>;
  }

  if (entries.length === 0) {
    return (
      <div className="h-full overflow-y-auto py-6 px-3 text-center">
        <p className="text-[#90a4cb] text-sm mb-4">{t.noAccountsYet}</p>
        <button
          type="button"
          onClick={() => openNewTab('?open=authenticator')}
          className="py-2.5 px-5 rounded-lg bg-[#256af4] text-white text-sm font-medium hover:bg-blue-600 shadow-[0_0_20px_-5px_rgba(37,106,244,0.5)]"
        >
          {t.addAccount}
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0">
      <div className="h-full overflow-y-auto px-2 pt-2 pb-20">
        <div className="space-y-1">
          {entries.slice(0, 20).map((entry) => (
            <PopupAuthenticatorRow key={entry.id} entry={entry} t={t} />
          ))}
        </div>
      </div>
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t to-transparent z-10 ${
          isLight ? 'from-white' : 'from-[#151b28]'
        }`}
        aria-hidden
      />
      <button
        type="button"
        onClick={() => openNewTab('?open=authenticator')}
        className="absolute bottom-4 right-4 z-20 w-12 h-12 bg-[#256af4] rounded-full shadow-[0_0_20px_-5px_rgba(37,106,244,0.5)] flex items-center justify-center text-white hover:bg-blue-600 active:scale-95 transition-all group"
        aria-label={t.addAccount}
      >
        <span className="material-symbols-outlined text-[24px] group-hover:rotate-90 transition-transform duration-300">
          add
        </span>
      </button>
    </div>
  );
}

function PopupAuthenticatorRow({
  entry,
  t,
}: {
  entry: AuthenticatorEntry;
  t: ReturnType<typeof getT>;
}) {
  const [code, setCode] = useState('------');
  const [copied, setCopied] = useState(false);
  const remaining = getTimeRemaining(TOTP_STEP);
  const progressPct = (remaining / TOTP_STEP) * 100;
  const isLow = remaining <= 5;
  const radius = 8.5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPct / 100) * circumference;

  useEffect(() => {
    let cancelled = false;
    generateTOTP(entry.secret, TOTP_STEP)
      .then((c) => {
        if (!cancelled) setCode(c);
      })
      .catch(() => {
        if (!cancelled) setCode('------');
      });
    return () => {
      cancelled = true;
    };
  }, [entry.secret, remaining]);

  const handleCopy = () => {
    if (code === '------') return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const displayCode = code !== '------' ? `${code.slice(0, 3)} ${code.slice(3)}` : '------';
  const initial = (entry.issuer || entry.account_name || 'A').charAt(0).toUpperCase();

  return (
    <div
      role="button"
      tabIndex={0}
      className="group relative flex items-center justify-between p-3 rounded-xl hover:bg-[#1e2532] transition-colors cursor-pointer border border-transparent hover:border-white/5"
      onClick={handleCopy}
      onKeyDown={(e) => e.key === 'Enter' && handleCopy()}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0 w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden shadow-sm">
          <span className="text-white font-bold text-base">{initial}</span>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-white font-semibold text-sm truncate">{entry.issuer || 'Account'}</span>
          <span className="text-[#90a4cb] text-[11px] truncate">{entry.account_name || ''}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span
          className={`font-mono font-medium text-base tracking-wider transition-colors ${
            isLow ? 'text-red-400 animate-pulse' : 'text-white group-hover:text-[#256af4]'
          }`}
        >
          {displayCode}
        </span>
        <div className="relative w-[22px] h-[22px] flex items-center justify-center" title={`${remaining}s`}>
          <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 22 22">
            <circle cx="11" cy="11" fill="transparent" r={radius} stroke="#2d3748" strokeWidth="2" />
            <circle
              className="transition-all duration-1000"
              cx="11"
              cy="11"
              fill="transparent"
              r={radius}
              stroke={isLow ? '#ef4444' : 'currentColor'}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              strokeWidth="2"
              style={{ color: '#256af4' }}
            />
          </svg>
        </div>
      </div>
      {copied && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1e2532]/95 rounded-xl pointer-events-none border border-white/10">
          <span className="text-[#256af4] font-medium text-xs flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">content_copy</span>
            {t.copied}
          </span>
        </div>
      )}
    </div>
  );
}
