'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search, UserRound } from 'lucide-react';
import { Badge } from '../../components/Badge';
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
    last_order_date: string | null;
    created_at: string;
}

const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
};

/**
 * Customer Information Management directory (BM-031). Lists the branch's
 * registered customers via the real CIM API — no fabricated CSAT/loyalty/order
 * history here; this screen shows only what the API actually returns. The
 * search box re-queries the same endpoint (GET /customers?search=), matching
 * the CIM search behavior used at order intake (BM-024).
 */
export default function Customers() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const [customers, setCustomers] = useState<CustomerRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');

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

    if (!mounted) {
        return <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)' }} />;
    }

    return (
        <div className={styles.card}>
            <div className={styles.cardHeader}>
                <div className={styles.headerRow}>
                    <h2 className={styles.cardTitle}>Customer Directory</h2>
                    <div className={styles.headerActions}>
                        <div className={styles.searchBox}>
                            <Search size={14} className={styles.searchIcon} />
                            <input
                                className={styles.searchInput}
                                placeholder="Search name or number…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
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
                </div>
            </div>
            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Phone</th>
                            <th>Delivery Address</th>
                            <th>Source</th>
                            <th>Last Order</th>
                            <th>Registered</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr><td colSpan={6} className={styles.emptyState}>Loading…</td></tr>
                        )}
                        {!loading && error && (
                            <tr><td colSpan={6} className={styles.emptyState}>{error}</td></tr>
                        )}
                        {!loading && !error && customers.length === 0 && (
                            <tr><td colSpan={6} className={styles.emptyState}>
                                <UserRound size={20} /> No customers found.
                            </td></tr>
                        )}
                        {!loading && !error && customers.map((c) => (
                            <tr key={c.id}>
                                <td className={styles.boldText}>{c.name}</td>
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
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
