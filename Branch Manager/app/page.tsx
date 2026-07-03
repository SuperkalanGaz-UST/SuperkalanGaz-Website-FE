'use client';

import React from 'react';
import { Flame, Star } from 'lucide-react';
import { Badge } from '@/components/Badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/Chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import styles from './page.module.css';

const MOCK_RECENT_ORDERS = [
    { id: "ORD-1047", customer: "Maria Santos", items: "2x 11kg LPG", status: "Delivered", rider: "J. Reyes", time: "10:15 AM" },
    { id: "ORD-1048", customer: "Kainan ni Aling Nena", items: "1x 50kg LPG", status: "In Transit", rider: "R. Cruz", time: "10:30 AM" },
    { id: "ORD-1049", customer: "Pedro Penduko", items: "1x 11kg LPG", status: "Pending", rider: "Unassigned", time: "11:05 AM" },
    { id: "ORD-1050", customer: "Lola Basyang", items: "3x 22kg LPG", status: "In Transit", rider: "A. Santos", time: "11:20 AM" },
    { id: "ORD-1051", customer: "Juan Dela Cruz", items: "1x 11kg LPG", status: "Delivered", rider: "M. Torres", time: "11:45 AM" },
    { id: "ORD-1052", customer: "Mang Inasal Brgy", items: "5x 50kg LPG", status: "Pending", rider: "Unassigned", time: "12:10 PM" },
];

const MOCK_ALERTS = [
    { id: 1, item: "11kg LPG Tank", remaining: 15, threshold: 20 },
    { id: 2, item: "50kg LPG Tank", remaining: 2, threshold: 5 },
];

const CSAT_DATA = [
    { rating: "1★", count: 2 },
    { rating: "2★", count: 5 },
    { rating: "3★", count: 12 },
    { rating: "4★", count: 34 },
    { rating: "5★", count: 85 },
];

const chartConfig = {
    count: { label: "Reviews", color: "var(--primary)" }
};

const getStatusVariant = (status: string) => {
    switch (status) {
        case 'Delivered': return 'success' as const;
        case 'In Transit': return 'primary' as const;
        case 'Pending': return 'warning' as const;
        default: return 'secondary' as const;
    }
};

export default function Dashboard() {
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div style={{ minHeight: "100vh", backgroundColor: "var(--background)" }} />;
    }

    return (
        <>
            <div>
                <h1 className={styles.pageTitle}>Overview</h1>
                <p className={styles.pageSubtitle}>Monitor today's operations and key metrics.</p>
            </div>

            <div className={styles.kpiGrid}>
                <div className={styles.kpiCard}>
                    <h3 className={styles.kpiTitle}>Total Orders Today</h3>
                    <div className={styles.kpiValue}>47</div>
                </div>
                <div className={styles.kpiCard}>
                    <h3 className={styles.kpiTitle}>Active Deliveries</h3>
                    <div className={styles.kpiValue}>12</div>
                </div>
                <div className={`${styles.kpiCard} ${styles.kpiAccent}`}>
                    <h3 className={styles.kpiTitle}>Low Stock Alerts</h3>
                    <div className={styles.kpiValue}>3</div>
                </div>
                <div className={styles.kpiCard}>
                    <h3 className={styles.kpiTitle}>Avg CSAT</h3>
                    <div className={styles.kpiValueWithIcon}>
                        4.3 <Star size={24} className={styles.starIcon} fill="currentColor" strokeWidth={0} />
                    </div>
                </div>
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
                                    {MOCK_RECENT_ORDERS.map(order => (
                                        <tr key={order.id}>
                                            <td className={styles.monoText}>{order.id}</td>
                                            <td className={styles.boldText}>{order.customer}</td>
                                            <td>{order.items}</td>
                                            <td>
                                                <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge>
                                            </td>
                                            <td>{order.rider}</td>
                                            <td className={styles.mutedText}>{order.time}</td>
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
                            {MOCK_ALERTS.map(alert => (
                                <div key={alert.id} className={styles.alertItem}>
                                    <Flame className={styles.alertIcon} size={20} />
                                    <div className={styles.alertText}>
                                        <strong>{alert.item}</strong>
                                        <br />
                                        {alert.remaining} remaining (threshold: {alert.threshold})
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
                            <ChartContainer config={chartConfig}>
                                <BarChart data={CSAT_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="rating" axisLine={false} tickLine={false} tickMargin={10} />
                                    <YAxis axisLine={false} tickLine={false} tickMargin={10} />
                                    <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
                                    <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                </BarChart>
                            </ChartContainer>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
