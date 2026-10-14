'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, RefreshCw, Search } from 'lucide-react';
import { DeliveryProofViewer } from '../../components/DeliveryProofViewer';
import { fetchJson } from '../../lib/api';
import { useBranch } from '../contexts/BranchContext';
import { Header } from './Header';
import { Pagination } from './Pagination';

interface DeliveryRecord {
  id: string;
  sr_code: string;
  customer_name: string;
  cylinder_size: string;
  quantity: number;
  delivered_at: string | null;
}

function formatDeliveredAt(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function DeliveryProofRecordsFull({ onBack }: { onBack: () => void }) {
  const { selectedBranchId } = useBranch();
  const queryClient = useQueryClient();

  const {
    data: recordsData,
    isLoading: recordsLoading,
    error: recordsQueryError,
  } = useQuery({
    queryKey: ['service-requests-delivery-records', selectedBranchId],
    queryFn: () => fetchJson<{ serviceRequests: DeliveryRecord[] }>(`/service-requests/delivery-records?branchId=${encodeURIComponent(selectedBranchId!)}`),
    enabled: !!selectedBranchId,
    staleTime: 30_000,
  });

  const records = recordsData?.serviceRequests ?? [];
  const loading = recordsLoading && !!selectedBranchId;
  const error = recordsQueryError ? recordsQueryError.message || 'Could not load completed deliveries.' : null;

  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSize, setFilterSize] = useState('all');
  const ITEMS_PER_PAGE = 10;

  const filteredData = useMemo(() => {
    return records.filter((row) => {
      const matchesSize = filterSize === 'all' || row.cylinder_size === filterSize;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        (row.customer_name ?? '').toLowerCase().includes(q) ||
        (row.sr_code ?? '').toLowerCase().includes(q);
      return matchesSize && matchesSearch;
    });
  }, [records, searchQuery, filterSize]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const currentData = filteredData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const uniqueSizes = useMemo(() => {
    const sizes = new Set(records.map((r) => r.cylinder_size).filter(Boolean));
    return Array.from(sizes).sort();
  }, [records]);

  const clearFilters = () => {
    setSearchQuery('');
    setFilterSize('all');
    setCurrentPage(1);
  };

  const hasFilters = searchQuery || filterSize !== 'all';

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="Completed Deliveries & Proof" />

      <div className="p-8">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-sm text-[#007BC1] transition-colors hover:text-[#005a8f]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap gap-3 mb-6 items-center">
            <div className="flex-1 min-w-[180px] relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search customer or SR code..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#007BC1]"
              />
            </div>
            <select
              value={filterSize}
              onChange={(e) => { setFilterSize(e.target.value); setCurrentPage(1); }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#007BC1]"
            >
              <option value="all">All Sizes</option>
              {uniqueSizes.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-[#007BC1] hover:text-[#005a8f] transition-colors whitespace-nowrap"
              >
                Clear filters
              </button>
            )}
            <button
              onClick={() => void queryClient.invalidateQueries({ queryKey: ['service-requests-delivery-records', selectedBranchId] })}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40 ml-auto"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
              <Loader2 size={17} className="animate-spin" /> Loading completed deliveries…
            </div>
          ) : error ? (
            <div className="rounded-lg bg-red-50 px-4 py-5 text-center text-sm text-red-700">
              <p>{error}</p>
              <button type="button" onClick={() => void queryClient.invalidateQueries({ queryKey: ['service-requests-delivery-records', selectedBranchId] })} className="mt-3 font-semibold underline">
                Try again
              </button>
            </div>
          ) : currentData.length === 0 && !hasFilters ? (
            <p className="py-12 text-center text-sm text-gray-500">No completed deliveries found for this branch.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="pb-3 pr-4 text-left text-xs font-semibold text-gray-700">Service Request</th>
                      <th className="pb-3 pr-4 text-left text-xs font-semibold text-gray-700">Customer</th>
                      <th className="pb-3 pr-4 text-left text-xs font-semibold text-gray-700">Order</th>
                      <th className="pb-3 pr-4 text-left text-xs font-semibold text-gray-700">Delivered At</th>
                      <th className="pb-3 pr-4 text-left text-xs font-semibold text-gray-700">Proof</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentData.length === 0 && hasFilters && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-sm text-gray-500">
                          No deliveries found for the selected filters.
                        </td>
                      </tr>
                    )}
                    {currentData.map((record) => (
                      <tr key={record.id} className="border-b border-gray-100 text-[13px] last:border-0">
                        <td className="py-4 pr-4 font-medium text-gray-900">{record.sr_code}</td>
                        <td className="py-4 pr-4 text-gray-700">{record.customer_name}</td>
                        <td className="py-4 pr-4 text-gray-600">{record.quantity} × {record.cylinder_size}</td>
                        <td className="py-4 pr-4 text-gray-600">{formatDeliveredAt(record.delivered_at)}</td>
                        <td className="py-4 pr-4 text-left">
                          <DeliveryProofViewer
                            serviceRequestId={record.id}
                            serviceRequestCode={record.sr_code}
                            branchId={selectedBranchId}
                          />
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

              {!loading && (
                <div className="mt-3 text-right text-xs text-gray-400">
                  Showing {currentData.length} of {filteredData.length} delivery{filteredData.length !== 1 ? 'ies' : 'y'}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
