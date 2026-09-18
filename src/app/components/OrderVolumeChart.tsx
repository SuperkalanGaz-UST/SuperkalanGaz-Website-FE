'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChevronDown } from 'lucide-react';

/** Shape of one raw data point from GET /service-requests/franchise-analytics */
export interface OrderAnalyticsSeries {
  month: string;
  branchId: string;
  branchName: string;
  region: string | null; // always null in DB; kept to match API response shape
  orderCount: number;
  deliveredCount: number;
  cancelledCount: number;
}

/** Shape of one branch from GET /branches (fields used by chart components) */
export interface BranchRow {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  province: string | null; // real geographic grouping field
  city: string | null;     // used for branch display label
}

interface Props {
  branches: BranchRow[];
  series: OrderAnalyticsSeries[];
  isLoading: boolean;
}

/**
 * Chart color palette — green, yellow, blue, orange, red.
 * Assigned to branches in the order they appear/are returned.
 * Extended with extra colors in case of many branches.
 */
const CHART_COLORS = [
  '#16A34A', // green
  '#EAB308', // yellow
  '#007BC1', // blue
  '#F97316', // orange
  '#EF4444', // red
  '#9333EA', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
  '#6366F1', // indigo
];

// ─── Shared dropdown ────────────────────────────────────────────────────────

function DropdownMenu({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <button
        disabled={disabled}
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {selected?.label ?? label}
        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
      </button>
      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 min-w-[180px] bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
            {options.map((o) => (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                  value === o.value ? 'font-semibold text-[#007BC1]' : 'text-gray-700'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function OrderVolumeChart({ branches, series, isLoading }: Props) {
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');

  // ── Warn about any branches with no province in the DB ───────────────────
  useEffect(() => {
    if (branches.length === 0) return;
    const unassigned = branches.filter((b) => !b.province);
    if (unassigned.length > 0) {
      console.warn(
        '[OrderVolumeChart] The following active branches have no province set in the database ' +
          '(they will appear under "Unassigned" in the Province dropdown):\n' +
          unassigned.map((b) => `  • ${b.name} (id: ${b.id})`).join('\n'),
      );
    }
  }, [branches]);

  // ── Province dropdown — from real branch.province values ─────────────────
  const provinceOptions = useMemo(() => {
    const provinces = new Set<string>();
    for (const b of branches) {
      provinces.add(b.province ?? 'Unassigned');
    }
    const sorted = Array.from(provinces).sort((a, b) =>
      a === 'Unassigned' ? 1 : b === 'Unassigned' ? -1 : a.localeCompare(b),
    );
    return [
      { value: '', label: 'All Provinces' },
      ...sorted.map((p) => ({ value: p, label: p })),
    ];
  }, [branches]);

  // ── Branch dropdown — filtered by province, display as "City — Name" ─────
  const branchOptions = useMemo(() => {
    if (!selectedProvince) return [];
    const filtered = branches.filter(
      (b) => (b.province ?? 'Unassigned') === selectedProvince,
    );
    return [
      { value: '', label: `All in ${selectedProvince}` },
      ...filtered.map((b) => ({
        value: b.id,
        label: b.city ? `${b.city} — ${b.name}` : b.name,
      })),
    ];
  }, [branches, selectedProvince]);

  const handleProvinceChange = (province: string) => {
    setSelectedProvince(province);
    setSelectedBranch('');
  };

  // Determine lines to render based on selection.
  // If a specific branch is selected, show only that one.
  // If a province is selected, show all branches in that province.
  // Otherwise, show an aggregated "All Branches" line.
  const activeBranches = useMemo(() => {
    if (selectedBranch) {
      return branches.filter((b) => b.id === selectedBranch);
    }
    if (selectedProvince) {
      return branches.filter((b) => (b.province ?? 'Unassigned') === selectedProvince);
    }
    return branches; // Default to all branches, no aggregation
  }, [branches, selectedProvince, selectedBranch]);

  // Map branches to colors consistently by their index in the full list
  const getBranchColor = (branchId: string) => {
    const idx = branches.findIndex((b) => b.id === branchId);
    return CHART_COLORS[Math.max(0, idx) % CHART_COLORS.length];
  };

  // ── Chart data ───────────────
  const chartData = useMemo(() => {
    const monthSet = new Set(series.map((s) => s.month));
    const months = Array.from(monthSet).sort();

    return months.map((month) => {
      const rows = series.filter((s) => s.month === month);
      
      const point: any = { month: formatMonth(month) };

      for (const branch of activeBranches) {
        const branchRow = rows.find((r) => r.branchId === branch.id);
        point[branch.id] = branchRow ? branchRow.orderCount : 0;
      }

      return point;
    });
  }, [series, activeBranches]);



  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 flex flex-col min-h-[360px]">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h3 className="font-semibold text-gray-900 shrink-0">
          Order Volume Trend
        </h3>

        <div className="flex items-center justify-end gap-3 shrink-0">
          <DropdownMenu
            label="All Provinces"
            options={provinceOptions}
            value={selectedProvince}
            onChange={handleProvinceChange}
          />
          <DropdownMenu
            label="All Branches"
            options={branchOptions}
            value={selectedBranch}
            onChange={setSelectedBranch}
            disabled={!selectedProvince}
          />
        </div>
      </div>

      {/* Chart */}
      {isLoading ? (
        <div className="flex items-center justify-center flex-1 text-sm text-gray-400">
          Loading&hellip;
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex items-center justify-center flex-1 text-sm text-gray-400">
          No data for this selection.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" stroke="#9ca3af" style={{ fontSize: '12px' }} />
            <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
            <Tooltip />
            <Legend content={renderCustomLegend} verticalAlign="top" align="left" wrapperStyle={{ left: 0 }} />
            
            {activeBranches.map((branch) => (
              <Line
                key={branch.id}
                type="monotone"
                dataKey={branch.id}
                name={branch.name}
                stroke={getBranchColor(branch.id)}
                strokeWidth={2}
                dot={{ fill: getBranchColor(branch.id), r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function renderCustomLegend(props: any) {
  const { payload } = props;
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-3 mb-4">
      {payload.map((entry: any, index: number) => (
        <li key={`item-${index}`} className="flex items-center gap-2 text-xs text-black whitespace-nowrap">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span>{entry.value}</span>
        </li>
      ))}
    </ul>
  );
}

function formatMonth(monthStr: string) {
  const [yr, mo] = monthStr.split('-');
  return (
    new Date(Number(yr), Number(mo) - 1).toLocaleString('en-US', { month: 'short' }) +
    ` '${yr.slice(2)}`
  );
}