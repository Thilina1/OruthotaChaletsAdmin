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
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ChefHat, Clock, Flame, CheckCircle2, History, Printer, Search, Maximize2, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

// Cooked-to-order items are the ones marked 'Non-Inventoried' on the menu.
// Custom items have no menu_item_id and must also go through kitchen prep.
function isCookedItem(menuItemsById: Record<string, MenuItem>, orderItem: OrderItem) {
    if (!orderItem.menu_item_id) return true;
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
    const [printTicket, setPrintTicket] = useState<{ order: Order; cookItems: OrderItem[] } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [collapsedOrders, setCollapsedOrders] = useState<Record<string, boolean>>({});

    const getKotNumber = (order: Order) => `KOT-${order.id.slice(0, 8).toUpperCase()}`;
    const packageMeal = (order: Order) => {
        if (!order.waiter_name?.startsWith('Package Meal|')) return null;
        const [, , date, meal, room] = order.waiter_name.split('|');
        return { date, meal, room };
    };

    const handlePrintTicket = (order: Order, cookItems: OrderItem[]) => {
        setPrintTicket({ order, cookItems });
        requestAnimationFrame(() => {
            requestAnimationFrame(() => window.print());
        });
    };

    useEffect(() => {
        const clearPrintTicket = () => setPrintTicket(null);
        window.addEventListener('afterprint', clearPrintTicket);
        return () => window.removeEventListener('afterprint', clearPrintTicket);
    }, []);

    const fetchAll = async () => {
        try {
            // Only currently open tables — once billed/closed (payment done) the
            // order stops showing up here, so the kitchen sees just what's left to cook.
            const [{ data: ordersData }, { data: itemsData }, { data: menuData }, { data: usersData }] = await Promise.all([
                supabase.from('orders').select('*').eq('status', 'open').order('created_at', { ascending: false }),
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
            window.dispatchEvent(new Event('notifications-changed'));

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

    const handleMarkOneReady = async (item: OrderItem) => {
        const currentPrepared = item.prepared_quantity ?? 0;
        const nextPrepared = Math.min(item.quantity, currentPrepared + 1);
        const isFullyReady = nextPrepared >= item.quantity;

        setUpdatingItemId(item.id);
        try {
            const payload: Record<string, any> = {
                prepared_quantity: nextPrepared,
                kitchen_status: isFullyReady ? 'ready' : 'preparing',
                prepared_by: preparedBySelection[item.id] || user?.id || null,
                prepared_at: isFullyReady ? new Date().toISOString() : null,
            };
            const { error } = await supabase.from('order_items').update(payload).eq('id', item.id);
            if (error) throw error;
            window.dispatchEvent(new Event('notifications-changed'));

            setOrderItemsByOrder(prev => {
                const next: Record<string, OrderItem[]> = {};
                for (const [orderId, items] of Object.entries(prev)) {
                    next[orderId] = items.map(existing => existing.id === item.id ? { ...existing, ...payload } : existing);
                }
                return next;
            });
        } catch (error: any) {
            const message = error?.message || error?.details || error?.hint || 'Unknown error';
            toast({ variant: 'destructive', title: 'Update Failed', description: message });
        } finally {
            setUpdatingItemId(null);
        }
    };

    // Older package-meal requests created one order per food line. Group those
    // legacy rows by booking/date/meal/room so Kitchen sees and prints one KOT
    // per meal, matching newly created grouped meal requests.
    const tickets = (() => {
        const grouped = new Map<string, { order: Order; cookItems: OrderItem[] }>();
        const regular: { order: Order; cookItems: OrderItem[] }[] = [];
        orders.forEach(order => {
            const cookItems = (orderItemsByOrder[order.id] || []).filter(item => (item.kitchen_status || 'pending') !== 'done');
            if (!cookItems.length) return;
            if (!packageMeal(order)) {
                regular.push({ order, cookItems });
                return;
            }
            const groupKey = order.waiter_name!.split('|').slice(0, 5).join('|');
            const existing = grouped.get(groupKey);
            if (existing) {
                existing.cookItems.push(...cookItems);
            } else {
                grouped.set(groupKey, { order: { ...order, waiter_name: groupKey }, cookItems: [...cookItems] });
            }
        });
        return [...regular, ...grouped.values()];
    })();

    const filteredTickets = tickets.filter(({ order, cookItems }) => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        return getKotNumber(order).toLowerCase().includes(query)
            || String(order.table_number ?? packageMeal(order)?.room ?? '').toLowerCase().includes(query)
            || (order.waiter_name || '').toLowerCase().includes(query)
            || cookItems.some(item => item.name.toLowerCase().includes(query));
    });

    const visibleTickets = expandedOrderId
        ? filteredTickets.filter(ticket => ticket.order.id === expandedOrderId)
        : filteredTickets;

    useEffect(() => {
        if (expandedOrderId && !tickets.some(ticket => ticket.order.id === expandedOrderId)) {
            setExpandedOrderId(null);
        }
    }, [expandedOrderId, tickets]);

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
        <>
        <div className="space-y-6 print:hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-headline font-bold flex items-center gap-2">
                        <ChefHat className="h-7 w-7 text-primary" />
                        Kitchen Order Tickets (KOT)
                    </h1>
                    <p className="text-muted-foreground">Kitchen tickets for table orders and confirmed package meals. Print each KOT and complete quantities one by one.</p>
                </div>
                <Button variant="outline" className="gap-2" asChild>
                    <Link href="/dashboard/kitchen/orders/history">
                        <History className="h-4 w-4" />
                        History
                    </Link>
                </Button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full max-w-xl">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={(event) => {
                            setSearchQuery(event.target.value);
                            setExpandedOrderId(null);
                        }}
                        placeholder="Search KOT, table, waiter, or item..."
                        className="pl-9"
                    />
                </div>
                {filteredTickets.length > 0 && (
                    <div className="flex shrink-0 gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setCollapsedOrders(current => {
                                const next = { ...current };
                                filteredTickets.forEach(ticket => { next[ticket.order.id] = true; });
                                return next;
                            })}
                        >
                            <ChevronUp className="mr-1 h-4 w-4" /> Collapse All
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setCollapsedOrders(current => {
                                const next = { ...current };
                                filteredTickets.forEach(ticket => { next[ticket.order.id] = false; });
                                return next;
                            })}
                        >
                            <ChevronDown className="mr-1 h-4 w-4" /> Expand All
                        </Button>
                    </div>
                )}
            </div>

            {expandedOrderId && (
                <Button
                    type="button"
                    variant="outline"
                    className="w-fit gap-2"
                    onClick={() => setExpandedOrderId(null)}
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to KOT List
                </Button>
            )}

            {visibleTickets.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {visibleTickets.map(({ order, cookItems }) => {
                        const mins = minutesAgo(order.created_at);
                        const meal = packageMeal(order);
                        const isExpanded = expandedOrderId === order.id;
                        const isCollapsed = !!collapsedOrders[order.id];
                        return (
                            <Card key={order.id} className={cn(
                                "h-full flex flex-col transition-all",
                                isExpanded && "col-span-full mx-auto w-full max-w-4xl shadow-xl"
                            )}>
                                <CardHeader
                                    className="pb-3 cursor-pointer select-none hover:bg-muted/30 transition-colors"
                                    role="button"
                                    tabIndex={0}
                                    aria-expanded={!isCollapsed}
                                    onClick={() => setCollapsedOrders(current => ({ ...current, [order.id]: !current[order.id] }))}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            setCollapsedOrders(current => ({ ...current, [order.id]: !current[order.id] }));
                                        }
                                    }}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="mb-1 font-mono text-xs font-black tracking-wider text-primary">
                                                {getKotNumber(order)}
                                            </div>
                                            <CardTitle>{meal ? `Room ${meal.room} · ${meal.meal}` : `Table ${order.table_number}`}</CardTitle>
                                            <CardDescription>{meal ? `Package meal · ${meal.date}` : `Waiter: ${order.waiter_name}`}</CardDescription>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <Badge variant={mins >= 15 ? 'destructive' : 'secondary'} className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {mins}m
                                            </Badge>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                className="h-7 gap-1 px-2 text-xs"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    handlePrintTicket(order, cookItems);
                                                }}
                                            >
                                                <Printer className="h-3.5 w-3.5" />
                                                Print KOT
                                            </Button>
                                            {!isExpanded && (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 gap-1 px-2 text-xs"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setExpandedOrderId(order.id);
                                                    }}
                                                >
                                                    <Maximize2 className="h-3.5 w-3.5" />
                                                    Full Width
                                                </Button>
                                            )}
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 gap-1 px-2 text-xs"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setCollapsedOrders(current => ({
                                                        ...current,
                                                        [order.id]: !current[order.id],
                                                    }));
                                                }}
                                            >
                                                {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                                                {isCollapsed ? 'Show' : 'Collapse'}
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                {!isCollapsed && <CardContent className="flex-1">
                                    <ul className="space-y-3">
                                        {cookItems.map(item => {
                                            const status = item.kitchen_status || 'pending';
                                            const requiresKitchenPrep = isCookedItem(menuItemsById, item);
                                            const preparedQuantity = status === 'ready'
                                                ? item.quantity
                                                : Math.min(item.quantity, item.prepared_quantity ?? 0);
                                            return (
                                                <li key={item.id} className={cn("flex flex-col gap-2 rounded-md border-b p-2 last:border-b", !item.menu_item_id && "border border-amber-300 bg-amber-50/70")}>
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex flex-col min-w-0">
                                                            <div className="flex items-center gap-1.5 font-medium truncate">
                                                                {item.name} <span className="font-bold text-primary">x {item.quantity}</span>
                                                                {!item.menu_item_id && <Badge className="bg-amber-500 text-[10px] text-white">Custom</Badge>}
                                                            </div>
                                                            {requiresKitchenPrep ? (
                                                                <>
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
                                                                    <span className="mt-1 text-[11px] font-semibold text-muted-foreground">
                                                                        Ready {preparedQuantity} / {item.quantity}
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                <Badge variant="outline" className="mt-1 w-fit border-blue-200 bg-blue-50 text-[10px] text-blue-700">
                                                                    No kitchen preparation
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        {requiresKitchenPrep && status === 'pending' && (
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
                                                        {requiresKitchenPrep && status === 'ready' && (
                                                            <Badge className="shrink-0 bg-blue-100 text-blue-700 border border-blue-200">
                                                                Waiting for waiter
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {requiresKitchenPrep && status === 'preparing' && (
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
                                                                onClick={() => handleMarkOneReady(item)}
                                                            >
                                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                                Mark 1 Ready
                                                            </Button>
                                                        </div>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </CardContent>}
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-16 border-2 border-dashed rounded-lg">
                    <ChefHat className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-2 text-sm font-medium text-foreground">
                        {tickets.length === 0 ? 'Nothing to cook' : 'No matching KOT found'}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {tickets.length === 0
                            ? 'Cooked-to-order items from new table orders will appear here.'
                            : 'Try another ticket number, table, waiter, or item name.'}
                    </p>
                </div>
            )}
        </div>

        {printTicket && (
            <div id="print-area" className="hidden print:block mx-auto w-[80mm] bg-white p-3 font-mono text-black">
                <div className="border-b-2 border-dashed border-black pb-3 text-center">
                    <div className="text-xl font-black">KITCHEN ORDER TICKET</div>
                    <div className="mt-1 text-lg font-black">{getKotNumber(printTicket.order)}</div>
                    <div className="mt-2 border-y border-black py-1 text-base font-bold">
                        {packageMeal(printTicket.order) ? `ROOM ${packageMeal(printTicket.order)!.room} · ${packageMeal(printTicket.order)!.meal.toUpperCase()}` : `TABLE ${printTicket.order.table_number}`}
                    </div>
                </div>
                <div className="space-y-1 border-b-2 border-dashed border-black py-3 text-sm">
                    <div className="flex justify-between"><span>Waiter</span><strong>{printTicket.order.waiter_name || '—'}</strong></div>
                    <div className="flex justify-between"><span>Time</span><strong>{printTicket.order.created_at ? new Date(printTicket.order.created_at).toLocaleString() : '—'}</strong></div>
                </div>
                <div className="py-3">
                    {printTicket.cookItems.map((item, index) => {
                        const requiresKitchenPrep = isCookedItem(menuItemsById, item);
                        const prepared = item.kitchen_status === 'ready'
                            ? item.quantity
                            : Math.min(item.quantity, item.prepared_quantity ?? 0);
                        return (
                            <div key={item.id} className="mb-3 border-b border-dotted border-black pb-2 last:mb-0 last:border-0">
                                <div className="flex items-start gap-2 text-base font-black">
                                    <span>{index + 1}.</span>
                                    <span className="flex-1">{item.name}</span>
                                    <span>× {item.quantity}</span>
                                </div>
                                <div className="mt-1 text-right text-xs">
                                    {requiresKitchenPrep ? `Ready: ${prepared}/${item.quantity}` : 'NO KITCHEN PREP'}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="border-t-2 border-dashed border-black pt-3 text-center text-xs">
                    {printTicket.cookItems.length} item line{printTicket.cookItems.length === 1 ? '' : 's'} · {printTicket.cookItems.reduce((sum, item) => sum + item.quantity, 0)} total units
                </div>
            </div>
        )}
        </>
    );
}
