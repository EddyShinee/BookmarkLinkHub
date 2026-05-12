import React from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { getT } from '../../lib/i18n';
import { chromePanelBackground } from './headerSidebarSurface';

export interface DashboardFooterProps {
  boardCount: number;
  categoryTotal: number;
  bookmarkTotal: number;
  selectedBoardId: string | null;
  categoryCountOnBoard: number;
  linkCountOnBoard: number;
}

export function DashboardFooter({
  boardCount,
  categoryTotal,
  bookmarkTotal,
  selectedBoardId,
  categoryCountOnBoard,
  linkCountOnBoard,
}: DashboardFooterProps) {
  const settings = useSettings();
  const t = getT(settings.locale);
  const isLight = settings.theme === 'light';
  const borderChrome = isLight ? 'border-black/10' : 'border-white/10';
  const valueClass = `font-semibold tabular-nums ${isLight ? 'text-slate-900' : 'text-white'}`;
  const labelClass = 'text-text-muted font-normal';
  const globalLineClass = `inline-flex flex-wrap items-baseline gap-x-1 text-[11px] leading-snug sm:text-xs ${isLight ? 'text-slate-800' : 'text-white/90'}`;

  return (
    <footer
      className={`flex min-h-10 w-full flex-shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t px-3 py-2 md:px-4 ${borderChrome}`}
      style={chromePanelBackground(settings.headerSidebarColorEffect, settings.theme)}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className={globalLineClass}>
          <span className={labelClass}>{t.dashboardFooterTotalBoards}</span>{' '}
          <span className={valueClass}>{boardCount}</span>
        </span>
        <span className={globalLineClass}>
          <span className={labelClass}>{t.dashboardFooterTotalCategories}</span>{' '}
          <span className={valueClass}>{categoryTotal}</span>
        </span>
        <span className={globalLineClass}>
          <span className={labelClass}>{t.dashboardFooterTotalBookmarks}</span>{' '}
          <span className={valueClass}>{bookmarkTotal}</span>
        </span>
      </div>
      <div
        className={`ml-auto flex shrink-0 flex-wrap items-center justify-end gap-x-4 gap-y-1 text-[11px] leading-snug sm:text-xs ${
          selectedBoardId ? '' : 'opacity-55'
        }`}
        title={selectedBoardId ? t.dashboardFooterBoardStatsHint : undefined}
        aria-label={selectedBoardId ? t.dashboardFooterBoardStatsHint : undefined}
      >
        <span className={`inline-flex items-baseline gap-x-1 ${isLight ? 'text-slate-800' : 'text-white/90'}`}>
          <span className={valueClass}>{selectedBoardId ? categoryCountOnBoard : '—'}</span>
          <span className={labelClass}>{t.dashboardFooterWordCategories}</span>
        </span>
        <span className={`inline-flex items-baseline gap-x-1 ${isLight ? 'text-slate-800' : 'text-white/90'}`}>
          <span className={valueClass}>{selectedBoardId ? linkCountOnBoard : '—'}</span>
          <span className={labelClass}>{t.dashboardFooterWordBookmarks}</span>
        </span>
      </div>
    </footer>
  );
}
