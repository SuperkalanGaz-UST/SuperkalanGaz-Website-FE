'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, Gift, LockKeyhole, PackageSearch } from 'lucide-react';
import { toast } from 'sonner';
import { useBranch } from '../../contexts/BranchContext';
import { apiErrorMessage, apiFetch, fetchJson } from '../../../lib/api';

interface BranchConfiguration {
  openingTime: string;
  closingTime: string;
}

const defaultConfiguration: BranchConfiguration = {
  openingTime: '07:00',
  closingTime: '20:00',
};

interface StockThresholdRow {
  product_id: string;
  product_name: string;
  cylinder_size: string;
  threshold_qty: number;
}

const numberFieldClassName =
  'h-10 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-[#007BC1] focus:ring-2 focus:ring-[#007BC1]/15';

/** Inventory and operating-hours settings for the selected branch. */
export function BranchConfigurationSettings() {
  const { selectedBranch, selectedBranchId } = useBranch();
  // selectedBranch is the placeholder "Select branch" when none is chosen.
  const branchLabel = selectedBranchId ? selectedBranch : 'no branch selected';
  const [savedByBranch, setSavedByBranch] = useState<Record<string, BranchConfiguration>>({});
  const savedConfiguration = useMemo(
    () =>
      (selectedBranchId ? savedByBranch[selectedBranchId] : undefined) ??
      defaultConfiguration,
    [savedByBranch, selectedBranchId],
  );
  const [form, setForm] = useState<BranchConfiguration>(savedConfiguration);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(savedConfiguration);
  }, [savedConfiguration]);

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

  const updateField = <K extends keyof BranchConfiguration>(field: K, value: BranchConfiguration[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

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

      setSavedByBranch((current) => ({ ...current, [selectedBranchId]: form }));
      toast.success(`Branch settings saved for ${selectedBranch}.`);
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
          <div className="mt-4 grid grid-cols-2 gap-4">
            <label className="block text-xs font-medium text-gray-600">
              Opening time
              <input
                type="time"
                value={form.openingTime}
                onChange={(event) => updateField('openingTime', event.target.value)}
                className={`${numberFieldClassName} mt-2`}
              />
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Closing time
              <input
                type="time"
                value={form.closingTime}
                onChange={(event) => updateField('closingTime', event.target.value)}
                className={`${numberFieldClassName} mt-2`}
              />
            </label>
          </div>
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

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !selectedBranchId}
          className="h-10 rounded-lg bg-[#007BC1] px-5 text-sm font-medium text-white transition hover:bg-[#0068A4]"
        >
          {saving ? 'Saving…' : 'Save branch settings'}
        </button>
        <button
          type="button"
          onClick={() => {
            setForm(savedConfiguration);
            setThresholds(savedThresholds);
          }}
          className="h-10 rounded-lg border border-[#007BC1] bg-white px-5 text-sm font-medium text-[#007BC1] transition hover:bg-blue-50"
        >
          Discard changes
        </button>
      </div>
    </div>
  );
}
