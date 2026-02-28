-- EddyLinkHub Database Schema
-- Run this SQL in Supabase SQL Editor to create all necessary tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE
-- Extends auth.users with additional fields
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    locale TEXT DEFAULT 'vi' CHECK (locale IN ('vi', 'en')),
    background_color TEXT DEFAULT '#0F172A',
    start_on_landing BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ============================================
-- BOARDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.boards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    category_columns INTEGER NULL CHECK (category_columns BETWEEN 2 AND 6),
    category_sort_order TEXT NULL CHECK (category_sort_order IN ('created_asc', 'created_desc', 'name_asc', 'name_desc')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS boards_user_id_idx ON public.boards(user_id);

-- Enable RLS
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

-- Boards policies
CREATE POLICY "Users can view own boards"
    ON public.boards FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own boards"
    ON public.boards FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own boards"
    ON public.boards FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own boards"
    ON public.boards FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- LANDING TODOS TABLE
-- Simple per-user todo list for landing page
-- ============================================
CREATE TABLE IF NOT EXISTS public.landing_todos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    done BOOLEAN NOT NULL DEFAULT FALSE,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS landing_todos_user_id_idx ON public.landing_todos(user_id);

ALTER TABLE public.landing_todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own landing todos"
    ON public.landing_todos FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can modify own landing todos"
    ON public.landing_todos FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own landing todos"
    ON public.landing_todos FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own landing todos"
    ON public.landing_todos FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- BOARD_COLUMNS TABLE (Kanban columns per board)
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

-- ============================================
-- CATEGORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
    column_id UUID NULL REFERENCES public.board_columns(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#818CF826',
    icon TEXT DEFAULT 'folder',
    bg_opacity INTEGER DEFAULT 15,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS categories_board_id_idx ON public.categories(board_id);
CREATE INDEX IF NOT EXISTS categories_column_id_idx ON public.categories(column_id);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Categories policies (check board ownership)
CREATE POLICY "Users can view categories in own boards"
    ON public.categories FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.boards
            WHERE boards.id = categories.board_id
            AND boards.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create categories in own boards"
    ON public.categories FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.boards
            WHERE boards.id = board_id
            AND boards.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update categories in own boards"
    ON public.categories FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.boards
            WHERE boards.id = categories.board_id
            AND boards.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete categories in own boards"
    ON public.categories FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.boards
            WHERE boards.id = categories.board_id
            AND boards.user_id = auth.uid()
        )
    );

-- ============================================
-- BOOKMARKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    -- Trello-style: optional card reference (future use)
    card_id UUID REFERENCES public.cards(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS bookmarks_category_id_idx ON public.bookmarks(category_id);

-- Enable RLS
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- Bookmarks policies (check category -> board ownership)
CREATE POLICY "Users can view bookmarks in own boards"
    ON public.bookmarks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.categories
            JOIN public.boards ON boards.id = categories.board_id
            WHERE categories.id = bookmarks.category_id
            AND boards.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create bookmarks in own boards"
    ON public.bookmarks FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.categories
            JOIN public.boards ON boards.id = categories.board_id
            WHERE categories.id = category_id
            AND boards.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update bookmarks in own boards"
    ON public.bookmarks FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.categories
            JOIN public.boards ON boards.id = categories.board_id
            WHERE categories.id = bookmarks.category_id
            AND boards.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete bookmarks in own boards"
    ON public.bookmarks FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.categories
            JOIN public.boards ON boards.id = categories.board_id
            WHERE categories.id = bookmarks.category_id
            AND boards.user_id = auth.uid()
        )
    );

-- ============================================
-- AUTHENTICATOR_ENTRIES TABLE (TOTP 2FA)
-- ============================================
CREATE TABLE IF NOT EXISTS public.authenticator_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    issuer TEXT NOT NULL DEFAULT 'Unknown',
    account_name TEXT NOT NULL DEFAULT 'Account',
    secret TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS authenticator_entries_user_id_idx ON public.authenticator_entries(user_id);

ALTER TABLE public.authenticator_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own authenticator entries"
    ON public.authenticator_entries FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own authenticator entries"
    ON public.authenticator_entries FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own authenticator entries"
    ON public.authenticator_entries FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own authenticator entries"
    ON public.authenticator_entries FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- TRIGGER: Create profile on user signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- TRIGGER: Update updated_at on changes
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS boards_updated_at ON public.boards;
CREATE TRIGGER boards_updated_at
    BEFORE UPDATE ON public.boards
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS board_columns_updated_at ON public.board_columns;
CREATE TRIGGER board_columns_updated_at
    BEFORE UPDATE ON public.board_columns
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS categories_updated_at ON public.categories;
CREATE TRIGGER categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS bookmarks_updated_at ON public.bookmarks;
CREATE TRIGGER bookmarks_updated_at
    BEFORE UPDATE ON public.bookmarks
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS authenticator_entries_updated_at ON public.authenticator_entries;
CREATE TRIGGER authenticator_entries_updated_at
    BEFORE UPDATE ON public.authenticator_entries
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- ============================================
-- ONE-TIME: Cập nhật / tạo authenticator_entries (chạy trong Supabase SQL Editor)
-- Copy và chạy khối dưới nếu bạn cần thêm bảng vào DB đã có sẵn
-- ============================================
/*
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.authenticator_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    issuer TEXT NOT NULL DEFAULT 'Unknown',
    account_name TEXT NOT NULL DEFAULT 'Account',
    secret TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS authenticator_entries_user_id_idx ON public.authenticator_entries(user_id);

ALTER TABLE public.authenticator_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own authenticator entries" ON public.authenticator_entries;
DROP POLICY IF EXISTS "Users can create own authenticator entries" ON public.authenticator_entries;
DROP POLICY IF EXISTS "Users can update own authenticator entries" ON public.authenticator_entries;
DROP POLICY IF EXISTS "Users can delete own authenticator entries" ON public.authenticator_entries;

CREATE POLICY "Users can view own authenticator entries"
    ON public.authenticator_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own authenticator entries"
    ON public.authenticator_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own authenticator entries"
    ON public.authenticator_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own authenticator entries"
    ON public.authenticator_entries FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS authenticator_entries_updated_at ON public.authenticator_entries;
CREATE TRIGGER authenticator_entries_updated_at
    BEFORE UPDATE ON public.authenticator_entries
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

GRANT ALL ON public.authenticator_entries TO anon, authenticated;
*/
