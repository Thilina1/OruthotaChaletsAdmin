'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Table as TableType, Order } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, Clock, Users, Coffee, CheckCircle2, RefreshCw, Search, ScanLine, Pencil } from 'lucide-react';
import { PaymentModal } from '@/components/dashboard/billing/payment-modal';
import { BarcodeScanner } from '@/components/dashboard/inventory-management/barcode-scanner';
import { format } from 'date-fns';

type ChargeEntry = { id: string; name: string; type: 'percentage' | 'fixed'; value: number; enabled: boolean };
type BillingConfig = {
  vat: { enabled: boolean; rate: number };
  service_charges: ChargeEntry[];
  discounts: ChargeEntry[];
  other_charges: ChargeEntry[];
};
type GuestInfo = { id: string; name: string; current_room?: string; phone?: string };

function calcGrandTotal(subtotal: number, cfg: BillingConfig): number {
  const apply = (base: number, e: ChargeEntry) => e.type === 'percentage' ? base * e.value / 100 : e.value;
  const afterDiscount = subtotal;
  const scTotal = cfg.service_charges.filter(s => s.enabled).reduce((s, e) => s + apply(afterDiscount, e), 0);
  const ocTotal = cfg.other_charges.filter(o => o.enabled).reduce((s, e) => s + apply(afterDiscount, e), 0);
  const vat = cfg.vat.enabled ? (afterDiscount + scTotal + ocTotal) * cfg.vat.rate / 100 : 0;
  return afterDiscount + scTotal + ocTotal + vat;
}

