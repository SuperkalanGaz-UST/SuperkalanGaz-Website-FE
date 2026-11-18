export const CYLINDER_SIZES = ['2.7kg', '5kg', '11kg', '22kg', '50kg'] as const;

export type PointRates = Record<(typeof CYLINDER_SIZES)[number], number>;

export interface RewardItem {
  id: string;
  name: string;
  description: string | null;
  points_cost: number;
  is_active: boolean;
  photo_path?: string | null;
}

export interface BranchRewardItem extends RewardItem {
  stock_qty: number;
}

export function catalogPhotoUrl(path?: string | null): string | undefined {
  if (!path?.startsWith('/loyalty/catalog/photos/')) return undefined;
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
  return `${baseUrl}/api${path}`;
}
