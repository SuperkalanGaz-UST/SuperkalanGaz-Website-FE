import { Star, MapPin, Phone, ArrowLeft, User, Trophy } from 'lucide-react';

interface CustomerDetailProps {
  onBack: () => void;
}

const orderHistory = [
  { orderNo: 'ORD-20250412', branch: 'Quezon City', date: 'Apr 12, 2025', status: 'Delivered', rating: 5 },
  { orderNo: 'ORD-20250401', branch: 'Caloocan',    date: 'Apr 1, 2025',  status: 'Delivered', rating: 4 },
  { orderNo: 'ORD-20250318', branch: 'Quezon City', date: 'Mar 18, 2025', status: 'Delivered', rating: 4 },
  { orderNo: 'ORD-20250309', branch: 'Quezon City', date: 'Mar 9, 2025',  status: 'Delivered', rating: 5 },
  { orderNo: 'ORD-20250224', branch: 'Sta. Rosa',   date: 'Feb 24, 2025', status: 'Delivered', rating: 4 },
  { orderNo: 'ORD-20250215', branch: 'Quezon City', date: 'Feb 15, 2025', status: 'Delivered', rating: 3 },
  { orderNo: 'ORD-20250205', branch: 'Caloocan',    date: 'Feb 5, 2025',  status: 'Delivered', rating: 5 },
  { orderNo: 'ORD-20250128', branch: 'Quezon City', date: 'Jan 28, 2025', status: 'Out for Delivery', rating: null },
  { orderNo: 'ORD-20250117', branch: 'Quezon City', date: 'Jan 17, 2025', status: 'Delivered', rating: 4 },
  { orderNo: 'ORD-20250108', branch: 'Caloocan',    date: 'Jan 8, 2025',  status: 'Delivered', rating: 4 },
];

const branchBreakdown = [
  { branch: 'Quezon City', count: 12, color: '#007BC1' },
  { branch: 'Caloocan',    count: 6,  color: '#0B75B8' },
  { branch: 'Sta. Rosa',   count: 3,  color: '#76B4DD' },
];

const totalBranchOrders = branchBreakdown.reduce((s, b) => s + b.count, 0);

function StarRating({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= value ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'}`}
        />
      ))}
    </span>
  );
}

export function CustomerDetail({ onBack }: CustomerDetailProps) {
  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F7FA]">
      {/* Header */}
      <div className="bg-white px-8 py-5 border-b border-gray-100">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[#007BC1] hover:text-[#005a8f] transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Customer List</span>
        </button>
        <div className="pt-1">
          <h1 className="text-2xl font-semibold text-gray-900">Customer Detail</h1>
          <p className="text-sm text-gray-500 mt-1">View customer profile and cross-branch order history</p>
        </div>
      </div>

      <div className="p-8 space-y-6">
        {/* Profile Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-6">
            {/* Left — Avatar + Info */}
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-full bg-[#E0F0FB] flex items-center justify-center flex-shrink-0">
                <User className="w-8 h-8 text-[#007BC1]" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Maria Dela Cruz Santos</h2>
                <div className="flex items-center gap-1.5 mt-1.5 text-sm text-gray-500">
                  <Phone className="w-4 h-4 text-gray-400" />
                  +63 917 834 2291
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-500">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  123 Kalayaan Ave., Diliman, Quezon City, Metro Manila
                </div>
              </div>
            </div>

            {/* Right — 3 Stat Chips */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Total Orders */}
              <div className="flex flex-col items-center bg-[#F0F8FF] border border-[#C8E4F7] rounded-xl px-5 py-3 min-w-[100px]">
                <span className="text-2xl font-bold text-[#007BC1]">18</span>
                <span className="text-xs text-gray-500 mt-0.5 text-center">Total Orders</span>
              </div>

              {/* Loyalty Points */}
              <div className="flex flex-col items-center bg-[#FFF8EC] border border-[#FAE0A4] rounded-xl px-5 py-3 min-w-[110px]">
                <span className="text-2xl font-bold text-amber-500">18<span className="text-base font-semibold text-amber-400">/30</span></span>
                <span className="text-xs text-gray-500 mt-0.5 text-center">Loyalty Points</span>
              </div>

              {/* Avg Rating */}
              <div className="flex flex-col items-center bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl px-5 py-3 min-w-[110px]">
                <div className="flex items-center gap-1">
                  <span className="text-2xl font-bold text-green-600">4.2</span>
                  <Star className="w-5 h-5 fill-green-500 text-green-500 mb-0.5" />
                </div>
                <span className="text-xs text-gray-500 mt-0.5 text-center">Avg. Rating Given</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Two-Column Layout */}
        <div className="flex gap-6 items-start">
          {/* Left — Order History Table (60%) */}
          <div className="bg-white rounded-xl border border-gray-200 p-6" style={{ flex: '0 0 60%' }}>
            <h3 className="text-base font-semibold text-gray-900 mb-4">Order History</h3>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left text-xs font-medium text-gray-500 pb-3 pr-4">Order No.</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-3 pr-4">Branch</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-3 pr-4">Date</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-3 pr-4">Status</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-3">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {orderHistory.map((order) => (
                    <tr key={order.orderNo} className="border-b border-gray-50 last:border-0">
                      <td className="py-3 pr-4 text-sm font-mono text-gray-700">{order.orderNo}</td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor:
                                order.branch === 'Quezon City' ? '#007BC1' :
                                order.branch === 'Caloocan'    ? '#0B75B8' : '#76B4DD',
                            }}
                          />
                          {order.branch}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-sm text-gray-500">{order.date}</td>
                      <td className="py-3 pr-4">
                        {order.status === 'Delivered' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Delivered
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            Out for Delivery
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        {order.rating !== null ? (
                          <StarRating value={order.rating} />
                        ) : (
                          <span className="text-xs text-gray-400 italic">Pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right — Branch Breakdown (40%) */}
          <div className="flex flex-col gap-4" style={{ flex: '0 0 calc(40% - 24px)' }}>
            {/* Orders by Branch Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-5">Orders by Branch</h3>

              <div className="space-y-4">
                {branchBreakdown.map((item) => {
                  const pct = Math.round((item.count / totalBranchOrders) * 100);
                  return (
                    <div key={item.branch}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm text-gray-700 font-medium">{item.branch}</span>
                        <span className="text-sm font-semibold text-gray-800">{item.count} orders</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5">
                        <div
                          className="h-2.5 rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: item.color }}
                        />
                      </div>
                      <div className="text-xs text-gray-400 mt-1">{pct}% of total</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Most Frequent Branch Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-amber-500" />
                <h4 className="text-sm font-semibold text-gray-700">Most Frequent Branch</h4>
              </div>

              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#E0F0FB' }}
                >
                  <MapPin className="w-6 h-6 text-[#007BC1]" />
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-900">Quezon City</div>
                  <div className="text-sm text-gray-500">12 orders • 57% of total</div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs text-green-600 font-medium">Active Branch</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Loyalty Progress Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Loyalty Progress</h4>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">Points collected</span>
                <span className="text-xs font-semibold text-gray-800">18 / 30</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
                <div
                  className="h-3 rounded-full"
                  style={{ width: '60%', background: 'linear-gradient(90deg, #007BC1, #0B75B8)' }}
                />
              </div>
              <p className="text-xs text-gray-400">12 more orders to earn a free tank reward</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
