'use client';

import { serviceRequestCylinderSummary, type ServiceRequestCylinderFields } from '../../../lib/serviceRequestItems';
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star, StarHalf, ShoppingCart, Truck, AlertTriangle } from 'lucide-react';
import { KPICard } from '../../../components/KPICard';
import { Badge } from '../../components/Badge';
import { AlertItem, type AlertSeverity } from '../../components/AlertItem';
import { fetchJson } from '../../../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../../components/ui/dialog';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '../../../components/ui/carousel';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui/tooltip';
import styles from './screen.module.css';
import typography from '../../../components/FranchiseReports.module.css';

/** Trimmed Service Request row (SRD module, GET /service-requests) — only the
 * fields this dashboard's KPIs and "Recent Orders" table need. */
interface SRRow extends ServiceRequestCylinderFields {
    id: string;
    sr_code: string;
    status: 'Pending' | 'Dispatched' | 'En Route' | 'Delivered' | 'Cancelled' | 'Under Review';
    customer_name: string;
    rider_id: string | null;
    requested_at: string;
    // The API's live flag is true once the active segment exceeds its threshold.
    sla_at_risk: boolean;
}

interface RiderRow {
    id: string;
    name: string;
}

interface CsatSummary {
    average_stars: number | null;
    total_ratings: number;
    star_counts: Record<number, number>;
    unresolved_low_ratings: number;
    from: string;
    to: string;
}

/** Trimmed stock-level row (Inventory module, GET /inventory/stock-levels). */
interface StockLevelRow {
    stock_level_id: string | null;
    product_id: string;
    product_name: string;
    current_qty: number;
    threshold_qty: number;
}

// Only recorded quantities can confirm low/out-of-stock conditions.
// Missing records are surfaced separately as "Stock not recorded".
const isStockAlert = (item: StockLevelRow) => item.stock_level_id != null && item.current_qty <= item.threshold_qty;
const isOverdueOpenRequest = (item: SRRow) =>
    ['Pending', 'Dispatched', 'En Route'].includes(item.status) && item.sla_at_risk;
const alertSeverityOrder: Record<string, number> = { urgent: 0, warning: 1, info: 2 };

const RECENT_ORDERS_LIMIT = 6;

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
    return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    }).format(d);
};

/** Branch operations run on Philippine time regardless of the viewer's own
 * timezone — "today" is compared on the PH calendar date, not the browser's. */
const phDateKey = (iso: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(iso));

interface DashboardProps {
    onViewOrders?: (searchTerm: string) => void;
    onNavigate?: (screen: string) => void;
}

