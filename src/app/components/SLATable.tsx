
const slaData = [
  {
    orderId: 'ORD-1047',
    customer: 'Maria Santos',
    orderedAt: '10:00 AM',
    deliveredAt: '10:15 AM',
    deliveryTime: 15,
    status: 'On Time',
  },
  {
    orderId: 'ORD-1048',
    customer: 'Kainan ni Aling Nena',
    orderedAt: '10:15 AM',
    deliveredAt: '10:30 AM',
    deliveryTime: 15,
    status: 'On Time',
  },
  {
    orderId: 'ORD-1049',
    customer: 'Pedro Penduko',
    orderedAt: '10:20 AM',
    deliveredAt: '11:25 AM',
    deliveryTime: 65,
    status: 'Breached',
  },
  {
    orderId: 'ORD-1050',
    customer: 'Lola Basyang',
    orderedAt: '10:45 AM',
    deliveredAt: '11:15 AM',
    deliveryTime: 30,
    status: 'On Time',
  },
  {
    orderId: 'ORD-1051',
    customer: 'Juan Dela Cruz',
    orderedAt: '11:15 AM',
    deliveredAt: '11:45 AM',
    deliveryTime: 30,
    status: 'On Time',
  },
];

export function SLATable() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">SLA Compliance</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Order ID</th>
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Customer Name</th>
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Ordered At</th>
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Delivered At</th>
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Delivery Time (mins)</th>
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3">SLA Status</th>
            </tr>
          </thead>
          <tbody>
            {slaData.map((row) => (
              <tr key={row.orderId} className="border-b border-gray-100">
                <td className="py-3 text-[13px] text-gray-900">{row.orderId}</td>
                <td className="py-3 text-[13px] text-gray-900">{row.customer}</td>
                <td className="py-3 text-[13px] text-gray-600">{row.orderedAt}</td>
                <td className="py-3 text-[13px] text-gray-600">{row.deliveredAt}</td>
                <td className="py-3 text-[13px] text-gray-600">{row.deliveryTime}</td>
                <td className="py-3">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-[11px] font-medium ${
                      row.status === 'On Time'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
