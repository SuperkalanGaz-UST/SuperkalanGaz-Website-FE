
const reorderData = [
  {
    requestId: 'ROR-105',
    dateRequested: 'Apr 28, 2026',
    qtyRequested: 50,
    requestedBy: 'Branch Manager: J. Reyes',
    status: 'Fulfilled',
    fulfilledDate: 'Apr 30, 2026'
  },
  {
    requestId: 'ROR-104',
    dateRequested: 'Apr 20, 2026',
    qtyRequested: 40,
    requestedBy: 'Branch Manager: J. Reyes',
    status: 'Fulfilled',
    fulfilledDate: 'Apr 22, 2026'
  },
  {
    requestId: 'ROR-103',
    dateRequested: 'Apr 18, 2026',
    qtyRequested: 35,
    requestedBy: 'Branch Manager: J. Reyes',
    status: 'Pending',
    fulfilledDate: '-'
  },
  {
    requestId: 'ROR-102',
    dateRequested: 'Apr 12, 2026',
    qtyRequested: 45,
    requestedBy: 'Branch Manager: J. Reyes',
    status: 'Fulfilled',
    fulfilledDate: 'Apr 14, 2026'
  },
  {
    requestId: 'ROR-101',
    dateRequested: 'Apr 5, 2026',
    qtyRequested: 50,
    requestedBy: 'Branch Manager: J. Reyes',
    status: 'Fulfilled',
    fulfilledDate: 'Apr 7, 2026'
  },
];

export function ReorderRequestLog() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Reorder Request Log</h3>
        <a href="#" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('navigate', { detail: 'reorder-log-full' })); }} className="text-[11px] text-[#007BC1] hover:text-[#005a8f] transition-colors">
          View all
        </a>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Request ID</th>
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Date Requested</th>
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Qty Requested</th>
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Requested By</th>
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Status</th>
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Fulfilled Date</th>
            </tr>
          </thead>
          <tbody>
            {reorderData.map((row) => (
              <tr key={row.requestId} className="border-b border-gray-100">
                <td className="py-3 text-[13px] text-gray-900">{row.requestId}</td>
                <td className="py-3 text-[13px] text-gray-600">{row.dateRequested}</td>
                <td className="py-3 text-[13px] text-gray-600">{row.qtyRequested} cylinders</td>
                <td className="py-3 text-[13px] text-gray-600">{row.requestedBy}</td>
                <td className="py-3">
                  <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-medium ${
                    row.status === 'Fulfilled'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {row.status}
                  </span>
                </td>
                <td className="py-3 text-[13px] text-gray-600">{row.fulfilledDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
