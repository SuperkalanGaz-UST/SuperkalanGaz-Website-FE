/*
 * Authentication against Supabase Auth.
 *
 * Users live entirely in Supabase (auth.users); the CRM claims (role + branch scope)
 * ride in each user's `app_metadata`, which is service-role-only so it can't be
 * self-edited — the same claims the API reads from the JWT. There is no public.profiles
 * table, and we never touch PostgREST (AGENTS.md §4). Supabase Auth is email-based, but
 * the UI logs in by username, so we map `<username>` -> `<username>@superkalan.com`. The
 * seeded staff personas already exist there; any
 * user created via User Management is stored the same way.
 */
import { supabase } from './supabase/client';
import type { User } from '@supabase/supabase-js';
import { apiErrorMessage, apiFetch } from './api';

export type Role = 'super-admin' | 'franchise-admin' | 'branch-owner' | 'branch-manager';

export type Branch = string;

export interface Account {
  id: string;
  username: string;
  role: Role;
  displayName: string;
  email: string;
  phone: string | null;
  status: 'Active' | 'Inactive';
  /** Branches this account can see. SA/FA read across branches; BO/BM are scoped to their own. */
  branches: Branch[];
  /** Authoritative protected UUID scope; branch names above are display-only. */
  branchIds: string[];
}

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
  'super-admin': 'Super Administrator',
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
  'super-admin',
  'franchise-admin',
  'branch-owner',
  'branch-manager',
];

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && VALID_ROLES.includes(value as Role);
}

export function isPendingFranchiseAdminInvitation(user: User): boolean {
  const claims = (user.app_metadata ?? {}) as Record<string, unknown>;
  return claims.role === 'franchise-admin' && claims.status === 'Pending';
}

export function isPendingDeliveryRiderInvitation(user: User): boolean {
  const claims = (user.app_metadata ?? {}) as Record<string, unknown>;
  return claims.role === 'driver' && claims.status === 'Pending';
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
  const branchIds = Array.isArray(claims.branch_ids)
    ? claims.branch_ids.filter((branchId): branchId is string => typeof branchId === 'string')
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
      branchIds: Array.from(new Set(branchIds)),
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
 * Sends Supabase's recovery OTP to the email behind the supplied username.
 * Supabase deliberately returns success for unknown accounts as well, so the
 * login page cannot be used to discover valid staff accounts.
 */
export async function requestPasswordReset(username: string): Promise<AuthActionResult> {
  const email = usernameToEmail(username);
  const { error } = await supabase.auth.resetPasswordForEmail(email);

  return {
    error: error ? 'Could not send the reset code. Please try again later.' : null,
  };
}

/** Exchanges the emailed code for the temporary session used only for recovery. */
export async function verifyPasswordResetCode(
  username: string,
  token: string,
): Promise<AuthActionResult> {
  const email = usernameToEmail(username);
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'recovery',
  });
  return {
    error: error || !data.session
      ? 'This reset code is invalid or has expired. Request a new code.'
      : null,
  };
}

/** Updates the password for the session created by a verified recovery code. */
export async function updatePassword(password: string): Promise<AuthActionResult> {
  const { error } = await supabase.auth.updateUser({ password });
  return {
    error: error ? 'Your recovery session expired. Request a new reset code.' : null,
  };
}

/**
 * Completes the role-locked invitation only after Supabase has verified the
 * single-use email link and the invitee has chosen their own password.
 */
export async function activateFranchiseAdminInvitation(
  password: string,
): Promise<SignInResult> {
  const passwordResult = await supabase.auth.updateUser({ password });
  if (passwordResult.error) {
    return {
      account: null,
      error: 'This invitation link is invalid or has expired. Ask the Super Administrator to resend it.',
    };
  }

  let response: Response;
  try {
    response = await apiFetch('/governance/franchise-admin-invitations/accept', {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return {
      account: null,
      error: 'Your password was saved, but activation could not finish. Please try again.',
    };
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    return {
      account: null,
      error: apiErrorMessage(
        body,
        'This invitation could not be activated. Ask the Super Administrator to resend it.',
      ),
    };
  }

  const refreshed = await supabase.auth.refreshSession();
  if (refreshed.error || !refreshed.data.user) {
    return {
      account: null,
      error: 'Your account was activated. Return to sign in with your new password.',
    };
  }
  return accountFromUser(refreshed.data.user);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
