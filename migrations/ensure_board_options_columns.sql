-- Migration: Đảm bảo bảng boards có đủ cột cho Board Options (số cột + sắp xếp)
-- Chạy trong Supabase SQL Editor nếu chưa chạy các migration trước đó.

-- 1. category_columns (số cột danh mục 2-6)
ALTER TABLE public.boards
  ADD COLUMN IF NOT EXISTS category_columns INTEGER NULL;

ALTER TABLE public.boards
  DROP CONSTRAINT IF EXISTS boards_category_columns_check;

ALTER TABLE public.boards
  ADD CONSTRAINT boards_category_columns_check
  CHECK (category_columns IS NULL OR (category_columns BETWEEN 2 AND 6));

-- 2. category_sort_order (sắp xếp category theo từng board)
ALTER TABLE public.boards
  ADD COLUMN IF NOT EXISTS category_sort_order TEXT NULL;

ALTER TABLE public.boards
  DROP CONSTRAINT IF EXISTS boards_category_sort_order_check;

ALTER TABLE public.boards
  ADD CONSTRAINT boards_category_sort_order_check
  CHECK (category_sort_order IS NULL OR category_sort_order IN ('created_asc', 'created_desc', 'name_asc', 'name_desc'));
