/**
 * Supabase Client Configuration
 * 
 * Initializes the Supabase client with project URL and anon key.
 * These values come from your Supabase project dashboard:
 * Settings → API → Project URL and anon/public key.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
        '[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env\n' +
        'Auth features will not work until these are configured.'
    );
}

export const supabase = createClient(
    supabaseUrl || '',
    supabaseAnonKey || ''
);
