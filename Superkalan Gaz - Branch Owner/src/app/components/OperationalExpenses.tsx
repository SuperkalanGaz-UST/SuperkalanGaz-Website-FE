import { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';

// ─── Data ────────────────────────────────────────────────────────────────────

const monthlyTrendData = [
  { month: 'Dec', amount: 182000 },
  { month: 'Jan', amount: 187500 },
  { month: 'Feb', amount: 184200 },
  { month: 'Mar', amount: 191800 },
  { month: 'Apr', amount: 195300 },
  { month: 'May', amount: 181000 },
];

const quarterlyTrendData = [
  { quarter: 'Q4 2025', amount: 182000 },
  { quarter: 'Q1 2026', amount: 563500 },
  { quarter: 'Q2 2026', amount: 376300 },
];

const categoryBarData = [
  { category: 'Purchases',                  shortLabel: 'Purchases',  amount: 105000 },
  { category: 'Gasoline,\nFuel & Oil',      shortLabel: 'Gas/Oil',    amount: 13500 },
  { category: 'Repairs &\nMaintenance',     shortLabel: 'Repairs',    amount: 9500  },
  { category: 'Salaries & Wages',           shortLabel: 'Salary',     amount: 21000 },
  { category: 'Incentives',                 shortLabel: 'Incentives', amount: 4000  },
  { category: '13th Month\nPay',            shortLabel: '13th Mo.',   amount: 3000  },
  { category: 'Gov\'t\nBenefits',           shortLabel: 'Gov\'t Ben.',amount: 4000  },
  { category: 'Utilities',                  shortLabel: 'Utilities',  amount: 6000  },
  { category: 'Communication',              shortLabel: 'Comms',      amount: 3000  },
  { category: 'Rental',                     shortLabel: 'Rental',     amount: 10000 },
  { category: 'Taxes &\nLicenses',          shortLabel: 'Taxes',      amount: 7000  },
];

const donutData = [
  { name: 'Purchases',                     value: 58, color: '#38bdf8' }, 
  { name: 'Gasoline, Fuel & Oil',          value: 7,  color: '#1e3a5f' },
  { name: 'Repairs & Maintenance',         value: 5,  color: '#d97706' },
  { name: 'Salaries & Wages',              value: 11, color: '#16a34a' },
  { name: 'Incentives',                    value: 2,  color: '#65a30d' },
  { name: '13th Month Pay',                value: 2,  color: '#059669' },
  { name: 'Government Benefits',           value: 2,  color: '#15803d' },
  { name: 'Utilities',                     value: 3,  color: '#0d9488' },
  { name: 'Communication',                 value: 2,  color: '#0891b2' },
  { name: 'Rental',                        value: 5,  color: '#7c3aed' },
  { name: 'Taxes & Licenses',              value: 3,  color: '#dc2626' },
];

type Category =
  | 'Purchases'
  | 'Gasoline, Fuel & Oil'
  | 'Repairs & Maintenance'
  | 'Salaries & Wages'
  | 'Incentives'
  | '13th Month Pay'
  | 'Government Mandated Benefits'
  | 'Utilities'
  | 'Communication'
  | 'Rental'
  | 'Taxes & Licenses';

interface ExpenseRow {
  id: string;
  date: string;
  refNo: string;
  category: Category;
  description: string;
  amount: number;
  recordedBy: string;
  month: string;
}

const expensesLog: ExpenseRow[] = [
  { id: '0',  date: 'May 6, 2026',  refNo: 'PUR-2026-001', category: 'Purchases',                 description: 'LPG Stock Purchase from Main Plant (150 units)', amount: 105000,recordedBy: 'Branch Manager: J. Reyes', month: 'May' },
  { id: '1',  date: 'May 5, 2026',  refNo: 'EXP-0001', category: 'Gasoline, Fuel & Oil',          description: 'Gasoline refill for 3 delivery riders',    amount: 2800,  recordedBy: 'Branch Manager: J. Reyes', month: 'May' },
  { id: '2',  date: 'May 5, 2026',  refNo: 'EXP-0002', category: 'Gasoline, Fuel & Oil',          description: 'Fuel refill — plate XYZ-9876',              amount: 1200,  recordedBy: 'Branch Manager: J. Reyes', month: 'May' },
  { id: '3',  date: 'May 4, 2026',  refNo: 'EXP-0003', category: 'Repairs & Maintenance',         description: 'Oil change — plate NCD-1234',               amount: 950,   recordedBy: 'Branch Manager: J. Reyes', month: 'May' },
  { id: '4',  date: 'May 4, 2026',  refNo: 'EXP-0004', category: 'Repairs & Maintenance',         description: 'Tire replacement — plate ABC-1122',         amount: 3800,  recordedBy: 'Branch Manager: J. Reyes', month: 'May' },
  { id: '5',  date: 'May 3, 2026',  refNo: 'EXP-0005', category: 'Salaries & Wages',              description: 'Monthly salary — J. Reyes',                 amount: 10500, recordedBy: 'Branch Manager: J. Reyes', month: 'May' },
  { id: '6',  date: 'May 3, 2026',  refNo: 'EXP-0006', category: 'Salaries & Wages',              description: 'Monthly salary — R. Cruz',                  amount: 10500, recordedBy: 'Branch Manager: J. Reyes', month: 'May' },
  { id: '7',  date: 'May 2, 2026',  refNo: 'EXP-0007', category: 'Utilities',                     description: 'Electricity bill — May 2026',               amount: 4200,  recordedBy: 'Branch Manager: J. Reyes', month: 'May' },
  { id: '8',  date: 'May 2, 2026',  refNo: 'EXP-0008', category: 'Communication',                 description: 'Internet subscription — May 2026',          amount: 1800,  recordedBy: 'Branch Manager: J. Reyes', month: 'May' },
  { id: '9',  date: 'May 1, 2026',  refNo: 'EXP-0009', category: 'Rental',                        description: 'Monthly branch space rental — May 2026',    amount: 10000, recordedBy: 'Branch Manager: J. Reyes', month: 'May' },
  { id: '10', date: 'May 1, 2026',  refNo: 'EXP-0010', category: 'Taxes & Licenses',              description: 'LTO registration — plate NCD-1234',         amount: 3500,  recordedBy: 'Branch Manager: J. Reyes', month: 'May' },
  { id: '11', date: 'May 1, 2026',  refNo: 'EXP-0011', category: 'Incentives',                    description: 'Rider performance bonus — April 2026',      amount: 4000,  recordedBy: 'Branch Manager: J. Reyes', month: 'May' },
  { id: '12', date: 'Apr 30, 2026', refNo: 'EXP-0012', category: 'Salaries & Wages',             description: 'Rider allowance disbursement',              amount: 5000,  recordedBy: 'Branch Manager: J. Reyes', month: 'April' },
  { id: '13', date: 'Apr 29, 2026', refNo: 'EXP-0013', category: 'Gasoline, Fuel & Oil',          description: 'Gasoline refill for 3 riders',              amount: 2600,  recordedBy: 'Branch Manager: J. Reyes', month: 'April' },
  { id: '14', date: 'Apr 28, 2026', refNo: 'EXP-0014', category: 'Government Mandated Benefits',  description: 'SSS/PhilHealth/Pag-IBIG remittance — Apr', amount: 4000,  recordedBy: 'Branch Manager: J. Reyes', month: 'April' },
  { id: '15', date: 'Apr 27, 2026', refNo: 'EXP-0015', category: 'Utilities',                     description: 'Water bill — April 2026',                   amount: 1800,  recordedBy: 'Branch Manager: J. Reyes', month: 'April' },
  { id: '16', date: 'Apr 26, 2026', refNo: 'EXP-0016', category: 'Taxes & Licenses',              description: 'Business permit renewal — Q2 2026',         amount: 3500,  recordedBy: 'Branch Manager: J. Reyes', month: 'April' },
  { id: '17', date: 'Apr 25, 2026', refNo: 'EXP-0017', category: 'Rental',                        description: 'Monthly branch space rental — April 2026',  amount: 10000, recordedBy: 'Branch Manager: J. Reyes', month: 'April' },
  { id: '18', date: 'Mar 31, 2026', refNo: 'EXP-0018', category: 'Gasoline, Fuel & Oil',          description: 'Fuel refill — plate XYZ-9876',              amount: 1650,  recordedBy: 'Branch Manager: J. Reyes', month: 'March' },
  { id: '19', date: 'Mar 30, 2026', refNo: 'EXP-0019', category: 'Repairs & Maintenance',         description: 'Oil change — plate NCD-1234',               amount: 950,   recordedBy: 'Branch Manager: J. Reyes', month: 'March' },
  { id: '20', date: 'Mar 29, 2026', refNo: 'EXP-0020', category: '13th Month Pay',                description: 'Pro-rated 13th month accrual — Mar 2026',  amount: 3000,  recordedBy: 'Branch Manager: J. Reyes', month: 'March' },
  { id: '21', date: 'Feb 28, 2026', refNo: 'EXP-0021', category: 'Salaries & Wages',          description: 'Monthly salary — J. Reyes',                 amount: 10500, recordedBy: 'Branch Manager: J. Reyes', month: 'February' },
  { id: '22', date: 'Jan 31, 2026', refNo: 'EXP-0022', category: 'Utilities',                     description: 'Electricity bill — January 2026',           amount: 4500,  recordedBy: 'Branch Manager: J. Reyes', month: 'January' },
  { id: '23', date: 'Dec 31, 2025', refNo: 'EXP-0023', category: 'Gasoline, Fuel & Oil',          description: 'Gasoline refill for 3 riders',              amount: 1600,  recordedBy: 'Branch Manager: J. Reyes', month: 'December' },
  { id: '24', date: 'Dec 30, 2025', refNo: 'EXP-0024', category: 'Repairs & Maintenance',         description: 'Tire replacement — plate ABC-1122',         amount: 3600,  recordedBy: 'Branch Manager: J. Reyes', month: 'December' },
];

const categoryPillStyle: Record<Category, string> = {
  'Purchases':                     'bg-sky-100 text-sky-700 border border-sky-200',
  'Gasoline, Fuel & Oil':          'bg-[#dbeafe] text-[#1e3a5f]',
  'Repairs & Maintenance':         'bg-amber-100 text-amber-800',
  'Salaries & Wages':           'bg-green-100 text-green-800',
  'Incentives':                    'bg-lime-100 text-lime-800',
  '13th Month Pay':                'bg-emerald-100 text-emerald-800',
  'Government Mandated Benefits':  'bg-green-200 text-green-900',
  'Utilities':                     'bg-teal-100 text-teal-800',
  'Communication':                 'bg-cyan-100 text-cyan-800',
  'Rental':                        'bg-purple-100 text-purple-800',
  'Taxes & Licenses':              'bg-red-100 text-red-700',
};

// ─── Compact KPI Card ─────────────────────────────────────────────────────────

function CompactKPICard({ title, value, accentColor = '#007BC1' }: { title: string; value: string; accentColor?: string }) {
  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col transition-shadow hover:shadow-sm"
      style={{ borderLeft: `4px solid ${accentColor}` }}
    >
      <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-2 leading-tight">{title}</div>
      <div className="text-2xl font-semibold text-gray-900 leading-none mt-auto">{value}</div>
    </div>
  );
}

