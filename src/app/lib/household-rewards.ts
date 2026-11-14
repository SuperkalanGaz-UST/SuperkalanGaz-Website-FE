export const CYLINDER_SIZES = ['2.7kg', '5kg', '11kg', '22kg', '50kg'] as const;

export type PointRates = Record<(typeof CYLINDER_SIZES)[number], number>;

export interface RewardItem {
  id: string;
  name: string;
  description: string | null;
  points_cost: number;
  is_active: boolean;
}

export interface BranchRewardItem extends RewardItem {
  stock_qty: number;
}
