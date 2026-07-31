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
 * A loyalty redemption as returned by the LPM API (household track only). Snake_case
 * like every other CRM response; branch scope is token-derived server-side so no
 * branch_id is ever sent from here (AGENTS.md §5). The list endpoint enriches each
 * row with customer_name, catalog_item_name, and the household's current
 * points_balance for the queue — these are derived server-side, not columns.
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
}

/** Active household reward from GET /loyalty/catalog. Used to build a request. */
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

    // New redemption request (BM logs a household request into the queue). Collapsed
    // by default; customer is chosen via the same CIM search the Orders screen uses.
    const [showCreate, setShowCreate] = useState(false);
    const [catalog, setCatalog] = useState<CatalogItemRow[]>([]);
    const [selectedItemId, setSelectedItemId] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const [customerResults, setCustomerResults] = useState<CustomerRow[] | null>(null);
    const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
    const [creating, setCreating] = useState(false);

    const loadRedemptions = useCallback(async (status: string) => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiFetch(`/loyalty/redemptions?status=${encodeURIComponent(status)}`);
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

    useEffect(() => { loadRedemptions(activeTab); }, [activeTab, loadRedemptions]);

    // Active reward catalog — loaded once for the create form and to render names.
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

    const handleCreate = async () => {
        if (!selectedCustomer) { toast.error('Select a customer first'); return; }
        if (!selectedItemId) { toast.error('Select a reward'); return; }
        setCreating(true);
        try {
            const res = await apiFetch('/loyalty/redemptions', {
                method: 'POST',
                body: JSON.stringify({ customerId: selectedCustomer.id, catalogItemId: selectedItemId }),
            });
            const data = await res.json();
            if (!res.ok) {
                // 400 (no account / inactive / out of stock) and 404 (unknown item)
                // surface the API's message as-is.
                toast.error(apiErrorMessage(data, 'Failed to create redemption request'));
                return;
            }
            toast.success('Redemption request logged.');
            resetCreate();
            await loadRedemptions(activeTab);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to create redemption request');
        } finally {
            setCreating(false);
        }
    };

    const handleApprove = async (id: string) => {
        setApprovingId(id);
        try {
            const res = await apiFetch(`/loyalty/redemptions/${id}/approve`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) {
                // 409: no longer pending, insufficient points, or out of stock — the
                // API's message says which. Reconcile the queue either way.
                if (res.status === 409) {
                    toast.error(apiErrorMessage(data, 'Could not approve this redemption'));
                    await loadRedemptions(activeTab);
                    return;
                }
                if (res.status === 404) { toast.error('Redemption not found'); return; }
                toast.error(apiErrorMessage(data, 'Failed to approve redemption'));
                return;
            }
            toast.success('Redemption approved — points debited.');
            await Promise.all([loadRedemptions(activeTab), loadCatalog()]);
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
                    await loadRedemptions(activeTab);
                    return;
                }
                toast.error(apiErrorMessage(data, 'Failed to reject redemption'));
                return;
            }
            toast.success('Redemption rejected.');
            setRejectId(null);
            await loadRedemptions(activeTab);
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
                    await loadRedemptions(activeTab);
                    return;
                }
                if (res.status === 404) { toast.error('Redemption not found'); return; }
                toast.error(apiErrorMessage(data, 'Failed to mark fulfilled'));
                return;
            }
            toast.success('Reward marked as handed over.');
            await loadRedemptions(activeTab);
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
            {/* New redemption request (BM logs a household request into the queue). */}
            <div className={styles.card}>
                <div className={styles.cardHeaderFlex}>
                    <div className={styles.cardTitle}>Reward Redemptions</div>
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

                            {/* Reward picker (active catalog) */}
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
                        </div>

                        <div className={styles.createActions}>
                            <Button variant="accent" size="sm" onClick={handleCreate} disabled={creating || !selectedCustomer || !selectedItemId}>
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
                    <Button variant="ghost" size="sm" onClick={() => loadRedemptions(activeTab)} disabled={loading}>
                        <RefreshCw size={16} /> Refresh
                    </Button>
                </div>

                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Customer</th>
                                <th>Reward</th>
                                <th>Cost</th>
                                <th>Balance</th>
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
                                const reward = r.catalog_item_name ?? r.reward_description ?? '—';
                                const cost = r.points_spent ?? 0;
                                const balance = r.points_balance;
                                const cannotAfford = balance != null && balance < cost;
                                const isRejecting = rejectId === r.id;
                                return (
                                    <React.Fragment key={r.id}>
                                        <tr>
                                            <td className={styles.boldText}>{r.customer_name ?? '—'}</td>
                                            <td>{reward}</td>
                                            <td className={styles.monoText}>{cost} pts</td>
                                            <td className={styles.monoText}>{balance == null ? '—' : `${balance} pts`}</td>
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
                                                                disabled={approvingId === r.id || isRejecting || cannotAfford}
                                                                title={cannotAfford ? 'Insufficient points balance' : undefined}
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
