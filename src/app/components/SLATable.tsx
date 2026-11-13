'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '../lib/api';

interface SlaSegment {
  segment: string;
  evaluated_requests: number;
  breached_requests: number;
  compliance_rate: number | null;
  average_minutes: number | null;
}

interface BranchSla {
  branch_id: string;
  branch_name: string;
  total_service_requests: number;
  evaluated_requests: number;
  within_sla: number;
  breaches: number;
  not_evaluated: number;
  overall_compliance_rate: number | null;
  segments: SlaSegment[];
}

const SEGMENT_COLUMNS = [
  { key: 'request_to_dispatch', label: 'Request → Dispatch' },
  { key: 'dispatch_to_in_transit', label: 'Dispatch → In Transit' },
  { key: 'in_transit_to_delivery', label: 'In Transit → Delivered' },
] as const;

interface Props {
  from: string;
  to: string;
  /** Branches selected by the dashboard's shared Province/Branch filter. */
  branchIds: Set<string>;
}

function segmentCell(branch: BranchSla, key: string) {
  const segment = branch.segments.find((s) => s.segment === key);
  if (!segment || segment.evaluated_requests === 0) return <span className="text-gray-400">—</span>;
  return (
    <span>
      {segment.average_minutes} min
      {segment.breached_requests > 0 && (
        <span className="ml-1 text-red-600">({segment.breached_requests} late)</span>
      )}
    </span>
  );
}

export function SLATable({ from, to, branchIds }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['franchise-sla', from, to],
    queryFn: () =>
      fetchJson<{ branches: BranchSla[] }>(
        `/service-requests/reports/franchise-sla?from=${from}&to=${to}`,
      ),
  });
  const rows = (data?.branches ?? []).filter((branch) => branchIds.has(branch.branch_id));

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-gray-900">SLA Compliance</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Delivered orders from {from} to {to}, measured against each branch&apos;s approved SLA thresholds.
      </p>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-gray-400">Loading…</p>
      ) : error ? (
        <p className="py-8 text-center text-sm text-red-600">
          Couldn&apos;t load SLA compliance. Try again in a moment.
        </p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">No branches match this selection.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Branch</th>
                <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Delivered</th>
                <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Compliance</th>
                <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Breaches</th>
                {SEGMENT_COLUMNS.map((column) => (
                  <th key={column.key} className="text-left text-[11px] font-medium text-gray-600 pb-3">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((branch) => (
                <tr key={branch.branch_id} className="border-b border-gray-100">
                  <td className="py-3 text-[13px] text-gray-900">{branch.branch_name}</td>
                  <td className="py-3 text-[13px] text-gray-600">{branch.total_service_requests}</td>
                  <td className="py-3 text-[13px] text-gray-900">
                    {branch.overall_compliance_rate === null ? (
                      <span className="text-gray-400">Not evaluated</span>
                    ) : (
                      `${branch.overall_compliance_rate}%`
                    )}
                  </td>
                  <td className={`py-3 text-[13px] ${branch.breaches > 0 ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                    {branch.breaches}
                  </td>
                  {SEGMENT_COLUMNS.map((column) => (
                    <td key={column.key} className="py-3 text-[13px] text-gray-600">
                      {segmentCell(branch, column.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
