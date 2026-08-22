'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileClock, Search, Tags } from 'lucide-react';
import { governanceApi } from '../api';
import type { AuditCategory, AuditEvent } from '../types';
import { ErrorState, formatDate, humanize, LoadingState, Panel } from '../components/GovernanceUi';
import { SuperAdminHeader } from '../components/SuperAdminHeader';

function stateSummary(state: Record<string, unknown> | null): string {
  if (!state) return '—';
  const prices = state.prices;
  if (Array.isArray(prices)) return `${prices.length} cylinder prices`;
  const owner = state.owner;
  if (owner && typeof owner === 'object') {
    const row = owner as Record<string, unknown>;
    return String(row.email ?? row.id ?? 'Branch Owner');
  }
  const owners = state.owners;
  if (Array.isArray(owners)) {
    return owners.length ? owners.map((item) => String((item as Record<string, unknown>).email ?? 'Owner')).join(', ') : 'No previous owner';
  }
  return Object.entries(state).map(([key, value]) => `${humanize(key)}: ${String(value)}`).join(' · ');
}

function PriceComparison({ event }: { event: AuditEvent }) {
  const beforeRows = Array.isArray(event.beforeState?.prices) ? event.beforeState?.prices as Record<string, unknown>[] : [];
  const afterRows = Array.isArray(event.afterState?.prices) ? event.afterState?.prices as Record<string, unknown>[] : [];
  return (
    <div className="space-y-2">
      {afterRows.map((after) => {
        const before = beforeRows.find((row) => row.cylinderSize === after.cylinderSize);
        const oldPrice = Number(before?.unitPrice ?? 0);
        const newPrice = Number(after.unitPrice ?? 0);
        const delta = newPrice - oldPrice;
        return (
          <div key={String(after.cylinderSize)} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 rounded-lg border border-gray-100 px-3 py-2 text-sm">
            <span className="font-medium">{String(after.cylinderSize)} LPG Cylinder</span>
            <span className="text-gray-500">₱{oldPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
            <span className="text-gray-400">→</span>
            <span className={`font-semibold ${delta < 0 ? 'text-red-600' : 'text-emerald-700'}`}>₱{newPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>
        );
      })}
    </div>
  );
}

export function AuditLogs({ category }: { category: Extract<AuditCategory, 'price-change' | 'branch-owner-change'> }) {
  const priceMode = category === 'price-change';
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const rows = await governanceApi.audit(category);
      setEvents(rows);
      setSelectedId((current) => current ?? rows[0]?.id ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load audit history.');
    }
  }, [category]);
  useEffect(() => void load(), [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (events ?? []).filter((event) => !term || `${event.action} ${event.actorName} ${event.reason ?? ''}`.toLowerCase().includes(term));
  }, [events, search]);
  const selected = (events ?? []).find((event) => event.id === selectedId) ?? filtered[0] ?? null;

  const exportCsv = () => {
    if (!events?.length) return;
    const cells = events.map((event) => [event.occurredAt, event.action, event.actorName, event.actorRole, event.governanceRequestId ?? '', event.reason ?? '']);
    const csv = [['occurred_at', 'action', 'actor', 'role', 'governance_request_id', 'reason'], ...cells]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${category}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f8fa]">
      <SuperAdminHeader
        title={priceMode ? 'Price Change Logs' : 'Branch Owner Logs'}
        description={priceMode ? 'Immutable history of approved system-wide product price changes.' : 'Trace every approved Branch Owner assignment and reassignment.'}
      />
      <main className="mx-auto w-full max-w-[1560px] px-8 pb-10">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <label className="relative block w-full max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search audit events…" className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-[#007BC1]" /></label>
          <button type="button" onClick={exportCsv} disabled={!events?.length} className="inline-flex items-center gap-2 rounded-lg border border-[#007BC1] bg-white px-4 py-2 text-sm font-semibold text-[#007BC1] disabled:opacity-50"><Download className="h-4 w-4" />Export CSV</button>
        </div>
        {!events && !error && <LoadingState label="Loading immutable audit history…" />}
        {error && <ErrorState message={error} onRetry={() => void load()} />}
        {events && (
          <div className="grid min-h-[650px] gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(400px,0.75fr)]">
            <Panel className="overflow-hidden">
              <div className="border-b border-gray-100 px-6 py-5"><h2 className="text-lg font-semibold text-gray-950">{priceMode ? 'Approved Price History' : 'Ownership History'}</h2><p className="mt-1 text-sm text-gray-500">{filtered.length} immutable event{filtered.length === 1 ? '' : 's'}</p></div>
              <div className="divide-y divide-gray-100">
                {filtered.length === 0 && <p className="px-6 py-16 text-center text-sm text-gray-500">No audit events recorded yet.</p>}
                {filtered.map((event) => (
                  <button key={event.id} type="button" onClick={() => setSelectedId(event.id)} className={`grid w-full grid-cols-[auto_1fr_auto] items-start gap-4 px-6 py-5 text-left ${selected?.id === event.id ? 'border-l-[3px] border-l-[#007BC1] bg-blue-50/50' : 'hover:bg-gray-50'}`}>
                    <div className={`rounded-xl p-2.5 ${priceMode ? 'bg-emerald-50 text-emerald-700' : 'bg-violet-50 text-violet-700'}`}>{priceMode ? <Tags className="h-5 w-5" /> : <FileClock className="h-5 w-5" />}</div>
                    <div><p className="font-semibold text-gray-950">{humanize(event.action)}</p><p className="mt-1 text-sm text-gray-600">{event.actorName} · {humanize(event.actorRole)}</p><p className="mt-1 text-xs text-gray-400">{formatDate(event.occurredAt)}</p></div>
                    <span className="text-xs font-medium text-[#007BC1]">{event.governanceRequestId ? event.governanceRequestId.slice(0, 8).toUpperCase() : 'DIRECT'}</span>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel className="self-start p-6">
              {!selected && <p className="py-20 text-center text-sm text-gray-500">Select an event to inspect.</p>}
              {selected && <><div className="border-b border-gray-100 pb-5"><p className="text-xs font-semibold uppercase tracking-wide text-[#007BC1]">Read-only audit record</p><h2 className="mt-2 text-xl font-semibold text-gray-950">{humanize(selected.action)}</h2><p className="mt-2 text-sm text-gray-500">{formatDate(selected.occurredAt)}</p></div><dl className="space-y-3 py-5 text-sm">{[['Actor', selected.actorName], ['Role', humanize(selected.actorRole)], ['Request ID', selected.governanceRequestId ?? '—'], ['Affected record', selected.affectedRecordType], ['Reason', selected.reason ?? '—']].map(([label, value]) => <div key={label} className="grid grid-cols-[8rem_1fr] gap-3"><dt className="text-gray-500">{label}</dt><dd className="break-words font-medium text-gray-900">{value}</dd></div>)}</dl>{priceMode ? <PriceComparison event={selected} /> : <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-gray-200 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Previous Owner</p><p className="mt-3 text-sm font-semibold text-gray-900">{stateSummary(selected.beforeState)}</p></div><div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">New Owner</p><p className="mt-3 text-sm font-semibold text-gray-900">{stateSummary(selected.afterState)}</p></div></div>}<div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">This audit record cannot be edited or deleted through the application.</div></>}
            </Panel>
          </div>
        )}
      </main>
    </div>
  );
}
