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
        <div className="bg-blue-50 text-[#00568A] text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap">
          Main Office
        </div>
      }
    />
  );
}
