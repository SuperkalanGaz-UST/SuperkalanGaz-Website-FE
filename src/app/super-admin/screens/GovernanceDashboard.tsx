'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileCheck2,
  ShieldCheck,
  Tags,
  UserCog,
  UsersRound,
} from 'lucide-react';
import { governanceApi } from '../api';
import type { GovernanceDashboardData } from '../types';
import {
  ErrorState,
  formatDate,
  humanize,
  LoadingState,
  Panel,
  StatusChip,
} from '../components/GovernanceUi';
import { SuperAdminHeader } from '../components/SuperAdminHeader';

export function GovernanceDashboard({ onNavigate }: { onNavigate: (screen: string) => void }) {
  const [data, setData] = useState<GovernanceDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await governanceApi.dashboard());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the dashboard.');
    }
  }, []);

  useEffect(() => void load(), [load]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f8fa]">
      <SuperAdminHeader title="Governance Dashboard" />
      <main className="mx-auto w-full max-w-[1560px] px-8 pb-10 pt-5">
        {!data && !error && <LoadingState />}
        {error && <ErrorState message={error} onRetry={() => void load()} />}
        {data && (
          <>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {[
                ['Pending Approvals', data.metrics.pendingApprovals, Clock3, 'text-amber-600 bg-amber-50'],
                ['Admin Account Requests', data.metrics.adminAccountRequests, UserCog, 'text-blue-700 bg-blue-50'],
                ['Price Changes — 30 Days', data.metrics.priceChanges30Days, Tags, 'text-emerald-700 bg-emerald-50'],
                ['Branch Owner Changes', data.metrics.branchOwnerChanges, UsersRound, 'text-violet-700 bg-violet-50'],
              ].map(([label, value, Icon, tone]) => {
                const MetricIcon = Icon as typeof Clock3;
                return (
                  <Panel key={String(label)} className="border-l-[3px] border-l-[#007BC1] p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{String(label)}</p>
                        <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">{String(value)}</p>
                      </div>
                      <div className={`rounded-full p-3 ${String(tone)}`}>
                        <MetricIcon className="h-6 w-6" />
                      </div>
                    </div>
                  </Panel>
                );
              })}
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]">
              <Panel>
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">Priority Approval Queue</h2>
                    <p className="mt-1 text-sm text-gray-500">Oldest and highest-risk requests appear first.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('approval-requests')}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#007BC1]"
                  >
                    View all <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="border-b border-gray-100 bg-gray-50/70 text-xs font-medium uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-6 py-3">Request</th>
                        <th className="px-4 py-3">Submitted by</th>
                        <th className="px-4 py-3">Submitted at</th>
                        <th className="px-4 py-3">Risk</th>
                        <th className="px-6 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.priorityRequests.length === 0 && (
                        <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No pending approvals.</td></tr>
                      )}
                      {data.priorityRequests.map((request) => (
                        <tr key={request.id} className="hover:bg-blue-50/30">
                          <td className="px-6 py-4">
                            <p className="font-semibold text-gray-900">{request.title}</p>
                            <p className="mt-1 text-xs text-gray-500">{humanize(request.type)}</p>
                          </td>
                          <td className="px-4 py-4 text-gray-700">{request.requested_by_name}</td>
                          <td className="px-4 py-4 text-gray-600">{formatDate(request.submitted_at)}</td>
                          <td className="px-4 py-4"><StatusChip value={request.risk_level} /></td>
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => onNavigate('approval-requests')}
                              className="rounded-lg bg-[#007BC1] px-4 py-2 text-xs font-semibold text-white hover:bg-[#006aa6]"
                            >
                              Review
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel className="p-6">
                <h2 className="text-lg font-semibold text-slate-950">Governance Activity</h2>
                <div className="mt-6 space-y-5">
                  {data.recentActivity.length === 0 && <p className="text-sm text-gray-500">No governance activity yet.</p>}
                  {data.recentActivity.map((event) => (
                    <div key={event.id} className="relative flex gap-3 pl-1">
                      <div className="mt-0.5 rounded-full bg-blue-50 p-2 text-[#007BC1]">
                        <FileCheck2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{humanize(event.action)}</p>
                        <p className="mt-0.5 truncate text-xs text-gray-500">{event.actorName} · {formatDate(event.occurredAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            <Panel className="mt-6 p-6">
              <h2 className="text-lg font-semibold text-slate-950">Control Status</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {[
                  ['No self-approval', data.controls.noSelfApproval, ShieldCheck],
                  ['Audit trail active', data.controls.auditTrailActive, FileCheck2],
                  ['Audit history read-only', !data.controls.auditHistoryMutableByUsers, CheckCircle2],
                ].map(([label, ok, Icon]) => {
                  const ControlIcon = Icon as typeof ShieldCheck;
                  return (
                    <div key={String(label)} className="flex items-center gap-3 border-r border-gray-100 last:border-r-0">
                      <div className="rounded-full bg-emerald-50 p-2.5 text-emerald-700"><ControlIcon className="h-5 w-5" /></div>
                      <div><p className="text-sm font-semibold text-gray-900">{String(label)}</p><p className="text-xs text-emerald-700">{ok ? 'Operating' : 'Review required'}</p></div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </>
        )}
      </main>
    </div>
  );
}
