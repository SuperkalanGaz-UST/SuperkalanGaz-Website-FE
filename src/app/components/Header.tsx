'use client';

import { AppHeader } from './AppHeader';
import styles from './Header.module.css';

interface HeaderProps {
  title: string;
  /** Retained for compatibility; Franchise Admin headers use the Dashboard's title-only style. */
  description?: string;
}

/**
 * Franchise Administrator page header: the shared AppHeader with the FA
 * context chip. FA is cross-branch (AGENTS.md §5), so the badge is a static
 * "Main Office" pill rather than a branch selector.
 */
export function Header({ title }: HeaderProps) {
  return (
    <div className={styles.header}>
      <AppHeader
        title={title}
        badge={
          <div className="flex items-center px-3 py-1 rounded-full border border-gray-200 bg-white text-[#007BC1] text-xs font-bold whitespace-nowrap">
            Main Office
          </div>
        }
      />
    </div>
  );
}
