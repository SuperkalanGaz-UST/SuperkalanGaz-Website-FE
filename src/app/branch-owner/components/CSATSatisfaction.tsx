'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from './Header';
import { KPICard } from './KPICard';
import { Star, MessageSquare, AlertCircle, RefreshCw } from 'lucide-react';
import { apiFetch, fetchJson } from '../../lib/api';
import { useBranch } from '../contexts/BranchContext';

// ── shared types ─────────────────────────────────────────────────────────────

interface SummaryRow {
  open_count: number;
  resolved_count: number;
  low_csat_open_count: number;
  average_stars: number | null;
  total_ratings: number;
}

export interface RatingRow {
  id: string;
  stars: number;
  comment: string | null;
  submitted_at: string;
  resolution_status: 'Open' | 'Resolved';
  resolution_note: string | null;
  resolved_at: string | null;
  customer_name: string | null;
  customer_id: string;
  service_request_id: string;
}

// ── helpers ───────────────────────────────────────────────────────────────────

export const formatDate = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(d);
};

export function RatingStars({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`w-4 h-4 ${n <= value ? 'fill-[#f59e0b] text-[#f59e0b]' : 'text-gray-300'}`}
        />
      ))}
    </div>
  );
}

// ── component ─────────────────────────────────────────────────────────────────

