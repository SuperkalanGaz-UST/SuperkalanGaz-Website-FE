'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { DeliveryProofViewer } from '../../components/DeliveryProofViewer';
import { apiErrorMessage, apiFetch } from '../../lib/api';
import { useBranch } from '../contexts/BranchContext';
import { Header } from './Header';

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
  const [records, setRecords] = useState<DeliveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadRecords = useCallback(async (signal: AbortSignal) => {
    if (!selectedBranchId) {
      setRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/service-requests/delivery-records?branchId=${encodeURIComponent(selectedBranchId)}`,
        { signal },
      );
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiErrorMessage(data, 'Could not load completed deliveries.'));
      const rows = data && typeof data === 'object' && Array.isArray((data as { serviceRequests?: unknown }).serviceRequests)
        ? (data as { serviceRequests: unknown[] }).serviceRequests
        : [];
      setRecords(rows.filter((row): row is DeliveryRecord => {
        if (!row || typeof row !== 'object') return false;
        const value = row as Record<string, unknown>;
        return typeof value.id === 'string' && typeof value.sr_code === 'string' &&
          typeof value.customer_name === 'string' && typeof value.cylinder_size === 'string' &&
          typeof value.quantity === 'number' &&
          (value.delivered_at === null || typeof value.delivered_at === 'string');
      }));
    } catch (loadError) {
      if (!signal.aborted) {
        setRecords([]);
        setError(loadError instanceof Error ? loadError.message : 'Could not load completed deliveries.');
      }
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadRecords(controller.signal);
    return () => controller.abort();
  }, [loadRecords, refreshKey]);

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
          <div className="mb-6 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setRefreshKey((value) => value + 1)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
              <Loader2 size={17} className="animate-spin" /> Loading completed deliveries…
            </div>
          ) : error ? (
            <div className="rounded-lg bg-red-50 px-4 py-5 text-center text-sm text-red-700">
              <p>{error}</p>
              <button type="button" onClick={() => setRefreshKey((value) => value + 1)} className="mt-3 font-semibold underline">
                Try again
              </button>
            </div>
          ) : records.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-500">No completed deliveries found for this branch.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left">
                <thead>
                  <tr className="border-b border-gray-200 text-[11px] uppercase tracking-wide text-gray-500">
                    <th className="pb-3 pr-4">Service Request</th>
                    <th className="pb-3 pr-4">Customer</th>
                    <th className="pb-3 pr-4">Order</th>
                    <th className="pb-3 pr-4">Delivered At</th>
                    <th className="pb-3 text-right">Proof</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-b border-gray-100 text-sm last:border-0">
                      <td className="py-4 pr-4 font-semibold text-gray-900">{record.sr_code}</td>
                      <td className="py-4 pr-4 text-gray-700">{record.customer_name}</td>
                      <td className="py-4 pr-4 text-gray-600">{record.quantity} × {record.cylinder_size}</td>
                      <td className="py-4 pr-4 text-gray-600">{formatDeliveredAt(record.delivered_at)}</td>
                      <td className="py-4 text-right">
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
        </div>
      </div>
    </div>
  );
}
