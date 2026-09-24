'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { BranchRow } from './OrderVolumeChart';

/** Shape of one raw data point from GET /csat/franchise-analytics */
export interface CsatAnalyticsSeries {
  month: string;
  branchId: string;
  branchName: string;
  region: string | null; // always null in DB; kept to match API response shape
  totalRatings: number;
  avgStars: number;
}

interface Props {
  branches: BranchRow[];
  series: CsatAnalyticsSeries[];
  isLoading: boolean;
  /** Branches to render a bar for — resolved by the dashboard's shared province/branch filter. */
  activeBranches: BranchRow[];
}

/**
 * Chart color palette — green, yellow, blue, orange, red.
 * Assigned to branches in the order they appear/are returned.
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

// ─── Component ───────────────────────────────────────────────────────────────

export function CSATChart({ branches, series, isLoading, activeBranches }: Props) {
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
        // If a branch has no ratings this month, we leave it undefined/null 
        // so it doesn't plot a zero and pull the line down inappropriately.
        point[branch.id] = branchRow && branchRow.totalRatings > 0 
          ? Math.round(branchRow.avgStars * 100) / 100 
          : null; 
      }

      return point;
    });
  }, [series, activeBranches]);



  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 flex flex-col min-h-[360px]">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h3 className="font-semibold text-gray-900 shrink-0">
          CSAT Score Trend
        </h3>
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
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" stroke="#9ca3af" style={{ fontSize: '12px' }} />
            <YAxis domain={[0, 5]} stroke="#9ca3af" style={{ fontSize: '12px' }} />
            <Tooltip />
            <Legend content={renderCustomLegend} verticalAlign="top" align="left" wrapperStyle={{ left: 0 }} />
            
            {activeBranches.map((branch) => (
              <Bar
                key={branch.id}
                dataKey={branch.id}
                name={branch.name}
                fill={getBranchColor(branch.id)}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
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