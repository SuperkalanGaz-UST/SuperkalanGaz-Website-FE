import { apiErrorMessage, apiFetch } from './api';

export const CYLINDER_SIZES = ['50kg', '22kg', '11kg', '5kg', '2.7kg'] as const;
export type CylinderSize = (typeof CYLINDER_SIZES)[number];

export interface LpgPrice {
  id: string;
  cylinder_size: CylinderSize;
  unit_price: number;
  updated_at: string;
}

export type LpgPriceMap = Partial<Record<CylinderSize, number>>;

export interface PricingRegion {
  code: string;
  name: string;
}
export interface LpgCatalog {
  prices: LpgPrice[];
  source: 'regional' | 'system-wide';
}

export function formatPeso(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function toPriceMap(prices: LpgPrice[]): LpgPriceMap {
  return Object.fromEntries(
    prices.map((price) => [price.cylinder_size, price.unit_price]),
  );
}

export function parsePriceEnvelope(data: unknown): LpgPrice[] {
  if (
    !data ||
    typeof data !== 'object' ||
    !Array.isArray((data as { prices?: unknown }).prices)
  ) {
    throw new Error('The pricing response was invalid.');
  }

  const rows = (data as { prices: unknown[] }).prices.map((row) => {
    if (!row || typeof row !== 'object')
      throw new Error('The pricing response was invalid.');
    const price = row as LpgPrice;
    const amount = Number(price.unit_price);
    if (
      !CYLINDER_SIZES.includes(price.cylinder_size) ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      throw new Error('The pricing response was invalid.');
    }
    return { ...price, unit_price: amount };
  });
  if (
    rows.length !== CYLINDER_SIZES.length ||
    new Set(rows.map((row) => row.cylinder_size)).size !== CYLINDER_SIZES.length
  ) {
    throw new Error('The cylinder price list is incomplete. Please retry.');
  }
  return rows;
}

export async function fetchLpgPrices(branchId?: string): Promise<LpgPrice[]> {
  const response = await apiFetch(
    branchId ? `/prices/for-branch/${encodeURIComponent(branchId)}` : '/prices',
  );
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(apiErrorMessage(data, 'Could not load LPG prices.'));
  return parsePriceEnvelope(data);
}

export async function fetchAssignedLpgPrices(): Promise<LpgPrice[]> {
  const response = await apiFetch('/prices/assigned');
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(apiErrorMessage(data, 'Could not load branch LPG prices.'));
  return parsePriceEnvelope(data);
}

export async function fetchLpgCatalog(
  regionCode: string,
  signal?: AbortSignal,
): Promise<LpgCatalog> {
  const response = await apiFetch(
    `/prices${regionCode ? `?regionCode=${encodeURIComponent(regionCode)}` : ''}`,
    { signal },
  );
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(apiErrorMessage(data, 'Could not load LPG prices.'));
  const prices = parsePriceEnvelope(data);
  const source = (data as { source?: unknown }).source;
  if (source !== 'regional' && source !== 'system-wide')
    throw new Error('The pricing response was invalid.');
  return { prices, source };
}

export async function fetchPricingRegions(
  signal?: AbortSignal,
): Promise<PricingRegion[]> {
  const response = await apiFetch('/prices/regions', { signal });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      apiErrorMessage(data, 'Could not load Philippine regions.'),
    );
  const rows =
    data && typeof data === 'object'
      ? (data as { regions?: unknown }).regions
      : null;
  if (
    !Array.isArray(rows) ||
    rows.length === 0 ||
    rows.some(
      (row) =>
        !row || typeof row.code !== 'string' || typeof row.name !== 'string',
    )
  ) {
    throw new Error('The region list was invalid.');
  }
  return rows as PricingRegion[];
}
