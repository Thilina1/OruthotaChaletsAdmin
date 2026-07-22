'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { OrderItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { ArrowLeft, ChefHat, ClipboardList, Trophy, Utensils, Package, Link as LinkIcon } from 'lucide-react';

function formatCurrency(n: number) {
    return n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type HistoryRow = OrderItem & {
    orders?: { table_number: number; waiter_name: string; created_at?: string } | null;
    prepared_by_user?: { name: string } | null;
};

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

export default function KitchenOrderHistoryPage() {
    const supabase = createClient();
    const [rows, setRows] = useState<HistoryRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [dateFrom, setDateFrom] = useState(todayStr());
    const [dateTo, setDateTo] = useState(todayStr());
    const [tableFilter, setTableFilter] = useState<string>('all');

    const [isLoadingStock, setIsLoadingStock] = useState(true);
    const [kitchenStockItemCount, setKitchenStockItemCount] = useState(0);
    const [kitchenStockValue, setKitchenStockValue] = useState(0);

    const fetchKitchenStock = async () => {
        setIsLoadingStock(true);
        try {
            const whRes = await fetch('/api/admin/inventory/warehouses?all=true');
            const whData = await whRes.json();
            const kitchenWarehouse = (whData.warehouses || []).find((w: any) =>
                w.name?.toLowerCase().trim() === 'kitchen' || w.department?.name?.toLowerCase().trim() === 'kitchen'
            );
            if (!kitchenWarehouse) {
                setKitchenStockItemCount(0);
                setKitchenStockValue(0);
                return;
            }

            const stockRes = await fetch(`/api/admin/inventory/stock-usage?warehouse_id=${kitchenWarehouse.id}`);
            const stockData = await stockRes.json();
            const items = stockData.items || [];
            setKitchenStockItemCount(items.length);
            const value = items.reduce((sum: number, item: any) =>
                sum + (item.batches || []).reduce((bSum: number, b: any) => bSum + Number(b.quantity || 0) * Number(b.buying_price || 0), 0), 0);
            setKitchenStockValue(value);
        } catch (error) {
            console.error('Error fetching kitchen stock value:', error);
        } finally {
            setIsLoadingStock(false);
        }
    };

    const fetchHistory = async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from('order_items')
                .select('*, orders(table_number, waiter_name, created_at), prepared_by_user:users!order_items_prepared_by_fkey(name)')
                .eq('kitchen_status', 'done')
                .order('prepared_at', { ascending: false })
                .limit(1000);

            if (dateFrom) query = query.gte('prepared_at', `${dateFrom}T00:00:00`);
            if (dateTo) query = query.lte('prepared_at', `${dateTo}T23:59:59`);

            const { data, error } = await query;
            if (error) throw error;
            setRows((data as HistoryRow[]) || []);
        } catch (error) {
            console.error('Error fetching kitchen history:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [dateFrom, dateTo]);

    useEffect(() => {
        fetchKitchenStock();
    }, []);

    const tableOptions = useMemo(() => {
        const set = new Set<number>();
        rows.forEach(r => { if (r.orders?.table_number != null) set.add(r.orders.table_number); });
        return Array.from(set).sort((a, b) => a - b);
    }, [rows]);

    const filteredRows = useMemo(() => {
        if (tableFilter === 'all') return rows;
        return rows.filter(r => String(r.orders?.table_number) === tableFilter);
    }, [rows, tableFilter]);

    const totalDishesPrepared = filteredRows.length;
    const totalItemsCooked = filteredRows.reduce((sum, r) => sum + Number(r.quantity || 0), 0);

    const byEmployee = useMemo(() => {
        const map: Record<string, number> = {};
        filteredRows.forEach(r => {
            const name = r.prepared_by_user?.name || 'Unassigned';
            map[name] = (map[name] || 0) + Number(r.quantity || 0);
        });
        return Object.entries(map)
            .map(([name, qty]) => ({ name, qty }))
            .sort((a, b) => b.qty - a.qty);
    }, [filteredRows]);

    const byItem = useMemo(() => {
        const map: Record<string, number> = {};
        filteredRows.forEach(r => {
            map[r.name] = (map[r.name] || 0) + Number(r.quantity || 0);
        });
        return Object.entries(map)
            .map(([name, qty]) => ({ name, qty }))
            .sort((a, b) => b.qty - a.qty);
    }, [filteredRows]);

    const topEmployee = byEmployee[0];
    const topItem = byItem[0];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" asChild>
                    <Link href="/dashboard/kitchen/orders">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Link>
                </Button>
            </div>

            <div>
                <h1 className="text-3xl font-headline font-bold flex items-center gap-2">
                    <ChefHat className="h-7 w-7 text-primary" />
                    Kitchen Order History
                </h1>
                <p className="text-muted-foreground">Completed dishes, filterable by date and table.</p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-end gap-4 bg-white p-4 rounded-xl border shadow-sm">
                <div className="space-y-1">
                    <Label className="text-xs">From</Label>
                    <Input type="date" className="w-40" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">To</Label>
                    <Input type="date" className="w-40" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Table</Label>
                    <Select value={tableFilter} onValueChange={setTableFilter}>
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="All Tables" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Tables</SelectItem>
                            {tableOptions.map(t => (
                                <SelectItem key={t} value={String(t)}>Table {t}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Report Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                            <ClipboardList className="h-4 w-4" /> Dishes Prepared
                        </CardTitle>
                    </CardHeader>
                    <CardContent><p className="text-2xl font-bold">{totalDishesPrepared}</p></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                            <Utensils className="h-4 w-4" /> Total Items Cooked
                        </CardTitle>
                    </CardHeader>
                    <CardContent><p className="text-2xl font-bold">{totalItemsCooked}</p></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                            <Trophy className="h-4 w-4" /> Top Employee
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-lg font-bold truncate">{topEmployee?.name || '—'}</p>
                        {topEmployee && <p className="text-xs text-muted-foreground">{topEmployee.qty} items cooked</p>}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                            <ChefHat className="h-4 w-4" /> Most Cooked Item
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-lg font-bold truncate">{topItem?.name || '—'}</p>
                        {topItem && <p className="text-xs text-muted-foreground">{topItem.qty} cooked</p>}
                    </CardContent>
                </Card>
            </div>

            {/* Kitchen Stock Snapshot */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> Kitchen Stock Available</CardTitle>
                    <CardDescription>Current raw-stock value sitting in the Kitchen warehouse right now.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wide">Items in Stock</p>
                            <p className="text-2xl font-bold">{isLoadingStock ? '—' : kitchenStockItemCount}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wide">Stock Value</p>
                            <p className="text-2xl font-bold">{isLoadingStock ? '—' : `LKR ${formatCurrency(kitchenStockValue)}`}</p>
                        </div>
                    </div>
                    <Button variant="link" className="px-0 mt-2 h-auto gap-1" asChild>
                        <Link href="/dashboard/kitchen/inventory-requests">
                            <LinkIcon className="h-3.5 w-3.5" />
                            View full stock & batch detail
                        </Link>
                    </Button>
                </CardContent>
            </Card>

            {/* Breakdown Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Cooked By Employee</CardTitle>
                        <CardDescription>Who prepared the most, most-active first.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Employee</TableHead>
                                    <TableHead className="text-right">Items Cooked</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {byEmployee.length === 0 ? (
                                    <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground">No data.</TableCell></TableRow>
                                ) : byEmployee.map(e => (
                                    <TableRow key={e.name}>
                                        <TableCell className="font-medium">{e.name}</TableCell>
                                        <TableCell className="text-right font-bold">{e.qty}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Cooked By Item</CardTitle>
                        <CardDescription>What got cooked the most.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Item</TableHead>
                                    <TableHead className="text-right">Quantity</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {byItem.length === 0 ? (
                                    <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground">No data.</TableCell></TableRow>
                                ) : byItem.map(i => (
                                    <TableRow key={i.name}>
                                        <TableCell className="font-medium">{i.name}</TableCell>
                                        <TableCell className="text-right font-bold">{i.qty}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* Full List */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Cooked Items List</CardTitle>
                    <CardDescription>Every completed dish in the selected range, most recent first.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Time Cooked</TableHead>
                                    <TableHead>Table</TableHead>
                                    <TableHead>Item</TableHead>
                                    <TableHead className="text-center">Qty</TableHead>
                                    <TableHead>Requested By</TableHead>
                                    <TableHead>Prepared By</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Loading...</TableCell></TableRow>
                                ) : filteredRows.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No completed items in this range.</TableCell></TableRow>
                                ) : (
                                    filteredRows.map(row => (
                                        <TableRow key={row.id}>
                                            <TableCell className="text-sm whitespace-nowrap">
                                                {row.prepared_at ? new Date(row.prepared_at).toLocaleString() : '—'}
                                            </TableCell>
                                            <TableCell className="text-sm">{row.orders?.table_number ?? '—'}</TableCell>
                                            <TableCell className="text-sm font-medium">{row.name}</TableCell>
                                            <TableCell className="text-center text-sm">{row.quantity}</TableCell>
                                            <TableCell className="text-sm">{row.orders?.waiter_name || '—'}</TableCell>
                                            <TableCell className="text-sm">{row.prepared_by_user?.name || 'Unassigned'}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
