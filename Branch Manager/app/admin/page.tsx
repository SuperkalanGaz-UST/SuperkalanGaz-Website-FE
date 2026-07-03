'use client';

import React from "react";
import { Building2, ShoppingCart, Star, Users, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ReferenceLine } from "recharts";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Form, FormItem, FormLabel, FormControl, FormDescription, FormMessage, useForm } from "@/components/Form";
import { Input } from "@/components/Input";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/Chart";
import styles from "./page.module.css";

const MOCK_KPIS = { totalBranches: 5, ordersToday: 187, avgCsat: 4.2, activeRiders: 18, pendingApprovals: 2 };

const MOCK_BRANCHES = [
    { id: "br_01", name: "Makati", status: "Active", ordersToday: 85, ordersWeekly: 412, csat: 4.6, completionRate: 98, stockHealth: "Healthy", fleetActive: 6, fleetTotal: 6 },
    { id: "br_02", name: "Quezon City", status: "Active", ordersToday: 62, ordersWeekly: 305, csat: 4.1, completionRate: 94, stockHealth: "Low", fleetActive: 5, fleetTotal: 6 },
    { id: "br_03", name: "Taguig", status: "Active", ordersToday: 40, ordersWeekly: 189, csat: 3.8, completionRate: 88, stockHealth: "Critical", fleetActive: 4, fleetTotal: 5 },
    { id: "br_04", name: "Pasig", status: "Pending Approval", ordersToday: 0, ordersWeekly: 0, csat: 0, completionRate: 0, stockHealth: "Pending", fleetActive: 0, fleetTotal: 0 },
    { id: "br_05", name: "Mandaluyong", status: "Pending Approval", ordersToday: 0, ordersWeekly: 0, csat: 0, completionRate: 0, stockHealth: "Pending", fleetActive: 0, fleetTotal: 0 },
];

const MOCK_CHART_CSAT = [{ name: "Makati", csat: 4.6 }, { name: "Quezon City", csat: 4.1 }, { name: "Taguig", csat: 3.8 }];
const MOCK_CHART_VOLUME = [{ name: "Makati", volume: 412 }, { name: "Quezon City", volume: 305 }, { name: "Taguig", volume: 189 }];

const MOCK_ACTIVITY_LOG = [
    { id: 1, time: "10:45 AM", branch: "Makati", event: "Stock alert: 11kg LPG below threshold", severity: "warning" },
    { id: 2, time: "09:30 AM", branch: "Quezon City", event: "New branch registration submitted", severity: "info" },
    { id: 3, time: "08:15 AM", branch: "Taguig", event: "Rider Carlo Bautista exited geofence", severity: "destructive" },
    { id: 4, time: "Yesterday", branch: "Pasig", event: "Pending approval since Jan 15, 2026", severity: "info" },
    { id: 5, time: "Yesterday", branch: "Mandaluyong", event: "Pending approval since Jan 15, 2026", severity: "info" },
    { id: 6, time: "Yesterday", branch: "Makati", event: "Daily reconciliation completed", severity: "success" },
    { id: 7, time: "2 days ago", branch: "Taguig", event: "Customer complaint received (Delay)", severity: "warning" },
    { id: 8, time: "2 days ago", branch: "Quezon City", event: "Reorder fulfilled (50 units)", severity: "success" },
] as const;

const csatChartConfig = { csat: { label: "Avg CSAT Score", color: "var(--primary)" } };
const volumeChartConfig = { volume: { label: "Weekly Orders", color: "var(--chart-color-4)" } };

const slaSchema = z.object({
    maxOrderToDispatch: z.coerce.number().min(1, "Must be at least 1 minute"),
    maxDispatchToDelivery: z.coerce.number().min(1, "Must be at least 1 minute"),
    maxComplaintResponse: z.coerce.number().min(1, "Must be at least 1 hour"),
    minCsatTarget: z.coerce.number().min(1).max(5, "Max CSAT is 5.0"),
});

function getCsatColor(score: number) {
    if (score === 0) return "var(--muted-foreground)";
    if (score >= 4.0) return "var(--success)";
    if (score >= 3.5) return "var(--warning)";
    return "var(--error)";
}

function getStockBadgeVariant(health: string) {
    switch (health) {
        case "Healthy": return "success" as const;
        case "Low": return "warning" as const;
        case "Critical": return "destructive" as const;
        case "Pending": return "outline" as const;
        default: return "secondary" as const;
    }
}

