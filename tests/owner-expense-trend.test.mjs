import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOwnerExpenseTrend } from '../src/app/lib/owner-expense-trend.ts';

test('weekly trend shows selected-month totals grouped by calendar week', () => {
  const trend = buildOwnerExpenseTrend(
    [
      {
        key: '2025-12',
        expenses: [
          { expense_date: '2025-12-31', category: 'Utilities', amount: 900 },
        ],
        salaries: [],
      },
      {
        key: '2026-01',
        expenses: [
          { expense_date: '2026-01-06', category: 'Utilities', amount: 250 },
          { expense_date: '2026-01-20', category: 'Gasoline, Fuel & Oil', amount: 400 },
        ],
        salaries: [{ periodEnd: '2026-01-07', total: 1200 }],
      },
    ],
    ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01'],
    '2026-01',
    'week',
  );

  assert.equal(trend.length, 5);
  assert.deepEqual(trend.find((point) => point.label === 'Jan 5'), {
    label: 'Jan 5',
    operating: 250,
    salary: 1200,
  });
  assert.equal(trend.find((point) => point.label === 'Jan 19')?.operating, 400);
  assert.equal(trend.some((point) => point.operating === 900), false);
});

test('weekly trend includes empty weeks so the chart has a complete date range', () => {
  const trend = buildOwnerExpenseTrend([], ['2026-01'], '2026-02', 'week');

  assert.equal(trend.length, 5);
  assert.ok(trend.every((point) => point.operating === 0 && point.salary === 0));
});

test('monthly trend retains its six-month range', () => {
  const descriptors = [
    '2025-08',
    '2025-09',
    '2025-10',
    '2025-11',
    '2025-12',
    '2026-01',
  ];
  const periods = descriptors.map((key) => ({
    key,
    expenses: [],
    salaries: [],
  }));
  periods[0].expenses.push({
    expense_date: '2025-08-15',
    category: 'Utilities',
    amount: 500,
  });

  const trend = buildOwnerExpenseTrend(periods, descriptors, '2026-01', 'month');

  assert.equal(trend.length, 6);
  assert.equal(trend[0].operating, 500);
});
