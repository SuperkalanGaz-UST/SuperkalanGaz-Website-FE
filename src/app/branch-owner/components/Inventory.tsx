import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import {
  AlertTriangle,
  Boxes,
  CircleCheck,
  PackageX,
  type LucideIcon,
} from 'lucide-react';
import { Header } from './Header';
import { useBranch } from '../contexts/BranchContext';
import { fetchJson } from '../../lib/api';
import { fetchRewardStock } from '../../lib/reward-inventory';
import styles from './Inventory.module.css';
import {
  CylinderSize,
  fetchLpgPrices,
  formatPeso,
  toPriceMap,
} from '../../lib/pricing';

type InventoryCategory = 'lpg' | 'rewards';
type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';

interface InventoryItem {
  id: string;
  name: string;
  detail: string;
  image: string;
  category: InventoryCategory;
  cylinderSize?: CylinderSize;
  stockUnits: number;
  reorderThreshold: number;
  capacityUnits: number;
}

interface StockLevelRow {
  branch_id: string;
  product_id: string;
  product_name: string;
  cylinder_size: CylinderSize;
  current_qty: number;
  threshold_qty: number;
  capacity_qty: number;
}

// Presentation assets only; all stock, thresholds, names, and capacities come from the API.
const CYLINDER_IMAGES: Record<CylinderSize, string> = {
  '2.7kg': '/catalog/2.7kg.png',
  '5kg': '/catalog/5kg.png',
  '11kg': '/catalog/11kg.png',
  '22kg': '/catalog/22kg.png',
  '50kg': '/catalog/50kg.png',
};

// Historical presentation fixture retained at the client's request. Never rendered.
const INVENTORY_ITEMS: InventoryItem[] = [
  { id: 'lpg-2-7kg', name: '2.7 KG LPG Cylinder', detail: 'PHP 350 retail price', image: '/catalog/2.7kg.png', category: 'lpg', cylinderSize: '2.7kg', stockUnits: 68, reorderThreshold: 20, capacityUnits: 100 },
  { id: 'lpg-5kg', name: '5 KG LPG Cylinder', detail: 'PHP 620 retail price', image: '/catalog/5kg.png', category: 'lpg', cylinderSize: '5kg', stockUnits: 52, reorderThreshold: 20, capacityUnits: 100 },
  { id: 'lpg-11kg', name: '11 KG LPG Cylinder', detail: 'PHP 1,000 retail price', image: '/catalog/11kg.png', category: 'lpg', cylinderSize: '11kg', stockUnits: 44, reorderThreshold: 25, capacityUnits: 100 },
  { id: 'lpg-22kg', name: '22 KG LPG Cylinder', detail: 'PHP 1,800 retail price', image: '/catalog/22kg.png', category: 'lpg', cylinderSize: '22kg', stockUnits: 31, reorderThreshold: 20, capacityUnits: 100 },
  { id: 'lpg-50kg', name: '50 KG LPG Cylinder', detail: 'PHP 3,500 retail price', image: '/catalog/50kg.png', category: 'lpg', cylinderSize: '50kg', stockUnits: 18, reorderThreshold: 20, capacityUnits: 100 },
  { id: 'reward-notebook', name: 'Notebook and Pen', detail: 'Household reward · 10 points', image: '/catalog/reward-notebook.png', category: 'rewards', stockUnits: 96, reorderThreshold: 30, capacityUnits: 100 },
  { id: 'reward-calendar', name: 'Desk Calendar', detail: 'Household reward · 20 points', image: '/catalog/reward-calendar.png', category: 'rewards', stockUnits: 64, reorderThreshold: 25, capacityUnits: 100 },
  { id: 'reward-umbrella', name: 'Umbrella', detail: 'Household reward · 30 points', image: '/catalog/reward-umbrella.png', category: 'rewards', stockUnits: 37, reorderThreshold: 40, capacityUnits: 100 },
  { id: 'reward-mug', name: 'Mug', detail: 'Household reward · 40 points', image: '/catalog/reward-mug.png', category: 'rewards', stockUnits: 81, reorderThreshold: 30, capacityUnits: 100 },
];

const REWARD_IMAGES: Record<string, string> = {
  'notebook and pen': '/catalog/reward-notebook.png', 'desk calendar': '/catalog/reward-calendar.png',
  umbrella: '/catalog/reward-umbrella.png', mug: '/catalog/reward-mug.png',
};

