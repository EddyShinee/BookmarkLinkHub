/** Fallback dot colors when category.color is not set (schema default #818CF8 = accent). */
export const FALLBACK_DOT_COLORS = [
  '#818CF8', '#10B981', '#A855F7', '#FB923C', '#EC4899', '#3B82F6', '#EAB308', '#06B6D4',
];

/** Droppable id prefix for empty column targets (must match ColumnDroppable). */
export const COLUMN_DROP_PREFIX = 'column-';

/** Line shown when category insert indicators are enabled. */
export const DROP_INDICATOR_CLASS =
  'absolute left-0 right-0 h-[3px] rounded-full bg-accent pointer-events-none z-10 drop-indicator-line';

export const DROP_INDICATOR_BLOCK_CLASS =
  'h-[3px] rounded-full bg-accent pointer-events-none flex-shrink-0 drop-indicator-line';

export function categoryGridColsClass(n: number): string {
  if (n === 2) return 'category-grid-cols-2';
  if (n === 3) return 'category-grid-cols-3';
  if (n === 5) return 'category-grid-cols-5';
  if (n === 6) return 'category-grid-cols-6';
  return 'category-grid-cols-4';
}
