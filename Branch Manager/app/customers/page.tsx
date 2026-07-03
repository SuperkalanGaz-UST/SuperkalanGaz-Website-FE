'use client';

import React, { useState } from 'react';
import { Star, Gift, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/Badge';
import { Progress } from '@/components/Progress';
import styles from './page.module.css';

const MOCK_CUSTOMERS = [
    { id: "C-001", name: "Maria Santos", phone: "0917-123-4567", address: "123 Mabini St, Makati", purchases: 32, csat: 4.8, lastOrder: "2023-10-24" },
    { id: "C-002", name: "Kainan ni Aling Nena", phone: "0918-987-6543", address: "45 Rizal Ave, Makati", purchases: 145, csat: 4.9, lastOrder: "2023-10-25" },
    { id: "C-003", name: "Pedro Penduko", phone: "0919-555-1122", address: "88 Luna St, Makati", purchases: 12, csat: 4.2, lastOrder: "2023-10-25" },
    { id: "C-004", name: "Lola Basyang", phone: "0920-444-3333", address: "7C Bonifacio St, Makati", purchases: 28, csat: 5.0, lastOrder: "2023-10-20" },
    { id: "C-005", name: "Juan Dela Cruz", phone: "0921-222-1111", address: "101 Burgos St, Makati", purchases: 5, csat: 3.5, lastOrder: "2023-10-15" },
];

const formatDate = (d: string) =>
    new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d));

export default function Customers() {
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const [expandedId, setExpandedId] = useState<string | null>(null);
    const toggleRow = (id: string) => setExpandedId(prev => prev === id ? null : id);

    if (!mounted) {
        return <div style={{ minHeight: "100vh", backgroundColor: "var(--background)" }} />;
    }

    return (
        <>
            <div>
                <h1 className={styles.pageTitle}>Customers &amp; Loyalty</h1>
                <p className={styles.pageSubtitle}>Manage customer relationships, track loyalty progress, and review satisfaction scores.</p>
            </div>
            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}><div className={styles.summaryLabel}>Total Customers</div><div className={styles.summaryValue}>1,248</div></div>
                <div className={styles.summaryCard}><div className={styles.summaryLabel}>Avg CSAT</div><div className={styles.summaryValueWithIcon}>4.6 <Star size={24} className={styles.starIcon} fill="currentColor" strokeWidth={0} /></div></div>
                <div className={`${styles.summaryCard} ${styles.summaryAccent}`}><div className={styles.summaryLabel}>Loyalty Redemptions This Month</div><div className={styles.summaryValue}>42</div></div>
            </div>
            <div className={styles.card}>
                <div className={styles.cardHeader}><h2 className={styles.cardTitle}>Customer Directory</h2></div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th className={styles.iconCell}></th>
                                <th>Name</th><th>Phone</th><th>Address</th>
                                <th>Total Purchases</th><th>Loyalty Progress</th>
                                <th>CSAT Avg</th><th>Last Order</th>
                            </tr>
                        </thead>
                        <tbody>
                            {MOCK_CUSTOMERS.map(customer => {
                                const isExpanded = expandedId === customer.id;
                                const progressPct = Math.min((customer.purchases % 30) / 30 * 100, 100);
                                const isEligible = customer.purchases >= 30;
                                return (
                                    <React.Fragment key={customer.id}>
                                        <tr className={`${styles.clickableRow} ${isExpanded ? styles.rowExpanded : ''}`} onClick={() => toggleRow(customer.id)}>
                                            <td className={styles.iconCell}>{isExpanded ? <ChevronDown size={18} className={styles.expandIcon} /> : <ChevronRight size={18} className={styles.expandIcon} />}</td>
                                            <td className={styles.boldText}>{customer.name}</td>
                                            <td>{customer.phone}</td>
                                            <td className={styles.mutedText}>{customer.address}</td>
                                            <td className={styles.boldText}>{customer.purchases}</td>
                                            <td className={styles.progressCell}>
                                                <div className={styles.progressHeader}>
                                                    <span className={styles.progressText}>{customer.purchases % 30} / 30</span>
                                                    {isEligible && <Badge variant="success" className={styles.rewardBadge}><Gift size={14} /> Reward Eligible</Badge>}
                                                </div>
                                                <Progress value={progressPct} />
                                            </td>
                                            <td><div className={styles.csatBadge}>{customer.csat.toFixed(1)} <Star size={14} fill="currentColor" strokeWidth={0} /></div></td>
                                            <td>{formatDate(customer.lastOrder)}</td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className={styles.expandedRow}>
                                                <td colSpan={8} className={styles.expandedCell}>
                                                    <div className={styles.expandedContent}>
                                                        <div className={styles.expandedGrid}>
                                                            <div className={styles.expandedPanel}>
                                                                <h4 className={styles.expandedTitle}>Recent Orders</h4>
                                                                <ul className={styles.orderList}>
                                                                    <li><span className={styles.orderDate}>{formatDate(customer.lastOrder)}</span> — 2x 11kg LPG (Delivered)</li>
                                                                    <li><span className={styles.orderDate}>Sep 15, 2023</span> — 1x 11kg LPG (Delivered)</li>
                                                                    <li><span className={styles.orderDate}>Aug 02, 2023</span> — 2x 11kg LPG (Delivered)</li>
                                                                </ul>
                                                            </div>
                                                            <div className={styles.expandedPanel}>
                                                                <h4 className={styles.expandedTitle}>Buy-Day Pattern</h4>
                                                                <p className={styles.expandedText}>Typically orders on <strong>Fridays</strong> (65% of orders).</p>
                                                                <p className={styles.expandedText}>Average gap: <strong>14 days</strong>.</p>
                                                            </div>
                                                            <div className={styles.expandedPanel}>
                                                                <h4 className={styles.expandedTitle}>CSAT Ratings History</h4>
                                                                <p className={styles.expandedText}>Average: <strong>{customer.csat.toFixed(1)} / 5.0</strong></p>
                                                                <p className={styles.expandedText}>Last rating: <strong>5.0</strong> (&quot;Mabilis ang delivery!&quot;)</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
