'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Warehouse, Package, ArrowUpRight, Scale, Filter, ChevronRight } from 'lucide-react';
import type { InventoryItem, InventoryWarehouse } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export default function StockOverviewPage() {
    const { toast } = useToast();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [itemsRes, warehousesRes] = await Promise.all([
                fetch('/api/admin/inventory/items'),
                fetch('/api/admin/inventory/warehouses')
            ]);

            const dataItems = await itemsRes.json();
            const dataWarehouses = await warehousesRes.json();

            if (dataItems.error) throw new Error(dataItems.error);
            if (dataWarehouses.error) throw new Error(dataWarehouses.error);

            setItems(dataItems.items || []);
            setWarehouses(dataWarehouses.warehouses?.filter((w: any) => w.is_active) || []);
        } catch (error: any) {
            console.error("Error fetching data:", error);
            toast({ variant: 'destructive', title: "Error", description: "Failed to load stock data." });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredItems = useMemo(() => {
        return items.filter(item => 
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.code.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [items, searchQuery]);

    // Statistics calc
    const stats = useMemo(() => {
        const totalValue = items.reduce((acc, item) => acc + (item.total_stock || 0), 0);
        const lowStockItems = items.filter(i => i.total_stock === 0).length;
        const mainStoreStock = items.reduce((acc, item) => {
            const mainStore = item.warehouse_stock?.find(ws => warehouses.find(w => w.id === ws.id)?.is_main);
            return acc + (mainStore?.total_stock || 0);
        }, 0);

        return { totalValue, lowStockItems, mainStoreStock };
    }, [items, warehouses]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Link href="/dashboard/inventory-management" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Inventory</Link>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Stock Overview</span>
                    </div>
                    <h1 className="text-3xl font-headline font-bold flex items-center gap-3">
                        <Scale className="h-8 w-8 text-primary" />
                        Multi-Warehouse Stock Matrix
                    </h1>
                    <p className="text-muted-foreground mt-1">Real-time distribution of items across all storage units.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/10">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-tight text-muted-foreground flex items-center gap-2">
                            <Package className="h-3 w-3" /> Total Physical Stock
                        </CardTitle>
                        <CardDescription className="text-2xl font-bold text-primary">{stats.totalValue.toLocaleString()}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                            Combined units across all warehouses
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-500/5 to-transparent border-amber-500/10">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-tight text-muted-foreground flex items-center gap-2">
                            <Filter className="h-3 w-3" /> Out of Stock Items
                        </CardTitle>
                        <CardDescription className="text-2xl font-bold text-amber-600">{stats.lowStockItems}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                            Items requiring immediate restock
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-500/5 to-transparent border-emerald-500/10">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-tight text-muted-foreground flex items-center gap-2">
                            <Warehouse className="h-3 w-3" /> Main Store Holding
                        </CardTitle>
                        <CardDescription className="text-2xl font-bold text-emerald-600">{stats.mainStoreStock.toLocaleString()}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                            Primary warehouse capacity utilization
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-none shadow-xl bg-white/50 backdrop-blur-sm">
                <CardHeader className="pb-0 pt-6">
                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                        <div className="relative w-full sm:max-w-sm">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search matrix by item..." 
                                className="pl-10 bg-white"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="h-8 px-3 rounded-full bg-white font-medium">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
                                Live Synchronization
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0 mt-6">
                    <ScrollArea className="w-full">
                        <div className="min-w-[800px]">
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow className="hover:bg-transparent border-b">
                                        <TableHead className="w-[300px] font-bold py-6">Inventory Product</TableHead>
                                        <TableHead className="w-[120px] font-bold text-center">Global Stock</TableHead>
                                        {warehouses.map(wh => (
                                            <TableHead key={wh.id} className="text-center font-bold px-4 min-w-[150px]">
                                                <div className="flex flex-col items-center gap-1">
                                                    <Warehouse className="h-3 w-3 text-primary/50" />
                                                    <span className="truncate max-w-[120px]">{wh.name}</span>
                                                    {wh.is_main && <span className="text-[8px] text-emerald-600 uppercase font-black tracking-tighter">Main</span>}
                                                </div>
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={warehouses.length + 2} className="h-64 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                                                    <div className="text-sm font-medium text-muted-foreground">Synthesizing Warehouse Matrix...</div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={warehouses.length + 2} className="h-32 text-center text-muted-foreground font-medium">
                                                No inventory mapping found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredItems.map(item => (
                                            <TableRow key={item.id} className="hover:bg-slate-50 transition-colors group">
                                                <TableCell className="py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-900 group-hover:text-primary transition-colors">{item.name}</span>
                                                        <span className="text-[10px] font-mono text-muted-foreground uppercase">{item.code} • {item.category?.name || 'GEN'}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex flex-col items-center">
                                                        <span className={cn("text-sm font-black", item.total_stock === 0 ? "text-destructive" : "text-slate-900")}>
                                                            {item.total_stock}
                                                        </span>
                                                        <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-widest">{item.unit?.name || 'Nos'}</span>
                                                    </div>
                                                </TableCell>
                                                {warehouses.map(wh => {
                                                    const stockInWh = item.warehouse_stock?.find(ws => ws.id === wh.id);
                                                    const qty = stockInWh?.total_stock || 0;
                                                    
                                                    return (
                                                        <TableCell key={wh.id} className="text-center border-l bg-slate-50/10 last:border-r">
                                                            <div className={cn(
                                                                "inline-flex flex-col items-center justify-center p-2 rounded-lg w-20 transition-all",
                                                                qty > 0 ? "bg-white border-2 border-emerald-100 ring-2 ring-emerald-50 shadow-sm" : "opacity-30 border border-dashed"
                                                            )}>
                                                                <span className={cn("text-sm font-bold", qty > 0 ? "text-emerald-700" : "text-slate-400")}>
                                                                    {qty}
                                                                </span>
                                                                {qty > 0 && <span className="text-[8px] font-black uppercase text-emerald-500/70">{item.unit?.name || 'Nos'}</span>}
                                                            </div>
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
