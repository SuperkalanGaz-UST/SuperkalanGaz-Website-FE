import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useBranchData } from '../hooks/useBranchData';

export function CSATChart() {
  const branchData = useBranchData();

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">CSAT Score Trend</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={branchData.csatTrendData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" stroke="#9ca3af" style={{ fontSize: '12px' }} />
          <YAxis domain={[0, 5]} stroke="#9ca3af" style={{ fontSize: '12px' }} />
          <Tooltip />
          <Bar dataKey="score" fill="#007BC1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
