import { createClient } from '@supabase/supabase-js';

/**
 * Browser Supabase client. Uses the publishable (anon) key, which is safe to ship
 * to the client. Application data is accessed only through the NestJS API, where
 * JWT guards and service-layer branch scoping enforce authorization. This client
 * is used only for Supabase Auth and holds the logged-in user's session.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local.',
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
