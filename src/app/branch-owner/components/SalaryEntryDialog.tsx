'use client';

import { FormEvent, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LockKeyhole } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  fetchSalaryStaff,
  formatExpensePeso,
  periodBounds,
  previewPay,
  saveSalary,
  type SalaryPayload,
} from '../../lib/salary-expenses';
import styles from './OperationalExpenses.module.css';

interface Props {
  branchId: string;
  month: string;
  onClose: () => void;
  onSaved: (recordedMonth: string) => void;
}

export function SalaryEntryDialog({
  branchId,
  month,
  onClose,
  onSaved,
}: Props) {
  const dates = periodBounds(month);
  const [staffId, setStaffId] = useState('');
  const [start, setStart] = useState(dates.start);
  const [end, setEnd] = useState(dates.end);
  const [regularHours, setRegularHours] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [otHours, setOtHours] = useState('0');
  const [otRate, setOtRate] = useState('0');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submission = useRef<{ fingerprint: string; requestId: string } | null>(
    null,
  );
  const staff = useQuery({
    queryKey: ['salary-staff', branchId],
    queryFn: () => fetchSalaryStaff(branchId),
    staleTime: 0,
  });
  const regularPay = previewPay(Number(regularHours), Number(hourlyRate));
  const overtimePay = previewPay(Number(otHours), Number(otRate));
  const total = Math.round((regularPay + overtimePay) * 100) / 100;
  const staffReady =
    !staff.isFetching && !staff.isError && !!staff.data?.length;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !staffReady) return;
    if (
      start > end ||
      total <= 0 ||
      !Number.isFinite(total) ||
      (Number(otHours) > 0 && Number(otRate) <= 0)
    ) {
      setError('Check the pay period, hours, and confirmed hourly rates.');
      return;
    }
    const value = {
      branchId,
      staffId,
      periodStart: start,
      periodEnd: end,
      regularHours: Number(regularHours),
      hourlyRate: Number(hourlyRate),
      overtimeHours: Number(otHours),
      overtimeHourlyRate: Number(otRate),
    };
    const fingerprint = JSON.stringify(value);
    if (submission.current?.fingerprint !== fingerprint)
      submission.current = { fingerprint, requestId: crypto.randomUUID() };
    const payload: SalaryPayload = {
      ...value,
      requestId: submission.current.requestId,
    };
    setError(null);
    setSaving(true);
    try {
      const row = await saveSalary(payload);
      onSaved(row.periodEnd.slice(0, 7));
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not save salary entry. Please retry.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent
        className={styles.salaryDialog}
        onEscapeKeyDown={(event) => {
          if (saving) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (saving) event.preventDefault();
        }}
      >
        <div className={styles.dialogHeading}>
          <div className={styles.headingWithBadge}>
            <DialogTitle>Record salary & overtime</DialogTitle>
            <span className={styles.ownerBadge}>
              <LockKeyhole size={14} /> Owner only
            </span>
          </div>
          <DialogDescription>
            Enter hours and the confirmed rates for this pay period.
          </DialogDescription>
        </div>
        <form onSubmit={(event) => void submit(event)}>
          <fieldset disabled={saving} className={styles.formFields}>
            <div className={styles.identityRow}>
              <label className={styles.field}>
                Staff member
                <select
                  aria-label="Staff member"
                  required
                  value={staffId}
                  onChange={(event) => setStaffId(event.target.value)}
                  disabled={!staffReady}
                >
                  <option value="">
                    {staff.isFetching
                      ? 'Loading branch staff…'
                      : 'Select branch staff'}
                  </option>
                  {staff.data?.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name} ·{' '}
                      {person.role === 'driver'
                        ? 'Delivery Rider'
                        : 'Branch Manager'}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Period start
                <input
                  required
                  type="date"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                />
              </label>
              <label className={styles.field}>
                Period end
                <input
                  required
                  type="date"
                  min={start}
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                />
              </label>
            </div>
            {staff.isError && (
              <div role="alert" className={styles.error}>
                Could not load branch staff.{' '}
                <button type="button" onClick={() => void staff.refetch()}>
                  Retry loading staff
                </button>
              </div>
            )}
            {!staff.isFetching && !staff.isError && !staff.data?.length && (
              <p className={styles.empty}>
                No active Branch Managers or Delivery Riders are assigned to
                this branch.
              </p>
            )}
            <div className={styles.paySections}>
              <section>
                <h3>Regular pay</h3>
                <div className={styles.twoFields}>
                  <label className={styles.field}>
                    Regular hours
                    <input
                      required
                      type="number"
                      min="0"
                      max="100000"
                      step="0.01"
                      placeholder="0"
                      value={regularHours}
                      onChange={(event) => setRegularHours(event.target.value)}
                    />
                  </label>
                  <label className={styles.field}>
                    Hourly rate (₱)
                    <input
                      required
                      type="number"
                      min="0.01"
                      max="1000000"
                      step="0.01"
                      placeholder="0.00"
                      value={hourlyRate}
                      onChange={(event) => setHourlyRate(event.target.value)}
                    />
                  </label>
                </div>
                <div className={styles.payCalculation}>
                  <span>Hours × hourly rate</span>
                  <output aria-label="Calculated regular pay">
                    {formatExpensePeso(regularPay)}
                  </output>
                </div>
              </section>
              <section>
                <h3>Overtime pay</h3>
                <div className={styles.twoFields}>
                  <label className={styles.field}>
                    Overtime hours
                    <input
                      required
                      type="number"
                      min="0"
                      max="100000"
                      step="0.01"
                      value={otHours}
                      onChange={(event) => setOtHours(event.target.value)}
                    />
                  </label>
                  <label className={styles.field}>
                    OT hourly rate (₱)
                    <input
                      required
                      type="number"
                      min={Number(otHours) > 0 ? '0.01' : '0'}
                      max="1000000"
                      step="0.01"
                      value={otRate}
                      onChange={(event) => setOtRate(event.target.value)}
                    />
                  </label>
                </div>
                <p className={styles.rateHint}>
                  Use the confirmed overtime rate.
                </p>
                <div className={styles.payCalculation}>
                  <span>OT hours × OT hourly rate</span>
                  <output aria-label="Calculated overtime pay">
                    {formatExpensePeso(overtimePay)}
                  </output>
                </div>
              </section>
            </div>
            <div className={styles.calculatedTotal}>
              <div>
                <strong>Calculated total</strong>
                <p>Regular pay + overtime pay</p>
              </div>
              <output aria-label="Calculated total" aria-live="polite">
                {formatExpensePeso(total)}
              </output>
            </div>
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
            <div className={styles.dialogFooter}>
              <p>This entry will be included in the Owner’s OPEX.</p>
              <div>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={!staffReady || saving}
                >
                  {saving ? 'Saving…' : 'Save entry'}
                </button>
              </div>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
