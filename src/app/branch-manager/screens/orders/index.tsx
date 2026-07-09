'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Smartphone, Store, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import * as z from 'zod';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Tabs, TabsList, TabsTrigger } from '../../components/Tabs';
import { Form, FormItem, FormLabel, FormControl, FormMessage, useForm } from '../../components/Form';
import { Input } from '../../components/Input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/Select';
import { apiFetch, apiErrorMessage } from '../../../lib/api';
import styles from './screen.module.css';

/**
 * Service Request row as returned by the CRM API (SRD module). The API responds
 * in snake_case; branch scope is derived from the caller's token server-side, so
 * no branch_id is ever sent from here (AGENTS.md §5).
 */
interface SRRow {
    id: string;
    branch_id: string;
    order_source: 'Mobile App' | 'Walk-in/Phone';
    status: 'Pending' | 'Dispatched' | 'En Route' | 'Delivered' | 'Cancelled';
    customer_name: string;
    customer_contact: string;
    delivery_address: string;
    cylinder_size: string;
    quantity: number;
    special_instructions: string | null;
    // Assigned rider (Fleet). null until the request is dispatched (SRD dispatch step).
    rider_id: string | null;
    requested_at: string;
    dispatched_at: string | null;
    in_transit_at: string | null;
    delivered_at: string | null;
    created_at: string;
}

/**
 * Rider row from the Fleet module (GET /riders). snake_case like the SR rows.
 * Only `Available` riders are assignable; the full roster is fetched once to
 * resolve a dispatched rider_id → display label (a dispatched rider is no
 * longer `Available`, so it won't appear in the assignable list).
 */
interface RiderRow {
    id: string;
    branch_id: string;
    name: string;
    plate: string;
    status: 'Available' | 'On Delivery' | 'Maintenance Due' | 'Offline';
    created_at: string;
}

// Walk-in/phone intake. The server sets order_source ("Walk-in/Phone"), branchId,
// and status automatically, so those are never sent from the client.
// NOTE: customer search / "create new customer" (CIM) is a later slice — for now
// the intake takes plain customer name/contact/address text fields.
const newRequestSchema = z.object({
    customerName: z.string().min(2, 'Customer name must be at least 2 characters'),
    customerContact: z.string().min(7, 'A valid contact number is required'),
    deliveryAddress: z.string().min(5, 'Delivery address is required'),
    cylinderSize: z.string().min(1, 'Cylinder size is required'),
    quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
    specialInstructions: z.string().optional(),
});

type NewRequestValues = z.infer<typeof newRequestSchema>;

const formatRequestedAt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-PH', {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    }).format(d);
};

const getStatusVariant = (status: SRRow['status']) => {
    switch (status) {
        case 'Delivered': return 'success' as const;
        case 'Dispatched': return 'primary' as const;
        case 'En Route': return 'info' as const;
        case 'Cancelled': return 'destructive' as const;
        case 'Pending': return 'warning' as const;
        default: return 'secondary' as const;
    }
};

