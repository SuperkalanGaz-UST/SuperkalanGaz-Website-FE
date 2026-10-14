'use client';

import { Building2, ClipboardCheck, FileCheck2, LayoutDashboard, Settings, Star, TrendingUp, Users } from 'lucide-react';
import { AppSidebar, SidebarNavEntry } from './AppSidebar';

const PesoIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M5 7h8a4 4 0 0 1 0 8H5V7z" />
    <line x1="5" y1="7" x2="5" y2="20" />
    <line x1="3" y1="11" x2="11" y2="11" />
    <line x1="3" y1="14" x2="11" y2="14" />
  </svg>
);

/**
 * Franchise Administrator navigation: cross-branch read visibility, initial
 * branch onboarding, and governance request submission. Controlled changes
 * are applied only after Super Administrator approval.
 */
const NAV_ENTRIES: SidebarNavEntry[] = [
  { icon: LayoutDashboard, label: 'Dashboard',           id: 'dashboard' },
  { icon: TrendingUp,      label: 'Branch Accounts',     id: 'order-analytics' },
  { icon: Users,           label: 'Customers',           id: 'customers' },
  { icon: Star,            label: 'System CSAT',         id: 'csat' },
  { icon: Building2,       label: 'Franchise Registry',  id: 'franchise-registry' },
  { icon: PesoIcon,        label: 'Price Configuration', id: 'price-config' },
  { icon: ClipboardCheck,  label: 'Governance Requests', id: 'governance-requests' },
  { icon: FileCheck2,      label: 'Account Reviews',     id: 'account-reviews' },
  { icon: Settings,        label: 'Settings',            id: 'account-settings' },
];

interface SidebarProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

export function Sidebar({ activeScreen, onNavigate }: SidebarProps) {
  return <AppSidebar entries={NAV_ENTRIES} activeScreen={activeScreen} onNavigate={onNavigate} />;
}
