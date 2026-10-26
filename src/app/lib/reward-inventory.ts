import { fetchJson } from './api';

export interface RewardStockRow {
  branch_id: string;
  catalog_item_id: string;
  item_name: string;
  description: string | null;
  category: 'rewards';
  points_cost: number;
  current_qty: number;
  threshold_qty: number;
  capacity_qty: number;
}

export async function fetchRewardStock(branchId: string, owner: boolean, signal?: AbortSignal): Promise<RewardStockRow[]> {
  if (!branchId) throw new Error('Select a branch to load its reward inventory.');
  const query = new URLSearchParams({ branchId });
  const timeout = AbortSignal.timeout(10_000);
  const data = await fetchJson<{ rewardStockLevels: RewardStockRow[] }>(
    `/inventory/reward-stock-levels${owner ? '/owner' : ''}?${query}`,
    { signal: signal ? AbortSignal.any([signal, timeout]) : timeout },
  );
  if (!Array.isArray(data?.rewardStockLevels) || data.rewardStockLevels.some((row) => row.branch_id !== branchId)) {
    throw new Error('The reward inventory response did not match the selected branch.');
  }
  return data.rewardStockLevels;
}

export async function intakeRewardStock(branchId: string, catalogItemId: string, receivedQty: number): Promise<RewardStockRow> {
  const data = await fetchJson<{ rewardStockLevel: RewardStockRow }>('/inventory/reward-stock-levels/intake', {
    method: 'POST', body: JSON.stringify({ branchId, catalogItemId, receivedQty }),
    signal: AbortSignal.timeout(10_000),
  });
  if (data.rewardStockLevel?.branch_id !== branchId) throw new Error('The updated reward did not match the selected branch.');
  return data.rewardStockLevel;
}
