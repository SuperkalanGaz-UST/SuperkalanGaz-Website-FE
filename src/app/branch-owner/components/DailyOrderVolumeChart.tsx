import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { day: 'Mon', orders: 38 },
  { day: 'Tue', orders: 42 },
  { day: 'Wed', orders: 35 },
  { day: 'Thu', orders: 48 },
  { day: 'Fri', orders: 52 },
  { day: 'Sat', orders: 45 },
  { day: 'Sun', orders: 24 },
];

export function DailyOrderVolumeChart() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Daily Order Volume</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="day" stroke="#9ca3af" style={{ fontSize: '12px' }} />
          <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
          <Tooltip />
          <Bar dataKey="orders" fill="#007BC1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