export default function Dashboard({ onViewOrders, onNavigate }: DashboardProps = {}) {
    const [carouselApi, setCarouselApi] = useState<CarouselApi>();
    const [currentSlide, setCurrentSlide] = useState(0);

    React.useEffect(() => {
        if (!carouselApi) return;

        setCurrentSlide(carouselApi.selectedScrollSnap());

        carouselApi.on('select', () => {
            setCurrentSlide(carouselApi.selectedScrollSnap());
        });
    }, [carouselApi]);

    const { data: requestsData, error: requestsQueryError, isLoading: requestsLoading } = useQuery({
        queryKey: ['service-requests'],
        queryFn: () => fetchJson<{ serviceRequests: SRRow[] }>('/service-requests'),
        refetchInterval: 60_000,
        refetchOnWindowFocus: true,
    });
    const requests = useMemo(() => requestsData?.serviceRequests ?? [], [requestsData]);
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
        queryKey: ['manager-dashboard-csat'],
        queryFn: () => fetchJson<{ summary: CsatSummary }>('/csat/manager-dashboard'),
        refetchOnMount: 'always',
        refetchInterval: 60_000,
        refetchOnWindowFocus: true,
    });
    const csat = csatData?.summary ?? null;
    const csatError = csatQueryError ? csatQueryError.message : null;

    const starCounts = csat?.star_counts;

    const { data: stockData, error: stockQueryError, isLoading: stockLevelsLoading } = useQuery({
        queryKey: ['stock-levels'],
        queryFn: () => fetchJson<{ stockLevels: StockLevelRow[] }>('/inventory/stock-levels'),
        refetchInterval: 60_000,
        refetchOnWindowFocus: true,
    });
    const stockLevels = useMemo(() => stockData?.stockLevels ?? [], [stockData]);
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

    const todaysStatusCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const r of requests) {
            if (phDateKey(r.requested_at) !== todayKey) continue;
            counts[r.status] = (counts[r.status] ?? 0) + 1;
        }
        return counts;
    }, [requests, todayKey]);
    const dispatchedCount = useMemo(() => requests.filter((r) => r.status === 'Dispatched').length, [requests]);
    const enRouteCount = useMemo(() => requests.filter((r) => r.status === 'En Route').length, [requests]);
    const sla = useMemo(() => {
        return {
            late: requests.filter(isOverdueOpenRequest).length,
        };
    }, [requests]);

    const alertGroups = [
        {
            title: 'Out of stock', screen: 'inventory', severity: 'urgent', actionLabel: 'Review stock',
            items: stockLevelsError ? [] : stockAlerts.filter(item => item.current_qty <= 0).map(item => `${item.product_name}: ${item.current_qty} remaining`),
        },
        {
            title: 'SLA breached', screen: 'orders', severity: 'urgent', actionLabel: 'Review orders',
            items: requestsError ? [] : requests.filter(isOverdueOpenRequest)
                .map(item => `${item.sr_code}: ${item.customer_name}`),
        },
        {
            title: 'Low stock', screen: 'inventory', severity: 'warning', actionLabel: 'Review stock',
            items: stockLevelsError ? [] : stockAlerts.filter(item => item.current_qty > 0).map(item => `${item.product_name}: ${item.current_qty} remaining (Threshold: ${item.threshold_qty})`),
        },
        {
            title: 'Low-rating feedback awaiting action', screen: 'csat', severity: 'urgent', actionLabel: 'Respond',
            subtext: 'Unresolved 1–3-star reviews, including previous months.',
            count: csatError ? 0 : csat?.unresolved_low_ratings ?? 0,
            items: ['Unresolved 1–3-star reviews, including previous months.'],
        },
        {
            title: 'Stock not recorded', screen: 'inventory', severity: 'warning', actionLabel: 'Record stock',
            items: stockLevelsError ? [] : stockLevels.filter(item => item.stock_level_id == null).map(item => item.product_name),
        },
    ].map(group => ({ ...group, count: group.count ?? group.items.length }))
        .filter(group => group.count > 0)
        .sort((a, b) => (alertSeverityOrder[a.severity] ?? 2) - (alertSeverityOrder[b.severity] ?? 2));

    const alertsLoading = stockLevelsLoading || requestsLoading || csatLoading;
    const alertErrors = [
        stockLevelsError && 'Stock alerts unavailable.',
        requestsError && 'SLA alerts unavailable.',
        csatError && 'Feedback alerts unavailable.',
    ].filter(Boolean);
    const renderAlerts = (all: boolean) => alertsLoading ? (
        <div role="status" aria-live="polite" className="flex flex-col gap-2">
            <span className="sr-only">Loading alerts…</span>
            {[0, 1].map(index => (
                <div key={index} aria-hidden="true" className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-50 p-3 motion-reduce:animate-none">
                    <div className="mb-3 h-4 w-2/3 rounded bg-slate-200" />
                    <div className="mb-2 h-3 w-full rounded bg-slate-200" />
                    <div className="h-3 w-1/2 rounded bg-slate-200" />
                </div>
            ))}
        </div>
    ) : (
        <>
            {alertErrors.map(error => <div key={String(error)} role="alert" className={styles.emptyState}>{error}</div>)}
            {!alertsLoading && alertErrors.length === 0 && alertGroups.length === 0 && (
                <div className={styles.emptyState}>No critical alerts.</div>
            )}
            {(all ? alertGroups : alertGroups.slice(0, 2)).map(group => (
                <AlertItem key={group.title}
                    severity={group.severity as AlertSeverity}
                    title={group.title} count={group.count} subtext={group.subtext}
                    items={group.subtext ? undefined : group.items}
                    actionLabel={group.actionLabel} showAllItems={all}
                    onPress={() => group.screen === 'orders' ? onViewOrders?.('') : onNavigate?.(group.screen)}
                />
            ))}
        </>
    );

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <KPICard
                    title="Total Orders Today"
                    value={requestsLoading ? '…' : String(totalOrdersToday)}
                    icon={<ShoppingCart className="w-4 h-4 text-[#007BC1]" />}
                    accentColor="#007BC1"
                    tooltip={requestsLoading ? undefined : (
                        <div className="flex flex-col gap-1">
                            <span className="font-semibold">Today&apos;s orders by status</span>
                            {Object.keys(todaysStatusCounts).length === 0
                                ? <span className="text-gray-500">No orders yet today.</span>
                                : Object.entries(todaysStatusCounts).map(([status, count]) => (
                                    <span key={status}>{status}: {count}</span>
                                ))}
                        </div>
                    )}
                />
                <KPICard
                    title="Active Deliveries"
                    value={requestsLoading ? '…' : String(activeDeliveries)}
                    subtitle={requestsLoading ? undefined : `${sla.late} late`}
                    icon={<Truck className="w-4 h-4 text-[#16A34A]" />}
                    accentColor="#16A34A"
                    tooltip={requestsLoading ? undefined : (
                        <div className="flex flex-col gap-1">
                            <span className="font-semibold">In-progress deliveries</span>
                            <span>Dispatched: {dispatchedCount}</span>
                            <span>En Route: {enRouteCount}</span>
                            <span className="font-semibold mt-1">Open orders against SLA</span>
                            <span>Late: {sla.late}</span>
                        </div>
                    )}
                />
                <KPICard
                    title="Low Stock Alerts"
                    value={stockLevelsLoading ? '…' : stockLevelsError ? '—' : String(stockAlerts.length)}
                    icon={<AlertTriangle className="w-4 h-4 text-[#ef4444]" />}
                    accentColor="#ef4444"
                    tooltip={stockLevelsLoading || stockLevelsError ? undefined : (
                        <div className="flex flex-col gap-1">
                            <span className="font-semibold">Low stock items</span>
                            {stockAlerts.length === 0
                                ? <span className="text-gray-500">No recorded stock is below its threshold.</span>
                                : stockAlerts.slice(0, 5).map((alert) => (
                                    <span key={alert.product_id}>{alert.product_name}: {alert.current_qty} left (threshold {alert.threshold_qty})</span>
                                ))}
                        </div>
                    )}
                />
                <KPICard
                    title="Average CSAT"
                    subtitle={csatError ? 'CSAT unavailable' : 'This month'}
                        value={(
                        <div className="flex items-center gap-2 whitespace-nowrap overflow-hidden">
                            <span>{csatLoading ? '\u2026' : csatError ? '\u2014' : String(csat?.average_stars ?? '\u2014')}</span>
                            {!csatLoading && csat?.average_stars != null && (
                                <span className={`${typography.ownerMetricDescription} text-gray-400`}>out of 5</span>
                            )}
                        </div>
                    )}
                    icon={<Star className="w-4 h-4 text-[#f59e0b]" />}
                    accentColor="#f59e0b"
                    tooltipClassName="p-0 overflow-hidden"
                    tooltip={csatLoading || csatError ? undefined : (() => {
                        const total = csat?.total_ratings ?? 0;
                        const avg = csat?.average_stars;
                        return (
                            <div style={{
                                width: 228,
                                padding: '14px 16px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 10,
                            }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 13, color: 'inherit' }}>
                                        {total} {total === 1 ? 'rating' : 'ratings'}
                                    </div>
                                    {avg != null && (
                                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                                            Average {Number(avg).toFixed(2)} out of 5
                                        </div>
                                    )}
                                </div>
                                {total === 0 ? (
                                    <div style={{ fontSize: 12, color: '#9ca3af' }}>No ratings this month</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {[5, 4, 3, 2, 1].map((star) => {
                                            const count = starCounts?.[star] ?? 0;
                                            const pct = total > 0 ? (count / total) * 100 : 0;
                                            return (
                                                <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                                    {/* Star label */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, width: 28, flexShrink: 0 }}>
                                                        <Star size={11} fill="#f59e0b" color="#f59e0b" />
                                                        <span style={{ color: '#6b7280' }}>{star}</span>
                                                    </div>
                                                    {/* Track + fill bar */}
                                                    <div style={{
                                                        flex: 1,
                                                        height: 6,
                                                        borderRadius: 3,
                                                        backgroundColor: '#f1f5f9',
                                                        overflow: 'hidden',
                                                    }}>
                                                        <div style={{
                                                            width: `${pct}%`,
                                                            height: '100%',
                                                            borderRadius: 3,
                                                            backgroundColor: '#007BC1',
                                                            transition: 'width 0.3s ease',
                                                        }} />
                                                    </div>
                                                    {/* Count right-aligned */}
                                                    <div style={{ width: 20, textAlign: 'right', color: '#374151', flexShrink: 0 }}>{count}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                />
            </div>

            <div className={styles.contentGrid}>
                <div className={styles.mainColumn}>
                    <div className={styles.card}>
                        <div className={`${styles.cardHeader} flex items-center justify-between`}>
                            <h2 className={styles.cardTitle}>Recent Orders</h2>
                            <button onClick={() => onViewOrders?.('')} className="text-[11px] text-gray-500 hover:text-gray-700 font-medium cursor-pointer">See all</button>
                        </div>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Request ID</th>
                                        <th>Customer</th>
                                        <th>Items</th>
                                        <th>Status</th>
                                        <th>Delivery Rider</th>
                                        <th>Date & Time</th>
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
                                        <tr
                                            key={order.id}
                                            className="cursor-pointer"
                                            onClick={() => onViewOrders?.(order.sr_code)}
                                        >
                                            <td className={styles.monoText}>{order.sr_code}</td>
                                            <td className={styles.boldText}>{order.customer_name}</td>
                                            <td>{serviceRequestCylinderSummary(order)}</td>
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
                    <Carousel setApi={setCarouselApi} className="w-full">
                        <CarouselContent className="items-start">
                            <CarouselItem>
                                <div className={`${styles.dashboardSideCard} bg-white rounded-2xl shadow-sm border border-gray-100`}>
                                    <Dialog>
                                        <div className={`${styles.cardHeader} flex items-center gap-2`}>
                                            <h2 className={styles.cardTitle}>Critical Alerts</h2>
                                            {!alertsLoading && alertGroups.length > 0 && (
                                                <span className="whitespace-nowrap rounded-full bg-slate-100 px-1.5 py-px text-[10px] leading-4 font-medium text-slate-600">
                                                    {alertGroups.length} need action
                                                </span>
                                            )}
                                            <DialogTrigger asChild>
                                                <button type="button" disabled={alertsLoading} className="ml-auto shrink-0 text-xs text-slate-600 hover:text-[#007BC1] font-medium cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-[#007BC1] disabled:cursor-wait disabled:opacity-50">See all</button>
                                            </DialogTrigger>
                                        </div>
                                        <div aria-busy={alertsLoading} className={`${styles.dashboardSideBody} flex flex-col gap-2 p-3`}>
                                            {renderAlerts(false)}
                                        </div>

                                        <DialogContent className="max-w-md" aria-describedby={undefined}>
                                            <DialogHeader className="border-b border-gray-100 pb-3">
                                                <DialogTitle className={styles.cardTitle}>All Critical Alerts</DialogTitle>
                                            </DialogHeader>
                                            <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto mt-1">
                                                {renderAlerts(true)}
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                    <div className={`${styles.dashboardSideFooter} flex justify-center items-center gap-2 p-3 border-t border-gray-100`}>
                                        {[0, 1].map((index) => (
                                            <button
                                                key={index}
                                                onClick={() => carouselApi?.scrollTo(index)}
                                                type="button"
                                                className={`h-2 rounded-full transition-all duration-300 focus-visible:outline-2 focus-visible:outline-[#007BC1] ${currentSlide === index ? 'bg-gray-800 w-4' : 'bg-gray-300 w-2 hover:bg-gray-400'}`}
                                                aria-label={`Go to slide ${index + 1}`}
                                                aria-pressed={currentSlide === index}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </CarouselItem>

                            <CarouselItem>
                                <div className={`${styles.card} ${styles.dashboardSideCard}`}>
                                    <div className={styles.cardHeader}>
                                        <h2 className={styles.cardTitle}>CSAT Overview</h2>
                                    </div>
                                    <div className={`${styles.dashboardSideBody} p-6 pt-2`}>
                                        {csatError ? (
                                            <div className={styles.emptyState}>{csatError}</div>
                                        ) : csatLoading ? (
                                            <div className={styles.emptyState}>Loading…</div>
                                        ) : !csat?.total_ratings ? (
                                            <div className={styles.emptyState}>No ratings this month.</div>
                                        ) : (
                                            <div className="flex flex-col gap-6">
                                                <div className="flex items-center justify-center gap-4">
                                                    <div className="text-6xl font-bold text-[#f59e0b] tracking-tighter">
                                                        {csat?.average_stars != null ? csat.average_stars.toFixed(1) : '—'}
                                                    </div>
                                                    <div className="flex flex-col gap-1 mt-1">
                                                        <div className="flex gap-1">
                                                            {[1, 2, 3, 4, 5].map((star) => {
                                                                const rating = csat?.average_stars ?? 0;
                                                                if (rating >= star) {
                                                                    return <Star key={star} size={20} className="text-[#f59e0b] fill-[#f59e0b]" />;
                                                                } else if (rating >= star - 0.5) {
                                                                    return <StarHalf key={star} size={20} className="text-[#f59e0b] fill-[#f59e0b]" />;
                                                                } else {
                                                                    return <Star key={star} size={20} className="text-gray-200 fill-gray-200" />;
                                                                }
                                                            })}
                                                        </div>
                                                        <div className="text-sm text-gray-500 font-medium ml-1">
                                                            {csat?.total_ratings ?? 0} reviews this month
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-3">
                                                    {[5, 4, 3, 2, 1].map((star) => {
                                                        const count = starCounts?.[star] ?? 0;
                                                        const total = csat?.total_ratings || 1;
                                                        const percentage = csat?.total_ratings ? Math.round((count / total) * 100) : 0;
                                                        return (
                                                            <Tooltip key={star}>
                                                                <TooltipTrigger asChild>
                                                                    <div className="flex items-center gap-3 cursor-default">
                                                                        <span className="w-3 text-sm font-medium text-gray-500 text-center">{star}</span>
                                                                        <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                                                            <div
                                                                                className="h-full bg-[#f59e0b] rounded-full"
                                                                                style={{ width: `${percentage}%` }}
                                                                            />
                                                                        </div>
                                                                        <span className="w-8 text-sm text-gray-500 text-right">{percentage}%</span>
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="top">
                                                                    {count} rating{count === 1 ? '' : 's'} at {star}★ ({percentage}% of {total})
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className={`${styles.dashboardSideFooter} flex justify-center items-center gap-2 p-3 border-t border-gray-100`}>
                                        {[0, 1].map((index) => (
                                            <button
                                                key={index}
                                                onClick={() => carouselApi?.scrollTo(index)}
                                                type="button"
                                                className={`h-2 rounded-full transition-all duration-300 focus-visible:outline-2 focus-visible:outline-[#007BC1] ${currentSlide === index ? 'bg-gray-800 w-4' : 'bg-gray-300 w-2 hover:bg-gray-400'}`}
                                                aria-label={`Go to slide ${index + 1}`}
                                                aria-pressed={currentSlide === index}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </CarouselItem>
                        </CarouselContent>
                    </Carousel>
                </div>
            </div>
        </>
    );
}
