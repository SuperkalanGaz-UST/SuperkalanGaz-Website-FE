import { Header } from './Header';
import { KPICard } from './KPICard';
import { CustomerPurchaseTracker } from './CustomerPurchaseTracker';
import { RedemptionHistory } from './RedemptionHistory';

export function LoyaltyProgram() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header title="Loyalty Program" />
      </div>

      <div className="p-8">
        <div className="grid grid-cols-3 gap-6 mb-8">
          <KPICard
            title="Active Loyalty Members"
            value="58"
            accentColor="#22c55e"
          />
          <KPICard
            title="Eligible for Reward (30th purchase)"
            value="4"
            accentColor="#f59e0b"
          />
          <KPICard
            title="Redemptions This Month"
            value="7"
            accentColor="#eab308"
          />
        </div>

        <div className="mb-8">
          <CustomerPurchaseTracker />
        </div>

        <RedemptionHistory />
      </div>
    </div>
  );
}
