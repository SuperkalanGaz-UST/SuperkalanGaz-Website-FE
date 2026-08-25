'use client';

import {
  AlertCircle,
  Check,
  Clock3,
  LockKeyhole,
  Mail,
  Search,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { useBranch } from '../contexts/BranchContext';
import { KPICard } from './KPICard';

// BO-068 depends on an audited NestJS invitation endpoint and lifecycle feed.
// Keep all writes disabled until that server boundary exists; the web client
// must never imply that a Delivery Rider received or accepted an invitation.
const DELIVERY_RIDER_INVITATION_SERVICE_AVAILABLE = false;

const invitationFilters = [
  'All',
  'Awaiting acceptance',
  'Accepted',
  'Revoked',
] as const;

export function DeliveryRiderAccess() {
  const { selectedBranch } = useBranch();

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#007BC1]" aria-hidden="true" />
        <p>
          Delivery Riders join only through invitations you issue. Branch Managers assign
          vehicles after activation.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <KPICard
          title="Total Delivery Riders"
          value="—"
          subtitle="Roster endpoint unavailable"
          icon={<UsersRound className="h-5 w-5 text-[#007BC1]" />}
          accentColor="#007BC1"
        />
        <KPICard
          title="Awaiting Acceptance"
          value="—"
          subtitle="Invitation feed unavailable"
          icon={<Clock3 className="h-5 w-5 text-amber-600" />}
          accentColor="#d97706"
        />
        <KPICard
          title="Active"
          value="—"
          subtitle="Authoritative count unavailable"
          icon={<Check className="h-5 w-5 text-green-600" />}
          accentColor="#16a34a"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,0.9fr)]">
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-gray-100 px-6 py-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-950">
                Delivery Rider Invitations
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Track invitations until they are accepted, expired, or revoked.
              </p>
            </div>
            <label className="relative block w-full sm:w-72">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />
              <input
                disabled
                aria-label="Search Delivery Rider invitations"
                placeholder="Search by name, email, or phone"
                className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-3 text-sm text-gray-500 outline-none disabled:cursor-not-allowed"
              />
            </label>
          </div>

          <div className="border-b border-gray-100 px-6 py-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Invitation status filters">
              {invitationFilters.map((filter, index) => (
                <button
                  key={filter}
                  type="button"
                  disabled
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed ${
                    index === 0
                      ? 'border-[#007BC1] bg-blue-50 text-[#007BC1]'
                      : 'border-gray-200 bg-white text-gray-500'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="flex min-h-[360px] flex-col items-center justify-center px-8 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <AlertCircle className="h-7 w-7" aria-hidden="true" />
            </span>
            <h3 className="mt-4 font-semibold text-gray-950">
              Invitation service unavailable
            </h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">
              The NestJS Delivery Rider invitation endpoint and lifecycle feed must be
              implemented before this screen can send or report invitations. No placeholder
              invitation records are shown as authoritative.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-gray-950">Invite Delivery Rider</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              The recipient verifies their identity and sets their own password.
            </p>
          </div>

          <form className="mt-6 space-y-4" onSubmit={(event) => event.preventDefault()}>
            <label className="block text-sm font-medium text-gray-700">
              Full name
              <input
                disabled={!DELIVERY_RIDER_INVITATION_SERVICE_AVAILABLE}
                placeholder="Enter full name"
                autoComplete="name"
                className="mt-2 h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-500 outline-none disabled:cursor-not-allowed"
              />
            </label>

            <label className="block text-sm font-medium text-gray-700">
              Email address
              <input
                disabled={!DELIVERY_RIDER_INVITATION_SERVICE_AVAILABLE}
                type="email"
                placeholder="name@example.com"
                autoComplete="email"
                className="mt-2 h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-500 outline-none disabled:cursor-not-allowed"
              />
            </label>

            <label className="block text-sm font-medium text-gray-700">
              Mobile number
              <span className="mt-2 flex h-11 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                <span className="flex items-center border-r border-gray-200 px-3 text-sm font-semibold text-gray-600">
                  +63
                </span>
                <input
                  disabled={!DELIVERY_RIDER_INVITATION_SERVICE_AVAILABLE}
                  inputMode="numeric"
                  autoComplete="tel"
                  aria-label="Delivery Rider mobile number after plus sixty-three"
                  placeholder="9XX XXX XXXX"
                  className="min-w-0 flex-1 bg-transparent px-3 text-sm text-gray-500 outline-none disabled:cursor-not-allowed"
                />
              </span>
            </label>

            <label className="block text-sm font-medium text-gray-700">
              Branch
              <span className="mt-2 flex h-11 items-center justify-between rounded-lg border border-gray-200 bg-gray-100 px-3 text-sm text-gray-500">
                <span>{selectedBranch}</span>
                <LockKeyhole className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="mt-1.5 block text-xs font-normal text-gray-500">
                Branch is assigned from your account.
              </span>
            </label>

            <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#007BC1]" aria-hidden="true" />
              <p>
                Invitations must be single-use, expiring, identity-bound, and locked to this
                branch.
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>
                Sending is disabled until the audited NestJS invitation endpoint is
                available. No account changes will be made.
              </p>
            </div>

            <button
              type="submit"
              disabled={!DELIVERY_RIDER_INVITATION_SERVICE_AVAILABLE}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#007BC1] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#00679f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              Send Invitation
            </button>
          </form>

          <div className="mt-5 flex items-start gap-2 border-t border-gray-100 pt-4 text-xs leading-5 text-gray-500">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>Invitation actions must be recorded in immutable audit history.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