export default function AdminDashboard() {
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const form = useForm({
        defaultValues: { maxOrderToDispatch: 15, maxDispatchToDelivery: 45, maxComplaintResponse: 2, minCsatTarget: 4.0 },
        schema: slaSchema,
    });

    if (!mounted) {
        return <div style={{ minHeight: "100vh", backgroundColor: "var(--background)" }} />;
    }

    const onSubmitSla = (_values: z.infer<typeof slaSchema>) => {
        toast.success("System-Wide SLA Configured", { description: "Changes have been broadcasted to all active branches." });
    };

    const handleApprove = (branchName: string) => toast.success(`Branch Approved`, { description: `${branchName} branch has been activated.` });
    const handleReject = (branchName: string) => toast.error(`Branch Rejected`, { description: `${branchName} branch application declined.` });

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>System Administration</h1>
                <p className={styles.subtitle}>Main Office — Cross-Branch Overview</p>
            </header>

            <section className={styles.kpiGrid}>
                {[
                    { label: "Total Branches", value: MOCK_KPIS.totalBranches, icon: <Building2 size={20} /> },
                    { label: "Orders Today", value: MOCK_KPIS.ordersToday, icon: <ShoppingCart size={20} /> },
                    { label: "System Avg CSAT", value: MOCK_KPIS.avgCsat, icon: <Star size={20} />, color: getCsatColor(MOCK_KPIS.avgCsat) },
                    { label: "Active Riders", value: MOCK_KPIS.activeRiders, icon: <Users size={20} /> },
                    { label: "Pending Approvals", value: MOCK_KPIS.pendingApprovals, icon: <Clock size={20} /> },
                ].map((kpi, i) => (
                    <div key={i} className={styles.card}>
                        <div className={styles.kpiCard}>
                            <div className={styles.kpiHeader}><span className={styles.kpiLabel}>{kpi.label}</span>{kpi.icon}</div>
                            <div className={styles.kpiValue} style={kpi.color ? { color: kpi.color } : {}}>{kpi.value}</div>
                        </div>
                    </div>
                ))}
            </section>

            <section className={styles.card}>
                <div className={styles.sectionHeader}><h2 className={styles.sectionTitle}>Branch Performance Comparison</h2></div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th className={styles.th}>Branch Name</th><th className={styles.th}>Status</th>
                                <th className={styles.th}>Orders (Today / Wk)</th><th className={styles.th}>Avg CSAT</th>
                                <th className={styles.th}>Completion Rate</th><th className={styles.th}>Stock Health</th>
                                <th className={styles.th}>Fleet Status</th><th className={styles.th}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {MOCK_BRANCHES.map((branch) => (
                                <tr key={branch.id} className={styles.tr}>
                                    <td className={styles.td}><span className={styles.branchName}>{branch.name}</span></td>
                                    <td className={styles.td}><Badge variant={branch.status === "Active" ? "primary" : "outline"}>{branch.status}</Badge></td>
                                    <td className={styles.td}>
                                        {branch.status === "Active" ? (
                                            <div className={styles.metricsGroup}>
                                                <span className={styles.metricPrimary}>{branch.ordersToday} today</span>
                                                <span className={styles.metricSecondary}>{branch.ordersWeekly} this week</span>
                                            </div>
                                        ) : <span className={styles.metricSecondary}>—</span>}
                                    </td>
                                    <td className={styles.td}>
                                        {branch.status === "Active" ? (
                                            <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-2)" }}>
                                                <span style={{ fontWeight: 600 }}>{branch.csat.toFixed(1)}</span>
                                                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: getCsatColor(branch.csat) }} />
                                            </div>
                                        ) : <span className={styles.metricSecondary}>—</span>}
                                    </td>
                                    <td className={styles.td}>{branch.status === "Active" ? <span className={styles.metricPrimary}>{branch.completionRate}%</span> : <span className={styles.metricSecondary}>—</span>}</td>
                                    <td className={styles.td}><Badge variant={getStockBadgeVariant(branch.stockHealth)}>{branch.stockHealth}</Badge></td>
                                    <td className={styles.td}>{branch.status === "Active" ? <span className={styles.metricPrimary}>{branch.fleetActive}/{branch.fleetTotal} active</span> : <span className={styles.metricSecondary}>—</span>}</td>
                                    <td className={styles.td}>
                                        {branch.status === "Pending Approval" ? (
                                            <div className={styles.actionButtons}>
                                                <Button size="sm" variant="outline" onClick={() => handleApprove(branch.name)}><CheckCircle2 size={16} /> Approve</Button>
                                                <Button size="icon-sm" variant="ghost" onClick={() => handleReject(branch.name)} aria-label={`Reject ${branch.name}`} style={{ color: "var(--error)" }}><XCircle size={16} /></Button>
                                            </div>
                                        ) : <span className={styles.metricSecondary}>Operational</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className={styles.chartsGrid}>
                <div className={styles.card}>
                    <div className={styles.sectionHeader}><h2 className={styles.sectionTitle}>CSAT Scores by Branch</h2></div>
                    <div className={styles.chartContainer}>
                        <ChartContainer config={csatChartConfig}>
                            <BarChart data={MOCK_CHART_CSAT} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} />
                                <YAxis dataKey="name" type="category" width={80} />
                                <ChartTooltip cursor={{ fill: 'transparent' }} content={<ChartTooltipContent hideIndicator />} />
                                <ReferenceLine x={4.0} stroke="var(--error)" strokeDasharray="4 4" label={{ position: "top", value: "SLA Target (4.0)", fill: "var(--error)", fontSize: 12 }} />
                                <Bar dataKey="csat" fill="var(--color-csat)" radius={[0, 4, 4, 0]} barSize={32} />
                            </BarChart>
                        </ChartContainer>
                    </div>
                </div>
                <div className={styles.card}>
                    <div className={styles.sectionHeader}><h2 className={styles.sectionTitle}>Order Volume by Branch</h2></div>
                    <div className={styles.chartContainer}>
                        <ChartContainer config={volumeChartConfig}>
                            <BarChart data={MOCK_CHART_VOLUME} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <ChartTooltip cursor={{ fill: 'transparent' }} content={<ChartTooltipContent hideIndicator />} />
                                <Bar dataKey="volume" fill="var(--color-volume)" radius={[4, 4, 0, 0]} barSize={48} />
                            </BarChart>
                        </ChartContainer>
                    </div>
                </div>
            </section>

            <section className={styles.bottomGrid}>
                <div className={styles.card}>
                    <div className={styles.sectionHeader}><h2 className={styles.sectionTitle}>System-Wide SLA Thresholds</h2></div>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmitSla)} className={styles.formGrid}>
                            {[
                                { name: "maxOrderToDispatch", label: "Max Order-to-Dispatch (minutes)" },
                                { name: "maxDispatchToDelivery", label: "Max Dispatch-to-Delivery (minutes)" },
                                { name: "maxComplaintResponse", label: "Max Complaint Response (hours)" },
                                { name: "minCsatTarget", label: "Minimum CSAT Target (0.0 - 5.0)", step: "0.1" },
                            ].map((field) => (
                                <FormItem key={field.name} name={field.name}>
                                    <FormLabel>{field.label}</FormLabel>
                                    <FormControl>
                                        <Input type="number" step={field.step}
                                            value={(form.values as Record<string, number>)[field.name]}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => form.setValues((prev: any) => ({ ...prev, [field.name]: Number(e.target.value) }))} />
                                    </FormControl>
                                    {field.name === "minCsatTarget" && <FormDescription>Triggers alerts when branch average falls below target.</FormDescription>}
                                    <FormMessage />
                                </FormItem>
                            ))}
                            <Button type="submit" style={{ marginTop: "var(--spacing-2)" }}>Save Configurations</Button>
                        </form>
                    </Form>
                </div>

                <div className={styles.card}>
                    <div className={styles.sectionHeader}><h2 className={styles.sectionTitle}>Recent System Activity</h2></div>
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead><tr><th className={styles.th}>Time</th><th className={styles.th}>Branch</th><th className={styles.th}>Event</th><th className={styles.th}>Severity</th></tr></thead>
                            <tbody>
                                {MOCK_ACTIVITY_LOG.map((log) => (
                                    <tr key={log.id} className={styles.tr}>
                                        <td className={styles.td}><span className={styles.logTime}>{log.time}</span></td>
                                        <td className={styles.td}><span className={styles.logBranch}>{log.branch}</span></td>
                                        <td className={styles.td}><span className={styles.logEvent}>{log.event}</span></td>
                                        <td className={styles.td}><Badge variant={log.severity as "warning" | "info" | "destructive" | "success"}>{log.severity.charAt(0).toUpperCase() + log.severity.slice(1)}</Badge></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </div>
    );
}
