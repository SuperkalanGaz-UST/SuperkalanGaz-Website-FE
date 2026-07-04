import { useState } from 'react';
import { Header } from './Header';
import { KPICard } from './KPICard';
import { ArrowUp } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const monthlyRevenueData = [
  { month: 'Dec', revenue: 198000 },
  { month: 'Jan', revenue: 215000 },
  { month: 'Feb', revenue: 203500 },
  { month: 'Mar', revenue: 241000 },
  { month: 'Apr', revenue: 253800 },
  { month: 'May', revenue: 284500 },
];

const quarterlyRevenueData = [
  { quarter: 'Q4 2025', revenue: 198000 },
  { quarter: 'Q1 2026', revenue: 659500 },
  { quarter: 'Q2 2026', revenue: 538300 },
];

const revenueByTankData = [
  { size: '2.7kg', revenue: 120000 },
  { size: '5kg', revenue: 98500 },
  { size: '11kg', revenue: 66000 },
];

const ordersByTankData = [
  { name: '2.7kg', value: 52, color: '#1e3a5f' },
  { name: '5kg', value: 31, color: '#007BC1' },
  { name: '11kg', value: 17, color: '#76B4DD' },
];

const salesData = [
  { id: '1', date: 'May 2, 2026', receipt: 'RCP-0001', customer: 'Maria Santos', orders: 2, spent: 2200, paid: 'Paid' },
  { id: '2', date: 'May 2, 2026', receipt: 'RCP-0002', customer: 'Juan Dela Cruz', orders: 1, spent: 1100, paid: 'Paid' },
  { id: '3', date: 'May 1, 2026', receipt: 'RCP-0003', customer: 'Pedro Penduko', orders: 3, spent: 3300, paid: 'Unpaid' },
  { id: '4', date: 'May 1, 2026', receipt: 'RCP-0004', customer: 'Lola Basyang', orders: 1, spent: 1100, paid: 'Paid' },
  { id: '5', date: 'May 1, 2026', receipt: 'RCP-0005', customer: 'Carlos Miguel', orders: 2, spent: 2200, paid: 'Paid' },
  { id: '6', date: 'Apr 30, 2026', receipt: 'RCP-0006', customer: 'Ana Reyes', orders: 1, spent: 1100, paid: 'Paid' },
  { id: '7', date: 'Apr 30, 2026', receipt: 'RCP-0007', customer: 'Rita Lopez', orders: 4, spent: 4400, paid: 'Unpaid' },
  { id: '8', date: 'Apr 29, 2026', receipt: 'RCP-0008', customer: 'Sofia Cruz', orders: 2, spent: 2200, paid: 'Paid' },
  { id: '9', date: 'Apr 29, 2026', receipt: 'RCP-0009', customer: 'Ben Reyes', orders: 1, spent: 1100, paid: 'Paid' },
  { id: '10', date: 'Apr 28, 2026', receipt: 'RCP-0010', customer: 'Diana Cruz', orders: 3, spent: 3300, paid: 'Paid' },
  { id: '11', date: 'Apr 28, 2026', receipt: 'RCP-0011', customer: 'Edgar Santos', orders: 2, spent: 2200, paid: 'Unpaid' },
  { id: '12', date: 'Apr 27, 2026', receipt: 'RCP-0012', customer: 'Fiona Reyes', orders: 1, spent: 1100, paid: 'Paid' },
  { id: '13', date: 'Apr 27, 2026', receipt: 'RCP-0013', customer: 'Gabriel Cruz', orders: 2, spent: 2200, paid: 'Paid' },
  { id: '14', date: 'Apr 26, 2026', receipt: 'RCP-0014', customer: 'Helen Lopez', orders: 1, spent: 1100, paid: 'Paid' },
  { id: '15', date: 'Apr 26, 2026', receipt: 'RCP-0015', customer: 'Ivan Santos', orders: 3, spent: 3300, paid: 'Unpaid' },
  { id: '16', date: 'Apr 25, 2026', receipt: 'RCP-0016', customer: 'Julia Reyes', orders: 2, spent: 2200, paid: 'Paid' },
  { id: '17', date: 'Apr 25, 2026', receipt: 'RCP-0017', customer: 'Kevin Cruz', orders: 1, spent: 1100, paid: 'Paid' },
  { id: '18', date: 'Apr 24, 2026', receipt: 'RCP-0018', customer: 'Luna Santos', orders: 2, spent: 2200, paid: 'Paid' },
];

export function SalesOverview() {
  const [chartView, setChartView] = useState<'monthly' | 'quarterly'>('monthly');

  // Limit the table data to only the 5 most recent entries
  const recentSalesData = salesData.slice(0, 5);

  const revenueData = chartView === 'monthly' ? monthlyRevenueData : quarterlyRevenueData;
  const xKey = chartView === 'monthly' ? 'month' : 'quarter';

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header title="Sales" />
      </div>

      <div className="p-8">

        <div className="grid grid-cols-3 gap-6 mb-8">
          <KPICard
            title="Total Revenue This Month"
            value="₱284,500"
            accentColor="#007BC1"
          />
          <KPICard
            title="Total Orders Completed"
            value="274"
            accentColor="#007BC1"
          />
          <KPICard
            title="Revenue vs Last Month"
            value="+12.4%"
            icon={<ArrowUp className="w-5 h-5 text-green-600" />}
            accentColor="#22c55e"
          />
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Monthly Revenue Trend</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setChartView('monthly')}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                  chartView === 'monthly'
                    ? 'bg-[#007BC1] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setChartView('quarterly')}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                  chartView === 'quarterly'
                    ? 'bg-[#007BC1] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Quarterly
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey={xKey} stroke="#9ca3af" style={{ fontSize: '12px' }} />
              <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value) => `₱${Number(value).toLocaleString()}`} />
              <Line type="monotone" dataKey="revenue" stroke="#1e3a5f" strokeWidth={2} dot={{ fill: '#1e3a5f', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Revenue by LPG Tank Size</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={revenueByTankData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="size" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => `₱${Number(value).toLocaleString()}`} />
                <Bar dataKey="revenue" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Orders by Tank Size</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={ordersByTankData}
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {ordersByTankData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value, entry: any) => `${value} - ${entry.payload.value}%`}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-gray-900">Sales</h3>
            <a 
              href="#" 
              onClick={(e) => { 
                e.preventDefault(); 
                window.dispatchEvent(new CustomEvent('navigate', { detail: 'sales-full' })); 
              }} 
              className="text-[11px] text-[#007BC1] hover:text-[#005a8f] transition-colors"
            >
              View all
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Order Date</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Receipt No.</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Customer</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Total Orders</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Cash Received</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Paid</th>
                </tr>
              </thead>
              <tbody>
                {recentSalesData.map((row, index) => (
                  <tr key={row.id} className={`border-b border-gray-100 ${index % 2 === 1 ? 'bg-gray-50' : ''}`}>
                    <td className="py-3 text-[13px] text-gray-900 whitespace-nowrap">{row.date}</td>
                    <td className="py-3 text-[13px] text-gray-900 whitespace-nowrap font-mono">{row.receipt}</td>
                    <td className="py-3 text-[13px] text-gray-900 whitespace-nowrap">{row.customer}</td>
                    <td className="py-3 text-[13px] text-gray-600 whitespace-nowrap">{row.orders}</td>
                    <td className="py-3 text-[13px] text-gray-900 whitespace-nowrap">₱{row.spent.toLocaleString()}</td>
                    <td className="py-3">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-[11px] font-medium ${
                          row.paid === 'Paid'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {row.paid}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}