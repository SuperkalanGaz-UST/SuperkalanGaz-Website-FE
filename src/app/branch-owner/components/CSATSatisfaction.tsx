'use client';

import { useCallback, useEffect, useState } from 'react';
import { Header } from './Header';
import { KPICard } from './KPICard';
import { Star, MessageSquare, AlertCircle, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../lib/api';
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
  const { selectedBranch } = useBranch();

  const [summary, setSummary] = useState<SummaryRow | null>(null);
  const [ratings, setRatings] = useState<RatingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const PREVIEW_ROWS = 5;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, ratingsRes] = await Promise.all([
        apiFetch('/csat/summary'),
        apiFetch('/csat/ratings?resolution=all'),
      ]);
      
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json() as { summary: SummaryRow };
        setSummary(summaryData.summary);
      }
      if (ratingsRes.ok) {
        const ratingsData = await ratingsRes.json() as { ratings: RatingRow[] };
        setRatings(ratingsData.ratings);
      }
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load, selectedBranch]);

  // All ratings (newest first) — already sorted by backend
  const allRatings = ratings;
  // Complaints = 1–3★ Open (flagged for resolution)
  const complaints = ratings.filter((r) => r.stars <= 3 && r.resolution_status === 'Open');

  const navigate = (screen: string) =>
    window.dispatchEvent(new CustomEvent('navigate', { detail: screen }));

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header title="Ratings &amp; Reviews" />
      </div>

      <div className="p-8">
        {/* KPI tiles */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {/* Average rating */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 relative flex flex-col min-h-[120px]">
            <div
              className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#f59e0b26' }}
            >
              <Star className="w-4 h-4 text-[#f59e0b]" />
            </div>
            <div className="text-sm font-medium text-gray-500 pr-12">Average Rating</div>
            {loading ? (
              <div className="text-3xl font-bold text-gray-400 mt-2">—</div>
            ) : (
              <div className="flex items-center gap-2 mt-2 leading-none">
                <div className="text-3xl font-bold text-gray-900">
                  {summary?.average_stars != null ? summary.average_stars.toFixed(1) : '—'}
                </div>
                {summary?.average_stars != null && (
                  <div className="flex gap-0.5 mt-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-4 h-4 ${s <= Math.round(summary.average_stars!) ? 'fill-[#f59e0b] text-[#f59e0b]' : 'text-gray-300'}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="text-xs text-gray-400 mt-auto pt-3">out of 5.0</div>
          </div>

          <KPICard
            title="Total Ratings Received"
            value={loading ? '—' : (summary?.total_ratings ?? 0).toString()}
            icon={<MessageSquare className="w-4 h-4 text-[#f59e0b]" />}
            accentColor="#f59e0b"
          />
          <KPICard
            title="Open Complaints (1–3★)"
            value={loading ? '—' : (summary?.open_count ?? 0).toString()}
            icon={<AlertCircle className="w-4 h-4 text-[#ef4444]" />}
            accentColor="#ef4444"
            alert={(summary?.open_count ?? 0) > 0}
          />
        </div>

        {/* ── Ratings table ──────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Customer Ratings &amp; Reviews</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => void load()}
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
                  <th className="text-left text-[11px] font-medium text-gray-500 pb-3 px-2">Customer / ID</th>
                  <th className="text-left text-[11px] font-medium text-gray-500 pb-3 px-2">Delivery ID</th>
                  <th className="text-left text-[11px] font-medium text-gray-500 pb-3 px-2">Rating</th>
                  <th className="text-left text-[11px] font-medium text-gray-500 pb-3 px-2">Comment</th>
                  <th className="text-left text-[11px] font-medium text-gray-500 pb-3 px-2">Date</th>
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
            <button
              onClick={() => navigate('complaint-log-full')}
              className="text-[11px] text-[#007BC1] hover:text-[#005a8f] transition-colors"
            >
              View all
            </button>
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
                  <th className="text-left text-[11px] font-medium text-gray-500 pb-3 px-2">Customer / ID</th>
                  <th className="text-left text-[11px] font-medium text-gray-500 pb-3 px-2">Delivery ID</th>
                  <th className="text-left text-[11px] font-medium text-gray-500 pb-3 px-2">Rating</th>
                  <th className="text-left text-[11px] font-medium text-gray-500 pb-3 px-2">Complaint / Desc</th>
                  <th className="text-left text-[11px] font-medium text-gray-500 pb-3 px-2">Status</th>
                  <th className="text-left text-[11px] font-medium text-gray-500 pb-3 px-2">Resolution</th>
                  <th className="text-left text-[11px] font-medium text-gray-500 pb-3 px-2">Resolved At</th>
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