export default function Orders() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const [activeTab, setActiveTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [requests, setRequests] = useState<SRRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreateFormVisible, setIsCreateFormVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Rider assignment / dispatch (Slice 2). Only one row's assign panel is open
    // at a time, so a single selection/dispatch state is enough.
    const [rosterMap, setRosterMap] = useState<Record<string, string>>({});
    const [availableRiders, setAvailableRiders] = useState<RiderRow[] | null>(null);
    const [ridersLoading, setRidersLoading] = useState(false);
    const [assigningId, setAssigningId] = useState<string | null>(null);
    const [selectedRiderId, setSelectedRiderId] = useState('');
    const [dispatchingId, setDispatchingId] = useState<string | null>(null);
    // Mark-delivered in-flight guard (Slice 3), mirroring dispatchingId: only one
    // row's deliver request runs at a time, so a single id is enough.
    const [deliveringId, setDeliveringId] = useState<string | null>(null);

    const form = useForm({
        defaultValues: {
            customerName: '', customerContact: '', deliveryAddress: '',
            cylinderSize: '', quantity: 1, specialInstructions: '',
        },
        schema: newRequestSchema,
    });

    const loadRequests = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiFetch('/service-requests');
            const data = await res.json();
            if (!res.ok) throw new Error(apiErrorMessage(data, 'Failed to load service requests'));
            setRequests(data.serviceRequests as SRRow[]);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load service requests';
            setError(message);
            setRequests([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadRequests(); }, [loadRequests]);

    // Full rider roster → id → "name (plate)" display map. Best-effort: if it
    // fails, dispatched rows fall back to showing the raw rider_id.
    const loadRoster = useCallback(async () => {
        try {
            const res = await apiFetch('/riders');
            const data = await res.json();
            if (!res.ok) return;
            const map: Record<string, string> = {};
            for (const r of data.riders as RiderRow[]) map[r.id] = `${r.name} (${r.plate})`;
            setRosterMap(map);
        } catch {
            // Non-fatal: the rider column just falls back to the raw id.
        }
    }, []);

    useEffect(() => { loadRoster(); }, [loadRoster]);

    // Fetch the assignable (Available) riders when a row's assign panel opens.
    const loadAvailableRiders = useCallback(async () => {
        setRidersLoading(true);
        try {
            const res = await apiFetch('/riders?status=Available');
            const data = await res.json();
            if (!res.ok) throw new Error(apiErrorMessage(data, 'Failed to load riders'));
            setAvailableRiders(data.riders as RiderRow[]);
        } catch (err) {
            setAvailableRiders([]);
            toast.error(err instanceof Error ? err.message : 'Failed to load riders');
        } finally {
            setRidersLoading(false);
        }
    }, []);

    const openAssign = (id: string) => {
        setAssigningId(id);
        setSelectedRiderId('');
        setAvailableRiders(null); // reset so the panel shows "Loading…" not a stale list
        loadAvailableRiders();
    };

    const closeAssign = () => {
        setAssigningId(null);
        setSelectedRiderId('');
    };

    const handleDispatch = async (requestId: string) => {
        if (!selectedRiderId) return;
        setDispatchingId(requestId);
        try {
            const res = await apiFetch(`/service-requests/${requestId}/dispatch`, {
                method: 'POST',
                body: JSON.stringify({ riderId: selectedRiderId }),
            });
            const data = await res.json();
            if (!res.ok) {
                // 409: another user already dispatched this — reconcile the queue.
                if (res.status === 409) {
                    toast.error('This request was already dispatched');
                    closeAssign();
                    await loadRequests();
                    return;
                }
                if (res.status === 404) {
                    toast.error('Request not found');
                    return;
                }
                // 400 "Rider is not assignable" (rider no longer Available) and
                // malformed-uuid errors are surfaced as-is from the API.
                toast.error(apiErrorMessage(data, 'Failed to dispatch request'));
                return;
            }
            toast.success('Rider assigned and request dispatched.');
            closeAssign();
            await loadRequests();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to dispatch request');
        } finally {
            setDispatchingId(null);
        }
    };

    // Mark a Dispatched (or En Route) request as Delivered (BM-007). No body; the
    // server sets delivered_at and returns the assigned rider to Available — hence
    // both loaders refresh on success (loadRequests + loadRoster).
    const handleDeliver = async (requestId: string) => {
        setDeliveringId(requestId);
        try {
            const res = await apiFetch(`/service-requests/${requestId}/deliver`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) {
                // 409: no longer out for delivery (already delivered / cancelled / lost
                // race). Reconcile the queue so the row reflects its true state.
                if (res.status === 409) {
                    toast.error(apiErrorMessage(data, 'Service request is not out for delivery'));
                    await loadRequests();
                    return;
                }
                if (res.status === 404) {
                    toast.error('Request not found');
                    return;
                }
                // 400 malformed-uuid and any other error surfaced as-is from the API.
                toast.error(apiErrorMessage(data, 'Failed to mark request delivered'));
                return;
            }
            toast.success('Request marked as delivered.');
            // Refresh the queue and the rider display map: the rider is now Available.
            await Promise.all([loadRequests(), loadRoster()]);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to mark request delivered');
        } finally {
            setDeliveringId(null);
        }
    };

    const onSubmit = async (values: NewRequestValues) => {
        setSubmitting(true);
        try {
            const res = await apiFetch('/service-requests', {
                method: 'POST',
                body: JSON.stringify({
                    customerName: values.customerName,
                    customerContact: values.customerContact,
                    deliveryAddress: values.deliveryAddress,
                    cylinderSize: values.cylinderSize,
                    quantity: values.quantity,
                    // Only send special instructions when the operator actually entered some.
                    ...(values.specialInstructions ? { specialInstructions: values.specialInstructions } : {}),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(apiErrorMessage(data, 'Failed to create service request'));
            toast.success('Walk-in/phone service request created.');
            form.setValues({
                customerName: '', customerContact: '', deliveryAddress: '',
                cylinderSize: '', quantity: 1, specialInstructions: '',
            });
            setIsCreateFormVisible(false);
            await loadRequests();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to create service request');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredRequests = requests.filter(r => {
        const matchesTab =
            activeTab === 'all' ||
            (activeTab === 'pending' && r.status === 'Pending') ||
            (activeTab === 'transit' && (r.status === 'Dispatched' || r.status === 'En Route')) ||
            (activeTab === 'completed' && r.status === 'Delivered');

        const q = searchQuery.toLowerCase();
        const matchesSearch =
            r.customer_name.toLowerCase().includes(q) ||
            r.customer_contact.toLowerCase().includes(q);

        return matchesTab && matchesSearch;
    });

    if (!mounted) {
        return <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)' }} />;
    }

    return (
        <>
            {/* Title lives in the shared header; keep the primary action right-aligned */}
            <div className={styles.pageHeader} style={{ justifyContent: 'flex-end' }}>
                {!isCreateFormVisible && (
                    <Button variant="accent" onClick={() => setIsCreateFormVisible(true)}>New Request</Button>
                )}
            </div>

            {isCreateFormVisible && (
                <div className={styles.card}>
                    <div className={styles.cardHeaderFlex}>
                        <h2 className={styles.cardTitle}>New Walk-in / Phone Request</h2>
                        <Button variant="ghost" size="sm" onClick={() => setIsCreateFormVisible(false)}>Cancel</Button>
                    </div>
                    <div className={styles.cardBody}>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className={styles.orderForm}>
                                <div className={styles.formGrid}>
                                    <FormItem name="customerName">
                                        <FormLabel>Customer Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Juan Dela Cruz" value={form.values.customerName}
                                                onChange={e => form.setValues(p => ({ ...p, customerName: e.target.value }))}
                                                onBlur={() => form.validateField('customerName')} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    <FormItem name="customerContact">
                                        <FormLabel>Contact Number</FormLabel>
                                        <FormControl>
                                            <Input placeholder="0917-000-0000" value={form.values.customerContact}
                                                onChange={e => form.setValues(p => ({ ...p, customerContact: e.target.value }))}
                                                onBlur={() => form.validateField('customerContact')} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    <FormItem name="deliveryAddress">
                                        <FormLabel>Delivery Address</FormLabel>
                                        <FormControl>
                                            <Input placeholder="123 Mabini St, Makati" value={form.values.deliveryAddress}
                                                onChange={e => form.setValues(p => ({ ...p, deliveryAddress: e.target.value }))}
                                                onBlur={() => form.validateField('deliveryAddress')} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    <FormItem name="cylinderSize">
                                        <FormLabel>Cylinder Size</FormLabel>
                                        <Select value={form.values.cylinderSize} onValueChange={(val: string) => { form.setValues(prev => ({ ...prev, cylinderSize: val })); form.validateField('cylinderSize'); }}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue placeholder="Select size..." /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="11kg">11kg</SelectItem>
                                                <SelectItem value="22kg">22kg</SelectItem>
                                                <SelectItem value="50kg">50kg</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                    <FormItem name="quantity">
                                        <FormLabel>Quantity</FormLabel>
                                        <FormControl>
                                            <Input type="number" min="1" value={form.values.quantity}
                                                onChange={e => form.setValues(p => ({ ...p, quantity: Number(e.target.value) }))}
                                                onBlur={() => form.validateField('quantity')} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    <FormItem name="specialInstructions">
                                        <FormLabel>Special Instructions (optional)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. Leave at guardhouse" value={form.values.specialInstructions}
                                                onChange={e => form.setValues(p => ({ ...p, specialInstructions: e.target.value }))} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                </div>
                                <div className={styles.formFooter}>
                                    <Button type="submit" size="lg" variant="accent" disabled={submitting}>
                                        {submitting ? 'Creating…' : 'Create Request'}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </div>
                </div>
            )}

            <div className={styles.card}>
                <div className={styles.tabsWrapper} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList>
                            <TabsTrigger value="all">All Requests</TabsTrigger>
                            <TabsTrigger value="pending">Pending</TabsTrigger>
                            <TabsTrigger value="transit">In Transit</TabsTrigger>
                            <TabsTrigger value="completed">Completed</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <div style={{ width: '280px' }}>
                            <Input
                                placeholder="Search customer or contact..."
                                value={searchQuery}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" size="sm" onClick={loadRequests} disabled={loading} aria-label="Refresh service requests">
                            <RefreshCw size={14} /> Refresh
                        </Button>
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Source</th><th>Customer Name</th><th>Contact</th>
                                <th>Cylinder</th><th>Requested At</th><th>Status</th>
                                <th className={styles.riderCol}>Rider</th><th className={styles.actionsCol}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} className={styles.emptyState}>Loading service requests…</td></tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={8} className={styles.emptyState}>
                                        <div style={{ marginBottom: '0.75rem' }}>{error}</div>
                                        <Button variant="outline" size="sm" onClick={loadRequests}>Try again</Button>
                                    </td>
                                </tr>
                            ) : filteredRequests.length === 0 ? (
                                <tr><td colSpan={8} className={styles.emptyState}>No service requests found for this view.</td></tr>
                            ) : (
                                filteredRequests.map(req => (
                                    <tr key={req.id}>
                                        {/* order_source is a mandatory tag on every row (SRD channel-level SLA reporting) */}
                                        <td>
                                            {req.order_source === 'Mobile App' ? (
                                                <Badge variant="info" style={{ gap: '0.35rem' }}>
                                                    <Smartphone size={13} /> Mobile App
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" style={{ gap: '0.35rem' }}>
                                                    <Store size={13} /> Walk-in/Phone
                                                </Badge>
                                            )}
                                        </td>
                                        <td className={styles.boldText}>{req.customer_name}</td>
                                        <td>{req.customer_contact}</td>
                                        <td>{req.quantity}× {req.cylinder_size}</td>
                                        <td className={styles.mutedText}>{formatRequestedAt(req.requested_at)}</td>
                                        <td>
                                            <Badge variant={getStatusVariant(req.status)}>{req.status}</Badge>
                                            {/* dispatched_at is the 2nd SLA timestamp; show it once the request leaves Pending */}
                                            {req.dispatched_at && (
                                                <div className={styles.mutedText} style={{ marginTop: '0.35rem', fontSize: '0.75rem' }}>
                                                    Dispatched {formatRequestedAt(req.dispatched_at)}
                                                </div>
                                            )}
                                            {/* delivered_at is the final SLA timestamp; show it once the request is Delivered */}
                                            {req.delivered_at && (
                                                <div className={styles.mutedText} style={{ marginTop: '0.35rem', fontSize: '0.75rem' }}>
                                                    Delivered {formatRequestedAt(req.delivered_at)}
                                                </div>
                                            )}
                                        </td>
                                        <td className={styles.riderCell}>
                                            {assigningId === req.id ? (
                                                ridersLoading || availableRiders === null ? (
                                                    <span className={styles.mutedText}>Loading riders…</span>
                                                ) : availableRiders.length === 0 ? (
                                                    <span className={styles.mutedText}>No available riders</span>
                                                ) : (
                                                    // Native select: the browser renders its option list in a
                                                    // top-level layer that ancestor overflow (the card / table
                                                    // wrapper) can't clip, so all riders show without scrolling.
                                                    <select
                                                        className={styles.riderSelect}
                                                        value={selectedRiderId}
                                                        onChange={(e) => setSelectedRiderId(e.target.value)}
                                                        aria-label="Select rider"
                                                    >
                                                        <option value="" disabled>Select rider…</option>
                                                        {availableRiders.map(r => (
                                                            <option key={r.id} value={r.id}>{r.name} ({r.plate})</option>
                                                        ))}
                                                    </select>
                                                )
                                            ) : req.rider_id ? (
                                                rosterMap[req.rider_id] ?? req.rider_id
                                            ) : (
                                                <span className={styles.mutedText}>—</span>
                                            )}
                                        </td>
                                        <td className={styles.actionsCell}>
                                            {req.status === 'Pending' ? (
                                                assigningId === req.id ? (
                                                    <div className={styles.assignActions}>
                                                        {availableRiders !== null && availableRiders.length > 0 && (
                                                            <Button
                                                                size="sm"
                                                                variant="accent"
                                                                disabled={!selectedRiderId || dispatchingId === req.id}
                                                                onClick={() => handleDispatch(req.id)}
                                                            >
                                                                {dispatchingId === req.id ? 'Dispatching…' : 'Dispatch'}
                                                            </Button>
                                                        )}
                                                        <Button size="sm" variant="ghost" onClick={closeAssign}>Cancel</Button>
                                                    </div>
                                                ) : (
                                                    <Button size="sm" variant="outline" onClick={() => openAssign(req.id)}>Assign &amp; Dispatch</Button>
                                                )
                                            ) : req.status === 'Dispatched' || req.status === 'En Route' ? (
                                                // Out for delivery → let the BM close it out (BM-007).
                                                <Button
                                                    size="sm"
                                                    variant="accent"
                                                    disabled={deliveringId === req.id}
                                                    onClick={() => handleDeliver(req.id)}
                                                >
                                                    {deliveringId === req.id ? 'Delivering…' : 'Mark Delivered'}
                                                </Button>
                                            ) : (
                                                <span className={styles.mutedText}>—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
