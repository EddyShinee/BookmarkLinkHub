import React from 'react';
import { defaultAnimateLayoutChanges, useSortable, type AnimateLayoutChanges } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Bookmark, Category } from '../../hooks/useBookmarks';
import { DROP_INDICATOR_CLASS } from './boardGrid';
import { CategoryCard } from './CategoryCard';

const animateLayoutChanges: AnimateLayoutChanges = (args) => {
  if (args.isSorting || args.wasDragging) {
    return defaultAnimateLayoutChanges(args);
  }
  return false;
};

export function SortableCategoryCard({
  category,
  activeCategoryId,
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
  dragDropBookmark,
  draggedBookmark,
  dropBookmarkTarget,
  onBookmarkDragStart,
  onBookmarkDragOver,
  onBookmarkDrop,
  onBookmarkDragEnd,
  disabled,
}: {
  category: Category & { bookmarks: Bookmark[] };
  activeCategoryId: string | null;
  fallbackDotColor: string;
  searchQuery: string;
  onOpenBookmark: (url: string) => void;
  cardHeight: 'auto' | 'equal';
  fillContent: boolean;
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
  dragDropBookmark?: boolean;
  draggedBookmark?: { id: string; categoryId: string } | null;
  dropBookmarkTarget?: { id: string; categoryId: string; index: number } | null;
  onBookmarkDragStart?: (e: React.DragEvent, bookmarkId: string) => void;
  onBookmarkDragOver?: (e: React.DragEvent, bookmarkId: string, index: number) => void;
  onBookmarkDrop?: (e: React.DragEvent) => void;
  onBookmarkDragEnd?: () => void;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
    animateLayoutChanges,
    transition: { duration: 200, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' },
    disabled,
  });
  const isActive = isDragging || activeCategoryId === category.id;
  const showLineAbove = false;
  const showLineBelow = false;
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    pointerEvents: isActive ? 'none' : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className={`break-inside-avoid category-grid-item relative ${isActive ? 'drag-placeholder' : ''}`}>
      {showLineAbove && <div className={DROP_INDICATOR_CLASS} style={{ top: -6 }} aria-hidden />}
      <CategoryCard
        dragHandleProps={
          !disabled
            ? { setActivatorNodeRef, attributes, listeners }
            : undefined
        }
        category={category}
        fallbackDotColor={fallbackDotColor}
        searchQuery={searchQuery}
        onOpenBookmark={onOpenBookmark}
        cardHeight={cardHeight}
        fillContent={fillContent}
        categoryMenuId={categoryMenuId}
        onOpenCategoryMenu={onOpenCategoryMenu}
        onEditCategory={onEditCategory}
        onDuplicateCategory={onDuplicateCategory}
        onDeleteCategory={onDeleteCategory}
        onAddBookmark={onAddBookmark}
        onMoveCategory={onMoveCategory}
        onEditBookmark={onEditBookmark}
        onDuplicateBookmark={onDuplicateBookmark}
        onMoveBookmark={onMoveBookmark}
        onDeleteBookmark={onDeleteBookmark}
        dragDropCategory={true}
        sortableWrapper={true}
        isDraggingCategory={isDragging || activeCategoryId === category.id}
        dragDropBookmark={dragDropBookmark}
        draggedBookmark={draggedBookmark}
        dropBookmarkTarget={dropBookmarkTarget}
        onBookmarkDragStart={onBookmarkDragStart}
        onBookmarkDragOver={onBookmarkDragOver}
        onBookmarkDrop={onBookmarkDrop}
        onBookmarkDragEnd={onBookmarkDragEnd}
      />
      {showLineBelow && <div className={DROP_INDICATOR_CLASS} style={{ bottom: -6 }} aria-hidden />}
    </div>
  );
}
