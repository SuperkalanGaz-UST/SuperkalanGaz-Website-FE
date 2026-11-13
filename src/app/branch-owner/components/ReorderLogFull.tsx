import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from './Header';
import { Pagination } from './Pagination';
import { Select } from './Select';
import { ArrowLeft, Search } from 'lucide-react';
import { fetchJson } from '../../lib/api';
import { useBranch } from '../contexts/BranchContext';

interface ReorderRow {
  id: string;
  product_name: string;
  cylinder_size: string;
  requested_qty: number;
  status: 'Pending' | 'Approved' | 'Delivered' | 'Cancelled';
  requested_by_name: string | null;
  requested_at: string;
  decided_at: string | null;
}

const STATUS_STYLES: Record<ReorderRow['status'], string> = {
  Pending: 'bg-amber-100 text-amber-700',
  Approved: 'bg-blue-100 text-blue-700',
  Delivered: 'bg-green-100 text-green-700',
  Cancelled: 'bg-gray-100 text-gray-600',
};

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

export function ReorderLogFull({ onBack }: { onBack: () => void }) {
  const { selectedBranchId } = useBranch();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['owner-reorder-requests', selectedBranchId],
    enabled: !!selectedBranchId,
    queryFn: () =>
      fetchJson<{ reorderRequests: ReorderRow[] }>(
        `/inventory/reorder-requests/owner?branchId=${encodeURIComponent(selectedBranchId!)}`,
      ),
  });

  const itemsPerPage = 10;

  const filteredData = useMemo(() => {
    let rows = data?.reorderRequests ?? [];
    const term = searchQuery.trim().toLowerCase();
    if (term) {
      rows = rows.filter((row) =>
        [row.product_name, row.cylinder_size, row.requested_by_name, row.status]
          .some((value) => String(value ?? '').toLowerCase().includes(term)),
      );
    }
    if (filterStatus !== 'all') rows = rows.filter((row) => row.status === filterStatus);
    return rows;
  }, [data, searchQuery, filterStatus]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  const hasActiveFilters = searchQuery || filterStatus !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setFilterStatus('all');
    setCurrentPage(1);
  };

  let emptyMessage = 'No reorder requests have been logged for this branch yet.';
  if (!selectedBranchId) emptyMessage = 'Select a branch to see its reorder requests.';
  else if (error) emptyMessage = "Couldn't load reorder requests. Try again in a moment.";
  else if (hasActiveFilters) emptyMessage = 'No reorder requests match these filters.';

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }} className="pt-4">
        <Header title="Reorder Request Log" />
      </div>

      <div className="p-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-[#007BC1] hover:text-[#005a8f] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Inventory
        </button>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                aria-label="Search reorder requests"
                placeholder="Search by product or requester..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none text-sm"
              />
            </div>
            <Select
              value={filterStatus}
              onChange={(value) => { setFilterStatus(value); setCurrentPage(1); }}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'Pending', label: 'Pending' },
                { value: 'Approved', label: 'Approved' },
                { value: 'Delivered', label: 'Delivered' },
                { value: 'Cancelled', label: 'Cancelled' },
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

          {isLoading ? (
            <p className="py-10 text-center text-sm text-gray-400">Loading…</p>
          ) : currentData.length === 0 ? (
            <p className={`py-10 text-center text-sm ${error ? 'text-red-600' : 'text-gray-500'}`}>{emptyMessage}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left text-xs font-semibold text-gray-700 pb-3">Product</th>
                    <th className="text-left text-xs font-semibold text-gray-700 pb-3">Date Requested</th>
                    <th className="text-left text-xs font-semibold text-gray-700 pb-3">Qty Requested</th>
                    <th className="text-left text-xs font-semibold text-gray-700 pb-3">Requested By</th>
                    <th className="text-left text-xs font-semibold text-gray-700 pb-3">Status</th>
                    <th className="text-left text-xs font-semibold text-gray-700 pb-3">Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {currentData.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100">
                      <td className="py-3 text-[13px] text-gray-900">{row.product_name}</td>
                      <td className="py-3 text-[13px] text-gray-600">{formatDate(row.requested_at)}</td>
                      <td className="py-3 text-[13px] text-gray-600">{row.requested_qty} cylinders</td>
                      <td className="py-3 text-[13px] text-gray-600">{row.requested_by_name ?? 'Branch Manager'}</td>
                      <td className="py-3">
                        <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-medium ${STATUS_STYLES[row.status]}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 text-[13px] text-gray-600">{formatDate(row.decided_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

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
