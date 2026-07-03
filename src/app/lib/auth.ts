/*
 * Demo-only credential store for the UI prototype.
 *
 * Real authentication is owned by superkalan-crm-api (NestJS): the API issues a
 * JWT whose verified claims (role + branch_id) drive branch scoping. These
 * hardcoded accounts exist solely so the three web personas can be demoed
 * before the API exists — they must be deleted when the API login lands.
 */

export type Role = 'franchise-admin' | 'branch-owner' | 'branch-manager';

export type Branch = 'Quezon City Branch' | 'Makati Branch' | 'Mandaluyong Branch';

export interface Account {
  username: string;
  password: string;
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

export const DEMO_ACCOUNTS: Account[] = [
  {
    username: 'admin',
    password: 'admin123',
    role: 'franchise-admin',
    displayName: 'Franchise Administrator',
    branches: ALL_BRANCHES,
  },
  {
    username: 'owner',
    password: 'owner123',
    role: 'branch-owner',
    displayName: 'Maria Santos — Branch Owner',
    branches: ['Quezon City Branch'],
  },
  {
    // Multi-branch owner kept from the original BO prototype demo.
    username: 'owner.multi',
    password: 'owner123',
    role: 'branch-owner',
    displayName: 'Juan Reyes — Multi-Branch Owner',
    branches: ALL_BRANCHES,
  },
  {
    username: 'manager',
    password: 'manager123',
    role: 'branch-manager',
    displayName: 'Pedro Cruz — Branch Manager',
    branches: ['Quezon City Branch'],
  },
];

export function authenticate(username: string, password: string): Account | null {
  const account = DEMO_ACCOUNTS.find(
    (a) => a.username === username.trim() && a.password === password,
  );
  return account ?? null;
}

export const ROLE_LABELS: Record<Role, string> = {
  'franchise-admin': 'Franchise Administrator',
  'branch-owner': 'Branch Owner',
  'branch-manager': 'Branch Manager',
};
