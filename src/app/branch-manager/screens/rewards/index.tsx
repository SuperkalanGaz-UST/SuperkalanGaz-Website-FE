'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { RefreshCw, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Tabs, TabsList, TabsTrigger } from '../../components/Tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/Select';
import { apiFetch, apiErrorMessage } from '../../../lib/api';
import { formatPHMobile } from '../../../lib/phMobile';
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
    created_at: string;
    updated_at: string;
    // Enrichments appended by GET /loyalty/redemptions.
    customer_name: string | null;
    catalog_item_name: string | null;
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

/** Active household reward from GET /loyalty/catalog. Used to build a household
 * request (the commercial track has no catalog — the reward is a free cylinder). */
interface CatalogItemRow {
    id: string;
    branch_id: string;
    name: string;
    description: string | null;
    points_cost: number;
    stock_qty: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
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

/** Maps household reward catalog names to their product images in /public/catalog. */
const REWARD_IMAGES: Record<string, string> = {
    'Free Notebook and Pen': '/catalog/reward-notebook.png',
    'Free Desk Calendar': '/catalog/reward-calendar.png',
    'Free Umbrella': '/catalog/reward-umbrella.png',
    'Free Mug': '/catalog/reward-mug.png',
};

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

    const [track, setTrack] = useState<Track>(HOUSEHOLD);
    const [activeTab, setActiveTab] = useState('pending');
    const [redemptions, setRedemptions] = useState<RedemptionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
    // The household form also needs a reward; the commercial form does not (the
    // reward is always one free cylinder).
    const [showCreate, setShowCreate] = useState(false);
    const [catalog, setCatalog] = useState<CatalogItemRow[]>([]);
    const [selectedItemId, setSelectedItemId] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const [customerResults, setCustomerResults] = useState<CustomerRow[] | null>(null);
    const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
    const [creating, setCreating] = useState(false);

    // Ledger review panel (BM-014): ledgerId = which row's ledger is open.
    const [ledgerId, setLedgerId] = useState<string | null>(null);
    const [ledger, setLedger] = useState<LedgerView | null>(null);
    const [ledgerLoading, setLedgerLoading] = useState(false);

    // Code verification: BM types/pastes a customer's code to look it up.
    const [codeSearch, setCodeSearch] = useState('');
    const [codeSearchLoading, setCodeSearchLoading] = useState(false);
    const [codeSearchError, setCodeSearchError] = useState<string | null>(null);

    const isCommercial = track === COMMERCIAL;

    const loadRedemptions = useCallback(async (t: Track, status: string) => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiFetch(`/loyalty/redemptions?track=${t}&status=${encodeURIComponent(status)}`);
            const data = await res.json();
            if (!res.ok) throw new Error(apiErrorMessage(data, 'Failed to load redemptions'));
            setRedemptions(data.redemptions as RedemptionRow[]);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load redemptions';
            setError(message);
            setRedemptions([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadRedemptions(track, activeTab); }, [track, activeTab, loadRedemptions]);

    // Active household reward catalog — loaded once for the household create form.
    const loadCatalog = useCallback(async () => {
        try {
            const res = await apiFetch('/loyalty/catalog');
            const data = await res.json();
            if (!res.ok) return;
            setCatalog(data.catalogItems as CatalogItemRow[]);
        } catch {
            // Non-fatal: the create form just shows an empty catalog.
        }
    }, []);

    useEffect(() => { loadCatalog(); }, [loadCatalog]);

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
        setSelectedItemId('');
        setSelectedCustomer(null);
        setCustomerSearch('');
        setCustomerResults(null);
    };

    // Switching track resets the queue filter to the actionable one and clears any
    // open create/reject panels — the two tracks are independent views.
    const switchTrack = (t: Track) => {
        if (t === track) return;
        setTrack(t);
        setActiveTab('pending');
        setRejectId(null);
        resetCreate();
    };

