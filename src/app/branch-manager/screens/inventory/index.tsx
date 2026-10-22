'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Cylinder, Gift, Package, CheckCircle2, AlertTriangle, PackageX, ChevronDown } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as z from 'zod';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Progress } from '../../components/Progress';
import { RowActionsMenu } from '../../components/RowActionsMenu';
import { Form, FormItem, FormLabel, FormControl, FormMessage, useForm } from '../../components/Form';
import { Input } from '../../components/Input';
import { apiFetch, apiErrorMessage, fetchJson } from '../../../lib/api';
import styles from './screen.module.css';
import { useAccount } from '../../../contexts/AccountContext';
import { fetchRewardStock, intakeRewardStock } from '../../../lib/reward-inventory';
import rewardTabStyles from '../rewards/screen.module.css';

/** Trimmed stock-level row (Inventory module, GET /inventory/stock-levels) —
 * one per product in the shared LPG catalog, sparse rows defaulted server-side. */
interface StockLevelRow {
    product_id: string;
    product_name: string;
    current_qty: number;
    threshold_qty: number;
    capacity_qty: number;
}

// Manager presentation only. Add product IDs here to hide them; never filter API data/state.
const HIDDEN_PRODUCTS: readonly string[] = [];

// Same public asset paths/mappings as Owner Inventory; no Owner components imported.
const CYLINDER_IMAGES: Record<string, string> = {
    '2.7kg': '/catalog/2.7kg.png', '5kg': '/catalog/5kg.png', '11kg': '/catalog/11kg.png',
    '22kg': '/catalog/22kg.png', '50kg': '/catalog/50kg.png',
};
const REWARD_IMAGES: Record<string, string> = {
    'notebook and pen': '/catalog/reward-notebook.png', 'desk calendar': '/catalog/reward-calendar.png',
    umbrella: '/catalog/reward-umbrella.png', mug: '/catalog/reward-mug.png',
};

// Inventory has no price query. Use the existing size in the product name as fallback.
// Unrecognized sizes sort last; equal sizes keep their source order.
const cylinderSize = (name: string) => {
    const match = name.match(/(\d+(?:\.\d+)?)\s*kg\b/i);
    return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
};

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

// Display-only status shared by the summary and badges; it does not control sorting.
const stockDisplayStatus = (quantity: number, threshold: number) => quantity === 0
    ? { label: 'Out of Stock', rank: 0, variant: 'destructive', color: 'var(--error)' } as const
    : quantity <= threshold
        ? { label: 'Low Stock', rank: 1, variant: 'warning', color: 'var(--warning)' } as const
        : { label: 'In Stock', rank: 2, variant: 'success', color: 'var(--success)' } as const;

