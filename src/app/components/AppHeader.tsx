'use client';

import { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { useAccount } from '../contexts/AccountContext';
import { ROLE_LABELS } from '../lib/auth';

/**
 * Unified page header for all three web personas (DESIGN.md §4): title on the
 * left; context badge, search, and the logged-in account on the right. The
 * profile always shows the REAL session user from AccountContext, never a
 * hardcoded persona. Logout lives in the sidebar, not here.
 */
interface AppHeaderProps {
  title: string;
  /** Persona context chip: FA "Main Office", BO branch selector, BM branch. */
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

export function AppHeader({ title, badge }: AppHeaderProps) {
  const account = useAccount();

  return (
    <div className="bg-white border-b border-gray-200 px-8 py-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>

        <div className="flex items-center gap-4">
          {badge}

          {/* Search — visual scaffold; wiring to API search is a separate story */}
          <div className="relative hidden md:block">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              placeholder="Search"
              className="w-56 pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007BC1]/40 focus:bg-white transition-colors"
            />
          </div>

          {/* Logged-in account */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-[#007BC1] rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
              {initialsOf(account.displayName)}
            </div>
            <div className="hidden sm:block min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">{account.displayName}</div>
              <div className="text-xs text-gray-500 truncate">{ROLE_LABELS[account.role]}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
