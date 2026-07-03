'use client';

import React, { useState } from 'react';
import * as z from 'zod';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Progress } from '@/components/Progress';
import { Form, FormItem, FormLabel, FormControl, FormMessage, useForm } from '@/components/Form';
import { Input } from '@/components/Input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/Select';
import styles from './page.module.css';

const MOCK_INVENTORY = [
    { id: "INV-1", product: "11kg LPG Tank", current: 45, threshold: 20, capacity: 100 },
    { id: "INV-2", product: "22kg LPG Tank", current: 18, threshold: 15, capacity: 50 },
    { id: "INV-3", product: "50kg LPG Tank", current: 4, threshold: 5, capacity: 20 },
    { id: "INV-4", product: "Valve Set", current: 15, threshold: 10, capacity: 50 },
];

const MOCK_REORDERS = [
    { id: "RO-001", date: "2023-10-25", product: "50kg LPG Tank", qty: 20, status: "Pending", requestedBy: "Branch Manager" },
    { id: "RO-002", date: "2023-10-24", product: "11kg LPG Tank", qty: 50, status: "Approved", requestedBy: "Branch Manager" },
    { id: "RO-003", date: "2023-10-20", product: "22kg LPG Tank", qty: 30, status: "Delivered", requestedBy: "System Admin" },
    { id: "RO-005", date: "2023-10-15", product: "Valve Set", qty: 30, status: "Delivered", requestedBy: "Branch Manager" },
    { id: "RO-006", date: "2023-10-10", product: "11kg LPG Tank", qty: 100, status: "Delivered", requestedBy: "System Admin" },
];

const reorderSchema = z.object({
    product: z.string().min(1, "Product is required"),
    qty: z.coerce.number().min(10, "Minimum reorder quantity is 10 units"),
});

const stockUpdateSchema = z.object({
    product: z.string().min(1, "Product is required"),
    receivedQty: z.coerce.number().min(1, "Received quantity must be greater than 0"),
});

