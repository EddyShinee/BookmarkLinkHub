-- Migration: Trello-style board columns and cards
-- Chạy trong Supabase SQL Editor để thêm data model Kanban (board/cột/thẻ).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ensure updated_at trigger function exists
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- BOARD_COLUMNS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.board_columns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS board_columns_board_id_idx ON public.board_columns(board_id);

ALTER TABLE public.board_columns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view columns in own boards" ON public.board_columns;
DROP POLICY IF EXISTS "Users can create columns in own boards" ON public.board_columns;
DROP POLICY IF EXISTS "Users can update columns in own boards" ON public.board_columns;
DROP POLICY IF EXISTS "Users can delete columns in own boards" ON public.board_columns;

CREATE POLICY "Users can view columns in own boards"
    ON public.board_columns FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.boards
            WHERE boards.id = board_columns.board_id
            AND boards.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create columns in own boards"
    ON public.board_columns FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.boards
            WHERE boards.id = board_id
            AND boards.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update columns in own boards"
    ON public.board_columns FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.boards
            WHERE boards.id = board_columns.board_id
            AND boards.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete columns in own boards"
    ON public.board_columns FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.boards
            WHERE boards.id = board_columns.board_id
            AND boards.user_id = auth.uid()
        )
    );

DROP TRIGGER IF EXISTS board_columns_updated_at ON public.board_columns;
CREATE TRIGGER board_columns_updated_at
    BEFORE UPDATE ON public.board_columns
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- CARDS TABLE (Kanban cards per column)
-- ============================================
CREATE TABLE IF NOT EXISTS public.cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
    column_id UUID NOT NULL REFERENCES public.board_columns(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cards_board_id_idx ON public.cards(board_id);
CREATE INDEX IF NOT EXISTS cards_column_id_idx ON public.cards(column_id);

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view cards in own boards" ON public.cards;
DROP POLICY IF EXISTS "Users can create cards in own boards" ON public.cards;
DROP POLICY IF EXISTS "Users can update cards in own boards" ON public.cards;
DROP POLICY IF EXISTS "Users can delete cards in own boards" ON public.cards;

CREATE POLICY "Users can view cards in own boards"
    ON public.cards FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.boards
            WHERE boards.id = cards.board_id
            AND boards.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create cards in own boards"
    ON public.cards FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.boards
            WHERE boards.id = board_id
            AND boards.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update cards in own boards"
    ON public.cards FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.boards
            WHERE boards.id = cards.board_id
            AND boards.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete cards in own boards"
    ON public.cards FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.boards
            WHERE boards.id = cards.board_id
            AND boards.user_id = auth.uid()
        )
    );

DROP TRIGGER IF EXISTS cards_updated_at ON public.cards;
CREATE TRIGGER cards_updated_at
    BEFORE UPDATE ON public.cards
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- BOOKMARKS: optional card_id for future use
-- ============================================
ALTER TABLE public.bookmarks
    ADD COLUMN IF NOT EXISTS card_id UUID REFERENCES public.cards(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS bookmarks_card_id_idx ON public.bookmarks(card_id);

