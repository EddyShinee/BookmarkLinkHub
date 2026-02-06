import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '../hooks/useAuth';
import { useBookmarks } from '../hooks/useBookmarks';
import { useCategories } from '../hooks/useCategories';
import type { Bookmark, Category, Board } from '../hooks/useBookmarks';
import { useSettings } from '../contexts/SettingsContext';
import SettingsModal from '../components/SettingsModal';
import BoardModal from '../components/BoardModal';
import ITToolboxModal from '../components/ITToolboxModal';
import CategoryModal from '../components/CategoryModal';
import BookmarkModal from '../components/BookmarkModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { getT } from '../lib/i18n';
import { supabase } from '../lib/supabaseClient';
import { buildBookmarksHtml, downloadHtml } from '../lib/exportHtml';

/** Fallback dot colors when category.color is not set (schema default #818CF8 = accent) */
const FALLBACK_DOT_COLORS = [
  '#818CF8', '#10B981', '#A855F7', '#FB923C', '#EC4899', '#3B82F6', '#EAB308', '#06B6D4',
];

function SortableCategoryCard({
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
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
    transition: { duration: 150, easing: 'ease' },
  });
  const isActive = isDragging || activeCategoryId === category.id;
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isActive ? 0 : 1,
    pointerEvents: isActive ? 'none' : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className="break-inside-avoid" {...attributes} {...listeners}>
      <CategoryCard
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
    </div>
  );
}

interface DashboardProps {
  initialAddBookmark?: { url: string; title: string };
}

