import { useState, useMemo } from 'react';
import { Header } from './Header';
import { Pagination } from './Pagination';
import { Select } from './Select';
import { ArrowLeft, Search } from 'lucide-react';

const fullComplaintData = [
  { complaintId: 'CMP-001', customer: 'Pedro Penduko', issueSummary: 'Late delivery - order arrived 1 hour past scheduled time', status: 'Resolved', responseTime: '2 hrs' },
  { complaintId: 'CMP-002', customer: 'Ana Reyes', issueSummary: 'Wrong LPG tank size delivered', status: 'Pending', responseTime: '45 mins' },
  { complaintId: 'CMP-003', customer: 'Carlos Miguel', issueSummary: 'Rider did not call upon arrival', status: 'Resolved', responseTime: '1.5 hrs' },
  { complaintId: 'CMP-004', customer: 'Sofia Cruz', issueSummary: 'Payment receipt not provided', status: 'Pending', responseTime: '30 mins' },
  { complaintId: 'CMP-005', customer: 'Juan Dela Cruz', issueSummary: 'Delivery address was incorrect', status: 'Resolved', responseTime: '3 hrs' },
  { complaintId: 'CMP-006', customer: 'Maria Santos', issueSummary: 'Tank was not properly sealed', status: 'Resolved', responseTime: '1 hr' },
  { complaintId: 'CMP-007', customer: 'Lola Basyang', issueSummary: 'Rider was rude', status: 'Pending', responseTime: '20 mins' },
  { complaintId: 'CMP-008', customer: 'Kainan ni Aling Nena', issueSummary: 'Late night delivery outside operating hours', status: 'Resolved', responseTime: '2.5 hrs' },
  { complaintId: 'CMP-009', customer: 'Rita Lopez', issueSummary: 'Overcharged on invoice', status: 'Resolved', responseTime: '4 hrs' },
  { complaintId: 'CMP-010', customer: 'Ben Reyes', issueSummary: 'Tank leaked after installation', status: 'Pending', responseTime: '15 mins' },
  { complaintId: 'CMP-011', customer: 'Diana Cruz', issueSummary: 'No confirmation call before delivery', status: 'Resolved', responseTime: '1.5 hrs' },
  { complaintId: 'CMP-012', customer: 'Edgar Santos', issueSummary: 'Delivery van blocked driveway', status: 'Resolved', responseTime: '45 mins' },
];

export function ComplaintLogFull({ onBack }: { onBack: () => void }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const itemsPerPage = 10;

  const filteredData = useMemo(() => {
    let data = fullComplaintData;

    if (searchQuery) {
      data = data.filter(row =>
        Object.values(row).some(val =>
          String(val).toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }

    if (filterStatus !== 'all') {
      data = data.filter(row => row.status.toLowerCase() === filterStatus.toLowerCase());
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
        <Header title="Complaint Log" />
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
                { value: 'pending', label: 'Pending' },
                { value: 'resolved', label: 'Resolved' },
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
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Complaint ID</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Customer Name</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Issue Summary</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Status</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Response Time</th>
                </tr>
              </thead>
              <tbody>
                {currentData.map((row) => (
                  <tr key={row.complaintId} className="border-b border-gray-100">
                    <td className="py-3 text-[13px] text-gray-900">{row.complaintId}</td>
                    <td className="py-3 text-[13px] text-gray-900">{row.customer}</td>
                    <td className="py-3 text-[13px] text-gray-600 max-w-md">{row.issueSummary}</td>
                    <td className="py-3">
                      <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-medium ${
                        row.status === 'Resolved'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3 text-[13px] text-gray-600">{row.responseTime}</td>
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
