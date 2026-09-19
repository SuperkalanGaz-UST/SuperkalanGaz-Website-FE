'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
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
import { Select } from './Select';
import { Wallet, Fuel, Wrench, Zap, Package, Building2 } from 'lucide-react';

const TREND_CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  ...EXPENSE_CATEGORIES.map((category) => ({ value: category, label: category })),
];

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
  const queryClient = useQueryClient();

  const descriptors = useMemo(() => Array.from({ length: 6 }, (_, index) => monthDescriptor(new Date(), index - 5)), []);

  const {
    data: monthsData,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ['expenses-6-months', descriptors.map(d => d.key)],
    queryFn: async () => {
      return await Promise.all(
        descriptors.map(async (month) => ({ ...month, expenses: await fetchExpenses(month.key) })),
      );
    },
    staleTime: 30_000,
  });

  const months = useMemo(() => monthsData ?? [], [monthsData]);
  const error = queryError ? 
    (queryError.message === 'Caller has no active branch' 
      ? 'No active branch is assigned to this account. Contact your Franchise Administrator.' 
      : (queryError.message || 'Failed to load expenses')) 
    : null;

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

  const [trendGranularity, setTrendGranularity] = useState<'month' | 'week' | 'day'>('month');
  const [trendCategory, setTrendCategory] = useState<'all' | ExpenseCategory>('all');

  const monthlyTrendData = useMemo(
    () => months.map((month) => ({
      label: month.label,
      amount: month.expenses
        .filter((expense) => trendCategory === 'all' || expense.category === trendCategory)
        .reduce((sum, expense) => sum + Number(expense.amount), 0),
    })),
    [months, trendCategory],
  );

  // Weekly (ISO, Monday-start) buckets across the full 6-month window already
  // in memory — no new fetch, same re-derive-from-what-we-have approach as Day.
  const weeklyTrendData = useMemo(() => {
    const byWeek = new Map<string, { weekStart: Date; amount: number }>();
    for (const month of months) {
      for (const expense of month.expenses) {
        if (trendCategory !== 'all' && expense.category !== trendCategory) continue;
        const [year, monthNum, day] = expense.expense_date.split('-').map(Number);
        const date = new Date(year, monthNum - 1, day);
        const isoWeekday = date.getDay() === 0 ? 7 : date.getDay();
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - (isoWeekday - 1));
        const key = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
        const existing = byWeek.get(key) ?? { weekStart, amount: 0 };
        existing.amount += Number(expense.amount);
        byWeek.set(key, existing);
      }
    }
    return [...byWeek.values()]
      .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
      .map((entry) => ({
        label: new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(entry.weekStart),
        amount: entry.amount,
      }));
  }, [months, trendCategory]);

  // "Zoomed in" view: always the current (latest fetched) month's day-by-day
  // totals — mirrors the Order Volume chart's Hour view always meaning today.
  const dailyTrendData = useMemo(() => {
    const currentMonth = months.at(-1);
    if (!currentMonth) return [];
    const [year, month] = currentMonth.key.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const byDay = new Map<string, number>();
    for (const expense of currentMonth.expenses) {
      if (trendCategory !== 'all' && expense.category !== trendCategory) continue;
      byDay.set(expense.expense_date, (byDay.get(expense.expense_date) ?? 0) + Number(expense.amount));
    }
    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { label: String(day), amount: byDay.get(dateKey) ?? 0 };
    });
  }, [months, trendCategory]);

  const trendData = trendGranularity === 'month' ? monthlyTrendData
    : trendGranularity === 'week' ? weeklyTrendData
    : dailyTrendData;
  const trendSubtitle = [
    trendGranularity === 'month' ? 'Last six months'
      : trendGranularity === 'week' ? 'Weekly totals over the last six months'
      : `Daily breakdown for ${months.at(-1)?.label ?? 'this month'}`,
    trendCategory === 'all' ? null : trendCategory,
  ].filter(Boolean).join(' — ');

  const categoryTotal = (category: ExpenseCategory) =>
    categoryData.find((entry) => entry.category === category)?.amount ?? 0;

  const utilitiesAndCommunication = categoryTotal('Utilities') + categoryTotal('Communication');
  const recentExpenses = currentExpenses.slice(0, 6);
  const placeholder = loading ? '—' : '';

  const pctOfTotal = (amount: number) =>
    currentTotal > 0 ? `${((amount / currentTotal) * 100).toFixed(1)}% of this month's total` : 'No expenses recorded yet';

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="Operational Expenses" />

      <div className="space-y-6 p-8">
        {error && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void queryClient.invalidateQueries({ queryKey: ['expenses-6-months'] })}
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
              titleClassName="min-h-[40px]"
              tooltip={loading ? undefined : <span>{currentExpenses.length} transactions recorded this month</span>}
            />
            <KPICard
              title="Fuel & Oil"
              value={loading ? placeholder : formatPeso(categoryTotal('Gasoline, Fuel & Oil'))}
              icon={<Fuel className="w-4 h-4 text-[#007BC1]" />}
              accentColor="#007BC1"
              titleClassName="min-h-[40px]"
              tooltip={loading ? undefined : <span>{pctOfTotal(categoryTotal('Gasoline, Fuel & Oil'))}</span>}
            />
            <KPICard
              title="Repairs"
              value={loading ? placeholder : formatPeso(categoryTotal('Repairs & Maintenance'))}
              icon={<Wrench className="w-4 h-4 text-[#007BC1]" />}
              accentColor="#007BC1"
              titleClassName="min-h-[40px]"
              tooltip={loading ? undefined : <span>{pctOfTotal(categoryTotal('Repairs & Maintenance'))}</span>}
            />
            <KPICard
              title="Utilities & Comms"
              value={loading ? placeholder : formatPeso(utilitiesAndCommunication)}
              icon={<Zap className="w-4 h-4 text-[#2E86C1]" />}
              accentColor="#2E86C1"
              titleClassName="min-h-[40px]"
              tooltip={loading ? undefined : <span>{pctOfTotal(utilitiesAndCommunication)}</span>}
            />
            <KPICard
              title="Branch Supplies"
              value={loading ? placeholder : formatPeso(categoryTotal('Branch Supplies'))}
              icon={<Package className="w-4 h-4 text-[#2E86C1]" />}
              accentColor="#2E86C1"
              titleClassName="min-h-[40px]"
              tooltip={loading ? undefined : <span>{pctOfTotal(categoryTotal('Branch Supplies'))}</span>}
            />
            <KPICard
              title="Facility Costs"
              value={loading ? placeholder : formatPeso(categoryTotal('Facility Costs'))}
              icon={<Building2 className="w-4 h-4 text-[#2E86C1]" />}
              accentColor="#2E86C1"
              titleClassName="min-h-[40px]"
              tooltip={loading ? undefined : <span>{pctOfTotal(categoryTotal('Facility Costs'))}</span>}
            />
          </div>
        )}

        {!error && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-gray-900">Total Expense Trend</h3>
                <p className="mt-1 text-xs text-gray-500">{trendSubtitle}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Select
                  value={trendCategory}
                  onChange={(value) => setTrendCategory(value as 'all' | ExpenseCategory)}
                  options={TREND_CATEGORY_OPTIONS}
                  className="w-48"
                />
                <div className="flex rounded-lg border border-gray-200 p-0.5 text-sm">
                  {(['day', 'week', 'month'] as const).map((granularity) => (
                    <button
                      key={granularity}
                      type="button"
                      onClick={() => setTrendGranularity(granularity)}
                      className={`px-3 py-1 rounded-md capitalize transition-colors ${
                        trendGranularity === granularity ? 'bg-[#007BC1] text-white' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {granularity}
                    </button>
                  ))}
                </div>
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
                <XAxis dataKey="label" {...axisProps} style={{ fontSize: '11px' }} tick={{ dy: 4 }} />
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
                    <th className="pb-3 pr-4 text-left text-xs font-semibold text-gray-700">Date</th>
                    <th className="pb-3 pr-4 text-left text-xs font-semibold text-gray-700">Reference no.</th>
                    <th className="pb-3 pr-4 text-left text-xs font-semibold text-gray-700">Category</th>
                    <th className="pb-3 pr-4 text-left text-xs font-semibold text-gray-700">Description</th>
                    <th className="pb-3 pr-4 text-right text-xs font-semibold text-gray-700">Amount</th>
                    <th className="pb-3 text-left text-xs font-semibold text-gray-700">Recorded by</th>
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
