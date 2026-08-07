'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Paperclip,
  Pencil,
  Search,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import {
  ExpenseApiRow,
  EXPENSE_CATEGORIES,
  ExpenseCategory,
  fetchExpenses,
  saveExpense,
} from '../../../lib/expenses';
import styles from './screen.module.css';

interface MonthPeriod {
  label: string;
  minDate: string;
  maxDate: string;
  year: number;
  month: number;
}

interface ExpenseRecord {
  id: string;
  date: string;
  reference: string | null;
  category: ExpenseCategory;
  description: string;
  amount: number;
  receiptName: string | null;
  recordedAt: string;
}

interface ExpenseDraft {
  date: string;
  category: '' | ExpenseCategory;
  amount: string;
  reference: string;
  description: string;
  receiptName: string | null;
}

type DraftErrors = Partial<Record<keyof ExpenseDraft, string>>;

const EMPTY_DRAFT: ExpenseDraft = {
  date: '',
  category: '',
  amount: '',
  reference: '',
  description: '',
  receiptName: null,
};

const CATEGORY_CLASS: Record<ExpenseCategory, string> = {
  'Gasoline, Fuel & Oil': styles.categoryFuel,
  'Repairs & Maintenance': styles.categoryRepair,
  Utilities: styles.categoryUtilities,
  Communication: styles.categoryCommunication,
  'Branch Supplies': styles.categorySupplies,
  'Facility Costs': styles.categoryFacility,
};

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonthPeriod(date: Date, monthOffset = 0): MonthPeriod {
  const firstDay = new Date(date.getFullYear(), date.getMonth() + monthOffset, 1);
  const lastDay = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0);

  return {
    label: new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(firstDay),
    minDate: toDateInputValue(firstDay),
    maxDate: toDateInputValue(lastDay),
    year: firstDay.getFullYear(),
    month: firstDay.getMonth(),
  };
}

function toExpenseRecord(row: ExpenseApiRow): ExpenseRecord {
  return {
    id: row.id,
    date: row.expense_date,
    reference: row.reference_no,
    category: row.category,
    description: row.description,
    amount: Number(row.amount),
    receiptName: row.receipt_name,
    recordedAt: row.updated_at,
  };
}

