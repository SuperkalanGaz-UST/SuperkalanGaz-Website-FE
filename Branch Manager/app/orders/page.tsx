'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import * as z from 'zod';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Tabs, TabsList, TabsTrigger } from '@/components/Tabs';
import { Form, FormItem, FormLabel, FormControl, FormMessage, useForm } from '@/components/Form';
import { Input } from '@/components/Input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/Select';
import styles from './page.module.css';

const MOCK_ORDERS = [
    { id: "ORD-1042", customer: "Maria Santos", phone: "0917-123-4567", items: "2x 11kg LPG", total: 1800, status: "Delivered", rider: "J. Reyes" },
    { id: "ORD-1043", customer: "Kainan ni Aling Nena", phone: "0918-987-6543", items: "1x 50kg LPG", total: 4200, status: "In Transit", rider: "R. Cruz" },
    { id: "ORD-1044", customer: "Pedro Penduko", phone: "0919-555-1122", items: "1x 11kg LPG", total: 900, status: "Pending", rider: "Unassigned" },
    { id: "ORD-1045", customer: "Lola Basyang", phone: "0920-444-3333", items: "3x 22kg LPG", total: 5400, status: "In Transit", rider: "A. Santos" },
    { id: "ORD-1046", customer: "Juan Dela Cruz", phone: "0921-222-1111", items: "1x 11kg LPG", total: 900, status: "Delivered", rider: "M. Torres" },
    { id: "ORD-1047", customer: "Mang Inasal Brgy", phone: "0922-777-8888", items: "5x 50kg LPG", total: 21000, status: "Pending", rider: "Unassigned" },
    { id: "ORD-1048", customer: "Anna Lopez", phone: "0933-111-2222", items: "1x 22kg LPG", total: 1800, status: "Pending", rider: "Unassigned" },
    { id: "ORD-1049", customer: "Reyes Eatery", phone: "0944-555-6666", items: "2x 50kg LPG", total: 8400, status: "In Transit", rider: "M. Torres" },
    { id: "ORD-1050", customer: "John Doe", phone: "0955-999-8888", items: "1x 11kg LPG", total: 900, status: "Delivered", rider: "J. Reyes" },
    { id: "ORD-1051", customer: "Sarah Geronimo", phone: "0966-222-3333", items: "2x 22kg LPG", total: 3600, status: "Pending", rider: "Unassigned" },
];

const newOrderSchema = z.object({
    customerName: z.string().min(2, "Name must be at least 2 characters"),
    phone: z.string().min(7, "Valid phone number required"),
    item: z.string().min(1, "Item is required"),
    qty: z.coerce.number().min(1, "Quantity must be at least 1"),
});

const formatPHP = (value: number) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);

const getStatusVariant = (status: string) => {
    switch (status) {
        case 'Delivered': return 'success' as const;
        case 'In Transit': return 'primary' as const;
        case 'Pending': return 'warning' as const;
        default: return 'secondary' as const;
    }
};

