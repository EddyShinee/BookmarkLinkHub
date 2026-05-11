/** Chuẩn hóa chuỗi để so khớp (lower + bỏ dấu tiếng Việt). */
const DIACRITICS_COMBINING = /[\u0300-\u036f]/g;

export function normalizeSearchString(s: string): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(DIACRITICS_COMBINING, '')
    .toLowerCase()
    .trim();
}

export type BookmarkSearchFields = {
  title: string;
  url: string;
  boardName?: string;
  categoryName?: string;
  description?: string | null;
  tags?: string[] | null;
};

export type ParsedSpotlightQuery = {
  /** Phần text tự do sau khi tách filter */
  text: string;
  /** hostname hoặc chuỗi con trong URL (đã normalize) */
  site?: string;
  /** khớp tên board (substring, đã normalize) */
  board?: string;
  /** khớp tag (substring, đã normalize) */
  tag?: string;
};

/**
 * Hỗ trợ: `site:github.com`, `board:Tên` hoặc `b:Tên`, `#react` hoặc `tag:react`
 */
/** Bỏ cú pháp lọc; dùng cho ô search header (board/category). */
export function stripSearchFilterSyntax(raw: string): string {
  return String(raw ?? '')
    .replace(/\bsite:\S+/gi, ' ')
    .replace(/\b(?:board|b):\S+/gi, ' ')
    .replace(/#(\S+)/g, ' ')
    .replace(/\btag:\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseSpotlightQuery(raw: string): ParsedSpotlightQuery {
  let s = String(raw ?? '').trim();
  const out: ParsedSpotlightQuery = { text: '' };

  s = s.replace(/\bsite:(\S+)/gi, (_, h: string) => {
    out.site = normalizeSearchString(h);
    return ' ';
  });
  s = s.replace(/\b(?:board|b):(\S+)/gi, (_, h: string) => {
    out.board = normalizeSearchString(h);
    return ' ';
  });
  s = s.replace(/#(\S+)/g, (_, h: string) => {
    out.tag = normalizeSearchString(h);
    return ' ';
  });
  s = s.replace(/\btag:(\S+)/gi, (_, h: string) => {
    out.tag = normalizeSearchString(h);
    return ' ';
  });

  out.text = s.replace(/\s+/g, ' ').trim();
  return out;
}

function urlHostNormalized(url: string): string {
  try {
    return normalizeSearchString(new URL(url).hostname.replace(/^www\./i, ''));
  } catch {
    return '';
  }
}

/**
 * Điểm > 0 nếu khớp (sau filter). Dùng chung Spotlight và ô search header.
 */
export function scoreBookmarkSearch(item: BookmarkSearchFields, parsed: ParsedSpotlightQuery): number {
  const title = normalizeSearchString(item.title ?? '');
  const url = normalizeSearchString(item.url ?? '');
  const desc = normalizeSearchString(item.description ?? '');
  const tagsStr = (item.tags ?? []).map((t) => normalizeSearchString(t)).join(' ');
  const board = normalizeSearchString(item.boardName ?? '');
  const category = normalizeSearchString(item.categoryName ?? '');
  const host = urlHostNormalized(item.url ?? '');

  if (parsed.site) {
    const ok = host.includes(parsed.site) || url.includes(parsed.site);
    if (!ok) return 0;
  }
  if (parsed.board && !board.includes(parsed.board)) return 0;
  if (parsed.tag) {
    const tagOk =
      (item.tags ?? []).some((t) => normalizeSearchString(t).includes(parsed.tag!)) ||
      tagsStr.includes(parsed.tag);
    if (!tagOk) return 0;
  }

  const q = normalizeSearchString(parsed.text);
  if (!q) {
    if (parsed.site || parsed.board || parsed.tag) return 55;
    return 0;
  }

  let score = 0;

  if (title.startsWith(q)) score += 120;
  else {
    const titleWords = title.split(/\s+/);
    if (titleWords.some((w) => w.startsWith(q))) score += 90;
    else if (title.includes(q)) score += 70;
  }

  if (board.startsWith(q) || category.startsWith(q)) score += 50;
  else if (board.includes(q) || category.includes(q)) score += 35;

  if (host.startsWith(q) || url.startsWith(q)) score += 42;
  else if (url.includes(q)) score += 22;

  if (desc.startsWith(q)) score += 45;
  else if (desc.includes(q)) score += 28;

  if ((item.tags ?? []).some((t) => normalizeSearchString(t).includes(q))) score += 40;
  else if (tagsStr.includes(q)) score += 25;

  if (score > 0) score += Math.max(0, 20 - title.length * 0.2);

  return score;
}

export function formatUrlForDisplay(url: string): { host: string; rest: string } {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./i, '');
    const rest = `${u.pathname}${u.search}${u.hash}` || '/';
    return { host, rest };
  } catch {
    return { host: '', rest: url };
  }
}

/** Highlight substring đầu tiên (không phụ thuộc normalize). */
export function findInsensitiveMatchIndex(haystack: string, needle: string): number {
  if (!needle.trim()) return -1;
  return haystack.toLowerCase().indexOf(needle.trim().toLowerCase());
}
