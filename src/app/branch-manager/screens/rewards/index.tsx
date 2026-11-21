'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { RefreshCw, Gift, Star, PackageCheck, CircleCheck, Clock3, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Tabs, TabsList, TabsTrigger } from '../../components/Tabs';
import { apiFetch, apiErrorMessage, fetchJson } from '../../../lib/api';
import { catalogPhotoUrl } from '../../../lib/household-rewards';
import { formatPHMobile } from '../../../lib/phMobile';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../components/ui/dialog';
import styles from './screen.module.css';

/**
 * A loyalty redemption as returned by the LPM API. Snake_case like every other CRM
 * response; branch scope is token-derived server-side so no branch_id is ever sent
 * from here (AGENTS.md §5). The list endpoint enriches each row per track:
 * household rows carry catalog_item_name + points_balance; commercial rows carry
 * completed_cycles + current_cycle_count. Fields not relevant to the row's track
 * come back null.
 */
interface RedemptionRow {
    id: string;
    branch_id: string;
    customer_id: string;
    track: string;
    catalog_item_id: string | null;
    reward_description: string | null;
    points_spent: number | null;
    status: 'pending' | 'approved' | 'rejected' | 'fulfilled' | 'cancelled';
    requested_at: string;
    approved_by: string | null;
    approved_at: string | null;
    rejected_reason: string | null;
    fulfilled_at: string | null;
    redemption_code: string | null;
    requires_pickup_code?: boolean;
    created_at: string;
    updated_at: string;
    // Enrichments appended by GET /loyalty/redemptions.
    customer_name: string | null;
    catalog_item_name: string | null;
    photo_path?: string | null;
    points_balance: number | null;
    completed_cycles: number | null;
    current_cycle_count: number | null;
}

/** One entry of the household points ledger (GET /loyalty/redemptions/:id/ledger). */
interface HouseholdTxnRow {
    id: string;
    type: string;
    points_delta: number;
    source_service_request_id: string | null;
    redemption_id: string | null;
    earned_at: string | null;
    expires_at: string | null;
    created_at: string;
}

/** One counted purchase in the commercial 30+1 ledger. */
interface CommercialPurchaseRow {
    id: string;
    service_request_id: string;
    cycle_number: number;
    counted_at: string;
    created_at: string;
}

/** The customer loyalty ledger shown on redemption review (BM-014). Only the array
 * for the redemption's own track is populated. */
interface LedgerView {
    track: string;
    customer_name: string | null;
    points_balance: number | null;
    completed_cycles: number | null;
    current_cycle_count: number | null;
    household_transactions: HouseholdTxnRow[];
    commercial_purchases: CommercialPurchaseRow[];
}

/** Customer row from CIM search (GET /customers?search=), reused to pick who a new
 * redemption request is for. Same snake_case shape as the Orders screen uses. */
interface CustomerRow {
    id: string;
    name: string;
    contact_number: string;
    delivery_address: string;
    created_at: string;
}

/** The two loyalty tracks, matching the API's ?track values. A view shows exactly
 * one at a time — the two mechanics (points vs 30+1 cycles) never mix. */
const HOUSEHOLD = 'household_points';
const COMMERCIAL = 'commercial_30plus1';
type Track = typeof HOUSEHOLD | typeof COMMERCIAL;

const TRACK_TABS: { value: Track; label: string }[] = [
    { value: HOUSEHOLD, label: 'Household Points' },
    { value: COMMERCIAL, label: 'Commercial 30+1' },
];

/** Queue filter tabs → the API's ?status values. 'all' drops the status filter. */
const STATUS_TABS: { value: string; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'fulfilled', label: 'Fulfilled' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'all', label: 'All' },
];

/** Display the same bundled reward photo for customized and legacy catalog names. */
const REWARD_IMAGES: Record<string, string> = {
    notebook: '/catalog/reward-notebook.png',
    calendar: '/catalog/reward-calendar.png',
    umbrella: '/catalog/reward-umbrella.png',
    mug: '/catalog/reward-mug.png',
};

function displayReward(row: RedemptionRow) {
    return row.catalog_item_name ?? row.reward_description ?? (row.track === COMMERCIAL ? 'Free cylinder (30+1)' : 'Reward');
}

