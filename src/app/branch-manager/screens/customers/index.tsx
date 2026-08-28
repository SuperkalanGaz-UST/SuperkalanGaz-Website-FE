'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, UserRound, X, Coins, Boxes, Users } from 'lucide-react';
import { Badge } from '../../components/Badge';
import { Progress } from '../../components/Progress';
import { Pagination } from '../../../components/Pagination';
import { apiFetch, apiErrorMessage } from '../../../lib/api';
import { formatPHMobile } from '../../../lib/phMobile';
import styles from './screen.module.css';

/**
 * Row shape from GET /customers (CIM module). `registration_source` is
 * 'staff-created' | 'self-registered' (story BM-031) — this screen is the "CIM"
 * surface BM-031's AC calls out: the badge must be visible on the customer
 * record here, not just on the intake form's confirmation. `last_order_date` is
 * derived (MAX requested_at across the customer's orders), not a stored column.
 */
interface CustomerRow {
    id: string;
    branch_id: string;
    name: string;
    contact_number: string;
    delivery_address: string;
    registration_source: 'staff-created' | 'self-registered';
    /** Per-track human-readable ID assigned by a DB trigger at insert
     * (migration 0029): H-00001 for household, C-00001 for commercial. */
    customer_code: string | null;
    last_order_date: string | null;
    created_at: string;
}

/** One order from GET /service-requests/customers/:id — trimmed to what the
 * detail view's order-history table shows (the full row also carries payment
 * and SLA fields the orders screen uses, not needed here). */
interface OrderHistoryRow {
    id: string;
    status: string;
    cylinder_size: string;
    quantity: number;
    total_amount: number | null;
    requested_at: string;
    delivered_at: string | null;
}

/** GET /loyalty/customers/:id — the customer's ONE track (never both at once;
 * a CIM profile carries exactly one accountType). Matching the ledger shape
 * used on the Rewards screen. */
interface LoyaltyLedgerView {
    track: 'household_points' | 'commercial_30plus1';
    points_balance: number | null;
    completed_cycles: number | null;
    current_cycle_count: number | null;
}

const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
};

