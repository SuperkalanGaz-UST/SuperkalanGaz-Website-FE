import { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './Header';
import {
  Eye,
  EyeOff,
  MailPlus,
  Pencil,
  RotateCcw,
  Search,
  UserPlus,
  UserX,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useBranch } from '../contexts/BranchContext';
import { apiFetch, apiErrorMessage } from '../../lib/api';

interface BranchManager {
  id: string;
  name: string;
  email: string;
  phone: string;
  username: string;
  branchIds: string[];
  branches: string[];
  status: 'Active' | 'Inactive';
  dateCreated: string;
  lastLogin: string;
}

interface DeliveryRiderInvitation {
  invitationId: string;
  recipientName: string;
  email: string;
  mobile: string;
  branchId: string;
  branchName: string;
  status: 'Pending' | 'Expired' | 'Revoked' | 'Accepted';
  invitedAt: string;
  confirmationSentAt: string;
  expiresAt: string;
  emailVerified: boolean;
  mobileVerified: boolean;
}

type RoleFilter = 'all' | 'branch-manager' | 'driver';
type StatusFilter =
  | 'all'
  | BranchManager['status']
  | DeliveryRiderInvitation['status'];

/** Shape returned by GET /users on the CRM API (projected from auth.users app_metadata). */
interface ProfileRow {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  phone: string | null;
  branch_ids: string[] | null;
  branches: string[] | null;
  status: 'Active' | 'Inactive';
  created_at: string;
  last_login_at: string | null;
}

function toManager(p: ProfileRow): BranchManager {
  return {
    id: p.id,
    name: p.display_name ?? p.username ?? '—',
    email: p.email ?? '—',
    phone: p.phone ?? '',
    username: p.username ?? '',
    branchIds: p.branch_ids ?? [],
    branches: p.branches ?? [],
    status: p.status,
    dateCreated: p.created_at
      ? new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '—',
    lastLogin: displayDateTime(p.last_login_at),
  };
}

function formatNationalMobile(value: string): string {
  const digits = value.replace(/\D/g, '').replace(/^63/, '').replace(/^0/, '').slice(0, 10);
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)]
    .filter(Boolean)
    .join(' ');
}

function canonicalPhMobile(value: string): string | null {
  const digits = value.replace(/\D/g, '').replace(/^63/, '').replace(/^0/, '');
  return /^9\d{9}$/.test(digits) ? `+63${digits}` : null;
}

function displayDate(value: string): string {
  return value
    ? new Date(value).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';
}

