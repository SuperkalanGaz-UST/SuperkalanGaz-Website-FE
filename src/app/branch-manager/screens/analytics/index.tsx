'use client';

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Target, ShoppingCart, Truck, Star, Gift, AlertCircle, Loader2 } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, ReferenceLine, XAxis, YAxis, Cell } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/Select";
import { KPICard } from "../../../components/KPICard";
import { Badge } from "../../components/Badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "../../components/Chart";
import { Tabs, TabsList, TabsTrigger } from "../../components/Tabs";
import { fetchJson } from "../../../lib/api";
import styles from "./screen.module.css";

const orderChartConfig = { orders: { label: "Total Orders", color: "var(--primary)" } };
const csatChartConfig = { csat: { label: "Avg CSAT Score", color: "#f59e0b" } };
const deliveryChartConfig = { onTime: { label: "On-Time", color: "var(--primary)" }, late: { label: "Late", color: "#ef4444" } };
const productChartConfig = { value: { label: "Percentage", color: "var(--primary)" } };

const CHART_TABS = [
    { value: "orders", label: "Order Volume Trend" },
    { value: "csat", label: "CSAT Score Trend" },
    { value: "delivery", label: "Delivery Performance" },
    { value: "products", label: "Orders by Product Breakdown" },
] as const;
type ChartCategory = (typeof CHART_TABS)[number]["value"];

interface SRRow {
    id: string;
    status: string;
    requested_at: string;
    dispatched_at: string | null;
    delivered_at: string | null;
    cylinder_size: string;
    quantity: number;
    total_amount: number;
}
interface RatingRow { stars: number; submitted_at: string; resolution_status?: string; resolved_at?: string | null; }
interface RedemptionRow { id: string; requested_at: string; }
interface SLAReport {
    report: {
        segments: {
            segment: string;
            evaluated_requests: number;
            compliant_requests: number;
            breached_requests: number;
            compliance_rate: number | null;
            average_minutes?: number | null;
        }[];
        daily_stock_check?: {
            distinct_days_checked: number;
            total_days_in_period: number;
            compliance_rate: number | 'no data';
        };
    }
}

