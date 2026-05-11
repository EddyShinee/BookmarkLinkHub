import React from 'react';
import type { Board } from '../../hooks/useBookmarks';
import { useSettings } from '../../contexts/SettingsContext';
import { getT } from '../../lib/i18n';
import { chromePanelBackground } from './headerSidebarSurface';

export interface DashboardSidebarProps {
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
  boards: Board[];
  boardsLoading: boolean;
  selectedBoardId: string | null;
  onSelectBoard: (boardId: string) => void;
  boardMenuId: string | null;
  onToggleBoardMenu: (boardId: string) => void;
  boardMenuRef: React.RefObject<HTMLDivElement | null>;
  boardTriggerRef: React.RefObject<HTMLButtonElement | null>;
  boardDropdownRef: React.RefObject<HTMLDivElement | null>;
  openBoardMenuAbove: boolean;
  draggedBoardId: string | null;
  dropBoardIndex: number | null;
  onBoardDragStart: (e: React.DragEvent, boardId: string) => void;
  onBoardDragOver: (e: React.DragEvent, boardIndex: number) => void;
  onBoardDrop: (e: React.DragEvent) => void;
  onBoardDragEnd: () => void;
  onEditBoard: (board: Board) => void;
  onDuplicateBoard: (board: Board) => void;
  onDeleteBoard: (board: Board) => void;
  onOpenNewBoardModal: () => void;
  onOpenAuthenticator: () => void;
  onOpenItToolbox: () => void;
}

