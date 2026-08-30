'use client';

import { ArrowRight, MailPlus, ShieldCheck, UsersRound } from 'lucide-react';

/** Invitation provisioning lives in User Management; Fleet handles readiness. */
export function DeliveryRiderAccess() {
  const openUserManagement = () => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'user-management' }));
  };

  return (
    <div className="mx-auto max-w-3xl py-12">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#007BC1]">
          <UsersRound className="h-7 w-7" aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-xl font-semibold text-gray-950">
          Delivery Rider accounts are managed in User Management
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-600">
          Branch Owners send identity-bound invitations there. After acceptance,
          Delivery Riders appear in Fleet as Offline and unassigned so a Branch Manager
          can prepare them for dispatch.
        </p>

        <div className="mx-auto mt-6 grid max-w-xl gap-3 text-left sm:grid-cols-2">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <MailPlus className="h-5 w-5 text-[#007BC1]" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-blue-950">Branch Owner</p>
            <p className="mt-1 text-xs leading-5 text-blue-800">
              Invites the verified person and authorizes branch membership.
            </p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <ShieldCheck className="h-5 w-5 text-emerald-700" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-emerald-950">Branch Manager</p>
            <p className="mt-1 text-xs leading-5 text-emerald-800">
              Assigns a healthy same-branch vehicle after activation.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openUserManagement}
          className="mt-7 inline-flex h-11 items-center gap-2 rounded-lg bg-[#007BC1] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#00679f]"
        >
          Open User Management
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
