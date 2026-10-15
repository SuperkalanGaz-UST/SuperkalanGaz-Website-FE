'use client';

import { useEffect, useState } from 'react';
import { fetchPricingRegions, PricingRegion } from '../lib/pricing';
import { PricingRegionSelect } from './PricingRegionSelect';

export function BranchPricingRegionField({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [regions, setRegions] = useState<PricingRegion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    fetchPricingRegions(controller.signal)
      .then((rows) => {
        if (active) {
          setRegions(rows);
          setError(null);
        }
      })
      .catch(() => {
        if (active) setError('Could not load pricing regions.');
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [reload]);
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-gray-500">Pricing region</p>
      <PricingRegionSelect
        value={value}
        onChange={onChange}
        regions={regions}
        disabled={disabled || regions.length === 0}
      />
      <p className="mt-1 text-xs leading-5 text-gray-500">
        Uses this region&apos;s approved LPG prices. System-wide defaults apply
        until a regional list is approved.
      </p>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}{' '}
          <button
            type="button"
            onClick={() => setReload((current) => current + 1)}
            className="underline"
          >
            Retry
          </button>
        </p>
      )}
    </div>
  );
}
