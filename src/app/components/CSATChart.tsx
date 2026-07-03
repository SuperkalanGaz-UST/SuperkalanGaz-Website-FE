import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { id: 'jan', month: 'Jan', quezonCity: 4.0, calamba: 4.2, staRosa: 3.9 },
  { id: 'feb', month: 'Feb', quezonCity: 4.2, calamba: 4.3, staRosa: 4.1 },
  { id: 'mar', month: 'Mar', quezonCity: 4.5, calamba: 4.4, staRosa: 4.3 },
  { id: 'apr', month: 'Apr', quezonCity: 4.1, calamba: 4.0, staRosa: 4.2 },
  { id: 'may', month: 'May', quezonCity: 4.3, calamba: 4.1, staRosa: 3.9 },
];

export function CSATChart() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-2">CSAT Score Trend — All Branches</h3>
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
        <BarChart data={data} barGap={2}>
          <CartesianGrid key="csat-grid" strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis key="csat-xaxis" dataKey="month" stroke="#9ca3af" style={{ fontSize: '12px' }} />
          <YAxis key="csat-yaxis" domain={[0, 5]} stroke="#9ca3af" style={{ fontSize: '12px' }} />
          <Tooltip key="csat-tooltip" />
          <Bar key="csat-qc" dataKey="quezonCity" fill="#1A6FBF" radius={[4, 4, 0, 0]} />
          <Bar key="csat-cal" dataKey="calamba" fill="#F5A623" radius={[4, 4, 0, 0]} />
          <Bar key="csat-sr" dataKey="staRosa" fill="#27AE60" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}