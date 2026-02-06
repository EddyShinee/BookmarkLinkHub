import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../contexts/SettingsContext';
import { useBookmarks } from '../hooks/useBookmarks';
import { useCategories } from '../hooks/useCategories';
import { useAuthenticatorEntries, type AuthenticatorEntry } from '../hooks/useAuthenticatorEntries';
import { getT } from '../lib/i18n';
import Toast from '../components/Toast';
import { generateTOTP, getTimeRemaining } from '../lib/totp';
import type { Bookmark } from '../hooks/useBookmarks';

const NEWTAB_PATH = 'src/newtab/index.html';
const TOTP_STEP = 30;

type TabId = 'authenticator' | 'bookmarks' | 'it-tools';

export default function PopupApp() {
  const { session, loading: authLoading } = useAuth();
  const settings = useSettings();
  const t = getT(settings.locale);
  const userId = session?.user?.id;

  const [activeTab, setActiveTab] = useState<TabId>('authenticator');

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

  const openOptions = useCallback(() => {
    chrome.runtime.openOptionsPage?.();
  }, []);

  if (authLoading) {
    const t = getT(settings.locale);
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#151b28]">
        <Toast message={t.loadingAuth} type="info" open={true} onClose={() => {}} />
      </div>
    );
  }

  return (
    <div className="w-[360px] h-[500px] bg-[#151b28] rounded-xl shadow-2xl border border-white/5 overflow-hidden flex flex-col font-display">
      <header className="flex items-center justify-between px-4 py-3 bg-[#151b28]/95 backdrop-blur-sm border-b border-white/5 z-20 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[#256af4] rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
            <span className="material-symbols-outlined text-white text-[18px]">hub</span>
          </div>
          <h1 className="text-white text-base font-bold tracking-tight">LinkHub</h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => openNewTab()}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-all"
            aria-label={t.settings}
          >
            <span className="material-symbols-outlined text-[20px]">search</span>
          </button>
          <button
            type="button"
            onClick={openOptions}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-all"
            aria-label={t.settings}
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </button>
        </div>
      </header>

      <nav className="flex items-center bg-[#151b28] border-b border-white/5 z-10 shrink-0">
        {(
          [
            { id: 'authenticator' as TabId, icon: 'lock', label: 'Authenticator' },
            { id: 'bookmarks' as TabId, icon: 'bookmarks', label: 'Bookmarks' },
            { id: 'it-tools' as TabId, icon: 'terminal', label: 'IT Tools' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 flex flex-col items-center justify-center gap-0.5 transition-colors group relative ${
              activeTab === tab.id
                ? 'text-[#256af4] bg-white/[0.02]'
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

      <main className="flex-1 overflow-y-auto px-2 pt-2 pb-20 relative min-h-0">
        {activeTab === 'authenticator' && (
          <PopupAuthenticatorTab userId={userId} openNewTab={openNewTab} t={t} />
        )}
        {activeTab === 'bookmarks' && (
          <PopupBookmarksTab
            userId={userId}
            openNewTab={openNewTab}
            addCurrentPage={addCurrentPage}
            t={t}
          />
        )}
        {activeTab === 'it-tools' && (
          <PopupITToolsTab openNewTab={openNewTab} t={t} />
        )}
      </main>
    </div>
  );
}

function PopupBookmarksTab({
  userId,
  openNewTab,
  addCurrentPage,
  t,
}: {
  userId: string | undefined;
  openNewTab: (q?: string) => void;
  addCurrentPage: () => void;
  t: ReturnType<typeof getT>;
}) {
  const { boards, loading } = useBookmarks(userId);
  const [selectedBoardId, setSelectedBoardId] = React.useState<string | null>(null);
  const effectiveBoardId = selectedBoardId ?? boards[0]?.id ?? null;
  const { categories, loading: catLoading } = useCategories(effectiveBoardId);

  // Lấy board mở gần nhất từ chrome.storage.local (cùng key với Dashboard)
  React.useEffect(() => {
    if (!userId) return;
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get(['lastSelectedBoardId'], (result) => {
          const stored = result.lastSelectedBoardId as string | undefined;
          if (stored && boards.some((b) => b.id === stored)) {
            setSelectedBoardId(stored);
          } else if (boards[0]?.id) {
            setSelectedBoardId(boards[0].id);
          }
        });
      } else if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem('lastSelectedBoardId');
        if (stored && boards.some((b) => b.id === stored)) {
          setSelectedBoardId(stored);
        } else if (boards[0]?.id) {
          setSelectedBoardId(boards[0].id);
        }
      }
    } catch {
      if (!selectedBoardId && boards[0]?.id) setSelectedBoardId(boards[0].id);
    }
  }, [userId, boards, selectedBoardId]);

  if (!userId) {
    return (
      <div className="py-6 px-3 text-center">
        <p className="text-[#90a4cb] text-sm mb-4">Đăng nhập để xem bookmark.</p>
        <button
          type="button"
          onClick={() => openNewTab()}
          className="py-2 px-4 rounded-lg bg-[#256af4] text-white text-sm font-medium hover:bg-blue-600"
        >
          Mở LinkHub
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 px-1 pb-2">
        <button
          type="button"
          onClick={() => openNewTab()}
          className="flex-1 py-2 px-3 rounded-lg bg-[#256af4] text-white text-xs font-medium hover:bg-blue-600 shadow-[0_0_20px_-5px_rgba(37,106,244,0.5)]"
        >
          Mở trang Dấu trang
        </button>
        <button
          type="button"
          onClick={addCurrentPage}
          className="flex-1 py-2 px-3 rounded-lg border border-white/10 text-[#90a4cb] text-xs font-medium hover:bg-white/5 hover:text-white"
        >
          Thêm trang này
        </button>
      </div>
      {loading || catLoading ? (
        <p className="text-[#90a4cb] text-sm py-4">Đang tải...</p>
      ) : categories.length === 0 ? (
        <p className="text-[#90a4cb] text-sm py-4">Chưa có category. Mở LinkHub để thêm.</p>
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
                <p className="text-[#64748b] text-[11px] px-3 py-1">Trống</p>
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
                        <span className="text-white font-semibold text-sm truncate block">{b.title || 'Untitled'}</span>
                        <span className="text-[#90a4cb] text-[11px] truncate block">{new URL(b.url).hostname}</span>
                      </div>
                      <span className="material-symbols-outlined text-[18px] text-gray-500 group-hover:text-[#256af4]">open_in_new</span>
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

function PopupITToolsTab({
  openNewTab,
  t,
}: {
  openNewTab: (q?: string) => void;
  t: ReturnType<typeof getT>;
}) {
  return (
    <div className="py-6 px-3 text-center">
      <p className="text-[#90a4cb] text-sm mb-4">Mở trang LinkHub để sử dụng IT Tools (JSON, Base64, Hash, ...).</p>
      <button
        type="button"
        onClick={() => openNewTab('?open=it-tools')}
        className="py-2.5 px-5 rounded-lg bg-[#256af4] text-white text-sm font-medium hover:bg-blue-600 shadow-[0_0_20px_-5px_rgba(37,106,244,0.5)]"
      >
        Mở IT Tools
      </button>
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
  const { entries, loading } = useAuthenticatorEntries(userId);
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!userId) {
    return (
      <div className="py-6 px-3 text-center">
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

  if (loading) {
    return <p className="text-[#90a4cb] text-sm py-6 px-3">Đang tải...</p>;
  }

  if (entries.length === 0) {
    return (
      <div className="py-6 px-3 text-center">
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
    <>
      <div className="space-y-1 pb-2">
        {entries.slice(0, 20).map((entry) => (
          <PopupAuthenticatorRow key={entry.id} entry={entry} t={t} />
        ))}
      </div>
      <div className="absolute bottom-5 right-5 z-20">
        <button
          type="button"
          onClick={() => openNewTab('?open=authenticator')}
          className="w-12 h-12 bg-[#256af4] rounded-full shadow-[0_0_20px_-5px_rgba(37,106,244,0.5)] flex items-center justify-center text-white hover:bg-blue-600 active:scale-95 transition-all group"
          aria-label={t.addAccount}
        >
          <span className="material-symbols-outlined text-[24px] group-hover:rotate-90 transition-transform duration-300">add</span>
        </button>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#151b28] to-transparent pointer-events-none z-10" aria-hidden />
    </>
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
