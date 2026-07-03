import { Header } from "./Header";
import { KPICard } from "./KPICard";
import { OrderVolumeChart } from "./OrderVolumeChart";
import { CSATChart } from "./CSATChart";
import { SLATable } from "./SLATable";
import { Star } from "lucide-react";

export function Dashboard() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header title="Dashboard" subtitle="Franchise-wide performance across all branch operations." />
      </div>

      <div className="p-8">
        <div className="grid grid-cols-4 gap-6 mb-8">
          <KPICard
            title="Total Orders — All Branches"
            value="1,847"
            accentColor="#007BC1"
          />
          <KPICard
            title="System Delivery Completion Rate"
            value="94.2%"
            accentColor="#007BC1"
          />
          <KPICard
            title="System Average CSAT Score"
            value="4.1"
            icon={<Star className="w-6 h-6 fill-[#f59e0b] text-[#f59e0b]" />}
            subtitle="out of 5"
            accentColor="#007BC1"
          />
          <KPICard
            title="Pending Branch Approvals"
            value="3"
            accentColor="#007BC1"
          />
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
          <OrderVolumeChart />
          <CSATChart />
        </div>

        <SLATable />
      </div>
    </div>
  );
}