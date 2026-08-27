'use client';

import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Truck,
  BarChart2,
  BarChart3,
  Wrench,
  Gift,
  WalletCards,
  MessageSquare,
  Settings,
  HeartHandshake,
  Boxes,
} from 'lucide-react';
import { AppSidebar, SidebarNavEntry } from '../../components/AppSidebar';

/**
 * Branch Manager navigation: day-to-day operations for their own branch —
 * service requests, dispatch, inventory, fleet (AGENTS.md §7). Settings is
 * self-service account management only: SLA config remains FA-only and branch
 * configuration remains BO-only.
 *
 * Grouped to match the Branch Owner sidebar's category style (the shared
 * AppSidebar shell already renders ANALYTICS/CUSTOMER/OPERATIONS-style
 * headers whenever an entry carries `children` — see Sidebar.tsx). Every
 * original BM destination is still here, just organized under a category
 * instead of one flat list.
 */
const NAV_ENTRIES: SidebarNavEntry[] = [
  { icon: LayoutDashboard, label: 'Overview', id: 'overview' },
  {
    icon: BarChart2,
    label: 'Analytics',
    children: [
      { icon: BarChart3,   label: 'Analytics',        id: 'analytics' },
      { icon: WalletCards, label: 'Monthly Expenses',  id: 'expenses' },
    ],
  },
  {
    icon: HeartHandshake,
    label: 'Customer',
    children: [
      { icon: Users,           label: 'Customers', id: 'customers' },
      { icon: Gift,            label: 'Rewards',   id: 'rewards' },
      { icon: MessageSquare,   label: 'Feedback',  id: 'csat' },
    ],
  },
  {
    icon: Boxes,
    label: 'Operations',
    children: [
      { icon: ShoppingCart, label: 'Orders',    id: 'orders' },
      { icon: Package,      label: 'Inventory', id: 'inventory' },
      { icon: Truck,        label: 'Fleet',     id: 'fleet' },
      { icon: Wrench,       label: 'Vehicles',  id: 'vehicles' },
    ],
  },
  { icon: Settings, label: 'Settings', id: 'settings' },
];

interface BMSidebarProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

export default function BMSidebar({ activeScreen, onNavigate }: BMSidebarProps) {
  return <AppSidebar entries={NAV_ENTRIES} activeScreen={activeScreen} onNavigate={onNavigate} />;
}
