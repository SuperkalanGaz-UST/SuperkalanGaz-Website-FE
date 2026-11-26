import { useEffect, useState } from 'react';
import { useBranch } from '../contexts/BranchContext';
import type { KPITrend } from '../components/KPICard';
import { apiFetch } from '../../lib/api';

type BranchDataShape = {
  error: string | null;
  ordersToday: string;
  totalOrders: string;
  ordersLastMonth: string;
  completedDeliveries: string;
  cancelledFailedDeliveries: string;
  slaBreaches: string;
  completionRate: string;
  csatScore: string;
  loyaltyRedemptions: string;
  stockLevel: number;
  trends: {
    orders?: KPITrend;
    completion?: KPITrend;
    csat?: KPITrend;
    loyalty?: KPITrend;
  };
  dailyOrderVolume: { day: string; orders: number }[];
  hourlyOrderVolume: { hour: string; orders: number }[];
  csatTrendData: { month: string; score: number }[];
  earningsToday: { hour: string; earnings: number }[];
  earningsThisWeek: { day: string; earnings: number }[];
  earningsThisMonth: { week: string; earnings: number }[];
};

type CsatReport = { average_stars?: number | null; total_responses?: number };

const formatDay = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

/**
 * The 1st of the month `offset` months from now through today's day of the
 * month (capped at that month's end). monthToDate(-1) is "same period last month".
 */
export function monthToDate(offset = 0): { from: string; to: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const year = Number(parts.find(part => part.type === 'year')!.value);
  const month = Number(parts.find(part => part.type === 'month')!.value) - 1;
  const day = Number(parts.find(part => part.type === 'day')!.value);
  const first = new Date(Date.UTC(year, month + offset, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return {
    from: formatDay(first),
    to: formatDay(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(day, lastDay)))),
  };
}

// Shown before data loads and after a failed load. Screens remount on a branch
// switch, so another branch's figures are never left on screen.
const EMPTY_BRANCH_DATA: BranchDataShape = {
  error: null,
  ordersToday: '—',
  totalOrders: '—',
  ordersLastMonth: '—',
  completedDeliveries: '—',
  cancelledFailedDeliveries: '—',
  slaBreaches: '—',
  completionRate: '—',
  csatScore: '—',
  loyaltyRedemptions: '—',
  stockLevel: 0,
  trends: {},
  dailyOrderVolume: [],
  hourlyOrderVolume: [],
  csatTrendData: [],
  earningsToday: [],
  earningsThisWeek: [],
  earningsThisMonth: [],
};

export function useBranchData(): BranchDataShape {
  const { selectedBranchId } = useBranch();
  const [data, setData] = useState<BranchDataShape>(EMPTY_BRANCH_DATA);

  useEffect(() => {
    let active = true;
    if (!selectedBranchId) return () => { active = false; };

    const controller = new AbortController();
    let refreshing = false;
    const refresh = () => {
    if (refreshing || !active) return;
    refreshing = true;
    const query = new URLSearchParams({ ...monthToDate(), branchId: selectedBranchId }).toString();
    const previousQuery = new URLSearchParams({ ...monthToDate(-1), branchId: selectedBranchId }).toString();

    Promise.all([
      apiFetch(`/service-requests/reports/branch-owner-dashboard?${query}`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) }).catch(() => null),
      apiFetch(`/service-requests/reports/branch-owner-dashboard?${previousQuery}`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) }).catch(() => null),
      apiFetch(`/csat/reports/dashboard-summary?${query}`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) }).catch(() => null),
    ])
      .then(async ([metricsResponse, previousMetricsResponse, csatResponse]) => {
        const [metricsData, previousMetricsData, csatData] = await Promise.all([
          metricsResponse?.json().catch(() => null),
          previousMetricsResponse?.json().catch(() => null),
          csatResponse?.json().catch(() => null),
        ]);
        if (!active) return;

        const metrics = metricsResponse?.ok ? metricsData?.metrics : undefined;
        const previousMetrics = previousMetricsResponse?.ok ? previousMetricsData?.metrics : undefined;
        const csat: CsatReport | undefined = csatResponse?.ok ? csatData?.report : undefined;
        const average = csat?.average_stars;
        const trends: BranchDataShape['trends'] = {};
        if (average !== null && average !== undefined) {
          const total = csat?.total_responses ?? 0;
          trends.csat = {
            text: `${total} rating${total === 1 ? '' : 's'} this month`,
            direction: 'up',
            positive: true,
          };
        }

        setData((current) => ({
          ...current,
          error: !metrics || !previousMetrics || !csat ? 'Some report data is unavailable. Retrying automatically.' : null,
          ordersToday: metrics ? String(metrics.ordersToday) : '—',
          totalOrders: metrics ? String(metrics.totalOrders) : '—',
          ordersLastMonth: previousMetrics ? String(previousMetrics.totalOrders) : '—',
          completedDeliveries: metrics ? String(metrics.completedDeliveries) : '—',
          cancelledFailedDeliveries: metrics ? String(metrics.cancelledFailedDeliveries) : '—',
          slaBreaches: metrics ? String(metrics.slaBreaches) : '—',
          loyaltyRedemptions: metrics ? String(metrics.loyaltyClaimsThisMonth) : '—',
          earningsToday: metrics?.earningsToday ?? [],
          earningsThisWeek: metrics?.earningsThisWeek ?? [],
          earningsThisMonth: metrics?.earningsThisMonth ?? [],
          dailyOrderVolume: metrics?.dailyOrderVolume ?? [],
          hourlyOrderVolume: metrics?.hourlyOrderVolume ?? [],
          completionRate: metrics ? `${Number(metrics.deliveryCompletionRate ?? 0).toFixed(1)}%` : '—',
          csatScore: average === null || average === undefined ? '—' : average.toFixed(1),
          trends,
        }));
      })
      .catch(() => {
        if (active) setData({ ...EMPTY_BRANCH_DATA, error: 'Report data is unavailable. Retrying automatically.' });
      }).finally(() => { refreshing = false; });
    };
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);

    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [selectedBranchId]);

  return data;
}