function displayDateTime(value: string | null): string {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function UserManagement() {
  const {
    selectedBranch,
    selectedBranchId,
    availableBranches,
    availableBranchOptions,
  } = useBranch();
  // A multi-branch owner manages managers across ALL their branches at once; a
  // single-branch owner stays scoped to their one branch.
  const isMultiBranch = availableBranches.length > 1;
  const [managers, setManagers] = useState<BranchManager[]>([]);
  const [invitations, setInvitations] = useState<DeliveryRiderInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    if (!isMultiBranch && !selectedBranchId) {
      setManagers([]);
      setInvitations([]);
      setLoading(false);
      return;
    }
    try {
      // Multi-branch owners see every manager across all their branches: the API
      // scopes an unqualified list to the caller's own branches. Single-branch
      // owners stay pinned to their one selected branch.
      const managerRequest = apiFetch(
        isMultiBranch
          ? '/users?role=branch-manager'
          : `/users?role=branch-manager&branchId=${encodeURIComponent(selectedBranchId ?? '')}`,
      );
      const invitationRequest = apiFetch(
        isMultiBranch
          ? '/delivery-rider-invitations'
          : `/delivery-rider-invitations?branchId=${encodeURIComponent(selectedBranchId ?? '')}`,
      );
      const [managerResult, invitationResult] = await Promise.allSettled([
        managerRequest,
        invitationRequest,
      ]);

      if (managerResult.status === 'fulfilled') {
        const data = await managerResult.value.json();
        if (!managerResult.value.ok) {
          setManagers([]);
          toast.error(apiErrorMessage(data, 'Failed to load Branch Managers'));
        } else {
          setManagers((data.users as ProfileRow[]).map(toManager));
        }
      } else {
        setManagers([]);
        toast.error('Branch Manager accounts are temporarily unavailable.');
      }

      if (invitationResult.status === 'fulfilled') {
        const data = await invitationResult.value.json();
        if (!invitationResult.value.ok) {
          setInvitations([]);
          toast.error(apiErrorMessage(data, 'Failed to load Delivery Rider invitations'));
        } else {
          setInvitations(data.invitations as DeliveryRiderInvitation[]);
        }
      } else {
        setInvitations([]);
        toast.error('Delivery Rider invitations are temporarily unavailable.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load users');
      setManagers([]);
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, isMultiBranch]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const filteredManagers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return managers.filter((manager) => {
      const matchesSearch =
        query === '' ||
        manager.name.toLowerCase().includes(query) ||
        manager.email.toLowerCase().includes(query);
      const matchesRole = roleFilter === 'all' || roleFilter === 'branch-manager';
      const matchesStatus = statusFilter === 'all' || manager.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [managers, roleFilter, searchQuery, statusFilter]);

  const filteredInvitations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return invitations.filter((invitation) => {
      const matchesSearch =
        query === '' ||
        invitation.recipientName.toLowerCase().includes(query) ||
        invitation.email.toLowerCase().includes(query);
      const matchesRole = roleFilter === 'all' || roleFilter === 'driver';
      const matchesStatus = statusFilter === 'all' || invitation.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [invitations, roleFilter, searchQuery, statusFilter]);

  const filtersActive =
    searchQuery.trim() !== '' || roleFilter !== 'all' || statusFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setRoleFilter('all');
    setStatusFilter('all');
  };

  const [showModal, setShowModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingManager, setEditingManager] = useState<BranchManager | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [invitationToRevoke, setInvitationToRevoke] =
    useState<DeliveryRiderInvitation | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [invitationBusyId, setInvitationBusyId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    username: '',
    password: '',
    confirmPassword: '',
    // Which branch this manager account belongs to. Only editable by multi-branch
    // owners (single-branch owners always target their one branch).
    branchId: selectedBranchId ?? '',
    status: 'Active' as 'Active' | 'Inactive',
  });

  const [inviteForm, setInviteForm] = useState({
    recipientName: '',
    email: '',
    mobile: '',
    branchId: selectedBranchId ?? '',
  });

  const handleInviteClick = () => {
    setInviteForm({
      recipientName: '',
      email: '',
      mobile: '',
      branchId: selectedBranchId ?? availableBranchOptions[0]?.id ?? '',
    });
    setShowInviteModal(true);
  };

  const handleAddClick = () => {
    setEditingManager(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      username: '',
      password: '',
      confirmPassword: '',
      branchId: selectedBranchId ?? '',
      status: 'Active',
    });
    setShowModal(true);
  };

  const handleEditClick = (manager: BranchManager) => {
    setEditingManager(manager);
    setFormData({
      name: manager.name,
      email: manager.email,
      phone: manager.phone,
      username: manager.username,
      // Passwords are never returned by the API; leave blank and only send if changed.
      password: '',
      confirmPassword: '',
      branchId: manager.branchIds[0] ?? selectedBranchId ?? '',
      status: manager.status,
    });
    setShowModal(true);
  };

  const handleDeleteClick = (id: string) => {
    setDeletingId(id);
    setShowDeleteDialog(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingManager(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (!formData.branchId) {
      toast.error('Select an assigned branch');
      return;
    }

    setSubmitting(true);
    try {
      if (editingManager) {
        // Only send password when the owner actually entered a new one.
        const payload: Record<string, unknown> = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          username: formData.username,
          status: formData.status,
        };
        if (formData.password) payload.password = formData.password;
        // Only a multi-branch owner can reassign a manager's branch; leave the
        // claim untouched for single-branch owners so we never collapse scope.
        if (isMultiBranch) payload.branchIds = [formData.branchId];

        const res = await apiFetch(`/users/${editingManager.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(apiErrorMessage(data, 'Update failed'));
        toast.success('Branch manager account updated successfully.');
      } else {
        if (!formData.password) {
          toast.error('Password is required');
          setSubmitting(false);
          return;
        }
        const res = await apiFetch('/users', {
          method: 'POST',
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            username: formData.username,
            password: formData.password,
            status: formData.status,
            role: 'branch-manager',
            branchIds: [formData.branchId],
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(apiErrorMessage(data, 'Create failed'));
        toast.success('Branch manager account created successfully.');
      }

      await loadAccounts();
      handleCloseModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      const res = await apiFetch(`/users/${deletingId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(apiErrorMessage(data, 'Deactivation failed'));
      toast.success('Branch manager account deactivated.');
      await loadAccounts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Deactivation failed');
    } finally {
      setShowDeleteDialog(false);
      setDeletingId(null);
    }
  };

  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  const handleInviteSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const mobile = canonicalPhMobile(inviteForm.mobile);
    if (!mobile) {
      toast.error('Enter a valid PH mobile number');
      return;
    }
    if (!inviteForm.branchId) {
      toast.error('Select an authorized branch');
      return;
    }

    setInviteSubmitting(true);
    try {
      const response = await apiFetch('/delivery-rider-invitations', {
        method: 'POST',
        body: JSON.stringify({
          recipientName: inviteForm.recipientName,
          email: inviteForm.email,
          mobile,
          branchId: inviteForm.branchId,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(apiErrorMessage(data, 'Could not send the invitation'));
      }
      toast.success('Delivery Rider invitation sent.');
      setShowInviteModal(false);
      await loadAccounts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send the invitation');
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleResendInvitation = async (invitation: DeliveryRiderInvitation) => {
    setInvitationBusyId(invitation.invitationId);
    try {
      const response = await apiFetch(
        `/delivery-rider-invitations/${invitation.invitationId}/resend`,
        { method: 'POST' },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(apiErrorMessage(data, 'Could not resend the invitation'));
      }
      toast.success(
        invitation.status === 'Revoked'
          ? 'Delivery Rider invitation reissued.'
          : 'Delivery Rider invitation resent.',
      );
      await loadAccounts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not resend the invitation');
    } finally {
      setInvitationBusyId(null);
    }
  };

  const openRevokeDialog = (invitation: DeliveryRiderInvitation) => {
    setInvitationToRevoke(invitation);
    setRevokeReason('');
    setShowRevokeDialog(true);
  };

  const handleRevokeInvitation = async () => {
    if (!invitationToRevoke || revokeReason.trim().length < 3) {
      toast.error('Enter a short reason for revoking this invitation.');
      return;
    }
    setInvitationBusyId(invitationToRevoke.invitationId);
    try {
      const response = await apiFetch(
        `/delivery-rider-invitations/${invitationToRevoke.invitationId}/revoke`,
        { method: 'PATCH', body: JSON.stringify({ reason: revokeReason }) },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(apiErrorMessage(data, 'Could not revoke the invitation'));
      }
      toast.success('Delivery Rider invitation revoked.');
      setShowRevokeDialog(false);
      setInvitationToRevoke(null);
      await loadAccounts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not revoke the invitation');
    } finally {
      setInvitationBusyId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header title="User Management" />
      </div>

      <div className="p-8">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">
                {isMultiBranch ? 'Branch Accounts — All Branches' : 'Branch Accounts'}
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                Manage Branch Managers and invitation-authorized Delivery Rider access.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleInviteClick}
                disabled={availableBranchOptions.length === 0}
                title="Send a secure, single-use Delivery Rider invitation"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#007BC1] bg-white px-4 text-sm font-semibold text-[#007BC1] transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <MailPlus className="h-4 w-4" aria-hidden="true" />
                Invite Delivery Rider
              </button>
              <button
                type="button"
                onClick={handleAddClick}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#007BC1] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#005a8f]"
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Create Branch Manager Account
              </button>
            </div>
          </div>

          <div className="mb-6 grid gap-3 rounded-xl border border-gray-100 bg-gray-50/70 p-4 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.4fr)_minmax(170px,0.8fr)_minmax(170px,0.8fr)_auto] xl:items-end">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-600">Search</span>
              <span className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search name or email"
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-3 text-sm text-gray-800 outline-none transition focus:border-[#007BC1] focus:ring-2 focus:ring-blue-100"
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-600">Role</span>
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-[#007BC1] focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">All roles</option>
                <option value="branch-manager">Branch Manager</option>
                <option value="driver">Delivery Rider</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-600">Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-[#007BC1] focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">All statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Pending">Invitation pending</option>
                <option value="Expired">Invitation expired</option>
                <option value="Revoked">Invitation revoked</option>
                <option value="Accepted">Invitation accepted</option>
              </select>
            </label>

            <button
              type="button"
              onClick={clearFilters}
              disabled={!filtersActive}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-gray-600 transition-colors hover:bg-white hover:text-[#007BC1] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Clear filters
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Name</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Email</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Role</th>
                  {isMultiBranch && (
                    <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Branch</th>
                  )}
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Status</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Date Created</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Last Login</th>
                  <th className="text-left text-[11px] font-medium text-gray-600 pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={isMultiBranch ? 8 : 7} className="py-8 text-center text-[13px] text-gray-500">
                      Loading…
                    </td>
                  </tr>
                )}
                {!loading && filteredManagers.length === 0 && filteredInvitations.length === 0 && (
                  <tr>
                    <td colSpan={isMultiBranch ? 8 : 7} className="py-10 text-center text-[13px] text-gray-500">
                      {filtersActive
                          ? 'No branch accounts match the selected filters.'
                          : isMultiBranch
                            ? 'No Branch Manager accounts or Delivery Rider invitations yet across your branches.'
                            : 'No Branch Manager accounts or Delivery Rider invitations yet for this branch.'}
                    </td>
                  </tr>
                )}
                {!loading && filteredManagers.map((manager, index) => (
                  <tr
                    key={manager.id}
                    className={`border-b border-gray-100 ${index % 2 === 1 ? 'bg-gray-50' : ''}`}
                  >
                    <td className="py-3 text-[13px] text-gray-900 whitespace-nowrap">{manager.name}</td>
                    <td className="py-3 text-[13px] text-gray-600 whitespace-nowrap">{manager.email}</td>
                    <td className="py-3 text-[13px] text-gray-700 whitespace-nowrap">Branch Manager</td>
                    {isMultiBranch && (
                      <td className="py-3 text-[13px] text-gray-600 whitespace-nowrap">
                        {manager.branches.length ? manager.branches.join(', ') : '—'}
                      </td>
                    )}
                    <td className="py-3">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-[11px] font-medium ${
                          manager.status === 'Active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {manager.status}
                      </span>
                    </td>
                    <td className="py-3 text-[13px] text-gray-600 whitespace-nowrap">{manager.dateCreated}</td>
                    <td className="py-3 text-[13px] text-gray-600 whitespace-nowrap">{manager.lastLogin}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditClick(manager)}
                          aria-label={`Edit ${manager.name}`}
                          title="Edit Branch Manager"
                          className="p-1.5 text-gray-600 hover:text-[#007BC1] hover:bg-gray-100 rounded transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(manager.id)}
                          aria-label={`Deactivate ${manager.name}`}
                          title="Deactivate Branch Manager"
                          className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-gray-100 rounded transition-colors"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && filteredInvitations.map((invitation, index) => (
                  <tr
                    key={invitation.invitationId}
                    className={`border-b border-gray-100 ${(filteredManagers.length + index) % 2 === 1 ? 'bg-gray-50' : ''}`}
                  >
                    <td className="py-3 text-[13px] text-gray-900 whitespace-nowrap">
                      {invitation.recipientName}
                    </td>
                    <td className="py-3 text-[13px] text-gray-600 whitespace-nowrap">
                      <div>{invitation.email}</div>
                      <div className="mt-0.5 text-[11px] text-gray-400">
                        +63 {formatNationalMobile(invitation.mobile)}
                      </div>
                    </td>
                    <td className="py-3 text-[13px] text-gray-700 whitespace-nowrap">
                      Delivery Rider
                    </td>
                    {isMultiBranch && (
                      <td className="py-3 text-[13px] text-gray-600 whitespace-nowrap">
                        {invitation.branchName || '—'}
                      </td>
                    )}
                    <td className="py-3">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-[11px] font-medium ${
                          invitation.status === 'Accepted'
                            ? 'bg-green-100 text-green-700'
                            : invitation.status === 'Pending'
                              ? 'bg-amber-100 text-amber-700'
                              : invitation.status === 'Expired'
                                ? 'bg-gray-100 text-gray-600'
                                : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {invitation.status}
                      </span>
                    </td>
                    <td className="py-3 text-[13px] text-gray-600 whitespace-nowrap">
                      {displayDate(invitation.invitedAt)}
                    </td>
                    <td className="py-3 text-[13px] text-gray-600 whitespace-nowrap">—</td>
                    <td className="py-3">
                      {invitation.status !== 'Accepted' ? (
                        <div className="flex items-center gap-2">
                          {(invitation.status === 'Revoked' || !invitation.emailVerified) && (
                            <button
                              type="button"
                              disabled={invitationBusyId === invitation.invitationId}
                              onClick={() => void handleResendInvitation(invitation)}
                              aria-label={`${invitation.status === 'Revoked' ? 'Reissue' : 'Resend'} invitation to ${invitation.recipientName}`}
                              title={invitation.status === 'Revoked' ? 'Reissue invitation' : 'Resend invitation'}
                              className="rounded p-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-[#007BC1] disabled:opacity-40"
                            >
                              <MailPlus className="h-4 w-4" />
                            </button>
                          )}
                          {invitation.status !== 'Revoked' && (
                            <button
                              type="button"
                              disabled={invitationBusyId === invitation.invitationId}
                              onClick={() => openRevokeDialog(invitation)}
                              aria-label={`Revoke invitation for ${invitation.recipientName}`}
                              title="Revoke invitation"
                              className="rounded p-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-red-600 disabled:opacity-40"
                            >
                              <UserX className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[88vh] w-[500px] max-w-full flex-col rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Invite Delivery Rider</h3>
                <p className="mt-1 text-xs text-gray-500">
                  The invitation securely assigns one role and one branch.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                aria-label="Close invitation form"
                className="text-gray-400 transition-colors hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-800">
                  The recipient verifies their email and PH mobile number, then creates their
                  own password in the mobile app. Branch Owners never set or see it.
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-sm text-gray-700">
                    Verified full name <span className="text-red-500">*</span>
                  </span>
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={inviteForm.recipientName}
                    onChange={(event) =>
                      setInviteForm({ ...inviteForm, recipientName: event.target.value })
                    }
                    placeholder="Enter the recipient's full name"
                    className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#007BC1]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm text-gray-700">
                    Verified email address <span className="text-red-500">*</span>
                  </span>
                  <input
                    required
                    type="email"
                    value={inviteForm.email}
                    onChange={(event) =>
                      setInviteForm({ ...inviteForm, email: event.target.value })
                    }
                    placeholder="name@example.com"
                    className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#007BC1]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm text-gray-700">
                    PH mobile number <span className="text-red-500">*</span>
                  </span>
                  <span className="flex h-11 overflow-hidden rounded-lg border border-gray-300 bg-white focus-within:border-transparent focus-within:ring-2 focus-within:ring-[#007BC1]">
                    <span className="flex items-center border-r border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-700">
                      +63
                    </span>
                    <input
                      required
                      inputMode="numeric"
                      autoComplete="tel-national"
                      value={inviteForm.mobile}
                      onChange={(event) =>
                        setInviteForm({
                          ...inviteForm,
                          mobile: formatNationalMobile(event.target.value),
                        })
                      }
                      placeholder="9XX XXX XXXX"
                      className="min-w-0 flex-1 px-3 text-sm outline-none"
                    />
                  </span>
                </label>

                {isMultiBranch ? (
                  <label className="block">
                    <span className="mb-1.5 block text-sm text-gray-700">
                      Authorized branch <span className="text-red-500">*</span>
                    </span>
                    <select
                      required
                      value={inviteForm.branchId}
                      onChange={(event) =>
                        setInviteForm({ ...inviteForm, branchId: event.target.value })
                      }
                      className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#007BC1]"
                    >
                      {availableBranchOptions.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div>
                    <span className="mb-1.5 block text-sm text-gray-700">Authorized branch</span>
                    <div className="flex h-11 items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700">
                      <span>{selectedBranch}</span>
                      <span className="text-xs text-gray-400">Locked</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteSubmitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#007BC1] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#005a8f] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <MailPlus className="h-4 w-4" />
                  {inviteSubmitting ? 'Sending…' : 'Send invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-gray-200 w-[480px] max-h-[85vh] flex flex-col">
            {/* Fixed Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">
                {editingManager ? 'Edit Branch Manager' : 'Create Branch Manager Account'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              {/* Scrollable Body */}
              <div className="px-6 py-4 overflow-y-auto flex-1">
                <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1.5">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter full name"
                    className="w-full h-[44px] px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1.5">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Enter email address"
                    className="w-full h-[44px] px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1.5">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Enter phone number"
                    className="w-full h-[44px] px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1.5">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="Enter username"
                    className="w-full h-[44px] px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1.5">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Enter password"
                      className="w-full h-[44px] px-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1.5">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      placeholder="Re-enter password"
                      className="w-full h-[44px] px-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isMultiBranch && (
                  <div>
                    <label className="block text-sm text-gray-700 mb-1.5">
                      Branch <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.branchId}
                      onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                      className="w-full h-[44px] px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none text-sm bg-white"
                    >
                      {availableBranchOptions.map((branch) => (
                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        checked={formData.status === 'Active'}
                        onChange={() => setFormData({ ...formData, status: 'Active' })}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        formData.status === 'Active' ? 'border-[#007BC1]' : 'border-gray-300'
                      }`}>
                        {formData.status === 'Active' && (
                          <div className="w-2 h-2 rounded-full bg-[#007BC1]"></div>
                        )}
                      </div>
                      <span className="text-sm text-gray-700">Active</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        checked={formData.status === 'Inactive'}
                        onChange={() => setFormData({ ...formData, status: 'Inactive' })}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        formData.status === 'Inactive' ? 'border-[#007BC1]' : 'border-gray-300'
                      }`}>
                        {formData.status === 'Inactive' && (
                          <div className="w-2 h-2 rounded-full bg-[#007BC1]"></div>
                        )}
                      </div>
                      <span className="text-sm text-gray-700">Inactive</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-6 text-xs text-gray-500 px-6">
                This account will have Branch Manager access for{' '}
                {availableBranchOptions.find((branch) => branch.id === formData.branchId)?.name ??
                  selectedBranch}{' '}
                only.
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-normal text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-normal hover:bg-[#152942] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving…' : editingManager ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg border border-gray-200 w-[400px] p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Deactivate Account</h3>
            <p className="text-sm text-gray-600 mb-6">
              This Branch Manager will no longer be able to sign in. The account and its history will be retained.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {showRevokeDialog && invitationToRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-[420px] max-w-full rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-gray-900">Revoke Delivery Rider invitation</h3>
            <p className="mt-2 text-sm leading-5 text-gray-600">
              {invitationToRevoke.recipientName} will no longer be able to use this
              invitation. The audit history will be retained.
            </p>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm text-gray-700">
                Reason <span className="text-red-500">*</span>
              </span>
              <textarea
                value={revokeReason}
                onChange={(event) => setRevokeReason(event.target.value)}
                rows={3}
                maxLength={300}
                placeholder="Why is this invitation being revoked?"
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#007BC1]"
              />
            </label>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowRevokeDialog(false);
                  setInvitationToRevoke(null);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={invitationBusyId === invitationToRevoke.invitationId}
                onClick={() => void handleRevokeInvitation()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {invitationBusyId === invitationToRevoke.invitationId
                  ? 'Revoking…'
                  : 'Revoke invitation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
