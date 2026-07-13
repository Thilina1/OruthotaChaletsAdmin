'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
    TrendingUp, TrendingDown, ShoppingBag, DollarSign, Utensils,
    Clock, Trophy, RefreshCw, Calendar, Percent,
} from 'lucide-react';
import { format, startOfDay, startOfWeek, startOfMonth, subDays, eachDayOfInterval, eachHourOfInterval, startOfHour } from 'date-fns';

// ── Types ────────────────────────────────────────────────────────────────────
type Period = 'today' | 'week' | 'month' | '30days';

interface ClosedOrder {
    id: string;
    total_price: number;
    bill_breakdown: { service_charge_total?: number; service_charge_lines?: { name: string; amount: number }[] } | null;
    created_at: string;
    table_number: number;
    waiter_name: string;
}

interface RawOrderItem {
    id: string;
    order_id: string;
    menu_item_id: string;
    name: string;
    price: number;
    quantity: number;
}

interface MenuItem {
    id: string;
    name: string;
    category: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#ec4899'];

function fmt(n: number) { return `LKR ${n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

function KpiCard({
    title, value, sub, icon: Icon, trend, loading,
}: {
    title: string; value: string; sub?: string; icon: React.ElementType; trend?: number; loading: boolean;
}) {
    return (
        <Card>
            <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">{title}</p>
                        {loading ? <Skeleton className="h-8 w-32" /> : (
                            <p className="text-2xl font-bold">{value}</p>
                        )}
                        {sub && !loading && <p className="text-xs text-muted-foreground">{sub}</p>}
                    </div>
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Icon className="h-5 w-5 text-primary" />
                    </div>
                </div>
                {trend !== undefined && !loading && (
                    <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {Math.abs(trend).toFixed(1)}% vs previous period
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function RestaurantAnalyticsPage() {
    const supabase = createClient();
    const { toast } = useToast();

    const [period, setPeriod] = useState<Period>('week');
    const [isLoading, setIsLoading] = useState(true);
    const [orders, setOrders] = useState<ClosedOrder[]>([]);
    const [orderItems, setOrderItems] = useState<RawOrderItem[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

    // ── Date range from period ────────────────────────────────────────────────
    const { from, to } = useMemo(() => {
        const now = new Date();
        if (period === 'today') return { from: startOfDay(now), to: now };
        if (period === 'week') return { from: startOfWeek(now, { weekStartsOn: 1 }), to: now };
        if (period === 'month') return { from: startOfMonth(now), to: now };
        return { from: subDays(now, 29), to: now }; // 30days
    }, [period]);

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [ordersRes, menuRes] = await Promise.all([
                supabase
                    .from('orders')
                    .select('id, total_price, bill_breakdown, created_at, table_number, waiter_name')
                    .eq('status', 'closed')
                    .gte('created_at', from.toISOString())
                    .lte('created_at', to.toISOString())
                    .order('created_at', { ascending: false }),
                supabase
                    .from('menu_items')
                    .select('id, name, category'),
            ]);

            if (ordersRes.error) throw ordersRes.error;
            if (menuRes.error) throw menuRes.error;

            const fetchedOrders = (ordersRes.data ?? []) as ClosedOrder[];
            setOrders(fetchedOrders);
            setMenuItems((menuRes.data ?? []) as MenuItem[]);

            // Fetch order items for all closed orders
            if (fetchedOrders.length > 0) {
                const ids = fetchedOrders.map(o => o.id);
                const { data: items, error: itemsError } = await supabase
                    .from('order_items')
                    .select('id, order_id, menu_item_id, name, price, quantity')
                    .in('order_id', ids);
                if (itemsError) throw itemsError;
                setOrderItems((items ?? []) as RawOrderItem[]);
            } else {
                setOrderItems([]);
            }
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setIsLoading(false);
        }
    }, [from, to]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Analytics computations ────────────────────────────────────────────────
    const analytics = useMemo(() => {
        const menuMap: Record<string, MenuItem> = {};
        menuItems.forEach(m => { menuMap[m.id] = m; });

        // KPIs
        const totalRevenue = orders.reduce((s, o) => s + o.total_price, 0);
        const totalOrders = orders.length;
        const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        const totalServiceCharge = orders.reduce((s, o) => s + (o.bill_breakdown?.service_charge_total ?? 0), 0);

        // Daily revenue (for trend chart)
        const days = eachDayOfInterval({ start: from, end: to });
        const dailyRevenue = days.map(day => {
            const label = format(day, period === 'today' ? 'HH:mm' : 'MMM d');
            const dayStr = format(day, 'yyyy-MM-dd');
            const revenue = orders
                .filter(o => format(new Date(o.created_at), 'yyyy-MM-dd') === dayStr)
                .reduce((s, o) => s + o.total_price, 0);
            return { label, revenue };
        });

        // Orders by hour (0–23)
        const hourBuckets: Record<number, number> = {};
        orders.forEach(o => {
            const h = new Date(o.created_at).getHours();
            hourBuckets[h] = (hourBuckets[h] ?? 0) + 1;
        });
        const ordersByHour = Array.from({ length: 24 }, (_, h) => ({
            label: `${h.toString().padStart(2, '0')}:00`,
            orders: hourBuckets[h] ?? 0,
        })).filter((_, h) => h >= 6 && h <= 23); // show 06:00–23:00

        // Top selling items
        const itemMap: Record<string, { name: string; qty: number; revenue: number; category: string }> = {};
        orderItems.forEach(item => {
            if (!itemMap[item.menu_item_id]) {
                const menuItem = menuMap[item.menu_item_id];
                itemMap[item.menu_item_id] = {
                    name: item.name,
                    qty: 0,
                    revenue: 0,
                    category: menuItem?.category ?? 'Other',
                };
            }
            itemMap[item.menu_item_id].qty += item.quantity;
            itemMap[item.menu_item_id].revenue += item.price * item.quantity;
        });
        const topItems = Object.values(itemMap)
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 10);

        // Revenue by category
        const catMap: Record<string, number> = {};
        orderItems.forEach(item => {
            const cat = menuMap[item.menu_item_id]?.category ?? 'Other';
            catMap[cat] = (catMap[cat] ?? 0) + item.price * item.quantity;
        });
        const revenueByCategory = Object.entries(catMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        // Top waiters
        const waiterMap: Record<string, { name: string; orders: number; revenue: number }> = {};
        orders.forEach(o => {
            const name = o.waiter_name || 'Unknown';
            if (!waiterMap[name]) waiterMap[name] = { name, orders: 0, revenue: 0 };
            waiterMap[name].orders += 1;
            waiterMap[name].revenue += o.total_price;
        });
        const topWaiters = Object.values(waiterMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

        return {
            totalRevenue, totalOrders, avgOrder, totalServiceCharge,
            dailyRevenue, ordersByHour,
            topItems, revenueByCategory,
            topWaiters,
        };
    }, [orders, orderItems, menuItems, from, to, period]);

    // ── Render ────────────────────────────────────────────────────────────────
    const periodLabels: Record<Period, string> = {
        today: 'Today', week: 'This Week', month: 'This Month', '30days': 'Last 30 Days',
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Restaurant Analytics</h1>
                    <p className="text-muted-foreground">Revenue, sales, and performance overview.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {(['today', 'week', 'month', '30days'] as Period[]).map(p => (
                        <Button
                            key={p}
                            size="sm"
                            variant={period === p ? 'default' : 'outline'}
                            onClick={() => setPeriod(p)}
                        >
                            {periodLabels[p]}
                        </Button>
                    ))}
                    <Button size="sm" variant="ghost" onClick={fetchData} disabled={isLoading}>
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    title="Total Revenue"
                    value={fmt(analytics.totalRevenue)}
                    sub={`${analytics.totalOrders} orders`}
                    icon={DollarSign}
                    loading={isLoading}
                />
                <KpiCard
                    title="Service Charge Earned"
                    value={fmt(analytics.totalServiceCharge)}
                    sub={analytics.totalRevenue > 0 ? `${((analytics.totalServiceCharge / analytics.totalRevenue) * 100).toFixed(1)}% of revenue` : undefined}
                    icon={Percent}
                    loading={isLoading}
                />
                <KpiCard
                    title="Avg. Order Value"
                    value={fmt(analytics.avgOrder)}
                    icon={ShoppingBag}
                    loading={isLoading}
                />
                <KpiCard
                    title="Total Orders"
                    value={analytics.totalOrders.toString()}
                    sub="closed & paid"
                    icon={Utensils}
                    loading={isLoading}
                />
            </div>

            {/* Revenue Trend */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-primary" />
                            Revenue Trend
                        </CardTitle>
                        <CardDescription>{format(from, 'MMM d')} – {format(to, 'MMM d, yyyy')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-56 w-full" /> : (
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={analytics.dailyRevenue} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                                    <Tooltip formatter={(v: number) => [fmt(v), 'Revenue']} />
                                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                {/* Revenue by Category */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Utensils className="h-4 w-4 text-primary" />
                            Revenue by Category
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-56 w-full" /> : analytics.revenueByCategory.length === 0 ? (
                            <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">No data</div>
                        ) : (
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie
                                        data={analytics.revenueByCategory}
                                        cx="50%" cy="50%"
                                        innerRadius={50} outerRadius={85}
                                        dataKey="value"
                                        nameKey="name"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        labelLine={false}
                                    >
                                        {analytics.revenueByCategory.map((_, i) => (
                                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(v: number) => fmt(v)} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Peak Hours */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        Peak Hours
                    </CardTitle>
                    <CardDescription>Number of closed orders per hour</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? <Skeleton className="h-40 w-full" /> : (
                        <ResponsiveContainer width="100%" height={160}>
                            <BarChart data={analytics.ordersByHour} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={1} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={24} />
                                <Tooltip formatter={(v: number) => [v, 'Orders']} />
                                <Bar dataKey="orders" fill="hsl(var(--primary) / 0.7)" radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>

            {/* Top Items + Waiter + Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Top Selling Items */}
                <Card className="lg:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-primary" />
                            Top Selling Items
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                        ) : analytics.topItems.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">No sales data for this period.</p>
                        ) : (
                            <div className="space-y-1">
                                <div className="grid grid-cols-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-1 border-b">
                                    <span className="col-span-2">Item</span>
                                    <span className="text-right">Qty</span>
                                    <span className="text-right">Revenue</span>
                                </div>
                                {analytics.topItems.map((item, i) => (
                                    <div key={i} className="grid grid-cols-4 items-center py-2 hover:bg-muted/40 rounded px-1 text-sm">
                                        <div className="col-span-2 flex items-center gap-2 min-w-0">
                                            <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">{i + 1}</span>
                                            <div className="min-w-0">
                                                <p className="font-medium truncate">{item.name}</p>
                                                <p className="text-xs text-muted-foreground">{item.category}</p>
                                            </div>
                                        </div>
                                        <span className="text-right font-semibold">{item.qty}</span>
                                        <span className="text-right text-primary font-semibold">{fmt(item.revenue)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Waiter & Table performance */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-primary" />
                                Top Waiters
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <Skeleton className="h-32 w-full" /> : analytics.topWaiters.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No data</p>
                            ) : (
                                <div className="space-y-2">
                                    {analytics.topWaiters.map((w, i) => (
                                        <div key={i} className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Badge variant="outline" className="text-xs w-5 h-5 p-0 flex items-center justify-center shrink-0">{i + 1}</Badge>
                                                <span className="truncate">{w.name}</span>
                                            </div>
                                            <div className="text-right shrink-0 ml-2">
                                                <p className="text-xs font-bold text-primary">{fmt(w.revenue)}</p>
                                                <p className="text-[10px] text-muted-foreground">{w.orders} orders</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                </div>
            </div>

            {/* Recent Orders */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <ShoppingBag className="h-4 w-4 text-primary" />
                        Recent Closed Orders
                    </CardTitle>
                    <CardDescription>Last 10 paid bills in the selected period</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                    ) : orders.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No closed orders in this period.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-xs text-muted-foreground uppercase tracking-wider">
                                        <th className="text-left py-2 pr-4">Order</th>
                                        <th className="text-left py-2 pr-4">Table</th>
                                        <th className="text-left py-2 pr-4">Waiter</th>
                                        <th className="text-left py-2 pr-4">Time</th>
                                        <th className="text-right py-2">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.slice(0, 10).map(order => (
                                        <tr key={order.id} className="border-b last:border-0 hover:bg-muted/30">
                                            <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">#{order.id.slice(0, 6)}</td>
                                            <td className="py-2 pr-4 font-medium">Table {order.table_number}</td>
                                            <td className="py-2 pr-4 text-muted-foreground">{order.waiter_name || '—'}</td>
                                            <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">
                                                {format(new Date(order.created_at), 'MMM d, hh:mm a')}
                                            </td>
                                            <td className="py-2 text-right font-semibold text-primary">{fmt(order.total_price)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
