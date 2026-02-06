-- Chạy riêng trong Supabase SQL Editor
-- Tạo / cập nhật bảng authenticator_entries (TOTP 2FA)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Function updated_at (cần cho trigger; nếu đã có trong DB thì không sao)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bảng
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
