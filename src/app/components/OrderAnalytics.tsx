import { Header } from "./Header";
import { KPICard } from "./KPICard";
import { DailyOrderVolumeChart } from "./DailyOrderVolumeChart";
import { OrdersByStatusChart } from "./OrdersByStatusChart";
import { DeliveryCompletionTable } from "./DeliveryCompletionTable";

const topCustomers = [
  { name: 'Maria Dela Cruz Santos', branch: 'Quezon City', totalOrders: 18, loyaltyPoints: '18/30', avgRating: 4.2 },
  { name: 'Kainan ni Aling Nena',   branch: 'Calamba',     totalOrders: 14, loyaltyPoints: '14/30', avgRating: 4.7 },
  { name: 'Pedro Penduko',           branch: 'Sta. Rosa',   totalOrders: 12, loyaltyPoints: '12/30', avgRating: 3.9 },
  { name: 'Carlos Miguel',           branch: 'Quezon City', totalOrders: 11, loyaltyPoints: '11/30', avgRating: 4.5 },
  { name: 'Sofia Cruz',              branch: 'Calamba',     totalOrders: 9,  loyaltyPoints: '9/30',  avgRating: 4.1 },
];

export function OrderAnalytics() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header title="Branch Accounts" />
      </div>

      <div className="p-8">
        <div className="grid grid-cols-4 gap-6 mb-8">
          <KPICard title="Total Orders This Month" value="1,847" accentColor="#eab308" />
          <KPICard title="Total Completed Deliveries" value="1,739" accentColor="#22c55e" />
          <KPICard title="Total Cancelled / Failed" value="108" accentColor="#ef4444" />
          <KPICard title="Avg. Delivery Completion Rate" value="96.4%" accentColor="#1A6FBF" />
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
          <DailyOrderVolumeChart />
          <OrdersByStatusChart />
        </div>

        <DeliveryCompletionTable />

        {/* Top Customers Table */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Top Customers</h3>
              <p className="text-xs text-gray-500 mt-0.5">Customers with the highest order volumes across all branches</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Customer Name</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Primary Branch</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Total Orders</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Loyalty Points</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Avg. Rating</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((c, idx) => (
                  <tr key={idx} className="border-b border-gray-100 last:border-0">
                    <td className="py-3 text-[13px] font-medium text-gray-900">{c.name}</td>
                    <td className="py-3 text-[13px] text-gray-600">{c.branch}</td>
                    <td className="py-3 text-[13px] text-gray-600">{c.totalOrders}</td>
                    <td className="py-3 text-[13px] text-gray-600">{c.loyaltyPoints}</td>
                    <td className="py-3 text-[13px] text-gray-600">{c.avgRating} ★</td>
                    <td className="py-3">
                      <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('navigate', { detail: 'customers' })); }}
                        className="text-[11px] text-[#007BC1] hover:text-[#005a8f] font-medium transition-colors"
                      >
                        View →
                      </a>
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