function RedemptionPhoto({ row, preview = false }: { row: RedemptionRow; preview?: boolean }) {
    const reward = displayReward(row);
    const fallback = Object.entries(REWARD_IMAGES).find(([key]) => reward.toLowerCase().includes(key))?.[1];
    const url = catalogPhotoUrl(row.photo_path);
    const [remoteFailed, setRemoteFailed] = useState(false);
    const source = remoteFailed ? fallback : url ?? fallback;
    if (!source) return <span className={styles.mutedText}>—</span>;
    const size = preview ? 72 : 40;
    return <div className={preview ? styles.pickupPhoto : styles.rewardThumb}>
        <Image src={source} alt={reward} width={size} height={size} className={styles.rewardImg}
            unoptimized={source === url} onError={() => setRemoteFailed(true)} />
    </div>;
}

function normalizePickupCode(value: string) {
    const code = value.trim().toUpperCase();
    const short = code.replace(/[-\s]/g, '');
    return /^[0-9A-HJKMNP-TV-Z]{6}$/.test(short) ? `${short.slice(0, 3)}-${short.slice(3)}` : code;
}

const formatDateTime = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-PH', {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    }).format(d);
};

const getStatusVariant = (status: RedemptionRow['status']) => {
    switch (status) {
        case 'fulfilled': return 'success' as const;
        case 'approved': return 'primary' as const;
        case 'rejected': return 'destructive' as const;
        case 'cancelled': return 'secondary' as const;
        case 'pending': return 'warning' as const;
        default: return 'secondary' as const;
    }
};

