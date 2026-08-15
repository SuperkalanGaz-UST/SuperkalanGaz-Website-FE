import { supabase } from './supabase/client';

/**
 * Client for the superkalan-crm-api backend (NestJS). Every call carries the
 * logged-in user's Supabase access token; the API verifies it and derives the
 * caller's role + branch scope server-side, so nothing here is trusted for
 * authorization.
 */
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let { data } = await supabase.auth.getSession();
  let session = data.session;

  // If the session is missing or the token is within 30 s of expiry, refresh it
  // so we never send an expired Bearer token to the API (which would 401 and
  // clear the order list on the next poll).
  const expiresAt = session?.expires_at ?? 0;
  if (!session || Date.now() >= expiresAt * 1000 - 30_000) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed.session) session = refreshed.session;
  }

  const token = session?.access_token;

  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(`${BASE_URL}/api${path}`, { ...init, headers });
}

/**
 * NestJS reports errors as { message: string | string[] } (validation errors
 * arrive as an array); older-style handlers used { error }. Normalize both.
 */
export function apiErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const { message, error } = data as { message?: string | string[]; error?: string };
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
    if (typeof error === 'string') return error;
  }
  return fallback;
}
