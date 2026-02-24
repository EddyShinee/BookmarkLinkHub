-- Migration: Board category_columns and category column_id + sort_order
-- Chạy trong Supabase SQL Editor sau khi đã có board_columns (trello_columns_cards.sql).

-- ============================================
-- 1. Add category_columns to boards
-- ============================================
ALTER TABLE public.boards
  ADD COLUMN IF NOT EXISTS category_columns INTEGER NULL;

ALTER TABLE public.boards
  DROP CONSTRAINT IF EXISTS boards_category_columns_check;

ALTER TABLE public.boards
  ADD CONSTRAINT boards_category_columns_check
  CHECK (category_columns IS NULL OR (category_columns BETWEEN 2 AND 6));

-- ============================================
-- 2. Backfill: ensure every board has at least one board_column
-- ============================================
INSERT INTO public.board_columns (board_id, name, sort_order)
SELECT b.id, 'Column 1', 0
FROM public.boards b
WHERE NOT EXISTS (
  SELECT 1 FROM public.board_columns bc WHERE bc.board_id = b.id
);

-- ============================================
-- 3. Add column_id to categories
-- ============================================
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS column_id UUID NULL
  REFERENCES public.board_columns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS categories_column_id_idx ON public.categories(column_id);

-- ============================================
-- 4. Backfill: set category.column_id to first column of its board
-- ============================================
UPDATE public.categories c
SET column_id = (
  SELECT bc.id
  FROM public.board_columns bc
  WHERE bc.board_id = c.board_id
  ORDER BY bc.sort_order ASC, bc.created_at ASC
  LIMIT 1
)
WHERE c.column_id IS NULL;
