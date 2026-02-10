import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { getT } from '../lib/i18n';

export interface SpotlightItem {
  id: string;
  title: string;
  url: string;
  boardName?: string;
  categoryName?: string;
}

interface SearchSpotlightModalProps {
  open: boolean;
  items: SpotlightItem[];
  onClose: () => void;
  onOpen: (url: string) => void;
}

export default function SearchSpotlightModal({
  open,
  items,
  onClose,
  onOpen,
}: SearchSpotlightModalProps) {
  const settings = useSettings();
  const t = getT(settings.locale);

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 10);
    return () => window.clearTimeout(id);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;

    const scored = items
      .map((item, originalIndex) => {
        const title = item.title?.toLowerCase() ?? '';
        const url = item.url?.toLowerCase() ?? '';
        const board = item.boardName?.toLowerCase() ?? '';
        const category = item.categoryName?.toLowerCase() ?? '';

        let score = 0;

        // Strongest: title starts with query
        if (title.startsWith(q)) score += 120;

        // Title contains word that starts with query
        const titleWords = title.split(/\s+/);
        if (titleWords.some((w) => w.startsWith(q))) score += 90;

        // Title substring match
        if (score === 0 && title.includes(q)) score += 70;

        // Board / category matches
        if (board.startsWith(q) || category.startsWith(q)) score += 50;
        else if (board.includes(q) || category.includes(q)) score += 35;

        // URL host / path matches
        if (url.startsWith(q)) score += 40;
        else if (url.includes(q)) score += 20;

        // Slight preference for shorter titles when scores tie
        if (score > 0) score += Math.max(0, 20 - title.length * 0.2);

        return { item, score, originalIndex };
      })
      .filter((x) => x.score > 0);

    // Sort by score desc, then by original order for stability
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.originalIndex - b.originalIndex;
    });

    return scored.map((x) => x.item);
  }, [items, query]);

  useEffect(() => {
    if (!filtered.length) {
      setActiveIndex(0);
      return;
    }
    if (activeIndex >= filtered.length) {
      setActiveIndex(filtered.length - 1);
    }
  }, [filtered, activeIndex]);

  // Ensure active item is visible when navigating with arrow keys
  useEffect(() => {
    if (!filtered.length) return;
    const container = listRef.current;
    if (!container) return;
    const el = container.querySelector<HTMLElement>(
      `[data-spotlight-index="${activeIndex}"]`
    );
    if (!el) return;
    // Scroll the active option into view within the scroll container
    el.scrollIntoView({
      block: 'nearest',
    });
  }, [activeIndex, filtered]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!filtered.length) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev - 1 < 0 ? filtered.length - 1 : prev - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[activeIndex];
      if (item) {
        onOpen(item.url);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[240] flex items-start justify-center pt-[15vh] px-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-sidebar border border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Quick search"
      >
        <div className="px-4 pt-3 pb-2 border-b border-white/10 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-accent">
            search
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.searchPlaceholder ?? 'Search bookmarks, boards, categories...'}
            className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-text-muted"
          />
          <span className="hidden md:inline-flex items-center gap-1 rounded-md border border-white/15 px-1.5 py-0.5 text-[10px] text-text-muted">
            <span className="text-[10px]">Ctrl</span>
            <span>+</span>
            <span className="text-[10px]">K</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-1 p-1 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition"
            aria-label="Đóng"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="px-4 py-4 text-xs text-text-muted">
              {query.trim()
                ? t.noResults ?? 'No results found.'
                : t.typeToSearch ?? 'Type to search across all bookmarks.'}
            </p>
          ) : (
            <ul className="py-1">
              {filtered.map((item, index) => {
                const isActive = index === activeIndex;
                return (
                  <li key={item.id} data-spotlight-index={index}>
                    <button
                      type="button"
                      onClick={() => onOpen(item.url)}
                      className={`w-full px-4 py-2 text-left flex flex-col gap-0.5 text-xs transition ${
                        isActive
                          ? 'bg-accent/20 text-white'
                          : 'bg-transparent text-text-secondary hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span className="font-medium truncate">
                        {item.title || item.url}
                      </span>
                      <span className="text-[11px] text-text-muted truncate">
                        {item.boardName ? `${item.boardName} • ` : ''}
                        {item.categoryName ?? ''}
                      </span>
                      <span className="text-[10px] text-text-muted/80 truncate">
                        {item.url}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-4 py-2 border-t border-white/10 flex items-center justify-between">
          <p className="text-[10px] text-text-muted">
            ↑↓ {t.or ?? 'or'} Enter · Esc {t.toClose ?? 'to close'}
          </p>
          <p className="text-[10px] text-text-muted">
            {t.searchAcrossAllBoards ?? 'Searching across all boards & categories'}
          </p>
        </div>
      </div>
    </div>
  );
}

