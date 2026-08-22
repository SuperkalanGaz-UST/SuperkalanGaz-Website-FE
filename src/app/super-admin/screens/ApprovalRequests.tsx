'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileText, RotateCcw, Search, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { governanceApi } from '../api';
import type { GovernanceRequest, GovernanceRequestStatus } from '../types';
import {
  ErrorState,
  formatDate,
  humanize,
  LoadingState,
  Panel,
  StatusChip,
} from '../components/GovernanceUi';
import { SuperAdminHeader } from '../components/SuperAdminHeader';

const FILTERS: { label: string; value: 'all' | GovernanceRequestStatus }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Revision requested', value: 'revision-requested' },
  { label: 'Rejected', value: 'rejected' },
];

function PayloadDetails({ request }: { request: GovernanceRequest }) {
  const entries = Object.entries(request.payload).filter(([, value]) => !Array.isArray(value));
  const prices = Array.isArray(request.payload.prices)
    ? (request.payload.prices as Record<string, unknown>[])
    : [];
  return (
    <div className="space-y-3">
      {entries.map(([key, value]) => (
        <div key={key} className="grid grid-cols-[10rem_1fr] gap-4 text-sm">
          <span className="text-gray-500">{humanize(key)}</span>
          <span className="font-medium text-gray-900">{String(value ?? '—')}</span>
        </div>
      ))}
      {prices.length > 0 && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Proposed prices</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {prices.map((price) => (
              <div key={String(price.cylinderSize)} className="flex justify-between rounded-lg bg-white px-3 py-2">
                <span>{String(price.cylinderSize)}</span>
                <span className="font-semibold">₱{Number(price.unitPrice).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ApprovalRequests() {
  const [requests, setRequests] = useState<GovernanceRequest[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | GovernanceRequestStatus>('pending');
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const rows = await governanceApi.requests();
      setRequests(rows);
      setSelectedId((current) =>
        current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null,
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load requests.');
    }
  }, []);

  useEffect(() => void load(), [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (requests ?? []).filter((request) => {
      if (filter !== 'all' && request.status !== filter) return false;
      if (!term) return true;
      return `${request.title} ${request.type} ${request.requested_by_name}`
        .toLowerCase()
        .includes(term);
    });
  }, [filter, requests, search]);
  const selected = (requests ?? []).find((request) => request.id === selectedId) ?? filtered[0] ?? null;

  const decide = async (decision: 'approve' | 'reject' | 'request-revision') => {
    if (!selected || reason.trim().length < 5) {
      toast.error('Enter a decision reason with at least 5 characters.');
      return;
    }
    setSubmitting(true);
    setTemporaryPassword(null);
    try {
      const result = await governanceApi.decide(selected.id, decision, reason.trim());
      if (result.temporary_password) setTemporaryPassword(result.temporary_password);
      toast.success(`Request ${humanize(result.request.status).toLowerCase()}.`);
      setReason('');
      await load();
    } catch (decisionError) {
      toast.error(decisionError instanceof Error ? decisionError.message : 'Could not save the decision.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f8fa]">
      <SuperAdminHeader
        title="Approval Requests"
        description="Review governance proposals submitted by Franchise Administrators."
      />
      <main className="mx-auto w-full max-w-[1560px] px-8 pb-10">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  filter === item.value
                    ? 'bg-[#007BC1] text-white'
                    : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="relative block w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search requests…" className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-[#007BC1]" />
          </label>
        </div>

        {!requests && !error && <LoadingState />}
        {error && <ErrorState message={error} onRetry={() => void load()} />}
        {requests && (
          <div className="grid min-h-[650px] gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
            <Panel className="overflow-hidden">
              <div className="border-b border-gray-100 px-6 py-5">
                <h2 className="text-lg font-semibold text-gray-950">Request Queue</h2>
                <p className="mt-1 text-sm text-gray-500">{filtered.length} matching request{filtered.length === 1 ? '' : 's'}</p>
              </div>
              <div className="divide-y divide-gray-100">
                {filtered.length === 0 && <p className="px-6 py-16 text-center text-sm text-gray-500">No requests match this view.</p>}
                {filtered.map((request) => (
                  <button
                    key={request.id}
                    type="button"
                    onClick={() => { setSelectedId(request.id); setTemporaryPassword(null); }}
                    className={`grid w-full grid-cols-[1fr_auto] gap-4 px-6 py-5 text-left transition ${selected?.id === request.id ? 'border-l-[3px] border-l-[#007BC1] bg-blue-50/50' : 'hover:bg-gray-50'}`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-gray-950">{request.title}</p>
                        <StatusChip value={request.status} />
                      </div>
                      <p className="mt-2 text-sm text-gray-600">{request.requested_by_name} · {humanize(request.type)}</p>
                      <p className="mt-1 text-xs text-gray-500">{formatDate(request.submitted_at)}</p>
                    </div>
                    <StatusChip value={request.risk_level} />
                  </button>
                ))}
              </div>
            </Panel>

            <Panel className="self-start p-6">
              {!selected && <p className="py-20 text-center text-sm text-gray-500">Select a request to review.</p>}
              {selected && (
                <>
                  <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#007BC1]">{selected.id.slice(0, 8).toUpperCase()}</p>
                      <h2 className="mt-2 text-xl font-semibold text-gray-950">{selected.title}</h2>
                      <p className="mt-2 text-sm text-gray-500">Submitted by {selected.requested_by_name}</p>
                    </div>
                    <StatusChip value={selected.status} />
                  </div>

                  <div className="space-y-5 py-5">
                    <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Purpose</p><p className="mt-2 text-sm leading-6 text-gray-800">{selected.reason}</p></div>
                    <PayloadDetails request={selected} />
                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                      Your decision, reason, actor identity, and timestamp will be written to the immutable audit trail.
                    </div>
                  </div>

                  {temporaryPassword && (
                    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      <p className="font-semibold">One-time temporary password</p>
                      <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 font-mono">
                        <span>{temporaryPassword}</span>
                        <button type="button" onClick={() => void navigator.clipboard.writeText(temporaryPassword)} className="font-sans text-xs font-semibold text-[#007BC1]">Copy</button>
                      </div>
                      <p className="mt-2 text-xs">Copy it now. It is not stored in the CRM or audit log.</p>
                    </div>
                  )}

                  {selected.status === 'pending' ? (
                    <>
                      <label className="block text-sm font-medium text-gray-800">
                        Decision reason <span className="text-red-600">*</span>
                        <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} placeholder="Explain the approval, revision request, or rejection…" className="mt-2 w-full resize-none rounded-xl border border-gray-300 p-3 text-sm outline-none focus:border-[#007BC1] focus:ring-2 focus:ring-blue-100" />
                      </label>
                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <button type="button" disabled={submitting} onClick={() => void decide('approve')} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#007BC1] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />Approve</button>
                        <button type="button" disabled={submitting} onClick={() => void decide('request-revision')} className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-400 px-4 py-2.5 text-sm font-semibold text-amber-700 disabled:opacity-50"><RotateCcw className="h-4 w-4" />Revise</button>
                        <button type="button" disabled={submitting} onClick={() => void decide('reject')} className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-400 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-50"><XCircle className="h-4 w-4" />Reject</button>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-700"><FileText className="mr-2 inline h-4 w-4" />Decision by {selected.decided_by_name ?? '—'}: {selected.decision_reason ?? 'No reason recorded'}</div>
                  )}
                </>
              )}
            </Panel>
          </div>
        )}
      </main>
    </div>
  );
}
