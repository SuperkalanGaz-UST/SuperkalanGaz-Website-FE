import { Header } from './Header';
import { KPICard } from './KPICard';
import { ShoppingCart, Truck, Star, Gift } from 'lucide-react';
import { useBranchData } from '../hooks/useBranchData';
import {
  BarChart, Bar, Cell, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

// Alternating bar shades — two steps of the brand blue, dark → light.
const BAR_BLUES = ['#007BC1', '#41A3E0'];

const pesoTooltip = (v: number | string) => [`₱${Number(v).toLocaleString()}`, 'Earnings'];

/** Shared axis look: no grid, no axis/tick lines — minimalist per the design. */
const axisProps = {
  axisLine: false as const,
  tickLine: false as const,
  stroke: '#9ca3af',
};

export function Dashboard() {
  const branchData = useBranchData();
  const hourlyEarnings = branchData.earningsToday;
  const weeklyEarnings = branchData.earningsThisMonth;
  const topSellingTanks = branchData.topSellingTanks.map((tank, index) => ({
    ...tank,
    color: ['#EA580C', '#16A34A', '#9333EA'][index % 3],
  }));
  const orderVolumeTrend = branchData.orderVolumeData;
  const maxTankOrders = Math.max(0, ...topSellingTanks.map((tank) => tank.orders));

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="Dashboard" />

      <div className="p-8">
        {/* KPI row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
          <KPICard
            title="Orders Today"
            value={branchData.ordersToday}
            icon={<ShoppingCart className="w-4 h-4 text-[#007BC1]" />}
            trend={branchData.trends.orders}
          />
          <KPICard
            title="Delivery Completion Rate"
            value={branchData.completionRate}
            icon={<Truck className="w-4 h-4 text-[#16A34A]" />}
            accentColor="#16A34A"
            trend={branchData.trends.completion}
          />
          <KPICard
            title="Average CSAT Score"
            value={branchData.csatScore}
            icon={<Star className="w-4 h-4 text-[#f59e0b]" />}
            accentColor="#f59e0b"
            trend={branchData.trends.csat}
          />
          <KPICard
            title="Loyalty Claims This Month"
            value={branchData.loyaltyRedemptions}
            icon={<Gift className="w-4 h-4 text-[#9333EA]" />}
            accentColor="#9333EA"
            trend={branchData.trends.loyalty}
          />
        </div>

        {/* Earnings row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Earnings for Today — gridless bar chart, alternating blues */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Earnings for Today</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourlyEarnings} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="hour" {...axisProps} style={{ fontSize: '11px' }} tick={{ dy: 4 }} interval="preserveStartEnd" />
                <YAxis {...axisProps} style={{ fontSize: '11px' }} tickFormatter={(v) => `₱${(v / 1000).toFixed(1)}k`} width={52} />
                <Tooltip cursor={{ fill: 'rgba(0, 123, 193, 0.06)' }} formatter={pesoTooltip} />
                <Bar dataKey="earnings" radius={[4, 4, 0, 0]}>
                  {hourlyEarnings.map((entry, index) => (
                    <Cell key={entry.hour} fill={BAR_BLUES[index % 2]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Earnings for this Month — smooth area, no point markers */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Earnings for this Month</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={weeklyEarnings} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="earningsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#007BC1" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#007BC1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="week" {...axisProps} style={{ fontSize: '11px' }} tick={{ dy: 4 }} />
                <YAxis {...axisProps} style={{ fontSize: '11px' }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} width={52} />
                <Tooltip formatter={pesoTooltip} />
                <Area
                  type="monotone"
                  dataKey="earnings"
                  stroke="#007BC1"
                  strokeWidth={2}
                  fill="url(#earningsFill)"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Volume row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Selling Tank — progress-bar list, not a chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-5">Top Selling Tank</h3>
            <div className="flex flex-col gap-5">
              {topSellingTanks.map((tank) => (
                <div key={tank.size}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-gray-700">{tank.size}</span>
                    <span className="text-sm text-gray-500">{tank.orders} Orders</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${maxTankOrders > 0 ? (tank.orders / maxTankOrders) * 100 : 0}%`,
                        backgroundColor: tank.orders > 0 ? tank.color : '#d1d5db',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Volume Trend — smooth line, scaled from zero to live data */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Order Volume Trend</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={orderVolumeTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="month" {...axisProps} style={{ fontSize: '11px' }} tick={{ dy: 4 }} />
                <YAxis
                  {...axisProps}
                  style={{ fontSize: '11px' }}
                  domain={[0, 'auto']}
                  width={40}
                />
                <Tooltip formatter={(v) => [Number(v).toLocaleString(), 'Orders']} />
                <Line
                  type="monotone"
                  dataKey="orders"
                  stroke="#007BC1"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
