import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Bookmark } from '../../hooks/useBookmarks';
import { useSettings } from '../../contexts/SettingsContext';
import { getT } from '../../lib/i18n';

export function BookmarkRow({
  bookmark,
  index,
  onOpen,
  onEdit,
  onDuplicate,
  onMove,
  onDelete,
  dragDropEnabled,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  bookmark: Bookmark;
  index: number;
  onOpen: (url: string) => void;
  onEdit: (b: Bookmark) => void;
  onDuplicate?: (b: Bookmark) => void;
  onMove?: (b: Bookmark) => void;
  onDelete: (b: Bookmark) => void;
  dragDropEnabled?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
}) {
  const settings = useSettings();
  const t = getT(settings.locale);
  const [menuOpen, setMenuOpen] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const bookmarkDropdownRef = useRef<HTMLDivElement>(null);

  const openMenu = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) {
      setTriggerRect(rect);
      setDropdownPosition({ top: rect.bottom + 2, left: rect.right - 160 });
    }
    setMenuOpen(true);
  };
  const closeMenu = () => {
    setMenuOpen(false);
    setTriggerRect(null);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || bookmarkDropdownRef.current?.contains(target)) return;
      closeMenu();
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [menuOpen]);

  useLayoutEffect(() => {
    if (!menuOpen || !triggerRect || !bookmarkDropdownRef.current) return;
    const d = bookmarkDropdownRef.current;
    const dr = d.getBoundingClientRect();
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const openAbove = spaceBelow < dr.height;
    const top = openAbove ? triggerRect.top - dr.height - 2 : triggerRect.bottom + 2;
    const left = triggerRect.right - dr.width;
    setDropdownPosition({ top, left });
  }, [menuOpen, triggerRect]);

  const dropdownContent = menuOpen && triggerRect && (
    <div
      ref={bookmarkDropdownRef}
      className="rounded-lg border border-white/10 bg-sidebar shadow-xl py-1 min-w-[160px] whitespace-nowrap"
      style={{
        position: 'fixed',
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        zIndex: 9999,
      }}
    >
      <button type="button" onClick={() => { onEdit(bookmark); closeMenu(); }} className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left text-xs text-text-secondary hover:bg-white/10 hover:text-white">
        <span className="material-icons-round text-[16px]">edit</span>
        {t.edit}
      </button>
      {onDuplicate && (
        <button type="button" onClick={() => { onDuplicate(bookmark); closeMenu(); }} className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left text-xs text-text-secondary hover:bg-white/10 hover:text-white">
          <span className="material-icons-round text-[16px]">content_copy</span>
          {t.duplicate}
        </button>
      )}
      {onMove && (
        <button type="button" onClick={() => { onMove(bookmark); closeMenu(); }} className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left text-xs text-text-secondary hover:bg-white/10 hover:text-white">
          <span className="material-icons-round text-[16px]">drive_file_move</span>
          {t.moveBookmark}
        </button>
      )}
      <button type="button" onClick={() => { onDelete(bookmark); closeMenu(); }} className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left text-xs text-red-400 hover:bg-red-500/20">
        <span className="material-icons-round text-[16px]">delete</span>
        {t.delete}
      </button>
    </div>
  );

  return (
    <li className="relative">
      {isDropTarget && (
        <div className="absolute left-2 right-2 top-0 h-1 rounded-full bg-accent shadow-[0_0_8px_rgba(129,140,248,0.6)] z-10 pointer-events-none" aria-hidden />
      )}
      <div
        ref={ref}
        draggable={dragDropEnabled}
        onDragStart={dragDropEnabled ? onDragStart : undefined}
        onDragOver={dragDropEnabled ? onDragOver : undefined}
        onDrop={dragDropEnabled ? onDrop : undefined}
        onDragEnd={dragDropEnabled ? onDragEnd : undefined}
        className={`relative flex items-center group/item transition-all duration-150 ${dragDropEnabled ? 'cursor-grab active:cursor-grabbing' : ''} ${isDragging ? 'opacity-40 scale-[0.98]' : ''}`}
      >
        <button
          type="button"
          onClick={() => onOpen(bookmark.url)}
          className={`flex items-center gap-2 px-3 py-2 mx-0.5 rounded-lg transition-all duration-200 w-full text-left flex-1 min-w-0 ${
            settings.theme === 'light' ? 'hover:bg-transparent' : 'hover:bg-white/10'
          }`}
        >
          <div className={`w-5 h-5 rounded flex items-center justify-center text-[11px] font-bold flex-shrink-0 transition-colors ${
            settings.theme === 'light'
              ? 'bg-transparent text-text-secondary border border-black/10 group-hover/item:border-accent/50 group-hover/item:text-accent'
              : 'bg-slate-800 text-text-secondary border border-white/5 group-hover/item:border-accent/30 group-hover/item:text-accent'
          }`}>
            {index + 1}
          </div>
          <span className="text-xs font-medium text-text-secondary group-hover/item:text-white transition-colors truncate">
            {bookmark.title || bookmark.url}
          </span>
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); if (menuOpen) closeMenu(); else openMenu(); }}
          className="p-1 rounded text-text-muted hover:text-white opacity-0 group-hover/item:opacity-100 transition absolute right-1.5"
          aria-label="Menu"
        >
          <span className="material-icons-round text-[14px]">more_vert</span>
        </button>
      </div>
      {dropdownContent && createPortal(dropdownContent, document.body)}
    </li>
  );
}
