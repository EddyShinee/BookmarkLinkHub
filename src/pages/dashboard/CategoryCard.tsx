import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import type { Bookmark, Category } from '../../hooks/useBookmarks';
import { useSettings } from '../../contexts/SettingsContext';
import { getT } from '../../lib/i18n';
import { BookmarkRow } from './BookmarkRow';

export function CategoryCard({
  category,
  fallbackDotColor,
  searchQuery,
  onOpenBookmark,
  cardHeight,
  fillContent,
  categoryMenuId,
  onOpenCategoryMenu,
  onEditCategory,
  onDuplicateCategory,
  onDeleteCategory,
  onAddBookmark,
  onMoveCategory,
  onEditBookmark,
  onDuplicateBookmark,
  onMoveBookmark,
  onDeleteBookmark,
  dragDropCategory,
  sortableWrapper = false,
  isDraggingCategory,
  dragDropBookmark,
  draggedBookmark,
  dropBookmarkTarget,
  onBookmarkDragStart,
  onBookmarkDragOver,
  onBookmarkDrop,
  onBookmarkDragEnd,
  dragHandleProps,
}: {
  category: Category & { bookmarks: Bookmark[] };
  fallbackDotColor: string;
  searchQuery: string;
  onOpenBookmark: (url: string) => void;
  cardHeight: 'auto' | 'equal';
  categoryMenuId: string | null;
  onOpenCategoryMenu: (id: string) => void;
  onEditCategory: () => void;
  onDuplicateCategory?: () => void;
  onDeleteCategory: () => void;
  onAddBookmark: () => void;
  onMoveCategory?: () => void;
  onEditBookmark: (b: Bookmark) => void;
  onDuplicateBookmark?: (b: Bookmark) => void;
  onMoveBookmark?: (b: Bookmark) => void;
  onDeleteBookmark: (b: Bookmark) => void;
  dragDropCategory?: boolean;
  sortableWrapper?: boolean;
  isDraggingCategory?: boolean;
  dragDropBookmark?: boolean;
  draggedBookmark?: { id: string; categoryId: string } | null;
  dropBookmarkTarget?: { id: string; categoryId: string; index: number } | null;
  onBookmarkDragStart?: (e: React.DragEvent, bookmarkId: string) => void;
  onBookmarkDragOver?: (e: React.DragEvent, bookmarkId: string, index: number) => void;
  onBookmarkDrop?: (e: React.DragEvent) => void;
  onBookmarkDragEnd?: () => void;
  fillContent: boolean;
  /** When set, only this header is the drag handle (use header height for grab) */
  dragHandleProps?: {
    setActivatorNodeRef: (el: HTMLElement | null) => void;
    attributes: DraggableAttributes;
    listeners: DraggableSyntheticListeners;
  };
}) {
  const settings = useSettings();
  const t = getT(settings.locale);
  const { id, name, color, icon, bookmarks } = category;
  const isLight = settings.theme === 'light';
  /** Category color is applied to the header row whenever `color` is set. */
  const headerUsesColorBg = Boolean(color);
  const headerTitleClass = headerUsesColorBg ? 'text-white' : isLight ? 'text-slate-900' : 'text-white';
  const headerIconClass = headerUsesColorBg ? 'text-white' : isLight ? 'text-slate-800' : 'text-white';
  const cardChromeHover = isLight
    ? 'hover:ring-black/10 focus-within:ring-accent/35'
    : 'hover:ring-white/10 focus-within:ring-accent/30';
  const headerRowClass = [
    'px-2.5 py-0 border-b flex justify-between items-center',
    headerUsesColorBg ? 'border-white/15' : isLight ? 'border-black/10 bg-black/[0.03]' : 'border-white/5 bg-white/[0.02]',
  ].join(' ');
  const moreBtnClass = isLight
    ? 'text-slate-500 hover:text-slate-900 hover:bg-black/[0.06] transition opacity-0 group-hover:opacity-100 p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50'
    : 'text-text-muted hover:text-white transition opacity-0 group-hover:opacity-100 p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50';
  const menuPanelClass = isLight
    ? 'rounded-lg border border-black/10 bg-white py-1 min-w-[180px] whitespace-nowrap shadow-xl shadow-black/10'
    : 'rounded-lg border border-white/10 bg-sidebar py-1 min-w-[180px] whitespace-nowrap shadow-xl';
  const menuItemClass = isLight
    ? 'flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-black/[0.06] hover:text-slate-900'
    : 'flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left text-xs text-text-secondary hover:bg-white/10 hover:text-white';
  const dotColor = color || fallbackDotColor;
  const filtered = searchQuery
    ? bookmarks.filter(
        (b) =>
          b.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.url?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : bookmarks;
  const menuOpen = categoryMenuId === id;
  const categoryTriggerRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const [categoryMenuPosition, setCategoryMenuPosition] = useState({ top: 0, left: 0 });
  useLayoutEffect(() => {
    if (!menuOpen || !categoryTriggerRef.current) return;
    const tr = categoryTriggerRef.current.getBoundingClientRect();
    const estHeight = 170;
    const spaceBelow = window.innerHeight - tr.bottom;
    const top = spaceBelow < estHeight ? tr.top - estHeight - 4 : tr.bottom + 4;
    setCategoryMenuPosition({ top, left: tr.right - 180 });
  }, [menuOpen]);
  return (
    <div
      data-category-menu
      className={`relative glass-panel rounded-xl overflow-hidden shadow-glass group min-w-0 ring-1 ring-transparent transition-[box-shadow,transform] duration-200 motion-reduce:transform-none hover:-translate-y-px hover:shadow-[0_14px_36px_rgba(0,0,0,0.32)] focus-within:shadow-[0_12px_32px_rgba(0,0,0,0.28)] ${cardChromeHover} ${
        cardHeight === 'equal' ? 'min-h-[240px] flex flex-col' : ''
      } ${(dragDropCategory || sortableWrapper) && !dragHandleProps ? 'cursor-grab active:cursor-grabbing' : ''} ${
        isDraggingCategory ? 'opacity-40 scale-[0.98]' : ''
      } ${menuOpen ? 'z-[999]' : ''}`}
      style={
        color && fillContent
          ? {
              backgroundColor: color,
              backgroundImage: 'none',
            }
          : undefined
      }
    >
      <div className={headerRowClass} style={color ? { backgroundColor: color } : undefined}>
        <div
          ref={dragHandleProps?.setActivatorNodeRef}
          className={`flex items-center gap-1.5 min-w-0 flex-1 ${dragHandleProps ? 'cursor-grab active:cursor-grabbing' : ''}`}
          {...(dragHandleProps?.attributes ?? {})}
          {...(dragHandleProps?.listeners ?? {})}
        >
          {icon ? (
            <span className={`material-symbols-outlined text-[16px] flex-shrink-0 ${headerIconClass}`}>{icon}</span>
          ) : (
            <div
              className="h-1.5 w-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: dotColor, boxShadow: `0 0 6px ${dotColor}80` }}
            />
          )}
          <h3 className={`font-bold text-xs tracking-wide truncate ${headerTitleClass}`}>{name}</h3>
        </div>
        <div ref={categoryTriggerRef} className="relative">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenCategoryMenu(id); }}
            className={moreBtnClass}
            aria-label="More"
          >
            <span className="material-icons-round text-base">more_horiz</span>
          </button>
          {menuOpen &&
            createPortal(
              <div
                ref={categoryDropdownRef}
                className={menuPanelClass}
                style={{
                  position: 'fixed',
                  top: categoryMenuPosition.top,
                  left: categoryMenuPosition.left,
                  zIndex: 9999,
                }}
              >
                <button type="button" onClick={onEditCategory} className={`${menuItemClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40 rounded-md`}>
                  <span className="material-icons-round text-[16px]">edit</span>
                  {t.edit}
                </button>
                <button type="button" onClick={onAddBookmark} className={`${menuItemClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40 rounded-md`}>
                  <span className="material-icons-round text-[16px]">link</span>
                  {t.addBookmark}
                </button>
                {onMoveCategory && (
                  <button type="button" onClick={onMoveCategory} className={`${menuItemClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40 rounded-md`}>
                    <span className="material-icons-round text-[16px]">drive_file_move</span>
                    {t.moveCategory}
                  </button>
                )}
                {onDuplicateCategory && (
                  <button type="button" onClick={onDuplicateCategory} className={`${menuItemClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40 rounded-md`}>
                    <span className="material-icons-round text-[16px]">content_copy</span>
                    {t.duplicate}
                  </button>
                )}
                <button type="button" onClick={onDeleteCategory} className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left text-xs text-red-500 hover:bg-red-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-400/50 rounded-md">
                  <span className="material-icons-round text-[16px]">delete</span>
                  {t.delete}
                </button>
              </div>,
              document.body
            )}
        </div>
      </div>
      <ul className={`py-1.5 px-1 ${cardHeight === 'equal' ? 'flex-1 flex flex-col' : ''}`}>
        {filtered.length === 0 ? (
          <li className={`p-6 flex items-center justify-center ${isLight ? 'text-slate-300' : 'text-text-muted/30'}`}>
            <span className="material-symbols-outlined text-3xl">folder_open</span>
          </li>
        ) : (
          filtered.map((b, i) => (
            <BookmarkRow
              key={b.id}
              bookmark={b}
              index={i}
              onOpen={onOpenBookmark}
              onEdit={onEditBookmark}
              onDuplicate={onDuplicateBookmark}
              onMove={onMoveBookmark}
              onDelete={onDeleteBookmark}
              dragDropEnabled={dragDropBookmark}
              isDragging={draggedBookmark?.id === b.id && draggedBookmark?.categoryId === id}
              isDropTarget={dropBookmarkTarget?.categoryId === id && dropBookmarkTarget?.index === i}
              onDragStart={(e) => onBookmarkDragStart?.(e, b.id)}
              onDragOver={(e) => onBookmarkDragOver?.(e, b.id, i)}
              onDrop={onBookmarkDrop}
              onDragEnd={onBookmarkDragEnd}
            />
          ))
        )}
      </ul>
    </div>
  );
}
