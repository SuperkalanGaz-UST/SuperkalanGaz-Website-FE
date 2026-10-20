'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Flame, Info, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiErrorMessage, apiFetch } from '../lib/api';
import {
  CYLINDER_SIZES,
  CylinderSize,
  fetchLpgCatalog,
  fetchPricingRegions,
  LpgCatalog,
  PricingRegion,
} from '../lib/pricing';
import { Header } from './Header';
import { PricingRegionSelect } from './PricingRegionSelect';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

type PriceMap = Record<CylinderSize, string>;
const EMPTY_PRICES: PriceMap = {
  '50kg': '',
  '22kg': '',
  '11kg': '',
  '5kg': '',
  '2.7kg': '',
};

function parsePrice(value: string): number | null {
  const normalized = value.replace(/,/g, '').trim();
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0.01 && amount <= 99999999.99
    ? amount
    : null;
}

function formatPrice(amount: number): string {
  return amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function CylinderIcon() {
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex h-8 w-6 shrink-0 text-gray-500"
    >
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
        className="absolute left-1/2 top-[45%] h-[34%] w-[42%] -translate-x-1/2"
      />
    </span>
  );
}

export function PriceConfiguration() {
  const [regionCode, setRegionCode] = useState('');
  const [regions, setRegions] = useState<PricingRegion[]>([]);
  const [catalog, setCatalog] = useState<LpgCatalog | null>(null);
  const [prices, setPrices] = useState<PriceMap>({ ...EMPTY_PRICES });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const [requestReason, setRequestReason] = useState('');
  const [touched, setTouched] = useState<
    Partial<Record<CylinderSize, boolean>>
  >({});
  const [pendingRegion, setPendingRegion] = useState<string | null>(null);
  const savedPrices = new Map(
    catalog?.prices.map((price) => [price.cylinder_size, price.unit_price]) ??
      [],
  );
  const changedCount = catalog
    ? CYLINDER_SIZES.filter((size) => {
        const amount = parsePrice(prices[size]);
        return amount !== null && amount !== savedPrices.get(size);
      }).length
    : 0;
  const isDirty =
    changedCount > 0 ||
    Boolean(requestReason.trim()) ||
    (catalog !== null &&
      CYLINDER_SIZES.some((size) => parsePrice(prices[size]) === null));
  const allValid = CYLINDER_SIZES.every(
    (size) => parsePrice(prices[size]) !== null,
  );
  const regionName =
    regions.find((region) => region.code === regionCode)?.name ??
    'System-wide default';
  const canSubmit =
    catalog !== null &&
    !isLoading &&
    !isSaving &&
    allValid &&
    changedCount > 0 &&
    requestReason.trim().length >= 5;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    Promise.all([
      fetchLpgCatalog(regionCode, controller.signal),
      fetchPricingRegions(controller.signal),
    ])
      .then(([loadedCatalog, loadedRegions]) => {
        if (!active) return;
        const loadedPrices = { ...EMPTY_PRICES };
        for (const price of loadedCatalog.prices)
          loadedPrices[price.cylinder_size] = formatPrice(price.unit_price);
        setPrices(loadedPrices);
        setCatalog(loadedCatalog);
        setRegions(loadedRegions);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setCatalog(null);
        setLoadError(
          controller.signal.aborted
            ? 'Prices took too long to load. Please retry.'
            : error instanceof Error
              ? error.message
              : 'Could not load LPG prices.',
        );
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [regionCode, reload]);

  function resetChanges() {
    const saved = { ...EMPTY_PRICES };
    for (const price of catalog?.prices ?? [])
      saved[price.cylinder_size] = formatPrice(price.unit_price);
    setPrices(saved);
    setRequestReason('');
    setTouched({});
  }

  function switchRegion(next: string) {
    setCatalog(null);
    setPrices({ ...EMPTY_PRICES });
    setRequestReason('');
    setTouched({});
    setIsLoading(true);
    setLoadError(null);
    setRegionCode(next);
    setPendingRegion(null);
  }

  function selectRegion(next: string) {
    if (next === regionCode) return;
    if (isDirty) setPendingRegion(next);
    else switchRegion(next);
  }

  async function submitProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    try {
      const response = await apiFetch('/governance/requests', {
        method: 'POST',
        body: JSON.stringify({
          type: 'price-configuration',
          title: regionCode
            ? `${regionName} LPG price configuration`
            : 'System-wide LPG price configuration',
          reason: requestReason.trim(),
          payload: {
            ...(regionCode ? { regionCode } : {}),
            prices: CYLINDER_SIZES.map((size) => ({
              cylinderSize: size,
              unitPrice: parsePrice(prices[size]),
            })),
          },
        }),
        signal: AbortSignal.timeout(15000),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          apiErrorMessage(data, 'Could not submit the price proposal.'),
        );
      resetChanges();
      window.dispatchEvent(new Event('notifications:refresh'));
      toast.success(
        'Proposal submitted. Prices will change only after Super Administrator approval.',
      );
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not submit the price proposal.',
      );
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <Header
        title="LPG Pricing"
      />
      <main className="mx-auto w-full max-w-[1440px] px-4 pb-8 sm:px-8">
        <form
          onSubmit={submitProposal}
          className="rounded-xl border border-gray-200 bg-white"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 p-5 sm:p-6">
            <div className="w-full max-w-xl">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
                <span className="text-sm font-semibold text-gray-900">
                  Region
                </span>
                <div className="min-w-0 flex-1">
                  <PricingRegionSelect
                    value={regionCode}
                    regions={regions}
                    onChange={selectRegion}
                    disabled={isSaving || regions.length === 0}
                  />
                </div>
              </div>
              <p className="mt-2 text-xs leading-5 text-gray-500 sm:ml-[66px]">
                {regionCode
                  ? 'Prices apply to active branches assigned to this region.'
                  : 'Default prices apply to branches without an approved regional price list.'}
              </p>
            </div>
            {catalog && !isLoading && (
              <span className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-600">
                <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                {catalog.source === 'regional'
                  ? 'Approved regional prices loaded'
                  : 'System-wide defaults loaded'}
              </span>
            )}
          </div>
          <div className="p-5 sm:p-6">
            {isLoading ? (
              <div
                role="status"
                className="flex min-h-72 items-center justify-center gap-3 text-sm text-gray-500"
              >
                <Loader2
                  aria-hidden="true"
                  className="h-5 w-5 animate-spin text-[#007BC1]"
                />
                Loading prices…
              </div>
            ) : loadError ? (
              <div
                role="alert"
                className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
              >
                <p>{loadError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setIsLoading(true);
                    setLoadError(null);
                    setReload((value) => value + 1);
                  }}
                  className="mt-3 font-semibold underline underline-offset-4"
                >
                  Retry loading prices
                </button>
              </div>
            ) : (
              catalog && (
                <>
                  {regionCode && catalog.source === 'system-wide' && (
                    <p className="mb-5 flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs leading-5 text-[#007BC1]">
                      <Info
                        aria-hidden="true"
                        className="mt-0.5 h-4 w-4 shrink-0"
                      />
                      No regional price list has been approved yet. Current
                      prices use the system-wide default.
                    </p>
                  )}
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">
                    Cylinder prices
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left text-sm">
                      <caption className="sr-only">
                        Current and proposed cylinder prices for {regionName}
                      </caption>
                      <thead className="bg-gray-100 text-xs font-medium text-gray-500">
                        <tr>
                          <th scope="col" className="rounded-l-lg px-4 py-3">
                            Cylinder size
                          </th>
                          <th scope="col" className="px-4 py-3">
                            Current price
                          </th>
                          <th scope="col" className="px-4 py-3">
                            Proposed price
                          </th>
                          <th scope="col" className="rounded-r-lg px-4 py-3">
                            Change
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {CYLINDER_SIZES.map((size) => {
                          const amount = parsePrice(prices[size]);
                          const saved = savedPrices.get(size)!;
                          const delta =
                            amount === null
                              ? 0
                              : Math.round((amount - saved) * 100) / 100;
                          const invalid =
                            Boolean(touched[size]) && amount === null;
                          return (
                            <tr
                              key={size}
                              className={`border-b border-gray-100 ${delta !== 0 ? 'bg-blue-50/70' : ''}`}
                            >
                              <th
                                scope="row"
                                className="px-4 py-4 font-medium text-gray-900"
                              >
                                <span className="flex items-center gap-3">
                                  <CylinderIcon />
                                  {size} Cylinder
                                </span>
                              </th>
                              <td className="px-4 py-4 tabular-nums text-gray-900">
                                ₱ {formatPrice(saved)}
                              </td>
                              <td className="w-[32%] px-4 py-3">
                                <div
                                  className={`flex items-center overflow-hidden rounded-lg border bg-white focus-within:border-[#007BC1] focus-within:ring-2 focus-within:ring-[#007BC1]/20 ${invalid ? 'border-red-500' : delta !== 0 ? 'border-[#007BC1]' : 'border-gray-300'}`}
                                >
                                  <span
                                    aria-hidden="true"
                                    className="border-r border-gray-200 px-3 text-gray-500"
                                  >
                                    ₱
                                  </span>
                                  <input
                                    aria-label={`${size} Cylinder proposed price in Philippine pesos`}
                                    aria-invalid={invalid}
                                    aria-describedby={
                                      invalid
                                        ? `price-error-${size}`
                                        : undefined
                                    }
                                    inputMode="decimal"
                                    autoComplete="off"
                                    value={prices[size]}
                                    disabled={isSaving}
                                    onChange={(event) =>
                                      setPrices((current) => ({
                                        ...current,
                                        [size]: event.target.value,
                                      }))
                                    }
                                    onBlur={() => {
                                      setTouched((current) => ({
                                        ...current,
                                        [size]: true,
                                      }));
                                      if (amount !== null)
                                        setPrices((current) => ({
                                          ...current,
                                          [size]: formatPrice(amount),
                                        }));
                                    }}
                                    className="h-10 min-w-0 w-full px-3 text-sm tabular-nums text-gray-900 outline-none disabled:opacity-60"
                                  />
                                </div>
                                {invalid && (
                                  <p
                                    id={`price-error-${size}`}
                                    className="mt-1 text-xs text-red-600"
                                  >
                                    Enter a positive price with up to 2
                                    decimals.
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-4 tabular-nums">
                                {amount === null ? (
                                  <span className="text-xs text-gray-500">
                                    Invalid price
                                  </span>
                                ) : delta === 0 ? (
                                  <span className="text-gray-400">
                                    <span aria-hidden="true">—</span>
                                    <span className="sr-only">No change</span>
                                  </span>
                                ) : (
                                  <span
                                    className={`whitespace-nowrap font-semibold ${delta > 0 ? 'text-red-600' : 'text-green-600'}`}
                                  >
                                    {delta > 0 ? '+' : '−'}₱
                                    {formatPrice(Math.abs(delta))}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <label
                    htmlFor="price-request-reason"
                    className="mb-2 mt-5 block text-sm font-medium text-gray-900"
                  >
                    Reason for change <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    id="price-request-reason"
                    value={requestReason}
                    onChange={(event) => setRequestReason(event.target.value)}
                    required
                    minLength={5}
                    maxLength={1000}
                    disabled={isSaving}
                    rows={2}
                    placeholder="Explain why the price adjustment is needed…"
                    aria-describedby="price-reason-help"
                    className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm outline-none focus:border-[#007BC1] focus:ring-2 focus:ring-[#007BC1]/20 disabled:opacity-60"
                  />
                  <p
                    id="price-reason-help"
                    className="mt-1 text-xs text-gray-500"
                  >
                    Use at least 5 characters.
                  </p>
                </>
              )
            )}
          </div>
          <div className="flex flex-col gap-4 border-t border-gray-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div aria-live="polite">
              <p className="text-sm font-semibold text-gray-900">
                {changedCount} {changedCount === 1 ? 'price' : 'prices'} changed
                · {regionName}
              </p>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                Changes take effect after Super Administrator approval.
              </p>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-3">
              <button
                type="button"
                onClick={resetChanges}
                disabled={!catalog || !isDirty || isSaving || isLoading}
                className="rounded-lg px-3 py-2.5 text-sm font-semibold text-[#007BC1] outline-none hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-[#007BC1]/30 disabled:opacity-40"
              >
                Reset changes
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#007BC1] px-6 py-2.5 text-sm font-semibold text-white outline-none hover:bg-[#006aa6] focus-visible:ring-2 focus-visible:ring-[#007BC1]/35 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSaving && (
                  <Loader2
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin"
                  />
                )}
                {isSaving ? 'Submitting…' : 'Submit proposal'}
              </button>
            </div>
          </div>
        </form>
        <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-gray-500">
          <Info
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0 text-[#007BC1]"
          />
          Existing service requests retain their recorded prices.
        </p>
      </main>
      <AlertDialog
        open={pendingRegion !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRegion(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsent changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsent changes for {regionName}. Switching regions will
              discard those changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingRegion !== null) switchRegion(pendingRegion);
              }}
            >
              Discard and switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
