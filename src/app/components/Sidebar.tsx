import { LayoutDashboard, TrendingUp, Star, Settings, Users } from 'lucide-react';
import { AppSidebar, SidebarNavItem } from './AppSidebar';

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
 * Franchise Administrator navigation: cross-branch READ visibility plus the
 * two FA-only writes (SLA/branch-account config lives under these screens).
 * No operational screens — FA has no operational write actions (AGENTS.md §7).
 */
const NAV_ITEMS: SidebarNavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard',           id: 'dashboard' },
  { icon: TrendingUp,      label: 'Branch Accounts',     id: 'order-analytics' },
  { icon: Users,           label: 'Customers',           id: 'customers' },
  { icon: Star,            label: 'System CSAT',         id: 'csat' },
  { icon: Settings,        label: 'Franchise Registry',  id: 'settings' },
  { icon: PesoIcon,        label: 'Price Configuration', id: 'price-config' },
];

interface SidebarProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

export function Sidebar({ activeScreen, onNavigate }: SidebarProps) {
  return (
    <AppSidebar
      navItems={NAV_ITEMS}
      activeScreen={activeScreen}
      onNavigate={onNavigate}
      badge={
        <div className="bg-[#1E3A5F] text-white text-xs px-3 py-1 rounded-full font-medium self-center">
          Main Office
        </div>
      }
    />
  );
}
