import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChevronDown } from 'lucide-react';

const data = [
  { id: 'mon', day: 'Mon', orders: 38 },
  { id: 'tue', day: 'Tue', orders: 42 },
  { id: 'wed', day: 'Wed', orders: 35 },
  { id: 'thu', day: 'Thu', orders: 48 },
  { id: 'fri', day: 'Fri', orders: 52 },
  { id: 'sat', day: 'Sat', orders: 45 },
  { id: 'sun', day: 'Sun', orders: 24 },
];

export function DailyOrderVolumeChart() {
  const [selectedBranch, setSelectedBranch] = useState('All Branches');
  const [isOpen, setIsOpen] = useState(false);

  const branches = ['All Branches', 'Quezon City', 'Calamba', 'Sta. Rosa'];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Daily Order Volume — All Branches</h3>
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
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid key="dov-grid" strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis key="dov-xaxis" dataKey="day" stroke="#9ca3af" style={{ fontSize: '12px' }} />
          <YAxis key="dov-yaxis" stroke="#9ca3af" style={{ fontSize: '12px' }} />
          <Tooltip key="dov-tooltip" />
          <Bar key="dov-orders" dataKey="orders" fill="#007BC1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}