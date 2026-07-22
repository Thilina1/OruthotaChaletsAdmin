'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Order, OrderItem, MenuItem, User } from '@/lib/types';
import { useUserContext } from '@/context/user-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ChefHat, Clock, Flame, CheckCircle2, ClipboardCheck, History } from 'lucide-react';
import { cn } from '@/lib/utils';

// Cooked-to-order items are the ones marked 'Non-Inventoried' on the menu
// (raw-stock/bottled items are 'Inventoried' and don't need kitchen prep).
function isCookedItem(menuItemsById: Record<string, MenuItem>, orderItem: OrderItem) {
    return menuItemsById[orderItem.menu_item_id]?.stock_type === 'Non-Inventoried';
}

function minutesAgo(createdAt?: string) {
    if (!createdAt) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
}

const KITCHEN_STATUS_LABEL: Record<string, string> = {
    pending: 'Waiting',
    preparing: 'Cooking',
    ready: 'Ready',
    done: 'Done',
};

export default function KitchenOrdersPage() {
    const supabase = createClient();
    const { user } = useUserContext();
    const { toast } = useToast();
    const [orders, setOrders] = useState<Order[]>([]);
    const [orderItemsByOrder, setOrderItemsByOrder] = useState<Record<string, OrderItem[]>>({});
    const [menuItemsById, setMenuItemsById] = useState<Record<string, MenuItem>>({});
    const [kitchenStaff, setKitchenStaff] = useState<User[]>([]);
    const [preparedBySelection, setPreparedBySelection] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

    const fetchAll = async () => {
        try {
            // Only currently open tables — once billed/closed (payment done) the
            // order stops showing up here, so the kitchen sees just what's left to cook.
            const [{ data: ordersData }, { data: itemsData }, { data: menuData }, { data: usersData }] = await Promise.all([
                supabase.from('orders').select('*').eq('status', 'open').order('created_at', { ascending: true }),
                supabase.from('order_items').select('*').order('created_at', { ascending: true }),
                supabase.from('menu_items').select('*'),
                supabase.from('users').select('*').eq('role', 'kitchen').order('name'),
            ]);

            setOrders((ordersData as Order[]) || []);
            setKitchenStaff((usersData as User[]) || []);

            const menuMap: Record<string, MenuItem> = {};
            (menuData as MenuItem[] || []).forEach(m => { menuMap[m.id] = m; });
            setMenuItemsById(menuMap);

            const itemsByOrder: Record<string, OrderItem[]> = {};
            (itemsData as OrderItem[] || []).forEach(item => {
                if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
                itemsByOrder[item.order_id].push(item);
            });
            setOrderItemsByOrder(itemsByOrder);
        } catch (error) {
            console.error('Error fetching kitchen orders:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();

        const channel = supabase.channel('kitchen-orders-page')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchAll)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, fetchAll)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const handleUpdateStatus = async (itemId: string, nextStatus: 'preparing' | 'ready' | 'done') => {
        setUpdatingItemId(itemId);
        try {
            const payload: Record<string, any> = { kitchen_status: nextStatus };
            if (nextStatus === 'ready') {
                // Whoever was picked in the "Prepared By" dropdown, or the
                // logged-in kitchen user if nobody was explicitly selected —
                // recorded here since this is the step where cooking actually finishes.
                payload.prepared_by = preparedBySelection[itemId] || user?.id || null;
                payload.prepared_at = new Date().toISOString();
            }
            const { error } = await supabase.from('order_items').update(payload).eq('id', itemId);
            if (error) throw error;

            // Update local state immediately rather than waiting on the
            // realtime round-trip, so the card reflects the change right away.
            setOrderItemsByOrder(prev => {
                const next: Record<string, OrderItem[]> = {};
                for (const [orderId, items] of Object.entries(prev)) {
                    next[orderId] = items.map(i => i.id === itemId ? { ...i, ...payload } : i);
                }
                return next;
            });
        } catch (error: any) {
            // Supabase/Postgrest errors are plain objects, not Error instances —
            // console.error alone can render as "{}" in the browser, so pull the
            // actual message out explicitly.
            const message = error?.message || error?.details || error?.hint || 'Unknown error';
            console.error('Error updating kitchen status:', message, error);
            toast({ variant: 'destructive', title: 'Update Failed', description: message });
        } finally {
            setUpdatingItemId(null);
        }
    };

    const tickets = orders
        .map(order => ({
            order,
            // Once marked Done, an item drops off the active list — it's already
            // recorded in the Kitchen Order History, no need to keep it visible here.
            cookItems: (orderItemsByOrder[order.id] || []).filter(item =>
                isCookedItem(menuItemsById, item) && (item.kitchen_status || 'pending') !== 'done'
            ),
        }))
        .filter(t => t.cookItems.length > 0);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div>
                    <Skeleton className="h-9 w-64" />
                    <Skeleton className="h-4 w-96 mt-2" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {[...Array(4)].map((_, i) => (
                        <Card key={i}>
                            <CardHeader><Skeleton className="h-8 w-3/4" /></CardHeader>
                            <CardContent><Skeleton className="h-20 w-full" /></CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-headline font-bold flex items-center gap-2">
                        <ChefHat className="h-7 w-7 text-primary" />
                        Kitchen Orders
                    </h1>
                    <p className="text-muted-foreground">Items to cook for currently open tables. Disappears once served/done.</p>
                </div>
                <Button variant="outline" className="gap-2" asChild>
                    <Link href="/dashboard/kitchen/orders/history">
                        <History className="h-4 w-4" />
                        History
                    </Link>
                </Button>
            </div>

            {tickets.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {tickets.map(({ order, cookItems }) => {
                        const mins = minutesAgo(order.created_at);
                        return (
                            <Card key={order.id} className="h-full flex flex-col">
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle>Table {order.table_number}</CardTitle>
                                            <CardDescription>Waiter: {order.waiter_name}</CardDescription>
                                        </div>
                                        <Badge variant={mins >= 15 ? 'destructive' : 'secondary'} className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {mins}m
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-1">
                                    <ul className="space-y-3">
                                        {cookItems.map(item => {
                                            const status = item.kitchen_status || 'pending';
                                            return (
                                                <li key={item.id} className="flex flex-col gap-2 pb-3 border-b last:border-0 last:pb-0">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="font-medium truncate">{item.name} <span className="font-bold text-primary">x {item.quantity}</span></span>
                                                            <Badge
                                                                variant="outline"
                                                                className={cn(
                                                                    "w-fit mt-1 text-[10px]",
                                                                    status === 'pending' && "border-slate-300 text-slate-500",
                                                                    status === 'preparing' && "border-amber-300 text-amber-600 bg-amber-50",
                                                                    status === 'ready' && "border-emerald-300 text-emerald-600 bg-emerald-50"
                                                                )}
                                                            >
                                                                {KITCHEN_STATUS_LABEL[status]}
                                                            </Badge>
                                                        </div>
                                                        {status === 'pending' && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="gap-1 shrink-0"
                                                                disabled={updatingItemId === item.id}
                                                                onClick={() => handleUpdateStatus(item.id, 'preparing')}
                                                            >
                                                                <Flame className="h-3.5 w-3.5" />
                                                                Start Cooking
                                                            </Button>
                                                        )}
                                                        {status === 'ready' && (
                                                            <Button
                                                                size="sm"
                                                                className="gap-1 shrink-0"
                                                                disabled={updatingItemId === item.id}
                                                                onClick={() => handleUpdateStatus(item.id, 'done')}
                                                            >
                                                                <ClipboardCheck className="h-3.5 w-3.5" />
                                                                Mark Done
                                                            </Button>
                                                        )}
                                                    </div>
                                                    {status === 'preparing' && (
                                                        <div className="flex items-center gap-2">
                                                            <Select
                                                                value={preparedBySelection[item.id] || ''}
                                                                onValueChange={(val) => setPreparedBySelection(prev => ({ ...prev, [item.id]: val }))}
                                                            >
                                                                <SelectTrigger className="h-8 text-xs flex-1">
                                                                    <SelectValue placeholder={`Prepared By (default: ${user?.name || 'you'})`} />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {kitchenStaff.map(staff => (
                                                                        <SelectItem key={staff.id} value={staff.id} className="text-xs">
                                                                            {staff.name}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <Button
                                                                size="sm"
                                                                className="gap-1 shrink-0"
                                                                disabled={updatingItemId === item.id}
                                                                onClick={() => handleUpdateStatus(item.id, 'ready')}
                                                            >
                                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                                Mark Ready
                                                            </Button>
                                                        </div>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-16 border-2 border-dashed rounded-lg">
                    <ChefHat className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-2 text-sm font-medium text-foreground">Nothing to cook</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Cooked-to-order items from new table orders will appear here.</p>
                </div>
            )}
        </div>
    );
}
