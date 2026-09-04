import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useBranch } from '../contexts/BranchContext';

type CompletionRow = {
  month: string;
  totalOrders: string;
  completed: string;
  completionRate: string;
  slaBreaches: string;
};

export function DeliveryCompletionTable({
  totalOrders,
  completed,
  completionRate,
  slaBreaches,
}: {
  totalOrders: string;
  completed: string;
  completionRate: string;
  slaBreaches: string;
}) {
  const { selectedBranchId } = useBranch();
  const [completionData, setCompletionData] = useState<CompletionRow[]>([]);

  useEffect(() => {
    let active = true;
    if (!selectedBranchId) return () => { active = false; };

    const controller = new AbortController();
    const now = new Date();
    const requests = Array.from({ length: now.getMonth() + 1 }, (_, index) => index + 1).map(async (month) => {
      const year = now.getFullYear();
      const monthText = String(month).padStart(2, '0');
      const lastDay = new Date(year, month, 0).getDate();
      const query = new URLSearchParams({
        from: `${year}-${monthText}-01`,
        to: `${year}-${monthText}-${lastDay}`,
        branchId: selectedBranchId,
      }).toString();
      const response = await apiFetch(`/service-requests/reports/branch-owner-dashboard?${query}`, { signal: controller.signal });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error('Could not load delivery completion data.');
      const metrics = data?.metrics;
      return {
        month: new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1)),
        totalOrders: String(metrics?.totalOrders ?? 0),
        completed: String(metrics?.completedDeliveries ?? 0),
        completionRate: Number(metrics?.deliveryCompletionRate ?? 0).toFixed(1),
        slaBreaches: String(metrics?.slaBreaches ?? 0),
      };
    });
    Promise.all(requests).then((rows) => {
      if (active) setCompletionData(rows.reverse());
    }).catch(() => {
      if (active && !controller.signal.aborted) setCompletionData([]);
    });
    return () => { active = false; controller.abort(); };
  }, [selectedBranchId]);

  const fallback = [{
    month: new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(new Date()),
    totalOrders,
    completed,
    completionRate: completionRate.replace('%', ''),
    slaBreaches,
  }];
  const rows = completionData.length > 0 ? completionData : fallback;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Delivery Completion Rate</h3>
        <a href="#" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('navigate', { detail: 'delivery-completion-full' })); }} className="text-[11px] text-[#007BC1] hover:text-[#005a8f] transition-colors">
          View all
        </a>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Month</th>
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Total Orders</th>
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Completed</th>
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Completion Rate %</th>
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3">SLA Breaches</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 5).map((row) => (
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
