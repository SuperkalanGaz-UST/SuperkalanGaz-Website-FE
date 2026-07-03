import { Header } from "./Header";
import { KPICard } from "./KPICard";
import { OrderVolumeChart } from "./OrderVolumeChart";
import { CSATChart } from "./CSATChart";
import { SLATable } from "./SLATable";
import { Star } from "lucide-react";
import { useBranchData } from "../hooks/useBranchData";
import { useBranch } from "../contexts/BranchContext";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const weeklyExpenses = [
  { week: 'Week 1', amount: 18500 },
  { week: 'Week 2', amount: 22000 },
  { week: 'Week 3', amount: 19200 },
  { week: 'Week 4', amount: 21300 },
];

const hourlyEarnings = [
  { hour: '6AM',  earnings: 800 },
  { hour: '7AM',  earnings: 1200 },
  { hour: '8AM',  earnings: 2400 },
  { hour: '9AM',  earnings: 3800 },
  { hour: '10AM', earnings: 5200 },
  { hour: '11AM', earnings: 6100 },
  { hour: '12PM', earnings: 5800 },
  { hour: '1PM',  earnings: 4200 },
  { hour: '2PM',  earnings: 3600 },
  { hour: '3PM',  earnings: 5100 },
  { hour: '4PM',  earnings: 5900 },
  { hour: '5PM',  earnings: 4800 },
  { hour: '6PM',  earnings: 3200 },
  { hour: '7PM',  earnings: 2100 },
  { hour: '8PM',  earnings: 900 },
];

const dailyEarnings = [
  { day: 1,  earnings: 8400 },
  { day: 2,  earnings: 9100 },
  { day: 3,  earnings: 10200 },
  { day: 4,  earnings: 9600 },
  { day: 5,  earnings: 11300 },
  { day: 6,  earnings: 10800 },
  { day: 7,  earnings: 12100 },
  { day: 8,  earnings: 11500 },
  { day: 9,  earnings: 10900 },
  { day: 10, earnings: 13200 },
  { day: 11, earnings: 12700 },
  { day: 12, earnings: 11800 },
  { day: 13, earnings: 13500 },
  { day: 14, earnings: 14100 },
  { day: 15, earnings: 13800 },
  { day: 16, earnings: 12400 },
  { day: 17, earnings: 14600 },
  { day: 18, earnings: 15200 },
  { day: 19, earnings: 13900 },
  { day: 20, earnings: 15800 },
  { day: 21, earnings: 16100 },
  { day: 22, earnings: 14700 },
  { day: 23, earnings: 15500 },
  { day: 24, earnings: 16800 },
  { day: 25, earnings: 17200 },
  { day: 26, earnings: 15900 },
  { day: 27, earnings: 16500 },
  { day: 28, earnings: 17800 },
  { day: 29, earnings: 18200 },
  { day: 30, earnings: 17600 },
  { day: 31, earnings: 18100 },
];

export function Dashboard() {
  const { selectedBranch } = useBranch();
  const branchData = useBranchData();

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header title="Dashboard" subtitle="Monitor today's operations and key metrics." />
      </div>

      <div className="p-8">
        <div className="grid grid-cols-4 gap-6 mb-8">
          <KPICard
            title="Total Orders This Month"
            value={branchData.totalOrders}
            accentColor="#007BC1"
          />
          <KPICard
            title="Delivery Completion Rate"
            value={branchData.completionRate}
            accentColor="#007BC1"
          />
          <KPICard
            title="Average CSAT Score"
            value={branchData.csatScore}
            icon={<Star className="w-6 h-6 fill-[#f59e0b] text-[#f59e0b]" />}
            subtitle="out of 5"
            accentColor="#007BC1"
          />
          <KPICard
            title="Loyalty Redemptions This Month"
            value={branchData.loyaltyRedemptions}
            accentColor="#007BC1"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Earnings for Today */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Earnings for Today</h3>
              <div className="text-right">
                <div className="text-sm font-bold text-gray-900">Total: ₱55,100</div>
                <div className="text-[11px] text-gray-400 mt-0.5">as of 8:00 PM</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourlyEarnings} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" stroke="#9ca3af" style={{ fontSize: '11px' }} tick={{ dy: 4 }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: '11px' }} tickFormatter={v => `₱${(v / 1000).toFixed(1)}k`} width={52} />
                <Tooltip formatter={(v) => [`₱${Number(v).toLocaleString()}`, 'Earnings']} />
                <Bar dataKey="earnings" fill="#1e3a5f" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Earnings for This Month */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Earnings for This Month</h3>
              <div className="text-right">
                <div className="text-sm font-bold text-gray-900">Total: ₱284,500</div>
                <div className="text-[11px] text-gray-400 mt-0.5">May 2026</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dailyEarnings} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="day"
                  stroke="#9ca3af"
                  style={{ fontSize: '11px' }}
                  ticks={[1, 5, 10, 15, 20, 25, 31]}
                  tick={{ dy: 4 }}
                />
                <YAxis stroke="#9ca3af" style={{ fontSize: '11px' }} tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`} width={52} />
                <Tooltip
                  labelFormatter={d => `May ${d}, 2026`}
                  formatter={(v) => [`₱${Number(v).toLocaleString()}`, 'Earnings']}
                />
                <Line type="monotone" dataKey="earnings" stroke="#1e3a5f" strokeWidth={2} dot={{ fill: '#1e3a5f', r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Operational Expenses — full-width */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 min-h-[220px]">
          <div className="flex items-start justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Operational Expenses for This Month</h3>
            <div className="text-right">
              <div className="text-sm font-bold text-gray-900">Total: ₱81,000</div>
              <div className="text-[11px] text-gray-400 mt-0.5">May 2026</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={weeklyExpenses} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" stroke="#9ca3af" style={{ fontSize: '12px' }} tick={{ dy: 4 }} />
              <YAxis stroke="#9ca3af" style={{ fontSize: '11px' }} tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`} width={52} />
              <Tooltip formatter={(v) => [`₱${Number(v).toLocaleString()}`, 'Expenses']} />
              <Line type="monotone" dataKey="amount" stroke="#CC1903" strokeWidth={2} dot={{ fill: '#CC1903', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
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