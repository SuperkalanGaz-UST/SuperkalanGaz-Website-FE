'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from './Header';
import { KPICard } from './KPICard';
import { OrderVolumeChart, type OrderAnalyticsSeries, type BranchRow } from './OrderVolumeChart';
import { CSATChart, type CsatAnalyticsSeries } from './CSATChart';
import { SLATable } from './SLATable';
import { ShoppingCart, Truck, Star, ClipboardCheck } from 'lucide-react';
import { fetchJson } from '../lib/api';
import { governanceApi } from '../super-admin/api';

// ─── helpers ────────────────────────────────────────────────────────────────

function toISODateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Default date-range: first day of 6 months ago → today */
function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 6);
  from.setDate(1);
  return {
    from: toISODateString(from),
    to: toISODateString(to),
  };
}

// ─── component ──────────────────────────────────────────────────────────────

export function Dashboard() {
  const [dateRange, setDateRange] = useState(defaultRange);

  // ── 1. Branches list (for dropdown and total count) ──────────────────────
  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: () => fetchJson<{ branches: BranchRow[] }>('/branches'),
    staleTime: 60_000,
  });
  const branches = useMemo(
    () => (branchesData?.branches ?? []).filter((b) => b.status === 'active'),
    [branchesData],
  );

  // ── 2. Order-volume analytics ─────────────────────────────────────────────
  const { data: orderData, isLoading: orderLoading } = useQuery({
    queryKey: ['franchise-order-analytics', dateRange.from, dateRange.to],
    queryFn: () =>
      fetchJson<{ series: OrderAnalyticsSeries[] }>(
        `/service-requests/franchise-analytics?from=${dateRange.from}&to=${dateRange.to}`,
      ),
  });
  const orderSeries = orderData?.series ?? [];

  // ── 3. CSAT analytics ────────────────────────────────────────────────────
  const { data: csatData, isLoading: csatLoading } = useQuery({
    queryKey: ['franchise-csat-analytics', dateRange.from, dateRange.to],
    queryFn: () =>
      fetchJson<{ series: CsatAnalyticsSeries[] }>(
        `/csat/franchise-analytics?from=${dateRange.from}&to=${dateRange.to}`,
      ),
  });
  const csatSeries = csatData?.series ?? [];

  // ── 4. Governance dashboard (for pending approvals KPI) ──────────────────
  const { data: govData, isLoading: govLoading } = useQuery({
    queryKey: ['governance-dashboard'],
    queryFn: () => governanceApi.dashboard(),
    staleTime: 30_000,
  });

  // ── KPI computations ─────────────────────────────────────────────────────

  const totalOrders = useMemo(
    () => orderSeries.reduce((sum, s) => sum + s.orderCount, 0),
    [orderSeries],
  );

  const deliveryCompletionRate = useMemo(() => {
    const delivered = orderSeries.reduce((sum, s) => sum + s.deliveredCount, 0);
    const cancelled = orderSeries.reduce((sum, s) => sum + s.cancelledCount, 0);
    const denominator = totalOrders - cancelled;
    if (denominator <= 0) return null;
    return Math.round((delivered / denominator) * 1000) / 10; // one decimal place
  }, [orderSeries, totalOrders]);

  const avgCsat = useMemo(() => {
    const totalWeight = csatSeries.reduce((sum, s) => sum + s.totalRatings, 0);
    if (totalWeight === 0) return null;
    const weightedSum = csatSeries.reduce((sum, s) => sum + s.avgStars * s.totalRatings, 0);
    return Math.round((weightedSum / totalWeight) * 10) / 10;
  }, [csatSeries]);

  const pendingApprovals = govData?.metrics.pendingApprovals ?? null;

  const chartsLoading = orderLoading || branchesLoading;
  const csatChartLoading = csatLoading || branchesLoading;

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header title="Dashboard" />
      </div>

      <div className="p-8">
        {/* Date-range picker */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-sm font-medium text-gray-600">Date range:</span>
          <input
            type="date"
            value={dateRange.from}
            max={dateRange.to}
            onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
            className="h-9 rounded-lg border border-gray-300 px-3 text-sm text-gray-700 focus:outline-none focus:border-[#007BC1]"
          />
          <span className="text-sm text-gray-400">to</span>
          <input
            type="date"
            value={dateRange.to}
            min={dateRange.from}
            onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
            className="h-9 rounded-lg border border-gray-300 px-3 text-sm text-gray-700 focus:outline-none focus:border-[#007BC1]"
          />
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <KPICard
            title="Total Orders — All Branches"
            value={orderLoading ? '…' : totalOrders.toLocaleString()}
            icon={<ShoppingCart className="w-4 h-4 text-[#007BC1]" />}
            accentColor="#007BC1"
          />
          <KPICard
            title="System Delivery Completion Rate"
            value={
              orderLoading
                ? '…'
                : deliveryCompletionRate !== null
                ? `${deliveryCompletionRate}%`
                : '—'
            }
            icon={<Truck className="w-4 h-4 text-[#16A34A]" />}
            accentColor="#16A34A"
          />
          <KPICard
            title="System Average CSAT Score"
            value={csatLoading ? '…' : avgCsat !== null ? String(avgCsat) : '—'}
            icon={<Star className="w-4 h-4 text-[#f59e0b]" />}
            accentColor="#f59e0b"
          />
          <KPICard
            title="Pending Branch Approvals"
            value={govLoading ? '…' : pendingApprovals !== null ? String(pendingApprovals) : '—'}
            icon={<ClipboardCheck className="w-4 h-4 text-[#9333EA]" />}
            accentColor="#9333EA"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <OrderVolumeChart
            branches={branches}
            series={orderSeries}
            isLoading={chartsLoading}
          />
          <CSATChart
            branches={branches}
            series={csatSeries}
            isLoading={csatChartLoading}
          />
        </div>

        <SLATable />
      </div>
    </div>
  );
}