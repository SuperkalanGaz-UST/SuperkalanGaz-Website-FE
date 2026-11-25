export type ExpenseTrendInterval = 'day' | 'week' | 'month';

export interface ExpenseTrendPeriod {
  key: string;
  expenses: Array<{
    expense_date: string;
    category: string;
    amount: number | string;
  }>;
  salaries: Array<{
    periodEnd: string;
    total: number;
  }>;
}

export interface ExpenseTrendPoint {
  label: string;
  operating: number;
  salary: number;
}

export function buildOwnerExpenseTrend(
  periods: ExpenseTrendPeriod[],
  descriptors: string[],
  selectedMonth: string,
  interval: ExpenseTrendInterval,
): ExpenseTrendPoint[] {
  const buckets = new Map<string, ExpenseTrendPoint>();
  const bucketKey = (date: string) => {
    if (interval === 'month') return date.slice(0, 7);
    if (interval === 'day') return date;
    const monday = new Date(`${date}T00:00:00Z`);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    return monday.toISOString().slice(0, 10);
  };
  const ensure = (date: string) => {
    const key = bucketKey(date);
    if (!buckets.has(key)) {
      const labelDate =
        interval === 'month' ? new Date(`${key}-01T00:00:00Z`) : new Date(`${key}T00:00:00Z`);
      buckets.set(key, {
        label: new Intl.DateTimeFormat('en-PH', {
          timeZone: 'UTC',
          month: 'short',
          ...(interval === 'month' ? {} : { day: 'numeric' }),
        }).format(labelDate),
        operating: 0,
        salary: 0,
      });
    }
    return buckets.get(key)!;
  };

  if (interval === 'month') {
    descriptors.forEach((descriptor) => ensure(`${descriptor}-01`));
  } else {
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let day = 1; day <= daysInMonth; day++) {
      ensure(`${selectedMonth}-${String(day).padStart(2, '0')}`);
    }
  }

  for (const period of periods) {
    if (interval !== 'month' && period.key !== selectedMonth) continue;
    for (const expense of period.expenses) {
      const target = ensure(expense.expense_date);
      target[expense.category === 'Salary & Wages' ? 'salary' : 'operating'] +=
        Number(expense.amount);
    }
    for (const salary of period.salaries) {
      ensure(salary.periodEnd).salary += salary.total;
    }
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, point]) => point);
}