export default function AnalyticsPage() {
    const [period, setPeriod] = useState("30 Days");
    const [chartCategory, setChartCategory] = useState<ChartCategory>("orders");
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => { setMounted(true); }, []);

    const days = parseInt(period, 10);
    const { fromStr, toStr, prevFromStr, prevToStr, ratingsFromISO, ratingsToISO } = useMemo(() => {
        const to = new Date();
        const from = new Date(to);
        from.setDate(to.getDate() - days);
        const prevTo = new Date(from);
        const prevFrom = new Date(prevTo);
        prevFrom.setDate(prevTo.getDate() - days);

        const fmt = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(d);

        // Build full Manila-day UTC boundaries for the ratings query.
        // Manila is UTC+8, so 00:00 Manila = T-8h UTC, 23:59:59.999 Manila = T-8h + 23:59:59.999 UTC.
        const manilaStartToUtcISO = (dateStr: string) => {
            // dateStr is YYYY-MM-DD in Manila. Start of that day in Manila is 00:00+08:00 = T-8h UTC.
            const [y, m, d] = dateStr.split('-').map(Number);
            return new Date(Date.UTC(y, m - 1, d) - 8 * 60 * 60 * 1000).toISOString();
        };
        const manilaEndToUtcISO = (dateStr: string) => {
            // End of day in Manila: 23:59:59.999+08:00 = T-8h + 86399999ms UTC.
            const [y, m, d] = dateStr.split('-').map(Number);
            return new Date(Date.UTC(y, m - 1, d) - 8 * 60 * 60 * 1000 + 86399999).toISOString();
        };

        const pf = fmt(prevFrom);
        const ts = fmt(to);
        return {
            fromStr: fmt(from),
            toStr: ts,
            prevFromStr: pf,
            prevToStr: fmt(prevTo),
            ratingsFromISO: manilaStartToUtcISO(pf),
            ratingsToISO: manilaEndToUtcISO(ts),
        };
    }, [days]);

    const queryParams = new URLSearchParams({ from: fromStr, to: toStr }).toString();

    const { data: requestsData, isLoading: reqLoading } = useQuery({
        queryKey: ['service-requests'],
        queryFn: () => fetchJson<{ serviceRequests: SRRow[] }>('/service-requests'),
    });
    const { data: ratingsData, isLoading: ratingsLoading } = useQuery({
        queryKey: ['csat-ratings-all', ratingsFromISO, ratingsToISO],
        queryFn: () => fetchJson<{ ratings: RatingRow[] }>(`/csat/ratings?resolution=all&from=${encodeURIComponent(ratingsFromISO)}&to=${encodeURIComponent(ratingsToISO)}`),
    });
    const { data: redemptionsData, isLoading: redemptionsLoading } = useQuery({
        queryKey: ['redemptions'],
        queryFn: () => fetchJson<{ redemptions: RedemptionRow[] }>('/loyalty/redemptions?status=all'),
    });
    const { data: slaData, isLoading: slaLoading, error: slaError } = useQuery({
        queryKey: ['sla-report', queryParams],
        queryFn: () => fetchJson<SLAReport>(`/service-requests/reports/sla?${queryParams}`),
    });

    const requests = requestsData?.serviceRequests || [];
    const ratings = ratingsData?.ratings || [];
    const redemptions = redemptionsData?.redemptions || [];

    const phDateKey = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(iso));

    const { currentMetrics, previousMetrics, chartData, productData } = useMemo(() => {
        const inRange = (iso: string, start: string, end: string) => {
            const k = phDateKey(iso);
            return k >= start && k <= end;
        };

        const curReq = requests.filter(r => inRange(r.requested_at, fromStr, toStr));
        const prevReq = requests.filter(r => inRange(r.requested_at, prevFromStr, prevToStr));

        const curRatings = ratings.filter(r => inRange(r.submitted_at, fromStr, toStr));
        const prevRatings = ratings.filter(r => inRange(r.submitted_at, prevFromStr, prevToStr));

        const curRedemptions = redemptions.filter(r => inRange(r.requested_at, fromStr, toStr));
        const prevRedemptions = redemptions.filter(r => inRange(r.requested_at, prevFromStr, prevToStr));

        const calcMetrics = (reqs: SRRow[], rats: RatingRow[], reds: RedemptionRow[]) => {
            const totalOrders = reqs.length;
            const revenue = reqs.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0);
            const eligible = reqs.filter(r => r.status !== 'Cancelled' && r.status !== 'Under Review');
            const completed = eligible.filter(r => r.status === 'Delivered');
            const completionRate = eligible.length ? (completed.length / eligible.length) * 100 : 0;
            const avgCsat = rats.length ? rats.reduce((sum, r) => sum + r.stars, 0) / rats.length : 0;
            return { totalOrders, revenue, completionRate, avgCsat, redemptions: reds.length };
        };

        const cur = calcMetrics(curReq, curRatings, curRedemptions);
        const prev = calcMetrics(prevReq, prevRatings, prevRedemptions);

        // Chart Data
        const dates: string[] = [];
        const now = new Date(toStr);
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            dates.push(phDateKey(d.toISOString()));
        }

        const byDate = new Map();
        for (const d of dates) {
            byDate.set(d, {
                date: new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                fullDate: new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                orders: 0,
                csatSum: 0,
                csatCount: 0,
                onTime: 0,
                late: 0,
            });
        }

        for (const r of curReq) {
            const reqK = phDateKey(r.requested_at);
            const reqEntry = byDate.get(reqK);
            if (reqEntry) {
                reqEntry.orders += 1;
            }

            if (r.status === 'Delivered' && r.dispatched_at && r.delivered_at) {
                const delK = phDateKey(r.delivered_at);
                const delEntry = byDate.get(delK);
                if (delEntry) {
                    const mins = (new Date(r.delivered_at).getTime() - new Date(r.dispatched_at).getTime()) / 60000;
                    // Note: 45 mirrors the backend default SLA threshold for dispatch_to_delivery
                    if (mins <= 45) {
                        delEntry.onTime += 1;
                    } else {
                        delEntry.late += 1;
                    }
                }
            }
        }
        for (const r of curRatings) {
            const k = phDateKey(r.submitted_at);
            const entry = byDate.get(k);
            if (entry) { entry.csatSum += r.stars; entry.csatCount += 1; }
        }

        const chart = dates.map(d => {
            const e = byDate.get(d);
            return {
                ...e,
                csat: e.csatCount ? Number((e.csatSum / e.csatCount).toFixed(1)) : null
            };
        });

        const prodMap = new Map();
        for (const r of curReq) {
            prodMap.set(r.cylinder_size, (prodMap.get(r.cylinder_size) || 0) + r.quantity);
        }
        const colors = ['var(--primary)', '#0ea5e9', '#f59e0b', '#10b981', '#8b5cf6'];
        const prodArr = Array.from(prodMap.entries()).map(([name, value], i) => ({
            name, value, fill: colors[i % colors.length]
        }));

        return { currentMetrics: cur, previousMetrics: prev, chartData: chart, productData: prodArr };
    }, [requests, ratings, redemptions, fromStr, toStr, prevFromStr, prevToStr, days]);

    const formatTrend = (cur: number, prev: number, isPercent = false): { direction: 'up' | 'down' | 'neutral'; text: string; positive: boolean; neutral?: boolean } => {
        // Round to the display precision before comparing so 0.001 doesn't show as +0
        const decimals = isPercent ? 1 : 1;
        const round = (n: number) => parseFloat(n.toFixed(decimals));
        const rCur = round(cur);
        const rPrev = round(prev);
        const diff = rCur - rPrev;

        // Both periods empty
        if (rCur === 0 && rPrev === 0) return { direction: 'neutral', text: 'from last period', positive: false, neutral: true };
        // Previous period had no data but current does — avoid misleading %
        if (rPrev === 0 && rCur > 0) return { direction: 'neutral', text: 'New this period', positive: false, neutral: true };
        // Exactly zero change after rounding
        if (diff === 0) return { direction: 'neutral', text: 'No change from last period', positive: false, neutral: true };

        const dir: 'up' | 'down' = diff > 0 ? 'up' : 'down';
        const val = Math.abs(diff);
        const text = isPercent
            ? `${diff > 0 ? '+' : '-'}${val.toFixed(1)}% from last period`
            : `${diff > 0 ? '+' : '-'}${val % 1 === 0 ? val : val.toFixed(1)} from last period`;
        return { direction: dir, text, positive: diff > 0 };
    };

    const formatDuration = (mins: number) => {
        if (mins < 60) return `${mins.toFixed(1)} min`;
        if (mins < 1440) {
            const h = Math.floor(mins / 60);
            const m = Math.floor(mins % 60);
            return `${h}h ${m}m`;
        }
        const d = Math.floor(mins / 1440);
        const h = Math.floor((mins % 1440) / 60);
        return `${d}d ${h}h`;
    };

    const getSlaRow = (segmentName: string, label: string, targetStr: string) => {
        if (!slaData) return { metric: label, target: targetStr, actualMain: "Not available yet", status: "N/A" };
        const seg = slaData.report.segments.find((s: any) => s.segment === segmentName);
        if (!seg || seg.evaluated_requests === 0) {
            return { metric: label, target: targetStr, actualMain: "No data for this period", status: "N/A" };
        }
        const rate = seg.compliance_rate ?? 0;
        const avg = seg.average_minutes;
        return {
            metric: label,
            target: targetStr,
            actualMain: avg != null ? formatDuration(avg) : `${rate.toFixed(1)}%`,
            actualSub: avg != null ? `${rate.toFixed(0)}% met` : undefined,
            status: rate >= 90 ? "Met" : "Breached"
        };
    };

    const getComplaintResponseSla = () => {
        const curRatings = ratings.filter(r => r.submitted_at && phDateKey(r.submitted_at) >= fromStr && phDateKey(r.submitted_at) <= toStr);
        // The backend does not expose a Complaint SLA API, so we define a complaint here as stars <= 3 (matching backend's definition for the BM queue)
        const complaints = curRatings.filter(r => r.stars <= 3);
        if (complaints.length === 0) return { metric: "Complaint Response", target: "≤2 hours", actualMain: "No data for this period", status: "N/A" };
        
        let evaluated = 0;
        let breached = 0;
        let totalMinutes = 0;
        
        for (const c of complaints) {
            if (c.resolution_status === 'Resolved' && c.resolved_at) {
                evaluated++;
                const mins = (new Date(c.resolved_at).getTime() - new Date(c.submitted_at).getTime()) / 60000;
                totalMinutes += mins;
                if (mins > 120) breached++;
            }
        }
        
        if (evaluated === 0) {
            return { metric: "Complaint Response", target: "≤2 hours", actualMain: "Not available yet", status: "N/A" };
        }
        
        const rate = ((evaluated - breached) / evaluated) * 100;
        const avgMins = totalMinutes / evaluated;
        
        return {
            metric: "Complaint Response",
            target: "≤2 hours",
            actualMain: formatDuration(avgMins),
            actualSub: `${rate.toFixed(0)}% met`,
            status: rate >= 90 ? "Met" : "Breached"
        };
    };

    const getDailyStockCheckSla = () => {
        if (!slaData || !slaData.report.daily_stock_check) return { metric: "Daily Stock Check", target: "100%", actualMain: "Not available yet", status: "N/A" };
        const dsc = slaData.report.daily_stock_check;
        if (dsc.compliance_rate === 'no data') {
            return { metric: "Daily Stock Check", target: "100%", actualMain: "No data for this period", status: "N/A" };
        }
        return {
            metric: "Daily Stock Check",
            target: "100%",
            actualMain: `${Number(dsc.compliance_rate).toFixed(1)}%`,
            actualSub: "days confirmed",
            status: Number(dsc.compliance_rate) >= 100 ? "Met" : "Breached"
        };
    };

    const slaTable = [
        getSlaRow('request_to_dispatch', 'Order-to-Dispatch', '≤15 min'),
        getSlaRow('dispatch_to_delivery', 'Dispatch-to-Delivery', '≤45 min'),
        getComplaintResponseSla(),
        getDailyStockCheckSla(),
    ];

    const xAxisTicks = useMemo(() => {
        if (!chartData || chartData.length === 0) return [];
        const ticks: string[] = [];
        const step = days === 7 ? 1 : days === 30 ? 5 : 14;
        for (let i = 0; i < chartData.length; i += step) {
            ticks.push(chartData[i].date);
        }
        return ticks;
    }, [chartData, days]);

    const hasChartData = useMemo(() => {
        if (chartCategory === "orders") return currentMetrics.totalOrders > 0;
        if (chartCategory === "delivery") return currentMetrics.totalOrders > 0;
        if (chartCategory === "csat") return chartData.some(d => d.csat !== null);
        if (chartCategory === "products") return productData.length > 0;
        return false;
    }, [chartCategory, currentMetrics, chartData, productData]);

    if (!mounted) {
        return <div style={{ minHeight: "100vh", backgroundColor: "var(--background)" }} />;
    }

    const isLoading = reqLoading || ratingsLoading || redemptionsLoading || slaLoading;

    const renderCustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            if (chartCategory === "products") {
                const data = payload[0].payload;
                return (
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-sm text-gray-700 flex gap-2 items-center">
                        <span className="font-medium text-gray-900">{data.name}</span>
                        <span className="text-gray-400">·</span>
                        <span className="font-medium text-gray-900">{data.value} ordered</span>
                    </div>
                );
            }
            const data = payload[0].payload;
            let valText = "";
            if (chartCategory === "orders") valText = `${payload[0].value} orders`;
            else if (chartCategory === "csat") valText = `${payload[0].value} avg rating`;
            else if (chartCategory === "delivery") valText = `${data.onTime} on time, ${data.late} late`;
            
            return (
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-sm text-gray-700 flex gap-2 items-center">
                    <span className="font-medium text-gray-900">{data.fullDate}</span>
                    <span className="text-gray-400">·</span>
                    <span className="font-medium text-gray-900">{valText}</span>
                </div>
            );
        }
        return null;
    };

    return (
        <div className={styles.container}>
            <header className={styles.header} style={{ justifyContent: 'flex-end' }}>
                <div className={styles.headerActions}>
                    <div className={styles.periodSelect}>
                        <Select value={period} onValueChange={setPeriod}>
                            <SelectTrigger><SelectValue placeholder="Select period" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="7 Days">Last 7 days</SelectItem>
                                <SelectItem value="30 Days">Last 30 days</SelectItem>
                                <SelectItem value="90 Days">Last 90 days</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </header>

            {isLoading ? (
                <div className="flex items-center justify-center h-64 text-gray-500">
                    <Loader2 className="w-8 h-8 animate-spin" />
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <KPICard
                            title="Total Orders This Period"
                            value={Intl.NumberFormat("en-PH").format(currentMetrics.totalOrders)}
                            subtitle={`Est. Revenue: ₱${Intl.NumberFormat("en-PH").format(currentMetrics.revenue)}`}
                            icon={<ShoppingCart className="w-4 h-4 text-[#007BC1]" />}
                            accentColor="#007BC1"
                            trend={formatTrend(currentMetrics.totalOrders, previousMetrics.totalOrders)}
                        />
                        <KPICard
                            title="Delivery Completion Rate"
                            value={`${currentMetrics.completionRate.toFixed(1)}%`}
                            subtitle={`Vs ${previousMetrics.completionRate.toFixed(1)}% previous period`}
                            icon={<Truck className="w-4 h-4 text-[#16A34A]" />}
                            accentColor="#16A34A"
                            trend={formatTrend(currentMetrics.completionRate, previousMetrics.completionRate, true)}
                        />
                        <KPICard
                            title="Average CSAT Score"
                            value={currentMetrics.avgCsat ? currentMetrics.avgCsat.toFixed(1) : '—'}
                            subtitle="Target: 4.5"
                            icon={<Star className="w-4 h-4 text-[#f59e0b]" />}
                            accentColor="#f59e0b"
                            trend={formatTrend(currentMetrics.avgCsat, previousMetrics.avgCsat)}
                        />
                        <KPICard
                            title="Loyalty Redemptions"
                            value={String(currentMetrics.redemptions)}
                            subtitle="Rewards claimed"
                            icon={<Gift className="w-4 h-4 text-[#9333EA]" />}
                            accentColor="#9333EA"
                            trend={formatTrend(currentMetrics.redemptions, previousMetrics.redemptions)}
                        />
                    </div>

                    <div className={styles.card}>
                        <div className={`${styles.cardHeaderFlex} border-b border-gray-100 pb-0`}>
                            <h3 className={styles.cardTitle}>{CHART_TABS.find((t) => t.value === chartCategory)?.label}</h3>
                            <Tabs value={chartCategory} onValueChange={(v: string) => setChartCategory(v as ChartCategory)}>
                                <TabsList className="bg-gray-50/50 p-1 mb-2">
                                    {CHART_TABS.map((t) => (
                                        <TabsTrigger key={t.value} value={t.value} className="text-xs px-3 py-1 data-[state=active]:bg-white data-[state=active]:shadow-sm">{t.label}</TabsTrigger>
                                    ))}
                                </TabsList>
                            </Tabs>
                        </div>
                        <div className={styles.chartWrapperLarge}>
                            {!hasChartData ? (
                                <div className="flex items-center justify-center h-full text-sm text-gray-400">No data available for this period.</div>
                            ) : (
                                <>
                                    {chartCategory === "orders" && (
                                        <ChartContainer config={orderChartConfig}>
                                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="var(--color-orders)" stopOpacity={0.1} />
                                                        <stop offset="95%" stopColor="var(--color-orders)" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                                                <XAxis dataKey="date" ticks={xAxisTicks} tickLine={false} axisLine={false} tickMargin={10} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                                <ChartTooltip cursor={{ stroke: '#9ca3af', strokeWidth: 1, strokeDasharray: '4 4' }} content={renderCustomTooltip} />
                                                <Area type="monotone" dataKey="orders" stroke="var(--color-orders)" strokeWidth={2} fillOpacity={1} fill="url(#colorOrders)" activeDot={{ r: 4, strokeWidth: 0, fill: "var(--color-orders)" }} />
                                            </AreaChart>
                                        </ChartContainer>
                                    )}
                                    {chartCategory === "csat" && (
                                        <ChartContainer config={csatChartConfig}>
                                            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                                                <XAxis dataKey="date" ticks={xAxisTicks} tickLine={false} axisLine={false} tickMargin={10} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                                <YAxis domain={[3.0, 5.0]} tickLine={false} axisLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                                <ChartTooltip cursor={{ stroke: '#9ca3af', strokeWidth: 1, strokeDasharray: '4 4' }} content={renderCustomTooltip} />
                                                <ReferenceLine y={4} stroke="var(--accent)" strokeDasharray="3 3" label={{ position: 'top', value: 'Target (4.0)', fill: 'var(--accent)', fontSize: 12 }} />
                                                <Line type="monotone" dataKey="csat" stroke="var(--color-csat)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: "var(--color-csat)" }} />
                                            </LineChart>
                                        </ChartContainer>
                                    )}
                                    {chartCategory === "delivery" && (
                                        <ChartContainer config={deliveryChartConfig}>
                                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                                                <XAxis dataKey="date" ticks={xAxisTicks} tickLine={false} axisLine={false} tickMargin={10} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                                <ChartTooltip cursor={{ fill: 'transparent' }} content={renderCustomTooltip} />
                                                <ChartLegend content={<ChartLegendContent />} />
                                                <Bar dataKey="onTime" stackId="a" fill="var(--color-onTime)" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ChartContainer>
                                    )}
                                    {chartCategory === "products" && (
                                        <ChartContainer config={productChartConfig}>
                                            <PieChart>
                                                <Pie data={productData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                                                    {productData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                                    ))}
                                                </Pie>
                                                <ChartTooltip content={renderCustomTooltip} />
                                                <ChartLegend content={<ChartLegendContent />} />
                                            </PieChart>
                                        </ChartContainer>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h3 className={styles.cardTitle}>SLA Compliance</h3>
                        </div>
                        {slaError ? (
                            <div className="p-6 text-red-500">Failed to load SLA data.</div>
                        ) : (
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead><tr><th>Metric Name</th><th>Target</th><th>Actual (avg)</th><th>Status</th></tr></thead>
                                    <tbody>
                                        {slaTable.map((row, i) => (
                                            <tr key={i}>
                                                <td><div className={styles.cellMetric}>{row.metric === "Daily Stock Check" || row.metric === "Complaint Response" ? <AlertCircle size={16} /> : <Target size={16} />}{row.metric}</div></td>
                                                <td>{row.target}</td>
                                                <td className={styles.cellActual}>
                                                    {row.actualSub ? (
                                                        <>
                                                            <div className={styles.cellStrong}>{row.actualMain}</div>
                                                            <div className={styles.cardSubtitle}>{row.actualSub}</div>
                                                        </>
                                                    ) : (
                                                        <span className={styles.cellStrong}>{row.actualMain}</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {row.status === "N/A" ? (
                                                        <span className="text-gray-400 text-sm">–</span>
                                                    ) : (
                                                        <Badge variant={row.status === "Met" ? "success" : "destructive"}>{row.status}</Badge>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
