import { useEffect, useState } from 'react';
import { useBranch } from '../contexts/BranchContext';
import type { KPITrend } from '../components/KPICard';
import { apiFetch } from '../../lib/api';

type BranchDataShape = {
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
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * The 1st of the month `offset` months from now through today's day of the
 * month (capped at that month's end). monthToDate(-1) is "same period last month".
 */
export function monthToDate(offset = 0): { from: string; to: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return {
    from: formatDay(first),
    to: formatDay(new Date(first.getFullYear(), first.getMonth(), Math.min(now.getDate(), lastDay))),
  };
}

// Shown before data loads and after a failed load. Screens remount on a branch
// switch, so another branch's figures are never left on screen.
const EMPTY_BRANCH_DATA: BranchDataShape = {
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
    const query = new URLSearchParams({ ...monthToDate(), branchId: selectedBranchId }).toString();
    const previousQuery = new URLSearchParams({ ...monthToDate(-1), branchId: selectedBranchId }).toString();

    Promise.all([
      apiFetch(`/service-requests/reports/branch-owner-dashboard?${query}`, { signal: controller.signal }),
      apiFetch(`/service-requests/reports/branch-owner-dashboard?${previousQuery}`, { signal: controller.signal }),
      apiFetch(`/csat/reports/dashboard-summary?${query}`, { signal: controller.signal }),
    ])
      .then(async ([metricsResponse, previousMetricsResponse, csatResponse]) => {
        const [metricsData, previousMetricsData, csatData] = await Promise.all([
          metricsResponse.json().catch(() => null),
          previousMetricsResponse.json().catch(() => null),
          csatResponse.json().catch(() => null),
        ]);
        if (!active) return;

        const metrics = metricsResponse.ok ? metricsData?.metrics : undefined;
        const previousMetrics = previousMetricsResponse.ok ? previousMetricsData?.metrics : undefined;
        const csat: CsatReport | undefined = csatResponse.ok ? csatData?.report : undefined;
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
        if (active) setData(EMPTY_BRANCH_DATA);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedBranchId]);

  return data;
}
