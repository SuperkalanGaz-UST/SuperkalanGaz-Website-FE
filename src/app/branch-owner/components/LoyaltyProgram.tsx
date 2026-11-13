'use client';

import { Header } from './Header';
import { useBranch } from '../contexts/BranchContext';
import { LoyaltyTrackDashboard } from '../../components/LoyaltyTrackDashboard';

export function LoyaltyProgram() {
  const { selectedBranchId } = useBranch();

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header title="Rewards" />
      </div>

      <div className="p-8">
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'redemption-history-full' }))}
            className="text-sm font-semibold text-[#007BC1] hover:text-[#005a8f]"
          >
            View redemption history
          </button>
        </div>
        <LoyaltyTrackDashboard branchId={selectedBranchId} branchOwnerView />
      </div>
    </div>
  );
}