const FILTERS: { value: InventoryCategory; label: string }[] = [
  { value: 'lpg', label: 'LPG Cylinders' },
  { value: 'rewards', label: 'Reward Merchandise' },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function getStockStatus(item: InventoryItem): StockStatus {
  if (item.stockUnits === 0) return 'Out of Stock';
  if (item.stockUnits <= item.reorderThreshold) return 'Low Stock';
  return 'In Stock';
}

function getStatusClasses(status: StockStatus) {
  if (status === 'In Stock') {
    return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  }

  if (status === 'Low Stock') {
    return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
  }

  return 'bg-red-50 text-red-700 ring-1 ring-red-200';
}

function StatCard({
  title,
  value,
  helper,
  icon: Icon,
  emphasized = false,
}: {
  title: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`${styles.metric} rounded-2xl border p-6 shadow-sm ${
        emphasized
          ? 'border-[#007BC1] bg-[#007BC1] text-white'
          : 'border-gray-100 bg-white text-gray-950'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`text-sm font-medium ${emphasized ? 'text-white/80' : 'text-gray-500'}`}>
            {title}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-normal">{value}</p>
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            emphasized ? 'bg-white/15 text-white' : 'bg-[#E8F5FC] text-[#007BC1]'
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className={`mt-4 text-sm ${emphasized ? 'text-white/80' : 'text-gray-500'}`}>
        {helper}
      </p>
    </div>
  );
}

function CategoryFilter({
  activeCategory,
  onChange,
}: {
  activeCategory: InventoryCategory;
  onChange: (category: InventoryCategory) => void;
}) {
  return (
    <div className={`${styles.filters} inline-flex rounded-full border border-gray-200 bg-gray-50 p-1`}>
      {FILTERS.map((filter) => {
        const isActive = activeCategory === filter.value;

        return (
          <button
            key={filter.value}
            type="button"
            onClick={() => onChange(filter.value)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              isActive ? 'bg-[#007BC1] text-white shadow-sm' : 'text-gray-600 hover:text-[#007BC1]'
            }`}
            aria-pressed={isActive}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}

function StockLevel({ item }: { item: InventoryItem }) {
  const targetLevel = Math.max(item.capacityUnits, item.stockUnits, 1);
  const percentage = Math.min((item.stockUnits / targetLevel) * 100, 100);
  const status = getStockStatus(item);

  return (
    <div className={`${styles.stockLevel} min-w-[170px]`}>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-gray-950">{formatNumber(item.stockUnits)} units</span>
        <span className="text-gray-500">Threshold: {formatNumber(item.reorderThreshold)}</span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-label={`${item.name} stock level`}
        aria-valuemin={0}
        aria-valuemax={targetLevel}
        aria-valuenow={item.stockUnits}
      >
        <div
          className={`h-full rounded-full transition-all ${
            status === 'In Stock'
              ? 'bg-emerald-500'
              : status === 'Low Stock'
                ? 'bg-amber-500'
                : 'bg-red-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className={styles.capacity}>Capacity: {formatNumber(item.capacityUnits)} units</p>
    </div>
  );
}

function InventoryRow({ item }: { item: InventoryItem }) {
  const status = getStockStatus(item);

  return (
    <div data-inventory-item={item.id} className={`${styles.inventoryRow} border-b border-gray-100 last:border-b-0`}>
      <div className={`${styles.identity} flex items-center gap-4`}>
        <div className={`${styles.image} relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-white p-1.5`}>
          <Image
            src={item.image}
            alt={item.name}
            width={64}
            height={64}
            className="h-full w-full object-contain"
          />
        </div>
        <div>
          <p className="font-semibold text-gray-950">{item.name}</p>
          <p className="mt-1 text-sm text-gray-500">{item.detail}</p>
        </div>
      </div>

      <StockLevel item={item} />

      <div className={styles.status}>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(status)}`}>
          {status}
        </span>
      </div>
    </div>
  );
}

function InventoryList({
  items,
  activeCategory,
  onChangeCategory,
  loading,
  error,
  onRetry,
  rewardsReady,
}: {
  items: InventoryItem[];
  activeCategory: InventoryCategory;
  onChangeCategory: (category: InventoryCategory) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  rewardsReady: boolean;
}) {
  return (
    <section className={`${styles.list} overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm`}>
      <div className={`${styles.listHeader} flex flex-col gap-4 border-b border-gray-100 py-5 md:flex-row md:items-center md:justify-between`}>
        <div>
          <h2 className="text-lg font-semibold text-gray-950">Current Inventory</h2>
          <p className="mt-1 text-sm text-gray-500">
            Read-only stock visibility for this branch, including configured reorder thresholds.
          </p>
        </div>
        <CategoryFilter activeCategory={activeCategory} onChange={onChangeCategory} />
      </div>

      <div className={`${styles.columnHead} bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500`}>
        <span>Item</span>
        <span>Stock Level</span>
        <span>Status</span>
      </div>

      <div>
        {activeCategory === 'rewards' && !rewardsReady && !loading && !error ? (
          <p className={`${styles.state} px-5 py-5 text-sm text-gray-500 md:px-6`}>Reward inventory is unavailable</p>
        ) : loading ? (
          <p role="status" className={`${styles.state} px-5 py-5 text-sm text-gray-500 md:px-6`}>Loading stock levels…</p>
        ) : error ? (
          <div role="alert" className={`${styles.state} px-5 py-5 text-sm text-gray-500 md:px-6`}>
            <p>{error}</p>
            <button type="button" onClick={onRetry} className="mt-2 font-semibold text-[#007BC1]">Try again</button>
          </div>
        ) : items.length === 0 ? (
          <p className={`${styles.state} px-5 py-5 text-sm text-gray-500 md:px-6`}>{activeCategory === 'rewards' ? 'No active reward merchandise in this branch’s catalog.' : 'No inventory items are available for this branch.'}</p>
        ) : items.map((item) => (
          <InventoryRow key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

export function Inventory() {
  const { selectedBranchId, assignedBranchesLoading, assignedBranchesError } = useBranch();
  const [activeCategory, setActiveCategory] = useState<InventoryCategory>('lpg');
  const rewardQuery = useQuery({
    queryKey: ['owner-reward-inventory', selectedBranchId],
    enabled: !!selectedBranchId && !assignedBranchesLoading && !assignedBranchesError,
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: ({ signal }) => {
      if (!selectedBranchId) throw new Error('Select a branch to load its reward inventory.');
      return fetchRewardStock(selectedBranchId, true, signal);
    },
  });
  const rewardsLoading = rewardQuery.isPending || rewardQuery.isFetching;
  const rewardsAvailable = !rewardsLoading && !rewardQuery.isError;
  const rewardItems = useMemo(() => (rewardsAvailable ? rewardQuery.data ?? [] : []).map((row): InventoryItem => ({
    id: `reward:${row.catalog_item_id}`, name: row.item_name, category: 'rewards',
    image: REWARD_IMAGES[row.item_name.toLowerCase()] ?? '/logo%20only.png',
    detail: `Household reward · ${formatNumber(row.points_cost)} points`,
    stockUnits: row.current_qty, reorderThreshold: row.threshold_qty, capacityUnits: row.capacity_qty,
  })), [rewardsAvailable, rewardQuery.data]);
  const stockQuery = useQuery({
    queryKey: ['owner-inventory', selectedBranchId],
    enabled: !!selectedBranchId && !assignedBranchesLoading && !assignedBranchesError,
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => {
      if (!selectedBranchId) throw new Error('Select a branch to load its inventory.');
      const query = new URLSearchParams({ branchId: selectedBranchId });
      const data = await fetchJson<{ stockLevels: StockLevelRow[] }>(
        `/inventory/stock-levels/owner?${query}`,
        { signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) },
      );
      // Fail closed if a response does not belong to the selected branch.
      if (!Array.isArray(data?.stockLevels) || data.stockLevels.some((row) => row.branch_id !== selectedBranchId)) {
        throw new Error('The inventory response did not match the selected branch.');
      }
      return data.stockLevels;
    },
  });
  const priceQuery = useQuery({
    queryKey: ['owner-inventory-prices', selectedBranchId],
    enabled: !!selectedBranchId && !assignedBranchesLoading && !assignedBranchesError,
    queryFn: () => {
      if (!selectedBranchId) throw new Error('Select a branch to load its prices.');
      return fetchLpgPrices(selectedBranchId);
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const priceMap = useMemo(
    () => priceQuery.isError ? undefined : toPriceMap(priceQuery.data ?? []),
    [priceQuery.data, priceQuery.isError],
  );
  const loading = stockQuery.isPending || stockQuery.isFetching;
  const stockAvailable = !loading && !stockQuery.isError;

  const inventoryItems = useMemo(
    () =>
      (stockAvailable ? stockQuery.data ?? [] : []).slice().sort((a, b) => {
        const firstPrice = priceMap?.[a.cylinder_size] ?? Number.POSITIVE_INFINITY;
        const secondPrice = priceMap?.[b.cylinder_size] ?? Number.POSITIVE_INFINITY;
        // Items without a retail price follow the priced items.
        return firstPrice === secondPrice ? 0 : firstPrice < secondPrice ? -1 : 1;
      }).map((row): InventoryItem => {
        const price = priceMap?.[row.cylinder_size];
        return {
          id: row.product_id,
          name: row.product_name,
          image: CYLINDER_IMAGES[row.cylinder_size] ?? '/logo%20only.png',
          category: 'lpg',
          cylinderSize: row.cylinder_size,
          stockUnits: row.current_qty,
          reorderThreshold: row.threshold_qty,
          capacityUnits: row.capacity_qty,
          detail: price === undefined ? 'Price unavailable' : `${formatPeso(price)} retail price`,
        };
      }).concat(rewardItems),
    [stockQuery.data, stockAvailable, priceMap, rewardItems],
  );

  const visibleItems = inventoryItems.filter((item) => item.category === activeCategory);
  const totalStock = inventoryItems.reduce((sum, item) => sum + item.stockUnits, 0);
  const lowStockCount = inventoryItems.filter((item) => getStockStatus(item) === 'Low Stock').length;
  const outOfStockCount = inventoryItems.filter((item) => getStockStatus(item) === 'Out of Stock').length;

  return (
    <div className={`${styles.page} flex-1 overflow-y-auto bg-gray-50`}>
      <Header title="Inventory" />

      <main className={`${styles.workspace} p-5 md:p-8`}>
        {assignedBranchesLoading ? (
          <p role="status" className="text-sm text-gray-500">Validating assigned branches…</p>
        ) : assignedBranchesError ? (
          <p role="alert" className="text-sm text-gray-500">{assignedBranchesError}</p>
        ) : !selectedBranchId ? (
          <p className="text-sm text-gray-500">Select an assigned branch to view its inventory.</p>
        ) : (
          <>
            <div className={`${styles.metrics} mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3`}>
              <StatCard
                title="Total On-hand Units"
                value={stockAvailable ? formatNumber(totalStock) : '—'}
                helper={rewardsAvailable ? 'LPG cylinders and reward merchandise' : rewardsLoading ? 'LPG subtotal · loading reward stock' : 'LPG cylinders · reward inventory unavailable'}
                icon={Boxes}
                emphasized
              />
              <StatCard
                title="Low-stock Items"
                value={stockAvailable ? formatNumber(lowStockCount) : '—'}
                helper="At or below the configured reorder threshold"
                icon={AlertTriangle}
              />
              <StatCard
                title="Out-of-stock Items"
                value={stockAvailable ? formatNumber(outOfStockCount) : '—'}
                helper={
                  !stockAvailable ? 'Waiting for inventory data'
                    : outOfStockCount === 0 ? rewardsAvailable ? 'All catalog items remain available' : 'All LPG items remain available'
                      : 'Items requiring attention'
                }
                icon={outOfStockCount === 0 ? CircleCheck : PackageX}
              />
            </div>

            {stockAvailable && !rewardsAvailable && (
              <p className={styles.partialNote}>
                {rewardsLoading ? 'Showing LPG totals while reward stock loads.' : 'Showing LPG totals only. Reward stock is currently unavailable.'}
              </p>
            )}

            <InventoryList
              items={visibleItems}
              activeCategory={activeCategory}
              onChangeCategory={setActiveCategory}
              loading={activeCategory === 'rewards' ? rewardsLoading : loading}
              error={activeCategory === 'rewards' ? rewardQuery.isError ? rewardQuery.error.message : null : stockQuery.isError ? stockQuery.error.message : null}
              onRetry={() => void (activeCategory === 'rewards' ? rewardQuery.refetch() : stockQuery.refetch())}
              rewardsReady={rewardsAvailable}
            />
          </>
        )}
      </main>
    </div>
  );
}
