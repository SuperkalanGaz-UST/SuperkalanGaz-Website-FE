'use client';

import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Settings2, AlertCircle, Target } from "lucide-react";
import { z } from "zod";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, ReferenceLine, XAxis, YAxis, Cell } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/Select";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Form, FormControl, FormDescription, FormItem, FormLabel, FormMessage, useForm } from "@/components/Form";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/Chart";
import styles from "./page.module.css";

const generateTimeSeriesData = (days: number) => {
    const data = [];
    const now = new Date();
    for (let i = days; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        data.push({
            date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            orders: Math.floor(Math.random() * 40) + 20,
            csat: parseFloat((Math.random() * 0.8 + 4.1).toFixed(1)),
            onTime: Math.floor(Math.random() * 30) + 15,
            late: Math.floor(Math.random() * 5) + 1,
        });
    }
    return data;
};

const mockProductData = [
    { name: "11kg Cylinder", value: 60, fill: "var(--primary)" },
    { name: "22kg Cylinder", value: 30, fill: "#0ea5e9" },
    { name: "50kg Cylinder", value: 10, fill: "#f59e0b" },
];

const mockSlaData = [
    { metric: "Order-to-Dispatch", target: "≤15 min", actual: "12 min", status: "Met" },
    { metric: "Dispatch-to-Delivery", target: "≤45 min", actual: "38 min", status: "Met" },
    { metric: "Complaint Response", target: "≤2 hours", actual: "1.5 hours", status: "Met" },
    { metric: "Daily Stock Check", target: "100%", actual: "95%", status: "Breached" },
];

const settingsSchema = z.object({
    loyaltyThreshold: z.coerce.number().min(1, "Must be at least 1"),
    alert11kg: z.coerce.number().min(0, "Cannot be negative"),
    alert22kg: z.coerce.number().min(0, "Cannot be negative"),
    alert50kg: z.coerce.number().min(0, "Cannot be negative"),
    openTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format"),
    closeTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format"),
});

const orderChartConfig = { orders: { label: "Total Orders", color: "var(--primary)" } };
const csatChartConfig = { csat: { label: "Avg CSAT Score", color: "#f59e0b" } };
const deliveryChartConfig = { onTime: { label: "On-Time", color: "var(--primary)" }, late: { label: "Late", color: "#ef4444" } };
const productChartConfig = { value: { label: "Percentage", color: "var(--primary)" } };

