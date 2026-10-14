'use client';

import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Clock3,
  Gift,
  RefreshCw,
  Star,
  UsersRound,
  PlusCircle,
  MinusCircle,
  Info,
} from 'lucide-react';
import { fetchJson } from '../lib/api';

type Member = { id: string; name: string; phone: string; pointsBalance: number; expiringIn30Days: number; nextExpiry: string | null; lastActivity: string | null; lastActivityType: string | null };
type Account = { id: string; business: string; phone: string; currentCycle: number; qualifyingPurchasesThisMonth: number; lastQualifyingPurchase: string | null };
type Overview = { household: { pointsEarnedThisMonth: number; activeMembers: number; expiringPoints: number; membersWithExpiringPoints: number; members: Member[] }; commercial: { qualifyingPurchasesThisMonth: number; activeAccounts: number; nearReward: number; accounts: Account[] } };

const numberFormatter = new Intl.NumberFormat('en-PH');
const date = (value: string | null) => value ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(value)) : 'No activity';

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
  icon: React.ReactNode;
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
  icon: React.ReactNode;
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

function Household({ data, hidden }: { data?: Overview['household']; hidden: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const ledger = useQuery({ queryKey: ['customer-loyalty', expanded], queryFn: () => fetchJson<{ ledger: { household_transactions: Array<{ type: string; points_delta: number; created_at: string }> } }>(`/loyalty/customers/${expanded}`), enabled: !!expanded });

  return (
    <section id="household-loyalty-panel" role="tabpanel" aria-labelledby="household-loyalty-tab" hidden={hidden} className="space-y-6">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.45fr_0.9fr_0.9fr]">
        <PrimaryMetricCard
          eyebrow="Household Points Overview"
          label="Points Earned This Month"
          value={numberFormatter.format(data?.pointsEarnedThisMonth ?? 0)}
          icon={<Star className="h-7 w-7 fill-current" aria-hidden="true" />}
        />
        <MetricCard
          label="Active Household Members"
          value={numberFormatter.format(data?.activeMembers ?? 0)}
          detail="Active branch customers"
          icon={<UsersRound className="h-6 w-6" aria-hidden="true" />}
        />
        <MetricCard
          label="Points Expiring in 30 Days"
          value={numberFormatter.format(data?.expiringPoints ?? 0)}
          detail={`Across ${data?.membersWithExpiringPoints ?? 0} members`}
          icon={<Clock3 className="h-6 w-6" aria-hidden="true" />}
          tone="amber"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-gray-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <h2 className="text-lg font-semibold text-[#101828]">Household Points Ledger</h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] table-fixed">
            <colgroup>
              <col className="w-[16%]" />
              <col className="w-[15%]" />
              <col className="w-[12%]" />
              <col className="w-[15%]" />
              <col className="w-[13%]" />
              <col className="w-[16%]" />
              <col className="w-[13%]" />
            </colgroup>
            <thead className="bg-gray-50/80">
              <tr>
                {['MEMBER', 'PHONE', 'POINTS BALANCE', 'EXPIRING IN 30 DAYS', 'NEXT EXPIRY', 'LAST POINTS ACTIVITY', 'ACTION'].map((heading) => (
                  <th key={heading} scope="col" className="px-5 py-3 text-left text-[11px] font-semibold tracking-wide text-gray-600">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.members ?? []).map((member) => {
                const isExpanded = expanded === member.id;
                return (
                  <Fragment key={member.id}>
                    <tr className="border-t border-gray-100 transition-colors hover:bg-gray-50/70">
                      <td className="px-5 py-4 text-sm font-semibold text-[#101828]">{member.name}</td>
                      <td className="px-5 py-4 text-sm text-gray-600">{member.phone}</td>
                      <td className="px-5 py-4 text-sm font-semibold text-[#101828]">{numberFormatter.format(member.pointsBalance)}</td>
                      <td className={`px-5 py-4 text-sm font-medium ${member.expiringIn30Days > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                        {member.expiringIn30Days > 0 ? numberFormatter.format(member.expiringIn30Days) : '—'}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600">{date(member.nextExpiry)}</td>
                      <td className={`px-5 py-4 text-sm ${member.lastActivityType === 'earned' ? 'text-emerald-700' : 'text-gray-700'}`}>
                        {member.lastActivityType ? `${member.lastActivityType} · ${date(member.lastActivity)}` : 'No activity'}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => setExpanded(isExpanded ? null : member.id)}
                          aria-expanded={isExpanded}
                          className="text-sm font-semibold text-[#007BC1] transition-colors hover:text-[#005a8f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007BC1] focus-visible:ring-offset-2"
                        >
                          {isExpanded ? 'Hide ledger' : 'View ledger'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-t border-gray-100 bg-gray-50/30">
                        <td colSpan={7} className="px-5 py-3">
                          {ledger.isLoading && <p className="text-sm text-gray-500">Loading transaction history...</p>}
                          {ledger.error && <p className="text-sm text-red-600">Could not load transaction history: {ledger.error.message}</p>}
                          {ledger.data && (
                            <div className="flex flex-col gap-1.5 py-1">
                              {ledger.data.ledger.household_transactions.length ? ledger.data.ledger.household_transactions.map((transaction, index) => {
                                const isEarn = transaction.points_delta > 0;
                                const isRedeem = transaction.points_delta < 0;
                                const Icon = isEarn ? PlusCircle : isRedeem ? MinusCircle : Info;
                                const iconColor = isEarn ? 'text-emerald-500' : isRedeem ? 'text-rose-500' : 'text-gray-400';
                                const textColor = isEarn ? 'text-emerald-600' : isRedeem ? 'text-rose-600' : 'text-gray-700';

                                return (
                                  <div key={`${transaction.created_at}-${transaction.type}-${index}`} className="flex items-center justify-between rounded border border-gray-100 bg-white px-3 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors hover:border-gray-200">
                                    <div className="flex items-center gap-2.5">
                                      <Icon className={`h-3.5 w-3.5 ${iconColor}`} strokeWidth={2.5} />
                                      <span className="text-[13px] font-medium capitalize text-gray-700">{transaction.type}</span>
                                    </div>
                                    <div className="flex items-center gap-6">
                                      <span className={`text-[13px] font-semibold tabular-nums ${textColor}`}>
                                        {isEarn ? '+' : ''}{transaction.points_delta} pts
                                      </span>
                                      <span className="w-24 text-right text-[12px] text-gray-500">{date(transaction.created_at)}</span>
                                    </div>
                                  </div>
                                );
                              }) : (
                                <p className="py-2 text-center text-sm text-gray-500">No transactions recorded.</p>
                              )}
                            </div>
                          )}
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

function Commercial({ data, hidden }: { data?: Overview['commercial']; hidden: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const ledger = useQuery({ queryKey: ['customer-commercial-ledger', expanded], queryFn: () => fetchJson<{ ledger: { commercial_purchases: Array<{ cycle_number: number; counted_at: string }> } }>(`/loyalty/customers/${expanded}`), enabled: !!expanded });

  return (
    <section id="commercial-loyalty-panel" role="tabpanel" aria-labelledby="commercial-loyalty-tab" hidden={hidden} className="space-y-6">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.45fr_0.9fr_0.9fr]">
        <PrimaryMetricCard
          eyebrow="30+1 Cycle Overview"
          label="Qualifying Purchases This Month"
          value={numberFormatter.format(data?.qualifyingPurchasesThisMonth ?? 0)}
          icon={<RefreshCw className="h-7 w-7" aria-hidden="true" />}
        />
        <MetricCard
          label="Active Commercial Accounts"
          value={numberFormatter.format(data?.activeAccounts ?? 0)}
          detail="Active branch accounts"
          icon={<Building2 className="h-6 w-6" aria-hidden="true" />}
        />
        <MetricCard
          label="Accounts Within 5 Purchases of Reward"
          value={numberFormatter.format(data?.nearReward ?? 0)}
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
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] table-fixed">
            <colgroup>
              <col className="w-[18%]" />
              <col className="w-[14%]" />
              <col className="w-[20%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[11%]" />
            </colgroup>
            <thead className="bg-gray-50/80">
              <tr>
                {['BUSINESS', 'PHONE', 'CURRENT CYCLE', 'PURCHASES THIS MONTH', 'LAST QUALIFYING PURCHASE', 'ACTION'].map((heading) => (
                  <th key={heading} scope="col" className="px-5 py-3 text-left text-[11px] font-semibold tracking-wide text-gray-600">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.accounts ?? []).map((account) => {
                const isExpanded = expanded === account.id;
                const purchasesRemaining = Math.max(30 - account.currentCycle, 0);
                const progress = Math.min((account.currentCycle / 30) * 100, 100);

                return (
                  <Fragment key={account.id}>
                    <tr className="border-t border-gray-100 transition-colors hover:bg-gray-50/70">
                      <td className="px-5 py-4 text-sm font-semibold text-[#101828]">{account.business}</td>
                      <td className="px-5 py-4 text-sm text-gray-600">{account.phone}</td>
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
                      <td className="px-5 py-4 text-sm">{account.qualifyingPurchasesThisMonth}</td>
                      <td className="px-5 py-4 text-sm text-gray-600">{date(account.lastQualifyingPurchase)}</td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => setExpanded(isExpanded ? null : account.id)}
                          aria-expanded={isExpanded}
                          className="text-sm font-semibold text-[#007BC1] transition-colors hover:text-[#005a8f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007BC1] focus-visible:ring-offset-2"
                        >
                          {isExpanded ? 'Hide cycle' : 'View cycle'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-t border-blue-100 bg-blue-50/60">
                        <td colSpan={6} className="px-5 py-4 text-sm text-gray-700">
                          {ledger.isLoading && 'Loading purchase history...'}
                          {ledger.error && `Could not load purchase history: ${ledger.error.message}`}
                          {ledger.data && (ledger.data.ledger.commercial_purchases.length ? ledger.data.ledger.commercial_purchases.map((purchase) => (
                            <div key={`${purchase.cycle_number}-${purchase.counted_at}`}>
                              Cycle {purchase.cycle_number} purchase on {date(purchase.counted_at)}
                            </div>
                          )) : 'No purchases recorded.')}
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

export function LoyaltyTrackDashboard({ branchId }: { branchId?: string | null }) {
  const [track, setTrack] = useState<'household' | 'commercial'>('household');
  const query = useQuery({ queryKey: ['loyalty-overview', branchId], queryFn: () => fetchJson<{ overview: Overview }>(`/loyalty/overview?branchId=${encodeURIComponent(branchId!)}`), enabled: !!branchId });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-gray-200 sm:flex-row sm:items-end sm:justify-between">
        <div role="tablist" aria-label="Loyalty program tracks" className="flex gap-2">
          {(['household', 'commercial'] as const).map((trackType) => {
            const isActive = track === trackType;
            const label = trackType === 'household' ? 'Household' : 'Commercial';

            return (
              <button
                key={trackType}
                id={`${trackType}-loyalty-tab`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`${trackType}-loyalty-panel`}
                onClick={() => setTrack(trackType)}
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
      </div>

      {query.isLoading && <p className="text-sm text-gray-500">Loading loyalty data...</p>}
      {query.error && <p className="text-sm text-red-600">Could not load loyalty data: {query.error.message}</p>}
      {query.data && (
        <>
          <Household data={query.data.overview.household} hidden={track !== 'household'} />
          <Commercial data={query.data.overview.commercial} hidden={track !== 'commercial'} />
        </>
      )}
    </div>
  );
}