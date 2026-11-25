import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { useBranch } from '../contexts/BranchContext';
import { monthToDate } from '../hooks/useBranchData';

type CompletionRow = {
  month: string;
  totalOrders: string;
  completed: string;
  completionRate: string;
  slaBreaches: string;
};

export function DeliveryCompletionTable() {
  const { selectedBranchId } = useBranch();
  const { data: rows = [], isPending, error, refetch } = useQuery({
    queryKey: ['owner-completion-history', selectedBranchId, monthToDate().from],
    enabled: !!selectedBranchId,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
    queryFn: ({ signal }): Promise<CompletionRow[]> => Promise.all(Array.from({ length: 5 }, async (_, offset) => {
      const range = monthToDate(-offset);
      const first = new Date(`${range.from}T12:00:00Z`);
      const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
      const query = new URLSearchParams({ from: range.from, to: offset === 0 ? range.to : last, branchId: selectedBranchId! }).toString();
      const response = await apiFetch(`/service-requests/reports/branch-owner-dashboard?${query}`, { cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.metrics) throw new Error('Could not load delivery completion data.');
      const metrics = data?.metrics;
      return {
        month: new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'long', year: 'numeric' }).format(first),
        totalOrders: String(metrics?.totalOrders ?? 0),
        completed: String(metrics?.completedDeliveries ?? 0),
        completionRate: Number(metrics?.deliveryCompletionRate ?? 0).toFixed(1),
        slaBreaches: String(metrics?.slaBreaches ?? 0),
      };
    })),
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Delivery Completion Rate</h3>
      </div>

      <p className="mb-4 text-xs text-gray-500">Completion rate excludes cancelled orders. Current month is through today.</p>
      {error && <p role="alert" className="mb-3 text-sm text-red-600">Completion history is unavailable. <button type="button" onClick={() => void refetch()} className="underline">Try again</button></p>}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left text-xs font-semibold text-gray-700 pb-3">Month</th>
              <th className="text-left text-xs font-semibold text-gray-700 pb-3">Total Orders</th>
              <th className="text-left text-xs font-semibold text-gray-700 pb-3">Completed</th>
              <th className="text-left text-xs font-semibold text-gray-700 pb-3">Completion Rate %</th>
              <th className="text-left text-xs font-semibold text-gray-700 pb-3">SLA Breaches</th>
            </tr>
          </thead>
          <tbody>
            {isPending && <tr><td colSpan={5} className="py-4 text-sm text-gray-500">Loading completion history…</td></tr>}
            {!error && rows.map((row) => (
              <tr key={row.month} className="border-b border-gray-100">
                <td className="py-3 text-[13px] text-gray-900">{row.month}</td>
                <td className="py-3 text-[13px] text-gray-600">{row.totalOrders}</td>
                <td className="py-3 text-[13px] text-gray-600">{row.completed}</td>
                <td className="py-3 text-[13px] font-medium text-gray-900">{row.completionRate}%</td>
                <td className="py-3">
                  <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-medium ${
                    Number(row.slaBreaches) === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {row.slaBreaches}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
