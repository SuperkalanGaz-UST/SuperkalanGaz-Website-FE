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
  orderVolumeData: { month: string; orders: number }[];
  dailyOrderVolume: { day: string; orders: number }[];
  csatTrendData: { month: string; score: number }[];
  earningsToday: { hour: string; earnings: number }[];
  earningsThisMonth: { week: string; earnings: number }[];
  topSellingTanks: { size: string; orders: number }[];
};

type CsatReport = { average_stars?: number | null; total_responses?: number };

function reportDates(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const format = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { from: format(from), to: format(now) };
}

export function useBranchData(): BranchDataShape {
  const { selectedBranchId } = useBranch();
  const [data, setData] = useState<BranchDataShape>({
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
    orderVolumeData: [],
    dailyOrderVolume: [],
    csatTrendData: [],
    earningsToday: [],
    earningsThisMonth: [],
    topSellingTanks: [],
  });

  useEffect(() => {
    let active = true;
    if (!selectedBranchId) return () => { active = false; };

    const controller = new AbortController();
    const currentRange = reportDates();
    const previousDate = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    const previousYear = previousDate.getFullYear();
    const previousMonth = String(previousDate.getMonth() + 1).padStart(2, '0');
    const previousLastDay = new Date(previousYear, previousDate.getMonth() + 1, 0).getDate();
    const query = new URLSearchParams({ ...currentRange, branchId: selectedBranchId }).toString();
    const previousQuery = new URLSearchParams({
      from: `${previousYear}-${previousMonth}-01`,
      to: `${previousYear}-${previousMonth}-${previousLastDay}`,
      branchId: selectedBranchId,
    }).toString();

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
          earningsThisMonth: metrics?.earningsThisMonth ?? [],
          topSellingTanks: metrics?.topSellingTanks ?? [],
          orderVolumeData: metrics?.orderVolumeTrend ?? [],
          dailyOrderVolume: metrics?.dailyOrderVolume ?? [],
          completionRate: metrics ? `${Number(metrics.deliveryCompletionRate ?? 0).toFixed(1)}%` : '—',
          csatScore: average === null || average === undefined ? '—' : average.toFixed(1),
          trends,
        }));
      })
      .catch(() => {
        if (active) setData((current) => ({ ...current, completionRate: '—', csatScore: '—', trends: {} }));
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedBranchId]);

  return data;
}
