import { Gift } from 'lucide-react';

const customerData = [
  { name: 'Maria Santos', phone: '0917-123-4567', address: '123 Mabini St, Makati', totalPurchases: 32, status: 'Eligible for Reward', lastOrder: 'Oct 24, 2023' },
  { name: 'Juan Dela Cruz', phone: '0921-222-1111', address: '101 Burgos St, Makati', totalPurchases: 5, status: 'Active', lastOrder: 'Oct 15, 2023' },
  { name: 'Lola Basyang', phone: '0920-444-3333', address: '7C Bonifacio St, Makati', totalPurchases: 28, status: 'Active', lastOrder: 'Oct 20, 2023' },
  { name: 'Pedro Penduko', phone: '0919-555-1122', address: '88 Luna St, Makati', totalPurchases: 12, status: 'Active', lastOrder: 'Oct 25, 2023' },
  { name: 'Kainan ni Aling Nena', phone: '0918-987-6543', address: '45 Rizal Ave, Makati', totalPurchases: 145, status: 'Eligible for Reward', lastOrder: 'Oct 25, 2023' },
  { name: 'Carlos Miguel', phone: '0922-333-4444', address: '56 Quezon Ave, Makati', totalPurchases: 31, status: 'Eligible for Reward', lastOrder: 'Oct 22, 2023' },
  { name: 'Sofia Cruz', phone: '0923-777-8888', address: '12 Roxas Blvd, Makati', totalPurchases: 8, status: 'Active', lastOrder: 'Oct 18, 2023' },
  { name: 'Ana Reyes', phone: '0924-111-2222', address: '34 Ayala Ave, Makati', totalPurchases: 22, status: 'Active', lastOrder: 'Oct 21, 2023' },
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

export function CustomerPurchaseTracker() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Customer Directory</h3>
        <a href="#" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('navigate', { detail: 'purchase-tracker-full' })); }} className="text-[11px] text-[#007BC1] hover:text-[#005a8f] transition-colors">
          View all
        </a>
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
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3 px-3 pl-16 whitespace-nowrap">LOYALTY PROGRESS</th>
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3 px-3 whitespace-nowrap">LAST ORDER</th>
            </tr>
          </thead>
          <tbody>
            {customerData.map((row) => (
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
    </div>
  );
}
