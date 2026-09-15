'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Flame, Star, ShoppingCart, Truck, AlertTriangle } from 'lucide-react';
import { KPICard } from '../../../components/KPICard';
import { Badge } from '../../components/Badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../../components/Chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { fetchJson } from '../../../lib/api';
import styles from './screen.module.css';

/** Trimmed Service Request row (SRD module, GET /service-requests) — only the
 * fields this dashboard's KPIs and "Recent Orders" table need. */
interface SRRow {
    id: string;
    status: 'Pending' | 'Dispatched' | 'En Route' | 'Delivered' | 'Cancelled' | 'Under Review';
    customer_name: string;
    quantity: number;
    cylinder_size: string;
    rider_id: string | null;
    requested_at: string;
}

interface RiderRow {
    id: string;
    name: string;
}

interface CsatSummary {
    average_stars: number | null;
    total_ratings: number;
}

/** Trimmed stock-level row (Inventory module, GET /inventory/stock-levels). */
interface StockLevelRow {
    product_id: string;
    product_name: string;
    current_qty: number;
    threshold_qty: number;
}

// Same "needs attention" band the Inventory screen's own Critical/Low Stock
// badges use: at or under threshold is Critical, up to 1.5x threshold is Low.
const isStockAlert = (item: StockLevelRow) => item.current_qty <= item.threshold_qty * 1.5;

const RECENT_ORDERS_LIMIT = 6;
const STAR_LEVELS = [1, 2, 3, 4, 5] as const;

const chartConfig = {
    count: { label: 'Reviews', color: 'var(--primary)' }
};

const getStatusVariant = (status: SRRow['status']) => {
    switch (status) {
        case 'Delivered': return 'success' as const;
        case 'Dispatched': return 'primary' as const;
        case 'En Route': return 'primary' as const;
        case 'Cancelled': return 'destructive' as const;
        case 'Pending': return 'warning' as const;
        default: return 'secondary' as const;
    }
};

const formatTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }).format(d);
};

/** Branch operations run on Philippine time regardless of the viewer's own
 * timezone — "today" is compared on the PH calendar date, not the browser's. */
const phDateKey = (iso: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(iso));

