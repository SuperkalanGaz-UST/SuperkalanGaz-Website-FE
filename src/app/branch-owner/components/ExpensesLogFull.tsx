'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { Header } from './Header';
import { Pagination } from './Pagination';
import {
  ExpenseApiRow,
  EXPENSE_CATEGORIES,
  ExpenseCategory,
  fetchExpenses,
} from '../../lib/expenses';

const ITEMS_PER_PAGE = 10;

const CATEGORY_STYLES: Record<ExpenseCategory, string> = {
  'Gasoline, Fuel & Oil': 'bg-blue-100 text-blue-900',
  'Repairs & Maintenance': 'bg-amber-100 text-amber-800',
  Utilities: 'bg-teal-100 text-teal-800',
  Communication: 'bg-cyan-100 text-cyan-800',
  'Branch Supplies': 'bg-violet-100 text-violet-800',
  'Facility Costs': 'bg-rose-100 text-rose-800',
};

interface MonthOption {
  key: string;
  label: string;
}

function monthOption(date: Date, offset: number): MonthOption {
  const value = new Date(date.getFullYear(), date.getMonth() + offset, 1);
  return {
    key: `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`,
    label: new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(value),
  };
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

function formatPeso(value: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function ExpensesLogFull({ onBack }: { onBack?: () => void }) {
  const [monthOptions] = useState<MonthOption[]>(() =>
    Array.from({ length: 12 }, (_, index) => monthOption(new Date(), -index)),
  );
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]?.key ?? '');
  const [expenses, setExpenses] = useState<ExpenseApiRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<'all' | ExpenseCategory>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchExpenses(selectedMonth)
      .then((rows) => { if (active) setExpenses(rows); })
      .catch((loadError: unknown) => {
        if (!active) return;
        setExpenses([]);
        setError(loadError instanceof Error ? loadError.message : 'Failed to load expenses');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedMonth]);

  const filteredExpenses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return expenses.filter((expense) => {
      const matchesCategory = category === 'all' || expense.category === category;
      const matchesSearch = !query || [
        expense.reference_no ?? '',
        expense.category,
        expense.description,
      ].some((value) => value.toLowerCase().includes(query));
      return matchesCategory && matchesSearch;
    });
  }, [category, expenses, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE));
  const pageData = filteredExpenses.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="relative flex-1 overflow-y-auto">
      <Header title="Expenses Log" />

      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('navigate', { detail: 'operational-expenses' }));
              onBack?.();
            }}
            className="flex items-center gap-2 text-sm text-[#007BC1] transition-colors hover:text-[#005a8f]"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600">Read only</span>
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                placeholder="Search reference, category or description"
                value={searchQuery}
                onChange={(event) => { setSearchQuery(event.target.value); setCurrentPage(1); }}
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-4 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#007BC1]"
              />
            </div>
            <select
              value={selectedMonth}
              onChange={(event) => { setSelectedMonth(event.target.value); setCurrentPage(1); }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#007BC1]"
              aria-label="Expense month"
            >
              {monthOptions.map((month) => <option key={month.key} value={month.key}>{month.label}</option>)}
            </select>
            <select
              value={category}
              onChange={(event) => { setCategory(event.target.value as 'all' | ExpenseCategory); setCurrentPage(1); }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#007BC1]"
              aria-label="Expense category"
            >
              <option value="all">All categories</option>
              {EXPENSE_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-3 pr-4 text-left text-[11px] font-medium uppercase text-gray-500">Date</th>
                  <th className="pb-3 pr-4 text-left text-[11px] font-medium uppercase text-gray-500">Reference no.</th>
                  <th className="pb-3 pr-4 text-left text-[11px] font-medium uppercase text-gray-500">Category</th>
                  <th className="pb-3 pr-4 text-left text-[11px] font-medium uppercase text-gray-500">Description</th>
                  <th className="pb-3 pr-4 text-right text-[11px] font-medium uppercase text-gray-500">Amount</th>
                  <th className="pb-3 text-left text-[11px] font-medium uppercase text-gray-500">Recorded by</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="py-10 text-center text-sm text-gray-400">Loading expenses…</td></tr>
                ) : pageData.length === 0 ? (
                  <tr><td colSpan={6} className="py-10 text-center text-sm text-gray-400">No expenses match this month and filter.</td></tr>
                ) : pageData.map((expense, index) => (
                  <tr key={expense.id} className={`border-b border-gray-100 ${index % 2 === 1 ? 'bg-gray-50' : ''}`}>
                    <td className="whitespace-nowrap py-4 pr-4 text-[13px] text-gray-900">{formatDate(expense.expense_date)}</td>
                    <td className="whitespace-nowrap py-4 pr-4 font-mono text-[13px] text-gray-900">{expense.reference_no ?? '—'}</td>
                    <td className="whitespace-nowrap py-4 pr-4"><span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${CATEGORY_STYLES[expense.category]}`}>{expense.category}</span></td>
                    <td className="max-w-[300px] truncate py-4 pr-4 text-[13px] text-gray-700">{expense.description}</td>
                    <td className="whitespace-nowrap py-4 pr-4 text-right text-[13px] font-medium text-gray-900">{formatPeso(Number(expense.amount))}</td>
                    <td className="whitespace-nowrap py-4 text-[13px] text-gray-600">Branch Manager</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-6">
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