const formatCurrency = (amount: number | null) =>
    amount == null ? '—' : `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getStatusVariant = (status: string) => {
    switch (status) {
        case 'Delivered': return 'success' as const;
        case 'Dispatched': return 'primary' as const;
        case 'En Route': return 'info' as const;
        case 'Cancelled': return 'destructive' as const;
        case 'Pending': return 'warning' as const;
        default: return 'secondary' as const;
    }
};

const COMMERCIAL_CYCLE_LENGTH = 30;
const ITEMS_PER_PAGE = 10;
const SOURCE_FILTERS = ['All Sources', 'Staff-created', 'Self-registered'] as const;

const initials = (name: string) =>
    name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');

interface CustomersProps {
    /** Called with the customer's name when their name is clicked — the parent
     * (BranchManagerApp) uses this to switch to the Orders screen pre-filtered
     * to them, so the full order queue (with its own dispatch/edit/cancel
     * actions) opens directly instead of the read-only summary below. */
    onViewOrders?: (customerName: string) => void;
}

/**
 * Customer Information Management directory (BM-031). Lists the branch's
 * registered customers via the real CIM API — styled after the Franchise
 * Admin Customer directory (KPI summary row, avatar-initial rows, hover
 * action) while keeping only real, already-available data; no fields are
 * fabricated to match that mock's illustrative columns (e.g. no per-row order
 * count/rating, which the API doesn't return).
 *
 * Clicking a row opens a detail dialog with that customer's order history and
 * loyalty standing — the loyalty figures are shown for their ONE actual track
 * (household points OR commercial 30+1 progress), never blended into a single
 * generic "points" number. Clicking the customer's NAME specifically redirects
 * to the Orders screen, pre-filtered to them, for the full interactive queue.
 */
export default function Customers({ onViewOrders }: CustomersProps = {}) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const [customers, setCustomers] = useState<CustomerRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [sourceFilter, setSourceFilter] = useState<(typeof SOURCE_FILTERS)[number]>('All Sources');
    const [page, setPage] = useState(1);

    const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);
    const [orders, setOrders] = useState<OrderHistoryRow[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(false);
    const [ordersError, setOrdersError] = useState<string | null>(null);
    const [loyalty, setLoyalty] = useState<LoyaltyLedgerView | null>(null);
    const [loyaltyLoading, setLoyaltyLoading] = useState(false);
    const [loyaltyError, setLoyaltyError] = useState<string | null>(null);

    const load = useCallback(async (term: string) => {
        setLoading(true);
        setError(null);
        try {
            // No term => the full branch directory; >=2 chars => name/contact match.
            // A 1-character term is not sent (the API 400s below 2 chars) — the
            // directory just stays as-is until the term clears the threshold.
            const trimmed = term.trim();
            const path = trimmed.length >= 2 ? `/customers?search=${encodeURIComponent(trimmed)}` : '/customers';
            const res = await apiFetch(path);
            const data = await res.json();
            if (!res.ok) throw new Error(apiErrorMessage(data, 'Failed to load customers'));
            setCustomers(data.customers as CustomerRow[]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load customers');
            setCustomers([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Debounced: directory loads immediately on mount; typing re-queries.
    useEffect(() => {
        const handle = setTimeout(() => load(search), search === '' ? 0 : 300);
        return () => clearTimeout(handle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    // Source filter is layered client-side on top of the (server-searched)
    // directory — real data already on the page, no extra request.
    const filtered = useMemo(() => {
        if (sourceFilter === 'All Sources') return customers;
        const want = sourceFilter === 'Staff-created' ? 'staff-created' : 'self-registered';
        return customers.filter((c) => c.registration_source === want);
    }, [customers, sourceFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const safePage = Math.min(page, totalPages);
    const pageSlice = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

    const metrics = useMemo(() => ({
        total: customers.length,
        staffCreated: customers.filter((c) => c.registration_source === 'staff-created').length,
        selfRegistered: customers.filter((c) => c.registration_source === 'self-registered').length,
        withOrder: customers.filter((c) => c.last_order_date != null).length,
    }), [customers]);

    const hasFilters = search.trim() !== '' || sourceFilter !== 'All Sources';
    const clearFilters = () => { setSearch(''); setSourceFilter('All Sources'); setPage(1); };

    const openCustomer = (customer: CustomerRow) => {
        setSelectedCustomer(customer);

        setOrdersLoading(true);
        setOrdersError(null);
        apiFetch(`/service-requests/customers/${customer.id}`)
            .then(async (res) => {
                const data = await res.json();
                if (!res.ok) throw new Error(apiErrorMessage(data, 'Failed to load order history'));
                setOrders(data.serviceRequests as OrderHistoryRow[]);
            })
            .catch((err) => {
                setOrdersError(err instanceof Error ? err.message : 'Failed to load order history');
                setOrders([]);
            })
            .finally(() => setOrdersLoading(false));

        setLoyaltyLoading(true);
        setLoyaltyError(null);
        setLoyalty(null);
        apiFetch(`/loyalty/customers/${customer.id}`)
            .then(async (res) => {
                const data = await res.json();
                if (!res.ok) throw new Error(apiErrorMessage(data, 'Failed to load loyalty standing'));
                setLoyalty(data.ledger as LoyaltyLedgerView);
            })
            .catch((err) => {
                setLoyaltyError(err instanceof Error ? err.message : 'Failed to load loyalty standing');
            })
            .finally(() => setLoyaltyLoading(false));
    };

    const closeCustomer = () => {
        setSelectedCustomer(null);
        setOrders([]);
        setOrdersError(null);
        setLoyalty(null);
        setLoyaltyError(null);
    };

    if (!mounted) {
        return <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)' }} />;
    }

    return (
        <div>
            {/* KPI summary — real counts over the currently loaded directory. */}
            <div className={styles.metricsRow}>
                <div className={styles.metricCardSmall} style={{ borderLeftColor: '#007BC1' }}>
                    <div className={styles.metricValueSmall}>{metrics.total}</div>
                    <div className={styles.metricLabelSmall}>Total Customers</div>
                </div>
                <div className={styles.metricCardSmall} style={{ borderLeftColor: '#f59e0b' }}>
                    <div className={styles.metricValueSmall}>{metrics.staffCreated}</div>
                    <div className={styles.metricLabelSmall}>Staff-created</div>
                </div>
                <div className={styles.metricCardSmall} style={{ borderLeftColor: '#22c55e' }}>
                    <div className={styles.metricValueSmall}>{metrics.selfRegistered}</div>
                    <div className={styles.metricLabelSmall}>Self-registered</div>
                </div>
                <div className={styles.metricCardSmall} style={{ borderLeftColor: '#a855f7' }}>
                    <div className={styles.metricValueSmall}>{metrics.withOrder}</div>
                    <div className={styles.metricLabelSmall}>With at Least One Order</div>
                </div>
            </div>

            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>Customer Directory</h2>
                </div>

                <div className={styles.filterBar}>
                    <div className={styles.searchBox}>
                        <Search size={14} className={styles.searchIcon} />
                        <input
                            className={styles.searchInput}
                            placeholder="Search name or number…"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        />
                    </div>
                    <select
                        className={styles.sourceSelect}
                        value={sourceFilter}
                        onChange={(e) => { setSourceFilter(e.target.value as (typeof SOURCE_FILTERS)[number]); setPage(1); }}
                    >
                        {SOURCE_FILTERS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {hasFilters && (
                        <button type="button" className={styles.clearLink} onClick={clearFilters}>Clear</button>
                    )}
                    <button
                        type="button"
                        className={styles.refreshButton}
                        onClick={() => load(search)}
                        disabled={loading}
                        title="Refresh"
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>

                <div className={styles.resultCountRow}>
                    <span className={styles.mutedText}>
                        Showing <strong>{filtered.length}</strong> customer{filtered.length !== 1 ? 's' : ''}
                        {hasFilters ? ' matching filters' : ''}
                    </span>
                    <span className={styles.resultCountTotal}><Users size={13} /> {customers.length} total</span>
                </div>

                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Customer ID</th>
                                <th>Customer</th>
                                <th>Phone</th>
                                <th>Delivery Address</th>
                                <th>Source</th>
                                <th>Last Order</th>
                                <th>Registered</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr><td colSpan={8} className={styles.emptyState}>Loading…</td></tr>
                            )}
                            {!loading && error && (
                                <tr><td colSpan={8} className={styles.emptyState}>{error}</td></tr>
                            )}
                            {!loading && !error && filtered.length === 0 && (
                                <tr><td colSpan={8} className={styles.emptyState}>
                                    <UserRound size={20} /> No customers found.
                                </td></tr>
                            )}
                            {!loading && !error && pageSlice.map((c) => (
                                <tr
                                    key={c.id}
                                    className={styles.clickableRow}
                                    onClick={() => openCustomer(c)}
                                >
                                    <td className={styles.monoText}>{c.customer_code ?? '—'}</td>
                                    <td>
                                        <div className={styles.nameCell}>
                                            <span className={styles.avatarCircle}>{initials(c.name)}</span>
                                            {onViewOrders ? (
                                                <button
                                                    type="button"
                                                    className={styles.nameLink}
                                                    onClick={(e) => { e.stopPropagation(); onViewOrders(c.name); }}
                                                    title={`View ${c.name}'s order history in Order Management`}
                                                >
                                                    {c.name}
                                                </button>
                                            ) : (
                                                <span className={styles.boldText}>{c.name}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td>{formatPHMobile(c.contact_number)}</td>
                                    <td className={styles.mutedText}>{c.delivery_address}</td>
                                    <td>
                                        {/* BM-031: the staff-created flag must be visible on the
                                            customer record in CIM — this is that badge. */}
                                        {c.registration_source === 'staff-created' ? (
                                            <Badge variant="secondary">Staff-created</Badge>
                                        ) : (
                                            <Badge variant="info">Self-registered</Badge>
                                        )}
                                    </td>
                                    <td className={styles.mutedText}>{formatDate(c.last_order_date)}</td>
                                    <td className={styles.mutedText}>{formatDate(c.created_at)}</td>
                                    <td className={styles.viewActionCell}>
                                        <button
                                            type="button"
                                            className={styles.viewButton}
                                            onClick={(e) => { e.stopPropagation(); openCustomer(c); }}
                                        >
                                            View →
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className={styles.paginationRow}>
                        <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} />
                    </div>
                )}
            </div>

            {selectedCustomer && (
                <div className={styles.dialogOverlay} onClick={closeCustomer}>
                    <div className={styles.dialogContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.dialogHeader}>
                            <div>
                                <h2 className={styles.dialogTitle}>
                                    {selectedCustomer.name}
                                    {selectedCustomer.customer_code && (
                                        <span className={styles.monoText}> · {selectedCustomer.customer_code}</span>
                                    )}
                                </h2>
                                <p className={styles.dialogSubtitle}>
                                    {formatPHMobile(selectedCustomer.contact_number)} · {selectedCustomer.delivery_address}
                                </p>
                            </div>
                            <button type="button" className={styles.closeButton} onClick={closeCustomer} aria-label="Close">
                                <X size={18} />
                            </button>
                        </div>

                        <div className={styles.dialogBody}>
                            <section className={styles.detailSection}>
                                <h3 className={styles.sectionTitle}><Coins size={15} /> Loyalty Standing</h3>
                                {loyaltyLoading && <div className={styles.mutedText}>Loading…</div>}
                                {!loyaltyLoading && loyaltyError && <div className={styles.mutedText}>{loyaltyError}</div>}
                                {!loyaltyLoading && !loyaltyError && loyalty?.track === 'household_points' && (
                                    <div className={styles.loyaltyCard}>
                                        <span className={styles.loyaltyLabel}>Household Points Balance</span>
                                        <span className={styles.loyaltyValue}>{loyalty.points_balance ?? 0} pts</span>
                                    </div>
                                )}
                                {!loyaltyLoading && !loyaltyError && loyalty?.track === 'commercial_30plus1' && (
                                    <div className={styles.loyaltyCard}>
                                        <span className={styles.loyaltyLabel}>Commercial 30+1 Progress</span>
                                        <span className={styles.loyaltyValue}>
                                            {loyalty.current_cycle_count ?? 0} / {COMMERCIAL_CYCLE_LENGTH} deliveries
                                        </span>
                                        <Progress value={((loyalty.current_cycle_count ?? 0) / COMMERCIAL_CYCLE_LENGTH) * 100} />
                                        <span className={styles.mutedText}>{loyalty.completed_cycles ?? 0} free cylinder(s) earned to date</span>
                                    </div>
                                )}
                                {!loyaltyLoading && !loyaltyError && !loyalty && (
                                    <div className={styles.mutedText}>No loyalty account for this customer yet.</div>
                                )}
                            </section>

                            <section className={styles.detailSection}>
                                <h3 className={styles.sectionTitle}><Boxes size={15} /> Order History</h3>
                                {ordersLoading && <div className={styles.mutedText}>Loading…</div>}
                                {!ordersLoading && ordersError && <div className={styles.mutedText}>{ordersError}</div>}
                                {!ordersLoading && !ordersError && orders.length === 0 && (
                                    <div className={styles.mutedText}>No previous orders.</div>
                                )}
                                {!ordersLoading && !ordersError && orders.length > 0 && (
                                    <div className={styles.tableWrapper}>
                                        <table className={styles.table}>
                                            <thead>
                                                <tr>
                                                    <th>Date</th>
                                                    <th>Cylinder</th>
                                                    <th>Qty</th>
                                                    <th>Total</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {orders.map((o) => (
                                                    <tr key={o.id}>
                                                        <td className={styles.mutedText}>{formatDate(o.requested_at)}</td>
                                                        <td>{o.cylinder_size}</td>
                                                        <td>{o.quantity}</td>
                                                        <td>{formatCurrency(o.total_amount)}</td>
                                                        <td><Badge variant={getStatusVariant(o.status)}>{o.status}</Badge></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
