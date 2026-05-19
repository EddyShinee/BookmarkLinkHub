import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { getT } from '../lib/i18n';
import {
  findInsensitiveMatchIndex,
  formatUrlForDisplay,
  normalizeSearchString,
  parseSpotlightQuery,
  scoreBookmarkSearch,
  type BookmarkSearchFields,
} from '../lib/searchBookmarks';

const RECENT_LIMIT = 22;
const PAGE_SIZE = 60;

export interface SpotlightItem {
  id: string;
  title: string;
  url: string;
  boardName?: string;
  categoryName?: string;
  description?: string | null;
  tags?: string[];
  /** ISO — dùng sắp "gần đây" khi không gõ query */
  updatedAt?: string;
}

interface SearchSpotlightModalProps {
  open: boolean;
  items: SpotlightItem[];
  onClose: () => void;
  /** `newTab: true` → luôn mở tab mới (Ctrl/⌘+Enter). */
  onOpen: (url: string, options?: { newTab?: boolean }) => void;
}

function Highlight({ text, needle }: { text: string; needle: string }) {
  const idx = findInsensitiveMatchIndex(text, needle);
  if (idx < 0 || !needle.trim()) return <>{text}</>;
  const end = idx + needle.length;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-accent/40 px-0.5 text-white">{text.slice(idx, end)}</mark>
      {text.slice(end)}
    </>
  );
}

function UrlWithHost({ url, needle }: { url: string; needle: string }) {
  const { host, rest } = formatUrlForDisplay(url);
  if (!host) return <Highlight text={url} needle={needle} />;
  const full = host + rest;
  const idx = findInsensitiveMatchIndex(full, needle);
  if (idx < 0 || !needle.trim()) {
    return (
      <span className="text-[10px] text-text-muted/90 truncate block">
        <span className="font-semibold text-accent/90">{host}</span>
        <span className="text-text-muted/80">{rest}</span>
      </span>
    );
  }
  return (
    <span className="text-[10px] text-text-muted/90 truncate block">
      <Highlight text={full} needle={needle} />
    </span>
  );
}

