'use client';

import { Fragment, useMemo, useState, type ReactNode } from 'react';
import {
  Building2,
  Clock3,
  Gift,
  RefreshCw,
  Star,
  UsersRound,
} from 'lucide-react';

type LoyaltyTrack = 'household' | 'commercial';

interface HouseholdMember {
  id: string;
  member: string;
  phone: string;
  pointsBalance: number;
  pointsEarnedThisMonth: number;
  expiringIn30Days: number;
  nextExpiry: string;
  lastActivity: string;
  activityType: 'earned' | 'redeemed';
}

interface CommercialAccount {
  id: string;
  business: string;
  phone: string;
  cylinderSize: string;
  currentCycle: number;
  qualifyingPurchasesThisMonth: number;
  lastQualifyingPurchase: string;
}

interface LoyaltyTrackDashboardProps {
  scopeLabel: string;
}

const householdMembers: HouseholdMember[] = [
  { id: 'HH-001', member: 'Maria Santos', phone: '+639171234567', pointsBalance: 2450, pointsEarnedThisMonth: 180, expiringIn30Days: 1200, nextExpiry: 'Mar 14, 2027', lastActivity: 'Earned from 11 kg purchase', activityType: 'earned' },
  { id: 'HH-002', member: 'Juan Dela Cruz', phone: '+639212221111', pointsBalance: 1875, pointsEarnedThisMonth: 120, expiringIn30Days: 0, nextExpiry: 'Nov 7, 2026', lastActivity: 'Redeemed merchandise', activityType: 'redeemed' },
  { id: 'HH-003', member: 'Lola Basyang', phone: '+639204443333', pointsBalance: 620, pointsEarnedThisMonth: 90, expiringIn30Days: 620, nextExpiry: 'Jan 26, 2027', lastActivity: 'Earned from 11 kg purchase', activityType: 'earned' },
  { id: 'HH-004', member: 'Pedro Penduko', phone: '+639195551122', pointsBalance: 3210, pointsEarnedThisMonth: 240, expiringIn30Days: 450, nextExpiry: 'Apr 11, 2027', lastActivity: 'Earned from 22 kg purchase', activityType: 'earned' },
  { id: 'HH-005', member: 'Carlos Miguel', phone: '+639223334444', pointsBalance: 2120, pointsEarnedThisMonth: 160, expiringIn30Days: 0, nextExpiry: 'Oct 3, 2026', lastActivity: 'Redeemed merchandise', activityType: 'redeemed' },
  { id: 'HH-006', member: 'Sofia Cruz', phone: '+639237778888', pointsBalance: 410, pointsEarnedThisMonth: 70, expiringIn30Days: 0, nextExpiry: 'Dec 12, 2026', lastActivity: 'Earned from 11 kg purchase', activityType: 'earned' },
];

const commercialAccounts: CommercialAccount[] = [
  { id: 'COM-001', business: "Aling Nena's Eatery", phone: '+639178123456', cylinderSize: '11 kg', currentCycle: 28, qualifyingPurchasesThisMonth: 4, lastQualifyingPurchase: 'Aug 20, 2026' },
  { id: 'COM-002', business: 'Rizal Hardware Supply', phone: '+639212345678', cylinderSize: '22 kg', currentCycle: 24, qualifyingPurchasesThisMonth: 3, lastQualifyingPurchase: 'Aug 18, 2026' },
  { id: 'COM-003', business: 'Manila Grill House', phone: '+639345678901', cylinderSize: '22 kg', currentCycle: 30, qualifyingPurchasesThisMonth: 5, lastQualifyingPurchase: 'Aug 21, 2026' },
  { id: 'COM-004', business: 'QC Laundry Hub', phone: '+639456789012', cylinderSize: '22 kg', currentCycle: 17, qualifyingPurchasesThisMonth: 2, lastQualifyingPurchase: 'Aug 17, 2026' },
  { id: 'COM-005', business: 'Tagaytay View Resort', phone: '+639567890123', cylinderSize: '50 kg', currentCycle: 29, qualifyingPurchasesThisMonth: 6, lastQualifyingPurchase: 'Aug 22, 2026' },
  { id: 'COM-006', business: "Baker's Choice Bakeshop", phone: '+639678901234', cylinderSize: '22 kg', currentCycle: 15, qualifyingPurchasesThisMonth: 3, lastQualifyingPurchase: 'Aug 16, 2026' },
];

