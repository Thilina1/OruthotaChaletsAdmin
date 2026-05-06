'use client';

import React, { useState, useMemo } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Warehouse, Plus, Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import type { InventoryItem, InventoryWarehouse } from '@/lib/types';
import { cn } from "@/lib/utils";

interface WarehouseItemMatrixProps {
    items: InventoryItem[];
    warehouses: InventoryWarehouse[];
    onRefresh: () => void;
    isLoading: boolean;
}

export function WarehouseItemMatrix({ items, warehouses, onRefresh, isLoading }: WarehouseItemMatrixProps) {
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [isProcessing, setIsProcessing] = useState<string | null>(null);

    const filteredItems = useMemo(() => {
        return items.filter(item => 
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.code.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [items, searchQuery]);

    const handleAssign = async (itemId: string, warehouseId: string) => {
        const processKey = `${itemId}-${warehouseId}`;
        setIsProcessing(processKey);
        try {
            const res = await fetch('/api/admin/inventory-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    request_type: 'initial_stock',
                    item_id: itemId,
                    warehouse_id: warehouseId,
                    requested_quantity: 0,
                    immediate: true,
                    notes: 'Auto-initialized from Warehouse Matrix'
                }),
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast({
                title: "Warehouse Assigned",
                description: "Item initialized in warehouse with 0 quantity.",
            });
            onRefresh();
        } catch (error: any) {
            console.error("Assignment Error:", error);
            toast({
                variant: 'destructive',
                title: "Error",
                description: error.message || "Failed to assign warehouse."
            });
        } finally {
            setIsProcessing(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search items to manage warehouse availability..."
                        className="pl-9 bg-slate-50 border-slate-200"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="hidden md:flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Warehouse className="h-3.5 w-3.5" />
                    {warehouses.length} Warehouses Loaded
                </div>
            </div>

            <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50">
                                <TableHead className="w-[300px] font-bold">Item Details</TableHead>
                                {warehouses.map(wh => (
                                    <TableHead key={wh.id} className="text-center font-bold min-w-[150px]">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-slate-900">{wh.name}</span>
                                            <Badge variant="outline" className="text-[9px] h-4 font-bold uppercase tracking-tighter">
                                                {wh.is_main ? 'Main' : wh.department?.name || 'Dept'}
                                            </Badge>
                                        </div>
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={warehouses.length + 1} className="h-32 text-center">
                                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                            <Loader2 className="h-8 w-8 animate-spin" />
                                            <p className="text-sm font-medium">Loading matrix...</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={warehouses.length + 1} className="h-32 text-center text-muted-foreground italic">
                                        No items found matching your search.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredItems.map(item => (
                                    <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900">{item.name}</span>
                                                <span className="text-[10px] font-mono text-muted-foreground">{item.code} • {item.unit?.name}</span>
                                            </div>
                                        </TableCell>
                                        {warehouses.map(wh => {
                                            const stockEntry = item.warehouse_stock?.find(ws => ws.id === wh.id);
                                            const isLinked = !!stockEntry;
                                            const processKey = `${item.id}-${wh.id}`;
                                            const isThisProcessing = isProcessing === processKey;

                                            return (
                                                <TableCell key={wh.id} className="text-center">
                                                    {isLinked ? (
                                                        <div className="flex flex-col items-center gap-1">
                                                            <div className="flex items-center gap-1.5 text-emerald-600">
                                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                                <span className="text-sm font-black">{stockEntry.total_stock}</span>
                                                            </div>
                                                            <span className="text-[9px] font-bold text-muted-foreground uppercase">{item.unit?.name}</span>
                                                        </div>
                                                    ) : (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 text-[10px] font-bold hover:bg-primary/10 hover:text-primary gap-1"
                                                            onClick={() => handleAssign(item.id, wh.id)}
                                                            disabled={!!isProcessing}
                                                        >
                                                            {isThisProcessing ? (
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                            ) : (
                                                                <Plus className="h-3 w-3" />
                                                            )}
                                                            Initialize
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
            
            <div className="flex items-center justify-between text-[11px] text-muted-foreground px-2">
                <p>Showing {filteredItems.length} items across {warehouses.length} warehouses.</p>
                <p>Items with a green check are already initialized in that warehouse.</p>
            </div>
        </div>
    );
}
