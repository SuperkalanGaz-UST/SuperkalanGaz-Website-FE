import { useEffect, useState } from 'react';
import { Header } from './Header';
import { KPICard } from './KPICard';
import { TrendingUp, ShoppingBag, ArrowUpRight } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie,
} from 'recharts';
import { apiFetch } from '../../lib/api';
import { useBranch } from '../contexts/BranchContext';

const axisProps = {
  axisLine: false as const,
  tickLine: false as const,
  stroke: '#9ca3af',
};

const pesoTooltip = (v: number | string) => [`₱${Number(v).toLocaleString()}`, 'Revenue'];

export function SalesOverview() {
  const { selectedBranchId } = useBranch();
  const [chartView, setChartView] = useState<'monthly' | 'quarterly'>('monthly');
  const [salesMetrics, setSalesMetrics] = useState<any[]>([]);
  const [allSales, setAllSales] = useState<any[]>([]);
  const [salesLoading, setSalesLoading] = useState(true);

  useEffect(() => {
    if (!selectedBranchId) return;
    const controller = new AbortController();
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, date.getMonth() + 1, 0).getDate();
      return { from: `${year}-${month}-01`, to: `${year}-${month}-${lastDay}`, label: date };
    });
    setSalesLoading(true);
    Promise.all(months.map(async ({ from, to, label }) => {
      const query = new URLSearchParams({ from, to, branchId: selectedBranchId }).toString();
      const response = await apiFetch(`/service-requests/reports/branch-owner-dashboard?${query}`, { signal: controller.signal });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error('Could not load sales data.');
      return { label, ...(data?.metrics ?? {}) };
    })).then(setSalesMetrics).catch(() => setSalesMetrics([])).finally(() => setSalesLoading(false));
    apiFetch(`/service-requests/reports/branch-owner-sales?branchId=${encodeURIComponent(selectedBranchId)}&limit=5`, { signal: controller.signal })
      .then((response) => response.json().then((data) => response.ok ? setAllSales(data?.sales ?? []) : setAllSales([])))
      .catch(() => setAllSales([]));
    return () => controller.abort();
  }, [selectedBranchId]);

  // "Month" reuses the already-fetched current month (no extra call); Day/Week
  // need their own range since the pre-fetched months are already collapsed
  // into one aggregate each and can't be re-bucketed client-side.
  const [tankPeriod, setTankPeriod] = useState<'day' | 'week' | 'month'>('month');
  const [tankRevenueOverride, setTankRevenueOverride] = useState<{ size: string; revenue: number }[] | null>(null);
  const [tankRevenueLoading, setTankRevenueLoading] = useState(false);

  useEffect(() => {
    if (!selectedBranchId || tankPeriod === 'month') {
      setTankRevenueOverride(null);
      return;
    }
    const controller = new AbortController();
    const now = new Date();
    const format = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const from = tankPeriod === 'day'
      ? format(now)
      : format(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
    const to = format(now);
    setTankRevenueLoading(true);
    const query = new URLSearchParams({ from, to, branchId: selectedBranchId }).toString();
    apiFetch(`/service-requests/reports/branch-owner-dashboard?${query}`, { signal: controller.signal })
      .then((response) => response.json().then((data) =>
        setTankRevenueOverride(response.ok ? (data?.metrics?.revenueByTank ?? []) : [])))
      .catch(() => setTankRevenueOverride([]))
      .finally(() => setTankRevenueLoading(false));
    return () => controller.abort();
  }, [tankPeriod, selectedBranchId]);

  const currentMetrics = salesMetrics.at(-1);
  const previousMetrics = salesMetrics.at(-2);
  const currentRevenue = Number(currentMetrics?.totalRevenue ?? 0);
  const previousRevenue = Number(previousMetrics?.totalRevenue ?? 0);
  const revenueChange = previousRevenue === 0 ? 0 : ((currentRevenue - previousRevenue) / previousRevenue) * 100;
  const liveMonthlyRevenue = salesMetrics.map((metrics) => ({
    period: new Intl.DateTimeFormat('en-PH', { month: 'short' }).format(metrics.label),
    revenue: Number(metrics.totalRevenue ?? 0),
  }));
  // Re-derived from the same 6 already-fetched months — no new fetch/endpoint.
  // Only 2-3 quarter buckets show up under this rolling window, same way the
  // "Monthly" view is itself only a rolling 6 months, not a calendar year.
  const liveQuarterlyRevenue = (() => {
    const byQuarter = new Map<string, { year: number; quarter: number; revenue: number }>();
    for (const metrics of salesMetrics) {
      const date: Date = metrics.label;
      const year = date.getFullYear();
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      const key = `${year}-Q${quarter}`;
      const existing = byQuarter.get(key) ?? { year, quarter, revenue: 0 };
      existing.revenue += Number(metrics.totalRevenue ?? 0);
      byQuarter.set(key, existing);
    }
    return [...byQuarter.values()]
      .sort((a, b) => a.year - b.year || a.quarter - b.quarter)
      .map((entry) => ({ period: `Q${entry.quarter} ${entry.year}`, revenue: entry.revenue }));
  })();
  const activeTankRevenue: { size: string; revenue: number }[] =
    tankPeriod === 'month' ? (currentMetrics?.revenueByTank ?? []) : (tankRevenueOverride ?? []);
  const liveTankRevenue = activeTankRevenue.map((entry, index) => ({
    ...entry,
    color: ['#007BC1', '#41A3E0', '#76B4DD', '#1a5f8a'][index % 4],
  }));
  const tankChartLoading = tankPeriod === 'month' ? salesLoading : tankRevenueLoading;
  // A 0-revenue tank size renders as a meaningless sliver in a donut (unlike
  // a bar chart's harmless 0-height bar), so it's dropped before charting.
  const chartableTankRevenue = liveTankRevenue.filter((entry: { revenue: number }) => entry.revenue > 0);
  const liveSales = allSales;

  // Limit the table data to only the 5 most recent entries
  const recentSalesData = liveSales.slice(0, 5);

  const revenueData = chartView === 'monthly' ? liveMonthlyRevenue : liveQuarterlyRevenue;

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header title="Sales" />
      </div>

      <div className="p-8">
        <div className="grid grid-cols-3 gap-6 mb-8">
          <KPICard
            title="Total Revenue This Month"
            value={salesLoading ? '—' : `₱${currentRevenue.toLocaleString()}`}
            icon={<TrendingUp className="w-4 h-4 text-[#007BC1]" />}
            accentColor="#007BC1"
            trend={salesLoading ? undefined : { text: `${revenueChange >= 0 ? '+' : ''}${revenueChange.toFixed(1)}% from last month`, direction: revenueChange >= 0 ? 'up' : 'down', positive: revenueChange >= 0 }}
            tooltip={salesLoading ? undefined : <span>Previous month: ₱{previousRevenue.toLocaleString()}</span>}
          />
          <KPICard
            title="Total Orders Completed"
            value={salesLoading ? '—' : String(currentMetrics?.completedDeliveries ?? 0)}
            icon={<ShoppingBag className="w-4 h-4 text-[#007BC1]" />}
            accentColor="#007BC1"
            trend={undefined}
            tooltip={salesLoading ? undefined : (
              <div className="flex flex-col gap-1">
                <span>{currentMetrics?.totalOrders ?? 0} total orders this month</span>
                <span>{currentMetrics?.cancelledFailedDeliveries ?? 0} cancelled/failed</span>
              </div>
            )}
          />
          <KPICard
            title="Revenue vs Last Month"
            value={salesLoading ? '—' : `${revenueChange >= 0 ? '+' : ''}${revenueChange.toFixed(1)}%`}
            icon={<ArrowUpRight className="w-4 h-4 text-[#22c55e]" />}
            accentColor="#22c55e"
            trend={salesLoading ? undefined : { text: 'Compared to last month', direction: revenueChange >= 0 ? 'up' : 'down', positive: revenueChange >= 0 }}
            tooltip={salesLoading ? undefined : <span>₱{(currentRevenue - previousRevenue).toLocaleString()} difference from last month</span>}
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Revenue Trend</h3>
            <div className="flex rounded-lg border border-gray-200 p-0.5 text-sm">
              <button
                type="button"
                onClick={() => setChartView('monthly')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  chartView === 'monthly' ? 'bg-[#007BC1] text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setChartView('quarterly')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  chartView === 'quarterly' ? 'bg-[#007BC1] text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Quarterly
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={revenueData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="salesRevenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#007BC1" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#007BC1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="period" {...axisProps} style={{ fontSize: '11px' }} tick={{ dy: 4 }} />
              <YAxis {...axisProps} style={{ fontSize: '11px' }} tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`} width={52} />
              <Tooltip formatter={pesoTooltip} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#007BC1"
                strokeWidth={2}
                fill="url(#salesRevenueFill)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Revenue by LPG Tank Size</h3>
              <div className="flex rounded-lg border border-gray-200 p-0.5 text-sm">
                {(['day', 'week', 'month'] as const).map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setTankPeriod(period)}
                    className={`px-3 py-1 rounded-md capitalize transition-colors ${
                      tankPeriod === period ? 'bg-[#007BC1] text-white' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
            {tankChartLoading ? (
              <p className="py-10 text-center text-sm text-gray-400">Loading…</p>
            ) : chartableTankRevenue.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">No revenue recorded for this period.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={chartableTankRevenue}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="revenue"
                      nameKey="size"
                    >
                      {chartableTankRevenue.map((entry: { size: string; color: string }) => (
                        <Cell key={entry.size} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number, name: string) => [`₱${Number(value).toLocaleString()}`, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-6 mt-4">
                  {chartableTankRevenue.map((entry: { size: string; revenue: number; color: string }) => (
                    <div key={entry.size} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                      <span className="text-xs text-gray-600">{entry.size}: ₱{entry.revenue.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-gray-900">Sales</h3>
            <a 
              href="#" 
              onClick={(e) => { 
                e.preventDefault(); 
                window.dispatchEvent(new CustomEvent('navigate', { detail: 'sales-full' })); 
              }} 
              className="text-[11px] text-[#007BC1] hover:text-[#005a8f] transition-colors"
            >
              View all
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-xs font-semibold text-gray-700 pb-3">Order Date</th>
                  <th className="text-left text-xs font-semibold text-gray-700 pb-3">Receipt No.</th>
                  <th className="text-left text-xs font-semibold text-gray-700 pb-3">Customer</th>
                  <th className="text-left text-xs font-semibold text-gray-700 pb-3">Total Orders</th>
                  <th className="text-left text-xs font-semibold text-gray-700 pb-3">Cash Received</th>
                  <th className="text-left text-xs font-semibold text-gray-700 pb-3">Paid</th>
                </tr>
              </thead>
              <tbody>
                {recentSalesData.map((row: any, index: number) => (
                  <tr key={row.id} className={`border-b border-gray-100 ${index % 2 === 1 ? 'bg-gray-50' : ''}`}>
                    <td className="py-3 text-[13px] text-gray-900 whitespace-nowrap">{row.date}</td>
                    <td className="py-3 text-[13px] text-gray-900 whitespace-nowrap font-mono">{row.receipt}</td>
                    <td className="py-3 text-[13px] text-gray-900 whitespace-nowrap">{row.customer}</td>
                    <td className="py-3 text-[13px] text-gray-600 whitespace-nowrap">{row.orders}</td>
                    <td className="py-3 text-[13px] text-gray-900 whitespace-nowrap">₱{row.spent.toLocaleString()}</td>
                    <td className="py-3">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-[11px] font-medium ${
                          row.paid === 'Paid'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {row.paid}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}