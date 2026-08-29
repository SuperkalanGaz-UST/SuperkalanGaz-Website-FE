'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ExpenseApiRow,
  EXPENSE_CATEGORIES,
  ExpenseCategory,
  fetchExpenses,
} from '../../lib/expenses';
import { Header } from './Header';
import { KPICard } from './KPICard';
import { Wallet, Fuel, Wrench, Zap, Package, Building2 } from 'lucide-react';

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  'Gasoline, Fuel & Oil': '#007BC1',
  'Repairs & Maintenance': '#41A3E0',
  Utilities: '#2E86C1',
  Communication: '#76B4DD',
  'Branch Supplies': '#AED6F1',
  'Facility Costs': '#1a5f8a',
};

const CATEGORY_STYLES: Record<ExpenseCategory, string> = {
  'Gasoline, Fuel & Oil': 'bg-blue-100 text-blue-900',
  'Repairs & Maintenance': 'bg-sky-100 text-sky-800',
  Utilities: 'bg-cyan-100 text-cyan-800',
  Communication: 'bg-blue-50 text-blue-700',
  'Branch Supplies': 'bg-indigo-100 text-indigo-800',
  'Facility Costs': 'bg-slate-100 text-slate-800',
};

interface MonthExpenses {
  key: string;
  label: string;
  expenses: ExpenseApiRow[];
}

function monthDescriptor(date: Date, offset: number): { key: string; label: string } {
  const value = new Date(date.getFullYear(), date.getMonth() + offset, 1);
  return {
    key: `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`,
    label: new Intl.DateTimeFormat('en-PH', { month: 'short' }).format(value),
  };
}

