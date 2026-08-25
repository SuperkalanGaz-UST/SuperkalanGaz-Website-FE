'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Loader2,
  Mail,
  MailPlus,
  MoreHorizontal,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { governanceApi } from '../api';
import type { AdminAccount, FranchiseAdminInvitation } from '../types';
import {
  ErrorState,
  formatDate,
  LoadingState,
  Panel,
  StatusChip,
} from '../components/GovernanceUi';
import { SuperAdminHeader } from '../components/SuperAdminHeader';

export function AdminAccounts() {
  const [accounts, setAccounts] = useState<AdminAccount[] | null>(null);
  const [invitations, setInvitations] = useState<FranchiseAdminInvitation[]>([]);
  const [accountSearch, setAccountSearch] = useState('');
  const [invitationSearch, setInvitationSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [submittingInvite, setSubmittingInvite] = useState(false);
  const [actingInvitationId, setActingInvitationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await governanceApi.adminAccounts();
      setAccounts(data.accounts);
      setInvitations(data.invitations);
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

  const visibleInvitations = useMemo(() => {
    const term = invitationSearch.trim().toLowerCase();
    if (!term) return invitations;
    return invitations.filter((invitation) =>
      `${invitation.displayName} ${invitation.email} ${invitation.status}`
        .toLowerCase()
        .includes(term),
    );
  }, [invitationSearch, invitations]);

  const activeCount = accounts?.filter((account) => account.status === 'Active').length ?? 0;
  const inactiveCount = accounts?.filter((account) => account.status === 'Inactive').length ?? 0;
  const pendingInvitationCount = invitations.filter(
    (invitation) => invitation.status === 'Pending',
  ).length;

  const sendInvitation = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = inviteName.trim();
    const email = inviteEmail.trim().toLowerCase();
    if (name.length < 2) {
      setInviteError('Enter the recipient’s full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError('Enter a valid official email address.');
      return;
    }

    setSubmittingInvite(true);
    setInviteError(null);
    try {
      await governanceApi.inviteFranchiseAdministrator(name, email);
      await load();
      setInviteName('');
      setInviteEmail('');
      setInviteOpen(false);
      toast.success('Franchise Administrator invitation sent.');
    } catch (inviteFailure) {
      setInviteError(
        inviteFailure instanceof Error
          ? inviteFailure.message
          : 'Could not send the invitation. No account changes were made.',
      );
    } finally {
      setSubmittingInvite(false);
    }
  };

  const updateInvitation = async (
    invitation: FranchiseAdminInvitation,
    action: 'resend' | 'revoke',
  ) => {
    if (
      action === 'revoke' &&
      !window.confirm(
        `Revoke the invitation for ${invitation.email}? The current link will no longer grant CRM access.`,
      )
    ) {
      return;
    }
    setActingInvitationId(invitation.id);
    try {
      if (action === 'resend') {
        await governanceApi.resendFranchiseAdministratorInvitation(invitation.id);
        toast.success(`Invitation resent to ${invitation.email}.`);
      } else {
        await governanceApi.revokeFranchiseAdministratorInvitation(invitation.id);
        toast.success(`Invitation for ${invitation.email} revoked.`);
      }
      await load();
    } catch (actionFailure) {
      toast.error(
        actionFailure instanceof Error
          ? actionFailure.message
          : `Could not ${action} this invitation.`,
      );
    } finally {
      setActingInvitationId(null);
    }
  };

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
                <p className="mt-2 text-3xl font-semibold text-gray-950">
                  {pendingInvitationCount}
                </p>
                <p className="mt-1 text-xs text-gray-500">Awaiting recipient activation</p>
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
                    value={invitationSearch}
                    onChange={(event) => setInvitationSearch(event.target.value)}
                    placeholder="Search invitations..."
                    aria-label="Search invitations"
                    className="h-10 w-full rounded-lg border border-gray-200 pl-10 pr-3 text-sm outline-none focus:border-[#007BC1]"
                  />
                </label>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-6 py-3">Recipient</th>
                      <th className="px-4 py-3">Sent</th>
                      <th className="px-4 py-3">Expires</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visibleInvitations.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                          {invitationSearch
                            ? 'No invitations match your search.'
                            : 'No Franchise Administrator invitations yet.'}
                        </td>
                      </tr>
                    )}
                    {visibleInvitations.map((invitation) => {
                      const acting = actingInvitationId === invitation.id;
                      const actionInProgress = actingInvitationId !== null;
                      return (
                        <tr key={invitation.id}>
                          <td className="px-6 py-4">
                            <p className="font-semibold text-gray-900">
                              {invitation.displayName}
                            </p>
                            <p className="mt-0.5 text-gray-500">{invitation.email}</p>
                          </td>
                          <td className="px-4 py-4 text-gray-600">
                            {formatDate(invitation.confirmationSentAt)}
                          </td>
                          <td className="px-4 py-4 text-gray-600">
                            {formatDate(invitation.expiresAt)}
                          </td>
                          <td className="px-4 py-4">
                            <StatusChip value={invitation.status} />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                disabled={actionInProgress || invitation.status === 'Revoked'}
                                onClick={() => void updateInvitation(invitation, 'resend')}
                                className="h-9 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {acting ? 'Working…' : 'Resend'}
                              </button>
                              <button
                                type="button"
                                disabled={actionInProgress || invitation.status === 'Revoked'}
                                onClick={() => void updateInvitation(invitation, 'revoke')}
                                className="h-9 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Revoke
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-gray-100 px-6 py-4">
                <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
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

      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          if (submittingInvite) return;
          setInviteOpen(open);
          if (!open) setInviteError(null);
        }}
      >
        <DialogContent className="rounded-2xl border-gray-200 bg-white sm:max-w-xl">
          <form onSubmit={sendInvitation}>
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
                  value={inviteName}
                  onChange={(event) => setInviteName(event.target.value)}
                  placeholder="Enter full name"
                  autoComplete="name"
                  required
                  className="mt-2 h-11 w-full rounded-lg border border-gray-200 px-3 text-gray-900 outline-none focus:border-[#007BC1]"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Official email
                <input
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  type="email"
                  placeholder="name@example.com"
                  autoComplete="email"
                  required
                  className="mt-2 h-11 w-full rounded-lg border border-gray-200 px-3 text-gray-900 outline-none focus:border-[#007BC1]"
                />
              </label>
            </div>

            {inviteError && (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p>{inviteError}</p>
              </div>
            )}

            <DialogFooter>
              <button
                type="button"
                disabled={submittingInvite}
                onClick={() => setInviteOpen(false)}
                className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={submittingInvite}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#007BC1] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submittingInvite ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Mail className="h-4 w-4" aria-hidden="true" />
                )}
                {submittingInvite ? 'Sending…' : 'Send invitation'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
