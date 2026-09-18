'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as z from 'zod';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Progress } from '../../components/Progress';
import { RowActionsMenu } from '../../components/RowActionsMenu';
import { Form, FormItem, FormLabel, FormControl, FormMessage, useForm } from '../../components/Form';
import { Input } from '../../components/Input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/Select';
import { apiFetch, apiErrorMessage, fetchJson } from '../../../lib/api';
import styles from './screen.module.css';

/** Trimmed stock-level row (Inventory module, GET /inventory/stock-levels) —
 * one per product in the shared LPG catalog, sparse rows defaulted server-side. */
interface StockLevelRow {
    product_id: string;
    product_name: string;
    current_qty: number;
    threshold_qty: number;
    capacity_qty: number;
}

type ReorderStatus = 'Pending' | 'Approved' | 'Delivered' | 'Cancelled';

/** Trimmed reorder-request row (GET /inventory/reorder-requests). */
interface ReorderRequestRow {
    id: string;
    product_id: string;
    product_name: string;
    requested_qty: number;
    status: ReorderStatus;
    requested_by_name: string;
    requested_at: string;
}

const reorderSchema = z.object({
    productId: z.string().min(1, "Product is required"),
    qty: z.coerce.number().min(10, "Minimum reorder quantity is 10 units"),
});

const stockUpdateSchema = z.object({
    productId: z.string().min(1, "Product is required"),
    receivedQty: z.coerce.number().min(1, "Received quantity must be greater than 0"),
});

const getStatusVariant = (status: ReorderStatus) => {
    switch (status) {
        case 'Delivered': return 'success' as const;
        case 'Approved': return 'primary' as const;
        case 'Pending': return 'warning' as const;
        case 'Cancelled': return 'destructive' as const;
        default: return 'secondary' as const;
    }
};

const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(d);
};

// A request still open enough to act on. Delivered/Cancelled are terminal
// (enforced server-side too — this just keeps dead buttons off the screen).
const isOpenRequest = (status: ReorderStatus) => status === 'Pending' || status === 'Approved';

