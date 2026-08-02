'use client';

import { ComponentType, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, LogOut, UserCircle } from 'lucide-react';
import { useAccount, useLogout } from '../contexts/AccountContext';
import { ROLE_LABELS } from '../lib/auth';

export interface SidebarNavLeaf {
  label: string;
  id: string;
  icon?: ComponentType<{ className?: string }>;
}

export interface SidebarNavEntry {
  icon: ComponentType<{ className?: string }>;
  label: string;
  /** Present on plain links; absent on category groups. */
  id?: string;
  children?: SidebarNavLeaf[];
}

interface AppSidebarProps {
  entries: SidebarNavEntry[];
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

function entryIsActive(entry: SidebarNavEntry, activeScreen: string): boolean {
  return entry.id === activeScreen || !!entry.children?.some((child) => child.id === activeScreen);
}

/**
 * Shared sidebar shell for all staff personas. Role wrappers supply only the
 * destinations their persona may access; the shell owns the consistent
 * expanded/minimized presentation, real session identity, and logout action.
 */
export function AppSidebar({ entries, activeScreen, onNavigate }: AppSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const account = useAccount();
  const logout = useLogout();
  const displayName = account.displayName.split(' — ')[0].split(' - ')[0];
  const navigationLabel = `${ROLE_LABELS[account.role]} navigation`;

  const handleRailEntry = (entry: SidebarNavEntry) => {
    if (entry.id) {
      onNavigate(entry.id);
      return;
    }

    // A category icon reveals its destinations instead of guessing which
    // child screen the user intended to open.
    setIsExpanded(true);
  };

  return (
    <div
      className={`relative h-screen shrink-0 transition-[width] duration-150 ease-out ${
        isExpanded ? 'w-72' : 'w-24'
      }`}
    >
      <aside
        className="flex h-full w-full flex-col overflow-hidden bg-[#007BC1] text-white"
        aria-label={navigationLabel}
      >
        <div
          className="relative h-32 shrink-0"
          role="img"
          aria-label="Superkalan Gaz"
        >
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <Image
              src="/superkalan-gaz.png"
              alt=""
              aria-hidden="true"
              width={80}
              height={57}
              className={`h-auto w-20 object-contain transition-opacity duration-100 ${
                isExpanded ? 'opacity-0' : 'opacity-100'
              }`}
              style={{ filter: 'brightness(0) invert(1)' }}
            />
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <Image
              src="/superkalan-gaz.png"
              alt=""
              aria-hidden="true"
              width={160}
              height={115}
              className={`h-auto w-40 object-contain transition-opacity duration-100 ${
                isExpanded ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ filter: 'brightness(0) invert(1)' }}
            />
          </div>
        </div>

        {isExpanded ? (
          <nav className="min-h-0 flex-1 overflow-y-auto px-4 pb-4" aria-label="Expanded navigation">
            {entries.map((entry) => {
              if (entry.id) {
                const isActive = activeScreen === entry.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onNavigate(entry.id!)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`mb-1 flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] font-medium text-white transition-colors ${
                      isActive ? 'bg-white/15' : 'hover:bg-white/10'
                    }`}
                  >
                    <entry.icon className="h-[18px] w-[18px] shrink-0" />
                    <span>{entry.label}</span>
                  </button>
                );
              }

              return (
                <section key={entry.label} className="mt-4" aria-label={entry.label}>
                  <h2 className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-white/60">
                    {entry.label}
                  </h2>
                  {entry.children?.map((child) => {
                    const isActive = activeScreen === child.id;
                    return (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => onNavigate(child.id)}
                        aria-current={isActive ? 'page' : undefined}
                        className={`mb-0.5 flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] font-medium text-white transition-colors ${
                          isActive ? 'bg-white/15' : 'hover:bg-white/10'
                        }`}
                      >
                        {child.icon && <child.icon className="h-[18px] w-[18px] shrink-0" />}
                        <span>{child.label}</span>
                      </button>
                    );
                  })}
                </section>
              );
            })}
          </nav>
        ) : (
          <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4" aria-label="Compact navigation">
            <div className="flex flex-col items-center justify-start gap-1">
              {entries.map((entry, index) => {
                const isActive = entryIsActive(entry, activeScreen);
                const startsStandaloneEntries =
                  index > 0 && !!entries[index - 1].children && !entry.children;

                return (
                  <button
                    key={entry.label}
                    type="button"
                    onClick={() => handleRailEntry(entry)}
                    aria-label={entry.label}
                    aria-current={isActive ? 'page' : undefined}
                    title={entry.label}
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
                      isActive ? 'bg-white/15 text-white' : 'text-white/95 hover:bg-white/10'
                    } ${startsStandaloneEntries ? 'mt-2' : ''}`}
                  >
                    {/* Keep the visual icon identical to the expanded state;
                        the 44px button remains only as an accessible hit area. */}
                    <entry.icon className="h-[18px] w-[18px] shrink-0" />
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        {isExpanded ? (
          <div className="shrink-0 border-t border-white/20 p-4">
            <div className="mb-3 flex items-center gap-3 px-1">
              <UserCircle className="h-10 w-10 shrink-0 text-white" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{displayName}</p>
                <p className="truncate text-xs text-white/70">{ROLE_LABELS[account.role]}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/70 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        ) : (
          <div className="shrink-0 border-t border-white/20 px-3 py-4">
            <div className="flex flex-col items-center gap-3">
              <UserCircle className="h-10 w-10 text-white" aria-hidden="true" />
              <button
                type="button"
                onClick={logout}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-white transition-colors hover:bg-white/10"
                aria-label="Log out"
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </aside>

      <button
        type="button"
        onClick={() => setIsExpanded((expanded) => !expanded)}
        className="absolute right-0 top-8 z-20 flex h-9 w-9 translate-x-1/2 items-center justify-center rounded-lg border border-gray-200 bg-white text-[#007BC1] shadow-sm transition-colors hover:bg-blue-50"
        aria-label={isExpanded ? 'Minimize sidebar' : 'Expand sidebar'}
        aria-expanded={isExpanded}
        title={isExpanded ? 'Minimize sidebar' : 'Expand sidebar'}
      >
        {isExpanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
    </div>
  );
}
