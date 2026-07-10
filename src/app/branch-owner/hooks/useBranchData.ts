import { useBranch } from '../contexts/BranchContext';
import type { KPITrend } from '../components/KPICard';

/**
 * Mock branch-scoped dashboard data, keyed by the BO's selected branch.
 * Placeholder until the API endpoints land — figures are demo values, not
 * client-confirmed operational numbers (AGENTS.md §13).
 */
export function useBranchData() {
  const { selectedBranch } = useBranch();

  const branchData = {
    'Quezon City Branch': {
      ordersToday: '61',
      totalOrders: '284',
      completionRate: '96.5%',
      csatScore: '4.3',
      loyaltyRedemptions: '7',
      stockLevel: 42,
      trends: {
        orders: { text: '+8.4% from yesterday', direction: 'up', positive: true } satisfies KPITrend,
        completion: { text: '+1.8% this week', direction: 'up', positive: true } satisfies KPITrend,
        csat: { text: '+0.2 from last month', direction: 'up', positive: true } satisfies KPITrend,
        loyalty: { text: '+2.0 from last month', direction: 'up', positive: true } satisfies KPITrend,
      },
      orderVolumeData: [
        { month: 'Jan', orders: 185 },
        { month: 'Feb', orders: 220 },
        { month: 'Mar', orders: 195 },
        { month: 'Apr', orders: 265 },
        { month: 'May', orders: 284 },
      ],
      csatTrendData: [
        { month: 'Jan', score: 4.0 },
        { month: 'Feb', score: 4.2 },
        { month: 'Mar', score: 4.5 },
        { month: 'Apr', score: 4.1 },
        { month: 'May', score: 4.3 },
      ],
    },
    'Makati Branch': {
      ordersToday: '53',
      totalOrders: '198',
      completionRate: '93.2%',
      csatScore: '4.1',
      loyaltyRedemptions: '4',
      stockLevel: 28,
      trends: {
        orders: { text: '+10.2% from yesterday', direction: 'up', positive: true } satisfies KPITrend,
        completion: { text: '+3.1% this week', direction: 'up', positive: true } satisfies KPITrend,
        csat: { text: '-0.2 from last month', direction: 'down', positive: false } satisfies KPITrend,
        loyalty: { text: '+7.2 from last month', direction: 'up', positive: true } satisfies KPITrend,
      },
      orderVolumeData: [
        { month: 'Jan', orders: 142 },
        { month: 'Feb', orders: 165 },
        { month: 'Mar', orders: 178 },
        { month: 'Apr', orders: 185 },
        { month: 'May', orders: 198 },
      ],
      csatTrendData: [
        { month: 'Jan', score: 3.8 },
        { month: 'Feb', score: 4.0 },
        { month: 'Mar', score: 4.2 },
        { month: 'Apr', score: 4.0 },
        { month: 'May', score: 4.1 },
      ],
    },
    'Mandaluyong Branch': {
      ordersToday: '78',
      totalOrders: '321',
      completionRate: '98.1%',
      csatScore: '4.5',
      loyaltyRedemptions: '11',
      stockLevel: 55,
      trends: {
        orders: { text: '+5.6% from yesterday', direction: 'up', positive: true } satisfies KPITrend,
        completion: { text: '+0.9% this week', direction: 'up', positive: true } satisfies KPITrend,
        csat: { text: '+0.1 from last month', direction: 'up', positive: true } satisfies KPITrend,
        loyalty: { text: '+4.0 from last month', direction: 'up', positive: true } satisfies KPITrend,
      },
      orderVolumeData: [
        { month: 'Jan', orders: 245 },
        { month: 'Feb', orders: 268 },
        { month: 'Mar', orders: 285 },
        { month: 'Apr', orders: 302 },
        { month: 'May', orders: 321 },
      ],
      csatTrendData: [
        { month: 'Jan', score: 4.3 },
        { month: 'Feb', score: 4.4 },
        { month: 'Mar', score: 4.6 },
        { month: 'Apr', score: 4.4 },
        { month: 'May', score: 4.5 },
      ],
    },
  };

  // Branches registered through the wizard have no mock entry above (the demo
  // data only covers the three seed branches). Rather than crash every BO screen
  // with `undefined`, fall back to a neutral empty state — a brand-new branch
  // legitimately has no activity yet, and real figures await API wiring (§13).
  const emptyBranchData = {
    ordersToday: '—',
    totalOrders: '—',
    completionRate: '—',
    csatScore: '—',
    loyaltyRedemptions: '—',
    stockLevel: 0,
    trends: {
      orders: undefined,
      completion: undefined,
      csat: undefined,
      loyalty: undefined,
    },
    orderVolumeData: [] as { month: string; orders: number }[],
    csatTrendData: [] as { month: string; score: number }[],
  };

  return branchData[selectedBranch] ?? emptyBranchData;
}