function formatPeso(value: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

const axisProps = {
  axisLine: false as const,
  tickLine: false as const,
  stroke: '#9ca3af',
};

export function OperationalExpenses() {
  const [months, setMonths] = useState<MonthExpenses[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const descriptors = Array.from({ length: 6 }, (_, index) => monthDescriptor(new Date(), index - 5));

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const results = await Promise.all(
          descriptors.map(async (month) => ({ ...month, expenses: await fetchExpenses(month.key) })),
        );
        if (active) setMonths(results);
      } catch (loadError) {
        if (active) {
          setMonths([]);
          const message = loadError instanceof Error ? loadError.message : 'Failed to load expenses';
          setError(
            message === 'Caller has no active branch'
              ? 'No active branch is assigned to this account. Contact your Franchise Administrator.'
              : message,
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, [loadAttempt]);

  const currentExpenses = useMemo(() => months.at(-1)?.expenses ?? [], [months]);
  const currentTotal = currentExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

  const categoryData = useMemo(
    () => EXPENSE_CATEGORIES.map((category) => ({
      category,
      amount: currentExpenses
        .filter((expense) => expense.category === category)
        .reduce((sum, expense) => sum + Number(expense.amount), 0),
      color: CATEGORY_COLORS[category],
    })),
    [currentExpenses],
  );

  const trendData = months.map((month) => ({
    month: month.label,
    amount: month.expenses.reduce((sum, expense) => sum + Number(expense.amount), 0),
  }));

  const categoryTotal = (category: ExpenseCategory) =>
    categoryData.find((entry) => entry.category === category)?.amount ?? 0;

  const utilitiesAndCommunication = categoryTotal('Utilities') + categoryTotal('Communication');
  const recentExpenses = currentExpenses.slice(0, 6);
  const placeholder = loading ? '—' : '';

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="Operational Expenses" />

      <div className="space-y-6 p-8">
        {error && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setLoadAttempt((attempt) => attempt + 1)}
              className="shrink-0 rounded-md border border-red-300 bg-white px-3 py-1.5 font-medium text-red-700 transition-colors hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        )}

        {!error && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
            <KPICard
              title="Total This Month"
              value={loading ? placeholder : formatPeso(currentTotal)}
              icon={<Wallet className="w-4 h-4 text-[#007BC1]" />}
              accentColor="#007BC1"
            />
            <KPICard
              title="Fuel & Oil"
              value={loading ? placeholder : formatPeso(categoryTotal('Gasoline, Fuel & Oil'))}
              icon={<Fuel className="w-4 h-4 text-[#007BC1]" />}
              accentColor="#007BC1"
            />
            <KPICard
              title="Repairs"
              value={loading ? placeholder : formatPeso(categoryTotal('Repairs & Maintenance'))}
              icon={<Wrench className="w-4 h-4 text-[#007BC1]" />}
              accentColor="#007BC1"
            />
            <KPICard
              title="Utilities & Comms"
              value={loading ? placeholder : formatPeso(utilitiesAndCommunication)}
              icon={<Zap className="w-4 h-4 text-[#2E86C1]" />}
              accentColor="#2E86C1"
            />
            <KPICard
              title="Branch Supplies"
              value={loading ? placeholder : formatPeso(categoryTotal('Branch Supplies'))}
              icon={<Package className="w-4 h-4 text-[#2E86C1]" />}
              accentColor="#2E86C1"
            />
            <KPICard
              title="Facility Costs"
              value={loading ? placeholder : formatPeso(categoryTotal('Facility Costs'))}
              icon={<Building2 className="w-4 h-4 text-[#2E86C1]" />}
              accentColor="#2E86C1"
            />
          </div>
        )}

        {!error && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Total Expense Trend</h3>
                <p className="mt-1 text-xs text-gray-500">Last six months of recorded branch expenses</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="expensesTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#007BC1" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#007BC1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" {...axisProps} style={{ fontSize: '11px' }} tick={{ dy: 4 }} />
                <YAxis {...axisProps} style={{ fontSize: '11px' }} tickFormatter={(value) => `₱${Math.round(Number(value) / 1000)}k`} width={52} />
                <Tooltip formatter={(value) => [formatPeso(Number(value)), 'Expenses']} />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#007BC1"
                  strokeWidth={2}
                  fill="url(#expensesTrendFill)"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {!error && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="mb-4 font-semibold text-gray-900">Expenses by Category</h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={categoryData} margin={{ top: 4, right: 4, left: 0, bottom: 45 }}>
                  <XAxis dataKey="category" interval={0} angle={-30} textAnchor="end" height={75} tick={{ fontSize: 10, fill: '#64748b' }} {...axisProps} />
                  <YAxis {...axisProps} style={{ fontSize: '11px' }} tickFormatter={(value) => `₱${Math.round(Number(value) / 1000)}k`} width={52} />
                  <Tooltip formatter={(value) => [formatPeso(Number(value)), 'Amount']} cursor={{ fill: 'rgba(0, 123, 193, 0.06)' }} />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {categoryData.map((entry) => (
                      <Cell key={entry.category} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="mb-4 font-semibold text-gray-900">Expense Distribution</h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 20, left: 42, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="category" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#4b5563' }} width={145} />
                  <Tooltip formatter={(value) => [formatPeso(Number(value)), 'Amount']} cursor={{ fill: 'rgba(0, 123, 193, 0.06)' }} />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={16}>
                    {categoryData.map((entry) => (
                      <Cell key={entry.category} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {!error && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Expenses Log</h3>
                <p className="mt-1 text-xs text-gray-500">Current month · database records</p>
              </div>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'expenses-log-full' }))}
                className="text-xs font-medium text-[#007BC1] transition-colors hover:text-[#005a8f]"
              >
                View all
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-3 pr-4 text-left text-[11px] font-medium text-gray-600">Date</th>
                    <th className="pb-3 pr-4 text-left text-[11px] font-medium text-gray-600">Reference no.</th>
                    <th className="pb-3 pr-4 text-left text-[11px] font-medium text-gray-600">Category</th>
                    <th className="pb-3 pr-4 text-left text-[11px] font-medium text-gray-600">Description</th>
                    <th className="pb-3 pr-4 text-right text-[11px] font-medium text-gray-600">Amount</th>
                    <th className="pb-3 text-left text-[11px] font-medium text-gray-600">Recorded by</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="py-10 text-center text-sm text-gray-400">Loading expenses…</td></tr>
                  ) : recentExpenses.length === 0 ? (
                    <tr><td colSpan={6} className="py-10 text-center text-sm text-gray-400">No expenses have been recorded this month.</td></tr>
                  ) : recentExpenses.map((expense, index) => (
                    <tr key={expense.id} className={`border-b border-gray-100 ${index % 2 === 1 ? 'bg-gray-50' : ''}`}>
                      <td className="whitespace-nowrap py-3 pr-4 text-[13px] text-gray-900">{formatDate(expense.expense_date)}</td>
                      <td className="whitespace-nowrap py-3 pr-4 font-mono text-[13px] text-gray-900">{expense.reference_no ?? '—'}</td>
                      <td className="whitespace-nowrap py-3 pr-4"><span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${CATEGORY_STYLES[expense.category]}`}>{expense.category}</span></td>
                      <td className="max-w-[260px] truncate py-3 pr-4 text-[13px] text-gray-700">{expense.description}</td>
                      <td className="whitespace-nowrap py-3 pr-4 text-right text-[13px] font-medium text-gray-900">{formatPeso(Number(expense.amount))}</td>
                      <td className="whitespace-nowrap py-3 text-[13px] text-gray-600">Branch Manager</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
