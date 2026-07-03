import { Header } from "./Header";
import { KPICard } from "./KPICard";
import { DailyOrderVolumeChart } from "./DailyOrderVolumeChart";
import { OrdersByStatusChart } from "./OrdersByStatusChart";
import { DeliveryCompletionTable } from "./DeliveryCompletionTable";
import { useBranch } from "../contexts/BranchContext";

export function OrderAnalytics() {
  const { selectedBranch } = useBranch();

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header title="Order Analytics" subtitle="Track order trends and delivery performance." />
      </div>

      <div className="p-8">
        <div className="grid grid-cols-3 gap-6 mb-8">
          <KPICard title="Total Orders" value="284" accentColor="#eab308" />
          <KPICard title="Completed Deliveries" value="274" accentColor="#22c55e" />
          <KPICard title="Cancelled / Failed" value="10" accentColor="#ef4444" />
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
          <DailyOrderVolumeChart />
          <OrdersByStatusChart />
        </div>

        <DeliveryCompletionTable />
      </div>
    </div>
  );
}