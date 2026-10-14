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

// Keep the validated values narrowed inside the client factory closure.
const supabaseUrl = url;
const supabaseAnonKey = anonKey;

const AUTH_REQUEST_TIMEOUT_MS = 8_000;

/**
 * Supabase's default browser fetch has no upper time limit. Bound Auth calls so
 * an unreachable token endpoint cannot hold client initialization forever.
 */
const fetchWithTimeout: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const sourceSignal = init?.signal;
  const forwardAbort = () => controller.abort(sourceSignal?.reason);

  if (sourceSignal?.aborted) {
    forwardAbort();
  } else {
    sourceSignal?.addEventListener('abort', forwardAbort, { once: true });
  }

  const timeout = setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    sourceSignal?.removeEventListener('abort', forwardAbort);
  }
};

function createSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      fetch: fetchWithTimeout,
    },
  });
}

type SupabaseBrowserGlobal = typeof globalThis & {
  __superkalanSupabaseClient?: ReturnType<typeof createSupabaseClient>;
};

const browserGlobal = globalThis as SupabaseBrowserGlobal;
const reusableDevClient =
  process.env.NODE_ENV !== 'production' && typeof window !== 'undefined'
    ? browserGlobal.__superkalanSupabaseClient
    : undefined;

export const supabase = reusableDevClient ?? createSupabaseClient();

// Next.js Fast Refresh can re-evaluate this module. Reusing the browser client
// prevents duplicate refresh loops and auth subscriptions during development.
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  browserGlobal.__superkalanSupabaseClient = supabase;
}
