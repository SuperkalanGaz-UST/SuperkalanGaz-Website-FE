'use client';

import { Header } from './Header';
import { useBranch } from '../contexts/BranchContext';
import { LoyaltyTrackDashboard } from '../../components/LoyaltyTrackDashboard';

export function LoyaltyProgram() {
  const { selectedBranch } = useBranch();

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header title="Rewards" />
      </div>

      <div className="p-8">
        <LoyaltyTrackDashboard scopeLabel={`Illustrative data for ${selectedBranch}`} />
      </div>
    </div>
  );
}