// ─── Custom bar label (rotated short label) ───────────────────────────────────

function CustomXAxisTick({ x, y, payload }: any) {
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={12}
        textAnchor="end"
        fill="#9ca3af"
        fontSize={10}
        transform="rotate(-35)"
      >
        {payload.value}
      </text>
    </g>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OperationalExpenses() {
  const [chartView, setChartView] = useState<'monthly' | 'quarterly'>('monthly');

  const recentExpenses = expensesLog.slice(0, 6);
  const trendData = chartView === 'monthly' ? monthlyTrendData : quarterlyTrendData;
  const xKey = chartView === 'monthly' ? 'month' : 'quarter';
  const barChartData = categoryBarData.map(d => ({ ...d, xLabel: d.shortLabel }));

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="bg-white px-8 py-5">
        <div className="pt-4">
          <h1 className="text-2xl font-semibold text-gray-900">Operational Expenses</h1>
          <p className="text-sm text-gray-600 mt-1">Track and monitor branch operational costs and stock purchases.</p>
        </div>
      </div>

      <div className="p-8 space-y-6">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          <CompactKPICard title="Total Outflow This Month" value="₱181,000" accentColor="#38bdf8" />
          <CompactKPICard title="Purchases"                value="₱105,000" accentColor="#38bdf8" />
          <CompactKPICard title="Gasoline, Fuel & Oil"      value="₱13,500"  accentColor="#1e3a5f" />
          <CompactKPICard title="Salaries & Compensation"   value="₱32,000"  accentColor="#16a34a" />
          <CompactKPICard title="Utilities & Communication" value="₱9,000"   accentColor="#0d9488" />
          <CompactKPICard title="Fixed Costs & Others"      value="₱11,500"  accentColor="#7c3aed" />
        </div>

        {/* Trend Chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-gray-900">Total Expense Trend</h3>
            <div className="flex gap-2">
              {(['monthly', 'quarterly'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setChartView(v)}
                  className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                    chartView === v
                      ? 'bg-[#007BC1] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey={xKey} stroke="#9ca3af" style={{ fontSize: '12px' }} />
              <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => [`₱${Number(v).toLocaleString()}`, 'Expenses']} />
              <Line type="monotone" dataKey="amount" stroke="#1e3a5f" strokeWidth={2} dot={{ fill: '#1e3a5f', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Category Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart — Fixed to Navy Blue for Purchases */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Expenses by Category</h3>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={barChartData} margin={{ top: 4, right: 4, left: 0, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="xLabel" tick={<CustomXAxisTick />} interval={0} />
                <YAxis stroke="#9ca3af" style={{ fontSize: '11px' }} tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.category?.replace('\n', ' ') ?? ''}
                  formatter={(v) => [`₱${Number(v).toLocaleString()}`, 'Amount']}
                />
                {/* Single navy fill for visual uniformity in this graph */}
                <Bar dataKey="amount" fill="#1e3a5f" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Distribution Chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Expense Distribution</h3>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart
                data={[...donutData].sort((a, b) => b.value - a.value)} 
                layout="vertical"
                margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f9fafb" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#4b5563' }}
                  width={140}
                />
                <Tooltip 
                  cursor={{ fill: '#f3f4f6' }}
                  formatter={(value: number) => [`${value}%`, 'Share']}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                  {[...donutData].sort((a, b) => b.value - a.value).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expenses Log Widget */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-gray-900">Expenses Log</h3>
            <a 
              href="#" 
              onClick={(e) => { 
                e.preventDefault(); 
                window.dispatchEvent(new CustomEvent('navigate', { detail: 'expenses-log-full' })); 
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
                  <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide pb-3 pr-4">Date</th>
                  <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide pb-3 pr-4">Reference No.</th>
                  <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide pb-3 pr-4">Category</th>
                  <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide pb-3 pr-4">Description</th>
                  <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide pb-3 pr-4">Amount</th>
                  <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide pb-3">Recorded By</th>
                </tr>
              </thead>
              <tbody>
                {recentExpenses.map((row, idx) => (
                  <tr key={row.id} className={`border-b border-gray-100 ${idx % 2 === 1 ? 'bg-gray-50' : ''}`}>
                    <td className="py-3 pr-4 text-[13px] text-gray-900 whitespace-nowrap">{row.date}</td>
                    <td className="py-3 pr-4 text-[13px] text-gray-900 whitespace-nowrap font-mono">{row.refNo}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium ${categoryPillStyle[row.category]}`}>
                        {row.category}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-[13px] text-gray-700 max-w-[240px] truncate">{row.description}</td>
                    <td className="py-3 pr-4 text-[13px] text-gray-900 whitespace-nowrap font-medium">
                      ₱{row.amount.toLocaleString()}
                    </td>
                    <td className="py-3 text-[13px] text-gray-600 whitespace-nowrap">{row.recordedBy}</td>
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