export default function Dashboard() {
    const { data: requestsData, error: requestsQueryError, isLoading: requestsLoading } = useQuery({
        queryKey: ['service-requests'],
        queryFn: () => fetchJson<{ serviceRequests: SRRow[] }>('/service-requests'),
    });
    const requests = requestsData?.serviceRequests ?? [];
    const requestsError = requestsQueryError ? requestsQueryError.message : null;

    const { data: ridersData } = useQuery({
        queryKey: ['riders'],
        queryFn: () => fetchJson<{ riders: RiderRow[] }>('/riders'),
    });
    const ridersMap = useMemo(() => {
        const map: Record<string, string> = {};
        if (ridersData?.riders) {
            for (const r of ridersData.riders) map[r.id] = r.name;
        }
        return map;
    }, [ridersData]);

    const { data: csatData, error: csatQueryError, isLoading: csatLoading } = useQuery({
        queryKey: ['csat-summary'],
        queryFn: () => fetchJson<{ summary: CsatSummary }>('/csat/summary'),
    });
    const csat = csatData?.summary ?? null;
    const csatError = csatQueryError ? csatQueryError.message : null;

    const { data: ratingsData } = useQuery({
        queryKey: ['csat-ratings-all'],
        queryFn: () => fetchJson<{ ratings: { stars: number }[] }>('/csat/ratings?resolution=all'),
    });
    const starCounts = useMemo(() => {
        if (!ratingsData?.ratings) return null;
        const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        for (const r of ratingsData.ratings) {
            counts[r.stars] = (counts[r.stars] ?? 0) + 1;
        }
        return counts;
    }, [ratingsData]);

    const { data: stockData, error: stockQueryError, isLoading: stockLevelsLoading } = useQuery({
        queryKey: ['stock-levels'],
        queryFn: () => fetchJson<{ stockLevels: StockLevelRow[] }>('/inventory/stock-levels'),
    });
    const stockLevels = stockData?.stockLevels ?? [];
    const stockLevelsError = stockQueryError ? stockQueryError.message : null;

    const todayKey = useMemo(() => phDateKey(new Date().toISOString()), []);

    const totalOrdersToday = useMemo(
        () => requests.filter((r) => phDateKey(r.requested_at) === todayKey).length,
        [requests, todayKey],
    );
    const activeDeliveries = useMemo(
        () => requests.filter((r) => r.status === 'Dispatched' || r.status === 'En Route').length,
        [requests],
    );
    const recentOrders = useMemo(() => requests.slice(0, RECENT_ORDERS_LIMIT), [requests]);
    const stockAlerts = useMemo(() => stockLevels.filter(isStockAlert), [stockLevels]);

    const csatChartData = useMemo(
        () => STAR_LEVELS.map((stars) => ({ rating: `${stars}★`, count: starCounts?.[stars] ?? 0 })),
        [starCounts],
    );



    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <KPICard
                    title="Total Orders Today"
                    value={requestsLoading ? '…' : String(totalOrdersToday)}
                    icon={<ShoppingCart className="w-4 h-4 text-[#007BC1]" />}
                    accentColor="#007BC1"
                />
                <KPICard
                    title="Active Deliveries"
                    value={requestsLoading ? '…' : String(activeDeliveries)}
                    icon={<Truck className="w-4 h-4 text-[#16A34A]" />}
                    accentColor="#16A34A"
                />
                <KPICard
                    title="Low Stock Alerts"
                    value={stockLevelsLoading ? '…' : String(stockAlerts.length)}
                    icon={<AlertTriangle className="w-4 h-4 text-[#ef4444]" />}
                    accentColor="#ef4444"
                    alert={stockAlerts.length > 0}
                />
                <KPICard
                    title="Avg CSAT"
                    value={csatLoading ? '…' : String(csat?.average_stars ?? '—')}
                    icon={<Star className="w-4 h-4 text-[#f59e0b]" />}
                    accentColor="#f59e0b"
                    // No prior-period figure exists from this endpoint, so show
                    // the total rating count as context instead of a fabricated
                    // trend delta.
                    trend={csat ? { text: `${csat.total_ratings} rating${csat.total_ratings !== 1 ? 's' : ''} total`, direction: 'up', positive: true } : undefined}
                />
            </div>

            <div className={styles.contentGrid}>
                <div className={styles.mainColumn}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitle}>Recent Orders</h2>
                        </div>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Order #</th>
                                        <th>Customer</th>
                                        <th>Items</th>
                                        <th>Status</th>
                                        <th>Rider</th>
                                        <th>Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {requestsLoading && (
                                        <tr><td colSpan={6} className={styles.emptyState}>Loading…</td></tr>
                                    )}
                                    {!requestsLoading && requestsError && (
                                        <tr><td colSpan={6} className={styles.emptyState}>{requestsError}</td></tr>
                                    )}
                                    {!requestsLoading && !requestsError && recentOrders.length === 0 && (
                                        <tr><td colSpan={6} className={styles.emptyState}>No orders yet.</td></tr>
                                    )}
                                    {!requestsLoading && !requestsError && recentOrders.map(order => (
                                        <tr key={order.id}>
                                            <td className={styles.monoText}>#{order.id.slice(0, 8).toUpperCase()}</td>
                                            <td className={styles.boldText}>{order.customer_name}</td>
                                            <td>{order.quantity}x {order.cylinder_size}</td>
                                            <td>
                                                <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge>
                                            </td>
                                            <td>{order.rider_id ? (ridersMap[order.rider_id] ?? order.rider_id) : 'Unassigned'}</td>
                                            <td className={styles.mutedText}>{formatTime(order.requested_at)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className={styles.sideColumn}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitle}>Critical Alerts</h2>
                        </div>
                        <div className={styles.alertList}>
                            {stockLevelsLoading && <div className={styles.emptyState}>Loading…</div>}
                            {!stockLevelsLoading && stockLevelsError && (
                                <div className={styles.emptyState}>{stockLevelsError}</div>
                            )}
                            {!stockLevelsLoading && !stockLevelsError && stockAlerts.length === 0 && (
                                <div className={styles.emptyState}>All stock levels are healthy.</div>
                            )}
                            {!stockLevelsLoading && !stockLevelsError && stockAlerts.map(alert => (
                                <div key={alert.product_id} className={styles.alertItem}>
                                    <Flame className={styles.alertIcon} size={20} />
                                    <div className={styles.alertText}>
                                        <strong>{alert.product_name}</strong>
                                        <br />
                                        {alert.current_qty} remaining (threshold: {alert.threshold_qty})
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitle}>CSAT Overview</h2>
                        </div>
                        <div className={styles.chartWrapper}>
                            {csatError ? (
                                <div className={styles.emptyState}>{csatError}</div>
                            ) : (
                                <ChartContainer config={chartConfig}>
                                    <BarChart data={csatChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="rating" axisLine={false} tickLine={false} tickMargin={10} />
                                        <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                                        <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
                                        <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                    </BarChart>
                                </ChartContainer>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
