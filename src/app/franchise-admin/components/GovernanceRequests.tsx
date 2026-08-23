'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Clock3,
  Gauge,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '../../components/Header';
import { apiErrorMessage, apiFetch } from '../../lib/api';
import type {
  GovernanceRequest,
  GovernanceRequestType,
} from '../../super-admin/types';

type RequestForm = 'sla-threshold' | 'branch-owner-change';

interface BranchOption {
  id: string;
  name: string;
  status: 'active' | 'inactive';
}

interface OwnerOption {
  id: string;
  email: string | null;
  display_name: string | null;
  branches: string[];
  status: 'Active' | 'Inactive';
}

const FORM_TABS: {
  id: RequestForm;
  label: string;
  description: string;
  icon: typeof Gauge;
}[] = [
  {
    id: 'sla-threshold',
    label: 'SLA threshold',
    description: 'Propose a system-wide Service Level threshold.',
    icon: Gauge,
  },
  {
    id: 'branch-owner-change',
    label: 'Branch Owner',
    description: 'Request reassignment of an active branch.',
    icon: UsersRound,
  },
];

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

async function responseJson<T>(response: Response, fallback: string): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(apiErrorMessage(body, fallback));
  return body as T;
}

const inputClass =
  'mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#007BC1] focus:ring-2 focus:ring-[#007BC1]/15';

