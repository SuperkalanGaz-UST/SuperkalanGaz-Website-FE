import { Header } from './Header';
import { LoyaltyTrackDashboard } from './LoyaltyTrackDashboard';

export function LoyaltyProgram() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header title="Rewards" />
      </div>

      <div className="p-8">
        <LoyaltyTrackDashboard scopeLabel="Illustrative cross-branch data" />
      </div>
    </div>
  );
}