export default function Orders() {
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const [activeTab, setActiveTab] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [orders, setOrders] = useState(MOCK_ORDERS);
    const [isCreateFormVisible, setIsCreateFormVisible] = useState(false);

    const form = useForm({
        defaultValues: { customerName: "", phone: "", item: "", qty: 1 },
        schema: newOrderSchema,
    });

    const updateOrderStatus = (id: string, newStatus: string) => {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
    };


    const onSubmit = (data: z.infer<typeof newOrderSchema>) => {
        const newOrder = {
            id: `ORD-${1048 + orders.length}`,
            customer: data.customerName,
            phone: data.phone,
            items: `${data.qty}x ${data.item}`,
            total: data.qty * (data.item === "11kg LPG Tank" ? 900 : data.item === "22kg LPG Tank" ? 1800 : 4200),
            status: "Pending",
            rider: "Unassigned",
        };
        setOrders([newOrder, ...orders]);
        form.setValues({ customerName: "", phone: "", item: "", qty: 1 });
        setIsCreateFormVisible(false);
    };

    const filteredOrders = orders.filter(o => {
        const matchesTab = activeTab === "all" || 
                           (activeTab === "pending" && o.status === "Pending") ||
                           (activeTab === "transit" && o.status === "In Transit") ||
                           (activeTab === "completed" && o.status === "Delivered");
                           
        const matchesSearch = o.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              o.id.toLowerCase().includes(searchQuery.toLowerCase());
                              
        return matchesTab && matchesSearch;
    });

    if (!mounted) {
        return <div style={{ minHeight: "100vh", backgroundColor: "var(--background)" }} />;
    }

    return (
        <>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Order Management</h1>
                    <p className={styles.pageSubtitle}>Process incoming orders and track delivery statuses.</p>
                </div>
                {!isCreateFormVisible && (
                    <Button variant="accent" onClick={() => setIsCreateFormVisible(true)}>Create New Order</Button>
                )}
            </div>

            {isCreateFormVisible && (
                <div className={styles.card}>
                    <div className={styles.cardHeaderFlex}>
                        <h2 className={styles.cardTitle}>Create New Order</h2>
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
                                                onBlur={() => form.validateField("customerName")} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    <FormItem name="phone">
                                        <FormLabel>Phone Number</FormLabel>
                                        <FormControl>
                                            <Input placeholder="0917-000-0000" value={form.values.phone}
                                                onChange={e => form.setValues(p => ({ ...p, phone: e.target.value }))}
                                                onBlur={() => form.validateField("phone")} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    <FormItem name="item">
                                        <FormLabel>Product Item</FormLabel>
                                        <Select value={form.values.item} onValueChange={(val: string) => { form.setValues(prev => ({ ...prev, item: val })); form.validateField("item"); }}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue placeholder="Select product..." /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="11kg LPG Tank">11kg LPG Tank</SelectItem>
                                                <SelectItem value="22kg LPG Tank">22kg LPG Tank</SelectItem>
                                                <SelectItem value="50kg LPG Tank">50kg LPG Tank</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                    <FormItem name="qty">
                                        <FormLabel>Quantity</FormLabel>
                                        <FormControl>
                                            <Input type="number" min="1" value={form.values.qty}
                                                onChange={e => form.setValues(p => ({ ...p, qty: Number(e.target.value) }))}
                                                onBlur={() => form.validateField("qty")} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                </div>
                                <div className={styles.formFooter}>
                                    <Button type="submit" size="lg" variant="accent">Place Order</Button>
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
                            <TabsTrigger value="all">All Orders</TabsTrigger>
                            <TabsTrigger value="pending">Pending</TabsTrigger>
                            <TabsTrigger value="transit">In Transit</TabsTrigger>
                            <TabsTrigger value="completed">Completed</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <div style={{ width: '280px' }}>
                        <Input 
                            placeholder="Search customer or order #..." 
                            value={searchQuery}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Order #</th><th>Customer Name</th><th>Phone</th>
                                <th>Items</th><th>Total</th><th>Status</th><th>Rider</th><th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.length === 0 ? (
                                <tr><td colSpan={8} className={styles.emptyState}>No orders found for this status.</td></tr>
                            ) : (
                                filteredOrders.map(order => (
                                    <tr key={order.id}>
                                        <td className={styles.monoText}>{order.id}</td>
                                        <td className={styles.boldText}>{order.customer}</td>
                                        <td>{order.phone}</td>
                                        <td>{order.items}</td>
                                        <td className={styles.boldText}>{formatPHP(order.total)}</td>
                                        <td>
                                            <Select value={order.status} onValueChange={(val: string) => updateOrderStatus(order.id, val)}>
                                                <SelectTrigger hideIcon style={{ width: 'max-content', border: 'none', background: 'transparent', padding: 0, height: 'auto', outline: 'none', boxShadow: 'none' }}>
                                                    <Badge variant={getStatusVariant(order.status)} style={{ gap: '0.35rem', cursor: 'pointer' }}>
                                                        {order.status}
                                                        <ChevronDown size={14} style={{ opacity: 0.7 }} />
                                                    </Badge>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Pending">Pending</SelectItem>
                                                    <SelectItem value="In Transit">In Transit</SelectItem>
                                                    <SelectItem value="Delivered">Delivered</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </td>
                                        <td className={order.rider === 'Unassigned' ? styles.mutedText : ''}>{order.rider}</td>
                                        <td>
                                            <div className={styles.actionButtons}>
                                                {order.status === 'Pending' && <Button size="sm" variant="outline">Assign Rider</Button>}
                                                {order.status === 'In Transit' && <Button size="sm" variant="primary">Mark Delivered</Button>}
                                                {(order.status === 'Delivered' || order.status === 'Completed') && <span className={styles.mutedText}>—</span>}
                                            </div>
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
