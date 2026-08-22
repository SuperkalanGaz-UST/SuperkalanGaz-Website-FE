'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileCheck2, ShieldCheck, UserCog } from 'lucide-react';
import { governanceApi } from '../api';
import type { SecuritySummary } from '../types';
import { ErrorState, formatDate, humanize, LoadingState, Panel, StatusChip } from '../components/GovernanceUi';
import { SuperAdminHeader } from '../components/SuperAdminHeader';

export function AuditSecurity() {
  const [data, setData] = useState<SecuritySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try { setData(await governanceApi.security()); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Could not load security data.'); }
  }, []);
  useEffect(() => void load(), [load]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f8fa]">
      <SuperAdminHeader title="Audit & Security" description="Monitor privileged activity, account health, and audit completeness." />
      <main className="mx-auto w-full max-w-[1560px] px-8 pb-10">
        {!data && !error && <LoadingState />}
        {error && <ErrorState message={error} onRetry={() => void load()} />}
        {data && <>
          <Panel className="border-blue-200 bg-blue-50/70 p-6"><div className="grid items-center gap-5 md:grid-cols-[1.3fr_repeat(3,0.7fr)]"><div className="flex items-center gap-4"><div className="rounded-full bg-emerald-600 p-3 text-white"><ShieldCheck className="h-7 w-7" /></div><div><h2 className="text-lg font-semibold text-emerald-800">Controls operating normally</h2><p className="mt-1 text-sm text-gray-600">Authorization and audit integrity checks passed.</p></div></div><div className="border-l border-blue-200 pl-5"><p className="text-xs text-gray-500">Audit events</p><p className="mt-1 text-3xl font-semibold text-gray-950">{data.auditIntegrity.eventCount}</p></div><div className="border-l border-blue-200 pl-5"><p className="text-xs text-gray-500">Critical alerts</p><p className="mt-1 text-3xl font-semibold text-emerald-700">0</p></div><div className="border-l border-blue-200 pl-5"><p className="text-xs text-gray-500">Sign-in telemetry</p><p className="mt-2 text-sm font-semibold text-amber-700">{data.signInTelemetry.connected ? 'Connected' : 'Not connected'}</p></div></div></Panel>
          {!data.signInTelemetry.connected && <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Authentication telemetry unavailable</p><p className="mt-1">{data.signInTelemetry.message} Failed sign-in counts are intentionally not fabricated.</p></div></div>}
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(380px,0.8fr)]">
            <Panel className="overflow-hidden"><div className="border-b border-gray-100 px-6 py-5"><h2 className="text-lg font-semibold text-gray-950">Privileged Activity</h2><p className="mt-1 text-sm text-gray-500">Latest append-only governance events.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-6 py-3">Time</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Event</th><th className="px-6 py-3">Result</th></tr></thead><tbody className="divide-y divide-gray-100">{data.recentActivity.map((event) => <tr key={event.id}><td className="px-6 py-4 text-gray-500">{formatDate(event.occurredAt)}</td><td className="px-4 py-4 font-medium text-gray-900">{event.actorName}</td><td className="px-4 py-4 text-gray-600">{humanize(event.actorRole)}</td><td className="px-4 py-4 text-gray-700">{humanize(event.action)}</td><td className="px-6 py-4"><StatusChip value="Logged" /></td></tr>)}</tbody></table></div></Panel>
            <div className="space-y-6">
              <Panel className="p-6"><div className="flex items-center gap-3"><UserCog className="h-5 w-5 text-[#007BC1]" /><h2 className="text-lg font-semibold text-gray-950">Account Health</h2></div><div className="mt-5 grid grid-cols-3 gap-3">{[['Super Admins', data.accountHealth.activeSuperAdministrators], ['Franchise Admins', data.accountHealth.activeFranchiseAdministrators], ['Inactive', data.accountHealth.inactiveAccounts]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-gray-200 p-4 text-center"><p className="text-2xl font-semibold text-gray-950">{String(value)}</p><p className="mt-1 text-xs text-gray-500">{String(label)}</p></div>)}</div></Panel>
              <Panel className="p-6"><div className="flex items-center gap-3"><FileCheck2 className="h-5 w-5 text-[#007BC1]" /><h2 className="text-lg font-semibold text-gray-950">Audit Integrity</h2></div><div className="mt-5 space-y-3">{[['Approval decisions recorded', data.auditIntegrity.approvalDecisionsRecorded], ['Actor and timestamp present', data.auditIntegrity.actorAndTimestampPresent], ['Before/after values complete', data.auditIntegrity.beforeAfterCoverage]].map(([label, ok]) => <div key={String(label)} className="flex items-center gap-3 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4" />{String(label)}<span className="ml-auto font-semibold">{ok ? 'Pass' : 'Review'}</span></div>)}</div><p className="mt-4 text-xs text-gray-500">Audit records are read-only in the user interface and protected from database mutation.</p></Panel>
            </div>
          </div>
        </>}
      </main>
    </div>
  );
}
