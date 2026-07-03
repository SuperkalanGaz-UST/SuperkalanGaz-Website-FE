import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const completionData = [
  { branch: 'Quezon City', month: 'January 2026', totalOrders: 268, completed: 260, completionRate: 97.0, slaBreaches: 8 },
  { branch: 'Calamba', month: 'January 2026', totalOrders: 241, completed: 229, completionRate: 95.0, slaBreaches: 14 },
  { branch: 'Sta. Rosa', month: 'January 2026', totalOrders: 255, completed: 248, completionRate: 97.3, slaBreaches: 6 },
  { branch: 'Quezon City', month: 'February 2026', totalOrders: 272, completed: 265, completionRate: 97.4, slaBreaches: 7 },
];

export function DeliveryCompletionTable() {
  const [selectedBranch, setSelectedBranch] = useState('All Branches');
  const [isOpen, setIsOpen] = useState(false);

  const branches = ['All Branches', 'Quezon City', 'Calamba', 'Sta. Rosa'];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Delivery Completion Rate</h3>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {selectedBranch}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {isOpen && (
              <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                {branches.map((branch) => (
                  <button
                    key={branch}
                    onClick={() => {
                      setSelectedBranch(branch);
                      setIsOpen(false);
                    }}
                    className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                  >
                    {branch}
                  </button>
                ))}
              </div>
            )}
          </div>
          <a href="#" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('navigate', { detail: 'delivery-completion-full' })); }} className="text-[11px] text-[#007BC1] hover:text-[#005a8f] transition-colors">
            View all
          </a>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Branch</th>
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Month</th>
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Total Orders</th>
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Completed</th>
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Completion Rate %</th>
              <th className="text-left text-[11px] font-medium text-gray-600 pb-3">SLA Breaches</th>
            </tr>
          </thead>
          <tbody>
            {completionData.map((row, idx) => (
              <tr key={idx} className="border-b border-gray-100">
                <td className="py-3 text-[13px] text-gray-900">{row.branch}</td>
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
