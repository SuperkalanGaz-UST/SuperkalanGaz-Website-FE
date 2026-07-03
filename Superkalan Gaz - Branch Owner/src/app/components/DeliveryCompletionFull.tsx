import { useState, useMemo } from 'react';
import { Header } from './Header';
import { Pagination } from './Pagination';
import { Select } from './Select';
import { ArrowLeft, Search } from 'lucide-react';

const fullCompletionData = [
  { month: 'January 2026', totalOrders: 268, completed: 260, completionRate: 97.0, slaBreaches: 8 },
  { month: 'February 2026', totalOrders: 272, completed: 265, completionRate: 97.4, slaBreaches: 7 },
  { month: 'March 2026', totalOrders: 285, completed: 275, completionRate: 96.5, slaBreaches: 10 },
  { month: 'April 2026', totalOrders: 290, completed: 282, completionRate: 97.2, slaBreaches: 8 },
  { month: 'May 2024', totalOrders: 245, completed: 238, completionRate: 97.1, slaBreaches: 7 },
  { month: 'June 2024', totalOrders: 252, completed: 245, completionRate: 97.2, slaBreaches: 7 },
  { month: 'July 2024', totalOrders: 260, completed: 251, completionRate: 96.5, slaBreaches: 9 },
  { month: 'August 2024', totalOrders: 255, completed: 248, completionRate: 97.3, slaBreaches: 7 },
  { month: 'September 2024', totalOrders: 263, completed: 255, completionRate: 96.9, slaBreaches: 8 },
  { month: 'October 2024', totalOrders: 270, completed: 262, completionRate: 97.0, slaBreaches: 8 },
  { month: 'November 2024', totalOrders: 265, completed: 258, completionRate: 97.4, slaBreaches: 7 },
  { month: 'December 2024', totalOrders: 275, completed: 267, completionRate: 97.1, slaBreaches: 8 },
];

export function DeliveryCompletionFull({ onBack }: { onBack: () => void }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMonth, setFilterMonth] = useState('all');

  const itemsPerPage = 10;

  const filteredData = useMemo(() => {
    let data = fullCompletionData;

    if (searchQuery) {
      data = data.filter(row =>
        Object.values(row).some(val =>
          String(val).toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }

    if (filterMonth !== 'all') {
      data = data.filter(row => row.month === filterMonth);
    }

    return data;
  }, [searchQuery, filterMonth]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = filteredData.slice(startIndex, endIndex);

  const hasActiveFilters = searchQuery || filterMonth !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setFilterMonth('all');
    setCurrentPage(1);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header
          title="Delivery Completion Rate"
        />
      </div>

      <div className="p-8">
        <button
          onClick={onBack}
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
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none text-sm"
              />
            </div>
            <Select
              value={filterMonth}
              onChange={(value) => { setFilterMonth(value); setCurrentPage(1); }}
              options={[
                { value: 'all', label: 'All Months' },
                ...fullCompletionData.map(row => ({ value: row.month, label: row.month }))
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
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Month</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Total Orders</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Completed</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Completion Rate %</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">SLA Breaches</th>
                </tr>
              </thead>
              <tbody>
                {currentData.map((row) => (
                  <tr key={row.month} className="border-b border-gray-100">
                    <td className="py-4 text-[13px] text-gray-900 whitespace-nowrap">{row.month}</td>
                    <td className="py-4 text-[13px] text-gray-600 whitespace-nowrap">{row.totalOrders}</td>
                    <td className="py-4 text-[13px] text-gray-600 whitespace-nowrap">{row.completed}</td>
                    <td className="py-4 text-[13px] font-medium text-gray-900 whitespace-nowrap">{row.completionRate}%</td>
                    <td className="py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-medium ${
                        row.slaBreaches <= 8 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {row.slaBreaches}
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
