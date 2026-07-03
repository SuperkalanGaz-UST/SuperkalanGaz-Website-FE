import { Header } from './Header';
import { ReorderRequestLog } from './ReorderRequestLog';
import { useBranchData } from '../hooks/useBranchData';
import { useBranch } from '../contexts/BranchContext';

interface InventoryCardProps {
  title: string;
  current: number;
  total: number;
  threshold: number;
}

function InventoryCard({ title, current, total, threshold }: InventoryCardProps) {
  const percentage = (current / total) * 100;
  const isLowStock = current <= threshold && current > threshold / 2;
  const isCritical = current <= threshold / 2;

  let barColor = '#22c55e'; // green
  let statusLabel = null;
  let statusColor = '';

  if (isCritical) {
    barColor = '#ef4444'; // red
    statusLabel = 'Critical';
    statusColor = 'text-red-600';
  } else if (isLowStock) {
    barColor = '#f59e0b'; // orange
    statusLabel = 'Low Stock';
    statusColor = 'text-orange-500';
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6" style={{ borderLeft: `4px solid ${barColor}` }}>
      <div className="flex items-start justify-between mb-4">
        <h4 className="text-sm font-medium text-gray-900">{title}</h4>
        <div className="text-right">
          <span className="text-3xl font-semibold text-gray-900">{current}</span>
          <span className="text-xl text-gray-400"> / {total}</span>
        </div>
      </div>

      <div className="mb-3">
        <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${percentage}%`, backgroundColor: barColor }}
          ></div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">Threshold: {threshold}</span>
        {statusLabel && (
          <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
        )}
      </div>
    </div>
  );
}

export function SupplyChain() {
  const { selectedBranch } = useBranch();
  const branchData = useBranchData();
  const stockLevel = branchData.stockLevel;

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header
          title="Inventory"
          subtitle="Monitor stock levels and manage reorder requests."
        />
      </div>

      <div className="p-8">
        <div className="grid grid-cols-3 gap-6 mb-8">
          <InventoryCard
            title="2.7kg LPG Tank"
            current={Math.floor(stockLevel * 1.07)}
            total={100}
            threshold={20}
          />
          <InventoryCard
            title="5kg LPG Tank"
            current={Math.floor(stockLevel * 0.43)}
            total={50}
            threshold={15}
          />
          <InventoryCard
            title="11kg LPG Tank"
            current={Math.floor(stockLevel * 0.1)}
            total={20}
            threshold={5}
          />
        </div>

        <ReorderRequestLog />
      </div>
    </div>
  );
}
