'use client';

import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock3,
  Loader2,
  Search,
  ShieldCheck,
  UserRound,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Header } from '../../components/Header';
import {
  DocumentReviewPanel,
  type DocumentReviewState,
} from '../../components/account-review/DocumentReviewPanel';
import { apiErrorMessage, apiFetch } from '../../lib/api';

interface StaffAccountReviewRequest {
  id: string;
  role: 'branch-owner' | 'branch-manager';
  status: 'pending' | 'approved' | 'rejected' | 'revision-requested';
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string | null;
  branch_name: string | null;
  branch_address: string | null;
  submitted_at: string;
  decided_by_name: string | null;
  decision_reason: string | null;
}

function roleLabel(role: StaffAccountReviewRequest['role']): string {
  return role === 'branch-owner' ? 'Branch Owner' : 'Branch Manager';
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(date);
}

async function responseJson<T>(response: Response, fallback: string): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(apiErrorMessage(body, fallback));
  return body as T;
}

export function StaffAccountReviews() {
  const [requests, setRequests] = useState<StaffAccountReviewRequest[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentReviewState, setDocumentReviewState] =
    useState<DocumentReviewState>('loading');

  const load = useCallback(async () => {
    setError(null);
    setRequests(null);
    try {
      const response = await apiFetch(
        '/staff-registration/requests?status=pending&roles=branch-owner,branch-manager',
        { signal: AbortSignal.timeout(10_000) },
      );
      const body = await responseJson<{ requests: StaffAccountReviewRequest[] }>(
        response,
        'Could not load staff account registrations.',
      );
      setRequests(body.requests);
      setSelectedId((current) =>
        current && body.requests.some((request) => request.id === current)
          ? current
          : body.requests[0]?.id ?? null,
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'The secure staff-registration service is unavailable.',
      );
    }
  }, []);

  useEffect(() => void load(), [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (requests ?? []).filter((request) =>
      !term
        ? true
        : `${request.applicant_name} ${request.applicant_email} ${request.branch_name ?? ''} ${roleLabel(request.role)}`
            .toLowerCase()
            .includes(term),
    );
  }, [requests, search]);

  const selected =
    (requests ?? []).find((request) => request.id === selectedId) ?? filtered[0] ?? null;

  const decide = async (decision: 'approve' | 'reject') => {
    if (!selected) return;
    if (documentReviewState !== 'ready') {
      toast.error('Verify every required document before recording an account decision.');
      return;
    }
    if (reason.trim().length < 5) {
      toast.error('Enter a decision reason with at least 5 characters.');
      return;
    }

    setWorking(true);
    try {
      const response = await apiFetch(
        `/staff-registration/requests/${selected.id}/decision`,
        {
          method: 'PATCH',
          body: JSON.stringify({ decision, reason: reason.trim() }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      await responseJson(response, 'Could not record the account decision.');
      toast.success(
        decision === 'approve'
          ? `${roleLabel(selected.role)} account approved.`
          : `${roleLabel(selected.role)} registration rejected.`,
      );
      setReason('');
      await load();
    } catch (decisionError) {
      toast.error(
        decisionError instanceof Error
          ? decisionError.message
          : 'Could not record the account decision.',
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <Header
        title="Account Reviews"
        description="Review Branch Owner and Branch Manager registrations for authorized branches."
      />

      <main className="mx-auto w-full max-w-[1540px] px-8 pb-10">
        {error && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
              <div>
                <h2 className="font-semibold">Account review is unavailable</h2>
                <p className="mt-1 text-sm leading-6">
                  {error} No applicant data is fabricated and no account decision is permitted while this dependency is unavailable.
                </p>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="mt-4 rounded-lg border border-amber-400 bg-white px-4 py-2 text-sm font-semibold hover:bg-amber-100"
                >
                  Retry secure service
                </button>
              </div>
            </div>
          </section>
        )}

        {!requests && !error && (
          <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500" role="status">
            <Loader2 className="h-5 w-5 animate-spin text-[#007BC1]" /> Loading account registrations…
          </div>
        )}

        {requests && (
          <div className="grid min-h-[680px] gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(460px,1.15fr)]">
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Pending registrations</h2>
                    <p className="mt-1 text-sm text-slate-500">No account is activated before approval.</p>
                  </div>
                  <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-[#007BC1]">
                    {filtered.length} pending
                  </span>
                </div>
                <label className="relative mt-4 block">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search applicant or branch…"
                    className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-[#007BC1]"
                  />
                </label>
              </div>

              <div className="divide-y divide-slate-100">
                {filtered.length === 0 && (
                  <p className="px-6 py-16 text-center text-sm text-slate-500">No pending registrations match this view.</p>
                )}
                {filtered.map((request) => (
                  <button
                    key={request.id}
                    type="button"
                    onClick={() => { setSelectedId(request.id); setReason(''); }}
                    className={`grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4 text-left transition ${
                      selected?.id === request.id
                        ? 'border-l-[3px] border-[#007BC1] bg-sky-50/60'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-100 text-[#007BC1]">
                      <UserRound className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <strong className="block truncate text-sm text-slate-900">{request.applicant_name}</strong>
                      <span className="mt-1 block truncate text-xs text-slate-500">{roleLabel(request.role)} · {request.branch_name ?? 'Branch pending'}</span>
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Clock3 className="h-3.5 w-3.5" /> {formatDate(request.submitted_at)}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="self-start rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              {!selected && (
                <p className="py-24 text-center text-sm text-slate-500">Select an applicant to review.</p>
              )}
              {selected && (
                <>
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-sky-100 p-3 text-[#007BC1]"><UserRound className="h-6 w-6" /></span>
                      <div>
                        <h2 className="text-xl font-semibold text-slate-950">{selected.applicant_name}</h2>
                        <p className="mt-1 text-sm text-slate-500">{roleLabel(selected.role)}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Pending review</span>
                  </div>

                  <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                    <div><dt className="text-xs text-slate-500">Email</dt><dd className="mt-1 font-medium text-slate-900">{selected.applicant_email}</dd></div>
                    <div><dt className="text-xs text-slate-500">Mobile number</dt><dd className="mt-1 font-medium text-slate-900">{selected.applicant_phone ?? '—'}</dd></div>
                    <div><dt className="text-xs text-slate-500">Branch</dt><dd className="mt-1 font-medium text-slate-900">{selected.branch_name ?? '—'}</dd></div>
                    <div><dt className="text-xs text-slate-500">Submitted</dt><dd className="mt-1 font-medium text-slate-900">{formatDate(selected.submitted_at)}</dd></div>
                    {selected.branch_address && <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Registered branch address</dt><dd className="mt-1 font-medium text-slate-900">{selected.branch_address}</dd></div>}
                  </dl>

                  <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                    <p className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 flex-none" />The API must derive reviewer authority and branch scope from the verified Franchise Administrator JWT.</p>
                    {selected.role === 'branch-owner' && <p className="mt-2 flex items-start gap-2"><Building2 className="mt-0.5 h-4 w-4 flex-none" />Assign geolocation only after the registration is approved.</p>}
                  </div>

                  <DocumentReviewPanel
                    key={selected.id}
                    requestId={selected.id}
                    onReviewStateChange={setDocumentReviewState}
                  />

                  <label className="mt-5 block text-sm font-medium text-slate-800">
                    Decision reason
                    <textarea
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      rows={4}
                      placeholder="Required for approval or rejection…"
                      className="mt-2 w-full resize-none rounded-xl border border-slate-300 p-3 outline-none focus:border-[#007BC1]"
                    />
                  </label>
                  {documentReviewState !== 'ready' && (
                    <p className="mt-3 text-xs font-medium text-amber-700">
                      Account decisions remain disabled until all required documents are securely available and verified.
                    </p>
                  )}
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={working || documentReviewState !== 'ready'}
                      onClick={() => void decide('approve')}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#007BC1] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Approve account
                    </button>
                    <button
                      type="button"
                      disabled={working || documentReviewState !== 'ready'}
                      onClick={() => void decide('reject')}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-400 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" /> Reject registration
                    </button>
                  </div>
                  <p className="mt-4 text-xs leading-5 text-slate-500">
                    The backend decision must record the approver, role, affected account, before/after status, timestamp, and decision reason for Super Administrator audit visibility.
                  </p>
                </>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