export default function Dashboard({ initialAddBookmark }: DashboardProps) {
  const { user } = useAuth();
  const settings = useSettings();
  const { boards, setBoards, loading: boardsLoading, error: boardsError, refetch: refetchBoards } = useBookmarks(user?.id);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const { categories, setCategories, loading: categoriesLoading, refetch: refetchCategories } = useCategories(selectedBoardId);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [uiRestored, setUiRestored] = useState(false);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allBookmarks, setAllBookmarks] = useState<Bookmark[]>([]);
  const [searchDataLoading, setSearchDataLoading] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(!!initialAddBookmark);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const [boardModalOpen, setBoardModalOpen] = useState(false);
  const [itToolboxModalOpen, setItToolboxModalOpen] = useState(false);
  const [boardEditing, setBoardEditing] = useState<Board | null>(null);
  const [boardMenuId, setBoardMenuId] = useState<string | null>(null);

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryEditing, setCategoryEditing] = useState<Category | null>(null);
  const [categoryMenuId, setCategoryMenuId] = useState<string | null>(null);

  const [bookmarkModalOpen, setBookmarkModalOpen] = useState(false);
  const [bookmarkEditing, setBookmarkEditing] = useState<Bookmark | null>(null);
  const [addBookmarkCategoryId, setAddBookmarkCategoryId] = useState<string | null>(null);
  const [bookmarkToMove, setBookmarkToMove] = useState<Bookmark | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const [draggedBoardId, setDraggedBoardId] = useState<string | null>(null);
  const [dropBoardIndex, setDropBoardIndex] = useState<number | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [draggedBookmark, setDraggedBookmark] = useState<{ id: string; categoryId: string } | null>(null);
  const [dropBookmarkTarget, setDropBookmarkTarget] = useState<{ id: string; categoryId: string; index: number } | null>(null);

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
    const boardMatches = boards.filter((b) =>
      b.name.toLowerCase().includes(searchTerm)
    );
    const categoryMatches = allCategories.filter((c) =>
      c.name.toLowerCase().includes(searchTerm)
    );
    const bookmarkMatches = allBookmarks.filter((b) =>
      (b.title ?? '').toLowerCase().includes(searchTerm) ||
      (b.url ?? '').toLowerCase().includes(searchTerm)
    );
    return { boardMatches, categoryMatches, bookmarkMatches };
  }, [searchTerm, boards, allCategories, allBookmarks]);

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
    if (initialAddBookmark) setAddModalOpen(true);
  }, [initialAddBookmark]);

  useEffect(() => {
    // Restore last UI state from localStorage (works in dev) and chrome.storage.local (in extension)
    let done = false;
    try {
      if (typeof window !== 'undefined') {
        const storedSidebar = window.localStorage.getItem('lastSidebarOpen');
        if (storedSidebar !== null) {
          setSidebarOpen(storedSidebar === 'true');
        }
        const storedBoard = window.localStorage.getItem('lastSelectedBoardId');
        if (storedBoard) {
          setSelectedBoardId(storedBoard);
        }
      }
    } catch {
      // ignore localStorage errors
    }

    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get(['lastSidebarOpen', 'lastSelectedBoardId'], (result) => {
          try {
            if (typeof result.lastSidebarOpen === 'boolean') {
              setSidebarOpen(result.lastSidebarOpen);
            }
            if (typeof result.lastSelectedBoardId === 'string') {
              setSelectedBoardId(result.lastSelectedBoardId);
            }
          } finally {
            if (!done) {
              done = true;
              setUiRestored(true);
            }
          }
        });
        return;
      }
    } catch {
      // ignore when not running in extension context
    }

    // If chrome.storage not available, mark as restored after localStorage pass
    if (!done) {
      done = true;
      setUiRestored(true);
    }
  }, []);

  useEffect(() => {
    // Fallback: if stored board is missing, pick first board
    if (!uiRestored) return;
    if (boards.length > 0 && (!selectedBoardId || !boards.some((b) => b.id === selectedBoardId))) {
      setSelectedBoardId(boards[0].id);
    }
  }, [boards, selectedBoardId, uiRestored]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('lastSidebarOpen', String(sidebarOpen));
      }
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({ lastSidebarOpen: sidebarOpen });
      }
    } catch {
      // ignore when not running in extension context
    }
  }, [sidebarOpen]);

  useEffect(() => {
    if (!selectedBoardId) return;
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('lastSelectedBoardId', selectedBoardId);
      }
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({ lastSelectedBoardId: selectedBoardId });
      }
    } catch {
      // ignore when not running in extension context
    }
  }, [selectedBoardId]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
    document.documentElement.classList.toggle('light', settings.theme === 'light');
  }, [settings.theme]);

  const handleSignOut = () => supabase.auth.signOut();

  const openBookmark = (url: string) => {
    if (settings.openLinkIn === 'current_tab') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) chrome.tabs.update(tabs[0].id, { url });
        else chrome.tabs.create({ url });
      });
    } else {
      chrome.tabs.create({ url });
    }
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
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      if (file.name.endsWith('.json')) {
        try {
          const data = JSON.parse(text);
          console.log('Import JSON (parse only, chưa ghi Supabase):', data);
          alert('Import JSON: đã đọc file. Ghi lên Supabase sẽ bổ sung sau.');
        } catch {
          alert('File JSON không hợp lệ.');
        }
      } else {
        console.log('Import HTML (parse only, chưa ghi Supabase):', text.slice(0, 500));
        alert('Import HTML: đã đọc file. Ghi lên Supabase sẽ bổ sung sau.');
      }
    };
    reader.readAsText(file);
  };

  const handleSaveBoard = async (name: string, id?: string) => {
    if (!user?.id) return;
    if (id) {
      await supabase.from('boards').update({ name, updated_at: new Date().toISOString() }).eq('id', id);
    } else {
      const maxOrder = boards.length === 0 ? 0 : Math.max(...boards.map((b) => b.sort_order), 0);
      await supabase.from('boards').insert({ user_id: user.id, name, sort_order: maxOrder + 1 });
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
      .insert({ user_id: user.id, name: `${board.name} (bản sao)`, sort_order: maxOrder + 1 })
      .select('id')
      .single();
    if (boardErr || !newBoardRow) return;
      const { data: sourceCats } = await supabase
        .from('categories')
        .select('*, bookmarks(*)')
        .eq('board_id', board.id)
        .order('sort_order', { ascending: true });
    for (const cat of sourceCats ?? []) {
      const bookmarks = (cat as { bookmarks?: Bookmark[] }).bookmarks ?? [];
      const { data: newCatRow } = await supabase
        .from('categories')
        .insert({
          board_id: newBoardRow.id,
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
      const maxOrder = categories.length === 0 ? 0 : Math.max(...categories.map((c) => c.sort_order), 0);
      await supabase.from('categories').insert({
        board_id: selectedBoardId,
        name,
        color: color ?? null,
        sort_order: maxOrder + 1,
      });
    }
    await refetchCategories();
    setCategoryModalOpen(false);
    setCategoryEditing(null);
  };

  const handleMoveCategoryToBoard = async (categoryId: string, targetBoardId: string) => {
    const { data: targetCategories } = await supabase
      .from('categories')
      .select('sort_order')
      .eq('board_id', targetBoardId)
      .order('sort_order', { ascending: false })
      .limit(1);
    const maxOrder = targetCategories?.[0]?.sort_order ?? -1;
    await supabase
      .from('categories')
      .update({ board_id: targetBoardId, sort_order: maxOrder + 1, updated_at: new Date().toISOString() })
      .eq('id', categoryId);
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
    const maxOrder = categories.length === 0 ? 0 : Math.max(...categories.map((c) => c.sort_order), 0);
    const { data: newCatRow } = await supabase
      .from('categories')
      .insert({
        board_id: selectedBoardId,
        name: `${category.name} (bản sao)`,
        color: category.color ?? undefined,
        icon: category.icon ?? undefined,
        sort_order: maxOrder + 1,
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

  const handleMoveBookmark = async (bookmark: Bookmark, targetCategoryId: string) => {
    if (bookmark.category_id === targetCategoryId) return;
    const targetCat = categories.find((c) => c.id === targetCategoryId);
    const maxOrder = targetCat?.bookmarks?.length ? Math.max(...targetCat.bookmarks.map((b) => b.sort_order), 0) + 1 : 0;
    await supabase
      .from('bookmarks')
      .update({ category_id: targetCategoryId, sort_order: maxOrder, updated_at: new Date().toISOString() })
      .eq('id', bookmark.id);
    await refetchCategories();
    setBookmarkToMove(null);
  };

  const openAddBookmark = (defaultCategoryId?: string) => {
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

  const categorySensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handleCategoryDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveCategoryId(null);
      if (!over || active.id === over.id) return;
      const fromIndex = categories.findIndex((c) => c.id === active.id);
      if (fromIndex === -1) return;
      const toIndex = categories.findIndex((c) => c.id === over.id);
      if (toIndex === -1) return;
      const newCategories = arrayMove(categories, fromIndex, toIndex);
      setCategories(newCategories);
      const now = new Date().toISOString();
      (async () => {
        for (let i = 0; i < newCategories.length; i++) {
          await supabase.from('categories').update({ sort_order: i, updated_at: now }).eq('id', newCategories[i].id);
        }
      })();
    },
    [categories]
  );

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

  return (
    <div className="bg-main font-display text-text-primary h-screen overflow-hidden flex selection:bg-accent selection:text-white">
      {/* Sidebar */}
      <aside
        className={`sidebar-gradient border-r border-white/10 flex flex-col z-40 w-64 flex-shrink-0 fixed inset-y-0 left-0 transform transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-12 flex items-center px-4 border-b border-white/10">
          <div className="flex items-center gap-2 text-accent group cursor-pointer">
            <div className="p-1.5 bg-accent/10 rounded-lg group-hover:bg-accent/20 transition-colors">
              <span className="material-symbols-outlined text-[18px]">hub</span>
            </div>
            <span className="font-semibold text-sm tracking-tight text-white">LinkHub</span>
          </div>
        </div>
        <div className="px-3 pt-2 pb-1">
          <button
            type="button"
            onClick={() => setItToolboxModalOpen(true)}
            className="flex items-center gap-2 w-full px-2.5 py-2 text-xs font-medium rounded-lg text-left text-text-secondary hover:bg-white/5 hover:text-white border border-transparent transition"
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
            className="p-1 rounded-lg text-text-muted hover:text-accent hover:bg-white/5 transition"
            aria-label="Add board"
          >
            <span className="material-icons-round text-base">add_circle_outline</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-3">
          {boardsLoading && (
            <div className="px-2 py-1.5 text-text-muted text-xs">Đang tải...</div>
          )}
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
                }`}
              >
                <span className="truncate">{board.name}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setBoardMenuId((id) => (id === board.id ? null : board.id)); }}
                  className="p-1 rounded hover:bg-white/10 flex-shrink-0"
                  aria-label="Menu"
                >
                  <span className="material-icons-round text-[14px] opacity-60">more_horiz</span>
                </button>
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
            <p className="px-2 py-1.5 text-text-muted text-xs">Chưa có board</p>
          )}
        </div>
      </aside>

      {/* Main */}
      <main
        className={`flex-1 flex flex-col min-w-0 bg-[url('https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center relative transition-[margin] duration-200 ${
          sidebarOpen ? 'md:ml-64' : 'md:ml-0'
        }`}
      >
        <div
          className="absolute inset-0 backdrop-blur-[2px] z-0"
          style={{ backgroundColor: `${settings.backgroundColor}E6` }}
        />
        <header className="h-12 relative z-[100] flex items-center justify-between px-3 md:px-4 border-b border-white/10 bg-main/80 backdrop-blur-md">
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
                type="text"
                placeholder="Search your bookmarks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white/5 border border-white/10 text-xs text-white placeholder-text-muted focus:ring-2 focus:ring-accent/40 focus:border-accent/40 block w-full pl-9 pr-3 py-1.5 rounded-lg transition-all"
              />
            </div>
          </div>
          <div className="relative flex items-center gap-1.5 ml-2 md:ml-4" ref={userMenuRef}>
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
        </header>

        <div className="px-4 py-3 z-10 flex items-center justify-between">
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
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6 z-10">
          {boardsError && (
            <p className="text-red-400 text-xs py-3">{boardsError.message}</p>
          )}
          {searchTerm && (
            <div className="py-3">
              {searchDataLoading && (
                <p className="text-text-muted text-xs">Đang tìm kiếm...</p>
              )}
              {!searchDataLoading && globalSearchResults && (
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-text-muted tracking-wider mb-1">Boards</p>
                    {globalSearchResults.boardMatches.length === 0 ? (
                      <p className="text-xs text-text-muted/70">Không có board phù hợp.</p>
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
                              <span className="text-[11px] text-text-muted ml-2">Board</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-text-muted tracking-wider mb-1">Categories</p>
                    {globalSearchResults.categoryMatches.length === 0 ? (
                      <p className="text-xs text-text-muted/70">Không có category phù hợp.</p>
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
                                  {board?.name ?? 'Board'}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-text-muted tracking-wider mb-1">Bookmarks</p>
                    {globalSearchResults.bookmarkMatches.length === 0 ? (
                      <p className="text-xs text-text-muted/70">Không có bookmark phù hợp.</p>
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
              {categoriesLoading && (
                <div className="text-text-muted text-xs py-6">Đang tải categories...</div>
              )}
              {!categoriesLoading && categories.length === 0 && selectedBoardId && (
                <div className="text-text-muted text-xs py-6 text-center">
                  <span className="material-symbols-outlined text-3xl block mb-1.5 opacity-50">folder_open</span>
                  <p>Chưa có category. Tạo category hoặc thêm bookmark.</p>
                </div>
              )}
              <div
                className={`gap-2 space-y-2 columns-1 ${
                  settings.categoryColumns === 2 ? 'md:columns-2' :
                  settings.categoryColumns === 3 ? 'md:columns-3' :
                  settings.categoryColumns === 5 ? 'md:columns-5' :
                  settings.categoryColumns === 6 ? 'md:columns-6' :
                  'md:columns-4'
                }`}
              >
                {settings.dragDrop.category ? (
                  <DndContext
                    sensors={categorySensors}
                    collisionDetection={closestCenter}
                    onDragStart={({ active }) => setActiveCategoryId(active.id as string)}
                    onDragEnd={handleCategoryDragEnd}
                  >
                    <SortableContext items={categories.map((c) => c.id)} strategy={rectSortingStrategy}>
                      {categories.map((cat, idx) => (
                        <SortableCategoryCard
                          key={cat.id}
                          category={cat}
                          activeCategoryId={activeCategoryId}
                          fallbackDotColor={FALLBACK_DOT_COLORS[idx % FALLBACK_DOT_COLORS.length]}
                          searchQuery={searchQuery}
                          onOpenBookmark={openBookmark}
                          cardHeight={settings.categoryCardHeight}
                        fillContent={settings.categoryColorFillContent}
                          categoryMenuId={categoryMenuId}
                          onOpenCategoryMenu={(id) => setCategoryMenuId((cur) => (cur === id ? null : id))}
                          onEditCategory={() => { setCategoryEditing(cat); setCategoryModalOpen(true); setCategoryMenuId(null); }}
                          onDuplicateCategory={() => { handleDuplicateCategory(cat); setCategoryMenuId(null); }}
                          onDeleteCategory={() => { handleDeleteCategory(cat); setCategoryMenuId(null); }}
                          onAddBookmark={() => { openAddBookmark(cat.id); setCategoryMenuId(null); }}
                          onEditBookmark={(b) => { setBookmarkEditing(b); setBookmarkModalOpen(true); setCategoryMenuId(null); }}
                          onDuplicateBookmark={handleDuplicateBookmark}
                          onMoveBookmark={(b) => setBookmarkToMove(b)}
                          onDeleteBookmark={handleDeleteBookmark}
                          dragDropBookmark={settings.dragDrop.bookmark}
                          draggedBookmark={draggedBookmark}
                          dropBookmarkTarget={dropBookmarkTarget}
                          onBookmarkDragStart={(e, bookmarkId) => handleBookmarkDragStart(e, bookmarkId, cat.id)}
                          onBookmarkDragOver={(e, bookmarkId, index) => handleBookmarkDragOver(e, bookmarkId, cat.id, index)}
                          onBookmarkDrop={handleBookmarkDrop}
                          onBookmarkDragEnd={handleBookmarkDragEnd}
                        />
                      ))}
                    </SortableContext>
                    <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
                      {activeCategoryId ? (() => {
                        const cat = categories.find((c) => c.id === activeCategoryId);
                        if (!cat) return null;
                        const idx = categories.findIndex((c) => c.id === activeCategoryId);
                        return (
                      <div className="cursor-grabbing opacity-95 shadow-xl rounded-xl overflow-hidden w-[240px]">
                            <CategoryCard
                              category={cat}
                              fallbackDotColor={FALLBACK_DOT_COLORS[idx % FALLBACK_DOT_COLORS.length]}
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
                              onDeleteBookmark={() => {}}
                              dragDropCategory={false}
                              sortableWrapper={false}
                              dragDropBookmark={false}
                              draggedBookmark={null}
                              dropBookmarkTarget={null}
                              onBookmarkDragStart={undefined}
                              onBookmarkDragOver={undefined}
                              onBookmarkDrop={undefined}
                              onBookmarkDragEnd={undefined}
                            />
                          </div>
                        );
                      })() : null}
                    </DragOverlay>
                  </DndContext>
                ) : (
                  categories.map((cat, idx) => (
                    <CategoryCard
                      key={cat.id}
                      category={cat}
                      fallbackDotColor={FALLBACK_DOT_COLORS[idx % FALLBACK_DOT_COLORS.length]}
                      searchQuery={searchQuery}
                      onOpenBookmark={openBookmark}
                      cardHeight={settings.categoryCardHeight}
                      fillContent={settings.categoryColorFillContent}
                      categoryMenuId={categoryMenuId}
                      onOpenCategoryMenu={(id) => setCategoryMenuId((cur) => (cur === id ? null : id))}
                      onEditCategory={() => { setCategoryEditing(cat); setCategoryModalOpen(true); setCategoryMenuId(null); }}
                      onDuplicateCategory={() => { handleDuplicateCategory(cat); setCategoryMenuId(null); }}
                      onDeleteCategory={() => { handleDeleteCategory(cat); setCategoryMenuId(null); }}
                      onAddBookmark={() => { openAddBookmark(cat.id); setCategoryMenuId(null); }}
                      onEditBookmark={(b) => { setBookmarkEditing(b); setBookmarkModalOpen(true); setCategoryMenuId(null); }}
                      onDuplicateBookmark={handleDuplicateBookmark}
                      onMoveBookmark={(b) => setBookmarkToMove(b)}
                      onDeleteBookmark={handleDeleteBookmark}
                      dragDropCategory={false}
                      sortableWrapper={false}
                      dragDropBookmark={settings.dragDrop.bookmark}
                      draggedBookmark={draggedBookmark}
                      dropBookmarkTarget={dropBookmarkTarget}
                      onBookmarkDragStart={(e, bookmarkId) => handleBookmarkDragStart(e, bookmarkId, cat.id)}
                      onBookmarkDragOver={(e, bookmarkId, index) => handleBookmarkDragOver(e, bookmarkId, cat.id, index)}
                      onBookmarkDrop={handleBookmarkDrop}
                      onBookmarkDragEnd={handleBookmarkDragEnd}
                    />
                  ))
                )}
              </div>
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

      <BoardModal
        open={boardModalOpen}
        editBoard={boardEditing}
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
        onClose={() => { setCategoryModalOpen(false); setCategoryEditing(null); }}
        onSave={handleSaveCategory}
        onMoveToBoard={handleMoveCategoryToBoard}
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
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((d) => ({ ...d, open: false }))}
      />

      <MoveBookmarkModal
        open={!!bookmarkToMove}
        bookmark={bookmarkToMove}
        boards={boards}
        onClose={() => setBookmarkToMove(null)}
        onMove={(categoryId) => bookmarkToMove && handleMoveBookmark(bookmarkToMove, categoryId)}
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
  onMove: (categoryId: string) => void;
}) {
  const [allCategories, setAllCategories] = useState<{ id: string; name: string; board_id: string; sort_order: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const boardIds = boards.map((b) => b.id).join(',');

  useEffect(() => {
    if (!open || !bookmark || boards.length === 0) {
      setAllCategories([]);
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

  if (!open) return null;

  const boardOrder = [...boards].sort((a, b) => a.sort_order - b.sort_order);
  const categoriesByBoard = boardOrder.map((board) => ({
    board,
    categories: allCategories.filter((c) => c.board_id === board.id).sort((a, b) => a.sort_order - b.sort_order),
  }));

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-sidebar border border-white/10 rounded-xl shadow-xl w-full max-w-sm max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-white px-4 py-3 border-b border-white/10">
          Di chuyển bookmark
        </h3>
        {bookmark && (
          <p className="px-4 py-1.5 text-xs text-text-muted truncate border-b border-white/5">
            {bookmark.title || bookmark.url}
          </p>
        )}
        <div className="overflow-y-auto flex-1 p-2 min-h-0">
          {loading ? (
            <p className="text-xs text-text-muted py-4 text-center">Đang tải...</p>
          ) : (
            categoriesByBoard.map(({ board, categories: cats }) => (
              <div key={board.id} className="mb-3">
                <p className="text-[11px] font-semibold uppercase text-text-muted tracking-wider px-2 py-1">
                  {board.name}
                </p>
                <div className="space-y-0.5">
                  {cats.map((cat) => {
                    const isCurrent = bookmark?.category_id === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        disabled={isCurrent}
                        onClick={() => { onMove(cat.id); onClose(); }}
                        className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-left text-xs transition ${
                          isCurrent
                            ? 'opacity-50 cursor-not-allowed bg-white/5 text-text-muted'
                            : 'text-text-secondary hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span className="font-medium truncate">{cat.name}</span>
                        {isCurrent && <span className="text-[11px] text-text-muted flex-shrink-0">(hiện tại)</span>}
                      </button>
                    );
                  })}
                  {cats.length === 0 && (
                    <p className="px-3 py-1.5 text-xs text-text-muted">Chưa có category</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="p-2 border-t border-white/10">
          <button type="button" onClick={onClose} className="w-full px-3 py-2 rounded-lg text-xs border border-white/10 text-text-secondary hover:bg-white/10">
            Hủy
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
  const [openCategoryMenuAbove, setOpenCategoryMenuAbove] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const run = () => {
      const t = categoryTriggerRef.current;
      const d = categoryDropdownRef.current;
      if (!t || !d) return;
      const tr = t.getBoundingClientRect();
      const dr = d.getBoundingClientRect();
      const spaceBelow = window.innerHeight - tr.bottom;
      const hasRoomAbove = tr.top > dr.height;
      const notEnoughBelow = spaceBelow < dr.height;
      const fewBookmarks = filtered.length <= 2;
      // Ưu tiên mở lên trên khi category thấp (ít bookmark) và có chỗ phía trên,
      // hoặc khi bên dưới không đủ chỗ nhưng phía trên đủ.
      setOpenCategoryMenuAbove(
        (fewBookmarks && hasRoomAbove) || (notEnoughBelow && hasRoomAbove)
      );
    };
    const rafId = requestAnimationFrame(run);
    return () => cancelAnimationFrame(rafId);
  }, [menuOpen]);
  return (
    <div
      data-category-menu
      className={`relative glass-panel rounded-xl ${
        menuOpen && openCategoryMenuAbove ? 'overflow-visible' : 'overflow-hidden'
      } shadow-glass group hover:border-white/10 transition-all duration-200 ${
        cardHeight === 'equal' ? 'min-h-[240px] flex flex-col' : ''
      } ${(dragDropCategory || sortableWrapper) ? 'cursor-grab active:cursor-grabbing' : ''} ${
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
        <div className="flex items-center gap-1.5">
          {icon ? (
            <span className="material-symbols-outlined text-[16px] text-white">{icon}</span>
          ) : (
            <div
              className="h-1.5 w-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: dotColor, boxShadow: `0 0 6px ${dotColor}80` }}
            />
          )}
          <h3 className="font-bold text-xs text-white tracking-wide">{name}</h3>
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
          {menuOpen && (
            <div
              ref={categoryDropdownRef}
              className={`absolute right-0 rounded-lg border border-white/10 bg-sidebar shadow-xl py-1 z-[999] min-w-[180px] whitespace-nowrap ${openCategoryMenuAbove ? 'bottom-full mb-0.5' : 'top-full mt-0.5'}`}
            >
              <button type="button" onClick={onEditCategory} className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left text-xs text-text-secondary hover:bg-white/10 hover:text-white">
                <span className="material-icons-round text-[16px]">edit</span>
                {getT(settings.locale).edit}
              </button>
              <button type="button" onClick={onAddBookmark} className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left text-xs text-text-secondary hover:bg-white/10 hover:text-white">
                <span className="material-icons-round text-[16px]">link</span>
                {getT(settings.locale).addBookmark}
              </button>
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
            </div>
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
        {getT(useSettings().locale).edit}
      </button>
      {onDuplicate && (
        <button type="button" onClick={() => { onDuplicate(bookmark); closeMenu(); }} className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left text-xs text-text-secondary hover:bg-white/10 hover:text-white">
          <span className="material-icons-round text-[16px]">content_copy</span>
          {getT(useSettings().locale).duplicate}
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
        {getT(useSettings().locale).delete}
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
          className="flex items-center gap-2 px-3 py-2 mx-0.5 rounded-lg hover:bg-white/10 transition-all duration-200 w-full text-left flex-1 min-w-0"
        >
          <div className="w-5 h-5 rounded flex items-center justify-center bg-slate-800 text-text-secondary text-[11px] font-bold border border-white/5 group-hover/item:border-accent/30 group-hover/item:text-accent transition-colors flex-shrink-0">
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
