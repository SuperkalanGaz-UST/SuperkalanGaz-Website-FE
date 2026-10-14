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

export function formatPeso(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function toPriceMap(prices: LpgPrice[]): LpgPriceMap {
  return Object.fromEntries(prices.map((price) => [price.cylinder_size, price.unit_price]));
}

export function parsePriceEnvelope(data: unknown): LpgPrice[] {
  if (!data || typeof data !== 'object' || !Array.isArray((data as { prices?: unknown }).prices)) {
    throw new Error('The pricing response was invalid.');
  }

  return (data as { prices: LpgPrice[] }).prices.map((price) => ({
    ...price,
    unit_price: Number(price.unit_price),
  }));
}

export async function fetchLpgPrices(): Promise<LpgPrice[]> {
  const response = await apiFetch('/prices');
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(apiErrorMessage(data, 'Could not load LPG prices.'));
  return parsePriceEnvelope(data);
}