export default function BillingPage() {
    const [supabase] = useState(() => createClient());
    const { toast } = useToast();
    const [tables, setTables] = useState<TableType[]>([]);
    const [orders, setOrders] = useState<Record<string, Order>>({}); // table_id -> Order
    const [isLoading, setIsLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [billingModalMode, setBillingModalMode] = useState<'review' | 'payment'>('review');
    const [confirmingTableId, setConfirmingTableId] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [guestInfoByCustomerId, setGuestInfoByCustomerId] = useState<Record<string, GuestInfo>>({});

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            // 1. Query active orders first — source of truth, not table.status
            const { data: ordersData, error: ordersError } = await supabase
                .from('orders')
                .select('*')
                .in('status', ['open', 'billed'])
                // Package-meal KOTs are room-service preparation records and
                // deliberately have no restaurant table. They belong in the
                // Kitchen queue, not the table Billing dashboard.
                .not('table_id', 'is', null)
                .order('created_at', { ascending: false });

            if (ordersError) throw ordersError;

            // 2. Build orders map (most recent per table)
            const ordersMap: Record<string, Order> = {};
            ordersData?.forEach((order: any) => {
                if (!ordersMap[order.table_id]) {
                    ordersMap[order.table_id] = order;
                }
            });
            setOrders(ordersMap);

            const customerIds = Array.from(new Set(ordersData?.map((order: any) => order.customer_id).filter(Boolean) ?? []));
            if (customerIds.length > 0) {
                const guestEntries = await Promise.all(customerIds.map(async (customerId) => {
                    try {
                        const response = await fetch(`/api/admin/front-desk/guest-pass?customer_id=${encodeURIComponent(customerId)}`);
                        if (!response.ok) return null;
                        const data = await response.json();
                        return [customerId, data.customer] as const;
                    } catch {
                        return null;
                    }
                }));
                setGuestInfoByCustomerId(Object.fromEntries(guestEntries.filter(Boolean) as Array<readonly [string, GuestInfo]>));
            } else {
                setGuestInfoByCustomerId({});
            }

            // 3. Fetch the tables that have active orders
            const tableIds = Object.keys(ordersMap);
            if (tableIds.length > 0) {
                const { data: tablesData, error: tablesError } = await supabase
                    .from('restaurant_tables')
                    .select('*')
                    .in('id', tableIds)
                    .order('table_number');

                if (tablesError) throw tablesError;
                setTables(tablesData as TableType[]);
            } else {
                setTables([]);
            }

        } catch (error: any) {
            const message = error?.message || error?.details || error?.hint || 'Failed to fetch billing data.';
            console.error('Error fetching billing data:', message, error);
            toast({ variant: 'destructive', title: 'Error', description: message });
        } finally {
            setIsLoading(false);
        }
    }, [supabase, toast]);

    useEffect(() => {
        fetchData();

        const channel = supabase
            .channel('billing-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchData, supabase]);

    const handleConfirmBill = async (tableId: string) => {
        const order = orders[tableId];
        if (!order || order.status !== 'billed') return;
        setConfirmingTableId(tableId);
        try {
            const [configRes, itemsRes] = await Promise.all([
                fetch('/api/admin/app-settings?key=restaurant_billing_config').then(r => r.json()),
                fetch(`/api/admin/orders?id=${order.id}`).then(r => r.json()),
            ]);
            const cfg: BillingConfig = configRes.value
                ? { vat: { enabled: false, rate: 0 }, service_charges: [], discounts: [], other_charges: [], ...configRes.value }
                : { vat: { enabled: false, rate: 0 }, service_charges: [], discounts: [], other_charges: [] };
            const itemsSubtotal = (itemsRes.items ?? []).reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
            const grandTotal = calcGrandTotal(itemsSubtotal, cfg);
            const apply = (base: number, e: ChargeEntry) => e.type === 'percentage' ? base * e.value / 100 : e.value;
            const scLines = cfg.service_charges.filter(s => s.enabled).map(s => ({ name: s.name, type: s.type, value: s.value, amount: apply(itemsSubtotal, s) }));
            const ocLines = cfg.other_charges.filter(o => o.enabled).map(o => ({ name: o.name, type: o.type, value: o.value, amount: apply(itemsSubtotal, o) }));
            const scTotal = scLines.reduce((s, l) => s + l.amount, 0);
            const ocTotal = ocLines.reduce((s, l) => s + l.amount, 0);
            const vatAmt = cfg.vat.enabled ? (itemsSubtotal + scTotal + ocTotal) * cfg.vat.rate / 100 : 0;
            const breakdown = {
                subtotal: itemsSubtotal,
                service_charge_lines: scLines,
                service_charge_total: scTotal,
                other_charge_lines: ocLines,
                other_charge_total: ocTotal,
                vat_rate: cfg.vat.enabled ? cfg.vat.rate : 0,
                vat_amount: vatAmt,
                grand_total: grandTotal,
            };
            const { error: confirmError } = await supabase
                .from('orders')
                .update({ confirmed_total: grandTotal, bill_breakdown: breakdown })
                .eq('id', order.id);
            if (confirmError) throw confirmError;
            toast({ title: 'Bill Confirmed', description: `Total LKR ${grandTotal.toFixed(2)} sent to waiter view.` });
            window.dispatchEvent(new Event('notifications-changed'));
            fetchData();
        } catch {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to confirm bill.' });
        } finally {
            setConfirmingTableId(null);
        }
    };

    const openBillingModal = (tableId: string, mode: 'review' | 'payment') => {
        const order = orders[tableId];
        if (order) {
            setSelectedOrder(order);
            setBillingModalMode(mode);
            setIsPaymentModalOpen(true);
        }
    };

    const getOrderSearchText = (table: TableType) => {
        const order = orders[table.id];
        const guest = order?.customer_id ? guestInfoByCustomerId[order.customer_id] : null;
        return [
            table.table_number,
            table.location,
            table.status,
            order?.id,
            order?.bill_number,
            order?.table_number,
            order?.waiter_name,
            order?.customer_mobile,
            order?.customer_id,
            guest?.name,
            guest?.current_room,
            guest?.phone,
        ].filter(Boolean).join(' ').toLowerCase();
    };

    const filteredTables = tables.filter(table => {
        const q = searchTerm.trim().toLowerCase();
        return !q || getOrderSearchText(table).includes(q);
    });

    const handleScan = async (decodedText: string) => {
        const code = decodedText.trim();
        setSearchTerm(code);
        try {
            const response = await fetch(`/api/admin/front-desk/guest-pass?code=${encodeURIComponent(code)}`);
            if (!response.ok) return;
            const data = await response.json();
            const customer = data.customer as GuestInfo | undefined;
            if (!customer?.id) return;
            setGuestInfoByCustomerId(current => ({ ...current, [customer.id]: customer }));
            const matchingEntry = Object.entries(orders).find(([, order]) => order.customer_id === customer.id);
            if (matchingEntry) {
                setSearchTerm(customer.current_room || customer.name || code);
                openBillingModal(matchingEntry[0], 'review');
            }
        } catch {
            // Keep the raw scanned text in the search box if it is not a guest pass.
        }
    };

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                    <Card key={i} className="h-64">
                        <CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader>
                        <CardContent><Skeleton className="h-32 w-full" /></CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Billing & Payments</h1>
                    <p className="text-muted-foreground">Manage active bills and process payments.</p>
                </div>
                <div className="flex gap-3 items-center">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={isRefreshing}
                        onClick={async () => { setIsRefreshing(true); await fetchData(); setIsRefreshing(false); }}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                        {isRefreshing ? 'Refreshing…' : 'Refresh'}
                    </Button>
                    <Card className="p-4 flex items-center gap-4 bg-primary/5 border-primary/20">
                        <div className="p-2 bg-primary/10 rounded-full text-primary"><DollarSign className="w-5 h-5" /></div>
                        <div>
                            <p className="text-sm text-muted-foreground font-medium">Active Bills</p>
                            <p className="text-2xl font-bold">{Object.keys(orders).length}</p>
                        </div>
                    </Card>
                </div>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={searchTerm}
                        onChange={event => setSearchTerm(event.target.value)}
                        placeholder="Search table, room, bill number, waiter, guest name or mobile"
                        className="pl-10"
                    />
                </div>
                <BarcodeScanner
                    title="Scan Guest QR"
                    description="Scan a guest pass QR code to find their active restaurant bill."
                    successTitle="QR Scanned"
                    onScan={handleScan}
                    trigger={(
                        <Button type="button" variant="outline" className="w-full sm:w-auto">
                            <ScanLine className="mr-2 h-4 w-4" />
                            Scan QR
                        </Button>
                    )}
                />
            </div>

            {tables.length === 0 ? (
                <div className="text-center py-20 bg-muted/30 rounded-lg border border-dashed">
                    <Coffee className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold">No Active Tables</h3>
                    <p className="text-muted-foreground">There are no occupied tables or active bills at the moment.</p>
                </div>
            ) : filteredTables.length === 0 ? (
                <div className="text-center py-16 bg-muted/30 rounded-lg border border-dashed">
                    <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">No Matching Bills</h3>
                    <p className="text-muted-foreground">Try another room, table, bill number, name or QR code.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredTables.map(table => {
                        const order = orders[table.id];
                        const guest = order?.customer_id ? guestInfoByCustomerId[order.customer_id] : null;
                        return (
                            <Card key={table.id} className={`flex flex-col border-t-4 ${order?.status === 'billed' ? 'border-t-green-500' : order ? 'border-t-yellow-400' : 'border-t-orange-500'}`}>
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-xl">Table {table.table_number}</CardTitle>
                                        <Badge variant={table.status === 'occupied' ? 'default' : 'secondary'}>
                                            {table.status}
                                        </Badge>
                                    </div>
                                    <CardDescription>{table.location || 'Main Hall'}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1 py-4">
                                    {order ? (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center bg-muted/50 p-2 rounded">
                                                <span className="text-sm font-medium">Total Bill</span>
                                                <span className="text-lg font-bold">LKR {order.total_price.toFixed(2)}</span>
                                            </div>
                                            <div className="text-sm text-muted-foreground space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <Clock className="w-4 h-4" />
                                                    <span>Started: {format(new Date(order.created_at || new Date()), 'hh:mm a')}</span>
                                                </div>
                                                {order.waiter_name && (
                                                    <div className="flex items-center gap-2">
                                                        <Users className="w-4 h-4" />
                                                        <span>Waiter: {order.waiter_name}</span>
                                                    </div>
                                                )}
                                                {guest && (
                                                    <div className="flex items-center gap-2">
                                                        <Users className="w-4 h-4" />
                                                        <span>{guest.name}{guest.current_room ? ` · ${guest.current_room}` : ''}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono uppercase bg-muted px-1 rounded">#{order.id.slice(0, 6)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-6">
                                            <p className="text-sm">Table occupied but no active order found.</p>
                                        </div>
                                    )}
                                </CardContent>
                                <CardFooter className="pt-2 flex flex-col gap-2">
                                    {order?.status === 'billed' && (
                                        <Button
                                            className="w-full"
                                            variant={order.confirmed_total ? 'outline' : 'secondary'}
                                            onClick={() => openBillingModal(table.id, 'review')}
                                        >
                                            <CheckCircle2 className="mr-2 h-4 w-4" />
                                            {order.confirmed_total
                                                ? `Confirmed: LKR ${order.confirmed_total.toFixed(2)}`
                                                : 'Review & Confirm Bill'}
                                        </Button>
                                    )}
                                    {order && (
                                        <Button
                                            className="w-full"
                                            variant="outline"
                                            onClick={() => openBillingModal(table.id, 'review')}
                                            disabled={order.status === 'open'}
                                        >
                                            <Pencil className="mr-2 h-4 w-4" />
                                            {order.status === 'open' ? 'Edit After Payment Request' : 'Edit Bill'}
                                        </Button>
                                    )}
                                    <Button
                                        className="w-full"
                                        onClick={() => openBillingModal(table.id, 'payment')}
                                        disabled={!order || order.status === 'open' || !order.confirmed_total}
                                        variant={order?.status === 'billed' ? 'default' : 'outline'}
                                    >
                                        {!order ? 'No Order' : order.status === 'open' ? 'Awaiting Payment Request' : !order.confirmed_total ? 'Confirm Bill First' : 'Process Payment'}
                                    </Button>
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>
            )}

            {selectedOrder && (
                <PaymentModal
                    isOpen={isPaymentModalOpen}
                    onClose={() => {
                        setIsPaymentModalOpen(false);
                        setSelectedOrder(null);
                        window.dispatchEvent(new Event('notifications-changed'));
                        fetchData(); // Refresh after payment
                    }}
                    order={selectedOrder}
                    mode={billingModalMode}
                />
            )}
        </div>
    );
}
