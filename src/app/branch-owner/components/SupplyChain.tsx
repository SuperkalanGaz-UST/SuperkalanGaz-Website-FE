import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Package,
  TrendingUp,
  Trophy,
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

type CatalogCategory = 'lpg' | 'rewards';

interface CatalogItem {
  id: string;
  name: string;
  detail: string;
  image: string;
  category: CatalogCategory;
  cylinderSize?: CylinderSize;
  metricLabel: 'Orders' | 'Redeemed';
  metricValue: number;
  stockUnits: number;
  performance: number;
  badge: 'Excellent' | 'Good' | 'Low Activity';
}

// Popularity and stock remain demo metrics; LPG prices are replaced from the
// shared database catalog before these rows render.
const CATALOG_ITEMS: CatalogItem[] = [
  {
    id: 'lpg-2-7kg',
    name: '2.7 KG LPG Cylinder',
    detail: 'PHP 350 mobile catalog price',
    image: '/catalog/2.7kg.png',
    category: 'lpg',
    cylinderSize: '2.7kg',
    metricLabel: 'Orders',
    metricValue: 842,
    stockUnits: 68,
    performance: 70,
    badge: 'Good',
  },
  {
    id: 'lpg-5kg',
    name: '5 KG LPG Cylinder',
    detail: 'PHP 620 mobile catalog price',
    image: '/catalog/5kg.png',
    category: 'lpg',
    cylinderSize: '5kg',
    metricLabel: 'Orders',
    metricValue: 936,
    stockUnits: 52,
    performance: 78,
    badge: 'Good',
  },
  {
    id: 'lpg-11kg',
    name: '11 KG LPG Cylinder',
    detail: 'PHP 1,000 mobile catalog price',
    image: '/catalog/11kg.png',
    category: 'lpg',
    cylinderSize: '11kg',
    metricLabel: 'Orders',
    metricValue: 1204,
    stockUnits: 44,
    performance: 96,
    badge: 'Excellent',
  },
  {
    id: 'lpg-22kg',
    name: '22 KG LPG Cylinder',
    detail: 'PHP 1,800 mobile catalog price',
    image: '/catalog/22kg.png',
    category: 'lpg',
    cylinderSize: '22kg',
    metricLabel: 'Orders',
    metricValue: 527,
    stockUnits: 31,
    performance: 44,
    badge: 'Good',
  },
  {
    id: 'lpg-50kg',
    name: '50 KG LPG Cylinder',
    detail: 'PHP 3,500 mobile catalog price',
    image: '/catalog/50kg.png',
    category: 'lpg',
    cylinderSize: '50kg',
    metricLabel: 'Orders',
    metricValue: 184,
    stockUnits: 18,
    performance: 15,
    badge: 'Low Activity',
  },
  {
    id: 'reward-notebook',
    name: 'Free Notebook and Pen',
    detail: '10 points',
    image: '/catalog/reward-notebook.png',
    category: 'rewards',
    metricLabel: 'Redeemed',
    metricValue: 734,
    stockUnits: 96,
    performance: 92,
    badge: 'Excellent',
  },
  {
    id: 'reward-calendar',
    name: 'Free Desk Calendar',
    detail: '20 points',
    image: '/catalog/reward-calendar.png',
    category: 'rewards',
    metricLabel: 'Redeemed',
    metricValue: 523,
    stockUnits: 64,
    performance: 75,
    badge: 'Good',
  },
  {
    id: 'reward-umbrella',
    name: 'Free Umbrella',
    detail: '30 points',
    image: '/catalog/reward-umbrella.png',
    category: 'rewards',
    metricLabel: 'Redeemed',
    metricValue: 682,
    stockUnits: 37,
    performance: 88,
    badge: 'Excellent',
  },
  {
    id: 'reward-mug',
    name: 'Free Mug',
    detail: '40 points',
    image: '/catalog/reward-mug.png',
    category: 'rewards',
    metricLabel: 'Redeemed',
    metricValue: 416,
    stockUnits: 81,
    performance: 64,
    badge: 'Good',
  },
];

const FILTERS: { value: CatalogCategory; label: string }[] = [
  { value: 'lpg', label: 'LPG Products' },
  { value: 'rewards', label: 'Household Rewards' },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function getBadgeClasses(badge: CatalogItem['badge']) {
  if (badge === 'Excellent') {
    return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  }

  if (badge === 'Good') {
    return 'bg-[#E8F5FC] text-[#005F95] ring-1 ring-[#BFE4F7]';
  }

  return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
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
          <p className={`text-sm font-medium ${emphasized ? 'text-white/80' : 'text-gray-500'}`}>{title}</p>
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
      <p className={`mt-4 text-sm ${emphasized ? 'text-white/80' : 'text-gray-500'}`}>{helper}</p>
    </div>
  );
}

