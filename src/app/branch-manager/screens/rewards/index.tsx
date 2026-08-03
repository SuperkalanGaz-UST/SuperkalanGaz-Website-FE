'use client';

import React, { useCallback, useEffect, useState } from 'react';
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
    created_at: string;
    updated_at: string;
    // Enrichments appended by GET /loyalty/redemptions.
    customer_name: string | null;
    catalog_item_name: string | null;
    points_balance: number | null;
    completed_cycles: number | null;
    current_cycle_count: number | null;
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
            toast.success('Redemption request logged.');
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
            toast.success(isCommercial ? 'Free cylinder approved.' : 'Redemption approved — points debited.');
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

    // Avoid hydration mismatch on the date/Intl formatting (same guard as Orders).
    if (!mounted) return null;

    return (
        <div>
            {/* Track switcher — the two loyalty mechanics are independent views. */}
            <div className={styles.trackSwitcher}>
                <Tabs value={track} onValueChange={(v: string) => switchTrack(v as Track)}>
                    <TabsList>
                        {TRACK_TABS.map((t) => (
                            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
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
                    <Button variant="ghost" size="sm" onClick={() => loadRedemptions(track, activeTab)} disabled={loading}>
                        <RefreshCw size={16} /> Refresh
                    </Button>
                </div>

                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Customer</th>
                                <th>Reward</th>
                                <th>{isCommercial ? 'Free Cylinders' : 'Cost'}</th>
                                <th>{isCommercial ? 'Cycle Progress' : 'Balance'}</th>
                                <th>Requested</th>
                                <th>Status</th>
                                <th className={styles.actionsCol}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr><td colSpan={7} className={styles.emptyState}>Loading…</td></tr>
                            )}
                            {!loading && error && (
                                <tr><td colSpan={7} className={styles.emptyState}>{error}</td></tr>
                            )}
                            {!loading && !error && redemptions.length === 0 && (
                                <tr><td colSpan={7} className={styles.emptyState}>
                                    <Gift size={20} /> No redemptions in this view.
                                </td></tr>
                            )}
                            {!loading && !error && redemptions.map((r) => {
                                const reward = isCommercial
                                    ? (r.reward_description ?? 'Free cylinder (30+1)')
                                    : (r.catalog_item_name ?? r.reward_description ?? '—');
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
                                                {r.status === 'rejected' && r.rejected_reason && (
                                                    <div className={styles.mutedText} title={r.rejected_reason}>{r.rejected_reason}</div>
                                                )}
                                            </td>
                                            <td className={styles.actionsCell}>
                                                <div className={styles.actionButtons}>
                                                    {r.status === 'pending' && (
                                                        <>
                                                            <Button
                                                                variant="accent"
                                                                size="sm"
                                                                onClick={() => handleApprove(r.id)}
                                                                disabled={approvingId === r.id || isRejecting || cannotAct}
                                                                title={cannotAct ? (isCommercial ? 'No completed cycle to redeem' : 'Insufficient points balance') : undefined}
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
                                                    {(r.status === 'rejected' || r.status === 'fulfilled' || r.status === 'cancelled') && (
                                                        <span className={styles.mutedText}>—</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        {isRejecting && (
                                            <tr className={styles.editorRow}>
                                                <td colSpan={7}>
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
