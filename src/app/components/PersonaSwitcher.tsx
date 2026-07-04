'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronUp, Check, Loader2, LogOut, UserRound } from 'lucide-react';
import { Account, DEMO_ACCOUNTS, ROLE_LABELS } from '../lib/auth';

/*
 * DEMO-ONLY control. Switching here performs a REAL Supabase sign-in as the
 * chosen seed user, so the session (and the JWT the API scopes by) always
 * matches the persona being demoed. In production a user can never switch
 * roles: BO and BM are always separate people (AGENTS.md §7). This floating
 * switcher exists so one demo session can present all three web personas to
 * the capstone panel without typing credentials each time. Remove it together
 * with DEMO_ACCOUNTS in lib/auth.ts when the demo phase ends.
 */

interface PersonaSwitcherProps {
  account: Account;
  switching: boolean;
  onSwitchUser: (username: string) => void;
  onLogout: () => void;
}

export function PersonaSwitcher({ account, switching, onSwitchUser, onLogout }: PersonaSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="fixed bottom-5 right-5 z-[9999] flex flex-col items-end gap-2 font-sans">
      {open && (
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden w-72">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Demo — switch user</p>
            <p className="text-sm text-gray-600 truncate mt-0.5">
              Signed in: {account.displayName}
            </p>
          </div>
          {DEMO_ACCOUNTS.map((demo) => {
            const isActive = demo.username === account.username;
            return (
              <button
                key={demo.username}
                type="button"
                disabled={switching}
                onClick={() => {
                  onSwitchUser(demo.username);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-3 text-sm text-left hover:bg-gray-50 transition-colors disabled:opacity-50 ${
                  isActive ? 'text-[#007BC1] font-semibold' : 'text-gray-700'
                }`}
              >
                <span>
                  {ROLE_LABELS[demo.role]}
                  <span className="block text-xs font-normal text-gray-400">@{demo.username}</span>
                </span>
                {isActive && <Check className="w-4 h-4" />}
              </button>
            );
          })}
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left text-red-600 hover:bg-red-50 border-t border-gray-100 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={switching}
        className="flex items-center gap-2 bg-[#007BC1] text-white pl-4 pr-3 py-2.5 rounded-full shadow-lg hover:bg-[#006399] transition-colors text-sm font-medium disabled:opacity-70"
      >
        {switching ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserRound className="w-4 h-4" />}
        {switching ? 'Switching…' : ROLE_LABELS[account.role]}
        <ChevronUp className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
}
