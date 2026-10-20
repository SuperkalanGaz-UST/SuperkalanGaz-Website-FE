'use client';

import { useState } from 'react';
import { LockKeyhole, Plus, Search } from 'lucide-react';
import { ExpenseApiRow } from '../../lib/expenses';
import {
  formatExpensePeso as peso,
  SalaryExpense,
} from '../../lib/salary-expenses';
import styles from './OperationalExpenses.module.css';

interface Props {
  salaries: SalaryExpense[];
  legacy: ExpenseApiRow[];
  onRecord: () => void;
  loading: boolean;
}

export function SalaryExpenses({ salaries, legacy, onRecord, loading }: Props) {
  const [search, setSearch] = useState('');
  const matching = salaries.filter((row) =>
    row.staffName.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const regular =
    salaries.reduce((sum, row) => sum + row.regularPay, 0) +
    legacy.reduce((sum, row) => sum + Number(row.amount), 0);
  const overtime = salaries.reduce((sum, row) => sum + row.overtimePay, 0);
  return (
    <>
      <div className={styles.sectionHeading}>
        <div>
          <div className={styles.headingWithBadge}>
            <h2>Salaries & overtime</h2>
            <span className={styles.ownerBadge}>
              <LockKeyhole size={14} /> Owner only
            </span>
          </div>
          <p>Hours-based expenses for your branch.</p>
        </div>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={onRecord}
          disabled={loading}
        >
          <Plus size={18} /> Record salary
        </button>
      </div>
      <div className={styles.salaryMetrics}>
        {[
          ['Regular pay', regular],
          ['Overtime pay', overtime],
          ['Total this month', regular + overtime],
        ].map(([title, value]) => (
          <div key={title} className={styles.metric}>
            <p>{title}</p>
            <strong>{loading ? '—' : peso(Number(value))}</strong>
          </div>
        ))}
      </div>
      <section className={styles.panel} aria-label="Salary entries">
        <div className={styles.panelHeading}>
          <div>
            <h3>Salary entries</h3>
            <p>
              {loading
                ? 'Loading entries…'
                : `${salaries.length} ${salaries.length === 1 ? 'entry' : 'entries'}`}
            </p>
          </div>
          <label className={styles.search}>
            <Search size={18} />
            <input
              aria-label="Search salary staff"
              type="search"
              placeholder="Search staff"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        <div className={styles.tableScroll}>
          <table className={styles.salaryTable}>
            <thead>
              <tr>
                {[
                  'Staff member',
                  'Regular hours',
                  'Hourly rate',
                  'Regular pay',
                  'Overtime pay',
                  'Total',
                ].map((title) => (
                  <th key={title}>{title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading || !matching.length ? (
                <tr>
                  <td colSpan={6} className={styles.empty}>
                    {loading
                      ? 'Loading salaries…'
                      : search
                        ? 'No staff match your search.'
                        : 'No salary entries recorded for this month.'}
                  </td>
                </tr>
              ) : (
                matching.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.staffName}</strong>
                      <small>
                        {row.staffRole === 'driver'
                          ? 'Delivery Rider'
                          : 'Branch Manager'}{' '}
                        · {row.periodStart} – {row.periodEnd}
                      </small>
                    </td>
                    <td>{row.regularHours} h</td>
                    <td>{peso(row.hourlyRate)}</td>
                    <td>{peso(row.regularPay)}</td>
                    <td>
                      {peso(row.overtimePay)}
                      <small>
                        {row.overtimeHours} h × {peso(row.overtimeHourlyRate)}
                      </small>
                    </td>
                    <td>
                      <strong>{peso(row.total)}</strong>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading && matching.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={5}>Total{search ? ' matching entries' : ''}</td>
                  <td>
                    {peso(matching.reduce((sum, row) => sum + row.total, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
      {legacy.length > 0 && (
        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h3>Earlier salary records</h3>
              <p>
                Included in regular pay totals. These records have no hours or
                rate breakdown.
              </p>
            </div>
          </div>
          <div className={styles.tableScroll}>
            <table className={styles.salaryTable}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {legacy.map((row) => (
                  <tr key={row.id}>
                    <td>{row.expense_date}</td>
                    <td>{row.description}</td>
                    <td>{peso(Number(row.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <p className={styles.footnote}>
        Included in the Owner’s operational expenses.
      </p>
    </>
  );
}
