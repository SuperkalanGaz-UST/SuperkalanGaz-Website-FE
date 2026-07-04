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

interface HeaderProps {
  title: string;
}

/** BO page header: the shared AppHeader with the branch selector as its badge. */
export function Header({ title }: HeaderProps) {
  return <AppHeader title={title} badge={<BranchBadge />} />;
}
