import { supabase } from './supabase/client';

/**
 * Client for the superkalan-crm-api backend (NestJS). Every call carries the
 * logged-in user's Supabase access token; the API verifies it and derives the
 * caller's role + branch scope server-side, so nothing here is trusted for
 * authorization.
 */
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

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
