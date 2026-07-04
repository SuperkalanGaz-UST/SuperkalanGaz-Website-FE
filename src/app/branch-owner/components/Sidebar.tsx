'use client';

import { useState, useEffect, ComponentType } from 'react';
import {
  LayoutDashboard,
  BarChart3,
  HeartHandshake,
  Package,
  FileText,
  Users,
  Settings,
  ChevronDown,
} from 'lucide-react';

/**
 * Branch Owner navigation: branch-scoped configuration and analytics
 * (loyalty catalog, thresholds, BM accounts) — no daily order processing,
 * which is Branch Manager territory (AGENTS.md §7).
 *
 * Grouped nav: top-level links plus collapsible sections. Every leaf id maps
 * to an existing screen in BranchOwnerApp, so RBAC-visible screens are
 * unchanged — only the navigation structure is.
 */
interface NavLeaf {
  label: string;
  id: string;
}

interface NavEntry {
  icon: ComponentType<{ className?: string }>;
  label: string;
  /** Present on plain links; absent on collapsible groups. */
  id?: string;
  children?: NavLeaf[];
}

const NAV_ENTRIES: NavEntry[] = [
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

/** Group label whose children include the given screen, if any. */
function groupOf(screenId: string): string | undefined {
  return NAV_ENTRIES.find((entry) =>
    entry.children?.some((child) => child.id === screenId),
  )?.label;
}

export function Sidebar({ activeScreen, onNavigate }: SidebarProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const group = groupOf(activeScreen);
    return group ? { [group]: true } : {};
  });

  // Keep the group holding the active screen expanded when navigation happens
  // from outside the sidebar (e.g. window 'navigate' events, drill-in screens).
  useEffect(() => {
    const group = groupOf(activeScreen);
    if (group) {
      setOpenGroups((prev) => (prev[group] ? prev : { ...prev, [group]: true }));
    }
  }, [activeScreen]);

  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  return (
    <div className="w-[240px] bg-[#00568A] text-white h-screen flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="p-4">
        <div className="bg-white rounded-lg p-3 flex items-center justify-center">
          <img src="/superkalan-gaz.png" alt="Superkalan Gaz" className="w-full h-auto" />
        </div>
      </div>

      {/* Navigation — active item is a full-width lighter-blue highlight */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {NAV_ENTRIES.map((entry) => {
          if (!entry.children) {
            const isActive = activeScreen === entry.id;
            return (
              <button
                key={entry.label}
                type="button"
                onClick={() => onNavigate(entry.id!)}
                className={`w-full flex items-center gap-3 px-6 py-2.5 transition-colors ${
                  isActive ? 'bg-[#1D8DCB] text-white' : 'text-white/90 hover:bg-white/10'
                }`}
              >
                <entry.icon className="w-[18px] h-[18px] flex-shrink-0" />
                <span className="text-sm font-medium">{entry.label}</span>
              </button>
            );
          }

          const isOpen = !!openGroups[entry.label];
          const hasActiveChild = entry.children.some((child) => child.id === activeScreen);
          return (
            <div key={entry.label}>
              <button
                type="button"
                onClick={() => toggleGroup(entry.label)}
                aria-expanded={isOpen}
                className={`w-full flex items-center gap-3 px-6 py-2.5 transition-colors ${
                  hasActiveChild && !isOpen
                    ? 'bg-[#1D8DCB]/40 text-white'
                    : 'text-white/90 hover:bg-white/10'
                }`}
              >
                <entry.icon className="w-[18px] h-[18px] flex-shrink-0" />
                <span className="text-sm font-medium flex-1 text-left">{entry.label}</span>
                <ChevronDown
                  className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isOpen &&
                entry.children.map((child) => {
                  const isActive = activeScreen === child.id;
                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => onNavigate(child.id)}
                      className={`w-full flex items-center pl-[3.25rem] pr-6 py-2 transition-colors ${
                        isActive ? 'bg-[#1D8DCB] text-white' : 'text-white/75 hover:bg-white/10'
                      }`}
                    >
                      <span className="text-sm">{child.label}</span>
                    </button>
                  );
                })}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