export function CSATSatisfaction() {
  const { selectedBranch, selectedBranchId } = useBranch();

  const queryClient = useQueryClient();
  const PREVIEW_ROWS = 5;

  const {
    data: summaryData,
    isLoading: summaryLoading,
  } = useQuery({
    queryKey: ['csat-summary', selectedBranchId],
    queryFn: () => fetchJson<{ summary: SummaryRow }>('/csat/summary'),
    staleTime: 30_000,
  });
  const summary = summaryData?.summary ?? null;

  const {
    data: ratingsData,
    isLoading: ratingsLoading,
    error: ratingsError,
  } = useQuery({
    queryKey: ['csat-ratings', selectedBranchId],
    queryFn: () => fetchJson<{ ratings: RatingRow[] }>('/csat/ratings?resolution=all'),
    staleTime: 30_000,
  });
  const ratings = ratingsData?.ratings ?? [];
  const error = ratingsError ? 'Failed to load data' : null;

  const loading = summaryLoading || ratingsLoading;

  // All ratings (newest first) — already sorted by backend
  const allRatings = ratings;
  // Complaints = 1–3★ (flagged for resolution)
  const complaints = ratings.filter((r) => r.stars <= 3);

  const navigate = (screen: string) =>
    window.dispatchEvent(new CustomEvent('navigate', { detail: screen }));

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header title="Ratings &amp; Reviews" />
      </div>

      <div className="p-8">
        {/* KPI tiles */}
        <div className="grid grid-cols-4 gap-6 mb-8 items-stretch">
          <KPICard
            title="Average Rating"
            value={loading ? '—' : (summary?.average_stars != null ? summary.average_stars.toFixed(1) : '—')}
            icon={<Star className="w-4 h-4 text-[#f59e0b]" />}
            accentColor="#f59e0b"
            subtitle="out of 5.0"
          />

          <KPICard
            title="Total Ratings Received"
            value={loading ? '—' : (summary?.total_ratings ?? 0).toString()}
            icon={<MessageSquare className="w-4 h-4 text-[#f59e0b]" />}
            accentColor="#f59e0b"
            subtitle="&#8203;"
          />
          <KPICard
            title="Open Complaints"
            value={loading ? '—' : (summary?.open_count ?? 0).toString()}
            icon={<AlertCircle className="w-4 h-4 text-[#ef4444]" />}
            accentColor="#ef4444"
            subtitle="&#8203;"
          />

          {/* Ratings Breakdown Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3.5 relative flex flex-col h-full">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-start gap-1.5 pt-1.5">
                <div className="text-sm font-medium text-gray-500">Ratings breakdown</div>
              </div>
            </div>
            
            <div className="flex flex-col gap-1 mt-auto pb-1">
              {loading ? (
                <div className="text-sm text-gray-400 py-2">Loading...</div>
              ) : (
                (() => {
                  // Compute counts cleanly
                  const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
                  ratings.forEach(r => {
                    const star = Math.round(r.stars);
                    if (star >= 1 && star <= 5) counts[star]++;
                  });
                  const maxCount = Math.max(...Object.values(counts), 1);

                  return [5, 4, 3, 2, 1].map((star) => {
                    const percent = (counts[star] / maxCount) * 100;
                    return (
                      <div key={star} className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-gray-500 w-2 leading-none">{star}</span>
                        <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#f59e0b] rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>
          </div>
        </div>

        {/* ── Ratings table ──────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Customer Ratings &amp; Reviews</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  void queryClient.invalidateQueries({ queryKey: ['csat-summary'] });
                  void queryClient.invalidateQueries({ queryKey: ['csat-ratings'] });
                }}
                disabled={loading}
                className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => navigate('customer-ratings-full')}
                className="text-[11px] text-[#007BC1] hover:text-[#005a8f] transition-colors"
              >
                View all
              </button>
            </div>
          </div>

          {error && <div className="text-sm text-red-500 mb-3">{error}</div>}

          <div className="overflow-x-auto">
            <table className="w-full" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '160px' }} />
                <col style={{ width: '130px' }} />
                <col style={{ width: '130px' }} />
                <col style={{ minWidth: '200px' }} />
                <col style={{ width: '110px' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-xs font-semibold text-gray-700 pb-3 px-2">Customer / ID</th>
                  <th className="text-left text-xs font-semibold text-gray-700 pb-3 px-2">Delivery ID</th>
                  <th className="text-left text-xs font-semibold text-gray-700 pb-3 px-2">Rating</th>
                  <th className="text-left text-xs font-semibold text-gray-700 pb-3 px-2">Comment</th>
                  <th className="text-left text-xs font-semibold text-gray-700 pb-3 px-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={5} className="py-8 text-center text-sm text-gray-400">Loading…</td></tr>
                )}
                {!loading && ratings.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-sm text-gray-400">No ratings yet.</td></tr>
                )}
                {!loading && ratings.slice(0, PREVIEW_ROWS).map((r) => (
                  <tr key={r.id} className={`border-b border-gray-100 ${r.stars <= 3 ? 'bg-red-50/40' : ''}`}>
                    <td className="py-3 px-2 whitespace-nowrap">
                      <div className="text-[13px] text-gray-900 font-medium">{r.customer_name ?? '—'}</div>
                      <div className="text-[11px] text-gray-500 font-mono" title={r.customer_id}>{r.customer_id.split('-')[0]}</div>
                    </td>
                    <td className="py-3 px-2 text-[13px] text-gray-600 font-mono">
                      {r.service_request_id.split('-')[0]}
                    </td>
                    <td className="py-3 px-2"><RatingStars value={r.stars} /></td>
                    <td className="py-3 px-2 text-[13px] text-gray-600">
                      {r.comment ?? <span className="italic text-gray-400">No comment</span>}
                    </td>
                    <td className="py-3 px-2 text-[13px] text-gray-500 whitespace-nowrap">{formatDate(r.submitted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Complaint Log table ────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Complaint Log</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  void queryClient.invalidateQueries({ queryKey: ['csat-summary'] });
                  void queryClient.invalidateQueries({ queryKey: ['csat-ratings'] });
                }}
                disabled={loading}
                className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => navigate('complaint-log-full')}
                className="text-[11px] text-[#007BC1] hover:text-[#005a8f] transition-colors"
              >
                View all
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '160px' }} />
                <col style={{ width: '130px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ minWidth: '180px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '180px' }} />
                <col style={{ width: '110px' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-xs font-semibold text-gray-700 pb-3 px-2">Customer / ID</th>
                  <th className="text-left text-xs font-semibold text-gray-700 pb-3 px-2">Delivery ID</th>
                  <th className="text-left text-xs font-semibold text-gray-700 pb-3 px-2">Rating</th>
                  <th className="text-left text-xs font-semibold text-gray-700 pb-3 px-2">Complaint / Desc</th>
                  <th className="text-left text-xs font-semibold text-gray-700 pb-3 px-2">Status</th>
                  <th className="text-left text-xs font-semibold text-gray-700 pb-3 px-2">Resolution</th>
                  <th className="text-left text-xs font-semibold text-gray-700 pb-3 px-2">Resolved At</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={7} className="py-8 text-center text-sm text-gray-400">Loading…</td></tr>
                )}
                {!loading && complaints.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-sm text-gray-400">No complaints on record. 🎉</td></tr>
                )}
                {!loading && complaints.slice(0, PREVIEW_ROWS).map((i) => (
                  <tr key={i.id} className="border-b border-gray-100 bg-red-50/40">
                    <td className="py-3 px-2 whitespace-nowrap">
                      <div className="text-[13px] text-gray-900 font-medium">{i.customer_name ?? '—'}</div>
                      <div className="text-[11px] text-gray-500 font-mono" title={i.customer_id}>{i.customer_id.split('-')[0]}</div>
                    </td>
                    <td className="py-3 px-2 text-[13px] text-gray-600 font-mono">
                      {i.service_request_id.split('-')[0]}
                    </td>
                    <td className="py-3 px-2"><RatingStars value={i.stars} /></td>
                    <td className="py-3 px-2 text-[13px] text-gray-600">
                      {i.comment ?? <span className="italic text-gray-400">No description</span>}
                    </td>
                    <td className="py-3 px-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        i.resolution_status === 'Resolved'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {i.resolution_status}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-[13px] text-gray-600">
                       {i.resolution_note ?? <span className="italic text-gray-400">—</span>}
                    </td>
                    <td className="py-3 px-2 text-[13px] text-gray-500 whitespace-nowrap">
                      {formatDate(i.resolved_at || '')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
