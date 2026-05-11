import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  closestCenter,
  useDroppable,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Over,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '../hooks/useAuth';
import { useBookmarks } from '../hooks/useBookmarks';
import { useBoardColumns } from '../hooks/useBoardColumns';
import { useCategories } from '../hooks/useCategories';
import type { Bookmark, Category, Board } from '../hooks/useBookmarks';
import { useSettings } from '../contexts/SettingsContext';
import SettingsModal from '../components/SettingsModal';
import { useUnsplashBackground } from '../hooks/useUnsplashBackground';
import BoardModal from '../components/BoardModal';
import ITToolboxModal from '../components/ITToolboxModal';
import AuthenticatorModal from '../components/AuthenticatorModal';
import CategoryModal from '../components/CategoryModal';
import BookmarkModal from '../components/BookmarkModal';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast, { type ToastType } from '../components/Toast';
import SearchSpotlightModal, { type SpotlightItem } from '../components/SearchSpotlightModal';
import { useSearchShortcut } from '../hooks/useSearchShortcut';
import { getT } from '../lib/i18n';
import type { CategorySortOrder } from '../lib/settings';
import { supabase } from '../lib/supabaseClient';
import { chromeStorageAdapter } from '../lib/chromeStorageAdapter';
import { openLink } from '../lib/openLink';
import {
  normalizeSearchString,
  parseSpotlightQuery,
  scoreBookmarkSearch,
  stripSearchFilterSyntax,
} from '../lib/searchBookmarks';
import { buildBookmarksHtml, downloadHtml } from '../lib/exportHtml';
import { parseNetscapeBookmarksHtml } from '../lib/parseBookmarksHtml';

/** Fallback dot colors when category.color is not set (schema default #818CF8 = accent) */
const FALLBACK_DOT_COLORS = [
  '#818CF8', '#10B981', '#A855F7', '#FB923C', '#EC4899', '#3B82F6', '#EAB308', '#06B6D4',
];

const COLUMN_DROP_PREFIX = 'column-';

/** Prefer pointer position; fallback to closest center when pointer is in gap between columns */
const categoryCollisionDetection: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  if (pointer.length > 0) return pointer;
  return closestCenter(args);
};

function ColumnDroppable({
  columnId,
  children,
  className,
  isEmpty,
}: {
  columnId: string;
  children: React.ReactNode;
  className?: string;
  isEmpty?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: COLUMN_DROP_PREFIX + columnId });
  return (
    <div
      ref={setNodeRef}
      className={[
        className ?? '',
        'rounded-xl transition-all duration-200',
        isOver
          ? 'bg-accent/15 ring-2 ring-accent/50 ring-offset-0 min-h-[120px] transition-[box-shadow,background-color] duration-150'
          : '',
      ].join(' ')}
    >
      {children}
      {isEmpty && isOver && (
        <div className="flex items-center justify-center h-20 text-accent/60 text-xs font-medium select-none">
          <span className="material-symbols-outlined text-base mr-1">add_circle</span>
          Thả vào đây
        </div>
      )}
    </div>
  );
}

/** When over is column: { columnId, insertAtStart }; used for intent + visual */
type ColumnDropIndicator = { columnId: string; insertAtStart: boolean } | null;

/** Shows where a category will be inserted: above or below this card */
const DROP_INDICATOR_CLASS =
  'absolute left-0 right-0 h-[3px] rounded-full bg-accent pointer-events-none z-10 drop-indicator-line';
const DROP_INDICATOR_BLOCK_CLASS =
  'h-[3px] rounded-full bg-accent pointer-events-none flex-shrink-0 drop-indicator-line';

function categoryGridColsClass(n: number): string {
  if (n === 2) return 'category-grid-cols-2';
  if (n === 3) return 'category-grid-cols-3';
  if (n === 5) return 'category-grid-cols-5';
  if (n === 6) return 'category-grid-cols-6';
  return 'category-grid-cols-4';
}