export default function Inventory() {
    // Tabs filter presentation only; queries and submission handlers stay shared.
    const [activeInventoryTab, setActiveInventoryTab] = useState<'current' | 'orders'>('current');
    const [activeStockTab, setActiveStockTab] = useState<'lpg' | 'rewards'>('lpg');
    const inventoryWorkspaceRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        // Native picker positioning, Escape, outside-click and option scrolling
        // belong to the browser. Dismiss only this screen's picker on outer scroll.
        const dismissProductPicker = (event: Event) => {
            const focused = document.activeElement;
            if (!(focused instanceof HTMLSelectElement) || !inventoryWorkspaceRef.current?.contains(focused)) return;
            if (event.target instanceof Node && focused.contains(event.target)) return;
            focused.blur();
        };
        window.addEventListener('scroll', dismissProductPicker, true);
        window.addEventListener('resize', dismissProductPicker);
        return () => {
            window.removeEventListener('scroll', dismissProductPicker, true);
            window.removeEventListener('resize', dismissProductPicker);
        };
    }, []);

    React.useEffect(() => {
        const focused = document.activeElement;
        if (focused instanceof HTMLSelectElement && inventoryWorkspaceRef.current?.contains(focused)) focused.blur();
    }, [activeInventoryTab, activeStockTab]);
    const onInventoryTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 'current' : event.key === 'End' ? 'orders' : activeInventoryTab === 'current' ? 'orders' : 'current';
        setActiveInventoryTab(next);
        document.getElementById(`inventory-${next}-tab`)?.focus();
    };
    const onStockGroupKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 'lpg' : event.key === 'End' ? 'rewards' : activeStockTab === 'lpg' ? 'rewards' : 'lpg';
        changeStockTab(next);
        event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-stock-group="${next}"]`)?.focus();
    };
    const queryClient = useQueryClient();
    const account = useAccount();
    const managerBranchId = account.branchIds.length === 1 ? account.branchIds[0] : null;
    const rewardQuery = useQuery({
        queryKey: ['reward-stock-levels', managerBranchId],
        enabled: !!managerBranchId,
        staleTime: 0,
        refetchOnWindowFocus: true,
        queryFn: ({ signal }) => {
            if (!managerBranchId) throw new Error('A single assigned branch is required for reward inventory.');
            return fetchRewardStock(managerBranchId, false, signal);
        },
    });
    const rewardStock = !rewardQuery.isFetching && !rewardQuery.isError ? rewardQuery.data ?? [] : [];
    const { data: stockData, error: stockQueryError, isLoading: stockLoading, refetch: loadStockLevels } = useQuery({
        queryKey: ['stock-levels', managerBranchId],
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
    const stockIntakeRef = React.useRef<HTMLDivElement>(null);
    const pendingIntakeFocus = React.useRef(false);

    const recordStock = (productId: string) => {
        stockForm.setValues(previous => ({ ...previous, productId }));
        stockForm.validateField('productId');
        pendingIntakeFocus.current = true;
        setActiveInventoryTab('orders');
    };

    // Wait until the Order Stocks panel is visible before scrolling and focusing.
    React.useEffect(() => {
        if (activeInventoryTab !== 'orders' || !pendingIntakeFocus.current) return;
        pendingIntakeFocus.current = false;
        const form = stockIntakeRef.current;
        form?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        const quantity = form?.querySelector<HTMLInputElement>('input[type="number"]');
        quantity?.focus({ preventScroll: true });
        quantity?.select();
    }, [activeInventoryTab]);

    const changeStockTab = (next: 'lpg' | 'rewards') => {
        if (next === activeStockTab) return;
        reorderForm.setValues({ productId: '', qty: 10 });
        stockForm.setValues({ productId: '', receivedQty: 10 });
        setActiveStockTab(next);
    };
    // One display filter feeds every Manager inventory surface, including historical logs.
    const visibleLpgStock = stockLevels.filter(item => !HIDDEN_PRODUCTS.includes(item.product_id));
    // Copies sorted for these form labels only; source data and other screens stay unchanged.
    const lpgProductOptions = [...visibleLpgStock].sort((a, b) => cylinderSize(a.product_name) - cylinderSize(b.product_name));
    const rewardProductOptions = [...rewardStock].sort((a, b) => a.points_cost - b.points_cost);
    const lpgProductIds = new Set(visibleLpgStock.map(item => item.product_id));
    const lpgReorders = reorders.filter(request => lpgProductIds.has(request.product_id));

    // Local view models preserve the two existing source lists and intake IDs.
    const stockGroups = [
        {
            key: 'lpg', label: 'LPG Cylinders', loading: stockLoading, error: stockError,
            items: visibleLpgStock.map(item => ({ ...item, id: item.product_id, name: item.product_name,
                detail: '', image: CYLINDER_IMAGES[`${cylinderSize(item.product_name)}kg`], sortOrder: cylinderSize(item.product_name) })),
        },
        {
            key: 'rewards', label: 'Reward Merchandise', loading: rewardQuery.isFetching,
            error: !managerBranchId ? 'A single assigned branch is required for reward inventory.' : rewardQuery.isError ? rewardQuery.error.message : null,
            items: rewardStock.map(item => ({ ...item, id: `reward:${item.catalog_item_id}`, name: item.item_name,
                detail: `Household reward · ${item.points_cost} points`, image: REWARD_IMAGES[item.item_name.toLowerCase()], sortOrder: item.points_cost })),
        },
    ] as const;
    const activeGroup = stockGroups.find(group => group.key === activeStockTab)!;
    const stockGroupToggle = (
        <div role="group" aria-label="Stock category" className={styles.categoryToggle}>
            {stockGroups.map(group => (
                <button key={group.key} type="button" aria-label={group.label} aria-pressed={activeStockTab === group.key}
                    data-stock-group={group.key} tabIndex={activeStockTab === group.key ? 0 : -1}
                    onClick={() => changeStockTab(group.key)} onKeyDown={onStockGroupKeyDown}>
                    {group.label}
                </button>
            ))}
        </div>
    );
    const summaryUnavailable = activeGroup.loading || !!activeGroup.error;
    const summary = [
        { label: 'Total Items', value: activeGroup.items.length, Icon: Package, color: 'var(--primary)' },
        { label: 'In Stock', value: activeGroup.items.filter(item => stockDisplayStatus(item.current_qty, item.threshold_qty).rank === 2).length, Icon: CheckCircle2, color: 'var(--success)' },
        { label: 'Low Stock', value: activeGroup.items.filter(item => stockDisplayStatus(item.current_qty, item.threshold_qty).rank === 1).length, Icon: AlertTriangle, color: 'var(--warning)' },
        { label: 'Out of Stock', value: activeGroup.items.filter(item => stockDisplayStatus(item.current_qty, item.threshold_qty).rank === 0).length, Icon: PackageX, color: 'var(--error)' },
    ];

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
    const onRewardStockIntake = async (data: z.infer<typeof stockUpdateSchema>) => {
        if (!managerBranchId) { toast.error('A single assigned branch is required.'); return; }
        setIntakeSubmitting(true);
        try {
            await intakeRewardStock(managerBranchId, data.productId.slice('reward:'.length), data.receivedQty);
            await queryClient.invalidateQueries({ queryKey: ['reward-stock-levels', managerBranchId] });
            stockForm.setValues({ productId: '', receivedQty: 10 });
            toast.success('Reward inventory updated.');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to update reward inventory');
        } finally { setIntakeSubmitting(false); }
    };
    const onStockUpdateSubmit = async (data: z.infer<typeof stockUpdateSchema>) => {
        if (data.productId.startsWith('reward:')) { await onRewardStockIntake(data); return; }
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

    const [confirmedTime, setConfirmedTime] = useState<string | null>(null);
    const [confirmStockLoading, setConfirmStockLoading] = useState(false);
    
    React.useEffect(() => {
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
        const saved = localStorage.getItem('stock_confirmed_' + today);
        if (saved) setConfirmedTime(saved);
    }, []);

    const onConfirmStock = async () => {
        setConfirmStockLoading(true);
        try {
            const res = await apiFetch('/inventory/stock-checks', { method: 'POST' });
            const body = await res.json();
            if (!res.ok) throw new Error(apiErrorMessage(body, 'Failed to confirm stock'));
            
            const now = new Date();
            const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(now);
            const time = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }).format(now);
            
            localStorage.setItem('stock_confirmed_' + today, time);
            setConfirmedTime(time);
            queryClient.invalidateQueries({ queryKey: ['sla-report'] });
            toast.success("Stock count confirmed for today.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to confirm stock');
        } finally {
            setConfirmStockLoading(false);
        }
    };

    return (
        <div className={styles.inventoryWorkspace} ref={inventoryWorkspaceRef}>
                <div className={`${rewardTabStyles.trackTabsRow} ${styles.stockTabsRow}`}>
                    <div className={`${rewardTabStyles.trackTabs} ${styles.stockTabs}`} role="tablist" aria-label="Inventory sections">
                        {([
                            { value: 'current', label: 'Current Inventory' },
                            { value: 'orders', label: 'Order Stocks' },
                        ] as const).map(tab => (
                            <button
                                key={tab.value}
                                id={`inventory-${tab.value}-tab`}
                                type="button"
                                role="tab"
                                aria-label={tab.label}
                                aria-selected={activeInventoryTab === tab.value}
                                aria-controls={`inventory-${tab.value}-panel`}
                                tabIndex={activeInventoryTab === tab.value ? 0 : -1}
                                onClick={() => setActiveInventoryTab(tab.value)}
                                onKeyDown={onInventoryTabKeyDown}
                                className={`${rewardTabStyles.trackTab} ${styles.stockTab} ${activeInventoryTab === tab.value ? rewardTabStyles.trackTabActive : ''}`}
                            >
                                {tab.label}
                                <span className={rewardTabStyles.trackTabIndicator} aria-hidden="true" />
                            </button>
                        ))}
                    </div>
                <div className={styles.confirmStockSlot}>
                {activeInventoryTab === 'current' && <Button
                    onClick={onConfirmStock} 
                    disabled={confirmStockLoading || !!confirmedTime} 
                    variant={confirmedTime ? "secondary" : "primary"}
                    className={`${styles.stockCheckBtnSize} ${!confirmedTime ? styles.confirmStockBtn : ''}`}
                >
                    {confirmStockLoading ? 'Confirming...' : confirmedTime ? `Confirmed today at ${confirmedTime}` : "Confirm today's stock count"}
                </Button>}
                </div>
                </div>
            <section id="inventory-current-panel" role="tabpanel" aria-labelledby="inventory-current-tab" tabIndex={0} hidden={activeInventoryTab !== 'current'} className={styles.stockPanel}>
                <div className={styles.categoryToolbar}>{stockGroupToggle}</div>
                    <dl className={styles.summaryStrip} aria-label={`${activeGroup.label} stock summary`} aria-busy={activeGroup.loading}>
                    {summary.map(({ label, value, Icon, color }) => (
                        <div key={label} className={styles.summaryTile}>
                            <span className={styles.summaryIcon} style={{ color }} aria-hidden="true"><Icon size={18} /></span>
                            <div><dt>{label}</dt><dd>{summaryUnavailable ? '—' : value}</dd></div>
                        </div>
                    ))}
                    </dl>
                <div className={`${styles.card} ${styles.currentInventoryCard}`}>
                    <div className={styles.inventoryGroupStrip}><strong>{activeStockTab === 'rewards' ? 'Reward merchandise' : 'LPG cylinders'}</strong><span>{activeGroup.loading ? 'Loading stock…' : activeGroup.error ? 'Stock unavailable' : `${activeGroup.items.length} items`}</span></div>
                    <table className={styles.inventoryTable} aria-label={`${activeGroup.label} current inventory`}>
                        <thead><tr><th scope="col">Item</th><th scope="col">Stock Level</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead>
                        <tbody>
                            {activeGroup.loading ? <tr><td colSpan={4}><div role="status" className={styles.listState}>{activeStockTab === 'rewards' ? 'Loading reward stock…' : 'Loading stock levels…'}</div></td></tr>
                                : activeGroup.error ? <tr><td colSpan={4}><div role="alert" className={styles.listState}>{activeGroup.error} {activeStockTab === 'rewards' && <Button variant="secondary" onClick={() => void rewardQuery.refetch()}>Try again</Button>}</div></td></tr>
                                    : activeGroup.items.length === 0 ? <tr><td colSpan={4}><div className={styles.listState}>{activeStockTab === 'rewards' ? 'No reward items yet' : 'No LPG cylinders yet'}</div></td></tr>
                                        : [...activeGroup.items].sort((a, b) => a.sortOrder === b.sortOrder ? 0 : a.sortOrder - b.sortOrder).map(item => {
                                            const status = stockDisplayStatus(item.current_qty, item.threshold_qty);
                                            const percentage = Math.max(0, Math.min(item.current_qty / Math.max(item.capacity_qty, 1) * 100, 100));
                                            return (
                                                <tr key={item.id} className={styles.inventoryTableRow}>
                                                    <td className={styles.inventoryItemCell}>
                                                    <div className={styles.rowIdentity}>
                                                        <span className={styles.itemImageSlot}>
                                                            {item.image ? <Image src={item.image} alt={item.name} width={52} height={52} className={styles.itemImage} />
                                                                : <span className={styles.neutralPlaceholder} role="img" aria-label={`No matching image for ${item.name}`}>{activeStockTab === 'lpg' ? <Cylinder size={25} aria-hidden="true" /> : <Gift size={25} aria-hidden="true" />}</span>}
                                                        </span>
                                                        <div><h3>{item.name}</h3>{item.detail && <p>{item.detail}</p>}</div>
                                                    </div>
                                                    </td>
                                                    <td className={styles.inventoryStockCell}>
                                                    <div className={styles.rowStock}>
                                                        <div className={styles.quantityLabel}><strong>{item.current_qty} <span>units</span></strong><span>Threshold: {item.threshold_qty}</span></div>
                                                        <div role="progressbar" aria-label={`${item.name} stock capacity`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage} aria-valuetext={`${item.current_qty} of ${item.capacity_qty} units`} style={{ '--primary': status.color } as React.CSSProperties}><Progress value={percentage} /></div>
                                                        <p className={styles.capacityLabel}>Capacity: {item.capacity_qty} units</p>
                                                    </div>
                                                    </td>
                                                    <td className={styles.inventoryStatusCell}><Badge variant={status.variant}>{status.label}</Badge></td>
                                                    <td className={styles.inventoryActionCell}>
                                                    <Button type="button" size="sm" variant="outline" className={styles.recordStockButton} disabled={intakeSubmitting} aria-label={`Record stock for ${item.name}`} onClick={() => recordStock(item.id)}>Record stock</Button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                        </tbody>
                    </table>
                </div>
            </section>

            <section id="inventory-orders-panel" role="tabpanel" aria-labelledby="inventory-orders-tab" tabIndex={0} hidden={activeInventoryTab !== 'orders'} className={styles.stockPanel}>
                <div className={styles.categoryToolbar}>{stockGroupToggle}</div>
            <div className={`${styles.formsGrid} ${activeStockTab === 'rewards' ? styles.rewardFormsGrid : ''}`}>
                <div className={styles.card} hidden={activeStockTab === 'rewards'}>
                    <div className={styles.cardHeader}><h2 className={styles.cardTitle}>New Reorder Request</h2></div>
                    <div className={styles.cardBody}>
                        <Form {...reorderForm}>
                            <form onSubmit={reorderForm.handleSubmit(onReorderSubmit)} className={styles.formLayout}>
                                <FormItem name="productId">
                                    <FormLabel>Product Line</FormLabel>
                                    <FormControl><div className={styles.productSelectField}><select aria-label="Product Line" className={styles.productSelect} value={reorderForm.values.productId} onChange={event => { reorderForm.setValues(p => ({ ...p, productId: event.target.value })); reorderForm.validateField("productId"); }}>
                                            <option value="" disabled hidden>Select product...</option>
                                            {lpgProductOptions.map(item => (
                                                <option key={item.product_id} value={item.product_id}>{item.product_name}</option>
                                            ))}
                                    </select><ChevronDown size={16} className={styles.productSelectArrow} aria-hidden="true" /></div></FormControl>
                                    <FormMessage />
                                </FormItem>
                                <FormItem name="qty">
                                    <FormLabel>Quantity Requested</FormLabel>
                                    <FormControl><Input type="number" aria-label="Quantity Requested" min="10" value={reorderForm.values.qty} onChange={e => reorderForm.setValues(p => ({ ...p, qty: Number(e.target.value) }))} onBlur={() => reorderForm.validateField("qty")} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                <div className={styles.formFooter}>
                                    <Button type="submit" variant="primary" disabled={reorderSubmitting}>
                                        {reorderSubmitting ? 'Submitting…' : 'Submit Request'}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </div>
                </div>
                <div className={`${styles.card} ${styles.intakeCard}`} ref={stockIntakeRef}>
                    <div className={styles.cardHeader}><h2 className={styles.cardTitle}>{activeStockTab === 'rewards' ? 'Record Reward Stock' : 'Manual Stock Intake'}</h2></div>
                    <div className={styles.cardBody}>
                        <Form {...stockForm}>
                            <form onSubmit={stockForm.handleSubmit(onStockUpdateSubmit)} className={styles.formLayout}>
                                <FormItem name="productId">
                                    <FormLabel>Product Line</FormLabel>
                                    <FormControl><div className={styles.productSelectField}><select aria-label="Product Line" className={styles.productSelect} value={stockForm.values.productId} onChange={event => { stockForm.setValues(p => ({ ...p, productId: event.target.value })); stockForm.validateField("productId"); }}>
                                            <option value="" disabled hidden>Select product...</option>
                                            {activeStockTab === 'lpg' && lpgProductOptions.map(item => (
                                                <option key={item.product_id} value={item.product_id}>{item.product_name}</option>
                                            ))}
                                            {activeStockTab === 'rewards' && rewardProductOptions.map(item => (
                                                <option key={`reward:${item.catalog_item_id}`} value={`reward:${item.catalog_item_id}`}>{item.item_name}</option>
                                            ))}
                                    </select><ChevronDown size={16} className={styles.productSelectArrow} aria-hidden="true" /></div></FormControl>
                                    <FormMessage />
                                </FormItem>
                                <FormItem name="receivedQty">
                                    <FormLabel>Quantity Received</FormLabel>
                                    <FormControl><Input type="number" aria-label="Quantity Received" min="1" value={stockForm.values.receivedQty} onChange={e => stockForm.setValues(p => ({ ...p, receivedQty: Number(e.target.value) }))} onBlur={() => stockForm.validateField("receivedQty")} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                <div className={styles.formFooter}>
                                    <Button type="submit" variant="primary" disabled={intakeSubmitting}>
                                        {intakeSubmitting ? 'Updating…' : activeStockTab === 'rewards' ? 'Record Stock' : 'Update Inventory'}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </div>
                </div>
            </div>

            <div className={styles.card} hidden={activeStockTab === 'rewards'}>
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
                            {!reordersLoading && !reordersError && lpgReorders.length === 0 && (
                                <tr><td colSpan={7} className={styles.emptyState}>No reorder requests yet</td></tr>
                            )}
                            {!reordersLoading && !reordersError && lpgReorders.map(req => (
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
            </section>
        </div>
    );
}
