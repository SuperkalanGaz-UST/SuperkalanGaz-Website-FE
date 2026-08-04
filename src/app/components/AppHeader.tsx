'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { ChevronDown, UserCircle, LogOut } from 'lucide-react';
import { useAccount, useLogout } from '../contexts/AccountContext';
import { NotificationCenter } from './NotificationCenter';

/**
 * Unified page header for all three web personas, in the Branch Owner reference
 * format (DESIGN.md): a card-less bar over the gray canvas — bold title on the
 * left; the persona context badge, notification control, and account menu on the
 * right. The account menu provides a confirmed logout path in addition to the
 * shared sidebar shortcut. The profile always shows the REAL session user from
 * AccountContext, never a hardcoded persona.
 */
interface AppHeaderProps {
  title: string;
  description?: string;
  /** Persona context chip: FA "Main Office", BO branch selector, BM branch. */
  badge?: ReactNode;
}

export function AppHeader({ title, description, badge }: AppHeaderProps) {
  const account = useAccount();
  const logout = useLogout();

  const [showAccount, setShowAccount] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  // Close the account dropdown on any outside click.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setShowAccount(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Display just the person's name, dropping any " — role" suffix seed data carries.
  const name = account.displayName.split(' — ')[0].split(' - ')[0];

  return (
    <div
      className={`flex justify-between gap-4 px-8 pt-8 ${
        description ? 'items-start pb-10' : 'items-center pb-4'
      }`}
    >
      <div className="min-w-0">
        <h1
          className={
            description
              ? 'text-[30px] font-semibold leading-[1.2] tracking-[-0.02em] text-gray-900'
              : 'text-2xl font-bold text-gray-900'
          }
        >
          {title}
        </h1>
        {description && (
          <p className="mt-2.5 max-w-3xl text-[15px] font-normal leading-6 text-gray-500">
            {description}
          </p>
        )}
      </div>

      <div className={`flex shrink-0 items-center gap-3 ${description ? 'mt-1' : ''}`}>
        {badge}

        <NotificationCenter />

        {/* Account menu — keeps the confirmed logout path available in the header. */}
        <div className="relative" ref={accountRef}>
          <button
            type="button"
            onClick={() => setShowAccount((v) => !v)}
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
          >
            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
              <UserCircle className="w-6 h-6 text-gray-400" />
            </div>
            <span className="hidden sm:block text-xs font-medium text-gray-700">{name}</span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>

          {showAccount && (
            <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50 w-36">
              <button
                type="button"
                onClick={() => {
                  setShowAccount(false);
                  logout();
                }}
                className="w-full px-4 py-2 text-sm text-left text-red-500 hover:bg-red-50 flex items-center gap-2 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
