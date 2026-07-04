'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { useBranch } from '../contexts/BranchContext';
import { useAccount } from '../../contexts/AccountContext';
import { ROLE_LABELS } from '../../lib/auth';

interface HeaderProps {
  title: string;
}

/**
 * Branch chip: static pill for single-branch owners, a dropdown for owners
 * assigned multiple branches. Branch scoping is derived from the login
 * (AGENTS.md §5) — the chip only switches between branches the BO owns.
 */
function BranchBadge() {
  const { selectedBranch, setSelectedBranch, availableBranches } = useBranch();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isSingleBranch = availableBranches.length === 1;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    if (!isSingleBranch) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isSingleBranch]);

  if (isSingleBranch) {
    return (
      <div className="bg-blue-50 text-[#00568A] text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap">
        {selectedBranch}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setShowDropdown(!showDropdown)}
        className="bg-blue-50 hover:bg-blue-100 text-[#00568A] text-xs px-3 py-1.5 rounded-full font-medium flex items-center gap-1 whitespace-nowrap transition-colors"
      >
        <span>{selectedBranch}</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {showDropdown && (
        <div className="absolute top-full mt-2 right-0 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          {availableBranches.map((branch) => (
            <button
              key={branch}
              type="button"
              onClick={() => {
                setSelectedBranch(branch);
                setShowDropdown(false);
              }}
              className="w-full px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-100 flex items-center justify-between transition-colors"
            >
              <span>{branch}</span>
              {selectedBranch === branch && <Check className="w-4 h-4 text-[#00568A]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?'
  );
}

/**
 * Page header: title on the left; branch context, search, and the logged-in
 * account on the right. The profile shows the REAL session user from
 * AccountContext, never a hardcoded persona.
 */
export function Header({ title }: HeaderProps) {
  const account = useAccount();

  return (
    <div className="bg-white border-b border-gray-200 px-8 py-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>

        <div className="flex items-center gap-4">
          <BranchBadge />

          {/* Search — visual scaffold; wiring to API search is a separate story */}
          <div className="relative hidden md:block">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              placeholder="Search"
              className="w-56 pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007BC1]/40 focus:bg-white transition-colors"
            />
          </div>

          {/* Logged-in account */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-[#007BC1] rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
              {initialsOf(account.displayName)}
            </div>
            <div className="hidden sm:block min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">{account.displayName}</div>
              <div className="text-xs text-gray-500 truncate">{ROLE_LABELS[account.role]}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
