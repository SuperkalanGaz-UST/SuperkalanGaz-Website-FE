'use client';

import { AppHeader } from './AppHeader';

interface HeaderProps {
  title: string;
}

/**
 * Franchise Administrator page header: the shared AppHeader with the FA
 * context chip. FA is cross-branch (AGENTS.md §5), so the badge is a static
 * "Main Office" pill rather than a branch selector.
 */
export function Header({ title }: HeaderProps) {
  return (
    <AppHeader
      title={title}
      badge={
        <div className="flex items-center px-3 py-1 rounded-full border border-gray-200 bg-white text-[#007BC1] text-xs font-bold whitespace-nowrap">
          Main Office
        </div>
      }
    />
  );
}