function formatExpenseDate(value: string): string {
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

function formatRecordedTime(value: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function MonthlyExpenses() {
  const [currentPeriod, setCurrentPeriod] = useState<MonthPeriod | null>(null);
  const [previousPeriod, setPreviousPeriod] = useState<MonthPeriod | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [previousExpenses, setPreviousExpenses] = useState<ExpenseRecord[]>([]);
  const [draft, setDraft] = useState<ExpenseDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ExpenseCategory>('all');
  const [showPreviousMonth, setShowPreviousMonth] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    const now = new Date();
    const current = getMonthPeriod(now);
    const previous = getMonthPeriod(now, -1);
    setCurrentPeriod(current);
    setPreviousPeriod(previous);
    setDraft({ ...EMPTY_DRAFT, date: toDateInputValue(now) });

    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [currentRows, previousRows] = await Promise.all([
          fetchExpenses(current.minDate.slice(0, 7)),
          fetchExpenses(previous.minDate.slice(0, 7)),
        ]);
        if (!active) return;
        setExpenses(currentRows.map(toExpenseRecord));
        setPreviousExpenses(previousRows.map(toExpenseRecord));
      } catch (error) {
        if (!active) return;
        setExpenses([]);
        setPreviousExpenses([]);
        setLoadError(error instanceof Error ? error.message : 'Failed to load expenses');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, []);

  const viewedPeriod = showPreviousMonth ? previousPeriod : currentPeriod;
  const viewedExpenses = showPreviousMonth ? previousExpenses : expenses;

  const filteredExpenses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return viewedExpenses.filter((expense) => {
      const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        expense.reference?.toLowerCase().includes(normalizedQuery) ||
        expense.description.toLowerCase().includes(normalizedQuery) ||
        expense.category.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [categoryFilter, query, viewedExpenses]);

  const total = viewedExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const lastRecorded = viewedExpenses[0]?.recordedAt;

  const resetDraft = () => {
    setDraft({ ...EMPTY_DRAFT, date: currentPeriod ? toDateInputValue(new Date()) : '' });
    setErrors({});
    setEditingId(null);
    if (receiptInputRef.current) receiptInputRef.current.value = '';
  };

  const updateDraft = <Key extends keyof ExpenseDraft>(key: Key, value: ExpenseDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSuccessMessage('');
    setLoadError(null);
  };

  const validateDraft = (): DraftErrors => {
    const nextErrors: DraftErrors = {};
    const amount = Number(draft.amount);

    if (!draft.date) nextErrors.date = 'Choose an expense date.';
    else if (!currentPeriod || draft.date < currentPeriod.minDate || draft.date > currentPeriod.maxDate) {
      nextErrors.date = `Date must be within ${currentPeriod?.label ?? 'the current month'}.`;
    }
    if (!draft.category) nextErrors.category = 'Select an expense category.';
    if (!Number.isFinite(amount) || amount <= 0) nextErrors.amount = 'Enter an amount greater than zero.';
    if (!draft.description.trim()) nextErrors.description = 'Describe what the expense was for.';

    return nextErrors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateDraft();
    if (Object.keys(nextErrors).length > 0 || !currentPeriod || !draft.category) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setLoadError(null);
    try {
      const savedRow = await saveExpense({
        expenseDate: draft.date,
        category: draft.category,
        amount: Number(draft.amount),
        reference: draft.reference.trim() || null,
        description: draft.description.trim(),
        receiptName: draft.receiptName,
      }, editingId ?? undefined);
      const saved = toExpenseRecord(savedRow);
      setExpenses((current) =>
        editingId
          ? current.map((expense) => expense.id === editingId ? saved : expense)
          : [saved, ...current],
      );
      setSuccessMessage(
        editingId
          ? 'Expense updated in the current month log.'
          : `Expense saved to the ${currentPeriod.label} log.`,
      );
      setDraft({ ...EMPTY_DRAFT, date: toDateInputValue(new Date()) });
      setEditingId(null);
      if (receiptInputRef.current) receiptInputRef.current.value = '';
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to save expense');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceipt = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    updateDraft('receiptName', file?.name ?? null);
  };

  const handleEdit = (expense: ExpenseRecord) => {
    setEditingId(expense.id);
    setDraft({
      date: expense.date,
      category: expense.category,
      amount: String(expense.amount),
      reference: expense.reference ?? '',
      description: expense.description,
      receiptName: expense.receiptName,
    });
    setErrors({});
    setSuccessMessage('');
  };

  const togglePeriod = () => {
    setShowPreviousMonth((current) => !current);
    setQuery('');
    setCategoryFilter('all');
    resetDraft();
    setSuccessMessage('');
  };

  if (!currentPeriod || !previousPeriod || !viewedPeriod) {
    return <div className={styles.loadingState} aria-label="Loading monthly expenses" />;
  }

  return (
    <section className={styles.page} aria-label="Monthly expenses">
      <div className={styles.periodBar}>
        <div>
          <p className={styles.eyebrow}>Expense period</p>
          <div className={styles.periodTitle}>
            <CalendarDays aria-hidden="true" />
            <strong>{viewedPeriod.label}</strong>
            <span className={showPreviousMonth ? styles.readOnlyBadge : styles.currentBadge}>
              {showPreviousMonth ? 'View only' : 'Current month'}
            </span>
          </div>
        </div>
        <button type="button" className={styles.periodLink} onClick={togglePeriod}>
          {showPreviousMonth ? `Back to ${currentPeriod.label}` : `View ${previousPeriod.label}`}
        </button>
      </div>

      <div className={styles.notice} role="status">
        <ShieldCheck aria-hidden="true" />
        <p>
          {showPreviousMonth
            ? `${previousPeriod.label} is closed. These entries are available for review only.`
            : `Entries are limited to ${formatExpenseDate(currentPeriod.minDate)}–${formatExpenseDate(currentPeriod.maxDate)}. Previous months are view-only.`}
        </p>
      </div>

      {loadError && <div className={styles.apiError} role="alert">{loadError}</div>}

      <div className={styles.summaryGrid}>
        <article className={`${styles.summaryCard} ${styles.summaryBlue}`}>
          <div className={styles.summaryIcon}><WalletCards aria-hidden="true" /></div>
          <div><span>{showPreviousMonth ? previousPeriod.label : 'This month'}</span><strong>{formatPeso(total)}</strong></div>
        </article>
        <article className={`${styles.summaryCard} ${styles.summaryGreen}`}>
          <div className={styles.summaryIcon}><FileText aria-hidden="true" /></div>
          <div><span>Expense entries</span><strong>{viewedExpenses.length}</strong></div>
        </article>
        <article className={`${styles.summaryCard} ${styles.summaryOrange}`}>
          <div className={styles.summaryIcon}><Clock3 aria-hidden="true" /></div>
          <div>
            <span>{showPreviousMonth ? 'Period status' : 'Last recorded'}</span>
            <strong>{showPreviousMonth ? 'Closed' : lastRecorded ? formatRecordedTime(lastRecorded) : 'No entries'}</strong>
          </div>
        </article>
      </div>

      <div className={styles.workspace}>
        <div className={styles.logCard}>
          <div className={styles.cardHeading}>
            <div>
              <h2>Expense Entries</h2>
              <p>{showPreviousMonth ? `Reviewing ${previousPeriod.label}` : `Recorded for ${currentPeriod.label}`}</p>
            </div>
          </div>

          <div className={styles.filters}>
            <label className={styles.searchField}>
              <Search aria-hidden="true" />
              <span className={styles.srOnly}>Search expenses</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search expenses"
              />
            </label>
            <label className={styles.filterField}>
              <span className={styles.srOnly}>Filter by category</span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value as 'all' | ExpenseCategory)}
              >
                <option value="all">All categories</option>
                {EXPENSE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <span className={styles.resultCount}>{filteredExpenses.length} {filteredExpenses.length === 1 ? 'entry' : 'entries'}</span>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference no.</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th className={styles.amountColumn}>Amount</th>
                  <th>Receipt</th>
                  {!showPreviousMonth && <th><span className={styles.srOnly}>Actions</span></th>}
                </tr>
              </thead>
              <tbody>
                {!loading && filteredExpenses.map((expense) => (
                  <tr key={expense.id}>
                    <td className={styles.nowrap}>{formatExpenseDate(expense.date)}</td>
                    <td className={`${styles.nowrap} ${styles.reference}`}>{expense.reference ?? '—'}</td>
                    <td><span className={`${styles.category} ${CATEGORY_CLASS[expense.category]}`}>{expense.category}</span></td>
                    <td className={styles.description}>{expense.description}</td>
                    <td className={`${styles.amountColumn} ${styles.amount}`}>{formatPeso(expense.amount)}</td>
                    <td>
                      {expense.receiptName ? (
                        <span className={styles.receiptAttached}><Paperclip aria-hidden="true" /> File noted</span>
                      ) : <span className={styles.noReceipt}>None noted</span>}
                    </td>
                    {!showPreviousMonth && (
                      <td>
                        <button type="button" className={styles.editButton} onClick={() => handleEdit(expense)} aria-label={`Edit ${expense.reference ?? 'expense'}`}>
                          <Pencil aria-hidden="true" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {loading && (
                  <tr><td colSpan={showPreviousMonth ? 6 : 7} className={styles.emptyState}>Loading expenses…</td></tr>
                )}
                {!loading && !loadError && filteredExpenses.length === 0 && (
                  <tr><td colSpan={showPreviousMonth ? 6 : 7} className={styles.emptyState}>No expenses match your search.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showPreviousMonth ? (
          <aside className={styles.readOnlyCard}>
            <div className={styles.readOnlyIcon}><ShieldCheck aria-hidden="true" /></div>
            <h2>{previousPeriod.label} is view-only</h2>
            <p>Closed-month entries cannot be added or changed. Return to the current month when you need to log an expense.</p>
            <button type="button" onClick={togglePeriod}>Back to {currentPeriod.label}</button>
          </aside>
        ) : (
          <aside className={styles.formCard}>
            <div className={styles.formHeading}>
              <div>
                <h2>{editingId ? 'Edit Expense' : 'Log New Expense'}</h2>
                <p>{editingId ? 'Update this current-month entry.' : `Add an expense dated within ${currentPeriod.label}.`}</p>
              </div>
              <CalendarDays aria-hidden="true" />
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div className={styles.field}>
                <label htmlFor="expense-date">Expense date <span className={styles.requiredMark}>*</span></label>
                <input
                  id="expense-date"
                  type="date"
                  min={currentPeriod.minDate}
                  max={currentPeriod.maxDate}
                  value={draft.date}
                  onChange={(event) => updateDraft('date', event.target.value)}
                  aria-describedby="expense-date-help expense-date-error"
                />
                <small id="expense-date-help">{formatExpenseDate(currentPeriod.minDate)}–{formatExpenseDate(currentPeriod.maxDate)} only</small>
                {errors.date && <p id="expense-date-error" className={styles.error}>{errors.date}</p>}
              </div>

              <div className={styles.field}>
                <label htmlFor="expense-category">Category <span className={styles.requiredMark}>*</span></label>
                <select
                  id="expense-category"
                  value={draft.category}
                  onChange={(event) => updateDraft('category', event.target.value as '' | ExpenseCategory)}
                  aria-describedby="expense-category-error"
                >
                  <option value="">Select a category</option>
                  {EXPENSE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
                {errors.category && <p id="expense-category-error" className={styles.error}>{errors.category}</p>}
              </div>

              <div className={styles.twoColumns}>
                <div className={styles.field}>
                  <label htmlFor="expense-amount">Amount <span className={styles.requiredMark}>*</span></label>
                  <div className={styles.amountInput}>
                    <span>₱</span>
                    <input
                      id="expense-amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      value={draft.amount}
                      onChange={(event) => updateDraft('amount', event.target.value)}
                      placeholder="0.00"
                      aria-describedby="expense-amount-error"
                    />
                  </div>
                  {errors.amount && <p id="expense-amount-error" className={styles.error}>{errors.amount}</p>}
                </div>
                <div className={styles.field}>
                  <label htmlFor="expense-reference">Reference no.</label>
                  <input
                    id="expense-reference"
                    type="text"
                    value={draft.reference}
                    onChange={(event) => updateDraft('reference', event.target.value)}
                    placeholder="e.g. OR-45821"
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label htmlFor="expense-description">Description <span className={styles.requiredMark}>*</span></label>
                <textarea
                  id="expense-description"
                  rows={3}
                  value={draft.description}
                  onChange={(event) => updateDraft('description', event.target.value)}
                  placeholder="What was this expense for?"
                  aria-describedby="expense-description-error"
                />
                {errors.description && <p id="expense-description-error" className={styles.error}>{errors.description}</p>}
              </div>

              <div className={styles.field}>
                <span className={styles.fieldLabel}>Receipt filename</span>
                <label className={styles.receiptUpload} htmlFor="expense-receipt">
                  <Paperclip aria-hidden="true" />
                  <span><strong>{draft.receiptName ?? 'Choose a receipt (optional)'}</strong><small>PDF, JPG or PNG · filename saved only</small></span>
                </label>
                <input
                  ref={receiptInputRef}
                  className={styles.fileInput}
                  id="expense-receipt"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={handleReceipt}
                />
              </div>

              <div className={styles.formActions}>
                <button type="button" className={styles.clearButton} onClick={resetDraft}>{editingId ? 'Cancel' : 'Clear'}</button>
                <button type="submit" className={styles.saveButton} disabled={submitting}>
                  <CheckCircle2 aria-hidden="true" />
                  {submitting ? 'Saving…' : editingId ? 'Update Expense' : 'Save Expense'}
                </button>
              </div>

              <div className={styles.formNote} aria-live="polite">
                <ShieldCheck aria-hidden="true" />
                <span>{successMessage || `Entries are stored in your branch's ${currentPeriod.label} expense log.`}</span>
              </div>
            </form>
          </aside>
        )}
      </div>
    </section>
  );
}
