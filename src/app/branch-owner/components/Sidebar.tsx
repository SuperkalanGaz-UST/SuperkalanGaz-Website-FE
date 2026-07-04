'use client';

import {
  LayoutDashboard,
  BarChart3,
  HeartHandshake,
  Package,
  FileText,
  Users,
  Settings,
} from 'lucide-react';
import { AppSidebar, SidebarNavEntry } from '../../components/AppSidebar';

/**
 * Branch Owner navigation: branch-scoped configuration and analytics
 * (loyalty catalog, thresholds, BM accounts) — no daily order processing,
 * which is Branch Manager territory (AGENTS.md §7). Every leaf id maps to
 * an existing screen in BranchOwnerApp.
 */
const NAV_ENTRIES: SidebarNavEntry[] = [
  { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
  {
    icon: BarChart3,
    label: 'Analytics',
    children: [
      { label: 'Order Analytics', id: 'order-analytics' },
      { label: 'Sales', id: 'sales-overview' },
      { label: 'Operational Expenses', id: 'operational-expenses' },
    ],
  },
  {
    icon: HeartHandshake,
    label: 'Customer',
    children: [
      { label: 'Ratings & Reviews', id: 'csat' },
      { label: 'Loyalty Program', id: 'loyalty' },
    ],
  },
  {
    icon: Package,
    label: 'Operations',
    children: [
      { label: 'Inventory', id: 'supply-chain' },
      { label: 'Fleet', id: 'fleet-overview' },
    ],
  },
  { icon: Users, label: 'User Management', id: 'user-management' },
  { icon: FileText, label: 'Reports', id: 'reports' },
  { icon: Settings, label: 'Settings', id: 'settings' },
];

interface SidebarProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

export function Sidebar({ activeScreen, onNavigate }: SidebarProps) {
  return <AppSidebar entries={NAV_ENTRIES} activeScreen={activeScreen} onNavigate={onNavigate} />;
}
