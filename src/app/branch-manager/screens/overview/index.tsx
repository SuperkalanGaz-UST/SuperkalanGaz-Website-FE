'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Flame, Star, ShoppingCart, Truck, AlertTriangle, MoreVertical } from 'lucide-react';
import { KPICard } from '../../../components/KPICard';
import { Badge } from '../../components/Badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../../components/Chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { fetchJson } from '../../../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../../components/ui/dialog';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '../../../components/ui/carousel';
import styles from './screen.module.css';

/** Trimmed Service Request row (SRD module, GET /service-requests) — only the
 * fields this dashboard's KPIs and "Recent Orders" table need. */
interface SRRow {
    id: string;
    sr_code: string;
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
    count: { label: 'Reviews', color: '#007BC1' }
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
}

const CustomTick = ({ x, y, payload }: any) => {
    return (
        <g transform={`translate(${x},${y})`}>
            <text x={-2} y={0} dy={16} textAnchor="end" fill="#9ca3af" fontSize={12} fontWeight={500}>
                {payload.value}
            </text>
            <g transform="translate(2, 6)">
                <Star size={12} fill="#f59e0b" color="#f59e0b" />
            </g>
        </g>
    );
};

export default function Dashboard({ onViewOrders }: DashboardProps = {}) {
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
        () => STAR_LEVELS.map((stars) => ({ rating: String(stars), count: starCounts?.[stars] ?? 0 })),
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
                />
                <KPICard
                    title="Average CSAT"
                    value={csatLoading ? '…' : String(csat?.average_stars ?? '—')}
                    icon={<Star className="w-4 h-4 text-[#f59e0b]" />}
                    accentColor="#f59e0b"
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
                                        <th>Request ID</th>
                                        <th>Customer</th>
                                        <th>Items</th>
                                        <th>Status</th>
                                        <th>Rider</th>
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
                    <Carousel setApi={setCarouselApi} className="w-full">
                        <CarouselContent>
                            <CarouselItem>
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                                    <Dialog>
                                        <div className={`${styles.cardHeader} flex items-center justify-between`}>
                                            <h2 className={styles.cardTitle}>Critical Alerts</h2>
                                            <DialogTrigger asChild>
                                                <button className="text-[11px] text-gray-500 hover:text-gray-700 font-medium cursor-pointer">See all</button>
                                            </DialogTrigger>
                                        </div>
                                        <div className="flex flex-col gap-2 p-4">
                                            {stockLevelsLoading && <div className={styles.emptyState}>Loading…</div>}
                                            {!stockLevelsLoading && stockLevelsError && (
                                                <div className={styles.emptyState}>{stockLevelsError}</div>
                                            )}
                                            {!stockLevelsLoading && !stockLevelsError && stockAlerts.length === 0 && (
                                                <div className={styles.emptyState}>All stock levels are healthy.</div>
                                            )}
                                            {!stockLevelsLoading && !stockLevelsError && stockAlerts.slice(0, 3).map(alert => (
                                                <div key={alert.product_id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shadow-sm">
                                                            <AlertTriangle className="w-4 h-4 text-[#dc2626]" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-semibold text-gray-900 leading-none">{alert.product_name}</span>
                                                            <span className="text-[11px] text-gray-500 mt-1">{alert.current_qty} remaining (Threshold: {alert.threshold_qty})</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        <DialogContent className="max-w-md" aria-describedby={undefined}>
                                            <DialogHeader className="border-b border-gray-100 pb-3">
                                                <DialogTitle className={styles.cardTitle}>All Critical Alerts</DialogTitle>
                                            </DialogHeader>
                                            <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto mt-1">
                                                {stockAlerts.map(alert => (
                                                    <div key={alert.product_id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shadow-sm">
                                                                <AlertTriangle className="w-4 h-4 text-[#dc2626]" />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-semibold text-gray-900 leading-none">{alert.product_name}</span>
                                                                <span className="text-[11px] text-gray-500 mt-1">{alert.current_qty} remaining (Threshold: {alert.threshold_qty})</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {stockAlerts.length === 0 && (
                                                    <div className="text-center text-gray-500 py-8">No alerts found.</div>
                                                )}
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </CarouselItem>

                            <CarouselItem>
                                <div className={styles.card}>
                                    <div className={styles.cardHeader}>
                                        <h2 className={styles.cardTitle}>CSAT Overview</h2>
                                    </div>
                                    <div className={styles.chartWrapper}>
                                        {csatError ? (
                                            <div className={styles.emptyState}>{csatError}</div>
                                        ) : (
                                            <ChartContainer config={chartConfig}>
                                                <BarChart data={csatChartData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                                                    <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" vertical={false} />
                                                    <XAxis dataKey="rating" axisLine={false} tickLine={false} tickMargin={10} tick={<CustomTick />} />
                                                    <YAxis axisLine={false} tickLine={false} allowDecimals={false} tickMargin={10} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                                    <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
                                                    <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                                </BarChart>
                                            </ChartContainer>
                                        )}
                                    </div>
                                </div>
                            </CarouselItem>
                        </CarouselContent>
                    </Carousel>

                    <div className="flex justify-center items-center gap-2 -mt-1">
                        {[0, 1].map((index) => (
                            <button
                                key={index}
                                onClick={() => carouselApi?.scrollTo(index)}
                                className={`h-2 rounded-full transition-all duration-300 ${currentSlide === index ? 'bg-gray-800 w-4' : 'bg-gray-300 w-2 hover:bg-gray-400'}`}
                                aria-label={`Go to slide ${index + 1}`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}
