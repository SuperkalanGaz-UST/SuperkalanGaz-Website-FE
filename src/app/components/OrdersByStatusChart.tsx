import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const data = [
  { name: 'Delivered', value: 94, count: 1634 },
  { name: 'Cancelled', value: 3, count: 55 },
  { name: 'Failed', value: 3, count: 53 },
];

const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

export function OrdersByStatusChart() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Orders by Status — All Branches</h3>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index]} />
            ))}
          </Pie>
          <Tooltip formatter={(value, name, props) => [`${props.payload.count} orders (${value}%)`, name]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-6 mt-4">
        {data.map((entry, index) => (
          <div key={entry.name} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }}></div>
            <span className="text-xs text-gray-600">{entry.name}: {entry.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