export default function Inventory() {
    const { data: stockData, error: stockQueryError, isLoading: stockLoading, refetch: loadStockLevels } = useQuery({
        queryKey: ['stock-levels'],
        queryFn: () => fetchJson<{ stockLevels: StockLevelRow[] }>('/inventory/stock-levels'),
    });
    // For local optimism, we track stockLevels in state but initialize from query.
    // Wait, tracking in state defeats query caching if we don't sync them.
    // Actually, we can just let React Query handle the caching, and on mutation, we invalidate the query.
    // Let's stick to syncing it for now to avoid refactoring the mutation logic too heavily.
    // Actually, we can just use the query data and rely on React Query for caching.
    // However, the mutation does: `setStockLevels((prev) => prev.map(...))`
    // If I replace `setStockLevels`, I need to use `queryClient.setQueryData`.
    // It's easier to keep the state for now and sync it when data changes.
    // But since `multi_replace_file_content` is a bit complex for that, I will just let React Query fetch it and use `useEffect` to sync it to state.
    const [stockLevels, setStockLevels] = React.useState<StockLevelRow[]>([]);
    const [reorders, setReorders] = React.useState<ReorderRequestRow[]>([]);

    React.useEffect(() => {
        if (stockData?.stockLevels) setStockLevels(stockData.stockLevels);
    }, [stockData]);

    const { data: reorderData, error: reorderQueryError, isLoading: reordersLoading } = useQuery({
        queryKey: ['reorder-requests'],
        queryFn: () => fetchJson<{ reorderRequests: ReorderRequestRow[] }>('/inventory/reorder-requests'),
    });

    React.useEffect(() => {
        if (reorderData?.reorderRequests) setReorders(reorderData.reorderRequests);
    }, [reorderData]);

    const stockError = stockQueryError ? stockQueryError.message : null;
    const reordersError = reorderQueryError ? reorderQueryError.message : null;

    const reorderForm = useForm({ defaultValues: { productId: "", qty: 10 }, schema: reorderSchema });
    const stockForm = useForm({ defaultValues: { productId: "", receivedQty: 10 }, schema: stockUpdateSchema });

    const [reorderSubmitting, setReorderSubmitting] = useState(false);
    const onReorderSubmit = async (data: z.infer<typeof reorderSchema>) => {
        setReorderSubmitting(true);
        try {
            const res = await apiFetch('/inventory/reorder-requests', {
                method: 'POST',
                body: JSON.stringify({ productId: data.productId, requestedQty: data.qty }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(apiErrorMessage(body, 'Failed to submit reorder request'));
            setReorders((prev) => [body.reorderRequest as ReorderRequestRow, ...prev]);
            reorderForm.setValues({ productId: "", qty: 10 });
            toast.success('Reorder request submitted.');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to submit reorder request');
        } finally {
            setReorderSubmitting(false);
        }
    };

    const [intakeSubmitting, setIntakeSubmitting] = useState(false);
    const onStockUpdateSubmit = async (data: z.infer<typeof stockUpdateSchema>) => {
        setIntakeSubmitting(true);
        try {
            const res = await apiFetch('/inventory/stock-levels/intake', {
                method: 'POST',
                body: JSON.stringify({ productId: data.productId, receivedQty: data.receivedQty }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(apiErrorMessage(body, 'Failed to update inventory'));
            const updated = body.stockLevel as StockLevelRow;
            setStockLevels((prev) => prev.map((item) => (item.product_id === updated.product_id ? updated : item)));
            stockForm.setValues({ productId: "", receivedQty: 10 });
            toast.success('Inventory updated.');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to update inventory');
        } finally {
            setIntakeSubmitting(false);
        }
    };

    const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
    const updateReorderStatus = async (id: string, status: 'Approved' | 'Delivered' | 'Cancelled') => {
        setStatusUpdatingId(id);
        try {
            const res = await apiFetch(`/inventory/reorder-requests/${id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(apiErrorMessage(body, `Failed to mark request ${status}`));
            const updated = body.reorderRequest as ReorderRequestRow;
            setReorders((prev) => prev.map((r) => (r.id === id ? updated : r)));
            if (status === 'Delivered') {
                // Stock was credited server-side (atomic upsert) — reload the
                // cards rather than re-deriving the capacity cap client-side.
                loadStockLevels().catch(() => { /* cards just stay stale until next reload */ });
            }
            toast.success(`Reorder request marked ${status}.`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : `Failed to mark request ${status}`);
        } finally {
            setStatusUpdatingId(null);
        }
    };

    return (
        <>
            <div className={styles.stockCardsGrid}>
                {stockLoading && <div className={styles.emptyState}>Loading stock levels…</div>}
                {!stockLoading && stockError && <div className={styles.emptyState}>{stockError}</div>}
                {!stockLoading && !stockError && stockLevels.map(item => {
                    const pct = Math.min((item.current_qty / item.capacity_qty) * 100, 100);
                    const isCritical = item.current_qty <= item.threshold_qty;
                    const isWarning = !isCritical && item.current_qty <= item.threshold_qty * 1.5;
                    const colorVar = isCritical ? 'var(--error)' : isWarning ? 'var(--warning)' : 'var(--success)';
                    return (
                        <div key={item.product_id} className={styles.stockCard}>
                            <div className={styles.stockCardHeader}>
                                <h3 className={styles.stockCardTitle}>{item.product_name}</h3>
                                <span className={styles.stockCardValues}>
                                    <span className={styles.stockCurrent}>{item.current_qty}</span>
                                    <span className={styles.stockCapacity}>/ {item.capacity_qty}</span>
                                </span>
                            </div>
                            <div className={styles.gaugeContainer} style={{ "--primary": colorVar } as React.CSSProperties}>
                                <Progress value={pct} />
                            </div>
                            <div className={styles.stockCardFooter}>
                                <span className={styles.thresholdLabel}>Threshold: {item.threshold_qty}</span>
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
                                <FormItem name="productId">
                                    <FormLabel>Product Line</FormLabel>
                                    <Select value={reorderForm.values.productId} onValueChange={(val: string) => { reorderForm.setValues(p => ({ ...p, productId: val })); reorderForm.validateField("productId"); }}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select product..." /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {stockLevels.map(item => (
                                                <SelectItem key={item.product_id} value={item.product_id}>{item.product_name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                <FormItem name="qty">
                                    <FormLabel>Quantity Requested</FormLabel>
                                    <FormControl><Input type="number" min="10" value={reorderForm.values.qty} onChange={e => reorderForm.setValues(p => ({ ...p, qty: Number(e.target.value) }))} onBlur={() => reorderForm.validateField("qty")} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                <div className={styles.formFooter}>
                                    <Button type="submit" variant="accent" disabled={reorderSubmitting}>
                                        {reorderSubmitting ? 'Submitting…' : 'Submit Request'}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </div>
                </div>
                <div className={styles.card}>
                    <div className={styles.cardHeader}><h2 className={styles.cardTitle}>Manual Stock Intake</h2></div>
                    <div className={styles.cardBody}>
                        <Form {...stockForm}>
                            <form onSubmit={stockForm.handleSubmit(onStockUpdateSubmit)} className={styles.formLayout}>
                                <FormItem name="productId">
                                    <FormLabel>Product Line</FormLabel>
                                    <Select value={stockForm.values.productId} onValueChange={(val: string) => { stockForm.setValues(p => ({ ...p, productId: val })); stockForm.validateField("productId"); }}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select product..." /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {stockLevels.map(item => (
                                                <SelectItem key={item.product_id} value={item.product_id}>{item.product_name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                <FormItem name="receivedQty">
                                    <FormLabel>Quantity Received</FormLabel>
                                    <FormControl><Input type="number" min="1" value={stockForm.values.receivedQty} onChange={e => stockForm.setValues(p => ({ ...p, receivedQty: Number(e.target.value) }))} onBlur={() => stockForm.validateField("receivedQty")} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                <div className={styles.formFooter}>
                                    <Button type="submit" variant="secondary" disabled={intakeSubmitting}>
                                        {intakeSubmitting ? 'Updating…' : 'Update Inventory'}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </div>
                </div>
            </div>

            <div className={styles.card}>
                <div className={styles.cardHeader}><h2 className={styles.cardTitle}>Reorder Request Log</h2></div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead><tr><th>Req ID</th><th>Date</th><th>Product</th><th>Qty Requested</th><th>Requested By</th><th>Status</th><th></th></tr></thead>
                        <tbody>
                            {reordersLoading && (
                                <tr><td colSpan={7} className={styles.emptyState}>Loading…</td></tr>
                            )}
                            {!reordersLoading && reordersError && (
                                <tr><td colSpan={7} className={styles.emptyState}>{reordersError}</td></tr>
                            )}
                            {!reordersLoading && !reordersError && reorders.length === 0 && (
                                <tr><td colSpan={7} className={styles.emptyState}>No reorder requests yet.</td></tr>
                            )}
                            {!reordersLoading && !reordersError && reorders.map(req => (
                                <tr key={req.id}>
                                    <td className={styles.monoText}>#{req.id.slice(0, 8).toUpperCase()}</td>
                                    <td>{formatDate(req.requested_at)}</td>
                                    <td className={styles.boldText}>{req.product_name}</td>
                                    <td className={styles.boldText}>{req.requested_qty}</td>
                                    <td className={styles.mutedText}>{req.requested_by_name}</td>
                                    <td><Badge variant={getStatusVariant(req.status)}>{req.status}</Badge></td>
                                    <td>
                                        {isOpenRequest(req.status) ? (
                                            <div className={styles.rowActions}>
                                                <Button
                                                    size="sm"
                                                    variant="primary"
                                                    disabled={statusUpdatingId === req.id}
                                                    onClick={() => updateReorderStatus(req.id, 'Delivered')}
                                                >
                                                    {statusUpdatingId === req.id ? 'Updating…' : 'Mark Delivered'}
                                                </Button>
                                                <RowActionsMenu items={[
                                                    ...(req.status === 'Pending'
                                                        ? [{ label: 'Approve', onClick: () => updateReorderStatus(req.id, 'Approved') }]
                                                        : []),
                                                    { label: 'Cancel', onClick: () => updateReorderStatus(req.id, 'Cancelled') },
                                                ]} />
                                            </div>
                                        ) : (
                                            <span className={styles.mutedText}>—</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
