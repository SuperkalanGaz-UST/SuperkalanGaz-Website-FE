import { useState, useMemo, useEffect } from 'react';
import { Header } from './Header';
import { Pagination } from './Pagination';
import { Select } from './Select';
import { ArrowLeft, Search } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useBranch } from '../contexts/BranchContext';

type SaleRow = { id: string; date: string; receipt: string; customer: string; orders: number; spent: number; paid: string };

export function SalesFull({ onBack }: { onBack: () => void }) {
  const { selectedBranchId } = useBranch();
  const [salesData, setSalesData] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const itemsPerPage = 10;

  useEffect(() => {
    let active = true;
    if (!selectedBranchId) return () => { active = false; };
    const controller = new AbortController();
    const now = new Date();
    setLoading(true);
    apiFetch(`/service-requests/reports/branch-owner-sales?branchId=${encodeURIComponent(selectedBranchId)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error('Could not load sales records.');
        if (active) setSalesData((data?.sales ?? []) as SaleRow[]);
      }).catch(() => {
      if (active && !controller.signal.aborted) setSalesData([]);
    }).finally(() => {
      if (active && !controller.signal.aborted) setLoading(false);
    });
    return () => { active = false; controller.abort(); };
  }, [selectedBranchId]);

  const filteredData = useMemo(() => {
    let data = salesData;

    if (searchQuery) {
      data = data.filter(row =>
        Object.values(row).some(val =>
          String(val).toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }

    if (filterStatus !== 'all') {
      data = data.filter(row => row.paid.toLowerCase() === filterStatus.toLowerCase());
    }

    return data;
  }, [salesData, searchQuery, filterStatus]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = filteredData.slice(startIndex, endIndex);

  const hasActiveFilters = searchQuery || filterStatus !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setFilterStatus('all');
    setCurrentPage(1);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header title="Sales Records" />
      </div>

      <div className="p-8">
        <button
          onClick={(e) => {
            e.preventDefault();
            // Dispatch event to go back to the dashboard, matching your routing setup
            window.dispatchEvent(new CustomEvent('navigate', { detail: 'dashboard' }));
            // Also call the prop if provided
            if (onBack) onBack(); 
          }}
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
                placeholder="Search receipts, customers, etc..."
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
                { value: 'paid', label: 'Paid' },
                { value: 'unpaid', label: 'Unpaid' }
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
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Order Date</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Receipt No.</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Customer</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Total Orders</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Cash Received</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="py-10 text-center text-sm text-gray-400">Loading sales records…</td></tr>
                ) : currentData.length === 0 ? (
                  <tr><td colSpan={6} className="py-10 text-center text-sm text-gray-400">No sales records found.</td></tr>
                ) : currentData.map((row, index) => (
                  <tr key={row.id} className={`border-b border-gray-100 ${index % 2 === 1 ? 'bg-gray-50' : ''}`}>
                    <td className="py-4 text-[13px] text-gray-900 whitespace-nowrap">{new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(row.date))}</td>
                    <td className="py-4 text-[13px] text-gray-900 whitespace-nowrap font-mono">{row.receipt}</td>
                    <td className="py-4 text-[13px] text-gray-900 whitespace-nowrap">{row.customer}</td>
                    <td className="py-4 text-[13px] text-gray-600 whitespace-nowrap">{row.orders}</td>
                    <td className="py-4 text-[13px] font-medium text-gray-900 whitespace-nowrap">₱{Number(row.spent).toLocaleString()}</td>
                    <td className="py-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-[11px] font-medium ${
                          row.paid === 'Paid'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {row.paid}
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