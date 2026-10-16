import { useQuery } from '@tanstack/react-query';
import { fetchJson } from './api';

export interface ReportPage<T> { rows: T[]; total: number; }
export interface ReportCustomer {
  id: string; code: string | null; name: string; phone: string; address: string;
  branchId: string; primaryBranch: string; accountType: 'household' | 'commercial';
  totalOrders: number; lastOrder: string | null; avgRating: number | null;
  ratingCount: number; loyaltyPoints: number; rewardEligible: boolean; status: string;
}
export interface CustomerDirectory extends ReportPage<ReportCustomer> {
  summary: { customers: number; eligible: number; orders: number; averageRating: number | null; };
}
export interface CompletionRow { branchId: string; branch: string; month: string; totalOrders: number; completed: number; slaBreaches: number; }
export interface OrdersReport {
  total: number; delivered: number; cancelled: number;
  daily: { day: string; orders: number }[];
  statuses: { name: string; count: number }[];
  completion: CompletionRow[];
  topCustomers: { id: string; name: string; branch: string; totalOrders: number }[];
}
export interface RatingRow {
  id: string; customerId: string; branchId: string; branch: string;
  customer: string; orderId: string; rating: number; comment: string; date: string; resolution: string;
}
export interface IncidentRow {
  complaintId: string; branchId: string; branch: string; customer: string;
  issueSummary: string; status: string; date: string; responseSeconds: number | null;
}
export interface CsatReport { total: number; rating: number | null; complaints: number; }
export interface CustomerReport {
  customer: ReportCustomer;
  orders: { id: string; orderNo: string; branch: string; date: string; status: string; rating: number | null }[];
}

export function useFranchiseReport<T>(path: string, filters: Record<string, string | number> = {}, enabled = true) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value !== '') params.set(key, String(value)); });
  const url = `/franchise-reports/${path}${params.size ? `?${params}` : ''}`;
  return useQuery({
    queryKey: ['franchise-reports', url],
    queryFn: () => fetchJson<T>(url),
    enabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useReportBranches() {
  return useQuery({ queryKey: ['franchise-report-branches'], queryFn: () => fetchJson<{ branches: { id: string; name: string }[] }>('/branches'), staleTime: 30_000 });
}

export const reportDate = (value: string | null) => value
  ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)) : '—';
export const reportMonth = (value: string) => new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(new Date(`${value}-01T12:00:00`));
export const reportPercent = (part: number, total: number) => total > 0 ? `${(part / total * 100).toFixed(1)}%` : '—';
export const reportRating = (value: number | null) => value === null ? '—' : Number(value).toFixed(1);
