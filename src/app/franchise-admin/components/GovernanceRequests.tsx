'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Clock3, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '../../components/Header';
import { fetchJson } from '../../lib/api';
import { staffScreenPath } from '../../lib/staffRoutes';
import { governanceApi } from '../../super-admin/api';
import type { GovernanceRequest, GovernanceRequestType } from '../../super-admin/types';
import { useSubmitGovernanceRequest } from '../useSubmitGovernanceRequest';

const SEGMENTS = [
  ['request_to_dispatch', 'Request to dispatch'],
  ['dispatch_to_in_transit', 'Dispatch to in transit'],
  ['in_transit_to_delivery', 'In transit to delivery'],
  ['end_to_end', 'End-to-end delivery'],
] as const;

function requestTypeLabel(type: GovernanceRequestType) {
  return (
    {
      'franchise-admin-account': 'Legacy FA account request',
      'price-configuration': 'Price configuration',
      'sla-threshold': 'SLA threshold',
      'branch-owner-change': 'Branch Owner change',
      'branch-account': 'Branch account',
      other: 'Other',
    } satisfies Record<GovernanceRequestType, string>
  )[type];
}

function statusClass(status: GovernanceRequest['status']) {
  if (status === 'approved') return 'bg-emerald-50 text-emerald-700';
  if (status === 'rejected') return 'bg-red-50 text-red-700';
  if (status === 'revision-requested') return 'bg-amber-50 text-amber-700';
  if (status === 'applying') return 'bg-sky-50 text-sky-700';
  return 'bg-orange-50 text-orange-700';
}

const inputClass =
  'mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#007BC1] focus:ring-2 focus:ring-[#007BC1]/15';

