'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Table as TableType, Order, OrderItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, Clock, Users, Coffee } from 'lucide-react';
import { PaymentModal } from '@/components/dashboard/billing/payment-modal';
import { format } from 'date-fns';

export default function BillingPage() {
    const supabase = createClient();
    const { toast } = useToast();
    const [tables, setTables] = useState<TableType[]>([]);
    const [orders, setOrders] = useState<Record<string, Order>>({}); // table_id -> Order
    const [isLoading, setIsLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            // 1. Fetch tables that are occupied or have pending bills
            // Note: Schema has 'occupied' status. 'billed' status might be on the order, not the table?
            // Let's fetch all tables first or filter by status if possible. 
            // Ideally we want tables where status != 'available'
            const { data: tablesData, error: tablesError } = await supabase
                .from('restaurant_tables')
                .select('*')
                .neq('status', 'available')
                .order('table_number');

            if (tablesError) throw tablesError;
            setTables(tablesData as TableType[]);

            if (tablesData && tablesData.length > 0) {
                const tableIds = tablesData.map(t => t.id);
                // 2. Fetch active orders for these tables
                // Status could be 'open' or 'billed'
                const { data: ordersData, error: ordersError } = await supabase
                    .from('orders')
                    .select('*')
                    .in('table_id', tableIds)
                    .in('status', ['open', 'billed']);

                if (ordersError) throw ordersError;

                const ordersMap: Record<string, Order> = {};
                ordersData?.forEach((order: any) => {
                    ordersMap[order.table_id] = order;
                });
                setOrders(ordersMap);
            } else {
                setOrders({});
            }

        } catch (error) {
            console.error("Error fetching billing data:", error);
            toast({ variant: 'destructive', title: "Error", description: "Failed to fetch billing data." });
        } finally {
            setIsLoading(false);
        }
    }, [supabase, toast]);

    useEffect(() => {
        fetchData();

        // Subscription for real-time updates could go here
        const channel = supabase
            .channel('billing-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchData, supabase]);

    const handleProcessPayment = (tableId: string) => {
        const order = orders[tableId];
        if (order) {
            setSelectedOrder(order);
            setIsPaymentModalOpen(true);
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
                <div className="flex gap-4">
                    <Card className="p-4 flex items-center gap-4 bg-primary/5 border-primary/20">
                        <div className="p-2 bg-primary/10 rounded-full text-primary"><DollarSign className="w-5 h-5" /></div>
                        <div>
                            <p className="text-sm text-muted-foreground font-medium">Active Bills</p>
                            <p className="text-2xl font-bold">{Object.keys(orders).length}</p>
                        </div>
                    </Card>
                </div>
            </div>

            {tables.length === 0 ? (
                <div className="text-center py-20 bg-muted/30 rounded-lg border border-dashed">
                    <Coffee className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold">No Active Tables</h3>
                    <p className="text-muted-foreground">There are no occupied tables or active bills at the moment.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {tables.map(table => {
                        const order = orders[table.id];
                        return (
                            <Card key={table.id} className={`flex flex-col border-t-4 ${order ? 'border-t-green-500' : 'border-t-orange-500'}`}>
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
                                <CardFooter className="pt-2">
                                    <Button
                                        className="w-full"
                                        onClick={() => handleProcessPayment(table.id)}
                                        disabled={!order}
                                        variant={order ? 'default' : 'outline'}
                                    >
                                        {order ? 'Process Payment' : 'No Order'}
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
                        fetchData(); // Refresh after payment
                    }}
                    order={selectedOrder}
                />
            )}
        </div>
    );
}
