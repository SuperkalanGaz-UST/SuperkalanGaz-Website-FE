import { useId, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '../../lib/api';
import { useSubmitGovernanceRequest } from '../useSubmitGovernanceRequest';

interface OwnerOption {
  id: string;
  email: string | null;
  display_name: string | null;
  status: 'Active' | 'Inactive' | 'Pending';
}

interface BranchOwnerReassignmentFormProps {
  branch: { id: string; name: string };
  currentOwner: OwnerOption;
  onBack: () => void;
}

const fieldClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-[#007BC1]';

export function BranchOwnerReassignmentForm({
  branch,
  currentOwner,
  onBack,
}: BranchOwnerReassignmentFormProps) {
  const [ownerId, setOwnerId] = useState('');
  const [reason, setReason] = useState('');
  const ownerSelectId = useId();
  const { mutate, isPending: submitting } = useSubmitGovernanceRequest();
  const { data, isPending: loading, isError, isFetching, refetch } = useQuery({
    queryKey: ['branch-owners'],
    queryFn: () => fetchJson<{ users: OwnerOption[] }>('/users?role=branch-owner', {
      signal: AbortSignal.timeout(10_000),
    }),
    retry: false,
  });
  const owners = (data?.users ?? []).filter(
    (owner) => owner.status === 'Active' && owner.id !== currentOwner.id,
  );
  const canSubmit = !isError && !isFetching && !submitting &&
    owners.some((owner) => owner.id === ownerId) && reason.trim().length >= 5;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    mutate({
      type: 'branch-owner-change',
      title: `Reassign Branch Owner for ${branch.name}`.slice(0, 120),
      reason: reason.trim(),
      riskLevel: 'medium',
      branchId: branch.id,
      payload: { newOwnerId: ownerId },
    }, { onSuccess: onBack });
  }

  return (
    <form onSubmit={submit} className="space-y-5 p-6">
      <div>
        <h3 className="font-semibold text-slate-900">Request Branch Owner reassignment</h3>
        <p className="mt-1 text-sm text-slate-600">
          A Super Administrator must approve the transfer before it takes effect.
        </p>
      </div>
      <dl className="grid gap-3 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-600">Active branch</dt>
          <dd className="font-medium text-slate-900">{branch.name}</dd>
        </div>
        <div>
          <dt className="text-slate-600">Current Branch Owner</dt>
          <dd className="font-medium text-slate-900">
            {currentOwner.display_name ?? currentOwner.email ?? currentOwner.id} ({currentOwner.status})
          </dd>
        </div>
      </dl>
      {isError ? (
        <div role="alert" className="text-sm text-red-700">
          Could not load eligible Branch Owners.{' '}
          <button type="button" disabled={isFetching} onClick={() => void refetch()} className="underline">
            Retry
          </button>
        </div>
      ) : (
        <div>
          <label htmlFor={ownerSelectId} className="block text-sm font-medium text-slate-700">
            Proposed Branch Owner
          </label>
          <select id={ownerSelectId} required disabled={loading || submitting || owners.length === 0} value={ownerId}
            onChange={(event) => setOwnerId(event.target.value)} className={fieldClass}>
            <option value="">
              {loading ? 'Loading Branch Owners…' : owners.length === 0 ? 'No other active Branch Owners' : 'Select a Branch Owner'}
            </option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.display_name ?? owner.email ?? owner.id}
              </option>
            ))}
          </select>
        </div>
      )}
      <label className="block text-sm font-medium text-slate-700">
        Business justification
        <textarea required minLength={5} maxLength={1000} rows={4} value={reason} disabled={submitting}
          onChange={(event) => setReason(event.target.value)} className={fieldClass} />
      </label>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onBack} disabled={submitting}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 disabled:opacity-50">
          Back to branch details
        </button>
        <button disabled={!canSubmit}
          className="rounded-lg bg-[#007BC1] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00679f] disabled:opacity-50">
          {submitting ? 'Submitting…' : 'Submit reassignment request'}
        </button>
      </div>
    </form>
  );
}
