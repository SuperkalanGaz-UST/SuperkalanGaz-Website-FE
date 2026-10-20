import { apiErrorMessage, apiFetch } from './api';

export interface SalaryStaff {
  id: string;
  name: string;
  role: 'branch-manager' | 'driver';
}
export interface SalaryPayload {
  branchId: string;
  staffId: string;
  requestId: string;
  periodStart: string;
  periodEnd: string;
  regularHours: number;
  hourlyRate: number;
  overtimeHours: number;
  overtimeHourlyRate: number;
}
export interface SalaryExpense extends SalaryPayload {
  id: string;
  staffName: string;
  staffRole: SalaryStaff['role'];
  regularPay: number;
  overtimePay: number;
  total: number;
  createdAt: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, {
    ...init,
    signal: AbortSignal.timeout(10_000),
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      apiErrorMessage(data, 'Salary expenses are unavailable. Please retry.'),
    );
  return data as T;
}
export async function fetchSalaries(
  month: string,
  branchId: string,
): Promise<SalaryExpense[]> {
  return (
    await request<{ salaries: SalaryExpense[] }>(
      `/salary-expenses?${new URLSearchParams({ month, branchId })}`,
    )
  ).salaries;
}
export async function fetchSalaryStaff(
  branchId: string,
): Promise<SalaryStaff[]> {
  return (
    await request<{ staff: SalaryStaff[] }>(
      `/salary-expenses/staff?${new URLSearchParams({ branchId })}`,
    )
  ).staff;
}
export async function saveSalary(
  payload: SalaryPayload,
): Promise<SalaryExpense> {
  return (
    await request<{ salary: SalaryExpense }>('/salary-expenses', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  ).salary;
}
export function formatExpensePeso(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(amount);
}
export function expenseMonth(offset = 0, from?: string): string {
  const current =
    from ??
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  const [year, month] = current.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1 + offset, 1))
    .toISOString()
    .slice(0, 7);
}
export function monthLabel(month: string, short = false): string {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'UTC',
    month: short ? 'short' : 'long',
    ...(short ? {} : { year: 'numeric' }),
  }).format(new Date(`${month}-01T00:00:00Z`));
}
export function periodBounds(month: string): { start: string; end: string } {
  const [year, m] = month.split('-').map(Number);
  return {
    start: `${month}-01`,
    end: new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10),
  };
}
/** Display preview only. NestJS independently validates inputs and owns saved amounts. */
export function previewPay(hours: number, rate: number): number {
  return (
    Math.round((Math.round(hours * 100) * Math.round(rate * 100)) / 100) / 100
  );
}
