'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronUp, Check, LogOut, UserRound } from 'lucide-react';
import { Role, ROLE_LABELS } from '../lib/auth';

/*
 * DEMO-ONLY control. In production, role comes from the API-issued JWT and a
 * user can never switch personas: BO and BM are always separate people (§7,
 * AGENTS.md). This floating switcher exists so one demo session can present
 * all three web personas to the capstone panel without re-logging in.
 * Remove it together with lib/auth.ts when real authentication lands.
 */

const PERSONAS: Role[] = ['franchise-admin', 'branch-owner', 'branch-manager'];

interface PersonaSwitcherProps {
  activePersona: Role;
  loggedInAs: string;
  onSwitch: (persona: Role) => void;
  onLogout: () => void;
}

export function PersonaSwitcher({ activePersona, loggedInAs, onSwitch, onLogout }: PersonaSwitcherProps) {
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
            <p className="text-xs text-gray-400 uppercase tracking-wide">Demo — view as</p>
            <p className="text-sm text-gray-600 truncate mt-0.5">Logged in: {loggedInAs}</p>
          </div>
          {PERSONAS.map((persona) => (
            <button
              key={persona}
              type="button"
              onClick={() => {
                onSwitch(persona);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-3 text-sm text-left hover:bg-gray-50 transition-colors ${
                persona === activePersona ? 'text-[#007BC1] font-semibold' : 'text-gray-700'
              }`}
            >
              {ROLE_LABELS[persona]}
              {persona === activePersona && <Check className="w-4 h-4" />}
            </button>
          ))}
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
        className="flex items-center gap-2 bg-[#007BC1] text-white pl-4 pr-3 py-2.5 rounded-full shadow-lg hover:bg-[#006399] transition-colors text-sm font-medium"
      >
        <UserRound className="w-4 h-4" />
        {ROLE_LABELS[activePersona]}
        <ChevronUp className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
}