export default function SearchSpotlightModal({
  open,
  items,
  onClose,
  onOpen,
}: SearchSpotlightModalProps) {
  const settings = useSettings();
  const t = getT(settings.locale);
  const isLight = settings.theme === 'light';
  const uid = useId().replace(/:/g, '');
  const listboxId = `${uid}-spotlight-lb`;
  const optionPrefix = `${uid}-spotlight-opt`;

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const parsed = useMemo(() => parseSpotlightQuery(query), [query]);

  const displayRows = useMemo(() => {
    const hasFilters = !!(parsed.site || parsed.board || parsed.tag);
    const hasText = !!normalizeSearchString(parsed.text);

    if (!hasText && !hasFilters) {
      return [...items]
        .sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))
        .slice(0, RECENT_LIMIT);
    }

    const scored = items
      .map((item) => {
        const fields: BookmarkSearchFields = {
          title: item.title || '',
          url: item.url || '',
          boardName: item.boardName,
          categoryName: item.categoryName,
          description: item.description,
          tags: item.tags,
        };
        const score = scoreBookmarkSearch(fields, parsed);
        return { item, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return String(b.item.updatedAt ?? '').localeCompare(String(a.item.updatedAt ?? ''));
      });

    return scored.map((x) => x.item);
  }, [items, parsed]);

  const sliced = useMemo(() => displayRows.slice(0, visibleCount), [displayRows, visibleCount]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    setVisibleCount(PAGE_SIZE);
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 10);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query]);

  useEffect(() => {
    if (!sliced.length) {
      setActiveIndex(0);
      return;
    }
    if (activeIndex >= sliced.length) {
      setActiveIndex(sliced.length - 1);
    }
  }, [sliced, activeIndex]);

  useEffect(() => {
    if (!sliced.length) return;
    const container = listRef.current;
    if (!container) return;
    const el = document.getElementById(`${optionPrefix}-${activeIndex}`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, sliced, optionPrefix]);

  const highlightNeedle = parsed.text.trim() || query.trim();

  const announceEmpty = useMemo(() => {
    const hasFilters = !!(parsed.site || parsed.board || parsed.tag);
    const hasText = !!normalizeSearchString(parsed.text);
    return hasText || hasFilters;
  }, [parsed]);

  const handleOpenActive = useCallback(
    (newTab: boolean) => {
      const item = sliced[activeIndex];
      if (!item) return;
      onOpen(item.url, { newTab });
    },
    [sliced, activeIndex, onOpen]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleOpenActive(true);
      return;
    }

    if (!sliced.length) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % sliced.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 < 0 ? sliced.length - 1 : prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleOpenActive(false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const inputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      closeButtonRef.current?.focus();
      return;
    }
    handleKeyDown(e);
  };

  const closeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      inputRef.current?.focus();
    }
  };

  if (!open) return null;

  const hasFilters = !!(parsed.site || parsed.board || parsed.tag);
  const hasText = !!normalizeSearchString(parsed.text);
  const isRecentMode = !hasText && !hasFilters;
  const total = displayRows.length;
  const shown = sliced.length;
  const newTabHint =
    typeof navigator !== 'undefined' && navigator.platform?.toUpperCase().includes('MAC')
      ? t.searchOpenNewTabHintMac
      : t.searchOpenNewTabHint;

  return (
    <div
      className="fixed inset-0 z-[240] flex items-start justify-center pt-[12vh] px-4 backdrop-blur-sm"
      style={{ backgroundColor: 'var(--backdrop-strong)' }}
      onClick={onClose}
    >
      <div
        className={`spotlight-panel-in w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] ${
          isLight ? 'border-black/10 shadow-black/15' : 'border-white/10'
        }`}
        style={{ backgroundColor: 'var(--surface-modal)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t.searchAriaLabel}
      >
        <div
          className={`px-4 pt-3 pb-2 border-b flex items-center gap-2 flex-shrink-0 ${
            isLight ? 'border-black/10' : 'border-white/10'
          }`}
        >
          <span className="material-symbols-outlined text-[18px] text-accent" aria-hidden>
            search
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={inputKeyDown}
            placeholder={t.searchPlaceholder}
            autoComplete="off"
            spellCheck={false}
            aria-controls={listboxId}
            aria-expanded={sliced.length > 0}
            aria-activedescendant={sliced.length > 0 ? `${optionPrefix}-${activeIndex}` : undefined}
            aria-autocomplete="list"
            className={`flex-1 bg-transparent border-none outline-none text-sm placeholder-text-muted ${
              isLight ? 'text-slate-900 placeholder:text-slate-500' : 'text-white'
            }`}
          />
          <span
            className={`hidden md:inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] text-text-muted ${
              isLight ? 'border-black/15' : 'border-white/15'
            }`}
          >
            <span className="text-[10px]">{navigator.platform?.toUpperCase().includes('MAC') ? '⌘' : 'Ctrl'}</span>
            <span>+</span>
            <span className="text-[10px]">K</span>
          </span>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            onKeyDown={closeKeyDown}
            className={`ml-1 p-1 rounded-lg text-text-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
              isLight ? 'hover:text-slate-900 hover:bg-black/[0.06]' : 'hover:text-white hover:bg-white/10'
            }`}
            aria-label={t.close}
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <p className="px-4 pt-2 text-[10px] text-text-muted/90 leading-snug flex-shrink-0">{t.searchFilterHint}</p>

        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={t.searchAriaLabel}
          className="flex-1 min-h-0 max-h-[min(52vh,480px)] overflow-y-auto overflow-x-hidden py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {isRecentMode && sliced.length > 0 && (
            <p
              className={`px-4 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                isLight ? 'text-slate-500' : 'text-text-muted'
              }`}
            >
              {t.searchRecentSection}
            </p>
          )}
          {sliced.length === 0 ? (
            <p className="px-4 py-4 text-xs text-text-muted" role="status">
              {announceEmpty ? t.searchNoResults : t.searchTypeToSearch}
            </p>
          ) : (
            <ul className="py-1" role="presentation">
              {sliced.map((item, index) => {
                const isActive = index === activeIndex;
                const oid = `${optionPrefix}-${index}`;
                return (
                  <li key={item.id} role="presentation">
                    <button
                      type="button"
                      id={oid}
                      role="option"
                      aria-selected={isActive}
                      data-spotlight-index={index}
                      onClick={() => onOpen(item.url)}
                      onAuxClick={(e) => {
                        if (e.button === 1) {
                          e.preventDefault();
                          onOpen(item.url, { newTab: true });
                        }
                      }}
                      className={`w-full px-4 py-2 text-left flex flex-col gap-0.5 text-xs transition rounded-lg mx-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/45 ${
                        isActive
                          ? isLight
                            ? 'bg-accent/20 text-slate-900 ring-1 ring-inset ring-accent/35 shadow-sm'
                            : 'bg-accent/20 text-white ring-1 ring-inset ring-accent/30'
                          : isLight
                          ? 'bg-transparent text-slate-800 hover:bg-black/[0.05] hover:text-slate-900'
                          : 'bg-transparent text-text-secondary hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span className="font-medium truncate">
                        <Highlight text={item.title || item.url} needle={highlightNeedle} />
                      </span>
                      <span className="text-[11px] text-text-muted truncate">
                        {item.boardName ? `${item.boardName} • ` : ''}
                        {item.categoryName ?? ''}
                      </span>
                      <UrlWithHost url={item.url} needle={highlightNeedle} />
                      {item.tags && item.tags.length > 0 && (
                        <span className="text-[10px] text-text-muted/90 truncate">
                          {(item.tags ?? []).slice(0, 6).map((tag) => (
                            <span
                              key={tag}
                              className={`inline-block mr-1 mb-0.5 rounded px-1.5 py-0.5 text-[9px] ${
                                isLight ? 'bg-black/[0.06] text-slate-600' : 'bg-white/10'
                              }`}
                            >
                              #{tag}
                            </span>
                          ))}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {visibleCount < total && (
          <div className={`px-4 py-2 border-t flex-shrink-0 ${isLight ? 'border-black/[0.06]' : 'border-white/5'}`}>
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className={`w-full py-2 rounded-lg text-xs font-medium border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                isLight
                  ? 'border-black/10 bg-black/[0.04] text-accent hover:bg-black/[0.08]'
                  : 'border-white/15 bg-white/5 text-accent hover:bg-white/10'
              }`}
            >
              {t.searchLoadMore}
            </button>
          </div>
        )}

        <div
          className={`px-4 py-2 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 flex-shrink-0 ${
            isLight ? 'border-black/10' : 'border-white/10'
          }`}
        >
          <p className="text-[10px] text-text-muted">
            ↑↓ {t.searchOr} Enter · {newTabHint} · Esc {t.searchToClose}
          </p>
          <p className="text-[10px] text-text-muted tabular-nums text-right">
            {total === 0
              ? t.searchResultsCount.replace('{n}', '0')
              : shown < total
                ? t.searchResultsShowing.replace('{shown}', String(shown)).replace('{total}', String(total))
                : t.searchResultsCount.replace('{n}', String(total))}
          </p>
        </div>
        <p className="px-4 pb-2.5 text-[10px] text-text-muted/80">{t.searchAcrossAllBoards}</p>
      </div>
    </div>
  );
}
