import { useState, useMemo } from 'react';
import { Header } from './Header';
import { Pagination } from './Pagination';
import { Select } from './Select';
import { ArrowLeft, Search } from 'lucide-react';

const fullReorderData = [
  { requestId: 'ROR-105', dateRequested: 'Apr 28, 2026', qtyRequested: 50, requestedBy: 'Branch Manager: J. Reyes', status: 'Fulfilled', fulfilledDate: 'Apr 30, 2026' },
  { requestId: 'ROR-104', dateRequested: 'Apr 20, 2026', qtyRequested: 40, requestedBy: 'Branch Manager: J. Reyes', status: 'Fulfilled', fulfilledDate: 'Apr 22, 2026' },
  { requestId: 'ROR-103', dateRequested: 'Apr 18, 2026', qtyRequested: 35, requestedBy: 'Branch Manager: J. Reyes', status: 'Pending', fulfilledDate: '-' },
  { requestId: 'ROR-102', dateRequested: 'Apr 12, 2026', qtyRequested: 45, requestedBy: 'Branch Manager: J. Reyes', status: 'Fulfilled', fulfilledDate: 'Apr 14, 2026' },
  { requestId: 'ROR-101', dateRequested: 'Apr 5, 2026', qtyRequested: 50, requestedBy: 'Branch Manager: J. Reyes', status: 'Fulfilled', fulfilledDate: 'Apr 7, 2026' },
  { requestId: 'ROR-100', dateRequested: 'Mar 28, 2026', qtyRequested: 60, requestedBy: 'Branch Manager: J. Reyes', status: 'Fulfilled', fulfilledDate: 'Mar 30, 2026' },
  { requestId: 'ROR-099', dateRequested: 'Mar 20, 2026', qtyRequested: 45, requestedBy: 'Branch Manager: J. Reyes', status: 'Fulfilled', fulfilledDate: 'Mar 22, 2026' },
  { requestId: 'ROR-098', dateRequested: 'Mar 15, 2026', qtyRequested: 40, requestedBy: 'Branch Manager: J. Reyes', status: 'Fulfilled', fulfilledDate: 'Mar 17, 2026' },
  { requestId: 'ROR-097', dateRequested: 'Mar 10, 2026', qtyRequested: 55, requestedBy: 'Branch Manager: J. Reyes', status: 'Fulfilled', fulfilledDate: 'Mar 12, 2026' },
  { requestId: 'ROR-096', dateRequested: 'Mar 5, 2026', qtyRequested: 50, requestedBy: 'Branch Manager: J. Reyes', status: 'Fulfilled', fulfilledDate: 'Mar 7, 2026' },
  { requestId: 'ROR-095', dateRequested: 'Feb 28, 2026', qtyRequested: 45, requestedBy: 'Branch Manager: J. Reyes', status: 'Fulfilled', fulfilledDate: 'Mar 2, 2026' },
  { requestId: 'ROR-094', dateRequested: 'Feb 20, 2026', qtyRequested: 40, requestedBy: 'Branch Manager: J. Reyes', status: 'Fulfilled', fulfilledDate: 'Feb 22, 2026' },
];

export function ReorderLogFull({ onBack }: { onBack: () => void }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const itemsPerPage = 10;

  const filteredData = useMemo(() => {
    let data = fullReorderData;

    if (searchQuery) {
      data = data.filter(row =>
        Object.values(row).some(val =>
          String(val).toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }

    if (filterStatus !== 'all') {
      data = data.filter(row => row.status === filterStatus);
    }

    return data;
  }, [searchQuery, filterStatus]);

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
      <div style={{ position: 'static' }} className="pt-4">
        <Header title="Reorder Request Log" />
      </div>

      <div className="p-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-[#007BC1] hover:text-[#005a8f] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Supply Chain
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
              value={filterStatus}
              onChange={(value) => { setFilterStatus(value); setCurrentPage(1); }}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'Pending', label: 'Pending' },
                { value: 'Fulfilled', label: 'Fulfilled' },
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
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Request ID</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Date Requested</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Qty Requested</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Requested By</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Status</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Fulfilled Date</th>
                </tr>
              </thead>
              <tbody>
                {currentData.map((row) => (
                  <tr key={row.requestId} className="border-b border-gray-100">
                    <td className="py-3 text-[13px] text-gray-900">{row.requestId}</td>
                    <td className="py-3 text-[13px] text-gray-600">{row.dateRequested}</td>
                    <td className="py-3 text-[13px] text-gray-600">{row.qtyRequested} cylinders</td>
                    <td className="py-3 text-[13px] text-gray-600">{row.requestedBy}</td>
                    <td className="py-3">
                      <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-medium ${
                        row.status === 'Fulfilled'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3 text-[13px] text-gray-600">{row.fulfilledDate}</td>
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
