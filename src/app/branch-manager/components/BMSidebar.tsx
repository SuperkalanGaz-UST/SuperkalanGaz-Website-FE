'use client';

import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Truck,
  BarChart3,
  Wrench,
  Gift,
  WalletCards,
  MessageSquare,
  Settings,
} from 'lucide-react';
import { AppSidebar, SidebarNavEntry } from '../../components/AppSidebar';

/**
 * Branch Manager navigation: day-to-day operations for their own branch —
 * service requests, dispatch, inventory, fleet (AGENTS.md §7). Settings is
 * self-service account management only: SLA config remains FA-only and branch
 * configuration remains BO-only.
 */
const NAV_ENTRIES: SidebarNavEntry[] = [
  { icon: LayoutDashboard, label: 'Overview',  id: 'overview' },
  { icon: ShoppingCart,    label: 'Orders',    id: 'orders' },
  { icon: Package,         label: 'Inventory', id: 'inventory' },
  { icon: Users,           label: 'Customers', id: 'customers' },
  { icon: Gift,            label: 'Rewards',   id: 'rewards' },
  { icon: MessageSquare,   label: 'Feedback',  id: 'csat' },
  { icon: Truck,           label: 'Fleet',     id: 'fleet' },
  { icon: Wrench,          label: 'Vehicles',  id: 'vehicles' },
  { icon: WalletCards,     label: 'Monthly Expenses', id: 'expenses' },
  { icon: BarChart3,       label: 'Analytics', id: 'analytics' },
  { icon: Settings,        label: 'Settings',  id: 'settings' },
];

interface BMSidebarProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

export default function BMSidebar({ activeScreen, onNavigate }: BMSidebarProps) {
  return <AppSidebar entries={NAV_ENTRIES} activeScreen={activeScreen} onNavigate={onNavigate} />;
}
