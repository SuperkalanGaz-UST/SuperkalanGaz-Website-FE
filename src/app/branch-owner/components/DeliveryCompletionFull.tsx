import { useState, useMemo, useEffect } from 'react';
import { Header } from './Header';
import { Pagination } from './Pagination';
import { Select } from './Select';
import { ArrowLeft, Search } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useBranch } from '../contexts/BranchContext';

type CompletionRow = {
  month: string;
  totalOrders: number;
  completed: number;
  completionRate: number;
  slaBreaches: number;
};

function monthRange(year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  return { from, to: `${year}-${String(month).padStart(2, '0')}-${lastDay}` };
}

export function DeliveryCompletionFull({ onBack }: { onBack: () => void }) {
  const { selectedBranchId } = useBranch();
  const [completionData, setCompletionData] = useState<CompletionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMonth, setFilterMonth] = useState('all');

  const itemsPerPage = 10;

  useEffect(() => {
    let active = true;
    if (!selectedBranchId) {
      setCompletionData([]);
      setLoading(false);
      return () => { active = false; };
    }

    const controller = new AbortController();
    const now = new Date();
    const months = Array.from({ length: now.getMonth() + 1 }, (_, index) => index + 1);
    setLoading(true);
    setLoadError(null);
    Promise.all(months.map(async (month) => {
      const range = monthRange(now.getFullYear(), month);
      const query = new URLSearchParams({ ...range, branchId: selectedBranchId }).toString();
      const response = await apiFetch(`/service-requests/reports/branch-owner-dashboard?${query}`, { signal: controller.signal });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error('Could not load delivery completion data.');
      const metrics = data?.metrics;
      return {
        month: new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(new Date(now.getFullYear(), month - 1, 1)),
        totalOrders: Number(metrics?.totalOrders ?? 0),
        completed: Number(metrics?.completedDeliveries ?? 0),
        completionRate: Number(metrics?.deliveryCompletionRate ?? 0),
        slaBreaches: Number(metrics?.slaBreaches ?? 0),
      } satisfies CompletionRow;
    })).then((rows) => {
      if (active) setCompletionData(rows.reverse());
    }).catch((error) => {
      if (active && !controller.signal.aborted) {
        setCompletionData([]);
        setLoadError(error instanceof Error ? error.message : 'Could not load delivery completion data.');
      }
    }).finally(() => {
      if (active && !controller.signal.aborted) setLoading(false);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedBranchId]);

  const filteredData = useMemo(() => {
    let data = completionData;

    if (searchQuery) {
      data = data.filter(row =>
        Object.values(row).some(val =>
          String(val).toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }

    if (filterMonth !== 'all') {
      data = data.filter(row => row.month === filterMonth);
    }

    return data;
  }, [completionData, searchQuery, filterMonth]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = filteredData.slice(startIndex, endIndex);

  const hasActiveFilters = searchQuery || filterMonth !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setFilterMonth('all');
    setCurrentPage(1);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header
          title="Delivery Completion Rate"
        />
      </div>

      <div className="p-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-[#007BC1] hover:text-[#005a8f] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none text-sm"
              />
            </div>
            <Select
              value={filterMonth}
              onChange={(value) => { setFilterMonth(value); setCurrentPage(1); }}
              options={[
                { value: 'all', label: 'All Months' },
                ...completionData.map(row => ({ value: row.month, label: row.month }))
              ]}
            />
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-[#007BC1] hover:text-[#005a8f] transition-colors whitespace-nowrap"
              >
                Clear filters
              </button>
            )}
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
                {loading ? (
                  <tr><td colSpan={5} className="py-10 text-center text-sm text-gray-400">Loading delivery completion data…</td></tr>
                ) : loadError ? (
                  <tr><td colSpan={5} className="py-10 text-center text-sm text-red-600">{loadError}</td></tr>
                ) : currentData.length === 0 ? (
                  <tr><td colSpan={5} className="py-10 text-center text-sm text-gray-400">No delivery completion data found.</td></tr>
                ) : currentData.map((row) => (
                  <tr key={row.month} className="border-b border-gray-100">
                    <td className="py-4 text-[13px] text-gray-900 whitespace-nowrap">{row.month}</td>
                    <td className="py-4 text-[13px] text-gray-600 whitespace-nowrap">{row.totalOrders}</td>
                    <td className="py-4 text-[13px] text-gray-600 whitespace-nowrap">{row.completed}</td>
                    <td className="py-4 text-[13px] font-medium text-gray-900 whitespace-nowrap">{row.completionRate}%</td>
                    <td className="py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-medium ${
                        row.slaBreaches === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {row.slaBreaches}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-6">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
