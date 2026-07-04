'use client';

import { useState, useEffect, ComponentType } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { useLogout } from '../contexts/AccountContext';

/**
 * Unified sidebar shell for all three web personas (FA / BO / BM), in the
 * DESIGN.md format: solid dark-blue surface, full-width lighter-blue active
 * highlight, optional collapsible groups, and a prominent logout button
 * pinned to the bottom. One visual format everywhere; what differs per
 * persona is DATA, not styling — `entries` lists the screens that persona
 * may reach (RBAC per AGENTS.md §7: the UI must not render actions a role
 * can't perform). The user profile lives in the page header, not here.
 */
export interface SidebarNavLeaf {
  label: string;
  id: string;
}

export interface SidebarNavEntry {
  icon: ComponentType<{ className?: string }>;
  label: string;
  /** Present on plain links; absent on collapsible groups. */
  id?: string;
  children?: SidebarNavLeaf[];
}

interface AppSidebarProps {
  entries: SidebarNavEntry[];
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

/** Group label whose children include the given screen, if any. */
function groupOf(entries: SidebarNavEntry[], screenId: string): string | undefined {
  return entries.find((entry) => entry.children?.some((child) => child.id === screenId))?.label;
}

export function AppSidebar({ entries, activeScreen, onNavigate }: AppSidebarProps) {
  const logout = useLogout();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const group = groupOf(entries, activeScreen);
    return group ? { [group]: true } : {};
  });

  // Keep the group holding the active screen expanded when navigation happens
  // from outside the sidebar (e.g. window 'navigate' events, drill-in screens).
  useEffect(() => {
    const group = groupOf(entries, activeScreen);
    if (group) {
      setOpenGroups((prev) => (prev[group] ? prev : { ...prev, [group]: true }));
    }
  }, [entries, activeScreen]);

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
        {entries.map((entry) => {
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

      {/* Logout — ends the real Supabase session, back to the login screen */}
      <div className="p-4 border-t border-white/20">
        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 bg-[#CC1903] hover:bg-[#b01602] text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Log out
        </button>
      </div>
    </div>
  );
}
