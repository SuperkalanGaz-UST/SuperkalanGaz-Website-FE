'use client';

import { useState, useEffect, ComponentType } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Unified sidebar shell for all three web personas (FA / BO / BM), in the
 * Branch Owner reference format (DESIGN.md): solid brand-blue rail, white-pill
 * active state, optional collapsible groups. One visual format everywhere;
 * what differs per persona is DATA, not styling — `entries` lists the screens
 * that persona may reach (RBAC per AGENTS.md §7: the UI must not render actions
 * a role can't perform).
 *
 * Logout is NOT here — it lives in the header account menu (AppHeader), and the
 * user profile lives in the header too.
 */
export interface SidebarNavLeaf {
  label: string;
  id: string;
  /** Optional icon for a group child; group children render icons in the reference. */
  icon?: ComponentType<{ className?: string }>;
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
    <div className="w-[220px] bg-[#007BC1] text-white h-screen flex flex-col flex-shrink-0">
      {/* Logo — card-less on the blue rail; the source art is blue, so we
          invert it to white to stay legible (reference uses a white logo asset). */}
      <div className="px-3 pt-8 pb-4 flex justify-center">
        <img
          src="/superkalan-gaz.png"
          alt="Superkalan Gaz"
          className="w-40 h-auto object-contain"
          style={{ filter: 'brightness(0) invert(1)' }}
        />
      </div>

      {/* Navigation — active item is a white pill with brand-blue text */}
      <nav className="flex-1 px-3 overflow-y-auto mt-8">
        {entries.map((entry) => {
          if (!entry.children) {
            const isActive = activeScreen === entry.id;
            return (
              <button
                key={entry.label}
                type="button"
                onClick={() => onNavigate(entry.id!)}
                className={`w-full flex items-center gap-2.5 px-3 py-[7px] rounded-lg mb-0.5 transition-colors ${
                  isActive ? 'bg-white text-[#007BC1]' : 'text-white hover:bg-white/10'
                }`}
              >
                <entry.icon className="w-4 h-4 shrink-0" />
                <span className="text-[12px] font-medium">{entry.label}</span>
              </button>
            );
          }

          const isOpen = !!openGroups[entry.label];
          const hasActiveChild = entry.children.some((child) => child.id === activeScreen);
          return (
            <div key={entry.label} className="mb-0.5">
              <button
                type="button"
                onClick={() => toggleGroup(entry.label)}
                aria-expanded={isOpen}
                className={`w-full flex items-center gap-2.5 px-3 py-[7px] rounded-lg transition-colors ${
                  hasActiveChild && !isOpen ? 'bg-white/10 text-white' : 'text-white hover:bg-white/10'
                }`}
              >
                <entry.icon className="w-4 h-4 shrink-0" />
                <span className="text-[12px] font-medium flex-1 text-left">{entry.label}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isOpen && (
                <div className="mt-0.5 ml-3 pl-3 border-l border-white/20">
                  {entry.children.map((child) => {
                    const isActive = activeScreen === child.id;
                    return (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => onNavigate(child.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-[6px] rounded-lg mb-0.5 transition-colors ${
                          isActive ? 'bg-white text-[#007BC1]' : 'text-white hover:bg-white/10'
                        }`}
                      >
                        {child.icon && <child.icon className="w-3.5 h-3.5 shrink-0" />}
                        <span className="text-[11.5px] font-medium">{child.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
