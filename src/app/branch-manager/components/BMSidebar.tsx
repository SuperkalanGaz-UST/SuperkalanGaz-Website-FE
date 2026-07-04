'use client';

import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Truck,
  BarChart3,
  Wrench,
} from 'lucide-react';
import { AppSidebar, SidebarNavItem } from '../../components/AppSidebar';
import { useAccount } from '../../contexts/AccountContext';

/**
 * Branch Manager navigation: day-to-day operations for their own branch —
 * service requests, dispatch, inventory, fleet (AGENTS.md §7). No settings
 * or threshold screens: SLA config is FA-only, branch config is BO-only.
 */
const NAV_ITEMS: SidebarNavItem[] = [
  { icon: LayoutDashboard, label: 'Overview',  id: 'overview' },
  { icon: ShoppingCart,    label: 'Orders',    id: 'orders' },
  { icon: Package,         label: 'Inventory', id: 'inventory' },
  { icon: Users,           label: 'Customers', id: 'customers' },
  { icon: Truck,           label: 'Fleet',     id: 'fleet' },
  { icon: Wrench,          label: 'Vehicles',  id: 'vehicles' },
  { icon: BarChart3,       label: 'Analytics', id: 'analytics' },
];

interface BMSidebarProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

export default function BMSidebar({ activeScreen, onNavigate }: BMSidebarProps) {
  // BM is strictly single-branch (AGENTS.md §5) — show it as a static chip.
  const account = useAccount();
  const branch = account.branches[0];

  return (
    <AppSidebar
      navItems={NAV_ITEMS}
      activeScreen={activeScreen}
      onNavigate={onNavigate}
      badge={
        branch ? (
          <div className="w-full bg-[#CC1903] text-white text-xs px-3 py-1 rounded-full font-medium text-center">
            {branch}
          </div>
        ) : undefined
      }
    />
  );
}
