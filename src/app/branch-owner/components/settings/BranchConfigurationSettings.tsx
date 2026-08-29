'use client';

import { useEffect, useMemo, useState } from 'react';
import { Clock3, Gift, LockKeyhole, PackageSearch } from 'lucide-react';
import { toast } from 'sonner';
import { useBranch } from '../../contexts/BranchContext';
import { apiErrorMessage, apiFetch } from '../../../lib/api';

interface BranchConfiguration {
  dualAuth: boolean;
  pointRates: Record<'2.7kg' | '5kg' | '11kg' | '22kg' | '50kg', string>;
  stock11kg: string;
  stock22kg: string;
  stock50kg: string;
  openingTime: string;
  closingTime: string;
}

const defaultConfiguration: BranchConfiguration = {
  dualAuth: true,
  pointRates: { '2.7kg': '5', '5kg': '10', '11kg': '15', '22kg': '20', '50kg': '25' },
  stock11kg: '20',
  stock22kg: '10',
  stock50kg: '5',
  openingTime: '07:00',
  closingTime: '20:00',
};

const numberFieldClassName =
  'h-10 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-[#007BC1] focus:ring-2 focus:ring-[#007BC1]/15';

/** Combined loyalty and inventory controls, always scoped to the selected BO branch. */
export function BranchConfigurationSettings() {
  const { selectedBranch } = useBranch();
  const [savedByBranch, setSavedByBranch] = useState<Record<string, BranchConfiguration>>({});
  const savedConfiguration = useMemo(
    () => savedByBranch[selectedBranch] ?? defaultConfiguration,
    [savedByBranch, selectedBranch],
  );
  const [form, setForm] = useState<BranchConfiguration>(savedConfiguration);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(savedConfiguration);
  }, [savedConfiguration]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await apiFetch('/loyalty/settings');
        const data = await response.json();
        if (!response.ok) throw new Error(apiErrorMessage(data, 'Failed to load loyalty settings'));
        if (cancelled) return;
        const rates = data.settings.point_rates as Record<keyof BranchConfiguration['pointRates'], number>;
        setForm((current) => ({
          ...current,
          dualAuth: data.settings.dual_auth === true,
          pointRates: {
            '2.7kg': String(rates['2.7kg']),
            '5kg': String(rates['5kg']),
            '11kg': String(rates['11kg']),
            '22kg': String(rates['22kg']),
            '50kg': String(rates['50kg']),
          },
        }));
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : 'Failed to load loyalty settings');
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [selectedBranch]);

  const updateField = <K extends keyof BranchConfiguration>(field: K, value: BranchConfiguration[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    const pointRates = Object.fromEntries(
      Object.entries(form.pointRates).map(([size, value]) => [size, Number(value)]),
    );
    if (Object.values(pointRates).some((value) => !Number.isInteger(value) || value < 0)) {
      toast.error('Point rates must be whole numbers of zero or more.');
      return;
    }
    setSaving(true);
    try {
      const response = await apiFetch('/loyalty/settings', {
        method: 'PATCH',
        body: JSON.stringify({ dualAuth: form.dualAuth, pointRates }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(apiErrorMessage(data, 'Failed to save loyalty settings'));
      setSavedByBranch((current) => ({ ...current, [selectedBranch]: form }));
      toast.success(`Loyalty settings saved for ${selectedBranch}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save loyalty settings');
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
        Settings apply to <span className="font-semibold text-gray-900">{selectedBranch}</span> only.
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm" aria-labelledby="loyalty-settings-heading">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EAF6FC] text-[#007BC1]">
              <Gift className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="loyalty-settings-heading" className="text-lg font-semibold text-gray-900">Loyalty Program</h2>
              <p className="mt-1 text-sm text-gray-500">Configure reward rules for this branch.</p>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-900">Commercial rewards</h3>
            <p className="mt-4 text-sm text-gray-600">30 qualifying purchases earn one free cylinder.</p>

            <div className="mt-5 flex items-start justify-between gap-5">
              <div>
                <p className="text-sm font-medium text-gray-700">Require dual authorization for redemptions</p>
                <p className="mt-1.5 text-xs leading-5 text-gray-500">
                  Branch Manager approval is required before reward dispatch.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.dualAuth}
                aria-label="Require dual authorization for redemptions"
                onClick={() => updateField('dualAuth', !form.dualAuth)}
                className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${form.dualAuth ? 'bg-[#007BC1]' : 'bg-gray-300'
                  }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${form.dualAuth ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
              </button>
            </div>
          </div>

          <div className="mt-6 border-t border-gray-200 pt-5">
            <h3 className="text-sm font-semibold text-gray-900">Household points</h3>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(Object.keys(form.pointRates) as Array<keyof BranchConfiguration['pointRates']>).map((size) => (
                <label key={size} className="block text-xs font-medium text-gray-600">
                  {size} rate
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.pointRates[size]}
                    onChange={(event) => setForm((current) => ({
                      ...current,
                      pointRates: { ...current.pointRates, [size]: event.target.value },
                    }))}
                    className={`${numberFieldClassName} mt-2`}
                  />
                </label>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-4 rounded-lg bg-gray-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Point expiry</p>
                <p className="mt-0.5 text-xs text-gray-500">Points expire 12 months after they are earned.</p>
              </div>
              <span className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700">12 months</span>
            </div>
            <button
              type="button"
              onClick={openLoyaltyProgram}
              className="mt-4 h-10 w-full rounded-lg border border-[#007BC1] bg-white px-4 text-sm font-medium text-[#007BC1] transition hover:bg-blue-50"
            >
              Open point rates and merchandise catalog
            </button>
          </div>
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
            {([
              ['11kg Cylinders', 'stock11kg'],
              ['22kg Cylinders', 'stock22kg'],
              ['50kg Cylinders', 'stock50kg'],
            ] as const).map(([label, field]) => (
              <label key={field} className="block text-sm font-medium text-gray-700">
                {label}
                <span className="mt-2 flex overflow-hidden rounded-lg border border-gray-300 bg-white transition focus-within:border-[#007BC1] focus-within:ring-2 focus-within:ring-[#007BC1]/15">
                  <input
                    type="number"
                    min="0"
                    value={form[field]}
                    onChange={(event) => updateField(field, event.target.value)}
                    className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm text-gray-900 outline-none"
                  />
                  <span className="flex items-center border-l border-gray-200 bg-gray-50 px-3 text-xs font-normal text-gray-500">units</span>
                </span>
                <span className="mt-1.5 block text-xs font-normal leading-5 text-gray-500">
                  Alert when available stock falls below this level.
                </span>
              </label>
            ))}
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
          disabled={saving}
          className="h-10 rounded-lg bg-[#007BC1] px-5 text-sm font-medium text-white transition hover:bg-[#0068A4]"
        >
          {saving ? 'Saving…' : 'Save branch settings'}
        </button>
        <button
          type="button"
          onClick={() => setForm(savedConfiguration)}
          className="h-10 rounded-lg border border-[#007BC1] bg-white px-5 text-sm font-medium text-[#007BC1] transition hover:bg-blue-50"
        >
          Discard changes
        </button>
      </div>
    </div>
  );
}
