/** Item id maps to i18n keys `itToolboxRegexCheat${id}` (PascalCase suffix). */
export const REGEX_CHEATSHEET_IDS = ['Email', 'Url', 'PhoneVn', 'Ipv4', 'Uuid'] as const;
export type RegexCheatsheetId = (typeof REGEX_CHEATSHEET_IDS)[number];

export const REGEX_CHEATSHEET_PATTERNS: Record<RegexCheatsheetId, string> = {
  Email: String.raw`^[\w.+-]+@[\w.-]+\.\w{2,}$`,
  Url: String.raw`^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)$`,
  PhoneVn: String.raw`^(?:\+84|84|0)(?:3|5|7|8|9)\d{8}$`,
  Ipv4: String.raw`^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$`,
  Uuid: String.raw`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$`,
};

export type RegexMatchRow = {
  index: number;
  value: string;
  groups: string[];
};

export type RegexRunResult = {
  matches: RegexMatchRow[];
  highlights: { start: number; end: number }[];
  error: string | null;
  replaced: string | null;
};

const VALID_FLAGS = new Set(['g', 'i', 'm', 's', 'u', 'y']);

export function sanitizeRegexFlags(flags: string): string {
  const out = new Set<string>();
  for (const c of flags) {
    if (VALID_FLAGS.has(c)) out.add(c);
  }
  return [...out].sort().join('');
}

/**
 * @param replaceWith when defined, computes `replaced` using `String.replace` (respects `g` on user regex).
 */
export function runRegex(
  pattern: string,
  flags: string,
  input: string,
  replaceWith?: string
): RegexRunResult {
  const safeFlags = sanitizeRegexFlags(flags);
  if (!pattern.trim()) {
    return {
      matches: [],
      highlights: [],
      error: null,
      replaced: replaceWith !== undefined ? input : null,
    };
  }

  let re: RegExp;
  try {
    re = new RegExp(pattern, safeFlags);
  } catch (e) {
    return {
      matches: [],
      highlights: [],
      error: e instanceof Error ? e.message : 'Invalid regex',
      replaced: null,
    };
  }

  let replaced: string | null = null;
  if (replaceWith !== undefined) {
    try {
      replaced = input.replace(re, replaceWith);
    } catch (e) {
      return {
        matches: [],
        highlights: [],
        error: e instanceof Error ? e.message : 'Replace error',
        replaced: null,
      };
    }
  }

  const matches: RegexMatchRow[] = [];
  const highlights: { start: number; end: number }[] = [];

  const enumerateRe = safeFlags.includes('g')
    ? re
    : new RegExp(re.source, safeFlags + 'g');

  try {
    let m: RegExpExecArray | null;
    const copy = new RegExp(enumerateRe.source, enumerateRe.flags);
    while ((m = copy.exec(input)) !== null) {
      const val = m[0];
      if (val === '') {
        matches.push({
          index: m.index,
          value: val,
          groups: m.slice(1).map((g) => (g === undefined ? '' : g)),
        });
        highlights.push({ start: m.index, end: m.index });
        copy.lastIndex++;
        if (copy.lastIndex > input.length) break;
        continue;
      }
      matches.push({
        index: m.index,
        value: val,
        groups: m.slice(1).map((g) => (g === undefined ? '' : g)),
      });
      highlights.push({ start: m.index, end: m.index + val.length });
      if (!safeFlags.includes('g')) break;
    }
  } catch (e) {
    return {
      matches: [],
      highlights: [],
      error: e instanceof Error ? e.message : 'Match error',
      replaced: replaceWith !== undefined ? replaced : null,
    };
  }

  return { matches, highlights, error: null, replaced };
}

/** Build HTML string with <mark> around match ranges (non-overlapping assumed). */
export function highlightInputHtml(input: string, highlights: { start: number; end: number }[]): string {
  if (!highlights.length) return escapeHtml(input);
  const sorted = [...highlights].sort((a, b) => a.start - b.start);
  let out = '';
  let cursor = 0;
  for (const h of sorted) {
    if (h.end <= cursor) continue;
    const start = Math.max(h.start, cursor);
    if (start > input.length) break;
    const end = Math.min(h.end, input.length);
    if (start > cursor) out += escapeHtml(input.slice(cursor, start));
    out += `<mark class="bg-amber-500/40 text-white rounded px-0.5">${escapeHtml(input.slice(start, end))}</mark>`;
    cursor = end;
  }
  if (cursor < input.length) out += escapeHtml(input.slice(cursor));
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
