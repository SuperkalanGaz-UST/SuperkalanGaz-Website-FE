import { useState } from 'react';
import { Header } from './Header';
import { KPICard } from './KPICard';
import { ShoppingCart, Truck, Star, Gift } from 'lucide-react';
import { useBranchData } from '../hooks/useBranchData';
import {
  AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

const EARNINGS_PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
] as const;
type EarningsPeriod = (typeof EARNINGS_PERIODS)[number]['value'];

const pesoTooltip = (v: number | string) => [`₱${Number(v).toLocaleString()}`, 'Earnings'];

/** Shared axis look: no grid, no axis/tick lines — minimalist per the design. */
const axisProps = {
  axisLine: false as const,
  tickLine: false as const,
  stroke: '#9ca3af',
};

const EARNINGS_X_KEYS: Record<EarningsPeriod, string> = {
  today: 'hour',
  week: 'day',
  month: 'week',
};

export function Dashboard() {
  const branchData = useBranchData();
  const [earningsPeriod, setEarningsPeriod] = useState<EarningsPeriod>('today');
  const earningsByPeriod: Record<EarningsPeriod, { earnings: number }[]> = {
    today: branchData.earningsToday,
    week: branchData.earningsThisWeek,
    month: branchData.earningsThisMonth,
  };
  const earningsData = earningsByPeriod[earningsPeriod];
  const earningsXKey = EARNINGS_X_KEYS[earningsPeriod];

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
            tooltip={(
              <div className="flex flex-col gap-1">
                <span>{branchData.totalOrders} total orders this month</span>
                <span>{branchData.ordersLastMonth} orders last month</span>
              </div>
            )}
          />
          <KPICard
            title="Delivery Completion Rate"
            value={branchData.completionRate}
            icon={<Truck className="w-4 h-4 text-[#16A34A]" />}
            accentColor="#16A34A"
            trend={branchData.trends.completion}
            tooltip={(
              <div className="flex flex-col gap-1">
                <span>{branchData.completedDeliveries} completed deliveries</span>
                <span>{branchData.cancelledFailedDeliveries} cancelled/failed</span>
                <span>{branchData.slaBreaches} SLA breaches</span>
              </div>
            )}
          />
          <KPICard
            title="Average CSAT Score"
            value={branchData.csatScore}
            icon={<Star className="w-4 h-4 text-[#f59e0b]" />}
            accentColor="#f59e0b"
            trend={undefined}
            tooltip={branchData.trends.csat
              ? <span>{branchData.trends.csat.text}</span>
              : <span>No ratings yet this month.</span>}
          />
          <KPICard
            title="Loyalty Claims This Month"
            value={branchData.loyaltyRedemptions}
            icon={<Gift className="w-4 h-4 text-[#9333EA]" />}
            accentColor="#9333EA"
            trend={branchData.trends.loyalty}
            tooltip={<span>Rewards redeemed by repeat customers this month.</span>}
          />
        </div>

        {/* Earnings — single card, Today/This Week/This Month filter swaps the chart below */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Earnings</h3>
            <div className="flex rounded-lg border border-gray-200 p-0.5 text-sm">
              {EARNINGS_PERIODS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setEarningsPeriod(value)}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    earningsPeriod === value ? 'bg-[#007BC1] text-white' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={earningsData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="earningsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#007BC1" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#007BC1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey={earningsXKey} {...axisProps} style={{ fontSize: '11px' }} tick={{ dy: 4 }} interval="preserveStartEnd" />
              <YAxis {...axisProps} style={{ fontSize: '11px' }} tickFormatter={(v) => `₱${(v / 1000).toFixed(1)}k`} width={52} />
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
    </div>
  );
}
