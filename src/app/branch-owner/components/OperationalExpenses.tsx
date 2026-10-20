'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Building2,
  Fuel,
  LockKeyhole,
  Package,
  Wrench,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchExpenses } from '../../lib/expenses';
import {
  expenseMonth,
  fetchSalaries,
  formatExpensePeso as peso,
  monthLabel,
} from '../../lib/salary-expenses';
import { useBranch } from '../contexts/BranchContext';
import { Header } from './Header';
import { SalaryExpenses } from './SalaryExpenses';
import { SalaryEntryDialog } from './SalaryEntryDialog';
import styles from './OperationalExpenses.module.css';

export function OperationalExpenses() {
  const branch = useBranch();
  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="Operational Expenses" />
      {branch.assignedBranchesLoading ? (
        <p className={styles.empty}>Validating assigned branches…</p>
      ) : branch.assignedBranchesError ? (
        <div role="alert" className={styles.error}>
          {branch.assignedBranchesError}
          <button
            type="button"
            onClick={() => void branch.refreshAssignedBranches()}
          >
            Retry branches
          </button>
        </div>
      ) : !branch.selectedBranchId ? (
        <p className={styles.empty}>
          Select an authorized branch to view its expenses.
        </p>
      ) : (
        <ExpenseWorkspace
          key={branch.selectedBranchId}
          branchId={branch.selectedBranchId}
        />
      )}
    </div>
  );
}

