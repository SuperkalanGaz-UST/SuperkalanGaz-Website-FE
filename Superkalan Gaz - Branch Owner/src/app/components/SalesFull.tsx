import { useState, useMemo } from 'react';
import { Header } from './Header';
import { Pagination } from './Pagination';
import { Select } from './Select';
import { ArrowLeft, Search } from 'lucide-react';

// Full historical sales data
const salesData = [
  { id: '1', date: 'May 2, 2026', receipt: 'RCP-0001', customer: 'Maria Santos', orders: 2, spent: 2200, paid: 'Paid' },
  { id: '2', date: 'May 2, 2026', receipt: 'RCP-0002', customer: 'Juan Dela Cruz', orders: 1, spent: 1100, paid: 'Paid' },
  { id: '3', date: 'May 1, 2026', receipt: 'RCP-0003', customer: 'Pedro Penduko', orders: 3, spent: 3300, paid: 'Unpaid' },
  { id: '4', date: 'May 1, 2026', receipt: 'RCP-0004', customer: 'Lola Basyang', orders: 1, spent: 1100, paid: 'Paid' },
  { id: '5', date: 'May 1, 2026', receipt: 'RCP-0005', customer: 'Carlos Miguel', orders: 2, spent: 2200, paid: 'Paid' },
  { id: '6', date: 'Apr 30, 2026', receipt: 'RCP-0006', customer: 'Ana Reyes', orders: 1, spent: 1100, paid: 'Paid' },
  { id: '7', date: 'Apr 30, 2026', receipt: 'RCP-0007', customer: 'Rita Lopez', orders: 4, spent: 4400, paid: 'Unpaid' },
  { id: '8', date: 'Apr 29, 2026', receipt: 'RCP-0008', customer: 'Sofia Cruz', orders: 2, spent: 2200, paid: 'Paid' },
  { id: '9', date: 'Apr 29, 2026', receipt: 'RCP-0009', customer: 'Ben Reyes', orders: 1, spent: 1100, paid: 'Paid' },
  { id: '10', date: 'Apr 28, 2026', receipt: 'RCP-0010', customer: 'Diana Cruz', orders: 3, spent: 3300, paid: 'Paid' },
  { id: '11', date: 'Apr 28, 2026', receipt: 'RCP-0011', customer: 'Edgar Santos', orders: 2, spent: 2200, paid: 'Unpaid' },
  { id: '12', date: 'Apr 27, 2026', receipt: 'RCP-0012', customer: 'Fiona Reyes', orders: 1, spent: 1100, paid: 'Paid' },
  { id: '13', date: 'Apr 27, 2026', receipt: 'RCP-0013', customer: 'Gabriel Cruz', orders: 2, spent: 2200, paid: 'Paid' },
  { id: '14', date: 'Apr 26, 2026', receipt: 'RCP-0014', customer: 'Helen Lopez', orders: 1, spent: 1100, paid: 'Paid' },
  { id: '15', date: 'Apr 26, 2026', receipt: 'RCP-0015', customer: 'Ivan Santos', orders: 3, spent: 3300, paid: 'Unpaid' },
  { id: '16', date: 'Apr 25, 2026', receipt: 'RCP-0016', customer: 'Julia Reyes', orders: 2, spent: 2200, paid: 'Paid' },
  { id: '17', date: 'Apr 25, 2026', receipt: 'RCP-0017', customer: 'Kevin Cruz', orders: 1, spent: 1100, paid: 'Paid' },
  { id: '18', date: 'Apr 24, 2026', receipt: 'RCP-0018', customer: 'Luna Santos', orders: 2, spent: 2200, paid: 'Paid' },
];

export function SalesFull({ onBack }: { onBack: () => void }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const itemsPerPage = 10;

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
                {currentData.map((row, index) => (
                  <tr key={row.id} className={`border-b border-gray-100 ${index % 2 === 1 ? 'bg-gray-50' : ''}`}>
                    <td className="py-4 text-[13px] text-gray-900 whitespace-nowrap">{row.date}</td>
                    <td className="py-4 text-[13px] text-gray-900 whitespace-nowrap font-mono">{row.receipt}</td>
                    <td className="py-4 text-[13px] text-gray-900 whitespace-nowrap">{row.customer}</td>
                    <td className="py-4 text-[13px] text-gray-600 whitespace-nowrap">{row.orders}</td>
                    <td className="py-4 text-[13px] font-medium text-gray-900 whitespace-nowrap">₱{row.spent.toLocaleString()}</td>
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