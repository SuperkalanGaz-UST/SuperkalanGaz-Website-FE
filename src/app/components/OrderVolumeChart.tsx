import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const data = [
  { id: 'jan', month: 'Jan', quezonCity: 185, calamba: 142, staRosa: 168 },
  { id: 'feb', month: 'Feb', quezonCity: 220, calamba: 178, staRosa: 195 },
  { id: 'mar', month: 'Mar', quezonCity: 195, calamba: 156, staRosa: 182 },
  { id: 'apr', month: 'Apr', quezonCity: 265, calamba: 201, staRosa: 228 },
  { id: 'may', month: 'May', quezonCity: 284, calamba: 218, staRosa: 245 },
];

export function OrderVolumeChart() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-2">Order Volume Trend — All Branches</h3>
      <div className="flex items-center gap-4 mb-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#1A6FBF]"></div>
          <span className="text-gray-600">Quezon City</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#F5A623]"></div>
          <span className="text-gray-600">Calamba</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#27AE60]"></div>
          <span className="text-gray-600">Sta. Rosa</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid key="ov-grid" strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis key="ov-xaxis" dataKey="month" stroke="#9ca3af" style={{ fontSize: '12px' }} />
          <YAxis key="ov-yaxis" stroke="#9ca3af" style={{ fontSize: '12px' }} />
          <Tooltip key="ov-tooltip" />
          <Line key="ov-qc" type="monotone" dataKey="quezonCity" stroke="#1A6FBF" strokeWidth={2} dot={{ fill: '#1A6FBF' }} />
          <Line key="ov-cal" type="monotone" dataKey="calamba" stroke="#F5A623" strokeWidth={2} dot={{ fill: '#F5A623' }} />
          <Line key="ov-sr" type="monotone" dataKey="staRosa" stroke="#27AE60" strokeWidth={2} dot={{ fill: '#27AE60' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}