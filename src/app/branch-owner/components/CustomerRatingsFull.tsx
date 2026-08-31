'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Header } from './Header';
import { Pagination } from './Pagination';
import { ArrowLeft, RefreshCw, Search } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useBranch } from '../contexts/BranchContext';
import { RatingRow, RatingStars, formatDate } from './CSATSatisfaction';

export function CustomerRatingsFull({ onBack }: { onBack: () => void }) {
  const { selectedBranch } = useBranch();

  const [ratings, setRatings] = useState<RatingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRating, setFilterRating] = useState('all');

  const ITEMS_PER_PAGE = 10;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch('/csat/ratings?resolution=all');
      const data = await r.json() as { ratings: RatingRow[] };
      if (!r.ok) throw new Error('Failed to load');
      setRatings(data.ratings);
    } catch {
      setError('Failed to load ratings. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load, selectedBranch]);

  const filteredData = useMemo(() => {
    return ratings.filter((row) => {
      const matchesStar = filterRating === 'all' || row.stars === parseInt(filterRating);
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        (row.customer_name ?? '').toLowerCase().includes(q) ||
        (row.comment ?? '').toLowerCase().includes(q);
      return matchesStar && matchesSearch;
    });
  }, [ratings, searchQuery, filterRating]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const currentData = filteredData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const clearFilters = () => {
    setSearchQuery('');
    setFilterRating('all');
    setCurrentPage(1);
  };

  const hasFilters = searchQuery || filterRating !== 'all';

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }} className="pt-4">
        <Header title="Customer Ratings &amp; Reviews" />
      </div>

      <div className="p-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-[#007BC1] hover:text-[#005a8f] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6 items-center">
            <div className="flex-1 min-w-[180px] relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search customer or comment…"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#007BC1]"
              />
            </div>
            <select
              value={filterRating}
              onChange={(e) => { setFilterRating(e.target.value); setCurrentPage(1); }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#007BC1]"
            >
              <option value="all">All Ratings</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>{n} Star{n !== 1 ? 's' : ''}</option>
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
              onClick={() => void load()}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40 ml-auto"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {error && <div className="text-sm text-red-500 mb-4">{error}</div>}

          <div className="overflow-x-auto">
            <table className="w-full" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '160px' }} />
                <col style={{ width: '130px' }} />
                <col style={{ width: '130px' }} />
                <col style={{ minWidth: '220px' }} />
                <col style={{ width: '120px' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3 px-3 whitespace-nowrap">Customer / ID</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3 px-3 whitespace-nowrap">Delivery ID</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3 px-3 whitespace-nowrap">Rating</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3 px-3 whitespace-nowrap">Comment</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3 px-3 whitespace-nowrap">Date</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={5} className="py-10 text-center text-sm text-gray-400">Loading…</td></tr>
                )}
                {!loading && currentData.length === 0 && (
                  <tr><td colSpan={5} className="py-10 text-center text-sm text-gray-400">No ratings found for the selected filters.</td></tr>
                )}
                {!loading && currentData.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-b border-gray-100 ${row.stars <= 3 ? 'bg-red-50/40' : ''}`}
                  >
                    <td className="py-4 px-3 whitespace-nowrap">
                      <div className="text-[13px] text-gray-900 font-medium">{row.customer_name ?? '—'}</div>
                      <div className="text-[11px] text-gray-500 font-mono" title={row.customer_id}>{row.customer_id.split('-')[0]}</div>
                    </td>
                    <td className="py-4 px-3 text-[13px] text-gray-600 font-mono">
                      {row.service_request_id.split('-')[0]}
                    </td>
                    <td className="py-4 px-3">
                      <RatingStars value={row.stars} />
                    </td>
                    <td className="py-4 px-3 text-[13px] text-gray-600">
                      {row.comment ?? <span className="italic text-gray-400">No comment</span>}
                    </td>
                    <td className="py-4 px-3 text-[13px] text-gray-600 whitespace-nowrap">
                      {formatDate(row.submitted_at)}
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
            <div className="mt-3 text-xs text-gray-400 text-right">
              Showing {currentData.length} of {filteredData.length} rating{filteredData.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}