function CategoryGridSkeleton({ numCols }: { numCols: number }) {
  const n = Math.min(6, Math.max(2, Math.round(numCols)));
  return (
    <div
      className={`category-grid ${categoryGridColsClass(n)}`}
      aria-busy="true"
      aria-label="Loading"
    >
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="category-grid-item space-y-3">
          <div className="rounded-xl border border-white/10 overflow-hidden glass-panel min-h-[200px]">
            <div className="h-10 border-b border-white/10 skeleton-shimmer" />
            <div className="p-3 space-y-2.5">
              <div className="h-9 skeleton-shimmer rounded-lg" />
              <div className="h-9 skeleton-shimmer rounded-lg" />
              <div className="h-9 skeleton-shimmer rounded-lg" />
              <div className="h-9 skeleton-shimmer rounded-lg w-4/5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SortableCategoryCard({
  category,
  activeCategoryId,
  dropIndicator,
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
  /** When dragging, indicates insert above/below this card */
  dropIndicator?: { overId: string; insertAbove: boolean } | null;
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

interface DashboardProps {
  initialAddBookmark?: { url: string; title: string };
  initialOpenAuthenticator?: boolean;
  initialOpenItTools?: boolean;
  initialOpenSettings?: boolean;
}

export default function Dashboard({
  initialAddBookmark,
  initialOpenAuthenticator,
  initialOpenItTools,
  initialOpenSettings,
}: DashboardProps) {
  const { user } = useAuth();
  const settings = useSettings();
  const { boards, setBoards, loading: boardsLoading, error: boardsError, refetch: refetchBoards } = useBookmarks(user?.id);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const selectedBoard = boards.find((b) => b.id === selectedBoardId) ?? null;
  const { columns: boardColumns, loading: columnsLoading, refetch: refetchBoardColumns } = useBoardColumns(selectedBoardId);
  const { categories, setCategories, loading: categoriesLoading, refetch: refetchCategories } = useCategories(selectedBoardId);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [uiRestored, setUiRestored] = useState(false);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allBookmarks, setAllBookmarks] = useState<Bookmark[]>([]);
  const [searchDataLoading, setSearchDataLoading] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(!!initialAddBookmark);
  const [settingsModalOpen, setSettingsModalOpen] = useState(!!initialOpenSettings);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  /** Last droppable "over" during category drag; used when DragEnd fires with over=null */
  const lastCategoryOverRef = useRef<Over | null>(null);

  const [boardModalOpen, setBoardModalOpen] = useState(false);
  const [authenticatorModalOpen, setAuthenticatorModalOpen] = useState(!!initialOpenAuthenticator);
  const [itToolboxModalOpen, setItToolboxModalOpen] = useState(!!initialOpenItTools);
  const [boardEditing, setBoardEditing] = useState<Board | null>(null);
  const [boardMenuId, setBoardMenuId] = useState<string | null>(null);

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryEditing, setCategoryEditing] = useState<Category | null>(null);
  const [categoryMoveMode, setCategoryMoveMode] = useState(false);
  const [categoryMenuId, setCategoryMenuId] = useState<string | null>(null);

  const [bookmarkModalOpen, setBookmarkModalOpen] = useState(false);
  const [bookmarkEditing, setBookmarkEditing] = useState<Bookmark | null>(null);
  const [addBookmarkCategoryId, setAddBookmarkCategoryId] = useState<string | null>(null);
  const [bookmarkToMove, setBookmarkToMove] = useState<Bookmark | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });
  const [draggedBoardId, setDraggedBoardId] = useState<string | null>(null);
  const [dropBoardIndex, setDropBoardIndex] = useState<number | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{ overId: string; insertAbove: boolean } | null>(null);
  const [columnDropIndicator, setColumnDropIndicator] = useState<ColumnDropIndicator>(null);
  const [draggedBookmark, setDraggedBookmark] = useState<{ id: string; categoryId: string } | null>(null);
  const [dropBookmarkTarget, setDropBookmarkTarget] = useState<{ id: string; categoryId: string; index: number } | null>(null);

  const [importLoading, setImportLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType }>({ message: '', type: 'success' });

  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [columnConfigPopupOpen, setColumnConfigPopupOpen] = useState(false);
  const [columnConfigPopupRect, setColumnConfigPopupRect] = useState<{ top: number; left: number } | null>(null);
  const columnConfigTriggerRef = useRef<HTMLButtonElement>(null);
  const columnConfigPopupRef = useRef<HTMLDivElement>(null);

  const [activeDragCategory, setActiveDragCategory] = useState<Category & { bookmarks: Bookmark[] } | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        window.location.hash = '#/landing';
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    const tLoc = getT(settings.locale);
    if (boardsLoading) {
      setToast({ message: tLoc.loadingBoards, type: 'info' });
    } else if (toast.message === tLoc.loadingBoards) {
      setToast((p) => ({ ...p, message: '' }));
    }
  }, [boardsLoading, settings.locale, toast.message]);

  useEffect(() => {
    const tLoc = getT(settings.locale);
    if (categoriesLoading) {
      const boardName = boards.find((b) => b.id === selectedBoardId)?.name;
      const msg = boardName ? `${tLoc.loadingBoardPrefix} ${boardName}...` : tLoc.loadingCategories;
      setToast({ message: msg, type: 'info' });
    } else if (
      toast.message === tLoc.loadingCategories ||
      toast.message?.startsWith(`${tLoc.loadingBoardPrefix} `)
    ) {
      setToast((p) => ({ ...p, message: '' }));
    }
  }, [categoriesLoading, settings.locale, toast.message, boards, selectedBoardId]);

  useEffect(() => {
    const tLoc = getT(settings.locale);
    if (searchDataLoading) {
      setToast({ message: tLoc.loadingAuth, type: 'info' });
    } else if (toast.message === tLoc.loadingAuth) {
      setToast((p) => ({ ...p, message: '' }));
    }
  }, [searchDataLoading, settings.locale, toast.message]);

  const boardMenuRef = useRef<HTMLDivElement>(null);
  const boardTriggerRef = useRef<HTMLButtonElement>(null);
  const boardDropdownRef = useRef<HTMLDivElement>(null);
  const [openBoardMenuAbove, setOpenBoardMenuAbove] = useState(false);

  const userDropdownRef = useRef<HTMLDivElement>(null);
  const userTriggerRef = useRef<HTMLButtonElement>(null);
  const [openUserMenuAbove, setOpenUserMenuAbove] = useState(false);

  const searchTerm = searchQuery.trim().toLowerCase();
  const globalSearchResults = useMemo(() => {
    if (!searchTerm) return null;
    const pn = parseSpotlightQuery(searchQuery);
    const needle =
      normalizeSearchString(pn.board || pn.text || stripSearchFilterSyntax(searchQuery));

    const boardMatches = boards.filter((b) => {
      const nm = normalizeSearchString(b.name);
      return !needle || nm.includes(needle);
    });
    const categoryMatches = allCategories.filter((c) => {
      const nm = normalizeSearchString(c.name);
      return !needle || nm.includes(needle);
    });
    const bookmarkMatches = allBookmarks.filter((bm) => {
      const cat = allCategories.find((c) => c.id === bm.category_id);
      const board = cat ? boards.find((br) => br.id === cat.board_id) : undefined;
      const s = scoreBookmarkSearch(
        {
          title: bm.title ?? '',
          url: bm.url ?? '',
          boardName: board?.name,
          categoryName: cat?.name,
          description: bm.description,
          tags: bm.tags,
        },
        pn
      );
      return s > 0;
    });
    return { boardMatches, categoryMatches, bookmarkMatches };
  }, [searchTerm, searchQuery, boards, allCategories, allBookmarks]);

  const spotlightItems: SpotlightItem[] = useMemo(() => {
    if (!allBookmarks.length) return [];
    return allBookmarks.map((bm) => {
      const cat = allCategories.find((c) => c.id === bm.category_id);
      const board = cat ? boards.find((b) => b.id === cat.board_id) : undefined;
      return {
        id: bm.id,
        title: bm.title || bm.url,
        url: bm.url,
        boardName: board?.name,
        categoryName: cat?.name,
        description: bm.description,
        tags: bm.tags,
        updatedAt: bm.updated_at,
      };
    });
  }, [allBookmarks, allCategories, boards]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (userMenuRef.current && !userMenuRef.current.contains(target)) setUserMenuOpen(false);
      if (boardMenuRef.current && !boardMenuRef.current.contains(target)) setBoardMenuId(null);
      if (categoryMenuId && !(e.target as Element).closest('[data-category-menu]')) setCategoryMenuId(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [categoryMenuId]);

  // Vị trí popup Board Options (khi mở)
  useEffect(() => {
    if (!columnConfigPopupOpen || !columnConfigTriggerRef.current) {
      setColumnConfigPopupRect(null);
      return;
    }
    const updateRect = () => {
      const el = columnConfigTriggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setColumnConfigPopupRect({
        top: r.bottom + 4,
        left: r.right - 260,
      });
    };
    updateRect();
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [columnConfigPopupOpen]);

  // Đóng Board Options popup bằng mousedown (tránh đóng trước khi click nút kịp xử lý)
  useEffect(() => {
    const handleMouseDownOutside = (e: MouseEvent) => {
      if (!columnConfigPopupOpen) return;
      const target = e.target as Node;
      const insideTrigger = columnConfigTriggerRef.current?.contains(target);
      const insidePopup = columnConfigPopupRef.current?.contains(target);
      if (!insideTrigger && !insidePopup) setColumnConfigPopupOpen(false);
    };
    document.addEventListener('mousedown', handleMouseDownOutside);
    return () => document.removeEventListener('mousedown', handleMouseDownOutside);
  }, [columnConfigPopupOpen]);

  // Load data for global search across all boards
  useEffect(() => {
    if (!user?.id) return;
    setSearchDataLoading(true);
    (async () => {
      try {
        const { data: cats } = await supabase
          .from('categories')
          .select('*')
          .order('sort_order');
        setAllCategories((cats ?? []) as Category[]);
        const { data: bms } = await supabase
          .from('bookmarks')
          .select('*')
          .order('sort_order');
        setAllBookmarks((bms ?? []) as Bookmark[]);
      } finally {
        setSearchDataLoading(false);
      }
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!boardMenuId) return;
    const run = () => {
      const t = boardTriggerRef.current;
      const d = boardDropdownRef.current;
      if (!t || !d) return;
      const tr = t.getBoundingClientRect();
      const dr = d.getBoundingClientRect();
      const spaceBelow = window.innerHeight - tr.bottom;
      setOpenBoardMenuAbove(spaceBelow < dr.height);
    };
    const id = requestAnimationFrame(run);
    return () => cancelAnimationFrame(id);
  }, [boardMenuId]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const run = () => {
      const t = userTriggerRef.current;
      const d = userDropdownRef.current;
      if (!t || !d) return;
      const tr = t.getBoundingClientRect();
      const dr = d.getBoundingClientRect();
      const spaceBelow = window.innerHeight - tr.bottom;
      setOpenUserMenuAbove(spaceBelow < dr.height);
    };
    const id = requestAnimationFrame(run);
    return () => cancelAnimationFrame(id);
  }, [userMenuOpen]);

  useEffect(() => {
    if (!initialAddBookmark) return;
    const t = getT(settings.locale);
    if (boards.length === 0) {
      setConfirmDialog({
        open: true,
        title: t.addBookmark,
        message: t.addBookmarkNeedBoard,
        confirmLabel: t.createBoard,
        danger: false,
        onConfirm: () => {
          setConfirmDialog((d) => ({ ...d, open: false }));
          setBoardModalOpen(true);
        },
      });
      setAddModalOpen(false);
      return;
    }
    if (categories.length === 0) {
      setConfirmDialog({
        open: true,
        title: t.addBookmark,
        message: t.addBookmarkNeedCategory,
        confirmLabel: t.createCategory,
        danger: false,
        onConfirm: () => {
          setConfirmDialog((d) => ({ ...d, open: false }));
          setCategoryModalOpen(true);
        },
      });
      setAddModalOpen(false);
      return;
    }
    setAddModalOpen(true);
  }, [initialAddBookmark, boards.length, categories.length, settings.locale]);

  useEffect(() => {
    if (initialOpenAuthenticator) setAuthenticatorModalOpen(true);
  }, [initialOpenAuthenticator]);

  useEffect(() => {
    let done = false;
    (async () => {
      try {
        const [storedSidebar, storedBoard] = await Promise.all([
          chromeStorageAdapter.getItem('lastSidebarOpen'),
          chromeStorageAdapter.getItem('lastSelectedBoardId'),
        ]);
        if (storedSidebar === 'true') setSidebarOpen(true);
        if (storedSidebar === 'false') setSidebarOpen(false);
        if (storedBoard) setSelectedBoardId(storedBoard);
      } finally {
        if (!done) {
          done = true;
          setUiRestored(true);
        }
      }
    })();
  }, []);

  useEffect(() => {
    // Fallback: if stored board is missing, pick first board
    if (!uiRestored) return;
    if (boards.length > 0 && (!selectedBoardId || !boards.some((b) => b.id === selectedBoardId))) {
      setSelectedBoardId(boards[0].id);
    }
  }, [boards, selectedBoardId, uiRestored]);

  useEffect(() => {
    chromeStorageAdapter.setItem('lastSidebarOpen', String(sidebarOpen));
  }, [sidebarOpen]);

  useEffect(() => {
    if (!selectedBoardId) return;
    chromeStorageAdapter.setItem('lastSelectedBoardId', selectedBoardId);
  }, [selectedBoardId]);

  const focusSearch = useCallback(() => {
    if (spotlightOpen) return;
    if (searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  }, [spotlightOpen]);

  const openSpotlight = useCallback(() => {
    setSpotlightOpen(true);
  }, []);

  useSearchShortcut(openSpotlight);

  // Ensure board has N columns when none (bootstrap); DB check prevents duplicates
  const numColumnsPreferred = selectedBoard?.category_columns ?? settings.categoryColumns;
  const syncingColumnsRef = useRef(false);
  useEffect(() => {
    syncingColumnsRef.current = false;
  }, [selectedBoardId]);

  useEffect(() => {
    if (!selectedBoardId || columnsLoading || syncingColumnsRef.current) return;
    if (boardColumns.length > 0 && boardColumns[0].board_id !== selectedBoardId) return;
    if (boardColumns.length >= numColumnsPreferred) return;
    syncingColumnsRef.current = true;
    (async () => {
      try {
        if (boardColumns.length === 0) {
          const { data: existing } = await supabase
            .from('board_columns')
            .select('id')
            .eq('board_id', selectedBoardId)
            .limit(1);
          if (existing && existing.length > 0) {
            await refetchBoardColumns();
            return;
          }
        }
        const startIdx = boardColumns.length;
        await Promise.all(
          Array.from({ length: numColumnsPreferred - startIdx }, (_, i) =>
            supabase.from('board_columns').insert({
              board_id: selectedBoardId,
              name: `Column ${startIdx + i + 1}`,
              sort_order: startIdx + i,
            })
          )
        );
        await refetchBoardColumns();
      } finally {
        syncingColumnsRef.current = false;
      }
    })();
  }, [selectedBoardId, columnsLoading, boardColumns, numColumnsPreferred, refetchBoardColumns]);

  // Sắp xếp category: ưu tiên theo board, không có thì dùng Settings
  const effectiveSortOrder: CategorySortOrder =
    (selectedBoard?.category_sort_order as CategorySortOrder | undefined) ?? settings.categorySortOrder;

  const categorySortCompare = useCallback(
    (a: Category & { bookmarks: Bookmark[] }, b: Category & { bookmarks: Bookmark[] }) => {
      switch (effectiveSortOrder) {
        case 'created_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'created_desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'name_asc':
          return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
        case 'name_desc':
          return (b.name || '').localeCompare(a.name || '', undefined, { sensitivity: 'base' });
        default:
          return a.sort_order - b.sort_order;
      }
    },
    [effectiveSortOrder]
  );

  // Assign column_id only to categories that have null column_id (never assigned)
  const assigningOrphansRef = useRef(false);
  useEffect(() => {
    assigningOrphansRef.current = false;
  }, [selectedBoardId]);

  useEffect(() => {
    if (!selectedBoardId || columnsLoading || categoriesLoading) return;
    if (!boardColumns.length || !categories.length || assigningOrphansRef.current) return;
    if (boardColumns[0].board_id !== selectedBoardId) return;
    if (categories[0].board_id !== selectedBoardId) return;

    const firstColId = boardColumns[0].id;
    const orphans = categories.filter((c) => !c.column_id);
    if (orphans.length === 0) return;

    assigningOrphansRef.current = true;
    let cancelled = false;
    (async () => {
      const existing = categories.filter((c) => c.column_id === firstColId);
      let nextOrder = existing.length === 0 ? 0 : Math.max(...existing.map((c) => c.sort_order), -1) + 1;
      for (const cat of orphans) {
        if (cancelled) break;
        await supabase
          .from('categories')
          .update({ column_id: firstColId, sort_order: nextOrder++, updated_at: new Date().toISOString() })
          .eq('id', cat.id);
      }
      if (!cancelled) await refetchCategories();
      assigningOrphansRef.current = false;
    })();
    return () => { cancelled = true; };
  }, [selectedBoardId, boardColumns, categories, columnsLoading, categoriesLoading, refetchCategories]);

  // Group categories by column; always order by sort_order so drag order is stable on refresh
  const categoriesByColumn = useMemo(() => {
    const map = new Map<string, (Category & { bookmarks: Bookmark[] })[]>();
    for (const col of boardColumns) {
      map.set(col.id, []);
    }
    const firstColId = boardColumns[0]?.id ?? null;
    for (const cat of categories) {
      const colId = cat.column_id ?? firstColId;
      if (colId && map.has(colId)) {
        map.get(colId)!.push(cat);
      } else if (firstColId) {
        map.get(firstColId)!.push(cat);
      }
    }
    for (const [, list] of map) {
      list.sort((a, b) => {
        const d = a.sort_order - b.sort_order;
        if (d !== 0) return d;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    }
    return map;
  }, [boardColumns, categories]);

  const categoryGridSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } })
  );

  const handleCategoryDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveCategoryId(null);
      if (!over || active.id === over.id) return;
      const overId = String(over.id);
      const draggedCat = categories.find((c) => c.id === active.id);
      if (!draggedCat) return;

      const pointerY = (event.activatorEvent as PointerEvent).clientY + event.delta.y;
      const overCenterY = over.rect.top + over.rect.height / 2;
      const pointerAboveCenter = pointerY < overCenterY;

      let targetColumnId: string;
      let targetSortOrder: number;

      if (overId.startsWith(COLUMN_DROP_PREFIX)) {
        targetColumnId = overId.slice(COLUMN_DROP_PREFIX.length);
        const inCol = categoriesByColumn.get(targetColumnId) ?? [];
        targetSortOrder = pointerAboveCenter ? 0 : inCol.length;
      } else {
        const targetCat = categories.find((c) => c.id === overId);
        if (!targetCat) return;
        targetColumnId = targetCat.column_id ?? boardColumns[0]?.id ?? '';
        const inCol = (categoriesByColumn.get(targetColumnId) ?? []).filter((c) => c.id !== draggedCat.id);
        const toIndex = inCol.findIndex((c) => c.id === overId);
        const baseIndex = toIndex >= 0 ? toIndex : inCol.length;
        targetSortOrder = pointerAboveCenter ? baseIndex : baseIndex + 1;
      }

      if (draggedCat.column_id === targetColumnId && draggedCat.sort_order === targetSortOrder) return;

      const now = new Date().toISOString();
      const sourceColumnId = draggedCat.column_id ?? boardColumns[0]?.id ?? '';
      const movedBetweenColumns = sourceColumnId !== targetColumnId;

      // Reorder target column
      const targetCats = (categoriesByColumn.get(targetColumnId) ?? []).filter((c) => c.id !== draggedCat.id);
      const reordered = [...targetCats.slice(0, targetSortOrder), draggedCat, ...targetCats.slice(targetSortOrder)];

      // Batch all updates
      const updates: { id: string; column_id: string; sort_order: number }[] = [];
      for (let i = 0; i < reordered.length; i++) {
        const cat = reordered[i];
        if (cat.id === draggedCat.id || cat.column_id !== targetColumnId || cat.sort_order !== i) {
          updates.push({ id: cat.id, column_id: targetColumnId, sort_order: i });
        }
      }

      // Reindex source column to close the gap
      if (movedBetweenColumns) {
        const sourceCats = (categoriesByColumn.get(sourceColumnId) ?? []).filter((c) => c.id !== draggedCat.id);
        for (let i = 0; i < sourceCats.length; i++) {
          if (sourceCats[i].sort_order !== i) {
            updates.push({ id: sourceCats[i].id, column_id: sourceColumnId, sort_order: i });
          }
        }
      }

      // Optimistic UI update
      setCategories((prev) => prev.map((c) => {
        const u = updates.find((up) => up.id === c.id);
        return u ? { ...c, column_id: u.column_id, sort_order: u.sort_order } : c;
      }));

      // Parallel DB updates
      await Promise.all(
        updates.map((u) =>
          supabase
            .from('categories')
            .update({ column_id: u.column_id, sort_order: u.sort_order, updated_at: now })
            .eq('id', u.id)
        )
      );
    },
    [categories, boardColumns, categoriesByColumn, setCategories]
  );

  const handleSignOut = () => supabase.auth.signOut();

  const openBookmark = (url: string) => {
    openLink(url, settings.openLinkIn === 'current_tab');
  };

  const handleExportHtml = async () => {
    if (!user?.id) return;
    try {
      const { data: boardsData } = await supabase.from('boards').select('*').eq('user_id', user.id).order('sort_order');
      const brds = (boardsData ?? []) as Board[];
      const boardIds = brds.map((x) => x.id);
      if (boardIds.length === 0) {
        downloadHtml(buildBookmarksHtml([], []));
        return;
      }
      const { data: cats } = await supabase.from('categories').select('*').in('board_id', boardIds).order('sort_order');
      const catsList = (cats ?? []) as Category[];
      const catIds = catsList.map((c) => c.id);
      const { data: bms } = await supabase.from('bookmarks').select('*').in('category_id', catIds.length ? catIds : ['']).order('sort_order');
      const bookmarksList = (bms ?? []) as Bookmark[];
      const categoriesWithBookmarks = catsList.map((cat) => ({ category: cat, bookmarks: bookmarksList.filter((b) => b.category_id === cat.id) }));
      const html = buildBookmarksHtml(brds, categoriesWithBookmarks);
      downloadHtml(html);
    } catch (e) {
      console.error('Export failed', e);
    }
  };

  const handleImportFile = (file: File) => {
    setImportLoading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = reader.result as string;
        if (file.name.endsWith('.json')) {
          try {
            const data = JSON.parse(text);
            console.log('Import JSON (parse only, chưa ghi Supabase):', data);
            setToast({ message: getT(settings.locale).importJsonNotSupported, type: 'info' });
          } catch {
            setToast({ message: getT(settings.locale).importJsonInvalid, type: 'error' });
          }
          setImportLoading(false);
          return;
        }
        // Import HTML (Netscape Bookmark format)
        if (!user?.id) {
          setToast({ message: getT(settings.locale).importLoginRequired, type: 'error' });
          setImportLoading(false);
          return;
        }
        const parsed = parseNetscapeBookmarksHtml(text);
        if (parsed.length === 0) {
          setToast({ message: getT(settings.locale).importHtmlEmpty, type: 'error' });
          setImportLoading(false);
          return;
        }
        let boardOrder = boards.length === 0 ? 0 : Math.max(...boards.map((b) => b.sort_order), 0);
        for (const board of parsed) {
          const { data: newBoard, error: boardErr } = await supabase
            .from('boards')
            .insert({
              user_id: user.id,
              name: board.name || 'Imported',
              sort_order: ++boardOrder,
            })
            .select('id')
            .single();
          if (boardErr || !newBoard) {
            console.error('Import board failed', boardErr);
            continue;
          }
          let categoryOrder = 0;
          for (const cat of board.categories) {
            const { data: newCat, error: catErr } = await supabase
              .from('categories')
              .insert({
                board_id: newBoard.id,
                name: cat.name || 'Uncategorized',
                sort_order: categoryOrder++,
              })
              .select('id')
              .single();
            if (catErr || !newCat) continue;
            let bookmarkOrder = 0;
            for (const bm of cat.bookmarks) {
              await supabase.from('bookmarks').insert({
                category_id: newCat.id,
                url: bm.url,
                title: bm.title || bm.url,
                sort_order: bookmarkOrder++,
              });
            }
          }
        }
        await refetchBoards();
        if (selectedBoardId) await refetchCategories();
        const totalCats = parsed.reduce((s, b) => s + b.categories.length, 0);
        const totalBms = parsed.reduce((s, b) => s + b.categories.reduce((t, c) => t + c.bookmarks.length, 0), 0);
        const tMsg = getT(settings.locale).importSuccessFormat;
        setToast({
          message: tMsg.replace('{0}', String(parsed.length)).replace('{1}', String(totalCats)).replace('{2}', String(totalBms)),
          type: 'success',
        });
      } catch (e) {
        console.error('Import HTML failed', e);
        setToast({ message: getT(settings.locale).importHtmlFailed, type: 'error' });
      } finally {
        setImportLoading(false);
      }
    };
    reader.onerror = () => {
      setToast({ message: getT(settings.locale).importHtmlFailed, type: 'error' });
      setImportLoading(false);
    };
    reader.readAsText(file);
  };

  const handleSaveBoard = async (name: string, id?: string, categoryColumns?: number | null) => {
    if (!user?.id) return;
    if (id) {
      await supabase
        .from('boards')
        .update({
          name,
          category_columns: categoryColumns ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    } else {
      const maxOrder = boards.length === 0 ? 0 : Math.max(...boards.map((b) => b.sort_order), 0);
      const { data: newBoard, error: insertErr } = await supabase
        .from('boards')
        .insert({
          user_id: user.id,
          name,
          sort_order: maxOrder + 1,
          category_columns: categoryColumns ?? null,
        })
        .select('id')
        .single();
      if (!insertErr && newBoard?.id) {
        const numCols = categoryColumns ?? settings.categoryColumns;
        for (let i = 0; i < numCols; i++) {
          await supabase.from('board_columns').insert({
            board_id: newBoard.id,
            name: `Column ${i + 1}`,
            sort_order: i,
          });
        }
      }
    }
    await refetchBoards();
    setBoardModalOpen(false);
    setBoardEditing(null);
  };

  const handleDeleteBoard = (board: Board) => {
    setConfirmDialog({
      open: true,
      title: 'Xóa Board',
      message: `Bạn có chắc muốn xóa board "${board.name}"? Toàn bộ category và bookmark trong board sẽ bị xóa.`,
      onConfirm: async () => {
        await supabase.from('boards').delete().eq('id', board.id);
        if (selectedBoardId === board.id) setSelectedBoardId(boards.find((b) => b.id !== board.id)?.id ?? null);
        await refetchBoards();
        setConfirmDialog((d) => ({ ...d, open: false }));
      },
    });
  };

  const handleDuplicateBoard = async (board: Board) => {
    if (!user?.id) return;
    const maxOrder = boards.length === 0 ? 0 : Math.max(...boards.map((b) => b.sort_order), 0);
    const { data: newBoardRow, error: boardErr } = await supabase
      .from('boards')
      .insert({ user_id: user.id, name: `${board.name} (bản sao)`, sort_order: maxOrder + 1, category_columns: board.category_columns })
      .select('id')
      .single();
    if (boardErr || !newBoardRow) return;

    const { data: sourceCols } = await supabase
      .from('board_columns')
      .select('*')
      .eq('board_id', board.id)
      .order('sort_order', { ascending: true });
    const colIdMap = new Map<string, string>();
    for (const col of sourceCols ?? []) {
      const { data: newCol } = await supabase
        .from('board_columns')
        .insert({ board_id: newBoardRow.id, name: col.name, sort_order: col.sort_order })
        .select('id')
        .single();
      if (newCol) colIdMap.set(col.id, newCol.id);
    }

    const { data: sourceCats } = await supabase
      .from('categories')
      .select('*, bookmarks(*)')
      .eq('board_id', board.id)
      .order('sort_order', { ascending: true });
    for (const cat of sourceCats ?? []) {
      const bookmarks = (cat as { bookmarks?: Bookmark[] }).bookmarks ?? [];
      const newColId = cat.column_id ? (colIdMap.get(cat.column_id) ?? null) : (colIdMap.values().next().value ?? null);
      const { data: newCatRow } = await supabase
        .from('categories')
        .insert({
          board_id: newBoardRow.id,
          column_id: newColId,
          name: cat.name,
          color: cat.color ?? undefined,
          icon: cat.icon ?? undefined,
          sort_order: cat.sort_order,
        })
        .select('id')
        .single();
      if (newCatRow) {
        for (const b of bookmarks) {
          await supabase.from('bookmarks').insert({
            category_id: newCatRow.id,
            url: b.url,
            title: b.title,
            description: b.description ?? null,
            tags: b.tags ?? undefined,
            sort_order: b.sort_order,
          });
        }
      }
    }
    await refetchBoards();
    await refetchCategories();
    setBoardMenuId(null);
  };

  const handleSaveCategory = async (name: string, color: string | null, id?: string) => {
    if (!selectedBoardId) return;
    const firstColId = boardColumns[0]?.id ?? null;
    if (id) {
      await supabase
        .from('categories')
        .update({
          name,
          color: color ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    } else {
      const colCats = firstColId ? (categoriesByColumn.get(firstColId) ?? []) : [];
      const maxOrder = colCats.length === 0 ? 0 : Math.max(...colCats.map((c) => c.sort_order), -1) + 1;
      await supabase.from('categories').insert({
        board_id: selectedBoardId,
        column_id: firstColId,
        name,
        color: color ?? null,
        sort_order: maxOrder,
      });
    }
    await refetchCategories();
    setCategoryModalOpen(false);
    setCategoryEditing(null);
  };

  const handleMoveCategoryToBoard = async (categoryId: string, targetBoardId: string) => {
    const { data: targetCols } = await supabase
      .from('board_columns')
      .select('id')
      .eq('board_id', targetBoardId)
      .order('sort_order', { ascending: false })
      .limit(1);
    const targetLastColId = targetCols?.[0]?.id ?? null;

    const { data: colCategories } = await supabase
      .from('categories')
      .select('sort_order')
      .eq('board_id', targetBoardId)
      .eq('column_id', targetLastColId!)
      .order('sort_order', { ascending: false })
      .limit(1);
    const maxOrder = colCategories?.[0]?.sort_order ?? -1;
    const { error } = await supabase
      .from('categories')
      .update({
        board_id: targetBoardId,
        column_id: targetLastColId,
        sort_order: maxOrder + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', categoryId);
    if (error) {
      setToast({ message: settings.locale === 'vi' ? 'Lỗi di chuyển category' : 'Failed to move category', type: 'error' });
      return;
    }
    await refetchCategories();
    setCategoryModalOpen(false);
    setCategoryEditing(null);
  };

  const handleDeleteCategory = (category: Category) => {
    setConfirmDialog({
      open: true,
      title: 'Xóa Category',
      message: `Xóa category "${category.name}" và toàn bộ bookmark bên trong?`,
      onConfirm: async () => {
        await supabase.from('categories').delete().eq('id', category.id);
        await refetchCategories();
        setConfirmDialog((d) => ({ ...d, open: false }));
      },
    });
  };

  const handleDuplicateCategory = async (category: Category & { bookmarks?: Bookmark[] }) => {
    if (!selectedBoardId) return;
    const colId = category.column_id ?? boardColumns[0]?.id ?? null;
    const colCats = colId ? (categoriesByColumn.get(colId) ?? []) : categories;
    const maxOrder = colCats.length === 0 ? 0 : Math.max(...colCats.map((c) => c.sort_order), 0) + 1;
    const { data: newCatRow } = await supabase
      .from('categories')
      .insert({
        board_id: selectedBoardId,
        column_id: colId,
        name: `${category.name} (bản sao)`,
        color: category.color ?? undefined,
        icon: category.icon ?? undefined,
        sort_order: maxOrder,
      })
      .select('id')
      .single();
    if (!newCatRow) return;
    const bookmarks = category.bookmarks ?? [];
    for (const b of bookmarks) {
      await supabase.from('bookmarks').insert({
        category_id: newCatRow.id,
        url: b.url,
        title: b.title,
        description: b.description ?? null,
        tags: b.tags ?? undefined,
        sort_order: b.sort_order,
      });
    }
    await refetchCategories();
    setCategoryMenuId(null);
  };

  const handleSaveBookmark = async (
    data: { url: string; title: string; description: string; category_id: string },
    id?: string
  ) => {
    if (id) {
      await supabase
        .from('bookmarks')
        .update({
          url: data.url,
          title: data.title,
          description: data.description || null,
          category_id: data.category_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    } else {
      const cat = categories.find((c) => c.id === data.category_id);
      const maxOrder = cat?.bookmarks?.length ? Math.max(...cat.bookmarks.map((b) => b.sort_order), 0) + 1 : 0;
      await supabase.from('bookmarks').insert({
        category_id: data.category_id,
        url: data.url,
        title: data.title,
        description: data.description || null,
        sort_order: maxOrder,
      });
    }
    await refetchCategories();
    setBookmarkModalOpen(false);
    setBookmarkEditing(null);
    setAddBookmarkCategoryId(null);
  };

  const handleDeleteBookmark = (bookmark: Bookmark) => {
    setConfirmDialog({
      open: true,
      title: 'Xóa Bookmark',
      message: `Xóa "${bookmark.title || bookmark.url}"?`,
      onConfirm: async () => {
        await supabase.from('bookmarks').delete().eq('id', bookmark.id);
        await refetchCategories();
        setConfirmDialog((d) => ({ ...d, open: false }));
      },
    });
  };

  const handleDuplicateBookmark = async (bookmark: Bookmark) => {
    const cat = categories.find((c) => c.id === bookmark.category_id);
    const maxOrder = cat?.bookmarks?.length ? Math.max(...cat.bookmarks.map((b) => b.sort_order), 0) + 1 : 0;
    await supabase.from('bookmarks').insert({
      category_id: bookmark.category_id,
      url: bookmark.url,
      title: bookmark.title,
      description: bookmark.description ?? null,
      tags: bookmark.tags ?? undefined,
      sort_order: maxOrder,
    });
    await refetchCategories();
  };

  const handleMoveBookmark = async (bookmark: Bookmark, targetCategoryId: string, targetBoardId?: string) => {
    if (bookmark.category_id === targetCategoryId) return;
    let maxOrder = 0;
    const targetCat = categories.find((c) => c.id === targetCategoryId);
    if (targetCat?.bookmarks?.length) {
      maxOrder = Math.max(...targetCat.bookmarks.map((b) => b.sort_order), 0) + 1;
    } else {
      const { data: existing } = await supabase
        .from('bookmarks')
        .select('sort_order')
        .eq('category_id', targetCategoryId)
        .order('sort_order', { ascending: false })
        .limit(1);
      maxOrder = (existing?.[0]?.sort_order ?? -1) + 1;
    }
    const { data: updated, error } = await supabase
      .from('bookmarks')
      .update({ category_id: targetCategoryId, sort_order: maxOrder, updated_at: new Date().toISOString() })
      .eq('id', bookmark.id)
      .select();
    if (error || !updated?.length) {
      setToast({ message: settings.locale === 'vi' ? 'Lỗi di chuyển bookmark' : 'Failed to move bookmark', type: 'error' });
      return;
    }
    setBookmarkToMove(null);
    if (targetBoardId && targetBoardId !== selectedBoardId) {
      setSelectedBoardId(targetBoardId);
    } else {
      await refetchCategories();
    }
  };

  const openAddBookmark = (defaultCategoryId?: string) => {
    const t = getT(settings.locale);
    if (boards.length === 0) {
      setConfirmDialog({
        open: true,
        title: t.addBookmark,
        message: t.addBookmarkNeedBoard,
        confirmLabel: t.createBoard,
        danger: false,
        onConfirm: () => {
          setConfirmDialog((d) => ({ ...d, open: false }));
          setBoardModalOpen(true);
        },
      });
      return;
    }
    if (categories.length === 0) {
      setConfirmDialog({
        open: true,
        title: t.addBookmark,
        message: t.addBookmarkNeedCategory,
        confirmLabel: t.createCategory,
        danger: false,
        onConfirm: () => {
          setConfirmDialog((d) => ({ ...d, open: false }));
          setCategoryModalOpen(true);
        },
      });
      return;
    }
    setBookmarkEditing(null);
    setAddBookmarkCategoryId(defaultCategoryId ?? null);
    setBookmarkModalOpen(true);
  };

  const handleBoardDragStart = (e: React.DragEvent, boardId: string) => {
    e.dataTransfer.setData('text/plain', boardId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-linkhub-board', boardId);
    e.dataTransfer.dropEffect = 'move';
    setDraggedBoardId(boardId);
  };

  const handleBoardDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropBoardIndex(index);
  };

  const handleBoardDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dragId = e.dataTransfer.getData('application/x-linkhub-board') || e.dataTransfer.getData('text/plain');
    if (!dragId || dropBoardIndex == null) {
      setDraggedBoardId(null);
      setDropBoardIndex(null);
      return;
    }
    const fromIndex = boards.findIndex((b) => b.id === dragId);
    if (fromIndex === -1 || fromIndex === dropBoardIndex) {
      setDraggedBoardId(null);
      setDropBoardIndex(null);
      return;
    }
    const newBoards = [...boards];
    const [removed] = newBoards.splice(fromIndex, 1);
    newBoards.splice(dropBoardIndex, 0, removed);
    setBoards(newBoards);
    setDraggedBoardId(null);
    setDropBoardIndex(null);
    const now = new Date().toISOString();
    (async () => {
      for (let i = 0; i < newBoards.length; i++) {
        await supabase.from('boards').update({ sort_order: i, updated_at: now }).eq('id', newBoards[i].id);
      }
      await refetchBoards();
    })();
  };

  const handleBoardDragEnd = () => {
    setDraggedBoardId(null);
    setDropBoardIndex(null);
  };

  const handleBookmarkDragStart = (e: React.DragEvent, bookmarkId: string, categoryId: string) => {
    e.dataTransfer.setData('application/x-linkhub-bookmark', JSON.stringify({ bookmarkId, categoryId }));
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.dropEffect = 'move';
    setDraggedBookmark({ id: bookmarkId, categoryId });
  };

  const handleBookmarkDragOver = (e: React.DragEvent, bookmarkId: string, categoryId: string, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (draggedBookmark?.categoryId === categoryId) setDropBookmarkTarget({ id: bookmarkId, categoryId, index });
  };

  const handleBookmarkDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const raw = e.dataTransfer.getData('application/x-linkhub-bookmark');
    if (!raw || !dropBookmarkTarget) {
      setDraggedBookmark(null);
      setDropBookmarkTarget(null);
      return;
    }
    let dragData: { bookmarkId: string; categoryId: string };
    try {
      dragData = JSON.parse(raw);
    } catch {
      setDraggedBookmark(null);
      setDropBookmarkTarget(null);
      return;
    }
    if (dragData.categoryId !== dropBookmarkTarget.categoryId) {
      setDraggedBookmark(null);
      setDropBookmarkTarget(null);
      return;
    }
    const cat = categories.find((c) => c.id === dragData.categoryId);
    if (!cat?.bookmarks) {
      setDraggedBookmark(null);
      setDropBookmarkTarget(null);
      return;
    }
    const fromIndex = cat.bookmarks.findIndex((b) => b.id === dragData.bookmarkId);
    const toIndex = dropBookmarkTarget.index;
    if (fromIndex === -1 || fromIndex === toIndex) {
      setDraggedBookmark(null);
      setDropBookmarkTarget(null);
      return;
    }
    const newBookmarks = [...cat.bookmarks];
    const [removed] = newBookmarks.splice(fromIndex, 1);
    newBookmarks.splice(toIndex, 0, removed);
    setCategories(
      categories.map((c) =>
        c.id === dragData.categoryId ? { ...c, bookmarks: newBookmarks } : c
      )
    );
    setDraggedBookmark(null);
    setDropBookmarkTarget(null);
    const now = new Date().toISOString();
    (async () => {
      for (let i = 0; i < newBookmarks.length; i++) {
        await supabase.from('bookmarks').update({ sort_order: i, updated_at: now }).eq('id', newBookmarks[i].id);
      }
      await refetchCategories();
    })();
  };

  const handleBookmarkDragEnd = () => {
    setDraggedBookmark(null);
    setDropBookmarkTarget(null);
  };

  const unsplashEnabled =
    settings.autoBackgroundSource === 'unsplash' &&
    (settings.autoBackgroundScope === 'dashboard' ||
      settings.autoBackgroundScope === 'both');

  const { imageUrl: unsplashImageUrl } = useUnsplashBackground({
    enabled: unsplashEnabled,
    scope: 'dashboard',
    baseQuery: settings.autoBackgroundQuery ?? null,
    timeOfDayMode: settings.autoBackgroundTimeOfDayMode ?? 'off',
    morningQuery: settings.autoBackgroundMorningQuery ?? null,
    noonQuery: settings.autoBackgroundNoonQuery ?? null,
    eveningQuery: settings.autoBackgroundEveningQuery ?? null,
    intervalHours: settings.autoBackgroundIntervalHoursLanding ?? null,
  });

  const dashboardBackgroundImageUrl =
    (unsplashEnabled && unsplashImageUrl) || settings.backgroundImageUrl || null;

  const tDash = getT(settings.locale);
  const dashboardBookmarkTotal = useMemo(() => allBookmarks.length, [allBookmarks]);

  const showCategoryGridSkeleton =
    !!selectedBoardId &&
    !searchTerm.trim() &&
    ((categoriesLoading && categories.length === 0) || (columnsLoading && boardColumns.length === 0));

  return (
    <div
      className="bg-main font-display text-text-primary h-screen overflow-hidden flex relative selection:bg-accent selection:text-white"
      style={
        settings.backgroundMode === 'image' && dashboardBackgroundImageUrl
          ? {
              backgroundImage: `url('${dashboardBackgroundImageUrl}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }
          : undefined
      }
    >
      <div
        className="absolute inset-0 z-0 backdrop-blur-[2px]"
        style={{
          backgroundColor:
            settings.theme === 'light'
              ? `rgba(240, 240, 240, ${(settings.backgroundOverlayOpacity ?? 90) / 100})`
              : `${settings.backgroundColor}${
                  Math.round(((settings.backgroundOverlayOpacity ?? 90) / 100) * 255)
                    .toString(16)
                    .padStart(2, '0')
                }`,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        aria-hidden
        style={{
          background:
            settings.theme === 'light'
              ? 'radial-gradient(ellipse 90% 55% at 50% -5%, rgba(255,255,255,0.5), transparent 52%), radial-gradient(ellipse 65% 45% at 100% 100%, rgba(0,0,0,0.06), transparent)'
              : 'radial-gradient(ellipse 88% 50% at 50% -8%, rgba(129,140,248,0.14), transparent 48%), radial-gradient(ellipse 70% 55% at 100% 100%, rgba(0,0,0,0.42), transparent)',
        }}
      />
      {/* Sidebar */}
      <aside
        className={`border-r border-white/10 flex flex-col z-40 w-64 flex-shrink-0 fixed inset-y-0 left-0 transform transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={
          settings.headerSidebarColorEffect !== false
            ? {
                backgroundColor: 'transparent',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }
            : settings.theme === 'light'
            ? { backgroundColor: '#e5e5e5' }
            : { backgroundColor: '#1E293B' }
        }
      >
        <div className="h-12 flex items-center px-4 border-b border-white/10">
          <div className="flex items-center gap-2 text-accent group cursor-pointer">
            <div className="p-1.5 bg-accent/10 rounded-lg group-hover:bg-accent/20 transition-colors">
              <span className="material-symbols-outlined text-[18px]">hub</span>
            </div>
            <span className="font-semibold text-sm tracking-tight text-white">LinkHub</span>
          </div>
        </div>
        <div className="px-3 pt-2 pb-1 space-y-0.5">
          <button
            type="button"
            onClick={() => setAuthenticatorModalOpen(true)}
            className={`flex items-center gap-2 w-full px-2.5 py-2 text-xs font-medium rounded-lg text-left text-text-secondary border border-transparent transition ${
              settings.theme === 'light' ? 'sidebar-item-hover hover:text-text-primary' : 'hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[18px] text-accent">shield</span>
            <span>{getT(settings.locale).authenticator}</span>
          </button>
          <button
            type="button"
            onClick={() => setItToolboxModalOpen(true)}
            className={`flex items-center gap-2 w-full px-2.5 py-2 text-xs font-medium rounded-lg text-left text-text-secondary border border-transparent transition ${
              settings.theme === 'light' ? 'sidebar-item-hover hover:text-text-primary' : 'hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[18px] text-accent">build</span>
            <span>IT Tool box</span>
          </button>
        </div>
        <div className="px-3 pt-3 pb-1.5 flex items-center justify-between">
          <span className="text-[12px] font-semibold uppercase text-text-muted tracking-wider">Boards</span>
          <button
            type="button"
            onClick={() => { setBoardEditing(null); setBoardModalOpen(true); }}
            className={`p-1 rounded-lg text-text-muted transition ${
              settings.theme === 'light' ? 'sidebar-item-hover hover:text-accent' : 'hover:text-accent hover:bg-white/5'
            }`}
            aria-label="Add board"
          >
            <span className="material-icons-round text-base">add_circle_outline</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-3">
          {boardsLoading && boards.length === 0 && (
            <div className="px-1 py-2 space-y-2" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-9 rounded-lg skeleton-shimmer border border-white/5" />
              ))}
            </div>
          )}
          {/* Boards loading: hiển thị Toast thay vì text inline */}
          {boards.map((board, boardIndex) => (
            <React.Fragment key={board.id}>
              {settings.dragDrop.board && draggedBoardId && dropBoardIndex === boardIndex && (
                <div className="h-1 rounded-full bg-accent shadow-[0_0_10px_rgba(129,140,248,0.7)] transition-all duration-150 mx-1 mb-0.5 flex-shrink-0" aria-hidden />
              )}
              <div
                ref={boardMenuId === board.id ? boardMenuRef : undefined}
                draggable={settings.dragDrop.board}
                onDragStart={(e) => settings.dragDrop.board && handleBoardDragStart(e, board.id)}
                onDragOver={(e) => settings.dragDrop.board && handleBoardDragOver(e, boardIndex)}
                onDrop={settings.dragDrop.board ? handleBoardDrop : undefined}
                onDragEnd={settings.dragDrop.board ? handleBoardDragEnd : undefined}
                className={`relative transition-all duration-150 ${settings.dragDrop.board ? 'cursor-grab active:cursor-grabbing' : ''} ${draggedBoardId === board.id ? 'opacity-40 scale-[0.98]' : ''}`}
              >
              <button
                ref={boardMenuId === board.id ? boardTriggerRef : undefined}
                type="button"
                onClick={() => setSelectedBoardId(board.id)}
                className={`flex items-center justify-between w-full px-2.5 py-2 text-xs font-medium rounded-lg transition text-left ${
                  selectedBoardId === board.id
                    ? 'bg-accent/15 text-accent border border-accent/25 shadow-[0_0_12px_rgba(129,140,248,0.12)]'
                    : 'text-text-secondary hover:bg-white/5 hover:text-white border border-transparent'
                } ${
                  settings.theme === 'light'
                    ? selectedBoardId === board.id
                      ? '!bg-transparent !border-transparent !shadow-none border-l-2 border-l-accent'
                      : 'sidebar-item-hover hover:text-text-primary'
                    : ''
                }`}
              >
                <span className="truncate">{board.name}</span>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setBoardMenuId((id) => (id === board.id ? null : board.id)); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      setBoardMenuId((id) => (id === board.id ? null : board.id));
                    }
                  }}
                  className={`p-1 rounded flex-shrink-0 cursor-pointer ${settings.theme === 'light' ? 'sidebar-item-hover' : 'hover:bg-white/10'}`}
                  aria-label="Menu"
                >
                  <span className="material-icons-round text-[14px] opacity-60">more_horiz</span>
                </div>
              </button>
              {boardMenuId === board.id && (
                <div
                  ref={boardDropdownRef}
                  className={`absolute left-0 right-0 rounded-lg border border-white/10 bg-sidebar shadow-xl py-1 z-50 ${openBoardMenuAbove ? 'bottom-full mb-0.5' : 'top-full mt-0.5'}`}
                >
                  <button
                    type="button"
                    onClick={() => { setBoardEditing(board); setBoardModalOpen(true); setBoardMenuId(null); }}
                    className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left text-xs text-text-secondary hover:bg-white/10 hover:text-white"
                  >
                    <span className="material-icons-round text-[16px]">edit</span>
                    {getT(settings.locale).edit}
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleDuplicateBoard(board); setBoardMenuId(null); }}
                    className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left text-xs text-text-secondary hover:bg-white/10 hover:text-white"
                  >
                    <span className="material-icons-round text-[16px]">content_copy</span>
                    {getT(settings.locale).duplicate}
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleDeleteBoard(board); setBoardMenuId(null); }}
                    className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left text-xs text-red-400 hover:bg-red-500/20"
                  >
                    <span className="material-icons-round text-[16px]">delete</span>
                    {getT(settings.locale).delete}
                  </button>
                </div>
              )}
            </div>
            </React.Fragment>
          ))}
          {!boardsLoading && boards.length === 0 && (
            <div className="mx-1 my-2 rounded-xl border border-dashed border-white/15 bg-white/[0.04] p-4 text-center">
              <span className="material-symbols-outlined text-[36px] text-accent/85 mb-2 block" aria-hidden>
                dashboard_customize
              </span>
              <p className="text-xs font-semibold text-white">{tDash.emptyBoardsTitle}</p>
              <p className="text-[11px] text-text-muted mt-1.5 mb-3 leading-relaxed">{tDash.emptyBoardsBody}</p>
              <button
                type="button"
                onClick={() => {
                  setBoardEditing(null);
                  setBoardModalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent/25 border border-accent/40 text-accent text-xs font-medium px-3 py-2 hover:bg-accent/35 transition"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                {tDash.emptyBoardsCta}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <main
        className={`flex-1 flex flex-col min-w-0 bg-cover bg-center relative z-10 transition-[margin] duration-200 ${
          sidebarOpen ? 'md:ml-64' : 'md:ml-0'
        }`}
      >
        <header
          className="h-12 relative z-[100] flex items-center justify-between px-3 md:px-4 border-b border-white/10"
          style={
            settings.headerSidebarColorEffect !== false
              ? {
                  backgroundColor: 'transparent',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                }
              : settings.theme === 'light'
              ? { backgroundColor: '#e5e5e5' }
              : { backgroundColor: '#1E293B' }
          }
        >
          <div className="flex items-center flex-1 max-w-md">
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              className="mr-2 p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 md:mr-3"
              aria-label="Toggle sidebar"
            >
              <span className="material-icons-round text-[20px]">
                {sidebarOpen ? 'menu_open' : 'menu'}
              </span>
            </button>
            <div className="relative flex-1 group">
              <span className="material-symbols-outlined text-text-muted absolute left-3 top-1/2 -translate-y-1/2 text-[18px] transition-colors group-focus-within:text-accent">search</span>
              <input
                ref={searchInputRef}
                type="text"
                placeholder={getT(settings.locale).searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white/5 border border-white/10 text-xs text-white placeholder-text-muted focus:ring-2 focus:ring-accent/40 focus:border-accent/40 block w-full pl-9 pr-3 py-1.5 rounded-lg transition-all"
              />
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-1.5 mx-1 text-[10px] tabular-nums flex-shrink-0">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/90">
              <span className="material-symbols-outlined text-[14px] text-accent/90">view_kanban</span>
              <span className="font-semibold text-white">{boards.length}</span>
              <span className="text-text-muted font-normal">{tDash.dashboardStatBoards}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/90">
              <span className="material-symbols-outlined text-[14px] text-accent/90">bookmark</span>
              <span className="font-semibold text-white">{dashboardBookmarkTotal}</span>
              <span className="text-text-muted font-normal">{tDash.dashboardStatBookmarks}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 ml-2 md:ml-4">
            <button
              type="button"
              onClick={() => (window.location.hash = '#/landing')}
              className="hidden sm:inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-100 hover:bg-white/10"
            >
              <span className="material-symbols-outlined text-[14px]">home</span>
              <span>{getT(settings.locale).landingGoBackToLanding}</span>
              <span className="ml-1 rounded border border-white/20 px-1 py-0.5 text-[9px] font-medium opacity-60">{navigator.platform?.toUpperCase().includes('MAC') ? '⌘+B' : 'Ctrl+B'}</span>
            </button>
            <div className="relative flex items-center gap-1.5" ref={userMenuRef}>
              <button
                ref={userTriggerRef}
                type="button"
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-lg transition bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10"
              >
                <div className="h-7 w-7 rounded-full bg-accent/20 flex items-center justify-center text-accent font-semibold text-xs ring-1 ring-white/10">
                  {user?.email?.slice(0, 1).toUpperCase() ?? '?'}
                </div>
                <div className="flex flex-col items-start max-w-[120px]">
                  <span className="text-xs font-medium text-white leading-tight truncate w-full">
                    {user?.user_metadata?.full_name ?? user?.email ?? 'User'}
                  </span>
                  <span className="text-[11px] text-text-muted leading-tight">Member</span>
                </div>
                <span className={`material-icons-round text-text-muted text-lg transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}>expand_more</span>
              </button>
              {userMenuOpen && (
                <div
                  ref={userDropdownRef}
                  className={`absolute right-0 w-48 rounded-lg border border-white/10 bg-sidebar shadow-xl shadow-black/40 py-1 z-[110] overflow-hidden ${openUserMenuAbove ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}
                >
                  <div className="px-3 py-2 border-b border-white/10">
                    <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider">{getT(settings.locale).signedInAs}</p>
                    <p className="text-xs font-medium text-white truncate mt-0.5">{user?.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSettingsModalOpen(true); setUserMenuOpen(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left text-xs text-text-secondary hover:bg-white/10 hover:text-white transition"
                  >
                    <span className="material-symbols-outlined text-base text-accent">settings</span>
                    {getT(settings.locale).settings}
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleSignOut(); setUserMenuOpen(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left text-xs text-text-secondary hover:bg-red-500/20 hover:text-red-400 transition"
                  >
                  <span className="material-symbols-outlined text-base">logout</span>
                    {getT(settings.locale).logOut}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="px-4 py-3 z-10 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => { setCategoryEditing(null); setCategoryModalOpen(true); }}
              disabled={!selectedBoardId || boards.length === 0}
              title={boards.length === 0 ? getT(settings.locale).createBoardFirst : undefined}
              className="glass-panel text-white hover:bg-accent hover:border-accent text-xs font-medium px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              {getT(settings.locale).createCategory}
            </button>
            <button
              type="button"
              onClick={() => openAddBookmark()}
              className="glass-panel text-text-secondary hover:text-white hover:bg-white/10 text-xs font-medium px-3 py-2 rounded-lg transition flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">link</span>
              {getT(settings.locale).addBookmark}
            </button>
          </div>
          <div className="relative min-w-[200px] max-md:hidden">
            <button
              type="button"
              ref={columnConfigTriggerRef}
              onClick={() => setColumnConfigPopupOpen((o) => !o)}
              disabled={!selectedBoardId}
              title={!selectedBoardId ? getT(settings.locale).createBoardFirst : undefined}
              className="w-full glass-panel text-left text-text-secondary hover:text-white hover:bg-white/10 text-xs font-medium py-2.5 px-3 rounded-lg border border-white/10 transition flex items-center justify-between gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-white/80">view_column</span>
                <span>{getT(settings.locale).boardOptions}</span>
              </span>
              <span className="material-icons-round text-[18px] text-white/60 flex-shrink-0">
                {columnConfigPopupOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>
            {columnConfigPopupOpen && columnConfigPopupRect &&
              createPortal(
                <div
                  ref={columnConfigPopupRef}
                  role="dialog"
                  aria-label="Board Options"
                  style={{
                    position: 'fixed',
                    top: columnConfigPopupRect.top,
                    left: Math.max(8, columnConfigPopupRect.left),
                    zIndex: 10000,
                  }}
                  className="w-[260px] rounded-lg border border-white/10 bg-sidebar shadow-xl shadow-black/40 py-3 px-4"
                >
                  <p className="text-xs font-medium text-text-secondary mb-2">
                    {getT(settings.locale).categoryColumns}
                    <span className="tabular-nums text-accent font-semibold ml-1">({numColumnsPreferred})</span>
                  </p>
                  <div className="flex items-center gap-2 mb-4">
                    <button
                      type="button"
                      disabled={!selectedBoardId || numColumnsPreferred <= 2}
                      onClick={async () => {
                        if (!selectedBoardId || numColumnsPreferred <= 2) return;
                        const v = (numColumnsPreferred - 1) as 2 | 3 | 4 | 5 | 6;
                        setBoards((prev) =>
                          prev.map((b) =>
                            b.id === selectedBoardId ? { ...b, category_columns: v } : b
                          )
                        );
                        const { error } = await supabase
                          .from('boards')
                          .update({ category_columns: v, updated_at: new Date().toISOString() })
                          .eq('id', selectedBoardId);
                        if (error) {
                          await refetchBoards();
                          setToast({ message: getT(settings.locale).boardUpdateFailed, type: 'error' });
                        } else {
                          await refetchBoards();
                        }
                      }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-white/10 hover:bg-accent/30 border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
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
                      disabled={!selectedBoardId}
                      onChange={async (e) => {
                        const v = Number(e.target.value) as 2 | 3 | 4 | 5 | 6;
                        if (!selectedBoardId) return;
                        setBoards((prev) =>
                          prev.map((b) =>
                            b.id === selectedBoardId ? { ...b, category_columns: v } : b
                          )
                        );
                        const { error } = await supabase
                          .from('boards')
                          .update({ category_columns: v, updated_at: new Date().toISOString() })
                          .eq('id', selectedBoardId);
                        if (error) {
                          await refetchBoards();
                          setToast({ message: getT(settings.locale).boardUpdateFailed, type: 'error' });
                        } else {
                          await refetchBoards();
                        }
                      }}
                      className="flex-1 h-2.5 rounded-full appearance-none bg-white/10 accent-accent cursor-pointer disabled:opacity-50 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:border-0"
                    />
                    <button
                      type="button"
                      disabled={!selectedBoardId || numColumnsPreferred >= 6}
                      onClick={async () => {
                        if (!selectedBoardId || numColumnsPreferred >= 6) return;
                        const v = (numColumnsPreferred + 1) as 2 | 3 | 4 | 5 | 6;
                        setBoards((prev) =>
                          prev.map((b) =>
                            b.id === selectedBoardId ? { ...b, category_columns: v } : b
                          )
                        );
                        const { error } = await supabase
                          .from('boards')
                          .update({ category_columns: v, updated_at: new Date().toISOString() })
                          .eq('id', selectedBoardId);
                        if (error) {
                          await refetchBoards();
                          setToast({ message: getT(settings.locale).boardUpdateFailed, type: 'error' });
                        } else {
                          await refetchBoards();
                        }
                      }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-white/10 hover:bg-accent/30 border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                      aria-label="+"
                    >
                      <span className="material-icons-round text-[18px]">add</span>
                    </button>
                  </div>
                  <div className="border-t border-white/10 pt-3">
                    <p className="text-xs font-medium text-text-secondary mb-2">
                      {getT(settings.locale).categorySortOrder}
                    </p>
                    <div className="flex flex-col gap-1">
                      {(
                        [
                          ['created_asc', getT(settings.locale).categorySortCreatedAsc],
                          ['created_desc', getT(settings.locale).categorySortCreatedDesc],
                          ['name_asc', getT(settings.locale).categorySortNameAsc],
                          ['name_desc', getT(settings.locale).categorySortNameDesc],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          disabled={!selectedBoardId}
                          onClick={async () => {
                            if (!selectedBoardId) return;
                            const v = value as CategorySortOrder;
                            setBoards((prev) =>
                              prev.map((b) =>
                                b.id === selectedBoardId ? { ...b, category_sort_order: v } : b
                              )
                            );
                            const { error } = await supabase
                              .from('boards')
                              .update({
                                category_sort_order: v,
                                updated_at: new Date().toISOString(),
                              })
                              .eq('id', selectedBoardId);
                            if (error) {
                              await refetchBoards();
                              setToast({ message: getT(settings.locale).boardUpdateFailed, type: 'error' });
                            } else {
                              await refetchBoards();
                            }
                          }}
                          className={`w-full text-left py-1.5 px-2 rounded-md text-xs transition cursor-pointer ${
                            effectiveSortOrder === value
                              ? 'bg-accent/20 text-accent font-medium'
                              : 'text-text-secondary hover:bg-white/10 hover:text-white'
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

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-6 z-10 min-w-0">
          {boardsError && (
            <p className="text-red-400 text-xs py-3">{boardsError.message}</p>
          )}
          {searchTerm && (
            <div className="py-3">
              {/* Global search loading: dùng Toast thay vì text inline */}
              {!searchDataLoading && globalSearchResults && (
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-text-muted tracking-wider mb-1">
                      {tDash.searchGlobalBoards}
                    </p>
                    {globalSearchResults.boardMatches.length === 0 ? (
                      <p className="text-xs text-text-muted/70">{tDash.searchGlobalNoBoard}</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {globalSearchResults.boardMatches.map((b) => (
                          <li key={b.id}>
                            <button
                              type="button"
                              onClick={() => { setSelectedBoardId(b.id); setSearchQuery(''); }}
                              className="w-full text-left px-3 py-1.5 rounded-lg bg-white/5 hover:bg-accent/20 text-xs text-white/90 transition flex items-center justify-between"
                            >
                              <span className="truncate">{b.name}</span>
                              <span className="text-[11px] text-text-muted ml-2">{tDash.searchGlobalBoards}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-text-muted tracking-wider mb-1">
                      {tDash.searchGlobalCategories}
                      {selectedBoardId && boards.find((b) => b.id === selectedBoardId)?.name ? (
                        <span className="font-normal text-text-muted normal-case ml-1">
                          · {boards.find((b) => b.id === selectedBoardId)?.name}
                        </span>
                      ) : null}
                    </p>
                    {globalSearchResults.categoryMatches.length === 0 ? (
                      <p className="text-xs text-text-muted/70">{tDash.searchGlobalNoCategory}</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {globalSearchResults.categoryMatches.map((c) => {
                          const board = boards.find((b) => b.id === c.board_id);
                          return (
                            <li key={c.id}>
                              <button
                                type="button"
                                onClick={() => { setSelectedBoardId(c.board_id); setSearchQuery(''); }}
                                className="w-full text-left px-3 py-1.5 rounded-lg bg-white/5 hover:bg-accent/20 text-xs text-white/90 transition flex items-center justify-between"
                              >
                                <span className="truncate">{c.name}</span>
                                <span className="text-[11px] text-text-muted ml-2 truncate max-w-[160px]">
                                  {board?.name ?? tDash.searchGlobalBoards}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-text-muted tracking-wider mb-1">
                      {tDash.searchGlobalBookmarks}
                    </p>
                    {globalSearchResults.bookmarkMatches.length === 0 ? (
                      <p className="text-xs text-text-muted/70">{tDash.searchGlobalNoBookmark}</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {globalSearchResults.bookmarkMatches.map((bm) => {
                          const cat = allCategories.find((c) => c.id === bm.category_id);
                          const board = cat ? boards.find((b) => b.id === cat.board_id) : undefined;
                          return (
                            <li key={bm.id}>
                              <button
                                type="button"
                                onClick={() => openBookmark(bm.url)}
                                className="w-full text-left px-3 py-1.5 rounded-lg bg-white/5 hover:bg-accent/20 text-xs text-white/90 transition flex flex-col items-start"
                              >
                                <span className="truncate">{bm.title || bm.url}</span>
                                <span className="text-[11px] text-text-muted truncate max-w-full mt-0.5">
                                  {board?.name ? `${board.name} • ` : ''}
                                  {cat?.name ?? ''}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {!searchTerm && (
            <>
              {selectedBoardId && categories.length === 0 && !categoriesLoading && !columnsLoading && (
                <div className="max-w-md mx-auto my-6 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-8 text-center">
                  <span className="material-symbols-outlined text-[40px] text-accent/80 mb-3 block" aria-hidden>
                    folder_special
                  </span>
                  <p className="text-sm font-semibold text-white">{tDash.emptyCategoriesTitle}</p>
                  <p className="text-xs text-text-muted mt-2 mb-4 leading-relaxed">{tDash.emptyCategoriesBody}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryEditing(null);
                      setCategoryModalOpen(true);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent/25 border border-accent/40 text-accent text-xs font-medium px-4 py-2 hover:bg-accent/35 transition"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    {tDash.emptyCategoriesCta}
                  </button>
                </div>
              )}
              {showCategoryGridSkeleton ? (
                <CategoryGridSkeleton numCols={numColumnsPreferred} />
              ) : boardColumns.length > 0 ? (
                <DndContext
                  sensors={categoryGridSensors}
                  collisionDetection={categoryCollisionDetection}
                  onDragStart={(e: DragStartEvent) => {
                    const cat = categories.find((c) => c.id === e.active.id);
                    if (cat) setActiveDragCategory(cat as Category & { bookmarks: Bookmark[] });
                    lastCategoryOverRef.current = null;
                    setDropIndicator(null);
                    setColumnDropIndicator(null);
                  }}
                  onDragOver={(e: DragOverEvent) => {
                    if (e.over) lastCategoryOverRef.current = e.over;
                    if (!e.over) {
                      setDropIndicator((p) => (p === null ? p : null));
                      setColumnDropIndicator((p) => (p === null ? p : null));
                      return;
                    }
                    const overId = String(e.over.id);
                    const pointerY = (e.activatorEvent as PointerEvent).clientY + e.delta.y;
                    if (overId.startsWith(COLUMN_DROP_PREFIX)) {
                      const columnId = overId.slice(COLUMN_DROP_PREFIX.length);
                      const insertAtStart = pointerY < e.over.rect.top + e.over.rect.height / 2;
                      setColumnDropIndicator((p) =>
                        p?.columnId === columnId && p.insertAtStart === insertAtStart ? p : { columnId, insertAtStart }
                      );
                      setDropIndicator((p) => (p === null ? p : null));
                    } else {
                      const insertAbove = pointerY < e.over.rect.top + e.over.rect.height / 2;
                      setDropIndicator((p) =>
                        p?.overId === overId && p.insertAbove === insertAbove ? p : { overId, insertAbove }
                      );
                      setColumnDropIndicator((p) => (p === null ? p : null));
                    }
                  }}
                  onDragEnd={(e: DragEndEvent) => {
                    const over = e.over ?? lastCategoryOverRef.current;
                    lastCategoryOverRef.current = null;
                    handleCategoryDragEnd({ ...e, over });
                    setDropIndicator(null);
                    setColumnDropIndicator(null);
                    setActiveDragCategory(null);
                  }}
                >
                  <div className={`category-grid ${categoryGridColsClass(numColumnsPreferred)}`}>
                        {boardColumns.map((col) => {
                          const colCats = categoriesByColumn.get(col.id) ?? [];
                          const showLineAtTop = false;
                          const showLineAtBottom = false;
                          return (
                            <ColumnDroppable key={col.id} columnId={col.id} className="category-grid-item" isEmpty={colCats.length === 0}>
                              <SortableContext
                                items={colCats.map((c) => c.id)}
                                strategy={verticalListSortingStrategy}
                                disabled={!settings.dragDrop.category}
                              >
                                <div className="space-y-3">
                                  {showLineAtTop && (
                                    <div className={DROP_INDICATOR_BLOCK_CLASS} style={{ marginBottom: 4 }} aria-hidden />
                                  )}
                                  {colCats.map((cat, idx) => {
                                    const dotIdx = idx % FALLBACK_DOT_COLORS.length;
                                    return (
                                      <SortableCategoryCard
                                        key={cat.id}
                                        category={cat}
                                        activeCategoryId={activeCategoryId}
                                        dropIndicator={dropIndicator}
                                        fallbackDotColor={FALLBACK_DOT_COLORS[dotIdx]}
                                    searchQuery={searchQuery}
                                    onOpenBookmark={openBookmark}
                                    cardHeight={settings.categoryCardHeight}
                                    fillContent={settings.categoryColorFillContent}
                                    categoryMenuId={categoryMenuId}
                                    onOpenCategoryMenu={(id) =>
                                      setCategoryMenuId((cur) => (cur === id ? null : id))
                                    }
                                    onEditCategory={() => {
                                      setCategoryEditing(cat);
                                      setCategoryMoveMode(false);
                                      setCategoryModalOpen(true);
                                      setCategoryMenuId(null);
                                    }}
                                    onMoveCategory={
                                      boards.filter((b) => b.id !== cat.board_id).length > 0
                                        ? () => {
                                            setCategoryEditing(cat);
                                            setCategoryMoveMode(true);
                                            setCategoryModalOpen(true);
                                            setCategoryMenuId(null);
                                          }
                                        : undefined
                                    }
                                    onDuplicateCategory={() => {
                                      handleDuplicateCategory(cat);
                                      setCategoryMenuId(null);
                                    }}
                                    onDeleteCategory={() => {
                                      handleDeleteCategory(cat);
                                      setCategoryMenuId(null);
                                    }}
                                    onAddBookmark={() => {
                                      openAddBookmark(cat.id);
                                      setCategoryMenuId(null);
                                    }}
                                    onEditBookmark={(b) => {
                                      setBookmarkEditing(b);
                                      setBookmarkModalOpen(true);
                                      setCategoryMenuId(null);
                                    }}
                                    onDuplicateBookmark={handleDuplicateBookmark}
                                    onMoveBookmark={(b) => setBookmarkToMove(b)}
                                    onDeleteBookmark={handleDeleteBookmark}
                                    dragDropBookmark={settings.dragDrop.bookmark}
                                    draggedBookmark={draggedBookmark}
                                    dropBookmarkTarget={dropBookmarkTarget}
                                    onBookmarkDragStart={(e, bookmarkId) =>
                                      handleBookmarkDragStart(e, bookmarkId, cat.id)
                                    }
                                    onBookmarkDragOver={(e, bookmarkId, index) =>
                                      handleBookmarkDragOver(e, bookmarkId, cat.id, index)
                                    }
                                    onBookmarkDrop={handleBookmarkDrop}
                                    onBookmarkDragEnd={handleBookmarkDragEnd}
                                    disabled={!settings.dragDrop.category}
                                  />
                                );
                              })}
                                  {showLineAtBottom && (
                                    <div className={DROP_INDICATOR_BLOCK_CLASS} style={{ marginTop: 4 }} aria-hidden />
                                  )}
                            </div>
                          </SortableContext>
                        </ColumnDroppable>
                      );
                    })}
                  </div>
                  <DragOverlay dropAnimation={{ duration: 250, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
                    {activeDragCategory ? (
                      <div className="category-grid-item drag-overlay-card">
                        <CategoryCard
                          category={activeDragCategory}
                          fallbackDotColor={FALLBACK_DOT_COLORS[0]}
                          searchQuery={searchQuery}
                          onOpenBookmark={openBookmark}
                          cardHeight={settings.categoryCardHeight}
                          fillContent={settings.categoryColorFillContent}
                          categoryMenuId={null}
                          onOpenCategoryMenu={() => {}}
                          onEditCategory={() => {}}
                          onDeleteCategory={() => {}}
                          onAddBookmark={() => {}}
                          onEditBookmark={() => {}}
                          onDuplicateBookmark={() => {}}
                          onMoveBookmark={() => {}}
                          onDeleteBookmark={() => {}}
                          dragDropCategory={false}
                          sortableWrapper={false}
                          dragDropBookmark={false}
                          draggedBookmark={null}
                          dropBookmarkTarget={null}
                          onBookmarkDragStart={() => {}}
                          onBookmarkDragOver={() => {}}
                          onBookmarkDrop={() => {}}
                          onBookmarkDragEnd={() => {}}
                        />
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              ) : null}
            </>
          )}
        </div>
      </main>

      <SettingsModal
        open={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        onExportHtml={handleExportHtml}
        onImportFile={handleImportFile}
      />

      <ITToolboxModal open={itToolboxModalOpen} onClose={() => setItToolboxModalOpen(false)} />
      <AuthenticatorModal
        open={authenticatorModalOpen}
        onClose={() => setAuthenticatorModalOpen(false)}
        userId={user?.id}
      />

      <BoardModal
        open={boardModalOpen}
        editBoard={boardEditing}
        defaultCategoryColumns={settings.categoryColumns}
        onClose={() => { setBoardModalOpen(false); setBoardEditing(null); }}
        onSave={handleSaveBoard}
      />

      <CategoryModal
        open={categoryModalOpen}
        boardId={selectedBoardId}
        editCategory={
          categoryEditing
            ? {
                id: categoryEditing.id,
                name: categoryEditing.name,
                color: categoryEditing.color ?? null,
                bg_opacity: categoryEditing.bg_opacity ?? null,
                board_id: categoryEditing.board_id,
              }
            : null
        }
        boards={boards}
        onClose={() => { setCategoryModalOpen(false); setCategoryEditing(null); setCategoryMoveMode(false); }}
        onSave={handleSaveCategory}
        onMoveToBoard={handleMoveCategoryToBoard}
        initialOpenMoveModal={categoryMoveMode}
      />

      <BookmarkModal
        open={bookmarkModalOpen || addModalOpen}
        categories={categories}
        editBookmark={bookmarkEditing}
        initialUrl={initialAddBookmark?.url ?? ''}
        initialTitle={initialAddBookmark?.title ?? ''}
        defaultCategoryId={addBookmarkCategoryId}
        onClose={() => {
          setBookmarkModalOpen(false);
          setAddModalOpen(false);
          setBookmarkEditing(null);
          setAddBookmarkCategoryId(null);
        }}
        onSave={handleSaveBookmark}
      />

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        danger={confirmDialog.danger}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((d) => ({ ...d, open: false }))}
      />

      {importLoading && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-xl bg-sidebar border border-white/10 px-6 py-5 shadow-xl">
            <span className="material-symbols-outlined animate-spin text-[32px] text-accent">progress_activity</span>
            <span className="text-sm font-medium text-white">{getT(settings.locale).importLoading}</span>
          </div>
        </div>
      )}

      <Toast
        message={toast.message}
        type={toast.type}
        open={!!toast.message}
        onClose={() => setToast((p) => ({ ...p, message: '' }))}
      />

      <MoveBookmarkModal
        open={!!bookmarkToMove}
        bookmark={bookmarkToMove}
        boards={boards}
        onClose={() => setBookmarkToMove(null)}
        onMove={(categoryId, boardId) => bookmarkToMove && handleMoveBookmark(bookmarkToMove, categoryId, boardId)}
      />

      <SearchSpotlightModal
        open={spotlightOpen}
        items={spotlightItems}
        onClose={() => setSpotlightOpen(false)}
        onOpen={(url, opts) => {
          if (opts?.newTab) {
            openLink(url, false);
          } else {
            openBookmark(url);
          }
          setSpotlightOpen(false);
        }}
      />
    </div>
  );
}

function MoveBookmarkModal({
  open,
  bookmark,
  boards,
  onClose,
  onMove,
}: {
  open: boolean;
  bookmark: Bookmark | null;
  boards: Board[];
  onClose: () => void;
  onMove: (categoryId: string, boardId: string) => void;
}) {
  const settings = useSettings();
  const t = getT(settings.locale);
  const [allCategories, setAllCategories] = useState<{ id: string; name: string; board_id: string; sort_order: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const boardIds = boards.map((b) => b.id).join(',');

  useEffect(() => {
    if (!open || !bookmark || boards.length === 0) {
      setAllCategories([]);
      setSearchQuery('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const ids = boards.map((b) => b.id);
      const { data } = await supabase
        .from('categories')
        .select('id, name, board_id, sort_order')
        .in('board_id', ids)
        .order('sort_order', { ascending: true });
      if (!cancelled && data) setAllCategories((data ?? []) as { id: string; name: string; board_id: string; sort_order: number }[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, bookmark?.id, boardIds]);

  useEffect(() => {
    if (open) {
      const id = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [open]);

  if (!open) return null;

  const boardOrder = [...boards].sort((a, b) => a.sort_order - b.sort_order);
  const categoriesByBoard = boardOrder.map((board) => ({
    board,
    categories: allCategories.filter((c) => c.board_id === board.id).sort((a, b) => a.sort_order - b.sort_order),
  }));

  const q = searchQuery.trim().toLowerCase();
  const filtered =
    q === ''
      ? categoriesByBoard
      : categoriesByBoard
          .map(({ board, categories }) => {
            const boardMatches = board.name.toLowerCase().includes(q);
            const categoriesFiltered = boardMatches
              ? categories
              : categories.filter((c) => c.name.toLowerCase().includes(q));
            return { board, categories: categoriesFiltered };
          })
          .filter((x) => x.categories.length > 0 || x.board.name.toLowerCase().includes(q));

  const hasResults = filtered.length > 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-sidebar border border-white/10 rounded-xl shadow-xl w-full max-w-[420px] max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 px-3 pt-2.5 pb-2 border-b border-white/10">
          <h3 className="text-sm font-semibold text-white mb-0.5">
            {t.moveBookmarkModalTitle}
          </h3>
          {bookmark && (
            <p className="text-[11px] text-text-muted truncate mb-2">
              {bookmark.title || bookmark.url}
            </p>
          )}
          <div className="relative">
            <span className="material-icons-round absolute left-2 top-1/2 -translate-y-1/2 text-text-muted text-[13px] pointer-events-none">
              search
            </span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.moveBookmarkSearchPlaceholder}
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-white placeholder:text-text-muted focus:ring-2 focus:ring-accent/40 focus:border-accent/40"
            />
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="p-2 pb-2.5">
            {loading ? (
              <p className="text-[11px] text-text-muted py-4 text-center">{t.loadingAuth}</p>
            ) : !hasResults ? (
              <p className="text-[11px] text-text-muted py-4 text-center">{t.moveBookmarkNoResults}</p>
            ) : (
              filtered.map(({ board, categories: cats }) => (
                <div key={board.id} className="mb-1.5 last:mb-0 rounded-lg border border-white/10 bg-white/5 p-1.5">
                  <p className="text-sm font-bold text-white tracking-wide px-2 py-1.5 mb-1">
                    {board.name}
                  </p>
                  <div className="space-y-0.5">
                    {cats.length === 0 && (
                      <p className="px-2 py-1.5 text-[11px] text-text-muted">{t.moveBookmarkNoCategory}</p>
                    )}
                    {cats.map((cat) => {
                      const isCurrent = bookmark?.category_id === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          disabled={isCurrent}
                          onClick={() => { onMove(cat.id, board.id); onClose(); }}
                          className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-left text-xs transition ${
                            isCurrent
                              ? 'cursor-not-allowed bg-white/5 text-text-muted border border-white/10'
                              : 'text-text-secondary hover:bg-white/10 hover:text-white border border-transparent'
                          }`}
                        >
                          <span className="font-medium truncate flex-1 min-w-0 text-sm">{cat.name}</span>
                          {isCurrent && (
                            <span className="text-[10px] text-text-muted flex-shrink-0 px-1.5 py-0.5 rounded bg-white/5">
                              {t.moveBookmarkCurrent}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="flex-shrink-0 p-2 border-t border-white/10">
          <button type="button" onClick={onClose} className="w-full px-3 py-1.5 rounded-lg text-xs border border-white/10 text-text-secondary hover:bg-white/10">
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryCard({
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
    attributes: Record<string, unknown>;
    listeners: Record<string, unknown> | undefined;
  };
}) {
  const settings = useSettings();
  const { id, name, color, icon, bookmarks } = category;
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
      className={`relative glass-panel rounded-xl overflow-hidden shadow-glass group min-w-0 ring-1 ring-transparent transition-all duration-200 motion-reduce:transform-none hover:-translate-y-px hover:shadow-[0_14px_36px_rgba(0,0,0,0.32)] hover:ring-white/10 focus-within:ring-accent/30 focus-within:shadow-[0_12px_32px_rgba(0,0,0,0.28)] ${
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
      <div
        className="px-2.5 py-0 border-b border-white/5 flex justify-between items-center bg-white/[0.02]"
        style={color ? { backgroundColor: color } : undefined}
      >
        <div
          ref={dragHandleProps?.setActivatorNodeRef}
          className={`flex items-center gap-1.5 min-w-0 flex-1 ${dragHandleProps ? 'cursor-grab active:cursor-grabbing' : ''}`}
          {...(dragHandleProps?.attributes ?? {})}
          {...(dragHandleProps?.listeners ?? {})}
        >
          {icon ? (
            <span className="material-symbols-outlined text-[16px] text-white flex-shrink-0">{icon}</span>
          ) : (
            <div
              className="h-1.5 w-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: dotColor, boxShadow: `0 0 6px ${dotColor}80` }}
            />
          )}
          <h3 className="font-bold text-xs text-white tracking-wide truncate">{name}</h3>
        </div>
        <div ref={categoryTriggerRef} className="relative">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenCategoryMenu(id); }}
            className="text-text-muted hover:text-white transition opacity-0 group-hover:opacity-100 p-1 rounded"
            aria-label="More"
          >
            <span className="material-icons-round text-base">more_horiz</span>
          </button>
          {menuOpen &&
            createPortal(
              <div
                ref={categoryDropdownRef}
                className="rounded-lg border border-white/10 bg-sidebar shadow-xl py-1 min-w-[180px] whitespace-nowrap"
                style={{
                  position: 'fixed',
                  top: categoryMenuPosition.top,
                  left: categoryMenuPosition.left,
                  zIndex: 9999,
                }}
              >
                <button type="button" onClick={onEditCategory} className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left text-xs text-text-secondary hover:bg-white/10 hover:text-white">
                  <span className="material-icons-round text-[16px]">edit</span>
                  {getT(settings.locale).edit}
                </button>
                <button type="button" onClick={onAddBookmark} className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left text-xs text-text-secondary hover:bg-white/10 hover:text-white">
                  <span className="material-icons-round text-[16px]">link</span>
                  {getT(settings.locale).addBookmark}
                </button>
                {onMoveCategory && (
                  <button type="button" onClick={onMoveCategory} className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left text-xs text-text-secondary hover:bg-white/10 hover:text-white">
                    <span className="material-icons-round text-[16px]">drive_file_move</span>
                    {getT(settings.locale).moveCategory}
                  </button>
                )}
                {onDuplicateCategory && (
                  <button type="button" onClick={onDuplicateCategory} className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left text-xs text-text-secondary hover:bg-white/10 hover:text-white">
                    <span className="material-icons-round text-[16px]">content_copy</span>
                    {getT(settings.locale).duplicate}
                  </button>
                )}
                <button type="button" onClick={onDeleteCategory} className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left text-xs text-red-400 hover:bg-red-500/20">
                  <span className="material-icons-round text-[16px]">delete</span>
                  {getT(settings.locale).delete}
                </button>
              </div>,
              document.body
            )}
        </div>
      </div>
      <ul className={`py-1.5 px-1 ${cardHeight === 'equal' ? 'flex-1 flex flex-col' : ''}`}>
        {filtered.length === 0 ? (
          <li className="p-6 flex items-center justify-center text-text-muted/30">
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

function BookmarkRow({
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
        {getT(settings.locale).edit}
      </button>
      {onDuplicate && (
        <button type="button" onClick={() => { onDuplicate(bookmark); closeMenu(); }} className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left text-xs text-text-secondary hover:bg-white/10 hover:text-white">
          <span className="material-icons-round text-[16px]">content_copy</span>
          {getT(settings.locale).duplicate}
        </button>
      )}
      {onMove && (
        <button type="button" onClick={() => { onMove(bookmark); closeMenu(); }} className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left text-xs text-text-secondary hover:bg-white/10 hover:text-white">
          <span className="material-icons-round text-[16px]">drive_file_move</span>
          Di chuyển
        </button>
      )}
      <button type="button" onClick={() => { onDelete(bookmark); closeMenu(); }} className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left text-xs text-red-400 hover:bg-red-500/20">
        <span className="material-icons-round text-[16px]">delete</span>
        {getT(settings.locale).delete}
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
