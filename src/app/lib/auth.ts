/*
 * Authentication against Supabase Auth.
 *
 * Users live entirely in Supabase (auth.users); the CRM claims (role + branch scope)
 * ride in each user's `app_metadata`, which is service-role-only so it can't be
 * self-edited — the same claims the API reads from the JWT. There is no public.profiles
 * table, and we never touch PostgREST (AGENTS.md §4). Supabase Auth is email-based, but
 * the UI logs in by username, so we map `<username>` -> `<username>@superkalan.com`. The
 * four seed personas (admin / owner / owner.multi / manager) already exist there; any
 * user created via User Management is stored the same way.
 */
import { supabase } from './supabase/client';
import type { User } from '@supabase/supabase-js';

export type Role = 'franchise-admin' | 'branch-owner' | 'branch-manager';

export type Branch = 'Quezon City Branch' | 'Makati Branch' | 'Mandaluyong Branch';

export interface Account {
  id: string;
  username: string;
  role: Role;
  displayName: string;
  email: string;
  phone: string | null;
  status: 'Active' | 'Inactive';
  /** Branches this account can see. FA reads across all branches; BO/BM are scoped to their own. */
  branches: Branch[];
}

export const ALL_BRANCHES: Branch[] = [
  'Quezon City Branch',
  'Makati Branch',
  'Mandaluyong Branch',
];

/** Email domain used to derive a login email from a username. */
export const LOGIN_EMAIL_DOMAIN = 'superkalan.com';

/** `admin` -> `admin@superkalan.com`; an input that already looks like an email is passed through. */
export function usernameToEmail(username: string): string {
  const u = username.trim();
  return u.includes('@') ? u : `${u}@${LOGIN_EMAIL_DOMAIN}`;
}

/** Demo credentials shown on the login screen. These map to real Supabase users. */
export const DEMO_ACCOUNTS: { username: string; password: string; role: Role }[] = [
  { username: 'admin', password: 'admin123', role: 'franchise-admin' },
  { username: 'owner', password: 'owner123', role: 'branch-owner' },
  { username: 'owner.multi', password: 'owner123', role: 'branch-owner' },
  { username: 'manager', password: 'manager123', role: 'branch-manager' },
];

export const ROLE_LABELS: Record<Role, string> = {
  'franchise-admin': 'Franchise Administrator',
  'branch-owner': 'Branch Owner',
  'branch-manager': 'Branch Manager',
};

export interface SignInResult {
  account: Account | null;
  error: string | null;
}

export interface AuthActionResult {
  error: string | null;
}

const VALID_ROLES: readonly Role[] = [
  'franchise-admin',
  'branch-owner',
  'branch-manager',
];

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && VALID_ROLES.includes(value as Role);
}

/**
 * Builds the UI account from the authenticated Supabase user. This is shared by
 * fresh sign-in and page-refresh restoration so both paths enforce the same
 * role/status checks. The API remains authoritative for authorization.
 */
export function accountFromUser(user: User, usernameFallback?: string): SignInResult {
  const claims = (user.app_metadata ?? {}) as Record<string, unknown>;

  if (!isRole(claims.role)) {
    return {
      account: null,
      error: 'Your account has no valid role assigned. Contact an administrator.',
    };
  }

  if (claims.status !== undefined && claims.status !== 'Active') {
    return { account: null, error: 'This account is inactive.' };
  }

  const claimUsername = typeof claims.username === 'string' ? claims.username : null;
  const username =
    claimUsername ?? usernameFallback ?? user.email?.split('@')[0] ?? user.id;
  const displayName =
    typeof claims.display_name === 'string' ? claims.display_name : username;
  const branches = Array.isArray(claims.branches)
    ? claims.branches.filter((branch): branch is string => typeof branch === 'string')
    : [];

  return {
    account: {
      id: user.id,
      username,
      role: claims.role,
      displayName,
      email: user.email ?? '',
      phone: typeof claims.phone === 'string' ? claims.phone : null,
      status: 'Active',
      branches: Array.from(new Set(branches)) as Branch[],
    },
    error: null,
  };
}

/**
 * Sign in against Supabase Auth and read the user's CRM claims from the auth
 * session. On success the session is persisted by the Supabase client; returns
 * the Account the app renders from. The claims come straight off the signed-in
 * user's `app_metadata` — no profiles table, no PostgREST read.
 */
export async function signIn(username: string, password: string): Promise<SignInResult> {
  const email = usernameToEmail(username);

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { account: null, error: 'Invalid username or password' };
  }

  const result = accountFromUser(data.user, username);
  if (!result.account) {
    await supabase.auth.signOut();
    return result;
  }

  return result;
}

/**
 * Sends Supabase's single-use recovery link to the email behind the supplied
 * username. Supabase deliberately returns success for unknown accounts as well,
 * so the welcome page cannot be used to discover valid staff logins.
 */
export async function requestPasswordReset(
  username: string,
  redirectTo: string,
): Promise<AuthActionResult> {
  const email = usernameToEmail(username);
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  return {
    error: error ? 'Could not send the reset link. Please try again later.' : null,
  };
}

/** Updates the password for the recovery session created by Supabase's email link. */
export async function updatePassword(password: string): Promise<AuthActionResult> {
  const { error } = await supabase.auth.updateUser({ password });
  return {
    error: error ? 'This reset link is invalid or has expired. Request a new link.' : null,
  };
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