export default function Inventory() {
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const [reorders, setReorders] = useState(MOCK_REORDERS);
    const [inventory, setInventory] = useState(MOCK_INVENTORY);

    const reorderForm = useForm({ defaultValues: { product: "", qty: 10 }, schema: reorderSchema });
    const stockForm = useForm({ defaultValues: { product: "", receivedQty: 10 }, schema: stockUpdateSchema });


    const onReorderSubmit = (data: z.infer<typeof reorderSchema>) => {
        setReorders([{ id: `RO-00${reorders.length + 1}`, date: new Date().toISOString().split('T')[0], product: data.product, qty: data.qty, status: "Pending", requestedBy: "Branch Manager" }, ...reorders]);
        reorderForm.setValues({ product: "", qty: 10 });
    };

    const onStockUpdateSubmit = (data: z.infer<typeof stockUpdateSchema>) => {
        setInventory(prev => prev.map(item => item.product === data.product ? { ...item, current: Math.min(item.current + data.receivedQty, item.capacity) } : item));
        stockForm.setValues({ product: "", receivedQty: 10 });
    };

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'Delivered': return 'success' as const;
            case 'Approved': return 'primary' as const;
            case 'Pending': return 'warning' as const;
            default: return 'secondary' as const;
        }
    };

    if (!mounted) {
        return <div style={{ minHeight: "100vh", backgroundColor: "var(--background)" }} />;
    }

    return (
        <>
            <div>
                <h1 className={styles.pageTitle}>Supply Chain</h1>
                <p className={styles.pageSubtitle}>Monitor real-time stock levels and manage reorder requests.</p>
            </div>

            <div className={styles.stockCardsGrid}>
                {inventory.map(item => {
                    const pct = Math.min((item.current / item.capacity) * 100, 100);
                    const isCritical = item.current <= item.threshold;
                    const isWarning = !isCritical && item.current <= item.threshold * 1.5;
                    const colorVar = isCritical ? 'var(--error)' : isWarning ? 'var(--warning)' : 'var(--success)';
                    return (
                        <div key={item.id} className={styles.stockCard}>
                            <div className={styles.stockCardHeader}>
                                <h3 className={styles.stockCardTitle}>{item.product}</h3>
                                <span className={styles.stockCardValues}>
                                    <span className={styles.stockCurrent}>{item.current}</span>
                                    <span className={styles.stockCapacity}>/ {item.capacity}</span>
                                </span>
                            </div>
                            <div className={styles.gaugeContainer} style={{ "--primary": colorVar } as React.CSSProperties}>
                                <Progress value={pct} />
                            </div>
                            <div className={styles.stockCardFooter}>
                                <span className={styles.thresholdLabel}>Threshold: {item.threshold}</span>
                                {isCritical && <Badge variant="destructive" className={styles.alertBadge}>Critical</Badge>}
                                {isWarning && <Badge variant="warning" className={styles.alertBadge}>Low Stock</Badge>}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className={styles.formsGrid}>
                <div className={styles.card}>
                    <div className={styles.cardHeader}><h2 className={styles.cardTitle}>New Reorder Request</h2></div>
                    <div className={styles.cardBody}>
                        <Form {...reorderForm}>
                            <form onSubmit={reorderForm.handleSubmit(onReorderSubmit)} className={styles.formLayout}>
                                <FormItem name="product">
                                    <FormLabel>Product Line</FormLabel>
                                    <Select value={reorderForm.values.product} onValueChange={(val: string) => { reorderForm.setValues(p => ({ ...p, product: val })); reorderForm.validateField("product"); }}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select product..." /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="11kg LPG Tank">11kg LPG Tank</SelectItem>
                                            <SelectItem value="22kg LPG Tank">22kg LPG Tank</SelectItem>
                                            <SelectItem value="50kg LPG Tank">50kg LPG Tank</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                <FormItem name="qty">
                                    <FormLabel>Quantity Requested</FormLabel>
                                    <FormControl><Input type="number" min="10" value={reorderForm.values.qty} onChange={e => reorderForm.setValues(p => ({ ...p, qty: Number(e.target.value) }))} onBlur={() => reorderForm.validateField("qty")} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                <div className={styles.formFooter}><Button type="submit" variant="accent">Submit Request</Button></div>
                            </form>
                        </Form>
                    </div>
                </div>
                <div className={styles.card}>
                    <div className={styles.cardHeader}><h2 className={styles.cardTitle}>Manual Stock Intake</h2></div>
                    <div className={styles.cardBody}>
                        <Form {...stockForm}>
                            <form onSubmit={stockForm.handleSubmit(onStockUpdateSubmit)} className={styles.formLayout}>
                                <FormItem name="product">
                                    <FormLabel>Product Line</FormLabel>
                                    <Select value={stockForm.values.product} onValueChange={(val: string) => { stockForm.setValues(p => ({ ...p, product: val })); stockForm.validateField("product"); }}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select product..." /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="11kg LPG Tank">11kg LPG Tank</SelectItem>
                                            <SelectItem value="22kg LPG Tank">22kg LPG Tank</SelectItem>
                                            <SelectItem value="50kg LPG Tank">50kg LPG Tank</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                <FormItem name="receivedQty">
                                    <FormLabel>Quantity Received</FormLabel>
                                    <FormControl><Input type="number" min="1" value={stockForm.values.receivedQty} onChange={e => stockForm.setValues(p => ({ ...p, receivedQty: Number(e.target.value) }))} onBlur={() => stockForm.validateField("receivedQty")} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                <div className={styles.formFooter}><Button type="submit" variant="secondary">Update Inventory</Button></div>
                            </form>
                        </Form>
                    </div>
                </div>
            </div>

            <div className={styles.card}>
                <div className={styles.cardHeader}><h2 className={styles.cardTitle}>Reorder Request Log</h2></div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead><tr><th>Req ID</th><th>Date</th><th>Product</th><th>Qty Requested</th><th>Requested By</th><th>Status</th></tr></thead>
                        <tbody>
                            {reorders.map(req => (
                                <tr key={req.id}>
                                    <td className={styles.monoText}>{req.id}</td>
                                    <td>{req.date}</td>
                                    <td className={styles.boldText}>{req.product}</td>
                                    <td className={styles.boldText}>{req.qty}</td>
                                    <td className={styles.mutedText}>{req.requestedBy}</td>
                                    <td><Badge variant={getStatusVariant(req.status)}>{req.status}</Badge></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
