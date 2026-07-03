
const completionData = [
  { month: 'January 2026', totalOrders: 268, completed: 260, completionRate: 97.0, slaBreaches: 8 },
  { month: 'February 2026', totalOrders: 272, completed: 265, completionRate: 97.4, slaBreaches: 7 },
  { month: 'March 2026', totalOrders: 285, completed: 275, completionRate: 96.5, slaBreaches: 10 },
  { month: 'April 2026', totalOrders: 290, completed: 282, completionRate: 97.2, slaBreaches: 8 },
];

export function DeliveryCompletionTable() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Delivery Completion Rate</h3>
        <a href="#" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('navigate', { detail: 'delivery-completion-full' })); }} className="text-[11px] text-[#007BC1] hover:text-[#005a8f] transition-colors">
          View all
        </a>
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
            {completionData.map((row) => (
              <tr key={row.month} className="border-b border-gray-100">
                <td className="py-3 text-[13px] text-gray-900">{row.month}</td>
                <td className="py-3 text-[13px] text-gray-600">{row.totalOrders}</td>
                <td className="py-3 text-[13px] text-gray-600">{row.completed}</td>
                <td className="py-3 text-[13px] font-medium text-gray-900">{row.completionRate}%</td>
                <td className="py-3">
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
    </div>
  );
}