    const handleCreate = async () => {
        if (!selectedCustomer) { toast.error('Select a customer first'); return; }
        if (!isCommercial && !selectedItemId) { toast.error('Select a reward'); return; }
        setCreating(true);
        try {
            // Household: POST /loyalty/redemptions { customerId, catalogItemId }.
            // Commercial: POST /loyalty/commercial/redemptions { customerId } (no reward).
            const path = isCommercial ? '/loyalty/commercial/redemptions' : '/loyalty/redemptions';
            const body = isCommercial
                ? { customerId: selectedCustomer.id }
                : { customerId: selectedCustomer.id, catalogItemId: selectedItemId };
            const res = await apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
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
            await loadRedemptions(track, activeTab);
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
            const path = isCommercial
                ? `/loyalty/commercial/redemptions/${id}/approve`
                : `/loyalty/redemptions/${id}/approve`;
            const res = await apiFetch(path, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) {
                // 409: no longer pending, insufficient points/stock (household), or no
                // completed cycle (commercial) — the API's message says which.
                if (res.status === 409) {
                    toast.error(apiErrorMessage(data, 'Could not approve this redemption'));
                    await loadRedemptions(track, activeTab);
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
            await Promise.all([loadRedemptions(track, activeTab), loadCatalog()]);
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
                    await loadRedemptions(track, activeTab);
                    return;
                }
                toast.error(apiErrorMessage(data, 'Failed to reject redemption'));
                return;
            }
            toast.success('Redemption rejected.');
            setRejectId(null);
            await loadRedemptions(track, activeTab);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to reject redemption');
        } finally {
            setRejectingId(null);
        }
    };

    const handleFulfill = async (id: string) => {
        setFulfillingId(id);
        try {
            const res = await apiFetch(`/loyalty/redemptions/${id}/fulfill`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) {
                if (res.status === 409) {
                    toast.error(apiErrorMessage(data, 'This redemption is not approved'));
                    await loadRedemptions(track, activeTab);
                    return;
                }
                if (res.status === 404) { toast.error('Redemption not found'); return; }
                toast.error(apiErrorMessage(data, 'Failed to mark fulfilled'));
                return;
            }
            toast.success('Reward marked as handed over.');
            await loadRedemptions(track, activeTab);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to mark fulfilled');
        } finally {
            setFulfillingId(null);
        }
    };

    /** Look up a redemption by code — the BM pastes the customer's code. */
    const handleCodeSearch = async () => {
        const code = codeSearch.trim();
        if (!code) return;
        setCodeSearchLoading(true);
        setCodeSearchError(null);
        try {
            const res = await apiFetch(`/loyalty/redemptions/verify/${encodeURIComponent(code)}`);
            const data = await res.json();
            if (!res.ok) {
                setCodeSearchError(apiErrorMessage(data, 'Code not found'));
                return;
            }
            const found = data.redemption as RedemptionRow;
            // Switch to "all" so the row is visible, then prepend the found row.
            setActiveTab('all');
            setRedemptions((prev) => {
                const without = prev.filter((r) => r.id !== found.id);
                return [found, ...without];
            });
            toast.success(`Found redemption for ${found.customer_name ?? 'customer'} — status: ${found.status}`);
            setCodeSearch('');
        } catch (err) {
            setCodeSearchError(err instanceof Error ? err.message : 'Failed to look up code');
        } finally {
            setCodeSearchLoading(false);
        }
    };

    // Avoid hydration mismatch on the date/Intl formatting (same guard as Orders).
    if (!mounted) return null;