export function DashboardSidebar({
  sidebarOpen,
  onCloseSidebar,
  boards,
  boardsLoading,
  selectedBoardId,
  onSelectBoard,
  boardMenuId,
  onToggleBoardMenu,
  boardMenuRef,
  boardTriggerRef,
  boardDropdownRef,
  openBoardMenuAbove,
  draggedBoardId,
  dropBoardIndex,
  onBoardDragStart,
  onBoardDragOver,
  onBoardDrop,
  onBoardDragEnd,
  onEditBoard,
  onDuplicateBoard,
  onDeleteBoard,
  onOpenNewBoardModal,
  onOpenAuthenticator,
  onOpenItToolbox,
}: DashboardSidebarProps) {
  const settings = useSettings();
  const t = getT(settings.locale);
  const isLight = settings.theme === 'light';
  const borderChrome = isLight ? 'border-black/10' : 'border-white/10';
  const dragBoard = settings.dragDrop.board;

  return (
    <>
      {sidebarOpen && (
        <button
          type="button"
          onClick={onCloseSidebar}
          className={`fixed inset-0 z-[35] backdrop-blur-[1px] md:hidden border-0 p-0 cursor-pointer ${
            isLight ? 'bg-slate-900/40' : 'bg-black/55'
          }`}
          aria-label={t.sidebarCloseMenu}
        />
      )}
      <aside
        className={`border-r ${borderChrome} flex flex-col z-40 w-64 flex-shrink-0 fixed inset-y-0 left-0 transform transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={chromePanelBackground(settings.headerSidebarColorEffect, settings.theme)}
      >
        <div className={`h-12 flex items-center justify-between gap-2 px-4 border-b ${borderChrome}`}>
          <div className="flex items-center gap-2 text-accent group cursor-pointer min-w-0">
            <div className="p-1.5 bg-accent/10 rounded-lg group-hover:bg-accent/20 transition-colors flex-shrink-0">
              <span className="material-symbols-outlined text-[18px]">hub</span>
            </div>
            <span className={`font-semibold text-sm tracking-tight truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
              LinkHub
            </span>
          </div>
          <button
            type="button"
            onClick={onCloseSidebar}
            className={`md:hidden flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-colors duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
              isLight
                ? 'text-slate-600 hover:bg-black/5 hover:text-slate-900'
                : 'text-text-muted hover:bg-white/10 hover:text-white'
            }`}
            aria-label={t.sidebarCloseMenu}
          >
            <span className="material-symbols-outlined text-[18px] leading-none">close</span>
          </button>
        </div>
        <div className="px-3 pt-2 pb-1 space-y-0.5">
          <button
            type="button"
            onClick={onOpenAuthenticator}
            className={`flex items-center gap-2 w-full px-2.5 py-2 text-xs font-medium rounded-lg text-left border border-transparent transition ${
              isLight ? 'sidebar-item-hover hover:text-text-primary text-text-secondary' : 'text-text-secondary hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[18px] text-accent">shield</span>
            <span>{t.authenticator}</span>
          </button>
          <button
            type="button"
            onClick={onOpenItToolbox}
            className={`flex items-center gap-2 w-full px-2.5 py-2 text-xs font-medium rounded-lg text-left border border-transparent transition ${
              isLight ? 'sidebar-item-hover hover:text-text-primary text-text-secondary' : 'text-text-secondary hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[18px] text-accent">build</span>
            <span>{t.itToolboxTitle}</span>
          </button>
        </div>
        <div className="px-3 pt-3 pb-1.5 flex items-center justify-between">
          <span className={`text-[12px] font-semibold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-text-muted'}`}>
            {t.searchGlobalBoards}
          </span>
          <button
            type="button"
            onClick={onOpenNewBoardModal}
            className={`p-1 rounded-lg transition ${
              isLight ? 'sidebar-item-hover text-slate-600 hover:text-accent' : 'text-text-muted hover:text-accent hover:bg-white/5'
            }`}
            aria-label={t.createBoard}
          >
            <span className="material-icons-round text-base">add_circle_outline</span>
          </button>
        </div>
        <div className="scrollbar-none flex-1 overflow-y-auto px-2 space-y-0.5 pb-3">
          {boardsLoading && boards.length === 0 && (
            <div className="px-1 py-2 space-y-2" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-9 rounded-lg skeleton-shimmer ${isLight ? 'border border-black/10' : 'border border-white/5'}`}
                />
              ))}
            </div>
          )}
          {boards.map((board, boardIndex) => (
            <React.Fragment key={board.id}>
              {dragBoard && draggedBoardId && dropBoardIndex === boardIndex && (
                <div
                  className="h-1 rounded-full bg-accent shadow-[0_0_10px_rgba(129,140,248,0.7)] transition-all duration-150 mx-1 mb-0.5 flex-shrink-0"
                  aria-hidden
                />
              )}
              <div
                ref={boardMenuId === board.id ? boardMenuRef : undefined}
                draggable={dragBoard}
                onDragStart={(e) => dragBoard && onBoardDragStart(e, board.id)}
                onDragOver={(e) => dragBoard && onBoardDragOver(e, boardIndex)}
                onDrop={dragBoard ? onBoardDrop : undefined}
                onDragEnd={dragBoard ? onBoardDragEnd : undefined}
                className={`relative transition-all duration-150 ${dragBoard ? 'cursor-grab active:cursor-grabbing' : ''} ${
                  draggedBoardId === board.id ? 'opacity-40 scale-[0.98]' : ''
                }`}
              >
                <button
                  ref={boardMenuId === board.id ? boardTriggerRef : undefined}
                  type="button"
                  onClick={() => onSelectBoard(board.id)}
                  className={`flex items-center justify-between w-full px-2.5 py-2 text-xs font-medium rounded-lg transition text-left ${
                    selectedBoardId === board.id
                      ? 'bg-accent/15 text-accent border border-accent/25 shadow-[0_0_12px_rgba(129,140,248,0.12)]'
                      : isLight
                      ? 'text-text-secondary border border-transparent sidebar-item-hover hover:text-text-primary'
                      : 'text-text-secondary hover:bg-white/5 hover:text-white border border-transparent'
                  } ${
                    isLight && selectedBoardId === board.id
                      ? '!bg-transparent !border-transparent !shadow-none border-l-2 border-l-accent'
                      : ''
                  }`}
                >
                  <span className="truncate">{board.name}</span>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleBoardMenu(board.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        onToggleBoardMenu(board.id);
                      }
                    }}
                    className={`p-1 rounded flex-shrink-0 cursor-pointer ${isLight ? 'sidebar-item-hover' : 'hover:bg-white/10'}`}
                    aria-label="Menu"
                  >
                    <span className="material-icons-round text-[14px] opacity-60">more_horiz</span>
                  </div>
                </button>
                {boardMenuId === board.id && (
                  <div
                    ref={boardDropdownRef}
                    className={`absolute left-0 right-0 rounded-lg border ${borderChrome} bg-sidebar shadow-xl py-1 z-50 ${
                      openBoardMenuAbove ? 'bottom-full mb-0.5' : 'top-full mt-0.5'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onEditBoard(board)}
                      className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left text-xs text-text-secondary hover:bg-white/10 hover:text-white"
                    >
                      <span className="material-icons-round text-[16px]">edit</span>
                      {t.edit}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDuplicateBoard(board)}
                      className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left text-xs text-text-secondary hover:bg-white/10 hover:text-white"
                    >
                      <span className="material-icons-round text-[16px]">content_copy</span>
                      {t.duplicate}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteBoard(board)}
                      className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left text-xs text-red-400 hover:bg-red-500/20"
                    >
                      <span className="material-icons-round text-[16px]">delete</span>
                      {t.delete}
                    </button>
                  </div>
                )}
              </div>
            </React.Fragment>
          ))}
          {!boardsLoading && boards.length === 0 && (
            <div
              className={`mx-1 my-2 rounded-xl border border-dashed p-4 text-center ${
                isLight ? 'border-black/15 bg-white/70' : 'border-white/15 bg-white/[0.04]'
              }`}
            >
              <span className="material-symbols-outlined text-[36px] text-accent/85 mb-2 block" aria-hidden>
                dashboard_customize
              </span>
              <p className={`text-xs font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{t.emptyBoardsTitle}</p>
              <p className="text-[11px] text-text-muted mt-1.5 mb-3 leading-relaxed">{t.emptyBoardsBody}</p>
              <button
                type="button"
                onClick={onOpenNewBoardModal}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent/25 border border-accent/40 text-accent text-xs font-medium px-3 py-2 hover:bg-accent/35 transition"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                {t.emptyBoardsCta}
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
