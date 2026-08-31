import { Header } from "./Header";
import { KPICard } from "./KPICard";
import { DailyOrderVolumeChart } from "./DailyOrderVolumeChart";
import { OrdersByStatusChart } from "./OrdersByStatusChart";
import { DeliveryCompletionTable } from "./DeliveryCompletionTable";
import { DeliveryProofRecords } from "./DeliveryProofRecords";
import { ShoppingCart, CheckCircle2, XCircle } from "lucide-react";

export function OrderAnalytics() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header title="Order Analytics" />
      </div>

      <div className="p-8">
        <div className="grid grid-cols-3 gap-6 mb-8">
          <KPICard
            title="Total Orders"
            value="284"
            icon={<ShoppingCart className="w-4 h-4 text-[#eab308]" />}
            accentColor="#eab308"
            trend={{ text: "+8.3% from last month", direction: "up", positive: true }}
          />
          <KPICard
            title="Completed Deliveries"
            value="274"
            icon={<CheckCircle2 className="w-4 h-4 text-[#22c55e]" />}
            accentColor="#22c55e"
            trend={{ text: "+5.1% from last month", direction: "up", positive: true }}
          />
          <KPICard
            title="Cancelled / Failed"
            value="10"
            icon={<XCircle className="w-4 h-4 text-[#ef4444]" />}
            accentColor="#ef4444"
            trend={{ text: "-2.0% from last month", direction: "down", positive: true }}
          />
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
          <DailyOrderVolumeChart />
          <OrdersByStatusChart />
        </div>

        <DeliveryCompletionTable />
        <DeliveryProofRecords />
      </div>
    </div>
  );
}
