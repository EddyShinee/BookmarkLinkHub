import { createClient } from '@supabase/supabase-js';
import { chromeStorageAdapter } from './chromeStorageAdapter';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !key) {
  console.warn('[LinkHub] Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY. Tạo file .env.');
}

export const supabase = createClient(url ?? '', key ?? '', {
  auth: {
    storage: chromeStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