export default function AnalyticsPage() {
    const [period, setPeriod] = useState("30 Days");
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const chartData = useMemo(() => {
        if (!mounted) return [];
        return generateTimeSeriesData(parseInt(period, 10));
    }, [period, mounted]);


    const form = useForm({
        schema: settingsSchema,
        defaultValues: { loyaltyThreshold: 30, alert11kg: 20, alert22kg: 10, alert50kg: 5, openTime: "06:00", closeTime: "20:00" },
    });

    const onSaveSettings = (_values: z.infer<typeof settingsSchema>) => {
        toast.success("Branch settings updated successfully.");
    };

    const totalOrders = chartData.reduce((acc, curr) => acc + curr.orders, 0);
    const revenueEst = totalOrders * 950;

    if (!mounted) {
        return <div style={{ minHeight: "100vh", backgroundColor: "var(--background)" }} />;
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerTitles}>
                    <h1 className={styles.pageTitle}>Branch Performance</h1>
                    <p className={styles.pageSubtitle}>Makati Branch — Owner Dashboard</p>
                </div>
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

            <div className={styles.kpiGrid}>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiHeader}><span className={styles.kpiLabel}>Total Orders This Period</span><span className={`${styles.kpiTrend} ${styles.trendUp}`}><TrendingUp size={16} /> 12%</span></div>
                    <div className={styles.kpiValue}>{Intl.NumberFormat("en-PH").format(totalOrders)}</div>
                    <div className={styles.kpiSubtext}>Est. Revenue: ₱{Intl.NumberFormat("en-PH").format(revenueEst)}</div>
                </div>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiHeader}><span className={styles.kpiLabel}>Delivery Completion Rate</span><span className={`${styles.kpiTrend} ${styles.trendUp}`}><TrendingUp size={16} /> 2.1%</span></div>
                    <div className={styles.kpiValue}>96.8%</div>
                    <div className={styles.kpiSubtext}>Vs 94.7% previous period</div>
                </div>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiHeader}><span className={styles.kpiLabel}>Avg CSAT Score</span><span className={`${styles.kpiTrend} ${styles.trendDown}`}><TrendingDown size={16} /> 0.1</span></div>
                    <div className={styles.kpiValue}>4.3 <span className={styles.kpiValueSuffix}>/ 5.0</span></div>
                    <div className={styles.kpiSubtext}>Below target of 4.5</div>
                </div>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiHeader}><span className={styles.kpiLabel}>Loyalty Redemptions</span><span className={`${styles.kpiTrend} ${styles.trendUp}`}><TrendingUp size={16} /> 3</span></div>
                    <div className={styles.kpiValue}>8</div>
                    <div className={styles.kpiSubtext}>30th-order rewards claimed</div>
                </div>
            </div>

            <div className={styles.chartGrid}>
                <div className={styles.card}>
                    <h3 className={styles.cardTitle}>Order Volume Trend</h3>
                    <div className={styles.chartWrapper}>
                        <ChartContainer config={orderChartConfig}>
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--color-orders)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="var(--color-orders)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={10} minTickGap={20} />
                                <YAxis tickLine={false} axisLine={false} />
                                <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                                <Area type="monotone" dataKey="orders" stroke="var(--color-orders)" strokeWidth={3} fillOpacity={1} fill="url(#colorOrders)" />
                            </AreaChart>
                        </ChartContainer>
                    </div>
                </div>
                <div className={styles.card}>
                    <h3 className={styles.cardTitle}>CSAT Score Trend</h3>
                    <div className={styles.chartWrapper}>
                        <ChartContainer config={csatChartConfig}>
                            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={10} minTickGap={20} />
                                <YAxis domain={[3.0, 5.0]} tickLine={false} axisLine={false} />
                                <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                                <ReferenceLine y={4} stroke="var(--accent)" strokeDasharray="3 3" label={{ position: 'top', value: 'Target (4.0)', fill: 'var(--accent)', fontSize: 12 }} />
                                <Line type="monotone" dataKey="csat" stroke="var(--color-csat)" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: "var(--color-csat)" }} />
                            </LineChart>
                        </ChartContainer>
                    </div>
                </div>
            </div>

            <div className={styles.chartGrid}>
                <div className={styles.card}>
                    <h3 className={styles.cardTitle}>Delivery Performance</h3>
                    <div className={styles.chartWrapper}>
                        <ChartContainer config={deliveryChartConfig}>
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={10} minTickGap={20} />
                                <YAxis tickLine={false} axisLine={false} />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Bar dataKey="onTime" stackId="a" fill="var(--color-onTime)" radius={[0, 0, 4, 4]} />
                                <Bar dataKey="late" stackId="a" fill="var(--color-late)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ChartContainer>
                    </div>
                </div>
                <div className={styles.card}>
                    <h3 className={styles.cardTitle}>Orders by Product Breakdown</h3>
                    <div className={styles.chartWrapper}>
                        <ChartContainer config={productChartConfig}>
                            <PieChart>
                                <Pie data={mockProductData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                                    {mockProductData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <ChartTooltip content={({ active, payload }: { active?: boolean; payload?: any[] }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                            <div className={styles.customPieTooltip}>
                                                <span className={styles.pieTooltipName}>{data.name}</span>
                                                <span className={styles.pieTooltipValue}>{data.value}%</span>
                                            </div>
                                        );
                                    }
                                    return null;
                                }} />
                                <ChartLegend content={<ChartLegendContent />} />
                            </PieChart>
                        </ChartContainer>
                    </div>
                </div>
            </div>

            <div className={styles.bottomGrid}>
                <div className={styles.card}>
                    <div className={styles.cardHeader}><h3 className={styles.cardTitle}>SLA Compliance</h3><p className={styles.cardSubtitle}>Service Level Agreements for {period} days</p></div>
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead><tr><th>Metric Name</th><th>Target</th><th>Actual</th><th>Status</th></tr></thead>
                            <tbody>
                                {mockSlaData.map((row, i) => (
                                    <tr key={i}>
                                        <td className={styles.cellMetric}>{row.metric === "Daily Stock Check" ? <AlertCircle size={16} /> : <Target size={16} />}{row.metric}</td>
                                        <td>{row.target}</td>
                                        <td className={styles.cellStrong}>{row.actual}</td>
                                        <td><Badge variant={row.status === "Met" ? "success" : "destructive"}>{row.status}</Badge></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardHeader}><h3 className={styles.cardTitle}>Branch Configuration</h3><p className={styles.cardSubtitle}>Operating parameters for Makati Branch</p></div>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSaveSettings)} className={styles.settingsForm}>
                            <div className={styles.formSection}>
                                <h4 className={styles.formSectionTitle}>Loyalty &amp; Rewards</h4>
                                <FormItem name="loyaltyThreshold">
                                    <FormLabel>Reward Threshold (Orders)</FormLabel>
                                    <FormControl><Input type="number" value={form.values.loyaltyThreshold} onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setValues((prev: any) => ({ ...prev, loyaltyThreshold: Number(e.target.value) }))} /></FormControl>
                                    <FormDescription>Orders needed for a free refill.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            </div>
                            <div className={styles.formSection}>
                                <h4 className={styles.formSectionTitle}>Low-Stock Alerts</h4>
                                <div className={styles.formRow}>
                                    <FormItem name="alert11kg"><FormLabel>11kg Cylinders</FormLabel><FormControl><Input type="number" value={form.values.alert11kg} onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setValues((prev: any) => ({ ...prev, alert11kg: Number(e.target.value) }))} /></FormControl><FormMessage /></FormItem>
                                    <FormItem name="alert22kg"><FormLabel>22kg Cylinders</FormLabel><FormControl><Input type="number" value={form.values.alert22kg} onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setValues((prev: any) => ({ ...prev, alert22kg: Number(e.target.value) }))} /></FormControl><FormMessage /></FormItem>
                                    <FormItem name="alert50kg"><FormLabel>50kg Cylinders</FormLabel><FormControl><Input type="number" value={form.values.alert50kg} onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setValues((prev: any) => ({ ...prev, alert50kg: Number(e.target.value) }))} /></FormControl><FormMessage /></FormItem>
                                </div>
                            </div>
                            <div className={styles.formSection}>
                                <h4 className={styles.formSectionTitle}>Operating Hours</h4>
                                <div className={styles.formRow}>
                                    <FormItem name="openTime"><FormLabel>Opening Time</FormLabel><FormControl><Input placeholder="06:00" value={form.values.openTime} onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setValues((prev: any) => ({ ...prev, openTime: e.target.value }))} /></FormControl><FormMessage /></FormItem>
                                    <FormItem name="closeTime"><FormLabel>Closing Time</FormLabel><FormControl><Input placeholder="20:00" value={form.values.closeTime} onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setValues((prev: any) => ({ ...prev, closeTime: e.target.value }))} /></FormControl><FormMessage /></FormItem>
                                </div>
                            </div>
                            <div className={styles.formActions}><Button type="submit" variant="accent"><Settings2 size={16} /> Save Settings</Button></div>
                        </form>
                    </Form>
                </div>
            </div>
        </div>
    );
}
