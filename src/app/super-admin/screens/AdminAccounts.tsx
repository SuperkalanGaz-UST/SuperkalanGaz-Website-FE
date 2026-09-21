'use client';

import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Mail,
  MailPlus,
  MoreHorizontal,
  Search,
  ShieldCheck,
  Upload,
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

interface ParsedInviteRow {
  name: string;
  email: string;
  error: string | null;
}

// A controlled two-column admin list, not arbitrary user data — a full
// RFC4180 parser is overkill here.
function parseInvitationCsv(text: string): ParsedInviteRow[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const startIndex = /name/i.test(lines[0]) && /email/i.test(lines[0]) ? 1 : 0;

  return lines.slice(startIndex).map((line) => {
    const [rawName = '', rawEmail = ''] = line.split(',');
    const name = rawName.trim().replace(/^"|"$/g, '');
    const email = rawEmail.trim().replace(/^"|"$/g, '').toLowerCase();
    let error: string | null = null;
    if (name.length < 2) error = 'Name is too short.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) error = 'Invalid email address.';
    return { name, email, error };
  });
}

export function AdminAccounts() {
  const [accountSearch, setAccountSearch] = useState('');
  const [invitationSearch, setInvitationSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [submittingInvite, setSubmittingInvite] = useState(false);
  const [actingInvitationId, setActingInvitationId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkFileName, setBulkFileName] = useState<string | null>(null);
  const [bulkRows, setBulkRows] = useState<ParsedInviteRow[]>([]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ succeeded: number; failed: { email: string; message: string }[] } | null>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  const { data, error: queryError, refetch: load } = useQuery({
    queryKey: ['admin-accounts'],
    queryFn: () => governanceApi.adminAccounts(),
  });
  
  const accounts = data?.accounts ?? null;
  const invitations = useMemo(() => data?.invitations ?? [], [data]);
  const error = queryError ? queryError.message : null;

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

  const validBulkRows = useMemo(() => bulkRows.filter((row) => !row.error), [bulkRows]);

  const handleBulkFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBulkFileName(file.name);
    setBulkResult(null);
    setBulkRows(parseInvitationCsv(await file.text()));
  };

  const submitBulkImport = async () => {
    if (validBulkRows.length === 0) return;
    setBulkSubmitting(true);
    const results = await Promise.allSettled(
      validBulkRows.map((row) => governanceApi.inviteFranchiseAdministrator(row.name, row.email)),
    );
    const failed: { email: string; message: string }[] = [];
    let succeeded = 0;
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        succeeded += 1;
      } else {
        failed.push({
          email: validBulkRows[index].email,
          message: result.reason instanceof Error ? result.reason.message : 'Could not send this invitation.',
        });
      }
    });
    setBulkResult({ succeeded, failed });
    setBulkSubmitting(false);
    if (succeeded > 0) {
      await load();
      toast.success(`${succeeded} invitation${succeeded === 1 ? '' : 's'} sent.`);
    }
    if (failed.length > 0) {
      toast.error(`${failed.length} invitation${failed.length === 1 ? '' : 's'} failed.`);
    }
  };

  const closeBulkDialog = () => {
    if (bulkSubmitting) return;
    setBulkOpen(false);
    setBulkRows([]);
    setBulkFileName(null);
    setBulkResult(null);
    if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
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
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setBulkOpen(true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007BC1] focus-visible:ring-offset-2"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              Bulk import
            </button>
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#007BC1] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#00679f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007BC1] focus-visible:ring-offset-2"
            >
              <MailPlus className="h-4 w-4" aria-hidden="true" />
              Invite Franchise Administrator
            </button>
          </div>
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

      <Dialog
        open={bulkOpen}
        onOpenChange={(open) => {
          if (bulkSubmitting) return;
          if (!open) closeBulkDialog();
          else setBulkOpen(true);
        }}
      >
        <DialogContent className="rounded-2xl border-gray-200 bg-white sm:max-w-xl">
          <DialogHeader>
            <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#007BC1]">
              <Upload className="h-5 w-5" aria-hidden="true" />
            </span>
            <DialogTitle>Bulk import Franchise Administrators</DialogTitle>
            <DialogDescription className="leading-6 text-gray-500">
              Upload a CSV with <code>name,email</code> columns (one header row, one Franchise
              Administrator per row). Each valid row sends its own invitation — recipients still
              verify their email and set their own password.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <input
              ref={bulkFileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => void handleBulkFileSelect(event)}
              className="block w-full text-sm text-gray-700 file:mr-4 file:h-10 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:text-sm file:font-semibold file:text-gray-700 hover:file:bg-gray-200"
            />

            {bulkRows.length > 0 && (
              <div className="mt-4 max-h-64 overflow-y-auto rounded-lg border border-gray-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2">Email</th>
                      <th className="px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bulkRows.map((row, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2">{row.name || '—'}</td>
                        <td className="px-4 py-2">{row.email || '—'}</td>
                        <td className="px-4 py-2">
                          {row.error ? (
                            <span className="text-xs font-medium text-red-600">{row.error}</span>
                          ) : (
                            <span className="text-xs font-medium text-green-600">Ready</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {bulkFileName && bulkRows.length > 0 && (
              <p className="mt-2 text-xs text-gray-500">
                {validBulkRows.length} of {bulkRows.length} row{bulkRows.length === 1 ? '' : 's'} in{' '}
                {bulkFileName} are ready to send.
              </p>
            )}

            {bulkResult && (
              <div className="mt-4 flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  {bulkResult.succeeded} invitation{bulkResult.succeeded === 1 ? '' : 's'} sent.
                </div>
                {bulkResult.failed.map((failure, index) => (
                  <div key={index} className="flex items-start gap-2 text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      {failure.email}: {failure.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              disabled={bulkSubmitting}
              onClick={closeBulkDialog}
              className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
            <button
              type="button"
              disabled={bulkSubmitting || validBulkRows.length === 0}
              onClick={() => void submitBulkImport()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#007BC1] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bulkSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="h-4 w-4" aria-hidden="true" />
              )}
              {bulkSubmitting
                ? 'Sending…'
                : `Send ${validBulkRows.length || ''} invitation${validBulkRows.length === 1 ? '' : 's'}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
