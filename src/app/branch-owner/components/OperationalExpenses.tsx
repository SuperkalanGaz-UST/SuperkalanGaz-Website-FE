'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
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

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  'Gasoline, Fuel & Oil': '#1e3a5f',
  'Repairs & Maintenance': '#d97706',
  Utilities: '#0d9488',
  Communication: '#0891b2',
  'Branch Supplies': '#7c3aed',
  'Facility Costs': '#e11d48',
};

const CATEGORY_STYLES: Record<ExpenseCategory, string> = {
  'Gasoline, Fuel & Oil': 'bg-blue-100 text-blue-900',
  'Repairs & Maintenance': 'bg-amber-100 text-amber-800',
  Utilities: 'bg-teal-100 text-teal-800',
  Communication: 'bg-cyan-100 text-cyan-800',
  'Branch Supplies': 'bg-violet-100 text-violet-800',
  'Facility Costs': 'bg-rose-100 text-rose-800',
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

function CompactKPICard({ title, value, accentColor }: { title: string; value: string; accentColor: string }) {
  return (
    <div className="flex min-h-24 flex-col rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm" style={{ borderLeft: `4px solid ${accentColor}` }}>
      <div className="mb-2 text-[10px] font-medium uppercase leading-tight tracking-wide text-gray-500">{title}</div>
      <div className="mt-auto text-2xl font-semibold leading-none text-gray-900">{value}</div>
    </div>
  );
}

export function OperationalExpenses() {
  const [months, setMonths] = useState<MonthExpenses[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          setError(loadError instanceof Error ? loadError.message : 'Failed to load expenses');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, []);

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

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="bg-white px-8 py-5">
        <div className="pt-4">
          <h1 className="text-2xl font-semibold text-gray-900">Operational Expenses</h1>
          <p className="mt-1 text-sm text-gray-600">Monitor the operational expenses recorded by your Branch Manager.</p>
        </div>
      </div>

      <div className="space-y-6 p-8">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <CompactKPICard title="Total this month" value={loading ? '—' : formatPeso(currentTotal)} accentColor="#38bdf8" />
          <CompactKPICard title="Fuel & oil" value={loading ? '—' : formatPeso(categoryTotal('Gasoline, Fuel & Oil'))} accentColor="#1e3a5f" />
          <CompactKPICard title="Repairs" value={loading ? '—' : formatPeso(categoryTotal('Repairs & Maintenance'))} accentColor="#d97706" />
          <CompactKPICard title="Utilities & communication" value={loading ? '—' : formatPeso(utilitiesAndCommunication)} accentColor="#0d9488" />
          <CompactKPICard title="Branch supplies" value={loading ? '—' : formatPeso(categoryTotal('Branch Supplies'))} accentColor="#7c3aed" />
          <CompactKPICard title="Facility costs" value={loading ? '—' : formatPeso(categoryTotal('Facility Costs'))} accentColor="#e11d48" />
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Total Expense Trend</h3>
              <p className="mt-1 text-xs text-gray-500">Last six months of recorded branch expenses</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" stroke="#9ca3af" style={{ fontSize: '12px' }} />
              <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} tickFormatter={(value) => `₱${Math.round(Number(value) / 1000)}k`} />
              <Tooltip formatter={(value) => [formatPeso(Number(value)), 'Expenses']} />
              <Line type="monotone" dataKey="amount" stroke="#1e3a5f" strokeWidth={2} dot={{ fill: '#1e3a5f', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="mb-4 font-semibold text-gray-900">Expenses by Category</h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={categoryData} margin={{ top: 4, right: 4, left: 0, bottom: 45 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="category" interval={0} angle={-30} textAnchor="end" height={75} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: '11px' }} tickFormatter={(value) => `₱${Math.round(Number(value) / 1000)}k`} />
                <Tooltip formatter={(value) => [formatPeso(Number(value)), 'Amount']} />
                <Bar dataKey="amount" fill="#1e3a5f" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="mb-4 font-semibold text-gray-900">Expense Distribution</h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 20, left: 42, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="#f3f4f6" />
                <XAxis type="number" hide />
                <YAxis dataKey="category" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#4b5563' }} width={145} />
                <Tooltip formatter={(value) => [formatPeso(Number(value)), 'Amount']} />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={16}>
                  {categoryData.map((entry) => <Cell key={entry.category} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
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
                  <th className="pb-3 pr-4 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500">Date</th>
                  <th className="pb-3 pr-4 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500">Reference no.</th>
                  <th className="pb-3 pr-4 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500">Category</th>
                  <th className="pb-3 pr-4 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500">Description</th>
                  <th className="pb-3 pr-4 text-right text-[11px] font-medium uppercase tracking-wide text-gray-500">Amount</th>
                  <th className="pb-3 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500">Recorded by</th>
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
      </div>
    </div>
  );
}
