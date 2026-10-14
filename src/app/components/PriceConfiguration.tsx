'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Building2, Flame, Info } from 'lucide-react';
import { toast } from 'sonner';
import { apiErrorMessage, apiFetch } from '../lib/api';
import { fetchLpgPrices } from '../lib/pricing';
import { Header } from './Header';

const CYLINDERS = [
  { id: '50kg', label: '50kg Cylinder' },
  { id: '22kg', label: '22kg Cylinder' },
  { id: '11kg', label: '11kg Cylinder' },
  { id: '5kg', label: '5kg Cylinder' },
  { id: '2.7kg', label: '2.7kg Cylinder' },
] as const;

type CylinderId = (typeof CYLINDERS)[number]['id'];
type PriceMap = Record<CylinderId, string>;
type PriceMovement = 'increase' | 'decrease' | 'unchanged';

const INITIAL_PRICES: PriceMap = {
  '50kg': '1,500.00',
  '22kg': '1,100.00',
  '11kg': '650.00',
  '5kg': '350.00',
  '2.7kg': '200.00',
};

function parsePrice(value: string): number | null {
  const normalized = value.replace(/,/g, '').trim();
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null;

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function formatPrice(amount: number): string {
  return amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getMovement(currentValue: string, savedValue: string) {
  const current = parsePrice(currentValue);
  const saved = parsePrice(savedValue);

  if (current === null || saved === null) {
    return { movement: 'unchanged' as PriceMovement, delta: 0 };
  }

  const delta = current - saved;
  if (delta > 0) return { movement: 'increase' as PriceMovement, delta };
  if (delta < 0) return { movement: 'decrease' as PriceMovement, delta };
  return { movement: 'unchanged' as PriceMovement, delta: 0 };
}

function CylinderIcon({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`relative inline-flex shrink-0 ${className ?? ''}`}>
      <svg
        viewBox="0 0 24 32"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-full w-full"
      >
        <path d="M8 2.5h8a1 1 0 0 1 1 1V6H7V3.5a1 1 0 0 1 1-1Z" />
        <path d="M8 6h8a4 4 0 0 1 4 4v15.5a4.5 4.5 0 0 1-4.5 4.5h-7A4.5 4.5 0 0 1 4 25.5V10a4 4 0 0 1 4-4Z" />
        <path d="M5.5 27.5h13" />
      </svg>
      <Flame
        fill="currentColor"
        strokeWidth={1.5}
        className="absolute left-1/2 top-[45%] h-[34%] w-[42%] -translate-x-1/2 text-current"
      />
    </span>
  );
}

function MovementIndicator({ movement, delta }: { movement: PriceMovement; delta: number }) {
  if (movement === 'increase') {
    return (
      <span className="inline-flex items-center justify-end gap-1 whitespace-nowrap text-xs font-semibold text-red-600">
        <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" />
        <span>₱{formatPrice(Math.abs(delta)).replace(/\.00$/, '')}</span>
        <span className="sr-only">Price increased</span>
      </span>
    );
  }

  if (movement === 'decrease') {
    return (
      <span className="inline-flex items-center justify-end gap-1 whitespace-nowrap text-xs font-semibold text-green-600">
        <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />
        <span>₱{formatPrice(Math.abs(delta)).replace(/\.00$/, '')}</span>
        <span className="sr-only">Price decreased</span>
      </span>
    );
  }

  return <span className="whitespace-nowrap text-xs font-normal text-gray-500">No change</span>;
}

export function PriceConfiguration() {
  const [prices, setPrices] = useState<PriceMap>({ ...INITIAL_PRICES });
  const [savedPrices, setSavedPrices] = useState<PriceMap>({ ...INITIAL_PRICES });
  const [isLoading, setIsLoading] = useState(true);
  const [isCatalogReady, setIsCatalogReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [requestReason, setRequestReason] = useState('');
  const hasChanges = CYLINDERS.some(
    (cylinder) => prices[cylinder.id] !== savedPrices[cylinder.id],
  );

  useEffect(() => {
    let active = true;
    fetchLpgPrices()
      .then((rows) => {
        if (!active) return;
        const databasePrices = rows.reduce<PriceMap>((result, row) => {
          result[row.cylinder_size] = formatPrice(row.unit_price);
          return result;
        }, { ...INITIAL_PRICES });
        setPrices(databasePrices);
        setSavedPrices(databasePrices);
        setIsCatalogReady(true);
      })
      .catch((loadError: unknown) => {
        if (active) {
          toast.error(loadError instanceof Error ? loadError.message : 'Could not load prices.');
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handlePriceChange = (id: CylinderId, value: string) => {
    setPrices((current) => ({ ...current, [id]: value }));
  };

  const handleSave = async () => {
    if (!isCatalogReady) {
      toast.error('Reload the page before editing prices.');
      return;
    }
    const normalizedPrices = CYLINDERS.reduce<PriceMap>((result, cylinder) => {
      const amount = parsePrice(prices[cylinder.id]);
      result[cylinder.id] = amount === null ? prices[cylinder.id] : formatPrice(amount);
      return result;
    }, { ...prices });

    const hasInvalidPrice = CYLINDERS.some((cylinder) => {
      const amount = parsePrice(prices[cylinder.id]);
      return amount === null || amount <= 0;
    });

    if (hasInvalidPrice) {
      toast.error('Enter a valid price greater than zero for every cylinder size.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await apiFetch('/governance/requests', {
        method: 'POST',
        body: JSON.stringify({
          type: 'price-configuration',
          title: 'System-wide LPG price configuration',
          reason: requestReason.trim(),
          riskLevel: 'medium',
          payload: {
            prices: CYLINDERS.map((cylinder) => ({
              cylinderSize: cylinder.id,
              unitPrice: parsePrice(normalizedPrices[cylinder.id]),
            })),
          },
        }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(apiErrorMessage(data, 'Could not submit the price request.'));
      }
      setPrices({ ...savedPrices });
      setRequestReason('');
      window.dispatchEvent(new Event('notifications:refresh'));
      toast.success('Price change request submitted for Super Administrator approval.');
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Could not submit the price request.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setPrices({ ...savedPrices });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <Header
        title="LPG Pricing"
        description="Propose the standard retail price for each cylinder size. Changes apply only after Super Administrator approval."
      />

      <main className="mx-auto w-full max-w-[1540px] px-8 pb-8">
        <div className="grid gap-10 xl:grid-cols-[minmax(0,7fr)_minmax(20rem,3fr)]">
          <section aria-labelledby="cylinder-prices-heading" className="min-w-0 xl:pr-2">
            <div className="min-h-[60px]">
              <h2
                id="cylinder-prices-heading"
                className="text-lg font-semibold leading-[1.35] text-gray-900"
              >
                Cylinder prices
              </h2>
              <div className="mt-3 flex h-5 items-center gap-2 text-[13px] font-medium text-[#007BC1]">
                <Building2 aria-hidden="true" className="h-5 w-5" />
                <span>Applies to all active branches</span>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-1 gap-x-12 gap-y-7 md:grid-cols-2">
              {CYLINDERS.map((cylinder) => (
                <div key={cylinder.id}>
                  <label
                    htmlFor={`price-${cylinder.id}`}
                    className="mb-2 block text-[13.5px] font-medium leading-5 text-gray-800"
                  >
                    {cylinder.label}
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">
                      ₱
                    </span>
                    <input
                      id={`price-${cylinder.id}`}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={prices[cylinder.id]}
                      disabled={!isCatalogReady || isLoading || isSaving}
                      onChange={(event) => handlePriceChange(cylinder.id, event.target.value)}
                      aria-label={`${cylinder.label} base price in Philippine pesos`}
                      className="h-12 w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-4 text-base font-normal tabular-nums text-gray-900 outline-none transition focus:border-[#007BC1] focus:ring-2 focus:ring-[#007BC1]/20"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside
            aria-labelledby="pricing-summary-heading"
            className="min-w-0 border-t border-gray-200 pt-8 xl:border-l xl:border-t-0 xl:pl-10 xl:pt-0"
          >
            <div className="min-h-[60px]">
              <h2
                id="pricing-summary-heading"
                className="text-lg font-semibold leading-[1.35] text-gray-900"
              >
                Pricing summary
              </h2>

              <div
                aria-label="Price movement legend"
                className="mt-3 flex h-5 flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-normal text-gray-500"
              >
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-red-600" />
                  Price increased
                </span>
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-green-600" />
                  Price decreased
                </span>
              </div>
            </div>

            <div className="mt-7">
              {CYLINDERS.map((cylinder) => {
                const currentAmount = parsePrice(prices[cylinder.id]);
                const { movement, delta } = getMovement(prices[cylinder.id], savedPrices[cylinder.id]);
                const movementColor =
                  movement === 'increase'
                    ? 'text-red-600'
                    : movement === 'decrease'
                      ? 'text-green-600'
                      : 'text-gray-500';

                return (
                  <div
                    key={cylinder.id}
                    className="grid min-h-[72px] grid-cols-[1.75rem_minmax(6.5rem,1fr)_minmax(5rem,auto)_4.25rem] items-center gap-x-2 border-b border-gray-200 last:border-b-0 2xl:grid-cols-[1.75rem_minmax(7rem,1fr)_minmax(5.5rem,auto)_4.75rem] 2xl:gap-x-3"
                  >
                    <CylinderIcon className={`h-8 w-6 ${movementColor}`} />
                    <p className="whitespace-nowrap text-[13.5px] font-medium leading-5 text-gray-900">
                      {cylinder.label}
                    </p>
                    <span className="whitespace-nowrap text-right text-sm font-semibold tabular-nums text-gray-900">
                      ₱ {currentAmount === null ? '—' : formatPrice(currentAmount)}
                    </span>
                    <span className="flex justify-end">
                      <MovementIndicator movement={movement} delta={delta} />
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="mt-4 flex items-start gap-2 text-xs font-normal leading-5 text-gray-500">
              <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#007BC1]" />
              <span>Approved changes affect every branch. Current order prices remain snapshotted.</span>
            </p>

            <label className="mt-6 block text-[13.5px] font-medium text-gray-800">
              Request reason <span className="text-red-600">*</span>
              <textarea
                value={requestReason}
                onChange={(event) => setRequestReason(event.target.value)}
                rows={4}
                placeholder="Explain why this system-wide price adjustment is needed…"
                className="mt-2 w-full resize-none rounded-lg border border-gray-300 bg-white p-3 text-sm font-normal outline-none transition focus:border-[#007BC1] focus:ring-2 focus:ring-[#007BC1]/20"
              />
            </label>
          </aside>
        </div>

        <div className="mt-9 flex items-center justify-end gap-3 border-t border-gray-200 pt-5">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg px-6 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007BC1]/30"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || requestReason.trim().length < 5 || !isCatalogReady || isLoading || isSaving}
            className={`rounded-lg px-7 py-2.5 text-sm font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              hasChanges && requestReason.trim().length >= 5 && isCatalogReady && !isLoading && !isSaving
                ? 'bg-[#007BC1] hover:bg-[#006aa6] focus-visible:ring-[#007BC1]/35'
                : 'cursor-not-allowed bg-gray-400'
            }`}
          >
            {isLoading ? 'Loading…' : isSaving ? 'Submitting…' : 'Submit for approval'}
          </button>
        </div>
      </main>
    </div>
  );
}
