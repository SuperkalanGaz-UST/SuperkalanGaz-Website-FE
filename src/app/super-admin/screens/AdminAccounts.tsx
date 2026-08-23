'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Mail,
  MailPlus,
  MoreHorizontal,
  Search,
  ShieldCheck,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { governanceApi } from '../api';
import type { AdminAccount } from '../types';
import {
  ErrorState,
  formatDate,
  LoadingState,
  Panel,
  StatusChip,
} from '../components/GovernanceUi';
import { SuperAdminHeader } from '../components/SuperAdminHeader';

// The web must not pretend an invitation was sent before the NestJS BFF exposes
// an audited invitation endpoint and lifecycle feed.
const INVITATION_SERVICE_AVAILABLE = false;

export function AdminAccounts() {
  const [accounts, setAccounts] = useState<AdminAccount[] | null>(null);
  const [accountSearch, setAccountSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await governanceApi.adminAccounts();
      setAccounts(data.accounts);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load Franchise Administrator accounts.',
      );
    }
  }, []);

  useEffect(() => void load(), [load]);

  const visibleAccounts = useMemo(() => {
    if (!accounts) return [];
    const term = accountSearch.trim().toLowerCase();
    if (!term) return accounts;
    return accounts.filter((account) =>
      `${account.displayName ?? ''} ${account.email ?? ''}`.toLowerCase().includes(term),
    );
  }, [accountSearch, accounts]);

  const activeCount = accounts?.filter((account) => account.status === 'Active').length ?? 0;
  const inactiveCount = accounts?.filter((account) => account.status === 'Inactive').length ?? 0;

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f8fa]">
      <SuperAdminHeader
        title="Franchise Administrator Accounts"
        description="Invite and manage Franchise Administrator access."
        actions={
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#007BC1] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#00679f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007BC1] focus-visible:ring-offset-2"
          >
            <MailPlus className="h-4 w-4" aria-hidden="true" />
            Invite Franchise Administrator
          </button>
        }
      />

      <main className="mx-auto w-full max-w-[1560px] px-8 pb-10">
        {!accounts && !error && <LoadingState />}
        {error && <ErrorState message={error} onRetry={() => void load()} />}

        {accounts && (
          <div className="space-y-6">
            <div className="grid gap-5 md:grid-cols-3">
              <Panel className="p-5">
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Pending invitations
                </p>
                <p className="mt-2 text-3xl font-semibold text-gray-400">—</p>
                <p className="mt-1 text-xs text-amber-700">Invitation feed unavailable</p>
              </Panel>
              <Panel className="p-5">
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Active Franchise Administrators
                </p>
                <p className="mt-2 text-3xl font-semibold text-gray-950">{activeCount}</p>
              </Panel>
              <Panel className="p-5">
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Inactive accounts
                </p>
                <p className="mt-2 text-3xl font-semibold text-gray-950">{inactiveCount}</p>
              </Panel>
            </div>

            <Panel className="overflow-hidden">
              <div className="flex flex-col justify-between gap-4 border-b border-gray-100 px-6 py-5 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-lg font-semibold text-gray-950">Pending Invitations</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Track invitations until they are accepted, expired, or revoked.
                  </p>
                </div>
                <label className="relative block w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    disabled
                    placeholder="Search invitations..."
                    aria-label="Search invitations"
                    className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-3 text-sm text-gray-500 outline-none disabled:cursor-not-allowed"
                  />
                </label>
              </div>

              <div className="px-6 py-8">
                <div className="flex flex-col items-center py-4 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                    <AlertCircle className="h-7 w-7" aria-hidden="true" />
                  </span>
                  <p className="mt-4 font-semibold text-gray-900">
                    Invitation service unavailable.
                  </p>
                  <p className="mt-1 max-w-xl text-sm leading-6 text-gray-500">
                    The NestJS invitation endpoint and lifecycle feed must be implemented
                    before this screen can send or report invitations.
                  </p>
                </div>

                <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <p>
                    Invitation links must be single-use, expiring, and revocable. The
                    recipient sets their own password.
                  </p>
                </div>
              </div>
            </Panel>

            <Panel className="overflow-hidden">
              <div className="flex flex-col justify-between gap-4 border-b border-gray-100 px-6 py-5 sm:flex-row sm:items-center">
                <h2 className="text-lg font-semibold text-gray-950">
                  Current Franchise Administrators
                </h2>
                <label className="relative block w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={accountSearch}
                    onChange={(event) => setAccountSearch(event.target.value)}
                    placeholder="Search accounts..."
                    aria-label="Search Franchise Administrator accounts"
                    className="h-10 w-full rounded-lg border border-gray-200 pl-10 pr-3 text-sm outline-none focus:border-[#007BC1]"
                  />
                </label>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-6 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visibleAccounts.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                          No Franchise Administrator accounts match your search.
                        </td>
                      </tr>
                    )}
                    {visibleAccounts.map((account) => (
                      <tr key={account.id}>
                        <td className="px-6 py-4 font-semibold text-gray-900">
                          {account.displayName ?? 'Franchise Administrator'}
                        </td>
                        <td className="px-4 py-4 text-gray-600">{account.email ?? '—'}</td>
                        <td className="px-4 py-4 text-gray-600">
                          {formatDate(account.createdAt)}
                        </td>
                        <td className="px-4 py-4">
                          <StatusChip value={account.status} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            disabled
                            title="Account actions require the invitation-management API"
                            aria-label={`Manage ${account.displayName ?? 'Franchise Administrator'} account`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-400 disabled:cursor-not-allowed"
                          >
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        )}
      </main>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="rounded-2xl border-gray-200 bg-white sm:max-w-xl">
          <DialogHeader>
            <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#007BC1]">
              <MailPlus className="h-5 w-5" aria-hidden="true" />
            </span>
            <DialogTitle>Invite Franchise Administrator</DialogTitle>
            <DialogDescription className="leading-6 text-gray-500">
              The recipient will verify their email and set their own password. Sending the
              invitation is the Super Administrator&apos;s authorization; no second approval is
              required.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <label className="text-sm font-medium text-gray-700">
              Full name
              <input
                disabled={!INVITATION_SERVICE_AVAILABLE}
                placeholder="Enter full name"
                className="mt-2 h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-gray-500 disabled:cursor-not-allowed"
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Official email
              <input
                disabled={!INVITATION_SERVICE_AVAILABLE}
                type="email"
                placeholder="name@example.com"
                className="mt-2 h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-gray-500 disabled:cursor-not-allowed"
              />
            </label>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              Invitation sending is not available until the NestJS endpoint is implemented.
              No account changes will be made.
            </p>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setInviteOpen(false)}
              className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
            <button
              type="button"
              disabled={!INVITATION_SERVICE_AVAILABLE}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#007BC1] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              Send invitation
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
