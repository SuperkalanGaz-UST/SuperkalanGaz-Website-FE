import { useState, useMemo } from 'react';
import { Header } from './Header';
import { Pagination } from './Pagination';
import { Select } from './Select';
import { ArrowLeft, Search } from 'lucide-react';

const fullRedemptionData = [
  { customer: 'Maria Santos', redemptionDate: 'Apr 30, 2026', approvedBy: 'Branch Manager: J. Reyes', status: 'Approved' },
  { customer: 'Lola Basyang', redemptionDate: 'Apr 28, 2026', approvedBy: 'Branch Manager: J. Reyes', status: 'Approved' },
  { customer: 'Carlos Miguel', redemptionDate: 'Apr 25, 2026', approvedBy: 'Branch Manager: J. Reyes', status: 'Approved' },
  { customer: 'Rita Lopez', redemptionDate: 'Apr 20, 2026', approvedBy: 'Branch Manager: J. Reyes', status: 'Approved' },
  { customer: 'Fiona Reyes', redemptionDate: 'Apr 18, 2026', approvedBy: 'Branch Manager: J. Reyes', status: 'Approved' },
  { customer: 'Ana Reyes', redemptionDate: 'Apr 15, 2026', approvedBy: 'Branch Manager: J. Reyes', status: 'Approved' },
  { customer: 'Juan Dela Cruz', redemptionDate: 'Apr 12, 2026', approvedBy: 'Branch Manager: J. Reyes', status: 'Approved' },
  { customer: 'Pedro Penduko', redemptionDate: 'Apr 10, 2026', approvedBy: 'Branch Manager: J. Reyes', status: 'Approved' },
  { customer: 'Diana Cruz', redemptionDate: 'Apr 8, 2026', approvedBy: 'Branch Manager: J. Reyes', status: 'Approved' },
  { customer: 'Edgar Santos', redemptionDate: 'Apr 5, 2026', approvedBy: 'Branch Manager: J. Reyes', status: 'Approved' },
  { customer: 'Sofia Cruz', redemptionDate: 'Apr 3, 2026', approvedBy: 'Branch Manager: J. Reyes', status: 'Approved' },
  { customer: 'Kainan ni Aling Nena', redemptionDate: 'Apr 1, 2026', approvedBy: 'Branch Manager: J. Reyes', status: 'Approved' },
];

export function RedemptionHistoryFull({ onBack }: { onBack: () => void }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const itemsPerPage = 10;

  const filteredData = useMemo(() => {
    let data = fullRedemptionData;

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
        <Header title="Redemption History" />
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
              value={filterStatus}
              onChange={(value) => { setFilterStatus(value); setCurrentPage(1); }}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'Approved', label: 'Approved' },
                { value: 'Pending', label: 'Pending' },
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
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Customer Name</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Redemption Date</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Approved By</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {currentData.map((row, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-3 text-[13px] text-gray-900">{row.customer}</td>
                    <td className="py-3 text-[13px] text-gray-600">{row.redemptionDate}</td>
                    <td className="py-3 text-[13px] text-gray-600">{row.approvedBy}</td>
                    <td className="py-3">
                      <span className="inline-block px-3 py-1 rounded-full text-[11px] font-medium bg-green-100 text-green-700">
                        {row.status}
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