const numberFormatter = new Intl.NumberFormat('en-PH');

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = 'blue',
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone?: 'blue' | 'amber';
}) {
  const toneClasses = tone === 'amber'
    ? 'bg-amber-50 text-amber-600 ring-amber-100'
    : 'bg-blue-50 text-[#007BC1] ring-blue-100';

  return (
    <article className="flex min-h-40 items-center gap-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ring-1 ${toneClasses}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-5 text-gray-600">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-[#101828]">{value}</p>
        <p className={`mt-1 text-xs font-medium ${tone === 'amber' ? 'text-amber-600' : 'text-gray-500'}`}>{detail}</p>
      </div>
    </article>
  );
}

function PrimaryMetricCard({
  eyebrow,
  label,
  value,
  icon,
}: {
  eyebrow: string;
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <article className="relative min-h-40 overflow-hidden rounded-2xl border border-[#a9d4ee] bg-gradient-to-br from-white via-[#f5faff] to-[#e8f3ff] p-6 shadow-sm">
      <div className="relative z-10">
        <h2 className="text-lg font-semibold text-[#101828]">{eyebrow}</h2>
        <p className="mt-5 text-sm font-medium text-[#1f2a44]">{label}</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight text-[#101828]">{value}</p>
      </div>
      <div className="absolute right-8 top-1/2 z-10 flex h-16 w-16 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-[#087fc3] bg-white text-[#087fc3] shadow-[0_0_0_7px_rgba(8,127,195,0.10)]">
        {icon}
      </div>
      <div className="absolute -bottom-20 right-8 h-40 w-72 rotate-[-8deg] rounded-[50%] border-[18px] border-blue-100/70" aria-hidden="true" />
      <div className="absolute -bottom-24 right-0 h-44 w-72 rotate-[-8deg] rounded-[50%] border-[18px] border-blue-200/50" aria-hidden="true" />
    </article>
  );
}

function HouseholdPanel({ hidden }: { hidden: boolean }) {
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  const metrics = useMemo(() => ({
    activeMembers: householdMembers.length,
    pointsEarned: householdMembers.reduce((total, member) => total + member.pointsEarnedThisMonth, 0),
    expiringPoints: householdMembers.reduce((total, member) => total + member.expiringIn30Days, 0),
    membersWithExpiringPoints: householdMembers.filter((member) => member.expiringIn30Days > 0).length,
  }), []);

  return (
    <section id="household-loyalty-panel" role="tabpanel" aria-labelledby="household-loyalty-tab" hidden={hidden} className="space-y-6">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.45fr_0.9fr_0.9fr]">
        <PrimaryMetricCard
          eyebrow="Household Points Overview"
          label="Points Earned This Month"
          value={numberFormatter.format(metrics.pointsEarned)}
          icon={<Star className="h-7 w-7 fill-current" aria-hidden="true" />}
        />
        <MetricCard
          label="Active Household Members"
          value={numberFormatter.format(metrics.activeMembers)}
          detail="Shown in this preview"
          icon={<UsersRound className="h-6 w-6" aria-hidden="true" />}
        />
        <MetricCard
          label="Points Expiring in 30 Days"
          value={numberFormatter.format(metrics.expiringPoints)}
          detail={`Across ${metrics.membersWithExpiringPoints} members`}
          icon={<Clock3 className="h-6 w-6" aria-hidden="true" />}
          tone="amber"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-gray-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <h2 className="text-lg font-semibold text-[#101828]">Household Points Ledger</h2>
            <p className="text-xs text-gray-500">Points expire 12 months after they are earned.</p>
          </div>
          <span className="w-fit rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-600">Illustrative data</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] table-fixed">
            <colgroup>
              <col className="w-[16%]" />
              <col className="w-[15%]" />
              <col className="w-[12%]" />
              <col className="w-[15%]" />
              <col className="w-[13%]" />
              <col className="w-[19%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead className="bg-gray-50/80">
              <tr>
                {['MEMBER', 'PHONE', 'POINTS BALANCE', 'EXPIRING IN 30 DAYS', 'NEXT EXPIRY', 'LAST POINTS ACTIVITY', 'ACTION'].map((heading) => (
                  <th key={heading} scope="col" className="px-5 py-3 text-left text-[11px] font-semibold tracking-wide text-gray-600">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {householdMembers.map((member) => {
                const isExpanded = expandedMemberId === member.id;
                return (
                  <Fragment key={member.id}>
                    <tr className="border-t border-gray-100 transition-colors hover:bg-gray-50/70">
                      <td className="px-5 py-4 text-sm font-semibold text-[#101828]">{member.member}</td>
                      <td className="px-5 py-4 text-sm text-gray-600">{member.phone}</td>
                      <td className="px-5 py-4 text-sm font-semibold text-[#101828]">{numberFormatter.format(member.pointsBalance)}</td>
                      <td className={`px-5 py-4 text-sm font-medium ${member.expiringIn30Days > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                        {member.expiringIn30Days > 0 ? numberFormatter.format(member.expiringIn30Days) : '—'}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600">{member.nextExpiry}</td>
                      <td className={`px-5 py-4 text-sm ${member.activityType === 'earned' ? 'text-emerald-700' : 'text-gray-700'}`}>{member.lastActivity}</td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => setExpandedMemberId(isExpanded ? null : member.id)}
                          aria-expanded={isExpanded}
                          className="text-sm font-semibold text-[#007BC1] transition-colors hover:text-[#005a8f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007BC1] focus-visible:ring-offset-2"
                        >
                          {isExpanded ? 'Hide ledger' : 'View ledger'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-t border-blue-100 bg-blue-50/60">
                        <td colSpan={7} className="px-5 py-4 text-sm text-gray-700">
                          <span className="font-semibold text-[#101828]">Latest ledger entry:</span> {member.lastActivity}.{' '}
                          {member.expiringIn30Days > 0
                            ? `${numberFormatter.format(member.expiringIn30Days)} points are scheduled to expire within 30 days.`
                            : 'No points are scheduled to expire within 30 days.'}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function CommercialPanel({ hidden }: { hidden: boolean }) {
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);

  const metrics = useMemo(() => ({
    activeAccounts: commercialAccounts.length,
    qualifyingPurchases: commercialAccounts.reduce((total, account) => total + account.qualifyingPurchasesThisMonth, 0),
    nearReward: commercialAccounts.filter((account) => account.currentCycle >= 25 && account.currentCycle < 30).length,
  }), []);

  return (
    <section id="commercial-loyalty-panel" role="tabpanel" aria-labelledby="commercial-loyalty-tab" hidden={hidden} className="space-y-6">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.45fr_0.9fr_0.9fr]">
        <PrimaryMetricCard
          eyebrow="30+1 Cycle Overview"
          label="Qualifying Purchases This Month"
          value={numberFormatter.format(metrics.qualifyingPurchases)}
          icon={<RefreshCw className="h-7 w-7" aria-hidden="true" />}
        />
        <MetricCard
          label="Active Commercial Accounts"
          value={numberFormatter.format(metrics.activeAccounts)}
          detail="Shown in this preview"
          icon={<Building2 className="h-6 w-6" aria-hidden="true" />}
        />
        <MetricCard
          label="Accounts Within 5 Purchases of Reward"
          value={numberFormatter.format(metrics.nearReward)}
          detail="Excludes completed cycles"
          icon={<Gift className="h-6 w-6" aria-hidden="true" />}
          tone="amber"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-gray-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <h2 className="text-lg font-semibold text-[#101828]">Commercial 30+1 Progress</h2>
            <p className="text-xs text-gray-500">Every 30 qualifying purchases unlocks 1 free cylinder.</p>
          </div>
          <span className="w-fit rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-600">Illustrative data</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] table-fixed">
            <colgroup>
              <col className="w-[18%]" />
              <col className="w-[14%]" />
              <col className="w-[11%]" />
              <col className="w-[20%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[9%]" />
            </colgroup>
            <thead className="bg-gray-50/80">
              <tr>
                {['BUSINESS', 'PHONE', 'CYLINDER SIZE', 'CURRENT CYCLE', 'PURCHASES REMAINING', 'LAST QUALIFYING PURCHASE', 'ACTION'].map((heading) => (
                  <th key={heading} scope="col" className="px-5 py-3 text-left text-[11px] font-semibold tracking-wide text-gray-600">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {commercialAccounts.map((account) => {
                const isExpanded = expandedAccountId === account.id;
                const purchasesRemaining = Math.max(30 - account.currentCycle, 0);
                const progress = Math.min((account.currentCycle / 30) * 100, 100);

                return (
                  <Fragment key={account.id}>
                    <tr className="border-t border-gray-100 transition-colors hover:bg-gray-50/70">
                      <td className="px-5 py-4 text-sm font-semibold text-[#101828]">{account.business}</td>
                      <td className="px-5 py-4 text-sm text-gray-600">{account.phone}</td>
                      <td className="px-5 py-4 text-sm text-gray-600">{account.cylinderSize}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="w-14 shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-[#101828]">
                            {account.currentCycle} / 30
                          </span>
                          <div
                            role="progressbar"
                            aria-label={`${account.currentCycle} of 30 qualifying purchases`}
                            aria-valuemin={0}
                            aria-valuemax={30}
                            aria-valuenow={account.currentCycle}
                            className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200"
                          >
                            <div
                              className={`h-full rounded-full ${purchasesRemaining === 0 ? 'bg-amber-500' : 'bg-[#007BC1]'}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className={`px-5 py-4 text-sm font-medium ${purchasesRemaining === 0 ? 'text-amber-600' : 'text-gray-700'}`}>
                        {purchasesRemaining === 0 ? 'Cycle complete' : `${purchasesRemaining} ${purchasesRemaining === 1 ? 'purchase' : 'purchases'}`}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600">{account.lastQualifyingPurchase}</td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => setExpandedAccountId(isExpanded ? null : account.id)}
                          aria-expanded={isExpanded}
                          className="text-sm font-semibold text-[#007BC1] transition-colors hover:text-[#005a8f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007BC1] focus-visible:ring-offset-2"
                        >
                          {isExpanded ? 'Hide cycle' : 'View cycle'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-t border-blue-100 bg-blue-50/60">
                        <td colSpan={7} className="px-5 py-4 text-sm text-gray-700">
                          <span className="font-semibold text-[#101828]">Current cycle:</span> {account.currentCycle} of 30 qualifying purchases.{' '}
                          {purchasesRemaining === 0
                            ? 'The completed cycle can be viewed in the authorized redemption workflow.'
                            : `${purchasesRemaining} ${purchasesRemaining === 1 ? 'purchase remains' : 'purchases remain'} before a free-cylinder reward is flagged.`}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export function LoyaltyTrackDashboard({ scopeLabel }: LoyaltyTrackDashboardProps) {
  const [activeTrack, setActiveTrack] = useState<LoyaltyTrack>('household');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-gray-200 sm:flex-row sm:items-end sm:justify-between">
        <div role="tablist" aria-label="Loyalty program tracks" className="flex gap-2">
          {(['household', 'commercial'] as const).map((track) => {
            const isActive = activeTrack === track;
            const label = track === 'household' ? 'Household' : 'Commercial';

            return (
              <button
                key={track}
                id={`${track}-loyalty-tab`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`${track}-loyalty-panel`}
                onClick={() => setActiveTrack(track)}
                className={`relative min-w-32 px-4 pb-3 pt-1 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007BC1] focus-visible:ring-offset-2 ${isActive ? 'text-[#007BC1]' : 'text-gray-500 hover:text-gray-800'
                  }`}
              >
                {label}
                <span
                  className={`absolute inset-x-0 -bottom-px h-0.5 rounded-full transition-opacity ${isActive ? 'bg-[#007BC1] opacity-100' : 'opacity-0'}`}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
        <p className="pb-3 text-xs text-gray-500">{scopeLabel}</p>
      </div>

      <HouseholdPanel hidden={activeTrack !== 'household'} />
      <CommercialPanel hidden={activeTrack !== 'commercial'} />
    </div>
  );
}
