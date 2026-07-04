'use client';

import { ComponentType, ReactNode } from 'react';
import { useAccount } from '../contexts/AccountContext';
import { ROLE_LABELS } from '../lib/auth';

/**
 * Unified sidebar shell for all three web personas (FA / BO / BM). One visual
 * format everywhere; what differs per persona is DATA, not styling:
 *  - `navItems`: the screens that persona may reach (RBAC per AGENTS.md §7 —
 *    the UI must not render actions a role can't perform)
 *  - `badge`: the context chip under the logo (FA: Main Office, BO: branch
 *    selector, BM: their branch)
 * The footer always shows the real logged-in account from AccountContext.
 */
export interface SidebarNavItem {
  icon: ComponentType<{ className?: string }>;
  label: string;
  id: string;
}

interface AppSidebarProps {
  navItems: SidebarNavItem[];
  activeScreen: string;
  onNavigate: (screen: string) => void;
  badge?: ReactNode;
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?'
  );
}

export function AppSidebar({ navItems, activeScreen, onNavigate, badge }: AppSidebarProps) {
  const account = useAccount();

  return (
    <div className="w-[240px] bg-[#007BC1] text-white h-screen flex flex-col flex-shrink-0">
      {/* Logo + persona context badge */}
      <div className="p-4 flex flex-col gap-4">
        <div className="bg-white rounded-lg p-3 flex items-center justify-center">
          <img src="/superkalan-gaz.png" alt="Superkalan Gaz" className="w-full h-auto" />
        </div>
        {badge}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-2 flex flex-col gap-1 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
              activeScreen === item.id
                ? 'bg-white text-[#007BC1]'
                : 'text-white hover:bg-white/10'
            }`}
          >
            <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
            <span className="text-sm font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Logged-in account (real session, not a hardcoded persona) */}
      <div className="p-4 border-t border-white/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#76B4DD] rounded-full flex items-center justify-center text-[#007BC1] font-semibold text-sm flex-shrink-0">
            {initialsOf(account.displayName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{account.displayName}</div>
            <div className="text-xs text-white/80 truncate">{ROLE_LABELS[account.role]}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
