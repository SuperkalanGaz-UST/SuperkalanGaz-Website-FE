'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { ChevronDown, UserCircle, LogOut } from 'lucide-react';
import { useAccount, useLogout } from '../contexts/AccountContext';
import { NotificationCenter } from './NotificationCenter';

/**
 * Unified page header for all staff web personas, in the Branch Owner reference
 * format (DESIGN.md): a card-less bar over the gray canvas — bold title on the
 * left; the persona context badge, notification control, and account menu on the
 * right. The account menu provides a confirmed logout path in addition to the
 * shared sidebar shortcut. The profile always shows the REAL session user from
 * AccountContext, never a hardcoded persona.
 */
interface AppHeaderProps {
  title: string;
  description?: string;
  /** Persona context chip: SA/FA "Main Office", BO branch selector, BM branch. */
  badge?: ReactNode;
  /** Optional page-level action rendered below the persona controls. */
  actions?: ReactNode;
}

export function AppHeader({ title, description, badge, actions }: AppHeaderProps) {
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

      <div className={`flex shrink-0 flex-col items-end ${description ? 'mt-1' : ''}`}>
        <div className="flex items-center gap-3">
          {badge}

          <NotificationCenter />

          {/* Account menu — keeps the confirmed logout path available in the header. */}
          <div className="relative" ref={accountRef}>
            <button
              type="button"
              onClick={() => setShowAccount((v) => !v)}
              className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200">
                <UserCircle className="h-6 w-6 text-gray-400" />
              </div>
              <span className="hidden text-xs font-medium text-gray-700 sm:block">{name}</span>
              <ChevronDown className="h-3 w-3 text-gray-400" />
            </button>

            {showAccount && (
              <div className="absolute right-0 top-full z-50 mt-2 w-36 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setShowAccount(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-500 transition-colors hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

        {actions && <div className="mt-4 flex justify-end">{actions}</div>}
      </div>

    </div>
  );
}
