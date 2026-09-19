import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type Granularity = 'day' | 'hour';

interface DailyOrderVolumeChartProps {
  dailyData: { day: string; orders: number }[];
  hourlyData: { hour: string; orders: number }[];
}

export function DailyOrderVolumeChart({ dailyData, hourlyData }: DailyOrderVolumeChartProps) {
  const [granularity, setGranularity] = useState<Granularity>('day');
  const isDay = granularity === 'day';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">
          {isDay ? 'Daily Order Volume' : 'Hourly Order Volume (Today)'}
        </h3>
        <div className="flex rounded-lg border border-gray-200 p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setGranularity('day')}
            className={`px-3 py-1 rounded-md transition-colors ${
              isDay ? 'bg-[#007BC1] text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Day
          </button>
          <button
            type="button"
            onClick={() => setGranularity('hour')}
            className={`px-3 py-1 rounded-md transition-colors ${
              !isDay ? 'bg-[#007BC1] text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Hour
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={isDay ? dailyData : hourlyData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey={isDay ? 'day' : 'hour'} stroke="#9ca3af" style={{ fontSize: '12px' }} />
          <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
          <Tooltip
            cursor={{ fill: '#f3f4f6' }}
            contentStyle={{ borderRadius: '8px', borderColor: '#e5e7eb', fontSize: '12px' }}
            formatter={(value: number) => [`${value} orders`, isDay ? 'Day' : 'Hour']}
          />
          <Bar dataKey="orders" fill="#007BC1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
