'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, Gift, LockKeyhole, PackageSearch } from 'lucide-react';
import { toast } from 'sonner';
import { useBranch } from '../../contexts/BranchContext';
import { useAccount } from '../../../contexts/AccountContext';
import { apiErrorMessage, apiFetch, fetchJson } from '../../../lib/api';
import { operatingHoursKey, saveOperatingHours, useOperatingHours, type OperatingHours } from '../../../lib/branchOperatingHours';

interface StockThresholdRow {
  product_id: string;
  product_name: string;
  cylinder_size: string;
  threshold_qty: number;
}

const numberFieldClassName =
  'h-10 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-[#007BC1] focus:ring-2 focus:ring-[#007BC1]/15';

const emptyHours: OperatingHours = { openingTime: '', closingTime: '' };

function OperatingHoursForm({ branchId, branchName }: { branchId: string; branchName: string }) {
  const account = useAccount();
  const queryClient = useQueryClient();
  const hours = useOperatingHours(account.id, branchId);
  const [draft, setDraft] = useState<OperatingHours | null>(null);
  const saved = hours.data?.operatingHours ?? emptyHours;
  const form = draft ?? saved;
  const changed = form.openingTime !== saved.openingTime || form.closingTime !== saved.closingTime;
  const save = useMutation({
    mutationFn: (values: OperatingHours) => saveOperatingHours(branchId, values),
    onSuccess: async (result) => {
      const queryKey = operatingHoursKey(account.id, branchId);
      await queryClient.cancelQueries({ queryKey, exact: true });
      queryClient.setQueryData(queryKey, result);
      setDraft(null);
      toast.success(`Operating hours saved for ${branchName}.`);
    },
    onError: (error) => toast.error(error.message || 'Could not save operating hours. Try again.'),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hours.isSuccess || !changed || save.isPending) return;
    if (form.openingTime === form.closingTime) {
      toast.error('Opening and closing times must be different.');
      return;
    }
    save.mutate(form);
  };

  if (hours.isPending) return <p className="mt-4 text-sm text-gray-500" role="status">Loading operating hours…</p>;
  if (hours.isError) return (
    <p className="mt-4 text-sm text-red-600" role="alert">
      Operating hours unavailable.{' '}
      <button type="button" className="underline" disabled={hours.isFetching} onClick={() => void hours.refetch()}>Retry</button>
    </p>
  );

  return (
    <form onSubmit={submit} className="mt-4">
      <p className="text-sm text-gray-500">Daily schedule in Philippine time.</p>
      <fieldset disabled={save.isPending} className="mt-4 grid grid-cols-2 gap-4">
        <label className="block text-xs font-medium text-gray-600">
          Opening time
          <input
            type="time"
            required
            value={form.openingTime}
            onChange={(event) => setDraft({ ...form, openingTime: event.target.value })}
            className={`${numberFieldClassName} mt-2`}
          />
        </label>
        <label className="block text-xs font-medium text-gray-600">
          Closing time
          <input
            type="time"
            required
            value={form.closingTime}
            onChange={(event) => setDraft({ ...form, closingTime: event.target.value })}
            className={`${numberFieldClassName} mt-2`}
          />
        </label>
      </fieldset>
      {form.closingTime && form.openingTime && form.closingTime < form.openingTime && (
        <p className="mt-2 text-xs text-gray-500">Closing time is on the following day.</p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="submit" disabled={!changed || save.isPending} className="h-10 rounded-lg bg-[#007BC1] px-4 text-sm font-medium text-white hover:bg-[#0068A4] disabled:opacity-50">
          {save.isPending ? 'Saving…' : 'Save operating hours'}
        </button>
        <button type="button" disabled={!changed || save.isPending} onClick={() => setDraft(null)} className="h-10 rounded-lg border border-[#007BC1] px-4 text-sm font-medium text-[#007BC1] hover:bg-blue-50 disabled:opacity-50">
          Discard hours changes
        </button>
      </div>
    </form>
  );
}

/** Inventory and operating-hours settings for the selected branch. */
export function BranchConfigurationSettings() {
  const { selectedBranch, selectedBranchId } = useBranch();
  // selectedBranch is the placeholder "Select branch" when none is chosen.
  const branchLabel = selectedBranchId ? selectedBranch : 'no branch selected';
  const [saving, setSaving] = useState(false);

  const queryClient = useQueryClient();

  // Low-stock alert levels are the real per-branch thresholds in inventory.stock_levels.
  const { data: stockData, isLoading: stockLoading, error: stockError } = useQuery({
    queryKey: ['owner-stock-thresholds', selectedBranchId],
    queryFn: () =>
      fetchJson<{ stockLevels: StockThresholdRow[] }>(
        `/inventory/stock-levels/owner?branchId=${encodeURIComponent(selectedBranchId!)}`,
      ),
    enabled: !!selectedBranchId,
  });
  const stockRows = useMemo(
    () =>
      [...(stockData?.stockLevels ?? [])].sort(
        (a, b) => parseFloat(a.cylinder_size) - parseFloat(b.cylinder_size),
      ),
    [stockData],
  );
  const savedThresholds = useMemo(
    () => Object.fromEntries(stockRows.map((row) => [row.product_id, String(row.threshold_qty)])),
    [stockRows],
  );
  const [thresholds, setThresholds] = useState<Record<string, string>>({});
  useEffect(() => {
    setThresholds(savedThresholds);
  }, [savedThresholds]);

  const handleSave = async () => {
    if (!selectedBranchId) {
      toast.error('Select an active branch before saving settings.');
      return;
    }
    const changedThresholds = stockRows
      .filter((row) => thresholds[row.product_id] !== savedThresholds[row.product_id])
      .map((row) => ({ productId: row.product_id, thresholdQty: Number(thresholds[row.product_id]) }));
    if (changedThresholds.some(({ thresholdQty }) => !Number.isInteger(thresholdQty) || thresholdQty < 0 || thresholdQty > 10_000)) {
      toast.error('Low-stock levels must be whole numbers from 0 to 10,000.');
      return;
    }
    setSaving(true);
    try {
      for (const change of changedThresholds) {
        const thresholdResponse = await apiFetch('/inventory/stock-levels/owner/threshold', {
          method: 'PATCH',
          body: JSON.stringify({ branchId: selectedBranchId, ...change }),
        });
        if (!thresholdResponse.ok) {
          const body = await thresholdResponse.json().catch(() => null);
          throw new Error(apiErrorMessage(body, 'Failed to save low-stock levels'));
        }
      }
      if (changedThresholds.length > 0) {
        void queryClient.invalidateQueries({ queryKey: ['owner-stock-thresholds', selectedBranchId] });
        void queryClient.invalidateQueries({ queryKey: ['owner-inventory', selectedBranchId] });
      }

      toast.success(`Inventory alerts saved for ${selectedBranch}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save branch settings');
    } finally {
      setSaving(false);
    }
  };

  const openLoyaltyProgram = () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'loyalty' }));
  };

  return (
    <div id="branch-settings-panel" role="tabpanel" className="mx-auto max-w-7xl">
      <div className="mb-5 flex items-center gap-2 rounded-xl border border-[#B9DFF4] bg-[#EFF8FD] px-4 py-3 text-sm text-gray-700">
        <LockKeyhole className="h-4 w-4 shrink-0 text-[#007BC1]" aria-hidden="true" />
        Settings apply to{' '}
        <span className="font-semibold text-gray-900">
          {branchLabel}
        </span>{' '}
        only.
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm" aria-labelledby="loyalty-settings-heading">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EAF6FC] text-[#007BC1]">
              <Gift className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="loyalty-settings-heading" className="text-lg font-semibold text-gray-900">Loyalty Program</h2>
              <p className="mt-1 text-sm text-gray-500">The Franchise Administrator manages the Household rewards catalog and points earned per cylinder.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={openLoyaltyProgram}
            className="mt-5 h-10 rounded-lg border border-[#007BC1] px-4 text-sm font-medium text-[#007BC1] hover:bg-blue-50"
          >
            View rewards
          </button>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm" aria-labelledby="inventory-alerts-heading">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EAF6FC] text-[#007BC1]">
              <PackageSearch className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="inventory-alerts-heading" className="text-lg font-semibold text-gray-900">Inventory Alerts</h2>
              <p className="mt-1 text-sm text-gray-500">Set low-stock warning levels for this branch.</p>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            {stockLoading && <p className="text-sm text-gray-500">Loading low-stock levels…</p>}
            {stockError && (
              <p role="alert" className="text-sm text-red-600">
                Couldn&apos;t load low-stock levels for this branch. Try again in a moment.
              </p>
            )}
            {stockRows.map((row) => (
              <label key={row.product_id} className="block text-sm font-medium text-gray-700">
                {row.product_name}
                <span className="mt-2 flex overflow-hidden rounded-lg border border-gray-300 bg-white transition focus-within:border-[#007BC1] focus-within:ring-2 focus-within:ring-[#007BC1]/15">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={thresholds[row.product_id] ?? ''}
                    onChange={(event) =>
                      setThresholds((current) => ({ ...current, [row.product_id]: event.target.value }))
                    }
                    className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm text-gray-900 outline-none"
                  />
                  <span className="flex items-center border-l border-gray-200 bg-gray-50 px-3 text-xs font-normal text-gray-500">units</span>
                </span>
              </label>
            ))}
            {stockRows.length > 0 && (
              <p className="text-xs leading-5 text-gray-500">
                Inventory flags a cylinder as low stock when it is at or below this level.
              </p>
            )}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !selectedBranchId || !!stockError || !stockRows.some(row => thresholds[row.product_id] !== savedThresholds[row.product_id])}
              className="h-10 rounded-lg bg-[#007BC1] px-4 text-sm font-medium text-white hover:bg-[#0068A4] disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save inventory alerts'}
            </button>
            <button
              type="button"
              onClick={() => setThresholds(savedThresholds)}
              disabled={saving}
              className="h-10 rounded-lg border border-[#007BC1] bg-white px-4 text-sm font-medium text-[#007BC1] hover:bg-blue-50 disabled:opacity-50"
            >
              Discard inventory changes
            </button>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm" aria-labelledby="operating-hours-heading">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EAF6FC] text-[#007BC1]">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 id="operating-hours-heading" className="text-base font-semibold text-gray-900">Branch Operating Hours</h2>
          </div>
          {selectedBranchId ? (
            <OperatingHoursForm branchId={selectedBranchId} branchName={selectedBranch} />
          ) : <p className="mt-4 text-sm text-gray-500">Select a branch to set its operating hours.</p>}
        </section>

        <section className="flex items-center gap-4 rounded-xl border border-[#B9DFF4] bg-[#EFF8FD] p-5" aria-labelledby="sla-policy-heading">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#B9DFF4] bg-white text-[#007BC1]">
            <LockKeyhole className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="sla-policy-heading" className="text-base font-semibold text-gray-900">SLA Policy</h2>
            <p className="mt-1 text-sm text-gray-600">System-wide SLA thresholds are proposed by the Franchise Administrator and approved by the Super Administrator.</p>
          </div>
        </section>
      </div>

    </div>
  );
}
