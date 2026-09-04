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

export type SpotlightVariant = 'dashboard' | 'overlay' | 'window';
export type SpotlightShortcutHint = 'dashboard' | 'global' | 'double-shift' | 'none';
export type SpotlightStatus = 'ready' | 'loading' | 'signed-out';

interface SearchSpotlightModalProps {
  open: boolean;
  items: SpotlightItem[];
  onClose: () => void;
  /** `newTab: true` → luôn mở tab mới (Ctrl/⌘+Enter). */
  onOpen: (url: string, options?: { newTab?: boolean }) => void;
  variant?: SpotlightVariant;
  shortcutHint?: SpotlightShortcutHint;
  status?: SpotlightStatus;
  onOpenLinkHub?: () => void;
}

function isMacPlatform(): boolean {
  return typeof navigator !== 'undefined' && navigator.platform?.toUpperCase().includes('MAC');
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="text-accent flex-shrink-0">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20L16.5 16.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ShortcutHint({
  kind,
  compact,
  isLight,
}: {
  kind: SpotlightShortcutHint;
  compact: boolean;
  isLight: boolean;
}) {
  if (kind === 'none') return null;
  const mac = isMacPlatform();
  const keys =
    kind === 'double-shift'
      ? ['⇧', '⇧']
      : kind === 'global'
        ? mac
          ? ['⌘', '⇧', 'K']
          : ['Ctrl', 'Shift', 'K']
        : mac
          ? ['⌘', 'K']
          : ['Ctrl', 'K'];
  return (
    <span
      className={`${compact ? 'hidden md:inline-flex' : 'inline-flex'} items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] text-text-muted ${
        isLight ? 'border-black/15' : 'border-white/15'
      }`}
    >
      {keys.map((key, i) => (
        <React.Fragment key={`${key}-${i}`}>
          {i > 0 && <span>+</span>}
          <span className="text-[10px]">{key}</span>
        </React.Fragment>
      ))}
    </span>
  );
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
  variant = 'dashboard',
  shortcutHint = 'dashboard',
  status = 'ready',
  onOpenLinkHub,
}: SearchSpotlightModalProps) {
  const settings = useSettings();
  const t = getT(settings.locale);
  const isLight = settings.theme === 'light';
  const uid = useId().replace(/:/g, '');
  const listboxId = `${uid}-spotlight-lb`;
  const optionPrefix = `${uid}-spotlight-opt`;
  const isWindow = variant === 'window';

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
  }, [open]);

  // Focus sau khi mở (và lại khi status sẵn sàng nếu chưa focus được).
  // Overlay/shadow DOM và phím tắt đôi khi cần vài lần thử mới nhận focus.
  useEffect(() => {
    if (!open || status === 'signed-out') return;

    let cancelled = false;
    let tries = 0;
    const maxTries = 12;
    const timers: number[] = [];

    const isInputFocused = (el: HTMLInputElement) => {
      const root = el.getRootNode() as Document | ShadowRoot;
      return (
        document.activeElement === el ||
        ('activeElement' in root && root.activeElement === el)
      );
    };

    const tryFocus = () => {
      if (cancelled) return;
      const el = inputRef.current;
      if (el && !el.disabled) {
        if (isInputFocused(el)) return;
        el.focus({ preventScroll: true });
        if (isInputFocused(el)) {
          if (!el.value) el.select();
          return;
        }
      }
      tries += 1;
      if (tries < maxTries) {
        timers.push(window.setTimeout(tryFocus, tries < 3 ? 16 : 50));
      }
    };

    timers.push(window.setTimeout(tryFocus, 0));
    requestAnimationFrame(() => {
      requestAnimationFrame(tryFocus);
    });

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [open, status]);

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
    const el = listRef.current?.querySelector(`[data-spotlight-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, sliced]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

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
  const isRecentMode = !hasText && !hasFilters && status === 'ready';
  const total = displayRows.length;
  const shown = sliced.length;
  const newTabHint = isMacPlatform() ? t.searchOpenNewTabHintMac : t.searchOpenNewTabHint;
  const showList = status === 'ready';

  return (
    <div
      className={
        isWindow
          ? 'fixed inset-0 z-[240] flex items-stretch justify-center'
          : 'fixed inset-0 z-[240] flex items-start justify-center pt-[12vh] px-4 backdrop-blur-sm'
      }
      style={isWindow ? undefined : { backgroundColor: 'var(--backdrop-strong)' }}
      onClick={isWindow ? undefined : onClose}
    >
      <div
        className={`spotlight-panel-in overflow-hidden flex flex-col ${
          isWindow
            ? 'w-full h-full max-h-none rounded-none border-0 shadow-none'
            : `w-full max-w-2xl rounded-2xl border shadow-2xl max-h-[85vh] ${
                isLight ? 'border-black/10 shadow-black/15' : 'border-white/10'
              }`
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
          <SearchIcon />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={inputKeyDown}
            placeholder={t.searchPlaceholder}
            autoComplete="off"
            spellCheck={false}
            autoFocus={open && status !== 'signed-out'}
            disabled={status === 'signed-out'}
            aria-controls={listboxId}
            aria-expanded={showList && sliced.length > 0}
            aria-activedescendant={
              showList && sliced.length > 0 ? `${optionPrefix}-${activeIndex}` : undefined
            }
            aria-autocomplete="list"
            className={`flex-1 bg-transparent border-none outline-none text-sm placeholder-text-muted disabled:opacity-60 ${
              isLight ? 'text-slate-900 placeholder:text-slate-500' : 'text-white'
            }`}
          />
          <ShortcutHint kind={shortcutHint} compact={variant === 'dashboard'} isLight={isLight} />
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
            <CloseIcon />
          </button>
        </div>

        {showList && (
          <p className="px-4 pt-2 text-[10px] text-text-muted/90 leading-snug flex-shrink-0">{t.searchFilterHint}</p>
        )}

        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={t.searchAriaLabel}
          className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
            isWindow ? '' : 'max-h-[min(52vh,480px)]'
          }`}
        >
          {status === 'loading' && (
            <p className="px-4 py-4 text-xs text-text-muted" role="status">
              {t.searchLoadingItems}
            </p>
          )}
          {status === 'signed-out' && (
            <div className="px-4 py-8 text-center" role="status">
              <p className={`text-sm font-medium ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {t.searchSignedOutTitle}
              </p>
              <p className="mt-1.5 text-xs text-text-muted leading-relaxed">{t.searchSignedOutBody}</p>
              {onOpenLinkHub && (
                <button
                  type="button"
                  onClick={onOpenLinkHub}
                  className="mt-4 inline-flex items-center justify-center rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  {t.searchSignedOutCta}
                </button>
              )}
            </div>
          )}
          {showList && isRecentMode && sliced.length > 0 && (
            <p
              className={`px-4 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                isLight ? 'text-slate-500' : 'text-text-muted'
              }`}
            >
              {t.searchRecentSection}
            </p>
          )}
          {showList && sliced.length === 0 ? (
            <p className="px-4 py-4 text-xs text-text-muted" role="status">
              {announceEmpty ? t.searchNoResults : t.searchTypeToSearch}
            </p>
          ) : showList ? (
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
          ) : null}
        </div>

        {showList && visibleCount < total && (
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
            {status !== 'ready'
              ? ''
              : total === 0
                ? t.searchResultsCount.replace('{n}', '0')
                : shown < total
                  ? t.searchResultsShowing.replace('{shown}', String(shown)).replace('{total}', String(total))
                  : t.searchResultsCount.replace('{n}', String(total))}
          </p>
        </div>
        {showList && (
          <p className="px-4 pb-2.5 text-[10px] text-text-muted/80">{t.searchAcrossAllBoards}</p>
        )}
      </div>
    </div>
  );
}
