import { Header } from "./Header";
import { KPICard } from "./KPICard";
import { OrderVolumeChart } from "./OrderVolumeChart";
import { CSATChart } from "./CSATChart";
import { SLATable } from "./SLATable";
import { ShoppingCart, Truck, Star, ClipboardCheck } from "lucide-react";

export function Dashboard() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header title="Dashboard" />
      </div>

      <div className="p-8">
        <div className="grid grid-cols-4 gap-6 mb-8">
          <KPICard
            title="Total Orders — All Branches"
            value="1,847"
            icon={<ShoppingCart className="w-4 h-4 text-[#007BC1]" />}
            accentColor="#007BC1"
            trend={{ text: '+12% from last month', direction: 'up', positive: true }}
          />
          <KPICard
            title="System Delivery Completion Rate"
            value="94.2%"
            icon={<Truck className="w-4 h-4 text-[#16A34A]" />}
            accentColor="#16A34A"
            trend={{ text: '+2% from last month', direction: 'up', positive: true }}
          />
          <KPICard
            title="System Average CSAT Score"
            value="4.1"
            icon={<Star className="w-4 h-4 text-[#f59e0b]" />}
            subtitle="out of 5"
            accentColor="#f59e0b"
            trend={{ text: '+0.3 from last month', direction: 'up', positive: true }}
          />
          <KPICard
            title="Pending Branch Approvals"
            value="3"
            icon={<ClipboardCheck className="w-4 h-4 text-[#9333EA]" />}
            accentColor="#9333EA"
            trend={{ text: '-1 from last month', direction: 'down', positive: true }}
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