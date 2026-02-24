-- Migration: Board category_sort_order (sắp xếp category theo từng board)
-- Chạy trong Supabase SQL Editor.

ALTER TABLE public.boards
  ADD COLUMN IF NOT EXISTS category_sort_order TEXT NULL;

ALTER TABLE public.boards
  DROP CONSTRAINT IF EXISTS boards_category_sort_order_check;

ALTER TABLE public.boards
  ADD CONSTRAINT boards_category_sort_order_check
  CHECK (category_sort_order IS NULL OR category_sort_order IN ('created_asc', 'created_desc', 'name_asc', 'name_desc'));
