'use client';

import { useMemo, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Order, OrderItem, MenuItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

// Component to display a single order and its items
function OrderCard({
    order,
    onFulfill,
    menuItems,
    orderItems,
    isLoading
}: {
    order: Order,
    onFulfill: (orderId: string, items: OrderItem[]) => Promise<void>,
    menuItems: MenuItem[],
    orderItems: OrderItem[],
    isLoading: boolean,
}) {
    const handleFulfillClick = async () => {
        if (!orderItems) return;
        await onFulfill(order.id, orderItems);
    };

    const totalPrice = useMemo(() => {
        if (!orderItems) return 0;
        return orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0)
    }, [orderItems]);

    if (orderItems?.length === 0 && !isLoading) {
        return null;
    }

    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Table {order.table_number}</CardTitle>
                        <CardDescription>Waiter: {order.waiter_name}</CardDescription>
                    </div>
                    <Badge variant={order.status === 'open' ? 'default' : 'secondary'} className="capitalize">
                        {order.status}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="flex-1">
                {isLoading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-full" />
                    </div>
                ) : (
                    orderItems && orderItems.length > 0 ? (
                        <ScrollArea className="h-full">
                            <ul className="space-y-2">
                                {orderItems.map(item => (
                                    <li key={item.id} className="flex justify-between items-center">
                                        <span>{item.name} x {item.quantity}</span>
                                        <span>LKR {(item.price * item.quantity).toFixed(2)}</span>
                                    </li>
                                ))}
                            </ul>
                        </ScrollArea>
                    ) : (
                        <p className="text-sm text-muted-foreground">No items in this order.</p>
                    )
                )}
            </CardContent>
            <CardFooter className="flex flex-col gap-4 mt-auto border-t pt-4">
                <div className="w-full flex justify-between items-center font-bold text-lg">
                    <span>Total:</span>
                    <span>LKR {totalPrice.toFixed(2)}</span>
                </div>
                <Button className="w-full" onClick={handleFulfillClick} disabled={isLoading || !orderItems || orderItems.length === 0}>
                    <CheckCircle className="mr-2 h-4 w-4" /> Mark as Billed
                </Button>
            </CardFooter>
        </Card>
    );
}

// Main component for the active orders page
export default function ActiveOrdersPage() {
    const supabase = createClient();
    const { toast } = useToast();
    const [orders, setOrders] = useState<Order[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchOrders = async () => {
            setIsLoading(true);
            try {
                // Fetch Orders
                const { data: ordersData } = await supabase.from('orders').select('*').eq('status', 'open').order('created_at', { ascending: true });
                if (ordersData) setOrders(ordersData as any);

                // Fetch Menu Items (for pricing/names if needed, though they are in order_items)
                const { data: menuData } = await supabase.from('menu_items').select('*');
                if (menuData) setMenuItems(menuData as any);

            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchOrders();

        const channel = supabase.channel('active-orders-page')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                // Re-fetch logic or optimistically update
                fetchOrders();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);


    const handleFulfillOrder = async (orderId: string, itemsToFulfill: OrderItem[]) => {
        try {
            // Update status to 'billed' as 'fulfilled' is not in schema
            const { error } = await supabase.from('orders').update({
                status: 'billed',
                updated_at: new Date().toISOString()
            }).eq('id', orderId);

            if (error) throw error;

            toast({ title: "Order Billed", description: "The order has been marked as billed/fulfilled." });
            setOrders(prev => prev.filter(o => o.id !== orderId)); // Optimistic remove
        } catch (error) {
            console.error("Error fulfilling order:", error);
            toast({ variant: 'destructive', title: "Fulfillment Failed", description: "Could not update the order status." });
        }
    };

    if (isLoading && orders.length === 0) {
        return (
            <div className="container mx-auto p-4">
                <div className="mb-6">
                    <Skeleton className="h-10 w-1/3" />
                    <Skeleton className="h-4 w-2/3 mt-2" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {[...Array(4)].map((_, i) => (
                        <Card key={i}>
                            <CardHeader><Skeleton className="h-8 w-3/4" /></CardHeader>
                            <CardContent><Skeleton className="h-20 w-full" /></CardContent>
                            <CardFooter><Skeleton className="h-10 w-full" /></CardFooter>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    // orders state is already filtered by query but let's be safe or just use state
    const openOrders = orders;

    return (
        <div className="container mx-auto p-4">
            <div className="mb-6">
                <h1 className="text-3xl font-bold font-headline">Active Orders</h1>
                <p className="text-muted-foreground">Manage and fulfill customer orders as they come in.</p>
            </div>

            {openOrders.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {openOrders.map(order => (
                        <OrderCardWrapper key={order.id} order={order} menuItems={menuItems} onFulfill={handleFulfillOrder} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 border-2 border-dashed rounded-lg">
                    <Zap className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-2 text-sm font-medium text-foreground">No Active Orders</h3>
                    <p className="mt-1 text-sm text-muted-foreground">New orders will appear here as they are placed.</p>
                </div>
            )}
        </div>
    );
}

function OrderCardWrapper({ order, menuItems, onFulfill }: { order: Order, menuItems: MenuItem[], onFulfill: (orderId: string, items: OrderItem[]) => Promise<void> }) {
    const supabase = createClient();
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchItems = async () => {
            const { data } = await supabase.from('order_items').select('*').eq('order_id', order.id);
            if (data) setOrderItems(data as any);
            setIsLoading(false);
        };
        fetchItems();
    }, [order.id, supabase]);

    return <OrderCard order={order} orderItems={orderItems} isLoading={isLoading} menuItems={menuItems} onFulfill={onFulfill} />;
}