import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from './Header';
import { Pagination } from './Pagination';
import { Select } from './Select';
import { ArrowLeft, Search } from 'lucide-react';
import { fetchJson } from '../../lib/api';
import { useBranch } from '../contexts/BranchContext';

type Track = 'household_points' | 'commercial_30plus1';
type Status = 'pending' | 'approved' | 'rejected' | 'fulfilled' | 'cancelled';

interface RedemptionRow {
  id: string;
  customer_name: string | null;
  catalog_item_name: string | null;
  reward_description: string | null;
  points_spent: number | null;
  status: Status;
  requested_at: string;
  approved_at: string | null;
  fulfilled_at: string | null;
  redemption_code: string | null;
}

const STATUS_LABELS: Record<Status, { label: string; className: string }> = {
  pending: { label: 'Awaiting Approval', className: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', className: 'bg-blue-100 text-blue-700' },
  fulfilled: { label: 'Handed Over', className: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-600' },
};

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

export function RedemptionHistoryFull({ onBack }: { onBack: () => void }) {
  const { selectedBranchId } = useBranch();
  const [track, setTrack] = useState<Track>('household_points');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['owner-redemptions', selectedBranchId, track],
    enabled: !!selectedBranchId,
    queryFn: () => {
      const params = new URLSearchParams({ status: 'all', track, branchId: selectedBranchId! });
      return fetchJson<{ redemptions: RedemptionRow[] }>(`/loyalty/redemptions?${params.toString()}`);
    },
  });

  const itemsPerPage = 10;

  const filteredData = useMemo(() => {
    let rows = data?.redemptions ?? [];
    const term = searchQuery.trim().toLowerCase();
    if (term) {
      rows = rows.filter((row) =>
        [row.customer_name, row.catalog_item_name, row.reward_description, row.redemption_code]
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

  const switchTrack = (next: Track) => {
    setTrack(next);
    setCurrentPage(1);
  };

  let emptyMessage = 'No redemptions have been requested on this track yet.';
  if (!selectedBranchId) emptyMessage = 'Select a branch to see its redemption history.';
  else if (error) emptyMessage = "Couldn't load redemptions. Try again in a moment.";
  else if (hasActiveFilters) emptyMessage = 'No redemptions match these filters.';

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }} className="pt-4">
        <Header title="Redemption History" />
      </div>

      <div className="p-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-[#007BC1] hover:text-[#005a8f] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Rewards
        </button>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div role="tablist" aria-label="Loyalty track" className="mb-5 flex w-fit rounded-lg border border-gray-200 p-0.5">
            {([
              ['household_points', 'Household points'],
              ['commercial_30plus1', 'Commercial 30+1'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                role="tab"
                aria-selected={track === value}
                onClick={() => switchTrack(value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  track === value ? 'bg-[#007BC1] text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                aria-label="Search redemptions"
                placeholder="Search by customer, reward or code..."
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
                ...Object.entries(STATUS_LABELS).map(([value, { label }]) => ({ value, label })),
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
                    <th className="text-left text-xs font-semibold text-gray-700 pb-3">Customer</th>
                    <th className="text-left text-xs font-semibold text-gray-700 pb-3">Reward</th>
                    {track === 'household_points' && (
                      <th className="text-left text-xs font-semibold text-gray-700 pb-3">Points</th>
                    )}
                    <th className="text-left text-xs font-semibold text-gray-700 pb-3">Requested</th>
                    <th className="text-left text-xs font-semibold text-gray-700 pb-3">Handed Over</th>
                    <th className="text-left text-xs font-semibold text-gray-700 pb-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {currentData.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100">
                      <td className="py-3 text-[13px] text-gray-900">{row.customer_name ?? 'Customer'}</td>
                      <td className="py-3 text-[13px] text-gray-600">
                        {row.catalog_item_name ?? row.reward_description ?? (track === 'commercial_30plus1' ? 'Free cylinder' : '—')}
                      </td>
                      {track === 'household_points' && (
                        <td className="py-3 text-[13px] text-gray-600">{row.points_spent ?? '—'}</td>
                      )}
                      <td className="py-3 text-[13px] text-gray-600">{formatDate(row.requested_at)}</td>
                      <td className="py-3 text-[13px] text-gray-600">{formatDate(row.fulfilled_at)}</td>
                      <td className="py-3">
                        <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-medium ${STATUS_LABELS[row.status].className}`}>
                          {STATUS_LABELS[row.status].label}
                        </span>
                      </td>
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
