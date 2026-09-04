import { useEffect, useState } from 'react';
import { Header } from './Header';
import { KPICard } from './KPICard';
import { TrendingUp, ShoppingBag, ArrowUpRight } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell
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
    apiFetch(`/service-requests/reports/branch-owner-sales?branchId=${encodeURIComponent(selectedBranchId)}`, { signal: controller.signal })
      .then((response) => response.json().then((data) => response.ok ? setAllSales(data?.sales ?? []) : setAllSales([])))
      .catch(() => setAllSales([]));
    return () => controller.abort();
  }, [selectedBranchId]);

  const currentMetrics = salesMetrics.at(-1);
  const previousMetrics = salesMetrics.at(-2);
  const currentRevenue = Number(currentMetrics?.totalRevenue ?? 0);
  const previousRevenue = Number(previousMetrics?.totalRevenue ?? 0);
  const revenueChange = previousRevenue === 0 ? 0 : ((currentRevenue - previousRevenue) / previousRevenue) * 100;
  const liveMonthlyRevenue = salesMetrics.map((metrics) => ({
    month: new Intl.DateTimeFormat('en-PH', { month: 'short' }).format(metrics.label),
    revenue: Number(metrics.totalRevenue ?? 0),
  }));
  const liveTankRevenue = (currentMetrics?.revenueByTank ?? []).map((entry: { size: string; revenue: number }, index: number) => ({
    ...entry,
    color: ['#007BC1', '#41A3E0', '#76B4DD', '#1a5f8a'][index % 4],
  }));
  const liveSales = allSales;

  // Limit the table data to only the 5 most recent entries
  const recentSalesData = liveSales.slice(0, 5);

  const revenueData = chartView === 'monthly' ? liveMonthlyRevenue : liveMonthlyRevenue;
  const xKey = 'month';

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
          />
          <KPICard
            title="Total Orders Completed"
            value={salesLoading ? '—' : String(currentMetrics?.completedDeliveries ?? 0)}
            icon={<ShoppingBag className="w-4 h-4 text-[#007BC1]" />}
            accentColor="#007BC1"
            trend={undefined}
          />
          <KPICard
            title="Revenue vs Last Month"
            value={salesLoading ? '—' : `${revenueChange >= 0 ? '+' : ''}${revenueChange.toFixed(1)}%`}
            icon={<ArrowUpRight className="w-4 h-4 text-[#22c55e]" />}
            accentColor="#22c55e"
            trend={salesLoading ? undefined : { text: 'Compared to last month', direction: revenueChange >= 0 ? 'up' : 'down', positive: revenueChange >= 0 }}
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Revenue Trend</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setChartView('monthly')}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                  chartView === 'monthly'
                    ? 'bg-[#007BC1] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setChartView('quarterly')}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                  chartView === 'quarterly'
                    ? 'bg-[#007BC1] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
              <XAxis dataKey={xKey} {...axisProps} style={{ fontSize: '11px' }} tick={{ dy: 4 }} />
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
            <h3 className="font-semibold text-gray-900 mb-4">Revenue by LPG Tank Size</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={liveTankRevenue} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="size" {...axisProps} style={{ fontSize: '11px' }} tick={{ dy: 4 }} />
                <YAxis {...axisProps} style={{ fontSize: '11px' }} tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`} width={52} />
                <Tooltip formatter={pesoTooltip} cursor={{ fill: 'rgba(0, 123, 193, 0.06)' }} />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                  {liveTankRevenue.map((entry: { size: string; color: string }) => (
                    <Cell key={entry.size} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
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
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Order Date</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Receipt No.</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Customer</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Total Orders</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Cash Received</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Paid</th>
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