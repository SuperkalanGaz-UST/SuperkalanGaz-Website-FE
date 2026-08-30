'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useBranch } from '../contexts/BranchContext';
import { AppHeader } from '../../components/AppHeader';

/**
 * Branch chip: static pill for single-branch owners, a dropdown for owners
 * assigned multiple branches. Branch scoping is derived from the login
 * (AGENTS.md §5) — the chip only switches between branches the BO owns.
 */
function BranchBadge() {
  const {
    selectedBranch,
    selectedBranchId,
    setSelectedBranchId,
    availableBranchOptions,
  } = useBranch();
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectionAnimating, setSelectionAnimating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isSingleBranch = availableBranchOptions.length === 1;

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

  if (availableBranchOptions.length === 0) {
    return (
      <div className="flex items-center whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
        No active branch
      </div>
    );
  }

  if (isSingleBranch) {
    return (
      <div className="flex items-center px-3 py-1 rounded-full border border-gray-200 bg-white text-[#007BC1] text-xs font-bold whitespace-nowrap">
        {selectedBranch}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setShowDropdown(!showDropdown)}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-[#007BC1] text-xs font-bold whitespace-nowrap transition-all duration-200 ${
          selectionAnimating ? 'scale-[0.97] border-[#7fc2e8] bg-blue-50' : 'scale-100'
        }`}
      >
        <span
          key={selectedBranch}
          className="inline-block animate-in fade-in-0 slide-in-from-bottom-1 duration-200"
        >
          {selectedBranch}
        </span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {showDropdown && (
        <div className="absolute top-full mt-2 right-0 min-w-full w-max bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50 animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150">
          {availableBranchOptions.map((branch) => (
            <button
              key={branch.id}
              type="button"
              onClick={() => {
                if (branch.id !== selectedBranchId) {
                  setSelectionAnimating(true);
                  window.setTimeout(() => setSelectionAnimating(false), 240);
                }
                setSelectedBranchId(branch.id);
                setShowDropdown(false);
              }}
              className={`w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center justify-between gap-4 transition-colors ${
                selectedBranchId === branch.id
                  ? 'text-[#007BC1] font-semibold'
                  : 'text-gray-700'
              }`}
            >
              <span>{branch.name}</span>
              {selectedBranchId === branch.id && (
                <Check className="w-4 h-4 text-[#007BC1]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface HeaderProps {
  title: string;
  description?: string;
}

/** BO page header: the shared AppHeader with the branch selector as its badge. */
export function Header({ title, description }: HeaderProps) {
  return <AppHeader title={title} description={description} badge={<BranchBadge />} />;
}
