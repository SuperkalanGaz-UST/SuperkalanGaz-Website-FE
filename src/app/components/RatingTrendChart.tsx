import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { week: 'Week 1', rating: 4.0 },
  { week: 'Week 2', rating: 4.2 },
  { week: 'Week 3', rating: 4.5 },
  { week: 'Week 4', rating: 4.3 },
];

export function RatingTrendChart() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Average Rating Trend</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid key="rt-grid" strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis key="rt-xaxis" dataKey="week" stroke="#9ca3af" style={{ fontSize: '12px' }} />
          <YAxis key="rt-yaxis" domain={[0, 5]} stroke="#9ca3af" style={{ fontSize: '12px' }} />
          <Tooltip key="rt-tooltip" />
          <Line key="rt-rating" type="monotone" dataKey="rating" stroke="#007BC1" strokeWidth={2} dot={{ fill: '#007BC1', r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}