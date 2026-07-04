import 'server-only';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase admin client. Uses the service_role key, which bypasses RLS
 * and can call the Auth Admin API (create/update/delete users). This must NEVER be
 * imported into a client component — the `server-only` guard makes such an import a
 * build error. It is used exclusively by the /api/users route handlers.
 *
 * Created lazily so the module can be imported during `next build` (page-data
 * collection) without the key present; it only errors when a request actually uses it.
 */
let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Set them in .env.local (service_role key from the Supabase dashboard) to manage users.',
    );
  }

  client = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
