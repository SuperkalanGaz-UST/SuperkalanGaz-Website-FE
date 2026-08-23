'use client';

import {
  LayoutDashboard,
  BarChart3,
  BarChart2,
  TrendingUp,
  Wallet,
  HeartHandshake,
  Star,
  Gift,
  Boxes,
  Bike,
  FileText,
  Users,
  Settings,
} from 'lucide-react';
import { AppSidebar, SidebarNavEntry } from '../../components/AppSidebar';

/**
 * Branch Owner navigation: branch-scoped configuration and analytics only.
 * The shared shell supplies the same expanded/minimized presentation used by
 * Franchise Administrator and Branch Manager without changing this RBAC list.
 */
const NAV_ENTRIES: SidebarNavEntry[] = [
  { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
  {
    icon: BarChart2,
    label: 'Analytics',
    children: [
      { icon: TrendingUp, label: 'Order Analytics', id: 'order-analytics' },
      { icon: BarChart3, label: 'Sales', id: 'sales-overview' },
      { icon: Wallet, label: 'Running Costs', id: 'operational-expenses' },
    ],
  },
  {
    icon: HeartHandshake,
    label: 'Customer',
    children: [
      { icon: Star, label: 'Ratings & Reviews', id: 'csat' },
      { icon: Gift, label: 'Loyalty Program', id: 'loyalty' },
    ],
  },
  {
    icon: Boxes,
    label: 'Operations',
    children: [
      { icon: Boxes, label: 'Inventory', id: 'inventory' },
      { icon: Bike, label: 'Fleet', id: 'fleet-overview' },
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
