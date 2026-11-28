'use client';

import { serviceRequestCylinderSummary, serviceRequestTotalQuantity, type ServiceRequestCylinderFields } from '../../../lib/serviceRequestItems';
import React, { useMemo, useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Search, UserRound, X, Coins, Boxes, Users, Pencil } from 'lucide-react';
import { KPICard } from '../../../components/KPICard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Badge } from '../../components/Badge';
import { Progress } from '../../components/Progress';
import { Pagination } from '../../../components/Pagination';
import { apiErrorMessage, fetchJson } from '../../../lib/api';
import { formatPHMobile, toE164PhMobile } from '../../../lib/phMobile';
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
    account_type: 'household' | 'commercial';
    /** Per-track human-readable ID assigned by a DB trigger at insert
     * (migration 0029): H-00001 for household, C-00001 for commercial. */
    customer_code: string | null;
    last_order_date: string | null;
    created_at: string;
}

interface CustomerProfileFields {
    name: string;
    contactNumber: string;
    deliveryAddress: string;
}

/** One order from GET /service-requests/customers/:id — trimmed to what the
 * detail view's order-history table shows (the full row also carries payment
 * and SLA fields the orders screen uses, not needed here). */
interface OrderHistoryRow extends ServiceRequestCylinderFields {
    id: string;
    status: string;
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
const HISTORY_ITEMS_PER_PAGE = 7;
const EMPTY_CUSTOMERS: CustomerRow[] = [];
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
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const handle = setTimeout(() => setDebouncedSearch(search), search === '' ? 0 : 300);
        return () => clearTimeout(handle);
    }, [search]);

    const [sourceFilter, setSourceFilter] = useState<(typeof SOURCE_FILTERS)[number]>('All Sources');
    const [page, setPage] = useState(1);

    const { data: customersData, error: queryError, isLoading, refetch: loadRequests } = useQuery({
        queryKey: ['customers', debouncedSearch],
        queryFn: () => {
            const trimmed = debouncedSearch.trim();
            const path = trimmed.length >= 2 ? `/customers?search=${encodeURIComponent(trimmed)}` : '/customers';
            return fetchJson<{ customers: CustomerRow[] }>(path);
        },
    });

    const customers = customersData?.customers ?? EMPTY_CUSTOMERS;
    const loading = isLoading;
    const error = queryError ? queryError.message : null;

    const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);
    const [historyPage, setHistoryPage] = useState(1);
    const [profileDraft, setProfileDraft] = useState<CustomerProfileFields | null>(null);
    const [profileNotification, setProfileNotification] = useState(0);
    useEffect(() => {
        if (!profileNotification) return;
        const timer = window.setTimeout(() => setProfileNotification(0), 4000);
        return () => window.clearTimeout(timer);
    }, [profileNotification]);
    const saveProfile = useMutation({
        mutationFn: async ({ id, fields }: { id: string; fields: CustomerProfileFields }) => {
            const contactNumber = toE164PhMobile(fields.contactNumber);
            if (!contactNumber) throw new Error('Enter a valid PH mobile number.');
            const name = fields.name.trim();
            const deliveryAddress = fields.deliveryAddress.trim();
            if (!name || !deliveryAddress) throw new Error('Enter a name and delivery address.');
            return fetchJson<{ customer: CustomerRow }>(`/customers/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ name, contactNumber, deliveryAddress }),
            });
        },
        onSuccess: ({ customer }) => {
            setProfileNotification(value => value + 1);
            setSelectedCustomer((current) => current?.id === customer.id ? customer : current);
            setProfileDraft(null);
            void queryClient.invalidateQueries({ queryKey: ['customers'] });
        },
    });

    const { data: ordersData, error: ordersQueryError, isLoading: ordersLoading } = useQuery({
        queryKey: ['customer-orders', selectedCustomer?.id],
        queryFn: () => fetchJson<{ serviceRequests: OrderHistoryRow[] }>(`/service-requests/customers/${selectedCustomer!.id}`),
        enabled: !!selectedCustomer,
    });
    const orders = ordersData?.serviceRequests ?? [];
    const historyPages = Math.max(1, Math.ceil(orders.length / HISTORY_ITEMS_PER_PAGE));
    const visibleHistoryPage = Math.min(historyPage, historyPages);
    const historyOffset = (visibleHistoryPage - 1) * HISTORY_ITEMS_PER_PAGE;
    const ordersError = ordersQueryError ? ordersQueryError.message : null;

    const { data: loyaltyData, error: loyaltyQueryError, isLoading: loyaltyLoading } = useQuery({
        queryKey: ['customer-loyalty', selectedCustomer?.id],
        queryFn: () => fetchJson<{ ledger: LoyaltyLedgerView }>(`/loyalty/customers/${selectedCustomer!.id}`),
        enabled: !!selectedCustomer,
    });
    const loyalty = loyaltyData?.ledger ?? null;
    const loyaltyError = loyaltyQueryError ? loyaltyQueryError.message : null;

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
        setHistoryPage(1);
    };

    const closeCustomer = () => {
        setProfileNotification(0);
        if (saveProfile.isPending) return;
        setProfileDraft(null);
        saveProfile.reset();
        setSelectedCustomer(null);
    };

    return (
        <div>
            {/* KPI summary — real counts over the currently loaded directory. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <KPICard
                    title="Total Customers"
                    value={metrics.total.toString()}
                    icon={<Users className="w-4 h-4 text-[#007BC1]" />}
                    accentColor="#007BC1"
                />
                <KPICard
                    title="Staff-created"
                    value={metrics.staffCreated.toString()}
                    icon={<UserRound className="w-4 h-4 text-[#f59e0b]" />}
                    accentColor="#f59e0b"
                />
                <KPICard
                    title="Self-registered"
                    value={metrics.selfRegistered.toString()}
                    icon={<UserRound className="w-4 h-4 text-[#22c55e]" />}
                    accentColor="#22c55e"
                />
                <KPICard
                    title="With at Least One Order"
                    value={metrics.withOrder.toString()}
                    icon={<Boxes className="w-4 h-4 text-[#a855f7]" />}
                    accentColor="#a855f7"
                />
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
                    <Select
                        value={sourceFilter}
                        onValueChange={(value) => { setSourceFilter(value as (typeof SOURCE_FILTERS)[number]); setPage(1); }}
                    >
                        <SelectTrigger aria-label="Filter by source" className="w-auto min-w-40 bg-white text-slate-600"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {SOURCE_FILTERS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    {hasFilters && (
                        <button type="button" className={styles.clearLink} onClick={clearFilters}>Clear</button>
                    )}
                    <button
                        type="button"
                        className={styles.refreshButton}
                        onClick={() => void loadRequests()}
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
                    <table className={`${styles.table} ${styles.customerTable}`}>
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
                                            <span className={styles.boldText}>{c.name}</span>
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
                    <div className={styles.dialogContent} role="dialog" aria-modal="true" aria-labelledby="customer-profile-title" onClick={(e) => e.stopPropagation()}>
                        {profileNotification > 0 && <div role="status" className={styles.profileNotification}>Profile updated.</div>}
                        <div className={styles.dialogHeader}>
                            <div>
                                <h2 id="customer-profile-title" className={styles.dialogTitle}>
                                    {selectedCustomer.name}
                                    {selectedCustomer.customer_code && (
                                        <span className={styles.monoText}> · {selectedCustomer.customer_code}</span>
                                    )}
                                </h2>
                                <p className={styles.dialogSubtitle}>
                                    {formatPHMobile(selectedCustomer.contact_number)} · {selectedCustomer.delivery_address}
                                </p>
                                <p className={styles.dialogSubtitle}>
                                    {selectedCustomer.account_type === 'commercial' ? 'Commercial' : 'Household'}
                                </p>
                            </div>
                            <div className={styles.headerActions}>
                            {!profileDraft && <button type="button" className={styles.headerEdit} aria-label="Edit profile" onClick={() => setProfileDraft({
                                name: selectedCustomer.name,
                                contactNumber: formatPHMobile(selectedCustomer.contact_number),
                                deliveryAddress: selectedCustomer.delivery_address,
                            })}><Pencil size={13} aria-hidden="true" /> Edit</button>}
                            <button type="button" className={styles.closeButton} onClick={closeCustomer} aria-label="Close" disabled={saveProfile.isPending}>
                                <X size={18} />
                            </button>
                            </div>
                        </div>

                        <div className={styles.dialogBody}>
                            {profileDraft ? (
                                <form className={styles.profileForm} onSubmit={(event) => {
                                    event.preventDefault();
                                    if (!saveProfile.isPending) saveProfile.mutate({ id: selectedCustomer.id, fields: profileDraft });
                                }}>
                                    <label>Name<input required value={profileDraft.name} onChange={(event) => setProfileDraft({ ...profileDraft, name: event.target.value })} disabled={saveProfile.isPending} /></label>
                                    <label>Contact number<input required type="tel" value={profileDraft.contactNumber} onChange={(event) => setProfileDraft({ ...profileDraft, contactNumber: formatPHMobile(event.target.value) })} disabled={saveProfile.isPending} /></label>
                                    <label>Delivery address<textarea required value={profileDraft.deliveryAddress} onChange={(event) => setProfileDraft({ ...profileDraft, deliveryAddress: event.target.value })} disabled={saveProfile.isPending} /></label>
                                    {saveProfile.error && <p role="alert">{saveProfile.error.message}</p>}
                                    <div className={styles.profileActions}>
                                        <button type="button" disabled={saveProfile.isPending} onClick={() => { setProfileDraft(null); saveProfile.reset(); }}>Cancel</button>
                                        <button type="submit" disabled={saveProfile.isPending}>{saveProfile.isPending ? 'Saving…' : 'Save changes'}</button>
                                    </div>
                                </form>
                            ) : null}
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
                                <div className="flex items-baseline justify-between mb-2">
                                    <h3 className={styles.sectionTitle} style={{ marginBottom: 0 }}><Boxes size={15} /> Order History</h3>
                                    {onViewOrders && (
                                        <button
                                            type="button"
                                            className="text-[11px] font-medium text-[#007BC1] hover:text-[#006399] hover:underline"
                                            onClick={() => onViewOrders(selectedCustomer.name)}
                                            title={`View all requests for ${selectedCustomer.name} in Order Management`}
                                        >
                                            View all requests
                                        </button>
                                    )}
                                </div>
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
                                                {orders.slice(historyOffset, historyOffset + HISTORY_ITEMS_PER_PAGE).map((o) => (
                                                    <tr key={o.id}>
                                                        <td className={styles.mutedText}>{formatDate(o.requested_at)}</td>
                                                        <td>{serviceRequestCylinderSummary(o)}</td>
                                                        <td>{serviceRequestTotalQuantity(o)}</td>
                                                        <td>{formatCurrency(o.total_amount)}</td>
                                                        <td><Badge variant={getStatusVariant(o.status)}>{o.status}</Badge></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                {historyPages > 1 && (
                                    <div className={styles.paginationRow}>
                                        <Pagination currentPage={visibleHistoryPage} totalPages={historyPages} onPageChange={setHistoryPage} />
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
