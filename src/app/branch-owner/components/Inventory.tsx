import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  AlertTriangle,
  Boxes,
  CircleCheck,
  PackageX,
  type LucideIcon,
} from 'lucide-react';
import { Header } from './Header';
import {
  CylinderSize,
  fetchLpgPrices,
  formatPeso,
  LpgPriceMap,
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
}

// These values remain presentation data until the branch-scoped Inventory API is connected.
const INVENTORY_ITEMS: InventoryItem[] = [
  {
    id: 'lpg-2-7kg',
    name: '2.7 KG LPG Cylinder',
    detail: 'PHP 350 retail price',
    image: '/catalog/2.7kg.png',
    category: 'lpg',
    cylinderSize: '2.7kg',
    stockUnits: 68,
    reorderThreshold: 20,
  },
  {
    id: 'lpg-5kg',
    name: '5 KG LPG Cylinder',
    detail: 'PHP 620 retail price',
    image: '/catalog/5kg.png',
    category: 'lpg',
    cylinderSize: '5kg',
    stockUnits: 52,
    reorderThreshold: 20,
  },
  {
    id: 'lpg-11kg',
    name: '11 KG LPG Cylinder',
    detail: 'PHP 1,000 retail price',
    image: '/catalog/11kg.png',
    category: 'lpg',
    cylinderSize: '11kg',
    stockUnits: 44,
    reorderThreshold: 25,
  },
  {
    id: 'lpg-22kg',
    name: '22 KG LPG Cylinder',
    detail: 'PHP 1,800 retail price',
    image: '/catalog/22kg.png',
    category: 'lpg',
    cylinderSize: '22kg',
    stockUnits: 31,
    reorderThreshold: 20,
  },
  {
    id: 'lpg-50kg',
    name: '50 KG LPG Cylinder',
    detail: 'PHP 3,500 retail price',
    image: '/catalog/50kg.png',
    category: 'lpg',
    cylinderSize: '50kg',
    stockUnits: 18,
    reorderThreshold: 20,
  },
  {
    id: 'reward-notebook',
    name: 'Notebook and Pen',
    detail: 'Household reward · 10 points',
    image: '/catalog/reward-notebook.png',
    category: 'rewards',
    stockUnits: 96,
    reorderThreshold: 30,
  },
  {
    id: 'reward-calendar',
    name: 'Desk Calendar',
    detail: 'Household reward · 20 points',
    image: '/catalog/reward-calendar.png',
    category: 'rewards',
    stockUnits: 64,
    reorderThreshold: 25,
  },
  {
    id: 'reward-umbrella',
    name: 'Umbrella',
    detail: 'Household reward · 30 points',
    image: '/catalog/reward-umbrella.png',
    category: 'rewards',
    stockUnits: 37,
    reorderThreshold: 40,
  },
  {
    id: 'reward-mug',
    name: 'Mug',
    detail: 'Household reward · 40 points',
    image: '/catalog/reward-mug.png',
    category: 'rewards',
    stockUnits: 81,
    reorderThreshold: 30,
  },
];

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
      className={`rounded-2xl border p-6 shadow-sm ${
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
    <div className="inline-flex rounded-full border border-gray-200 bg-gray-50 p-1">
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
  const targetLevel = Math.max(item.stockUnits, item.reorderThreshold * 2, 1);
  const percentage = Math.min((item.stockUnits / targetLevel) * 100, 100);
  const status = getStockStatus(item);

  return (
    <div className="min-w-[170px]">
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
    </div>
  );
}

function InventoryRow({ item }: { item: InventoryItem }) {
  const status = getStockStatus(item);

  return (
    <div className="grid grid-cols-1 gap-4 border-b border-gray-100 px-5 py-5 last:border-b-0 md:grid-cols-[minmax(260px,1.4fr)_minmax(260px,1fr)_150px] md:items-center md:px-6">
      <div className="flex items-center gap-4">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-white p-1.5">
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

      <div className="md:text-right">
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
}: {
  items: InventoryItem[];
  activeCategory: InventoryCategory;
  onChangeCategory: (category: InventoryCategory) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-gray-100 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-950">Current Inventory</h2>
          <p className="mt-1 text-sm text-gray-500">
            Read-only stock visibility for this branch, including configured reorder thresholds.
          </p>
        </div>
        <CategoryFilter activeCategory={activeCategory} onChange={onChangeCategory} />
      </div>

      <div className="hidden grid-cols-[minmax(260px,1.4fr)_minmax(260px,1fr)_150px] gap-4 bg-gray-50 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 md:grid">
        <span>Item</span>
        <span>Stock Level</span>
        <span className="text-right">Status</span>
      </div>

      <div>
        {items.map((item) => (
          <InventoryRow key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

export function Inventory() {
  const [activeCategory, setActiveCategory] = useState<InventoryCategory>('lpg');
  const [priceMap, setPriceMap] = useState<LpgPriceMap>({});

  useEffect(() => {
    let active = true;
    fetchLpgPrices()
      .then((prices) => {
        if (active) setPriceMap(toPriceMap(prices));
      })
      .catch(() => {
        // Stock visibility remains available when the independent pricing read is unavailable.
      });

    return () => {
      active = false;
    };
  }, []);

  const inventoryItems = useMemo(
    () =>
      INVENTORY_ITEMS.map((item) => {
        if (!item.cylinderSize) return item;
        const price = priceMap[item.cylinderSize];
        return {
          ...item,
          detail: price === undefined ? 'Price unavailable' : `${formatPeso(price)} retail price`,
        };
      }),
    [priceMap],
  );

  const visibleItems = inventoryItems.filter((item) => item.category === activeCategory);
  const totalStock = inventoryItems.reduce((sum, item) => sum + item.stockUnits, 0);
  const lowStockCount = inventoryItems.filter((item) => getStockStatus(item) === 'Low Stock').length;
  const outOfStockCount = inventoryItems.filter((item) => getStockStatus(item) === 'Out of Stock').length;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="sticky top-0 z-10">
        <Header title="Inventory" />
      </div>

      <main className="p-5 md:p-8">
        <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <StatCard
            title="Total On-hand Units"
            value={formatNumber(totalStock)}
            helper="LPG cylinders and reward merchandise"
            icon={Boxes}
            emphasized
          />
          <StatCard
            title="Low-stock Items"
            value={formatNumber(lowStockCount)}
            helper="At or below the configured reorder threshold"
            icon={AlertTriangle}
          />
          <StatCard
            title="Out-of-stock Items"
            value={formatNumber(outOfStockCount)}
            helper={outOfStockCount === 0 ? 'All catalog items remain available' : 'Items requiring attention'}
            icon={outOfStockCount === 0 ? CircleCheck : PackageX}
          />
        </div>

        <InventoryList
          items={visibleItems}
          activeCategory={activeCategory}
          onChangeCategory={setActiveCategory}
        />
      </main>
    </div>
  );
}
