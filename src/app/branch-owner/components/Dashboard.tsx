import { Header } from './Header';
import { KPICard } from './KPICard';
import { ShoppingCart, Truck, Star, Gift } from 'lucide-react';
import { useBranchData } from '../hooks/useBranchData';
import {
  BarChart, Bar, Cell, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

// ---------------------------------------------------------------------------
// Mock chart data — demo values pending API wiring (AGENTS.md §13).
// ---------------------------------------------------------------------------

/** Hourly earnings across the business day (8 AM – 6 PM). */
const hourlyEarnings = [
  { hour: '8 AM', earnings: 2400 },
  { hour: '9 AM', earnings: 3800 },
  { hour: '10 AM', earnings: 5200 },
  { hour: '11 AM', earnings: 6100 },
  { hour: '12 PM', earnings: 5800 },
  { hour: '1 PM', earnings: 4200 },
  { hour: '2 PM', earnings: 3600 },
  { hour: '3 PM', earnings: 5100 },
  { hour: '4 PM', earnings: 5900 },
  { hour: '5 PM', earnings: 4800 },
  { hour: '6 PM', earnings: 3200 },
];

/** Month-to-date earnings rolled up by week. */
const weeklyEarnings = [
  { week: 'Week 1', earnings: 52400 },
  { week: 'Week 2', earnings: 61800 },
  { week: 'Week 3', earnings: 58200 },
  { week: 'Week 4', earnings: 67400 },
  { week: 'Week 5', earnings: 44700 },
];

/**
 * Sales volume by cylinder size. Colors are a validated categorical trio
 * (CVD-checked); identity is never color-alone — every row carries its label.
 */
const topSellingTanks = [
  { size: '11 kg', orders: 147, color: '#EA580C' },
  { size: '5 kg', orders: 89, color: '#16A34A' },
  { size: '2.7 kg', orders: 48, color: '#9333EA' },
];

/** Overall order volume per month, scaled to the 75–300 axis window. */
const orderVolumeTrend = [
  { month: 'Jan', orders: 118 },
  { month: 'Feb', orders: 142 },
  { month: 'Mar', orders: 131 },
  { month: 'Apr', orders: 176 },
  { month: 'May', orders: 205 },
  { month: 'Jun', orders: 248 },
];

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
  const maxTankOrders = Math.max(...topSellingTanks.map((t) => t.orders));

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
                        width: `${(tank.orders / maxTankOrders) * 100}%`,
                        backgroundColor: tank.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Volume Trend — smooth line, fixed 75–300 scale */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Order Volume Trend</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={orderVolumeTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="month" {...axisProps} style={{ fontSize: '11px' }} tick={{ dy: 4 }} />
                <YAxis
                  {...axisProps}
                  style={{ fontSize: '11px' }}
                  domain={[75, 300]}
                  ticks={[75, 150, 225, 300]}
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