function ExpenseWorkspace({ branchId }: { branchId: string }) {
  const client = useQueryClient();
  const [month, setMonth] = useState(() => expenseMonth());
  const [tab, setTab] = useState<'overview' | 'salary'>('overview');
  const [recording, setRecording] = useState(false);
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>(
    'month',
  );
  const descriptors = useMemo(
    () => Array.from({ length: 6 }, (_, i) => expenseMonth(i - 5, month)),
    [month],
  );
  const monthOptions = [
    ...new Set([
      month,
      ...Array.from({ length: 12 }, (_, i) => expenseMonth(-i)),
    ]),
  ]
    .sort()
    .reverse();
  const query = useQuery({
    queryKey: ['owner-expenses', branchId, month],
    queryFn: () =>
      Promise.all(
        descriptors.map(async (key) => {
          const [expenses, salaries] = await Promise.all([
            fetchExpenses(key, branchId),
            fetchSalaries(key, branchId),
          ]);
          return { key, expenses, salaries };
        }),
      ),
    staleTime: 30_000,
  });
  const months = useMemo(() => query.data ?? [], [query.data]);
  const current = months.at(-1);
  const expenses = current?.expenses ?? [];
  const salaries = current?.salaries ?? [];
  const operational = expenses.filter(
    (row) => row.category !== 'Salary & Wages',
  );
  const legacy = expenses.filter((row) => row.category === 'Salary & Wages');
  const legacyTotal = legacy.reduce((sum, row) => sum + Number(row.amount), 0);
  const operatingTotal = operational.reduce(
    (sum, row) => sum + Number(row.amount),
    0,
  );
  const regular =
    salaries.reduce((sum, row) => sum + row.regularPay, 0) + legacyTotal;
  const overtime = salaries.reduce((sum, row) => sum + row.overtimePay, 0);
  const loading = query.isPending;
  const value = (n: number) => (loading ? '—' : peso(n));
  const categories = [
    { title: 'Fuel & Oil', icon: Fuel, categories: ['Gasoline, Fuel & Oil'] },
    { title: 'Repairs', icon: Wrench, categories: ['Repairs & Maintenance'] },
    {
      title: 'Utilities & Comms',
      icon: Zap,
      categories: ['Utilities', 'Communication'],
    },
    {
      title: 'Branch Supplies',
      icon: Package,
      categories: ['Branch Supplies'],
    },
    {
      title: 'Facility Costs',
      icon: Building2,
      categories: ['Facility Costs'],
    },
  ];
  const trend = useMemo(() => {
    const buckets = new Map<
      string,
      { label: string; operating: number; salary: number }
    >();
    const bucketKey = (date: string) => {
      if (granularity === 'month') return date.slice(0, 7);
      if (granularity === 'day') return date;
      const d = new Date(`${date}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      return d.toISOString().slice(0, 10);
    };
    const ensure = (date: string) => {
      const key = bucketKey(date);
      if (!buckets.has(key))
        buckets.set(key, {
          label:
            granularity === 'month'
              ? monthLabel(key, true)
              : new Intl.DateTimeFormat('en-PH', {
                  timeZone: 'UTC',
                  month: 'short',
                  day: 'numeric',
                }).format(new Date(`${key}T00:00:00Z`)),
          operating: 0,
          salary: 0,
        });
      return buckets.get(key)!;
    };
    if (granularity === 'month')
      descriptors.forEach((key) => ensure(`${key}-01`));
    if (granularity === 'day') {
      const [year, m] = month.split('-').map(Number);
      for (
        let day = 1;
        day <= new Date(Date.UTC(year, m, 0)).getUTCDate();
        day++
      )
        ensure(`${month}-${String(day).padStart(2, '0')}`);
    }
    for (const period of months) {
      if (granularity === 'day' && period.key !== month) continue;
      for (const row of period.expenses)
        ensure(row.expense_date)[
          row.category === 'Salary & Wages' ? 'salary' : 'operating'
        ] += Number(row.amount);
      for (const row of period.salaries)
        ensure(row.periodEnd).salary += row.total;
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, entry]) => entry);
  }, [months, descriptors, granularity, month]);

  return (
    <div className={styles.workspace}>
      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist" aria-label="Expense views">
          <button
            id="expense-overview-tab"
            role="tab"
            aria-controls="expense-overview-panel"
            aria-selected={tab === 'overview'}
            type="button"
            onClick={() => setTab('overview')}
          >
            Overview
          </button>
          <button
            id="expense-salary-tab"
            role="tab"
            aria-controls="expense-salary-panel"
            aria-selected={tab === 'salary'}
            type="button"
            onClick={() => setTab('salary')}
          >
            <LockKeyhole size={17} /> Salaries & Overtime
          </button>
        </div>
        <label className={styles.monthPicker}>
          <span className="sr-only">Expense month</span>
          <select
            aria-label="Expense month"
            value={month}
            onChange={(event) => {
              setMonth(event.target.value);
              setRecording(false);
            }}
          >
            {monthOptions.map((key) => (
              <option key={key} value={key}>
                {monthLabel(key)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {query.isError ? (
        <div className={styles.error} role="alert">
          <p>{query.error.message || 'Expenses are unavailable.'}</p>
          <p>
            Totals and recording are unavailable until the required expense data
            loads.
          </p>
          <button type="button" onClick={() => void query.refetch()}>
            Retry loading expenses
          </button>
        </div>
      ) : tab === 'salary' ? (
        <div
          id="expense-salary-panel"
          role="tabpanel"
          aria-labelledby="expense-salary-tab"
          className={styles.tabPanel}
        >
          <SalaryExpenses
            salaries={salaries}
            legacy={legacy}
            loading={loading}
            onRecord={() => setRecording(true)}
          />
        </div>
      ) : (
        <div
          id="expense-overview-panel"
          role="tabpanel"
          aria-labelledby="expense-overview-tab"
          className={styles.tabPanel}
        >
          <div className={styles.overviewMetrics}>
            {[
              {
                title: 'Total this month',
                amount: operatingTotal + regular + overtime,
                note: 'Operating expenses + salaries + overtime',
              },
              {
                title: 'Operating expenses',
                amount: operatingTotal,
                note: 'Recorded by the branch',
              },
              { title: 'Salaries', amount: regular, private: true },
              { title: 'Overtime pay', amount: overtime, private: true },
            ].map((metric) => (
              <div key={metric.title} className={styles.metric}>
                <p>
                  {metric.title}
                  {metric.private && (
                    <LockKeyhole aria-label="Owner only" size={16} />
                  )}
                </p>
                <strong>{value(metric.amount)}</strong>
                {metric.note && <small>{metric.note}</small>}
              </div>
            ))}
          </div>
          <div className={styles.overviewMiddle}>
            <section className={styles.panel} aria-label="Expense trend">
              <div className={styles.panelHeading}>
                <div>
                  <h3>Expense trend</h3>
                  <p>
                    {granularity === 'day'
                      ? monthLabel(month)
                      : 'Last six months'}
                  </p>
                </div>
                <div className={styles.segments}>
                  {(['day', 'week', 'month'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      aria-pressed={granularity === g}
                      onClick={() => setGranularity(g)}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.chart}>
                {loading ? (
                  <p className={styles.empty}>Loading trend…</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                      data={trend}
                      margin={{ top: 12, right: 20, left: 4, bottom: 8 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 5"
                        vertical={false}
                        stroke="#e7edf3"
                      />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        width={68}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12 }}
                        tickFormatter={(n: number) =>
                          n >= 1000
                            ? `₱${Number((n / 1000).toFixed(1))}k`
                            : `₱${n}`
                        }
                      />
                      <Tooltip formatter={(n) => peso(Number(n))} />
                      <Legend
                        iconType="circle"
                        wrapperStyle={{ paddingTop: 16, fontSize: 13 }}
                      />
                      <Line
                        isAnimationActive={false}
                        name="Operating expenses"
                        dataKey="operating"
                        stroke="#007bc1"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        isAnimationActive={false}
                        name="Salaries & overtime"
                        dataKey="salary"
                        stroke="#152a53"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>
            <section className={styles.panel} aria-label="Salary overview">
              <div className={styles.panelHeading}>
                <h3>
                  <LockKeyhole size={19} /> Salaries & overtime
                </h3>
                <span className={styles.ownerBadge}>Owner only</span>
              </div>
              <p className={styles.muted}>Included in your monthly OPEX</p>
              <dl className={styles.salarySummary}>
                <div>
                  <dt>Salaries</dt>
                  <dd>{value(regular)}</dd>
                </div>
                <div>
                  <dt>Overtime pay</dt>
                  <dd>{value(overtime)}</dd>
                </div>
                <div>
                  <dt>Total</dt>
                  <dd>{value(regular + overtime)}</dd>
                </div>
              </dl>
              <button
                type="button"
                className={styles.textButton}
                onClick={() => setTab('salary')}
              >
                View salary entries →
              </button>
              <p className={styles.footnote}>
                Visible only to the Branch Owner.
              </p>
            </section>
          </div>
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <h3>Operating expense breakdown</h3>
                <p>{monthLabel(month)}</p>
              </div>
            </div>
            <div className={styles.categoryGrid}>
              {categories.map(({ title, icon: Icon, categories: types }) => (
                <div key={title}>
                  <Icon size={22} />
                  <div>
                    <p>{title}</p>
                    <strong>
                      {value(
                        operational
                          .filter((row) => types.includes(row.category))
                          .reduce((sum, row) => sum + Number(row.amount), 0),
                      )}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <h3>Expenses log</h3>
                <p>{monthLabel(month)} · operational expense records</p>
              </div>
              <button
                type="button"
                className={styles.textButton}
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent('navigate', {
                      detail: 'expenses-log-full',
                    }),
                  )
                }
              >
                View all entries →
              </button>
            </div>
            <div className={styles.tableScroll}>
              <table className={styles.salaryTable}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {loading || operational.length === 0 ? (
                    <tr>
                      <td colSpan={4} className={styles.empty}>
                        {loading
                          ? 'Loading expenses…'
                          : 'No operational expenses recorded for this month.'}
                      </td>
                    </tr>
                  ) : (
                    operational.slice(0, 6).map((row) => (
                      <tr key={row.id}>
                        <td>{row.expense_date}</td>
                        <td>{row.category}</td>
                        <td>{row.description}</td>
                        <td>{peso(Number(row.amount))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
      {recording && !query.isError && (
        <SalaryEntryDialog
          branchId={branchId}
          month={month}
          onClose={() => setRecording(false)}
          onSaved={(recordedMonth) => {
            setRecording(false);
            setMonth(recordedMonth);
            void client.invalidateQueries({
              queryKey: ['owner-expenses', branchId],
            });
            toast.success('Salary expense recorded.');
          }}
        />
      )}
    </div>
  );
}
