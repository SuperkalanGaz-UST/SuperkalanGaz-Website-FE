import type { Role } from './auth';

// Explicit destinations keep arbitrary URLs and legacy navigation events from
// selecting screens outside a persona's existing interface. API guards remain
// authoritative for permissions and branch scope.
const SCREEN_PATHS: Record<Role, Readonly<Record<string, string>>> = {
  'super-admin': {
    dashboard: 'dashboard',
    'approval-requests': 'approval-requests',
    'admin-accounts': 'franchise-administrators',
    'account-approval-logs': 'account-approval-logs',
    'price-change-logs': 'price-change-logs',
    'branch-owner-logs': 'branch-owner-logs',
    'audit-security': 'audit-security',
    settings: 'settings',
  },
  'franchise-admin': {
    dashboard: 'dashboard',
    'order-analytics': 'order-analytics',
    customers: 'customers',
    'customer-detail': 'customer-detail',
    csat: 'csat',
    'franchise-registry': 'franchise-registry',
    'price-config': 'price-configuration',
    'governance-requests': 'governance-requests',
    'account-reviews': 'account-reviews',
    'account-settings': 'settings',
    'delivery-completion-full': 'delivery-completion',
    'complaint-log-full': 'complaint-log',
    'customer-ratings-full': 'customer-ratings',
  },
  'branch-owner': {
    dashboard: 'dashboard',
    'order-analytics': 'order-analytics',
    'sales-overview': 'sales-overview',
    'operational-expenses': 'operational-expenses',
    customers: 'customers',
    csat: 'csat',
    loyalty: 'loyalty',
    inventory: 'inventory',
    reports: 'reports',
    'fleet-overview': 'fleet',
    'user-management': 'user-management',
    settings: 'settings',
    'sales-full': 'sales',
    'expenses-log-full': 'expenses-log',
    'delivery-completion-full': 'delivery-completion',
    'delivery-proof-full': 'delivery-proof',
    'complaint-log-full': 'complaint-log',
    'purchase-tracker-full': 'purchase-tracker',
    'redemption-history-full': 'redemption-history',
    'reorder-log-full': 'reorder-log',
    'customer-ratings-full': 'customer-ratings',
  },
  'branch-manager': {
    overview: 'dashboard',
    orders: 'service-requests',
    inventory: 'inventory',
    customers: 'customers',
    rewards: 'rewards',
    csat: 'csat',
    fleet: 'fleet',
    vehicles: 'vehicles',
    analytics: 'analytics',
    expenses: 'expenses',
    settings: 'settings',
  },
};

export function isStaffRole(value: string): value is Role {
  return Object.prototype.hasOwnProperty.call(SCREEN_PATHS, value);
}

export function staffScreenPath(role: Role, screen: string): string | null {
  const screens = SCREEN_PATHS[role];
  return Object.prototype.hasOwnProperty.call(screens, screen)
    ? `/${role}/${screens[screen]}`
    : null;
}

export function staffDashboardPath(role: Role): string {
  return `/${role}/dashboard`;
}

export function staffRouteParams(): { role: Role; screen: string[] }[] {
  return (Object.keys(SCREEN_PATHS) as Role[]).flatMap((role) => [
    { role, screen: [] },
    ...Object.values(SCREEN_PATHS[role]).map((path) => ({ role, screen: [path] })),
  ]);
}

export function resolveStaffRoute(pathname: string): { role: Role; screen: string } | null {
  const parts = pathname.split('/');
  if (parts.length !== 3 || !isStaffRole(parts[1])) return null;
  const role = parts[1];
  const match = Object.entries(SCREEN_PATHS[role]).find(([, path]) => path === parts[2]);
  return match ? { role, screen: match[0] } : null;
}