export function GovernanceRequests() {
  const [activeForm, setActiveForm] = useState<RequestForm>('sla-threshold');
  const [requests, setRequests] = useState<GovernanceRequest[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [owners, setOwners] = useState<OwnerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [slaSegment, setSlaSegment] = useState<(typeof SEGMENTS)[number][0]>(
    'request_to_dispatch',
  );
  const [slaMinutes, setSlaMinutes] = useState('15');
  const [slaReason, setSlaReason] = useState('');

  const [branchId, setBranchId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [ownerReason, setOwnerReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [requestResponse, branchResponse, ownerResponse] = await Promise.all([
        apiFetch('/governance/requests?limit=200'),
        apiFetch('/branches'),
        apiFetch('/users?role=branch-owner'),
      ]);
      const [requestBody, branchBody, ownerBody] = await Promise.all([
        responseJson<{ requests: GovernanceRequest[] }>(
          requestResponse,
          'Could not load governance requests.',
        ),
        responseJson<{ branches: BranchOption[] }>(branchResponse, 'Could not load branches.'),
        responseJson<{ users: OwnerOption[] }>(ownerResponse, 'Could not load Branch Owners.'),
      ]);
      setRequests(requestBody.requests);
      setBranches(branchBody.branches.filter((branch) => branch.status === 'active'));
      setOwners(ownerBody.users.filter((owner) => owner.status === 'Active'));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load governance data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === branchId),
    [branchId, branches],
  );

  const submit = async (body: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      const response = await apiFetch('/governance/requests', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      await responseJson(response, 'Could not submit the governance request.');
      toast.success('Request submitted for Super Administrator review.');
      window.dispatchEvent(new Event('notifications:refresh'));
      await load();
      return true;
    } catch (submitError) {
      toast.error(
        submitError instanceof Error
          ? submitError.message
          : 'Could not submit the governance request.',
      );
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const submitSla = async (event: FormEvent) => {
    event.preventDefault();
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
    const success = await submit({
      type: 'sla-threshold',
      title: `${segmentLabel} SLA threshold: ${thresholdMinutes} minutes`,
      reason: slaReason.trim(),
      riskLevel: 'high',
      payload: { segment: slaSegment, thresholdMinutes },
    });
    if (success) setSlaReason('');
  };

  const submitOwner = async (event: FormEvent) => {
    event.preventDefault();
    if (!branchId || !ownerId) {
      toast.error('Select both an active branch and its proposed Branch Owner.');
      return;
    }
    if (ownerReason.trim().length < 5) {
      toast.error('Explain why the Branch Owner should change.');
      return;
    }
    const success = await submit({
      type: 'branch-owner-change',
      title: `Reassign Branch Owner for ${selectedBranch?.name ?? 'branch'}`,
      reason: ownerReason.trim(),
      riskLevel: 'medium',
      branchId,
      payload: { newOwnerId: ownerId },
    });
    if (success) {
      setBranchId('');
      setOwnerId('');
      setOwnerReason('');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <Header
        title="Governance Requests"
        description="Submit controlled changes for Super Administrator review and track every decision."
      />

      <main className="mx-auto w-full max-w-[1540px] space-y-7 px-8 pb-10">
        <section className="grid gap-4 lg:grid-cols-2" aria-label="Request types">
          {FORM_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeForm === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveForm(tab.id)}
                className={`rounded-xl border p-5 text-left transition ${
                  active
                    ? 'border-[#007BC1] bg-[#007BC1] text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-800 hover:border-[#007BC1]/50'
                }`}
              >
                <Icon className="mb-4 h-6 w-6" aria-hidden="true" />
                <span className="block text-sm font-semibold">{tab.label}</span>
                <span className={`mt-1 block text-xs ${active ? 'text-sky-100' : 'text-slate-500'}`}>
                  {tab.description}
                </span>
              </button>
            );
          })}
        </section>

        <section className="grid gap-7 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,.85fr)]">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {FORM_TABS.find((tab) => tab.id === activeForm)?.label} request
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Submission does not apply the change. A Super Administrator must approve it.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-[#007BC1]">
                <ShieldCheck className="h-4 w-4" /> Approval required
              </span>
            </div>

            {activeForm === 'sla-threshold' && (
              <form onSubmit={submitSla} className="grid gap-5 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  SLA segment
                  <select value={slaSegment} onChange={(e) => setSlaSegment(e.target.value as typeof slaSegment)} className={inputClass}>
                    {SEGMENTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Threshold in minutes
                  <input required type="number" min={1} max={1440} step={1} value={slaMinutes} onChange={(e) => setSlaMinutes(e.target.value)} className={inputClass} />
                </label>
                <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                  Business justification
                  <textarea required minLength={5} rows={4} value={slaReason} onChange={(e) => setSlaReason(e.target.value)} className={`${inputClass} h-auto py-3`} />
                </label>
                <div className="sm:col-span-2 flex justify-end">
                  <button disabled={submitting} className="rounded-lg bg-[#007BC1] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#00679f] disabled:opacity-50">
                    {submitting ? 'Submitting…' : 'Submit SLA request'}
                  </button>
                </div>
              </form>
            )}

            {activeForm === 'branch-owner-change' && (
              <form onSubmit={submitOwner} className="grid gap-5 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Active branch
                  <select required value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputClass}>
                    <option value="">Select a branch</option>
                    {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Proposed Branch Owner
                  <select required value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={inputClass}>
                    <option value="">Select a Branch Owner</option>
                    {owners.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.display_name ?? owner.email ?? owner.id}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                  Business justification
                  <textarea required minLength={5} rows={4} value={ownerReason} onChange={(e) => setOwnerReason(e.target.value)} className={`${inputClass} h-auto py-3`} />
                </label>
                <div className="sm:col-span-2 flex justify-end">
                  <button disabled={submitting} className="rounded-lg bg-[#007BC1] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#00679f] disabled:opacity-50">
                    {submitting ? 'Submitting…' : 'Submit reassignment request'}
                  </button>
                </div>
              </form>
            )}
          </div>

          <aside className="rounded-xl border border-slate-200 bg-gradient-to-br from-[#007BC1] to-[#005f96] p-6 text-white shadow-sm">
            <ShieldCheck className="h-8 w-8" aria-hidden="true" />
            <h2 className="mt-5 text-xl font-semibold">Separated governance</h2>
            <p className="mt-2 text-sm leading-6 text-sky-100">
              Franchise Administrators prepare and justify requests. Super Administrators independently review them before controlled changes are applied.
            </p>
            <div className="mt-7 space-y-3 text-sm">
              <p className="flex items-center gap-3"><Clock3 className="h-4 w-4" /> Pending requests remain unchanged</p>
              <p className="flex items-center gap-3"><Building2 className="h-4 w-4" /> Branch scope is validated by the API</p>
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
            <button type="button" onClick={() => void load()} className="text-sm font-semibold text-[#007BC1] hover:underline">Refresh</button>
          </div>
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">Loading requests…</div>
          ) : error ? (
            <div className="p-10 text-center text-sm text-red-600">{error}</div>
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
