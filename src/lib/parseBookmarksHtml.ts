/**
 * Parse Netscape Bookmark file (HTML) như UI/Bookmarks.html.
 * Cấu trúc: Root DL → (DT>H3 = Board, DL = nội dung) → (DT>H3 = Category, DL = nội dung) → DT>A = Bookmark.
 */

export interface ParsedBookmark {
  url: string;
  title: string;
}

export interface ParsedCategory {
  name: string;
  bookmarks: ParsedBookmark[];
}

export interface ParsedBoard {
  name: string;
  categories: ParsedCategory[];
}

export type ParsedBookmarksFile = ParsedBoard[];

const TAG = (s: string) => s.toUpperCase();

function getDirectChildrenByTag(el: Element, tagNames: string[]): Element[] {
  const out: Element[] = [];
  const upper = tagNames.map((t) => TAG(t));
  for (let i = 0; i < el.children.length; i++) {
    const c = el.children[i];
    if (upper.includes(c.tagName)) out.push(c);
  }
  return out;
}

/**
 * Lấy DL chứa nội dung của folder (DT>H3).
 * Parser có thể đặt DL làm sibling của DT hoặc con của DT → kiểm tra cả hai.
 */
function getContentDLAfterDT(dt: Element): Element | null {
  let next: Element | null = dt.nextElementSibling;
  while (next) {
    if (TAG(next.tagName) === 'DL') return next;
    next = next.nextElementSibling;
  }
  for (let i = 0; i < dt.children.length; i++) {
    if (TAG(dt.children[i].tagName) === 'DL') return dt.children[i];
  }
  return null;
}

/** Lấy các thư mục (DT chứa H3 + DL nội dung) trong một DL. Duyệt theo thứ tự con trực tiếp. */
function getFolderEntries(dl: Element): { name: string; contentDL: Element }[] {
  const entries: { name: string; contentDL: Element }[] = [];
  const dts = getDirectChildrenByTag(dl, ['DT']);
  for (const dt of dts) {
    const h3 = dt.querySelector('h3') ?? dt.querySelector('H3');
    if (!h3) continue;
    const name = (h3.textContent ?? '').trim();
    if (!name) continue;
    const contentDL = getContentDLAfterDT(dt);
    if (contentDL) entries.push({ name, contentDL });
  }
  return entries;
}

/** Lấy các bookmark (DT chứa A) trong một DL. */
function getBookmarkEntries(dl: Element): ParsedBookmark[] {
  const bookmarks: ParsedBookmark[] = [];
  const dts = getDirectChildrenByTag(dl, ['DT']);
  for (const dt of dts) {
    const a = dt.querySelector('a');
    if (!a) continue;
    const href = (a.getAttribute('href') ?? '').trim();
    const title = (a.textContent ?? href).trim();
    if (href) bookmarks.push({ url: href, title: title || href });
  }
  return bookmarks;
}

/** DL đang chứa thư mục con (H3) hay chỉ link (A). */
function isFolderLevel(dl: Element): boolean {
  const firstDt = getDirectChildrenByTag(dl, ['DT'])[0];
  if (!firstDt) return false;
  return !!firstDt.querySelector('h3');
}

/**
 * Parse HTML Netscape Bookmark.
 * Cấu trúc 2 cấp folder: Board → Category → Bookmark (A).
 * Nếu chỉ có 1 cấp folder thì coi là 1 Board, các H3 là Category.
 * Nếu có 3+ cấp thì chỉ lấy 2 cấp đầu (Board, Category), phần sâu hơn gộp vào category cuối hoặc bỏ qua (tùy file).
 */
export function parseNetscapeBookmarksHtml(html: string): ParsedBookmarksFile {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const rootDL = doc.querySelector('dl') ?? doc.querySelector('DL');
  if (!rootDL) return [];

  const boards: ParsedBoard[] = [];
  let topFolders = getFolderEntries(rootDL);

  // Chrome export: 1 folder gốc (Bookmarks Bar / Other) chứa nhiều folder thật → bỏ bọc ngoài
  if (topFolders.length === 1) {
    const inner = getFolderEntries(topFolders[0].contentDL);
    if (inner.length > 1) topFolders = inner;
  }

  if (topFolders.length === 0) {
    const bookmarks = getBookmarkEntries(rootDL);
    if (bookmarks.length > 0) {
      boards.push({
        name: 'Imported',
        categories: [{ name: 'General', bookmarks }],
      });
    }
    return boards;
  }

  for (const { name: boardName, contentDL } of topFolders) {
    const categories: ParsedCategory[] = [];
    if (isFolderLevel(contentDL)) {
      const catEntries = getFolderEntries(contentDL);
      for (const { name: catName, contentDL: catDL } of catEntries) {
        const bookmarks = getBookmarkEntries(catDL);
        categories.push({ name: catName || 'Uncategorized', bookmarks });
      }
    } else {
      const bookmarks = getBookmarkEntries(contentDL);
      if (bookmarks.length > 0) categories.push({ name: boardName || 'Uncategorized', bookmarks });
    }
    if (boardName) boards.push({ name: boardName, categories });
  }

  return boards;
}
