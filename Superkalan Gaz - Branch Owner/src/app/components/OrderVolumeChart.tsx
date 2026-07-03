import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useBranchData } from '../hooks/useBranchData';

export function OrderVolumeChart() {
  const branchData = useBranchData();

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Order Volume Trend</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={branchData.orderVolumeData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" stroke="#9ca3af" style={{ fontSize: '12px' }} />
          <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
          <Tooltip />
          <Line type="monotone" dataKey="orders" stroke="#007BC1" strokeWidth={2} dot={{ fill: '#007BC1' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
