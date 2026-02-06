-- Xóa toàn bộ bookmarks, categories, boards (để import lại)
-- Chạy trong Supabase SQL Editor. Thứ tự: bookmarks → categories → boards (do foreign key).

BEGIN;

DELETE FROM public.bookmarks;
DELETE FROM public.categories;
DELETE FROM public.boards;

COMMIT;
