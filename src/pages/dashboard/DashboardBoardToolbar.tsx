import React, { type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { CategorySortOrder } from '../../lib/settings';
import { useSettings } from '../../contexts/SettingsContext';
import { getT } from '../../lib/i18n';

export interface DashboardBoardToolbarProps {
  selectedBoardId: string | null;
  boardsLength: number;
  numColumnsPreferred: number;
  effectiveSortOrder: CategorySortOrder;
  columnConfigPopupOpen: boolean;
  columnConfigPopupRect: { top: number; left: number } | null;
  onToggleColumnPopup: () => void;
  columnConfigTriggerRef: RefObject<HTMLButtonElement | null>;
  columnConfigPopupRef: RefObject<HTMLDivElement | null>;
  onCreateCategory: () => void;
  onAddBookmark: () => void;
  persistBoardColumnCount: (v: 2 | 3 | 4 | 5 | 6) => void | Promise<void>;
  persistBoardSortOrder: (v: CategorySortOrder) => void | Promise<void>;
}

export function DashboardBoardToolbar({
  selectedBoardId,
  boardsLength,
  numColumnsPreferred,
  effectiveSortOrder,
  columnConfigPopupOpen,
  columnConfigPopupRect,
  onToggleColumnPopup,
  columnConfigTriggerRef,
  columnConfigPopupRef,
  onCreateCategory,
  onAddBookmark,
  persistBoardColumnCount,
  persistBoardSortOrder,
}: DashboardBoardToolbarProps) {
  const settings = useSettings();
  const t = getT(settings.locale);
  const isLight = settings.theme === 'light';
  const borderChrome = isLight ? 'border-black/10' : 'border-white/10';

  const createCategoryClass = isLight
    ? 'glass-panel border border-black/10 bg-white/90 text-slate-900 hover:bg-accent hover:border-accent hover:text-white shadow-sm'
    : 'glass-panel text-white hover:bg-accent hover:border-accent';

  const addBookmarkClass = isLight
    ? 'glass-panel border border-black/10 bg-white/75 text-slate-700 hover:bg-white hover:text-slate-900 shadow-sm'
    : 'glass-panel text-text-secondary hover:text-white hover:bg-white/10';

  const boardOptionsTriggerClass = isLight
    ? `w-full glass-panel text-left text-slate-800 hover:bg-white hover:text-slate-900 text-xs font-medium py-2.5 px-3 rounded-lg border ${borderChrome} transition flex items-center justify-between gap-2 shadow-sm`
    : 'w-full glass-panel text-left text-text-secondary hover:text-white hover:bg-white/10 text-xs font-medium py-2.5 px-3 rounded-lg border border-white/10 transition flex items-center justify-between gap-2';

  const popupClass = `w-[260px] rounded-lg border ${borderChrome} bg-sidebar shadow-xl py-3 px-4 ${
    isLight ? 'shadow-black/15' : 'shadow-black/40'
  }`;

  const stepperBtnClass = isLight
    ? 'w-8 h-8 rounded-lg flex items-center justify-center text-slate-800 bg-black/[0.06] hover:bg-accent/30 border border-black/10 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer'
    : 'w-8 h-8 rounded-lg flex items-center justify-center text-white bg-white/10 hover:bg-accent/30 border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer';

  const sliderTrackClass = isLight
    ? 'flex-1 h-2.5 rounded-full appearance-none bg-black/10 accent-accent cursor-pointer disabled:opacity-50 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:border-0'
    : 'flex-1 h-2.5 rounded-full appearance-none bg-white/10 accent-accent cursor-pointer disabled:opacity-50 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:border-0';

  const sortBtnActive = 'bg-accent/20 text-accent font-medium';
  const sortBtnIdle = isLight
    ? 'text-slate-700 hover:bg-black/[0.06] hover:text-slate-900'
    : 'text-text-secondary hover:bg-white/10 hover:text-white';

  const iconMuted = isLight ? 'text-slate-600' : 'text-white/80';
  const iconChevron = isLight ? 'text-slate-500' : 'text-white/60';

  const createDisabled = !selectedBoardId || boardsLength === 0;
  const boardOptsDisabled = !selectedBoardId;

  return (
    <div
      className={`px-4 py-3 z-10 flex items-center justify-between flex-wrap gap-3 ${
        isLight ? 'border-b border-black/[0.06] bg-white/30' : ''
      }`}
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onCreateCategory}
          disabled={createDisabled}
          title={boardsLength === 0 ? t.createBoardFirst : undefined}
          className={`text-xs font-medium px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${createCategoryClass}`}
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          {t.createCategory}
        </button>
        <button
          type="button"
          onClick={onAddBookmark}
          className={`text-xs font-medium px-3 py-2 rounded-lg transition flex items-center gap-1.5 ${addBookmarkClass}`}
        >
          <span className="material-symbols-outlined text-[16px]">link</span>
          {t.addBookmark}
        </button>
      </div>
      <div className="relative min-w-[200px] max-md:hidden">
        <button
          type="button"
          ref={columnConfigTriggerRef}
          onClick={onToggleColumnPopup}
          disabled={boardOptsDisabled}
          title={boardOptsDisabled ? t.createBoardFirst : undefined}
          className={`${boardOptionsTriggerClass} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <span className="flex items-center gap-2">
            <span className={`material-symbols-outlined text-[18px] ${iconMuted}`}>view_column</span>
            <span>{t.boardOptions}</span>
          </span>
          <span className={`material-icons-round text-[18px] flex-shrink-0 ${iconChevron}`}>
            {columnConfigPopupOpen ? 'expand_less' : 'expand_more'}
          </span>
        </button>
        {columnConfigPopupOpen && columnConfigPopupRect &&
          createPortal(
            <div
              ref={columnConfigPopupRef}
              role="dialog"
              aria-label={t.boardOptions}
              style={{
                position: 'fixed',
                top: columnConfigPopupRect.top,
                left: Math.max(8, columnConfigPopupRect.left),
                zIndex: 10000,
              }}
              className={popupClass}
            >
              <p className="text-xs font-medium text-text-secondary mb-2">
                {t.categoryColumns}
                <span className="tabular-nums text-accent font-semibold ml-1">({numColumnsPreferred})</span>
              </p>
              <div className="flex items-center gap-2 mb-4">
                <button
                  type="button"
                  disabled={boardOptsDisabled || numColumnsPreferred <= 2}
                  onClick={() => {
                    if (!selectedBoardId || numColumnsPreferred <= 2) return;
                    void persistBoardColumnCount((numColumnsPreferred - 1) as 2 | 3 | 4 | 5 | 6);
                  }}
                  className={stepperBtnClass}
                  aria-label="-"
                >
                  <span className="material-icons-round text-[18px]">remove</span>
                </button>
                <input
                  type="range"
                  min={2}
                  max={6}
                  step={1}
                  value={numColumnsPreferred}
                  disabled={boardOptsDisabled}
                  onChange={(e) => {
                    const v = Number(e.target.value) as 2 | 3 | 4 | 5 | 6;
                    void persistBoardColumnCount(v);
                  }}
                  className={sliderTrackClass}
                />
                <button
                  type="button"
                  disabled={boardOptsDisabled || numColumnsPreferred >= 6}
                  onClick={() => {
                    if (!selectedBoardId || numColumnsPreferred >= 6) return;
                    void persistBoardColumnCount((numColumnsPreferred + 1) as 2 | 3 | 4 | 5 | 6);
                  }}
                  className={stepperBtnClass}
                  aria-label="+"
                >
                  <span className="material-icons-round text-[18px]">add</span>
                </button>
              </div>
              <div className={`border-t pt-3 ${borderChrome}`}>
                <p className="text-xs font-medium text-text-secondary mb-2">{t.categorySortOrder}</p>
                <div className="flex flex-col gap-1">
                  {(
                    [
                      ['created_asc', t.categorySortCreatedAsc],
                      ['created_desc', t.categorySortCreatedDesc],
                      ['name_asc', t.categorySortNameAsc],
                      ['name_desc', t.categorySortNameDesc],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      disabled={boardOptsDisabled}
                      onClick={() => void persistBoardSortOrder(value as CategorySortOrder)}
                      className={`w-full text-left py-1.5 px-2 rounded-md text-xs transition cursor-pointer ${
                        effectiveSortOrder === value ? sortBtnActive : sortBtnIdle
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
    </div>
  );
}