function CategoryFilter({
  activeCategory,
  onChange,
}: {
  activeCategory: CatalogCategory;
  onChange: (category: CatalogCategory) => void;
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

function PerformanceBar({ value }: { value: number }) {
  return (
    <div className="flex min-w-[160px] items-center gap-3">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-[#007BC1] transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-10 text-right text-sm font-semibold text-gray-700">{value}%</span>
    </div>
  );
}

function CatalogRow({ item }: { item: CatalogItem }) {
  return (
    // Rows are read-only analytics: no reorder, stock intake, or transaction controls.
    <div className="grid grid-cols-1 gap-4 border-b border-gray-100 px-5 py-5 last:border-b-0 md:grid-cols-[minmax(220px,1.4fr)_minmax(190px,1fr)_minmax(220px,1fr)_120px] md:items-center md:px-6">
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

      <div>
        <p className="text-sm font-semibold text-gray-950">
          {formatNumber(item.metricValue)} {item.metricLabel}
        </p>
        <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getBadgeClasses(item.badge)}`}>
          {item.badge}
        </span>
      </div>

      <PerformanceBar value={item.performance} />

      <div className="md:text-right">
        <p className="text-sm text-gray-500">Stock Status</p>
        <p className="mt-1 font-semibold text-gray-950">{formatNumber(item.stockUnits)} Units</p>
      </div>
    </div>
  );
}

function CatalogList({
  items,
  activeCategory,
  onChangeCategory,
}: {
  items: CatalogItem[];
  activeCategory: CatalogCategory;
  onChangeCategory: (category: CatalogCategory) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-gray-100 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-950">Product & Merchandise List</h2>
          <p className="mt-1 text-sm text-gray-500">Read-only popularity, redemption, and physical availability signals.</p>
        </div>
        <CategoryFilter activeCategory={activeCategory} onChange={onChangeCategory} />
      </div>

      <div className="hidden grid-cols-[minmax(220px,1.4fr)_minmax(190px,1fr)_minmax(220px,1fr)_120px] gap-4 bg-gray-50 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 md:grid">
        <span>Item</span>
        <span>Performance Metric</span>
        <span>Popularity Rate</span>
        <span className="text-right">Availability</span>
      </div>

      <div>
        {items.map((item) => (
          <CatalogRow key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

export function SupplyChain() {
  const [activeCategory, setActiveCategory] = useState<CatalogCategory>('lpg');
  const [priceMap, setPriceMap] = useState<LpgPriceMap>({});

  useEffect(() => {
    let active = true;
    fetchLpgPrices()
      .then((prices) => {
        if (active) setPriceMap(toPriceMap(prices));
      })
      .catch(() => {
        // This read-only analytics screen keeps its other metrics available if
        // pricing is temporarily unreachable; missing prices render as unavailable.
      });
    return () => {
      active = false;
    };
  }, []);

  const catalogItems = useMemo(
    () =>
      CATALOG_ITEMS.map((item) => {
        if (!item.cylinderSize) return item;
        const price = priceMap[item.cylinderSize];
        return { ...item, detail: price === undefined ? 'Price unavailable' : `${formatPeso(price)} retail price` };
      }),
    [priceMap],
  );

  const winningProduct = useMemo(
    () => catalogItems.reduce((winner, item) => (item.metricValue > winner.metricValue ? item : winner)),
    [catalogItems],
  );

  const visibleItems = catalogItems.filter((item) => item.category === activeCategory);
  const totalActivity = catalogItems.reduce((sum, item) => sum + item.metricValue, 0);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="sticky top-0 z-10">
        <Header title="Catalog & Rewards Performance" />
      </div>

      <main className="p-5 md:p-8">
        <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <StatCard
            title="Active Catalog Items"
            value={formatNumber(catalogItems.length)}
            helper="LPG variants and household rewards"
            icon={Package}
          />
          <StatCard
            title="Winning Product"
            value={winningProduct.name}
            helper={`${formatNumber(winningProduct.metricValue)} ${winningProduct.metricLabel.toLowerCase()} this period`}
            icon={TrendingUp}
            emphasized
          />
          <StatCard
            title="Total Items Redeemed/Sold"
            value={formatNumber(totalActivity)}
            helper="Aggregated LPG orders and reward redemptions"
            icon={Trophy}
          />
        </div>

        <CatalogList
          items={visibleItems}
          activeCategory={activeCategory}
          onChangeCategory={setActiveCategory}
        />
      </main>
    </div>
  );
}
