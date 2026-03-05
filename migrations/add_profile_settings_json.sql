-- One-time migration: add settings_json column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS settings_json JSONB DEFAULT '{}'::jsonb;

