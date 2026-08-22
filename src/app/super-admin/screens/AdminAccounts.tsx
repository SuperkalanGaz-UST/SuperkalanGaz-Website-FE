'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Search, ShieldCheck, UserCog, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  DocumentReviewPanel,
  type DocumentReviewState,
} from '../../components/account-review/DocumentReviewPanel';
import { governanceApi } from '../api';
import type { AdminAccount, GovernanceRequest } from '../types';
import { ErrorState, formatDate, LoadingState, Panel, StatusChip } from '../components/GovernanceUi';
import { SuperAdminHeader } from '../components/SuperAdminHeader';

export function AdminAccounts() {
  const [accounts, setAccounts] = useState<AdminAccount[] | null>(null);
  const [requests, setRequests] = useState<GovernanceRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState('');
  const [working, setWorking] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [documentReviewState, setDocumentReviewState] =
    useState<DocumentReviewState>('loading');

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await governanceApi.adminAccounts();
      setAccounts(data.accounts);
      setRequests(data.requests);
      setSelectedId((current) => current ?? data.requests.find((row) => row.status === 'pending')?.id ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load administrator accounts.');
    }
  }, []);
  useEffect(() => void load(), [load]);

  const pending = useMemo(() => {
    const term = search.trim().toLowerCase();
    return requests.filter((request) => {
      if (request.status !== 'pending') return false;
      const email = String(request.payload.email ?? '');
      const name = String(request.payload.name ?? '');
      return !term || `${email} ${name} ${request.requested_by_name}`.toLowerCase().includes(term);
    });
  }, [requests, search]);
  const selected = requests.find((request) => request.id === selectedId) ?? pending[0] ?? null;

  const decide = async (decision: 'approve' | 'reject') => {
    if (documentReviewState !== 'ready') {
      toast.error('Verify every required document before recording an account decision.');
      return;
    }
    if (!selected || reason.trim().length < 5) {
      toast.error('Enter a decision reason with at least 5 characters.');
      return;
    }
    setWorking(true);
    try {
      const result = await governanceApi.decide(selected.id, decision, reason.trim());
      setTemporaryPassword(result.temporary_password ?? null);
      toast.success(decision === 'approve' ? 'Administrator account approved.' : 'Account request rejected.');
      setReason('');
      await load();
    } catch (decisionError) {
      toast.error(decisionError instanceof Error ? decisionError.message : 'Could not save the decision.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f8fa]">
      <SuperAdminHeader title="Administrator Accounts" description="Review and authorize Franchise Administrator access." />
      <main className="mx-auto w-full max-w-[1560px] px-8 pb-10">
        {!accounts && !error && <LoadingState />}
        {error && <ErrorState message={error} onRetry={() => void load()} />}
        {accounts && (
          <>
            <div className="mb-6 grid gap-5 md:grid-cols-3">
              <Panel className="p-5"><p className="text-xs uppercase tracking-wide text-gray-500">Pending requests</p><p className="mt-2 text-3xl font-semibold text-gray-950">{pending.length}</p></Panel>
              <Panel className="p-5"><p className="text-xs uppercase tracking-wide text-gray-500">Active Franchise Administrators</p><p className="mt-2 text-3xl font-semibold text-gray-950">{accounts.filter((account) => account.status === 'Active').length}</p></Panel>
              <Panel className="p-5"><p className="text-xs uppercase tracking-wide text-gray-500">Inactive accounts</p><p className="mt-2 text-3xl font-semibold text-gray-950">{accounts.filter((account) => account.status === 'Inactive').length}</p></Panel>
            </div>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(420px,0.8fr)]">
              <div className="space-y-6">
                <Panel className="overflow-hidden">
                  <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-6 py-5">
                    <div><h2 className="text-lg font-semibold text-gray-950">Pending Account Requests</h2><p className="mt-1 text-sm text-gray-500">No account is created before approval.</p></div>
                    <label className="relative block w-64"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search applicants…" className="h-10 w-full rounded-lg border border-gray-200 pl-10 pr-3 text-sm outline-none focus:border-[#007BC1]" /></label>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {pending.length === 0 && <p className="px-6 py-12 text-center text-sm text-gray-500">No pending account requests.</p>}
                    {pending.map((request) => (
                      <button key={request.id} type="button" onClick={() => { setSelectedId(request.id); setTemporaryPassword(null); }} className={`grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 px-6 py-5 text-left ${selected?.id === request.id ? 'border-l-[3px] border-l-[#007BC1] bg-blue-50/50' : 'hover:bg-gray-50'}`}>
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700">{String(request.payload.name ?? 'FA').split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase()}</div>
                        <div><p className="font-semibold text-gray-950">{String(request.payload.name ?? 'Unnamed applicant')}</p><p className="mt-1 text-sm text-gray-500">{String(request.payload.email ?? 'No email')} · All branches</p><p className="mt-1 text-xs text-gray-400">Submitted by {request.requested_by_name}</p></div>
                        <StatusChip value={request.risk_level} />
                      </button>
                    ))}
                  </div>
                </Panel>

                <Panel className="overflow-hidden">
                  <div className="border-b border-gray-100 px-6 py-5"><h2 className="text-lg font-semibold text-gray-950">Current Franchise Administrators</h2></div>
                  <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-6 py-3">Account</th><th className="px-4 py-3">Username</th><th className="px-4 py-3">Created</th><th className="px-6 py-3">Status</th></tr></thead><tbody className="divide-y divide-gray-100">{accounts.map((account) => <tr key={account.id}><td className="px-6 py-4"><p className="font-semibold text-gray-900">{account.displayName ?? 'Franchise Administrator'}</p><p className="text-xs text-gray-500">{account.email ?? '—'}</p></td><td className="px-4 py-4 text-gray-600">{account.username ?? '—'}</td><td className="px-4 py-4 text-gray-600">{formatDate(account.createdAt)}</td><td className="px-6 py-4"><StatusChip value={account.status} /></td></tr>)}</tbody></table></div>
                </Panel>
              </div>

              <Panel className="self-start p-6">
                {!selected && <p className="py-20 text-center text-sm text-gray-500">Select an applicant to review.</p>}
                {selected && (
                  <>
                    <div className="flex items-center gap-4 border-b border-gray-100 pb-5"><div className="rounded-full bg-blue-100 p-3 text-blue-700"><UserCog className="h-6 w-6" /></div><div><h2 className="text-xl font-semibold text-gray-950">{String(selected.payload.name ?? 'Applicant')}</h2><p className="mt-1 text-sm text-gray-500">Franchise Administrator</p></div></div>
                    <dl className="mt-5 space-y-3 text-sm">{[['Email', selected.payload.email], ['Mobile (PH)', selected.payload.phone], ['Requested scope', 'All branches'], ['Submitted by', selected.requested_by_name], ['Submitted at', formatDate(selected.submitted_at)], ['Reason', selected.reason]].map(([label, value]) => <div key={String(label)} className="grid grid-cols-[9rem_1fr] gap-3"><dt className="text-gray-500">{String(label)}</dt><dd className="font-medium text-gray-900">{String(value ?? '—')}</dd></div>)}</dl>
                    <div className="mt-6 space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-emerald-800">{['Protected app_metadata role', 'No duplicate account on approval', 'No client-supplied branch scope'].map((check) => <p key={check} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{check}</p>)}</div>
                    <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800"><ShieldCheck className="mr-2 inline h-4 w-4" />No self-approval: requestor and approver must differ.</div>
                    <DocumentReviewPanel
                      key={selected.id}
                      requestId={selected.id}
                      onReviewStateChange={setDocumentReviewState}
                    />
                    {temporaryPassword && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">One-time temporary password</p><div className="mt-2 flex justify-between rounded-lg bg-white px-3 py-2 font-mono"><span>{temporaryPassword}</span><button type="button" onClick={() => void navigator.clipboard.writeText(temporaryPassword)} className="font-sans text-xs font-semibold text-[#007BC1]">Copy</button></div><p className="mt-2 text-xs">Not stored by the CRM.</p></div>}
                    {selected.status === 'pending' && <><label className="mt-5 block text-sm font-medium text-gray-800">Decision reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} className="mt-2 w-full resize-none rounded-xl border border-gray-300 p-3 outline-none focus:border-[#007BC1]" placeholder="Required for approval or rejection…" /></label>{documentReviewState !== 'ready' && <p className="mt-3 text-xs font-medium text-amber-700">Account decisions remain disabled until all required documents are securely available and verified.</p>}<div className="mt-4 grid grid-cols-2 gap-3"><button type="button" disabled={working || documentReviewState !== 'ready'} onClick={() => void decide('approve')} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#007BC1] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />Approve Account</button><button type="button" disabled={working || documentReviewState !== 'ready'} onClick={() => void decide('reject')} className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-400 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"><XCircle className="h-4 w-4" />Reject</button></div></>}
                  </>
                )}
              </Panel>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