export function GovernanceRequests() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const { mutate, isPending: submitting } = useSubmitGovernanceRequest();
  const [revising, setRevising] = useState<GovernanceRequest | null>(null);
  const [slaSegment, setSlaSegment] = useState<(typeof SEGMENTS)[number][0]>(
    'request_to_dispatch',
  );
  const [slaMinutes, setSlaMinutes] = useState('15');
  const [slaReason, setSlaReason] = useState('');

  const { data: requests = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ['governance-requests'],
    queryFn: () => governanceApi.requests(),
    staleTime: 30_000,
  });
  const { data: thresholds, isError: thresholdsError } = useQuery({
    queryKey: ['sla-thresholds'],
    queryFn: () => fetchJson<{ thresholds: Record<string, number> }>('/governance/sla-thresholds'),
    staleTime: 60_000,
  });
  const currentMinutes = thresholds?.thresholds?.[slaSegment];

  // SLA requests are revised here; price and owner requests on the screen that made them.
  function revise(request: GovernanceRequest) {
    if (request.type === 'sla-threshold') {
      setSlaSegment(request.payload.segment as typeof slaSegment);
      setSlaMinutes(String(request.payload.thresholdMinutes ?? ''));
      setSlaReason(request.reason);
      setRevising(request);
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const screen = request.type === 'price-configuration' ? 'price-config' : 'franchise-registry';
    router.push(`${staffScreenPath('franchise-admin', screen)}?revise=${request.id}`);
  }

  function submitSla(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const thresholdMinutes = Number(slaMinutes);
    if (!Number.isInteger(thresholdMinutes) || thresholdMinutes < 1 || thresholdMinutes > 1440) {
      toast.error('Threshold must be a whole number from 1 to 1440 minutes.');
      return;
    }
    if (slaReason.trim().length < 5) {
      toast.error('Explain why the SLA threshold should change.');
      return;
    }
    const segmentLabel = SEGMENTS.find(([value]) => value === slaSegment)?.[1] ?? slaSegment;
    mutate({
      type: 'sla-threshold',
      title: `${segmentLabel} SLA threshold: ${thresholdMinutes} minutes`,
      reason: slaReason.trim(),
      riskLevel: 'high',
      payload: { segment: slaSegment, thresholdMinutes },
      revisesRequestId: revising?.id,
    }, { onSuccess: () => { setSlaReason(''); setRevising(null); } });
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <Header
        title="Governance Requests"
      />

      <main className="mx-auto w-full max-w-[1540px] space-y-7 px-8 pb-10">
        <section className="grid gap-7 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,.85fr)]">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  SLA threshold request
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Submission does not apply the change. A Super Administrator must approve it.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-[#007BC1]">
                <ShieldCheck className="h-4 w-4" /> Approval required
              </span>
            </div>

            <form ref={formRef} onSubmit={submitSla} className="grid gap-5 sm:grid-cols-2">
              {revising && (
                <div className="flex items-start justify-between gap-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 sm:col-span-2">
                  <p>
                    Revising <span className="font-semibold">{revising.title}</span>
                    {revising.decision_reason && <><br /><span className="font-semibold">Reviewer note:</span> {revising.decision_reason}</>}
                  </p>
                  <button type="button" onClick={() => { setRevising(null); setSlaReason(''); }} className="shrink-0 font-semibold underline underline-offset-4">
                    Cancel revision
                  </button>
                </div>
              )}
              <label className="text-sm font-medium text-slate-700">
                SLA segment
                <select value={slaSegment} onChange={(e) => setSlaSegment(e.target.value as typeof slaSegment)} className={inputClass}>
                  {SEGMENTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Threshold in minutes
                <input required type="number" min={1} max={1440} step={1} value={slaMinutes} onChange={(e) => setSlaMinutes(e.target.value)} className={inputClass} />
                <span className="mt-1.5 block text-xs font-normal text-slate-500">
                  {thresholdsError ? 'Could not load the current threshold.' : !thresholds ? 'Loading current threshold…' : currentMinutes === undefined ? 'Currently not set' : `Currently ${currentMinutes} minutes`}
                </span>
              </label>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                Business justification
                <textarea required minLength={5} maxLength={1000} rows={4} value={slaReason} onChange={(e) => setSlaReason(e.target.value)} className={`${inputClass} h-auto py-3`} />
              </label>
              <div className="sm:col-span-2 flex justify-end">
                <button disabled={submitting} className="rounded-lg bg-[#007BC1] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#00679f] disabled:opacity-50">
                  {submitting ? 'Submitting…' : revising ? 'Resubmit SLA request' : 'Submit SLA request'}
                </button>
              </div>
            </form>
          </div>

          <aside className="rounded-xl border border-slate-200 bg-gradient-to-br from-[#007BC1] to-[#005f96] p-6 text-white shadow-sm">
            <ShieldCheck className="h-8 w-8" aria-hidden="true" />
            <h2 className="mt-5 text-xl font-semibold">Separated governance</h2>
            <p className="mt-2 text-sm leading-6 text-sky-100">
              Franchise Administrators prepare and justify requests. Super Administrators independently review them before controlled changes are applied.
            </p>
            <div className="mt-7 space-y-3 text-sm">
              <p className="flex items-center gap-3"><Clock3 className="h-4 w-4" /> Pending requests remain unchanged</p>
              <p className="flex items-center gap-3"><ShieldCheck className="h-4 w-4" /> Every decision enters the audit trail</p>
            </div>
          </aside>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
            <div>
              <h2 className="font-semibold text-slate-900">My submitted requests</h2>
              <p className="mt-1 text-xs text-slate-500">Newest requests appear first.</p>
            </div>
            <button type="button" onClick={() => void refetch()} className="text-sm font-semibold text-[#007BC1] hover:underline">Refresh</button>
          </div>
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">Loading requests…</div>
          ) : error ? (
            <div className="p-10 text-center text-sm text-red-600">{error.message}</div>
          ) : requests.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">No governance requests submitted yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Request</th>
                    <th className="px-6 py-3 font-semibold">Type</th>
                    <th className="px-6 py-3 font-semibold">Submitted</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold">Decision note</th>
                    <th className="px-6 py-3 font-semibold"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.map((request) => (
                    <tr key={request.id} className="text-slate-700">
                      <td className="max-w-[300px] px-6 py-4">
                        <p className="font-medium text-slate-900">{request.title}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">{request.reason}</p>
                      </td>
                      <td className="px-6 py-4">{requestTypeLabel(request.type)}</td>
                      <td className="whitespace-nowrap px-6 py-4">{new Date(request.submitted_at).toLocaleString('en-PH')}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(request.status)}`}>
                          {request.status.replaceAll('-', ' ')}
                        </span>
                      </td>
                      <td className="max-w-[260px] px-6 py-4 text-xs text-slate-500">{request.decision_reason ?? 'Awaiting review'}</td>
                      <td className="px-6 py-4 text-right">
                        {request.status === 'revision-requested' && ['sla-threshold', 'price-configuration', 'branch-owner-change'].includes(request.type) && (
                          <button type="button" onClick={() => revise(request)} className="text-sm font-semibold text-[#007BC1] hover:underline">
                            Revise
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
