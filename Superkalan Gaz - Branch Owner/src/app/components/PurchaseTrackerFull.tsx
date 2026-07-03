import { useState, useMemo } from 'react';
import { Header } from './Header';
import { Pagination } from './Pagination';
import { Select } from './Select';
import { ArrowLeft, Gift, Search } from 'lucide-react';

const fullCustomerData = [
  { name: 'Maria Santos', phone: '0917-123-4567', address: '123 Mabini St, Makati', totalPurchases: 32, status: 'Eligible for Reward', lastOrder: 'Oct 24, 2023' },
  { name: 'Juan Dela Cruz', phone: '0921-222-1111', address: '101 Burgos St, Makati', totalPurchases: 5, status: 'Active', lastOrder: 'Oct 15, 2023' },
  { name: 'Lola Basyang', phone: '0920-444-3333', address: '7C Bonifacio St, Makati', totalPurchases: 28, status: 'Active', lastOrder: 'Oct 20, 2023' },
  { name: 'Pedro Penduko', phone: '0919-555-1122', address: '88 Luna St, Makati', totalPurchases: 12, status: 'Active', lastOrder: 'Oct 25, 2023' },
  { name: 'Kainan ni Aling Nena', phone: '0918-987-6543', address: '45 Rizal Ave, Makati', totalPurchases: 145, status: 'Eligible for Reward', lastOrder: 'Oct 25, 2023' },
  { name: 'Carlos Miguel', phone: '0922-333-4444', address: '56 Quezon Ave, Makati', totalPurchases: 31, status: 'Eligible for Reward', lastOrder: 'Oct 22, 2023' },
  { name: 'Sofia Cruz', phone: '0923-777-8888', address: '12 Roxas Blvd, Makati', totalPurchases: 8, status: 'Active', lastOrder: 'Oct 18, 2023' },
  { name: 'Ana Reyes', phone: '0924-111-2222', address: '34 Ayala Ave, Makati', totalPurchases: 22, status: 'Active', lastOrder: 'Oct 21, 2023' },
  { name: 'Rita Lopez', phone: '0925-222-3333', address: '67 Taft Ave, Makati', totalPurchases: 60, status: 'Eligible for Reward', lastOrder: 'Oct 19, 2023' },
  { name: 'Ben Reyes', phone: '0926-444-5555', address: '90 Escolta St, Makati', totalPurchases: 12, status: 'Active', lastOrder: 'Oct 17, 2023' },
  { name: 'Diana Cruz', phone: '0927-666-7777', address: '23 Ortigas Ave, Makati', totalPurchases: 35, status: 'Active', lastOrder: 'Oct 16, 2023' },
  { name: 'Edgar Santos', phone: '0928-888-9999', address: '56 EDSA, Makati', totalPurchases: 29, status: 'Active', lastOrder: 'Oct 14, 2023' },
  { name: 'Fiona Reyes', phone: '0929-111-2222', address: '78 Paseo de Roxas, Makati', totalPurchases: 31, status: 'Eligible for Reward', lastOrder: 'Oct 12, 2023' },
  { name: 'Gabriel Cruz', phone: '0930-333-4444', address: '99 Buendia Ave, Makati', totalPurchases: 18, status: 'Active', lastOrder: 'Oct 10, 2023' },
  { name: 'Helen Santos', phone: '0931-555-6666', address: '11 Legaspi St, Makati', totalPurchases: 24, status: 'Active', lastOrder: 'Oct 8, 2023' },
];

function ProgressBar({ current, target, isEligible }: { current: number; target: number; isEligible: boolean }) {
  const percentage = Math.min((current / target) * 100, 100);

  return (
    <div className="flex flex-col gap-1 max-w-[150px] ml-12">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-gray-600 whitespace-nowrap">
          {current} / {target}
        </span>
        {isEligible && (
          <span className="flex items-center gap-1 text-[11px] text-green-600 whitespace-nowrap">
            <Gift className="w-3 h-3" />
            Reward Eligible
          </span>
        )}
      </div>
      <div className="bg-gray-200 rounded-full h-[6px] overflow-hidden w-full">
        <div
          className="bg-[#007BC1] h-full rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}

export function PurchaseTrackerFull({ onBack }: { onBack: () => void }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const itemsPerPage = 10;

  const filteredData = useMemo(() => {
    let data = fullCustomerData;

    if (searchQuery) {
      data = data.filter(row =>
        row.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.address.toLowerCase().includes(searchQuery.toLowerCase())
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
        <Header title="Customer Directory" />
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
                placeholder="Search by name, phone, or address..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none text-sm"
              />
            </div>
            <Select
              value={filterStatus}
              onChange={(value) => { setFilterStatus(value); setCurrentPage(1); }}
              options={[
                { value: 'all', label: 'All Customers' },
                { value: 'Eligible for Reward', label: 'Eligible for Reward' },
                { value: 'Active', label: 'Active Only' },
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

          <div style={{ overflow: 'hidden' }}>
            <table className="w-full" style={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                <col style={{ width: '15%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '30%' }} />
                <col style={{ width: '15%' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3 px-3 whitespace-nowrap">NAME</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3 px-3 whitespace-nowrap">PHONE</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3 px-3 whitespace-nowrap">ADDRESS</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3 px-3 pr-4 whitespace-nowrap">TOTAL PURCHASES</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3 px-3 ml-12 whitespace-nowrap">LOYALTY PROGRESS</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3 px-3 whitespace-nowrap">LAST ORDER</th>
                </tr>
              </thead>
              <tbody>
                {currentData.map((row) => (
                  <tr key={row.name} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-3 text-[13px] text-gray-900 font-medium whitespace-nowrap overflow-hidden text-ellipsis" title={row.name}>{row.name}</td>
                    <td className="py-4 px-3 text-[13px] text-gray-600 whitespace-nowrap">{row.phone}</td>
                    <td className="py-4 px-3 text-[13px] text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis" title={row.address}>{row.address}</td>
                    <td className="py-4 px-3 text-[13px] text-gray-900 whitespace-nowrap font-semibold">{row.totalPurchases}</td>
                    <td className="py-4 px-3">
                      <ProgressBar
                        current={row.totalPurchases % 30 === 0 && row.totalPurchases > 0 ? 30 : row.totalPurchases % 30}
                        target={30}
                        isEligible={row.status === 'Eligible for Reward'}
                      />
                    </td>
                    <td className="py-4 px-3 text-[13px] text-gray-600 whitespace-nowrap">{row.lastOrder}</td>
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