export default function Rewards() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const queryClient = useQueryClient();
    const [track, setTrack] = useState<Track>(HOUSEHOLD);
    const [activeTab, setActiveTab] = useState('approved');

    const {
        data: redemptionsData,
        isLoading: loading,
        error: redemptionsQueryError,
    } = useQuery({
        queryKey: ['loyalty-redemptions', track, activeTab],
        queryFn: () => fetchJson<{ redemptions: RedemptionRow[] }>(`/loyalty/redemptions?track=${track}&status=${encodeURIComponent(activeTab)}`),
        staleTime: 30_000,
    });
    const redemptions = redemptionsData?.redemptions ?? [];
    const error = redemptionsQueryError ? redemptionsQueryError.message : null;

    // KPI summary row above the queue
    const { data: summaryData } = useQuery({
        queryKey: ['loyalty-summary', track],
        queryFn: () => fetchJson<{ redemptions: RedemptionRow[] }>(`/loyalty/redemptions?track=${track}&status=all`),
        staleTime: 30_000,
    });
    const trackSummary = useMemo(() => {
        if (!summaryData) return null;
        const all = summaryData.redemptions;
        return {
            pending: all.filter((r) => r.status === 'pending').length,
            approved: all.filter((r) => r.status === 'approved').length,
            fulfilled: all.filter((r) => r.status === 'fulfilled').length,
        };
    }, [summaryData]);

    // Per-row in-flight guards. Only one action runs per row at a time, so a single
    // id per action is enough (mirrors the Orders screen's dispatchingId).
    const [approvingId, setApprovingId] = useState<string | null>(null);
    const [fulfillingId, setFulfillingId] = useState<string | null>(null);
    // Reject-with-mandatory-reason: rejectId = which row's reason panel is open;
    // rejectingId = the in-flight POST guard.
    const [rejectId, setRejectId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectError, setRejectError] = useState<string | null>(null);
    const [rejectingId, setRejectingId] = useState<string | null>(null);

    // New redemption request (BM logs a request into the queue). Collapsed by
    // default; customer is chosen via the same CIM search the Orders screen uses.
    const [showCreate, setShowCreate] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const [customerResults, setCustomerResults] = useState<CustomerRow[] | null>(null);
    const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
    const [creating, setCreating] = useState(false);

    // Ledger review panel (BM-014): ledgerId = which row's ledger is open.
    const [ledgerId, setLedgerId] = useState<string | null>(null);
    const [ledger, setLedger] = useState<LedgerView | null>(null);
    const [ledgerLoading, setLedgerLoading] = useState(false);

    const [pickup, setPickup] = useState<RedemptionRow | null>(null);
    const [pickupCode, setPickupCode] = useState('');
    const [verifyingCode, setVerifyingCode] = useState(false);
    const [pickupError, setPickupError] = useState<string | null>(null);
    const [verifiedCode, setVerifiedCode] = useState<string | null>(null);
    const pickupTrigger = React.useRef<HTMLButtonElement | null>(null);

    const isCommercial = track === COMMERCIAL;

    const statusTabs = isCommercial ? STATUS_TABS : [
        { value: 'approved', label: 'Ready for Pickup' },
        { value: 'fulfilled', label: 'Redeemed' },
        { value: 'all', label: 'All' },
    ];
    const statusLabel = (status: string) => statusTabs.find((tab) => tab.value === status)?.label ?? status;

    // Open (or close) the ledger review panel for a row (BM-014).
    const toggleLedger = async (id: string) => {
        if (ledgerId === id) { setLedgerId(null); setLedger(null); return; }
        setLedgerId(id);
        setLedger(null);
        setLedgerLoading(true);
        try {
            const res = await apiFetch(`/loyalty/redemptions/${id}/ledger`);
            const data = await res.json();
            if (!res.ok) {
                toast.error(apiErrorMessage(data, 'Failed to load ledger'));
                setLedgerId(null);
                return;
            }
            setLedger(data.ledger as LedgerView);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to load ledger');
            setLedgerId(null);
        } finally {
            setLedgerLoading(false);
        }
    };

    // Debounced customer search (reuses the CIM endpoint / 2-char minimum, exactly
    // as the Orders intake does). Never runs while a customer is already locked in.
    useEffect(() => {
        if (selectedCustomer) return;
        const term = customerSearch.trim();
        if (term.length < 2) {
            setCustomerResults(null);
            setCustomerSearchLoading(false);
            return;
        }
        setCustomerSearchLoading(true);
        const handle = setTimeout(async () => {
            try {
                const res = await apiFetch(`/customers?search=${encodeURIComponent(term)}`);
                const data = await res.json();
                if (!res.ok) throw new Error(apiErrorMessage(data, 'Failed to search customers'));
                setCustomerResults(data.customers as CustomerRow[]);
            } catch (err) {
                setCustomerResults([]);
                toast.error(err instanceof Error ? err.message : 'Failed to search customers');
            } finally {
                setCustomerSearchLoading(false);
            }
        }, 300);
        return () => clearTimeout(handle);
    }, [customerSearch, selectedCustomer]);

    const resetCreate = () => {
        setShowCreate(false);
        setSelectedCustomer(null);
        setCustomerSearch('');
        setCustomerResults(null);
    };

    // Switching track resets the queue filter to the actionable one and clears any
    // open create/reject panels — the two tracks are independent views.
    const switchTrack = (t: Track) => {
        if (t === track) return;
        setTrack(t);
        setActiveTab(t === COMMERCIAL ? 'pending' : 'approved');
        setRejectId(null);
        resetCreate();
    };

    const handleCreate = async () => {
        if (!selectedCustomer) { toast.error('Select a customer first'); return; }
        setCreating(true);
        try {
            const res = await apiFetch('/loyalty/commercial/redemptions', {
                method: 'POST',
                body: JSON.stringify({ customerId: selectedCustomer.id }),
            });
            const data = await res.json();
            if (!res.ok) {
                // 400 (no account / inactive / out of stock / no completed cycle) and
                // 404 (unknown item) surface the API's message as-is.
                toast.error(apiErrorMessage(data, 'Failed to create redemption request'));
                return;
            }
            // When Dual Auth is OFF the request comes back already approved with a
            // code (auto-issued) instead of pending — reflect that in the toast.
            const created = data.redemption as RedemptionRow;
            if (created.status === 'approved' && created.redemption_code) {
                toast.success(`Auto-issued — code ${created.redemption_code}`);
            } else {
                toast.success('Redemption request logged.');
            }
            resetCreate();
            void queryClient.invalidateQueries({ queryKey: ['loyalty-redemptions'] });
            void queryClient.invalidateQueries({ queryKey: ['loyalty-summary'] });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to create redemption request');
        } finally {
            setCreating(false);
        }
    };

    const handleApprove = async (id: string) => {
        setApprovingId(id);
        try {
            // Track-specific business action: household debits points + stock; commercial
            // decrements a completed cycle. Distinct endpoints, same 409 semantics.
            const res = await apiFetch(`/loyalty/commercial/redemptions/${id}/approve`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) {
                // 409: no longer pending, insufficient points/stock (household), or no
                // completed cycle (commercial) — the API's message says which.
                if (res.status === 409) {
                    toast.error(apiErrorMessage(data, 'Could not approve this redemption'));
                    void queryClient.invalidateQueries({ queryKey: ['loyalty-redemptions'] });
            void queryClient.invalidateQueries({ queryKey: ['loyalty-summary'] });
                    return;
                }
                if (res.status === 404) { toast.error('Redemption not found'); return; }
                toast.error(apiErrorMessage(data, 'Failed to approve redemption'));
                return;
            }
            const approved = data.redemption as RedemptionRow;
            const codeMsg = approved.redemption_code ? ` — code ${approved.redemption_code}` : '';
            toast.success((isCommercial ? 'Free cylinder approved' : 'Redemption approved') + codeMsg);
            // Close the ledger panel for this row if it was open; state changed.
            if (ledgerId === id) { setLedgerId(null); setLedger(null); }
            void queryClient.invalidateQueries({ queryKey: ['loyalty-redemptions'] });
            void queryClient.invalidateQueries({ queryKey: ['loyalty-summary'] });
            void queryClient.invalidateQueries({ queryKey: ['loyalty-catalog'] });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to approve redemption');
        } finally {
            setApprovingId(null);
        }
    };

    const openReject = (id: string) => {
        setRejectId(id);
        setRejectReason('');
        setRejectError(null);
    };

    // Reject + fulfill are track-agnostic on the API (shared endpoints).
    const handleReject = async (id: string) => {
        if (!rejectReason.trim()) { setRejectError('A reason is required'); return; }
        setRejectingId(id);
        try {
            const res = await apiFetch(`/loyalty/redemptions/${id}/reject`, {
                method: 'POST',
                body: JSON.stringify({ reason: rejectReason.trim() }),
            });
            const data = await res.json();
            if (!res.ok) {
                if (res.status === 409) {
                    toast.error(apiErrorMessage(data, 'This redemption is no longer pending'));
                    setRejectId(null);
                    void queryClient.invalidateQueries({ queryKey: ['loyalty-redemptions'] });
            void queryClient.invalidateQueries({ queryKey: ['loyalty-summary'] });
                    return;
                }
                toast.error(apiErrorMessage(data, 'Failed to reject redemption'));
                return;
            }
            toast.success('Redemption rejected.');
            setRejectId(null);
            void queryClient.invalidateQueries({ queryKey: ['loyalty-redemptions'] });
            void queryClient.invalidateQueries({ queryKey: ['loyalty-summary'] });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to reject redemption');
        } finally {
            setRejectingId(null);
        }
    };

    const openPickup = (row: RedemptionRow, trigger: HTMLButtonElement) => {
        pickupTrigger.current = trigger;
        setPickupCode('');
        setPickupError(null);
        setVerifiedCode(null);
        setPickup(row);
    };

    const refreshRedemptions = () => {
        void queryClient.invalidateQueries({ queryKey: ['loyalty-redemptions'] });
        void queryClient.invalidateQueries({ queryKey: ['loyalty-summary'] });
    };

    const handleFulfill = async (id: string, code?: string) => {
        setFulfillingId(id);
        setPickupError(null);
        try {
            const res = await apiFetch(`/loyalty/redemptions/${id}/fulfill`, {
                method: 'POST',
                ...(code ? { body: JSON.stringify({ code }) } : {}),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                if (res.status === 409 || res.status === 404) {
                    setVerifiedCode(null);
                    refreshRedemptions();
                }
                throw new Error(apiErrorMessage(data, 'Failed to confirm pickup'));
            }
            toast.success('Reward handed over.');
            if (code) setPickup(null);
            refreshRedemptions();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to confirm pickup';
            if (code) setPickupError(message);
            else toast.error(message);
        } finally {
            setFulfillingId(null);
        }
    };

    const handleVerifyPickup = async () => {
        const code = normalizePickupCode(pickupCode);
        if (!pickup || !code || verifyingCode) return;
        setPickupCode(code);
        setVerifyingCode(true);
        setPickupError(null);
        try {
            const response = await apiFetch(`/loyalty/redemptions/${pickup.id}/verify`, {
                method: 'POST',
                body: JSON.stringify({ code }),
            });
            if (!response.ok) {
                const data = await response.json().catch(() => null);
                if (response.status === 409 || response.status === 404) refreshRedemptions();
                throw new Error(apiErrorMessage(data, 'Could not verify this pickup code'));
            }
            setVerifiedCode(code);
        } catch (error) {
            setPickupError(error instanceof Error ? error.message : 'Could not verify this pickup code');
        } finally {
            setVerifyingCode(false);
        }
    };

    // Avoid hydration mismatch on the date/Intl formatting (same guard as Orders).
    if (!mounted) return null;

    return (
        <div>
            {/* Track switcher — the two loyalty mechanics are independent views.
                Underline-tab style matches the Branch Owner Loyalty Program tab. */}
            <div className={styles.trackTabsRow}>
                <div className={styles.trackTabs} role="tablist" aria-label="Loyalty program tracks">
                    {TRACK_TABS.map((t) => {
                        const isActive = track === t.value;
                        return (
                            <button
                                key={t.value}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => switchTrack(t.value)}
                                className={`${styles.trackTab} ${isActive ? styles.trackTabActive : ''}`}
                            >
                                {t.label}
                                <span className={styles.trackTabIndicator} aria-hidden="true" />
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* KPI summary — real counts for the active track, not illustrative data. */}
            <div className={`${styles.metricsRow} ${isCommercial ? styles.commercialMetricsRow : ''}`}>
                <div className={styles.heroCard}>
                    <p className={styles.heroEyebrow}>
                        {isCommercial ? 'Commercial 30+1 Rewards' : 'Household Rewards'}
                    </p>
                    <p className={styles.heroLabel}>
                        {isCommercial ? 'Pending Requests' : 'Ready for Pickup'}
                    </p>
                    <p className={styles.heroValue}>
                        {trackSummary ? (isCommercial ? trackSummary.pending : trackSummary.approved) : '—'}
                    </p>
                    <div className={styles.heroIcon} aria-hidden="true">
                        {isCommercial ? <RotateCw size={26} /> : <Star size={26} fill="currentColor" />}
                    </div>
                </div>
                {isCommercial && (
                    <div className={styles.metricCard}>
                        <div className={`${styles.metricIcon} ${styles.metricIconAmber}`} aria-hidden="true">
                            <Clock3 size={24} />
                        </div>
                        <div>
                            <p className={styles.metricLabel}>Approved, Awaiting Pickup</p>
                            <p className={styles.metricValue}>{trackSummary ? trackSummary.approved : '—'}</p>
                        </div>
                    </div>
                )}
                <div className={styles.metricCard}>
                    <div className={`${styles.metricIcon} ${styles.metricIconGreen}`} aria-hidden="true">
                        {isCommercial ? <CircleCheck size={24} /> : <PackageCheck size={26} />}
                    </div>
                    <div>
                        <p className={styles.metricLabel}>{isCommercial ? 'Fulfilled' : 'Redeemed'}</p>
                        <p className={styles.metricValue}>{trackSummary ? trackSummary.fulfilled : '—'}</p>
                    </div>
                </div>
            </div>

            {isCommercial && (
                <div className={`${styles.card} ${styles.createCard}`}>
                    <div className={`${styles.cardHeaderFlex} ${styles.createHeader} ${showCreate ? styles.createHeaderExpanded : ''}`}>
                        <div className={styles.cardTitle}>
                            Commercial Free-Cylinder Redemptions
                        </div>
                        <button
                            type="button"
                            className={`${styles.newRequestButton} ${showCreate ? styles.cancelRequestButton : ''}`}
                            onClick={() => (showCreate ? resetCreate() : setShowCreate(true))}
                        >
                            {showCreate ? 'Cancel' : 'New Request'}
                        </button>
                    </div>

                    {showCreate && (
                        <div className={styles.cardBody}>
                            <div className={styles.createGrid}>
                                {/* Customer picker (CIM search) */}
                                <div>
                                    <label className={styles.fieldLabel}>Customer</label>
                                    {selectedCustomer ? (
                                        <div className={styles.customerSelected}>
                                            <div>
                                                <div className={styles.boldText}>{selectedCustomer.name}</div>
                                                <div className={styles.mutedText}>{formatPHMobile(selectedCustomer.contact_number)}</div>
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }}>
                                                Change
                                            </Button>
                                        </div>
                                    ) : (
                                        <>
                                            <input
                                                className={styles.textInput}
                                                placeholder="Search name or number…"
                                                value={customerSearch}
                                                onChange={(e) => setCustomerSearch(e.target.value)}
                                            />
                                            {customerSearchLoading && <div className={styles.mutedText}>Searching…</div>}
                                            {customerResults && customerResults.length > 0 && (
                                                <div className={styles.results}>
                                                    {customerResults.map((c) => (
                                                        <button
                                                            key={c.id}
                                                            type="button"
                                                            className={styles.resultItem}
                                                            onClick={() => { setSelectedCustomer(c); setCustomerResults(null); setCustomerSearch(''); }}
                                                        >
                                                            <span className={styles.boldText}>{c.name}</span>
                                                            <span className={styles.mutedText}>{formatPHMobile(c.contact_number)}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            {customerResults && customerResults.length === 0 && !customerSearchLoading && (
                                                <div className={styles.mutedText}>No matching customers.</div>
                                            )}
                                        </>
                                    )}
                                </div>

                                <div>
                                    <p className={styles.fieldLabel}>Reward</p>
                                    <div className={styles.freeCylinderNote}>
                                        <Gift size={16} /> Free cylinder (30+1) — requires a completed cycle.
                                    </div>
                                </div>
                            </div>

                            <div className={styles.createActions}>
                                <Button
                                    variant="accent"
                                    size="sm"
                                    onClick={handleCreate}
                                    disabled={creating || !selectedCustomer}
                                >
                                    {creating ? 'Logging…' : 'Log Request'}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

            )}

            {/* Pickup and redemption history */}
            <div className={styles.card}>
                <div className={styles.cardHeaderFlex}>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList>
                            {statusTabs.map((t) => (
                                <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                    <Button variant="ghost" size="sm" onClick={refreshRedemptions} disabled={loading}>
                        <RefreshCw size={16} /> Refresh
                    </Button>
                </div>

                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Customer</th>
                                <th>Reward</th>
                                <th>Photo</th>
                                <th>{isCommercial ? 'Free Cylinders' : 'Cost'}</th>
                                <th>{isCommercial ? 'Cycle Progress' : 'Balance'}</th>
                                <th>Requested</th>
                                <th>Status</th>
                                <th className={styles.actionsCol}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr><td colSpan={8} className={styles.emptyState}>Loading…</td></tr>
                            )}
                            {!loading && error && (
                                <tr><td colSpan={8} className={styles.emptyState}>{error}</td></tr>
                            )}
                            {!loading && !error && redemptions.length === 0 && (
                                <tr><td colSpan={8} className={styles.emptyState}>
                                    <Gift size={20} /> No redemptions in this view.
                                </td></tr>
                            )}
                            {!loading && !error && redemptions.map((r) => {
                                const reward = displayReward(r);
                                const canVerifyPickup = r.status === 'approved' && (!isCommercial || (r.requires_pickup_code ?? !!r.redemption_code));
                                // Household: can't afford if balance < cost. Commercial: can't
                                // redeem without a completed cycle.
                                const cannotAct = isCommercial
                                    ? (r.completed_cycles != null && r.completed_cycles < 1)
                                    : (r.points_balance != null && r.points_balance < (r.points_spent ?? 0));
                                const isRejecting = rejectId === r.id;
                                return (
                                    <React.Fragment key={r.id}>
                                        <tr>
                                            <td className={styles.boldText}>{r.customer_name ?? '—'}</td>
                                            <td>{reward}</td>
                                            <td><RedemptionPhoto key={r.photo_path} row={r} /></td>
                                            <td className={styles.monoText}>
                                                {isCommercial
                                                    ? (r.completed_cycles == null ? '—' : `${r.completed_cycles}`)
                                                    : `${r.points_spent ?? 0} pts`}
                                            </td>
                                            <td className={styles.monoText}>
                                                {isCommercial
                                                    ? (r.current_cycle_count == null ? '—' : `${r.current_cycle_count}/30`)
                                                    : (r.points_balance == null ? '—' : `${r.points_balance} pts`)}
                                            </td>
                                            <td className={styles.mutedText}>{formatDateTime(r.requested_at)}</td>
                                            <td>
                                                {canVerifyPickup ? (
                                                    <button type="button" className={styles.pickupLink}
                                                        aria-haspopup="dialog" onClick={event => openPickup(r, event.currentTarget)}>
                                                        Ready for Pickup
                                                    </button>
                                                ) : <Badge variant={getStatusVariant(r.status)}>{statusLabel(r.status)}</Badge>}
                                                {r.status === 'rejected' && r.rejected_reason && (
                                                    <div className={styles.mutedText} title={r.rejected_reason}>{r.rejected_reason}</div>
                                                )}
                                            </td>
                                            <td className={styles.actionsCell}>
                                                <div className={styles.actionButtons}>
                                                    {/* Ledger investigation is optional for pickup. */}
                                                    <Button
                                                        variant="link"
                                                        size="sm"
                                                        onClick={() => toggleLedger(r.id)}
                                                        disabled={ledgerLoading && ledgerId === r.id}
                                                    >
                                                        {ledgerId === r.id ? 'Hide ledger' : 'View ledger'}
                                                    </Button>
                                                    {isCommercial && r.status === 'pending' && (
                                                        <>
                                                            <Button
                                                                variant="accent"
                                                                size="sm"
                                                                onClick={() => handleApprove(r.id)}
                                                                disabled={approvingId === r.id || isRejecting || cannotAct}
                                                                title={cannotAct ? (isCommercial ? 'No completed cycle to redeem' : 'Insufficient points balance') : undefined}
                                                                style={{ backgroundColor: '#16a34a', color: '#fff' }}
                                                            >
                                                                {approvingId === r.id ? 'Approving…' : 'Approve'}
                                                            </Button>
                                                            <Button variant="outline" size="sm" onClick={() => openReject(r.id)} disabled={approvingId === r.id}>
                                                                Reject
                                                            </Button>
                                                        </>
                                                    )}
                                                    {isCommercial && r.status === 'approved' && !canVerifyPickup && (
                                                        <Button variant="secondary" size="sm" onClick={() => handleFulfill(r.id)} disabled={fulfillingId === r.id}>
                                                            {fulfillingId === r.id ? 'Saving…' : 'Mark Fulfilled'}
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        {isRejecting && (
                                            <tr className={styles.editorRow}>
                                                <td colSpan={8}>
                                                    <div className={styles.rejectPanel}>
                                                        <label className={styles.fieldLabel}>Reason for rejection</label>
                                                        <input
                                                            className={styles.textInput}
                                                            placeholder="e.g. Reward out of stock at counter"
                                                            value={rejectReason}
                                                            onChange={(e) => { setRejectReason(e.target.value); setRejectError(null); }}
                                                        />
                                                        {rejectError && <div className={styles.fieldError}>{rejectError}</div>}
                                                        <div className={styles.createActions}>
                                                            <Button variant="ghost" size="sm" onClick={() => setRejectId(null)} disabled={rejectingId === r.id}>
                                                                Cancel
                                                            </Button>
                                                            <Button variant="accent" size="sm" onClick={() => handleReject(r.id)} disabled={rejectingId === r.id}>
                                                                {rejectingId === r.id ? 'Rejecting…' : 'Confirm Reject'}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        {ledgerId === r.id && (
                                            <tr className={styles.editorRow}>
                                                <td colSpan={8}>
                                                    {ledgerLoading || !ledger ? (
                                                        <div className={styles.ledgerPanel}>Loading ledger…</div>
                                                    ) : ledger.track === COMMERCIAL ? (
                                                        <div className={styles.ledgerPanel}>
                                                            <div className={styles.ledgerHead}>
                                                                <span className={styles.boldText}>{ledger.customer_name ?? '—'}</span>
                                                                <span className={styles.mutedText}>
                                                                    Commercial 30+1 · {ledger.completed_cycles ?? 0} free cylinder(s) earned · cycle {ledger.current_cycle_count ?? 0}/30
                                                                </span>
                                                            </div>
                                                            {ledger.commercial_purchases.length === 0 ? (
                                                                <div className={styles.mutedText}>No counted purchases yet.</div>
                                                            ) : (
                                                                <table className={styles.ledgerTable}>
                                                                    <thead><tr><th>Counted</th><th>Cycle #</th><th>Service Request</th></tr></thead>
                                                                    <tbody>
                                                                        {ledger.commercial_purchases.map((p) => (
                                                                            <tr key={p.id}>
                                                                                <td className={styles.mutedText}>{formatDateTime(p.counted_at)}</td>
                                                                                <td className={styles.monoText}>{p.cycle_number}</td>
                                                                                <td className={styles.monoText}>{p.service_request_id.slice(0, 8)}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className={styles.ledgerPanel}>
                                                            <div className={styles.ledgerHead}>
                                                                <span className={styles.boldText}>{ledger.customer_name ?? '—'}</span>
                                                                <span className={styles.mutedText}>Household · balance {ledger.points_balance ?? 0} pts</span>
                                                            </div>
                                                            {ledger.household_transactions.length === 0 ? (
                                                                <div className={styles.mutedText}>No points transactions yet.</div>
                                                            ) : (
                                                                <table className={styles.ledgerTable}>
                                                                    <thead><tr><th>Date</th><th>Type</th><th>Points</th><th>Expires</th></tr></thead>
                                                                    <tbody>
                                                                        {ledger.household_transactions.map((t) => (
                                                                            <tr key={t.id}>
                                                                                <td className={styles.mutedText}>{formatDateTime(t.created_at)}</td>
                                                                                <td>{t.type}</td>
                                                                                <td className={styles.monoText} style={{ color: t.points_delta < 0 ? 'var(--error, #ef4444)' : undefined }}>
                                                                                    {t.points_delta > 0 ? `+${t.points_delta}` : t.points_delta}
                                                                                </td>
                                                                                <td className={styles.mutedText}>{formatDateTime(t.expires_at)}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            <Dialog open={!!pickup} onOpenChange={open => {
                if (!open && !verifyingCode && !fulfillingId) setPickup(null);
            }}>
                <DialogContent className={styles.pickupDialog}
                    onCloseAutoFocus={event => { event.preventDefault(); pickupTrigger.current?.focus(); }}>
                    <DialogTitle>Verify pickup code</DialogTitle>
                    <DialogDescription>Enter the code shown by the customer. Confirm pickup after handing over the reward.</DialogDescription>
                    {pickup && <>
                        <div className={styles.pickupReward}>
                            <RedemptionPhoto key={pickup.photo_path} row={pickup} preview />
                            <div>
                                <strong>{displayReward(pickup)}</strong>
                                <div className={styles.mutedText}>{pickup.customer_name ?? 'Customer'}</div>
                            </div>
                        </div>
                        <form className={styles.pickupForm} onSubmit={event => {
                            event.preventDefault();
                            if (verifiedCode) void handleFulfill(pickup.id, verifiedCode);
                            else void handleVerifyPickup();
                        }}>
                            <label htmlFor="reward-pickup-code" className={styles.fieldLabel}>Pickup code</label>
                            <input id="reward-pickup-code" className={styles.pickupInput} placeholder="XXX-XXX"
                                value={pickupCode} maxLength={64} autoComplete="off" spellCheck={false}
                                disabled={verifyingCode || !!fulfillingId} onChange={event => {
                                    setPickupCode(event.target.value.toUpperCase());
                                    setVerifiedCode(null);
                                    setPickupError(null);
                                }} />
                            {pickupError && <div role="alert" className={styles.fieldError}>{pickupError}</div>}
                            {verifiedCode && <div className={styles.pickupVerified} role="status">Pickup code verified</div>}
                            <div className={`${styles.codeSearchActions} ${styles.pickupActions}`}>
                                <Button type="button" variant="outline" onClick={() => setPickup(null)} disabled={verifyingCode || !!fulfillingId}>Cancel</Button>
                                <button type="submit" className={styles.verifyCodeButton} disabled={verifyingCode || !!fulfillingId || !pickupCode.trim()}>
                                    {fulfillingId ? 'Confirming…' : verifyingCode ? 'Verifying…' : verifiedCode ? 'Confirm pickup' : 'Verify code'}
                                </button>
                            </div>
                        </form>
                    </>}
                </DialogContent>
            </Dialog>
        </div>
    );
}
