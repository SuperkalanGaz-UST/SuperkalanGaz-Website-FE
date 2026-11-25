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
        <Header title="Orders" />
      </div>

      <div className="p-8">
        {branchData.error && <p role="alert" className="mb-4 text-sm text-red-600">{branchData.error}</p>}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <KPICard
            title="Total Orders"
            value={branchData.totalOrders}
            icon={<ShoppingCart className="w-4 h-4 text-[#eab308]" />}
            accentColor="#eab308"
            trend={branchData.totalOrders === '—' || branchData.ordersLastMonth === '—' || branchData.ordersLastMonth === '0' ? undefined : {
              text: `${Number(branchData.totalOrders) >= Number(branchData.ordersLastMonth) ? '+' : ''}${branchData.ordersLastMonth === '0' ? '0.0' : (((Number(branchData.totalOrders) - Number(branchData.ordersLastMonth)) / Number(branchData.ordersLastMonth)) * 100).toFixed(1)}% vs same period last month`,
              direction: Number(branchData.totalOrders) >= Number(branchData.ordersLastMonth) ? 'up' : 'down',
              positive: Number(branchData.totalOrders) >= Number(branchData.ordersLastMonth),
            }}
            subtitle={branchData.ordersLastMonth === '0' ? 'No orders in the same period last month' : undefined}
          />
          <KPICard
            title="Completed Deliveries"
            value={branchData.completedDeliveries}
            icon={<CheckCircle2 className="w-4 h-4 text-[#22c55e]" />}
            accentColor="#22c55e"
            trend={undefined}
          />
          <KPICard
            title="Cancelled / Under Review"
            value={branchData.cancelledFailedDeliveries}
            icon={<XCircle className="w-4 h-4 text-[#ef4444]" />}
            accentColor="#ef4444"
            trend={undefined}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 mb-8">
          <DailyOrderVolumeChart dailyData={branchData.dailyOrderVolume} hourlyData={branchData.hourlyOrderVolume} />
        </div>

        <DeliveryCompletionTable />
        <DeliveryProofRecords />
      </div>
    </div>
  );
}
