/*
 * Authentication against Supabase Auth.
 *
 * Users live in Supabase (auth.users) with a matching row in public.profiles that
 * carries the CRM claims (role + branch scope). Supabase Auth is email-based, but the
 * UI logs in by username, so we map `<username>` -> `<username>@superkalan.com`. The
 * four seed personas (admin / owner / owner.multi / manager) already exist there; any
 * user created via User Management is stored the same way.
 */
import { supabase } from './supabase/client';

export type Role = 'franchise-admin' | 'branch-owner' | 'branch-manager';

export type Branch = 'Quezon City Branch' | 'Makati Branch' | 'Mandaluyong Branch';

export interface Account {
  username: string;
  role: Role;
  displayName: string;
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

/**
 * Sign in against Supabase Auth and load the user's CRM profile. On success the session
 * is persisted by the Supabase client; returns the Account the app renders from.
 */
export async function signIn(username: string, password: string): Promise<SignInResult> {
  const email = usernameToEmail(username);

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { account: null, error: 'Invalid username or password' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('username, display_name, role, branches, status')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return { account: null, error: 'Your account has no profile. Contact an administrator.' };
  }

  if (profile.status !== 'Active') {
    await supabase.auth.signOut();
    return { account: null, error: 'This account is inactive.' };
  }

  return {
    account: {
      username: profile.username ?? username,
      role: profile.role as Role,
      displayName: profile.display_name ?? profile.username ?? username,
      branches: (profile.branches ?? []) as Branch[],
    },
    error: null,
  };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
