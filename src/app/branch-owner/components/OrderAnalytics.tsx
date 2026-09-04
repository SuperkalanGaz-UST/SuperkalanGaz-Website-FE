import { Header } from "./Header";
import { KPICard } from "./KPICard";
import { DailyOrderVolumeChart } from "./DailyOrderVolumeChart";
import { DeliveryCompletionTable } from "./DeliveryCompletionTable";
import { DeliveryProofRecords } from "./DeliveryProofRecords";
import { useBranchData } from '../hooks/useBranchData';
import { ShoppingCart, CheckCircle2, XCircle } from "lucide-react";

export function OrderAnalytics() {
  const branchData = useBranchData();

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header title="Order Analytics" />
      </div>

      <div className="p-8">
        <div className="grid grid-cols-3 gap-6 mb-8">
          <KPICard
            title="Total Orders"
            value={branchData.totalOrders}
            icon={<ShoppingCart className="w-4 h-4 text-[#eab308]" />}
            accentColor="#eab308"
            trend={branchData.totalOrders === '—' || branchData.ordersLastMonth === '—' ? undefined : {
              text: `${Number(branchData.totalOrders) >= Number(branchData.ordersLastMonth) ? '+' : ''}${branchData.ordersLastMonth === '0' ? '0.0' : (((Number(branchData.totalOrders) - Number(branchData.ordersLastMonth)) / Number(branchData.ordersLastMonth)) * 100).toFixed(1)}% from last month`,
              direction: Number(branchData.totalOrders) >= Number(branchData.ordersLastMonth) ? 'up' : 'down',
              positive: Number(branchData.totalOrders) >= Number(branchData.ordersLastMonth),
            }}
          />
          <KPICard
            title="Completed Deliveries"
            value={branchData.completedDeliveries}
            icon={<CheckCircle2 className="w-4 h-4 text-[#22c55e]" />}
            accentColor="#22c55e"
            trend={undefined}
          />
          <KPICard
            title="Cancelled / Failed"
            value={branchData.cancelledFailedDeliveries}
            icon={<XCircle className="w-4 h-4 text-[#ef4444]" />}
            accentColor="#ef4444"
            trend={undefined}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 mb-8">
          <DailyOrderVolumeChart data={branchData.dailyOrderVolume} />
        </div>

        <DeliveryCompletionTable
          totalOrders={branchData.totalOrders}
          completed={branchData.completedDeliveries}
          completionRate={branchData.completionRate}
          slaBreaches={branchData.slaBreaches}
        />
        <DeliveryProofRecords />
      </div>
    </div>
  );
}
