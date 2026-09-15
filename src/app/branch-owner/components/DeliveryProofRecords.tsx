'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';
import { DeliveryProofViewer } from '../../components/DeliveryProofViewer';
import { fetchJson } from '../../lib/api';
import { useBranch } from '../contexts/BranchContext';

interface DeliveryRecord {
  id: string;
  sr_code: string;
  customer_name: string;
  cylinder_size: string;
  quantity: number;
  delivered_at: string | null;
  rider_id: string | null;
}

const PREVIEW_RECORD_LIMIT = 5;

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

/** Branch Owner's read-only, selected-branch delivery proof queue. */
export function DeliveryProofRecords() {
  const { selectedBranchId, assignedBranchesLoading } = useBranch();
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

  return (
    <section className="mt-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="font-semibold text-gray-900">Completed Deliveries &amp; Proof</h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'delivery-proof-full' }))}
            className="text-xs font-medium text-[#007BC1] transition-colors hover:text-[#005a8f]"
          >
            View all
          </button>
          <button
            type="button"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ['service-requests-delivery-records', selectedBranchId] })}
            disabled={loading || assignedBranchesLoading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
          <Loader2 size={17} className="animate-spin" /> Loading completed deliveries…
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 px-4 py-5 text-center text-sm text-red-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ['service-requests-delivery-records', selectedBranchId] })}
            className="mt-3 font-semibold underline"
          >
            Try again
          </button>
        </div>
      ) : records.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">No completed deliveries found for this branch.</p>
      ) : (
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
              {records.slice(0, PREVIEW_RECORD_LIMIT).map((record) => (
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
      )}
    </section>
  );
}
