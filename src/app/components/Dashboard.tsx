'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from './Header';
import { KPICard } from './KPICard';
import { DropdownMenu } from './DropdownMenu';
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

  // ── Shared Province/Branch filter — drives both charts and the KPI cards ──
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');

  useEffect(() => {
    if (branches.length === 0) return;
    const unassigned = branches.filter((b) => !b.province);
    if (unassigned.length > 0) {
      console.warn(
        '[Dashboard] The following active branches have no province set in the database ' +
          '(they will appear under "Unassigned" in the Province dropdown):\n' +
          unassigned.map((b) => `  • ${b.name} (id: ${b.id})`).join('\n'),
      );
    }
  }, [branches]);

  const provinceOptions = useMemo(() => {
    const provinces = new Set<string>();
    for (const b of branches) {
      provinces.add(b.province ?? 'Unassigned');
    }
    const sorted = Array.from(provinces).sort((a, b) =>
      a === 'Unassigned' ? 1 : b === 'Unassigned' ? -1 : a.localeCompare(b),
    );
    return [
      { value: '', label: 'All Provinces' },
      ...sorted.map((p) => ({ value: p, label: p })),
    ];
  }, [branches]);

  const branchOptions = useMemo(() => {
    if (!selectedProvince) return [];
    const filtered = branches.filter(
      (b) => (b.province ?? 'Unassigned') === selectedProvince,
    );
    return [
      { value: '', label: `All in ${selectedProvince}` },
      ...filtered.map((b) => ({
        value: b.id,
        label: b.city ? `${b.city} — ${b.name}` : b.name,
      })),
    ];
  }, [branches, selectedProvince]);

  const handleProvinceChange = (province: string) => {
    setSelectedProvince(province);
    setSelectedBranch('');
  };

  // If a specific branch is selected, scope to it. Else if a province is
  // selected, scope to every branch in it. Otherwise, show everything.
  const activeBranches = useMemo(() => {
    if (selectedBranch) return branches.filter((b) => b.id === selectedBranch);
    if (selectedProvince) {
      return branches.filter((b) => (b.province ?? 'Unassigned') === selectedProvince);
    }
    return branches;
  }, [branches, selectedProvince, selectedBranch]);

  const activeBranchIds = useMemo(() => new Set(activeBranches.map((b) => b.id)), [activeBranches]);

  const scopeLabel = selectedBranch
    ? (activeBranches[0]?.name ?? 'All Branches')
    : selectedProvince || 'All Branches';

  // ── 2. Order-volume analytics ─────────────────────────────────────────────
  const { data: orderData, isLoading: orderLoading } = useQuery({
    queryKey: ['franchise-order-analytics', dateRange.from, dateRange.to],
    queryFn: () =>
      fetchJson<{ series: OrderAnalyticsSeries[] }>(
        `/service-requests/franchise-analytics?from=${dateRange.from}&to=${dateRange.to}`,
      ),
  });
  const orderSeries = useMemo(() => orderData?.series ?? [], [orderData]);
  const filteredOrderSeries = useMemo(
    () => orderSeries.filter((s) => activeBranchIds.has(s.branchId)),
    [orderSeries, activeBranchIds],
  );

  // ── 3. CSAT analytics ────────────────────────────────────────────────────
  const { data: csatData, isLoading: csatLoading } = useQuery({
    queryKey: ['franchise-csat-analytics', dateRange.from, dateRange.to],
    queryFn: () =>
      fetchJson<{ series: CsatAnalyticsSeries[] }>(
        `/csat/franchise-analytics?from=${dateRange.from}&to=${dateRange.to}`,
      ),
  });
  const csatSeries = useMemo(() => csatData?.series ?? [], [csatData]);
  const filteredCsatSeries = useMemo(
    () => csatSeries.filter((s) => activeBranchIds.has(s.branchId)),
    [csatSeries, activeBranchIds],
  );

  // ── 4. Governance dashboard (for pending approvals KPI) ──────────────────
  const { data: govData, isLoading: govLoading } = useQuery({
    queryKey: ['governance-dashboard'],
    queryFn: () => governanceApi.dashboard(),
    staleTime: 30_000,
  });

  // ── KPI computations ─────────────────────────────────────────────────────

  const totalOrders = useMemo(
    () => filteredOrderSeries.reduce((sum, s) => sum + s.orderCount, 0),
    [filteredOrderSeries],
  );

  const deliveryCompletionRate = useMemo(() => {
    const delivered = filteredOrderSeries.reduce((sum, s) => sum + s.deliveredCount, 0);
    const cancelled = filteredOrderSeries.reduce((sum, s) => sum + s.cancelledCount, 0);
    const denominator = totalOrders - cancelled;
    if (denominator <= 0) return null;
    return Math.round((delivered / denominator) * 1000) / 10; // one decimal place
  }, [filteredOrderSeries, totalOrders]);

  const avgCsat = useMemo(() => {
    const totalWeight = filteredCsatSeries.reduce((sum, s) => sum + s.totalRatings, 0);
    if (totalWeight === 0) return null;
    const weightedSum = filteredCsatSeries.reduce((sum, s) => sum + s.avgStars * s.totalRatings, 0);
    return Math.round((weightedSum / totalWeight) * 10) / 10;
  }, [filteredCsatSeries]);

  const pendingApprovals = govData?.metrics.pendingApprovals ?? null;

  const chartsLoading = orderLoading || branchesLoading;
  const csatChartLoading = csatLoading || branchesLoading;

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header title="Dashboard" />
      </div>

      <div className="p-8">
        {/* Date-range + branch/province filter toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
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
          <span className="ml-2 text-sm font-medium text-gray-600">Branch:</span>
          <DropdownMenu
            label="All Provinces"
            options={provinceOptions}
            value={selectedProvince}
            onChange={handleProvinceChange}
          />
          <DropdownMenu
            label="All Branches"
            options={branchOptions}
            value={selectedBranch}
            onChange={setSelectedBranch}
            disabled={!selectedProvince}
          />
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <KPICard
            title={`Total Orders — ${scopeLabel}`}
            value={orderLoading ? '…' : totalOrders.toLocaleString()}
            icon={<ShoppingCart className="w-4 h-4 text-[#007BC1]" />}
            accentColor="#007BC1"
          />
          <KPICard
            title={`Delivery Completion Rate — ${scopeLabel}`}
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
            title={`Average CSAT Score — ${scopeLabel}`}
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
            activeBranches={activeBranches}
          />
          <CSATChart
            branches={branches}
            series={csatSeries}
            isLoading={csatChartLoading}
            activeBranches={activeBranches}
          />
        </div>

        <SLATable />
      </div>
    </div>
  );
}