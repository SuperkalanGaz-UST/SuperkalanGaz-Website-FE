import { apiErrorMessage, apiFetch } from './api';

export const EXPENSE_CATEGORIES = [
  'Gasoline, Fuel & Oil',
  'Repairs & Maintenance',
  'Utilities',
  'Communication',
  'Branch Supplies',
  'Facility Costs',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface ExpenseApiRow {
  id: string;
  branch_id: string;
  expense_date: string;
  reference_no: string | null;
  category: ExpenseCategory;
  description: string;
  amount: number;
  receipt_name: string | null;
  recorded_by: string;
  created_at: string;
  updated_at: string;
}

export interface ExpensePayload {
  expenseDate: string;
  category: ExpenseCategory;
  amount: number;
  reference: string | null;
  description: string;
  receiptName: string | null;
}

export async function fetchExpenses(month: string): Promise<ExpenseApiRow[]> {
  const response = await apiFetch(`/expenses?month=${encodeURIComponent(month)}`);
  const data: unknown = await response.json();
  if (!response.ok) throw new Error(apiErrorMessage(data, 'Failed to load expenses'));
  return (data as { expenses: ExpenseApiRow[] }).expenses;
}

export async function saveExpense(
  payload: ExpensePayload,
  expenseId?: string,
): Promise<ExpenseApiRow> {
  const response = await apiFetch(expenseId ? `/expenses/${expenseId}` : '/expenses', {
    method: expenseId ? 'PATCH' : 'POST',
    body: JSON.stringify(payload),
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(apiErrorMessage(data, expenseId ? 'Failed to update expense' : 'Failed to save expense'));
  }
  return (data as { expense: ExpenseApiRow }).expense;
}
