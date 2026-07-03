const redemptionData = [
  {
    customer: "Maria Santos",
    redemptionDate: "Apr 30, 2026",
    approvedBy: "Branch Manager: J. Reyes",
    status: "Approved",
  },
  {
    customer: "Lola Basyang",
    redemptionDate: "Apr 28, 2026",
    approvedBy: "Branch Manager: J. Reyes",
    status: "Approved",
  },
  {
    customer: "Carlos Miguel",
    redemptionDate: "Apr 25, 2026",
    approvedBy: "Branch Manager: J. Reyes",
    status: "Approved",
  },
  {
    customer: "Rita Lopez",
    redemptionDate: "Apr 20, 2026",
    approvedBy: "Branch Manager: J. Reyes",
    status: "Approved",
  },
];

export function RedemptionHistory() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">
          Redemption History
        </h3>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            window.dispatchEvent(
              new CustomEvent("navigate", {
                detail: "redemption-history-full",
              }),
            );
          }}
          className="text-[11px] text-[#007BC1] hover:text-[#005a8f] transition-colors"
        >
          View all
        </a>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3">
                Customer Name
              </th>
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3">
                Redemption Date
              </th>
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3">
                Approved By
              </th>
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {redemptionData.map((row, index) => (
              <tr
                key={index}
                className="border-b border-gray-100"
              >
                <td className="py-3 text-[13px] text-gray-900">
                  {row.customer}
                </td>
                <td className="py-3 text-[13px] text-gray-600">
                  {row.redemptionDate}
                </td>
                <td className="py-3 text-[13px] text-gray-600">
                  {row.approvedBy}
                </td>
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
    </div>
  );
}