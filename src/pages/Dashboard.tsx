import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  closestCenter,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Over,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
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
import {
  COLUMN_DROP_PREFIX,
  DROP_INDICATOR_BLOCK_CLASS,
  FALLBACK_DOT_COLORS,
  categoryGridColsClass,
} from './dashboard/boardGrid';
import { ColumnDroppable } from './dashboard/ColumnDroppable';
import { CategoryGridSkeleton } from './dashboard/CategoryGridSkeleton';
import { CategoryCard } from './dashboard/CategoryCard';
import { SortableCategoryCard } from './dashboard/SortableCategoryCard';
import { MoveBookmarkModal } from './dashboard/MoveBookmarkModal';
import { DashboardSidebar } from './dashboard/DashboardSidebar';
import { DashboardHeader } from './dashboard/DashboardHeader';
import { DashboardFooter } from './dashboard/DashboardFooter';
import { DashboardBoardToolbar } from './dashboard/DashboardBoardToolbar';

/** Prefer pointer position; fallback to closest center when pointer is in gap between columns */
const categoryCollisionDetection: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  if (pointer.length > 0) return pointer;
  return closestCenter(args);
};

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
    if (!spotlightOpen || !allBookmarks.length) return [];
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
  }, [spotlightOpen, allBookmarks, allCategories, boards]);

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

  const persistBoardColumnCount = useCallback(
    async (v: 2 | 3 | 4 | 5 | 6) => {
      if (!selectedBoardId) return;
      setBoards((prev) =>
        prev.map((b) => (b.id === selectedBoardId ? { ...b, category_columns: v } : b))
      );
      const { error } = await supabase
        .from('boards')
        .update({ category_columns: v, updated_at: new Date().toISOString() })
        .eq('id', selectedBoardId);
      const tLoc = getT(settings.locale);
      if (error) {
        await refetchBoards();
        setToast({ message: tLoc.boardUpdateFailed, type: 'error' });
      } else {
        await refetchBoards();
      }
    },
    [selectedBoardId, setBoards, refetchBoards, settings.locale]
  );

  const persistBoardSortOrder = useCallback(
    async (v: CategorySortOrder) => {
      if (!selectedBoardId) return;
      setBoards((prev) =>
        prev.map((b) => (b.id === selectedBoardId ? { ...b, category_sort_order: v } : b))
      );
      const { error } = await supabase
        .from('boards')
        .update({
          category_sort_order: v,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedBoardId);
      const tLoc = getT(settings.locale);
      if (error) {
        await refetchBoards();
        setToast({ message: tLoc.boardUpdateFailed, type: 'error' });
      } else {
        await refetchBoards();
      }
    },
    [selectedBoardId, setBoards, refetchBoards, settings.locale]
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
  const dashboardCategoryTotal = useMemo(() => allCategories.length, [allCategories]);
  const dashboardCategoryCountOnBoard = useMemo(
    () => (selectedBoardId ? categories.length : 0),
    [selectedBoardId, categories]
  );
  const dashboardLinkCountOnBoard = useMemo(
    () =>
      selectedBoardId
        ? categories.reduce((sum, c) => sum + c.bookmarks.length, 0)
        : 0,
    [selectedBoardId, categories]
  );

  const showCategoryGridSkeleton =
    !!selectedBoardId &&
    !searchTerm.trim() &&
    ((categoriesLoading && categories.length === 0) || (columnsLoading && boardColumns.length === 0));

  const isLightContent = settings.theme === 'light';
  const globalSearchListBtnClass = isLightContent
    ? 'w-full text-left px-3 py-1.5 rounded-lg border border-black/10 bg-white/85 hover:bg-accent/15 text-xs text-slate-900 shadow-sm transition flex items-center justify-between'
    : 'w-full text-left px-3 py-1.5 rounded-lg bg-white/5 hover:bg-accent/20 text-xs text-white/90 transition flex items-center justify-between';
  const globalSearchBookmarkBtnClass = isLightContent
    ? 'w-full text-left px-3 py-1.5 rounded-lg border border-black/10 bg-white/85 hover:bg-accent/15 text-xs text-slate-900 shadow-sm transition flex flex-col items-start'
    : 'w-full text-left px-3 py-1.5 rounded-lg bg-white/5 hover:bg-accent/20 text-xs text-white/90 transition flex flex-col items-start';
  const searchSectionHeadingClass = isLightContent
    ? 'text-[11px] font-semibold uppercase text-slate-500 tracking-wider mb-1'
    : 'text-[11px] font-semibold uppercase text-text-muted tracking-wider mb-1';
  const emptyCategoriesCardClass = isLightContent
    ? 'max-w-md mx-auto my-6 rounded-2xl border border-dashed border-black/15 bg-white/80 px-6 py-8 text-center shadow-sm'
    : 'max-w-md mx-auto my-6 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-8 text-center';
  const emptyCategoriesTitleClass = isLightContent ? 'text-sm font-semibold text-slate-900' : 'text-sm font-semibold text-white';

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
      <DashboardSidebar
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
        boards={boards}
        boardsLoading={boardsLoading}
        selectedBoardId={selectedBoardId}
        onSelectBoard={(id) => setSelectedBoardId(id)}
        boardMenuId={boardMenuId}
        onToggleBoardMenu={(id) => setBoardMenuId((cur) => (cur === id ? null : id))}
        boardMenuRef={boardMenuRef}
        boardTriggerRef={boardTriggerRef}
        boardDropdownRef={boardDropdownRef}
        openBoardMenuAbove={openBoardMenuAbove}
        draggedBoardId={draggedBoardId}
        dropBoardIndex={dropBoardIndex}
        onBoardDragStart={handleBoardDragStart}
        onBoardDragOver={handleBoardDragOver}
        onBoardDrop={handleBoardDrop}
        onBoardDragEnd={handleBoardDragEnd}
        onEditBoard={(board) => {
          setBoardEditing(board);
          setBoardModalOpen(true);
          setBoardMenuId(null);
        }}
        onDuplicateBoard={(board) => {
          handleDuplicateBoard(board);
          setBoardMenuId(null);
        }}
        onDeleteBoard={(board) => {
          handleDeleteBoard(board);
          setBoardMenuId(null);
        }}
        onOpenNewBoardModal={() => {
          setBoardEditing(null);
          setBoardModalOpen(true);
        }}
        onOpenAuthenticator={() => setAuthenticatorModalOpen(true)}
        onOpenItToolbox={() => setItToolboxModalOpen(true)}
      />

      {/* Main */}
      <main
        className={`flex min-h-0 flex-1 flex-col overflow-hidden min-w-0 bg-cover bg-center relative z-10 transition-[margin] duration-200 ${
          sidebarOpen ? 'md:ml-64' : 'md:ml-0'
        }`}
      >
        <DashboardHeader
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((o) => !o)}
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          user={user}
          userMenuRef={userMenuRef}
          userTriggerRef={userTriggerRef}
          userDropdownRef={userDropdownRef}
          userMenuOpen={userMenuOpen}
          onToggleUserMenu={() => setUserMenuOpen((o) => !o)}
          openUserMenuAbove={openUserMenuAbove}
          onOpenSettings={() => {
            setSettingsModalOpen(true);
            setUserMenuOpen(false);
          }}
          onSignOut={() => {
            handleSignOut();
            setUserMenuOpen(false);
          }}
        />
        <DashboardBoardToolbar
          selectedBoardId={selectedBoardId}
          boardsLength={boards.length}
          numColumnsPreferred={numColumnsPreferred}
          effectiveSortOrder={effectiveSortOrder}
          columnConfigPopupOpen={columnConfigPopupOpen}
          columnConfigPopupRect={columnConfigPopupRect}
          onToggleColumnPopup={() => setColumnConfigPopupOpen((o) => !o)}
          columnConfigTriggerRef={columnConfigTriggerRef}
          columnConfigPopupRef={columnConfigPopupRef}
          onCreateCategory={() => {
            setCategoryEditing(null);
            setCategoryModalOpen(true);
          }}
          onAddBookmark={() => openAddBookmark()}
          persistBoardColumnCount={persistBoardColumnCount}
          persistBoardSortOrder={persistBoardSortOrder}
        />

        <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-6 z-10 min-w-0">
          {boardsError && (
            <p className="text-red-400 text-xs py-3">{boardsError.message}</p>
          )}
          {searchTerm && (
            <div className="py-3">
              {/* Global search loading: dùng Toast thay vì text inline */}
              {!searchDataLoading && globalSearchResults && (
                <div className="space-y-4">
                  <div>
                    <p className={searchSectionHeadingClass}>
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
                              className={globalSearchListBtnClass}
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
                    <p className={searchSectionHeadingClass}>
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
                                className={globalSearchListBtnClass}
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
                    <p className={searchSectionHeadingClass}>
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
                                className={globalSearchBookmarkBtnClass}
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
                <div className={emptyCategoriesCardClass}>
                  <span className="material-symbols-outlined text-[40px] text-accent/80 mb-3 block" aria-hidden>
                    folder_special
                  </span>
                  <p className={emptyCategoriesTitleClass}>{tDash.emptyCategoriesTitle}</p>
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
                  }}
                  onDragOver={(e: DragOverEvent) => {
                    if (e.over) lastCategoryOverRef.current = e.over;
                  }}
                  onDragEnd={(e: DragEndEvent) => {
                    const over = e.over ?? lastCategoryOverRef.current;
                    lastCategoryOverRef.current = null;
                    handleCategoryDragEnd({ ...e, over });
                    setActiveDragCategory(null);
                  }}
                >
                  <div className={`category-grid ${categoryGridColsClass(numColumnsPreferred)}`}>
                        {boardColumns.map((col) => {
                          const colCats = categoriesByColumn.get(col.id) ?? [];
                          const showLineAtTop = false;
                          const showLineAtBottom = false;
                          return (
                            <ColumnDroppable
                              key={col.id}
                              columnId={col.id}
                              className="category-grid-item"
                              isEmpty={colCats.length === 0}
                              emptyDropLabel={tDash.dndDropCategoryHere}
                            >
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
        <DashboardFooter
          boardCount={boards.length}
          categoryTotal={dashboardCategoryTotal}
          bookmarkTotal={dashboardBookmarkTotal}
          selectedBoardId={selectedBoardId}
          categoryCountOnBoard={dashboardCategoryCountOnBoard}
          linkCountOnBoard={dashboardLinkCountOnBoard}
        />
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