    return (
        <div>
            {/* Track switcher — the two loyalty mechanics are independent views. */}
            <div className={styles.headerRow}>
                <div className={styles.trackSwitcher}>
                    <Tabs value={track} onValueChange={(v: string) => switchTrack(v as Track)}>
                        <TabsList>
                            {TRACK_TABS.map((t) => (
                                <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                </div>

            </div>

            {/* New redemption request. */}
            <div className={styles.card}>
                <div className={styles.cardHeaderFlex}>
                    <div className={styles.cardTitle}>
                        {isCommercial ? 'Commercial Free-Cylinder Redemptions' : 'Household Reward Redemptions'}
                    </div>
                    <Button
                        variant={showCreate ? 'outline' : 'accent'}
                        size="sm"
                        onClick={() => (showCreate ? resetCreate() : setShowCreate(true))}
                    >
                        {showCreate ? 'Cancel' : 'New Request'}
                    </Button>
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

                            {/* Reward picker — household only (commercial reward is a free cylinder). */}
                            {isCommercial ? (
                                <div>
                                    <label className={styles.fieldLabel}>Reward</label>
                                    <div className={styles.freeCylinderNote}>
                                        <Gift size={16} /> Free cylinder (30+1) — requires a completed cycle.
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className={styles.fieldLabel}>Reward</label>
                                    <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a reward…" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {catalog.map((c) => (
                                                <SelectItem key={c.id} value={c.id}>
                                                    {c.name} — {c.points_cost} pts{c.stock_qty <= 0 ? ' (out of stock)' : ''}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        <div className={styles.createActions}>
                            <Button
                                variant="accent"
                                size="sm"
                                onClick={handleCreate}
                                disabled={creating || !selectedCustomer || (!isCommercial && !selectedItemId)}
                            >
                                {creating ? 'Logging…' : 'Log Request'}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Approval queue */}
            <div className={styles.card}>
                <div className={styles.cardHeaderFlex}>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList>
                            {STATUS_TABS.map((t) => (
                                <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                            type="text"
                            placeholder="Search by code…"
                            value={codeSearch}
                            onChange={(e) => { setCodeSearch(e.target.value); setCodeSearchError(null); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleCodeSearch(); }}
                            disabled={codeSearchLoading}
                            style={{
                                padding: '6px 10px',
                                border: '1px solid #d1d5db',
                                borderRadius: 6,
                                fontSize: 13,
                                width: 180,
                            }}
                        />
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCodeSearch}
                            disabled={codeSearchLoading || !codeSearch.trim()}
                        >
                            {codeSearchLoading ? 'Searching…' : 'Verify Code'}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => loadRedemptions(track, activeTab)} disabled={loading}>
                            <RefreshCw size={16} /> Refresh
                        </Button>
                    </div>
                </div>
                {codeSearchError && (
                    <div style={{ padding: '8px 16px', color: '#dc2626', fontSize: 13 }}>{codeSearchError}</div>
                )}

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
                                const reward = isCommercial
                                    ? (r.reward_description ?? 'Free cylinder (30+1)')
                                    : (r.catalog_item_name ?? r.reward_description ?? '—');
                                const rewardImage = REWARD_IMAGES[reward] ?? null;
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
                                            <td>
                                                {rewardImage ? (
                                                    <div className={styles.rewardThumb}>
                                                        <Image
                                                            src={rewardImage}
                                                            alt={reward}
                                                            width={40}
                                                            height={40}
                                                            className={styles.rewardImg}
                                                        />
                                                    </div>
                                                ) : (
                                                    <span className={styles.mutedText}>—</span>
                                                )}
                                            </td>
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
                                                <Badge variant={getStatusVariant(r.status)}>{r.status}</Badge>
                                                {r.redemption_code && (
                                                    <div className={styles.codeBadge} title="System-issued redemption code">{r.redemption_code}</div>
                                                )}
                                                {r.status === 'rejected' && r.rejected_reason && (
                                                    <div className={styles.mutedText} title={r.rejected_reason}>{r.rejected_reason}</div>
                                                )}
                                            </td>
                                            <td className={styles.actionsCell}>
                                                <div className={styles.actionButtons}>
                                                    {/* Review the customer's ledger before deciding (BM-014). */}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => toggleLedger(r.id)}
                                                        disabled={ledgerLoading && ledgerId === r.id}
                                                    >
                                                        {ledgerId === r.id ? 'Hide' : 'Review'}
                                                    </Button>
                                                    {r.status === 'pending' && (
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
                                                    {r.status === 'approved' && (
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
        </div>
    );
}
