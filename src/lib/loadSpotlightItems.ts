import type { SpotlightItem } from '../components/SearchSpotlightModal';
import { supabase } from './supabaseClient';

export type SpotlightLoadResult = {
  items: SpotlightItem[];
  signedIn: boolean;
};

type BoardRow = { id: string; name: string };
type CategoryRow = { id: string; board_id: string; name: string };
type BookmarkRow = {
  id: string;
  category_id: string;
  url: string;
  title: string | null;
  description: string | null;
  tags: string[] | null;
  updated_at: string | null;
};

/** Tải toàn bộ bookmark/board/category cho Spotlight (RLS theo session hiện tại). */
export async function loadSpotlightItems(): Promise<SpotlightLoadResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { items: [], signedIn: false };

  const [{ data: boards }, { data: cats }, { data: bms }] = await Promise.all([
    supabase.from('boards').select('id, name'),
    supabase.from('categories').select('id, board_id, name'),
    supabase.from('bookmarks').select('id, category_id, url, title, description, tags, updated_at'),
  ]);

  const boardById = new Map(((boards ?? []) as BoardRow[]).map((b) => [b.id, b.name]));
  const catById = new Map(((cats ?? []) as CategoryRow[]).map((c) => [c.id, c]));

  const items: SpotlightItem[] = ((bms ?? []) as BookmarkRow[]).map((bm) => {
    const cat = catById.get(bm.category_id);
    const boardName = cat ? boardById.get(cat.board_id) : undefined;
    return {
      id: bm.id,
      title: bm.title || bm.url,
      url: bm.url,
      boardName,
      categoryName: cat?.name,
      description: bm.description,
      tags: bm.tags ?? undefined,
      updatedAt: bm.updated_at ?? undefined,
    };
  });

  return { items, signedIn: true };
}
