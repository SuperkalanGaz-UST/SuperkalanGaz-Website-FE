
const complaintData = [
  {
    complaintId: 'CMP-001',
    customer: 'Pedro Penduko',
    issueSummary: 'Late delivery - order arrived 1 hour past scheduled time',
    status: 'Resolved',
    responseTime: '2 hrs'
  },
  {
    complaintId: 'CMP-002',
    customer: 'Ana Reyes',
    issueSummary: 'Wrong LPG tank size delivered',
    status: 'Pending',
    responseTime: '45 mins'
  },
  {
    complaintId: 'CMP-003',
    customer: 'Carlos Miguel',
    issueSummary: 'Rider did not call upon arrival',
    status: 'Resolved',
    responseTime: '1.5 hrs'
  },
  {
    complaintId: 'CMP-004',
    customer: 'Sofia Cruz',
    issueSummary: 'Payment receipt not provided',
    status: 'Pending',
    responseTime: '30 mins'
  },
];

export function ComplaintLogTable() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Complaint Log</h3>
        <a href="#" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('navigate', { detail: 'complaint-log-full' })); }} className="text-[11px] text-[#007BC1] hover:text-[#005a8f] transition-colors">
          View all
        </a>
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
            {complaintData.map((row) => (
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
    </div>
  );
}
