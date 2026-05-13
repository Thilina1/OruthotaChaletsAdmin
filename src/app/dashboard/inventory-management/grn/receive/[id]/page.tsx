'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from '@/components/ui/badge';
import { useToast } from "@/hooks/use-toast";
import { 
    ArrowLeft, 
    PackageCheck, 
    PlusCircle, 
    Trash2, 
    Loader2, 
    Truck, 
    ChevronRight,
    AlertCircle,
    Calendar,
    Tag,
    Warehouse,
    ShoppingCart
} from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import Link from 'next/link';

export default function ReceiveGRNPage() {
    const router = useRouter();
    const params = useParams();
    const poId = params.id as string;
    const { toast } = useToast();

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [purchaseOrder, setPurchaseOrder] = useState<any | null>(null);
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);
    const [isAddingItem, setIsAddingItem] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    
    // Receive States
    const [receivedItems, setReceivedItems] = useState<any[]>([]);
    const [receivedQuantities, setReceivedQuantities] = useState<Record<string, string>>({});
    const [batchNumbers, setBatchNumbers] = useState<Record<string, string>>({});
    const [expiryDates, setExpiryDates] = useState<Record<string, string>>({});
    const [receiveMetadata, setReceiveMetadata] = useState<Record<string, { brand: string, supplier: string, size: string }>>({});
    const [itemPrices, setItemPrices] = useState<Record<string, string>>({});

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [poRes, itemsRes] = await Promise.all([
                fetch(`/api/admin/purchase-orders`),
                fetch('/api/admin/inventory/items')
            ]);

            const poData = await poRes.json();
            const itemsData = await itemsRes.json();

            if (poData.error) throw new Error(poData.error);
            if (itemsData.error) throw new Error(itemsData.error);

            const po = (poData.purchase_orders || []).find((p: any) => p.id === poId);
            if (!po) throw new Error("Purchase Order not found.");

            setPurchaseOrder(po);
            setInventoryItems(itemsData.items || []);
            setReceivedItems([...po.purchase_order_items]);
            
            const initialQtys: Record<string, string> = {};
            po.purchase_order_items.forEach((i: any) => initialQtys[i.id] = String(i.quantity));
            setReceivedQuantities(initialQtys);

        } catch (error: any) {
            console.error("Error fetching data:", error);
            toast({ variant: 'destructive', title: "Error", description: error.message });
            router.push('/dashboard/inventory-management/grn');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (poId) fetchData();
    }, [poId]);

    const handleAddExtraItem = (itemId: string) => {
        const item = inventoryItems.find(i => i.id === itemId);
        if (!item) return;

        const tempId = `extra-${Date.now()}`;
        const newItem = {
            id: tempId,
            item_id: item.id,
            item_name: item.name,
            unit: typeof item.unit === 'object' ? item.unit.name : item.unit,
            quantity: 0,
            brand: item.brand || '',
            supplier_name: item.supplier || '',
            item_size: item.item_size || '',
            is_extra: true
        };

        setReceivedItems(prev => [...prev, newItem]);
        setReceivedQuantities(prev => ({ ...prev, [tempId]: '0' }));
        setIsAddingItem(false);
        setSearchQuery("");
    };

    const handleRemoveItem = (id: string) => {
        setReceivedItems(prev => prev.filter(i => i.id !== id));
    };

    const handleReceive = async () => {
        if (!purchaseOrder) return;
        setIsSubmitting(true);
        try {
            const item_prices = receivedItems.map((item: any) => ({
                id: item.is_extra ? null : item.id,
                item_id: item.is_extra ? item.item_id : null,
                quantity: item.quantity,
                unit_price: itemPrices[item.id] ? parseFloat(itemPrices[item.id]) : null,
                received_quantity: receivedQuantities[item.id] ? parseFloat(receivedQuantities[item.id]) : item.quantity,
                batch_number: batchNumbers[item.id] || '',
                expiry_date: expiryDates[item.id] || null,
                brand: receiveMetadata[item.id]?.brand || item.brand || '',
                supplier_name: receiveMetadata[item.id]?.supplier || item.supplier_name || purchaseOrder.supplier_name || '',
                item_size: receiveMetadata[item.id]?.size || item.item_size || '',
            }));

            const res = await fetch(`/api/admin/purchase-orders/${purchaseOrder.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    status: 'received',
                    item_prices 
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast({ title: 'Success', description: 'Goods received and inventory updated.' });
            router.push('/dashboard/inventory-management/grn');
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground font-medium animate-pulse">Loading Purchase Order Details...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
                <ChevronRight className="h-4 w-4" />
                <Link href="/dashboard/inventory-management" className="hover:text-foreground transition-colors">Inventory</Link>
                <ChevronRight className="h-4 w-4" />
                <Link href="/dashboard/inventory-management/grn" className="hover:text-foreground transition-colors">GRN</Link>
                <ChevronRight className="h-4 w-4" />
                <span className="text-foreground font-medium uppercase text-[10px] tracking-widest font-black">Process Receipt</span>
            </div>

            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                        <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                            <PackageCheck className="h-7 w-7 text-primary" />
                        </div>
                        Receive Goods
                    </h1>
                    <p className="text-slate-500 font-medium">Fulfilling Purchase Order <span className="text-primary font-bold">#{purchaseOrder?.po_number}</span></p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="rounded-xl font-bold h-12 px-6" onClick={() => router.back()}>
                        Cancel
                    </Button>
                    <Button 
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black h-12 px-8 shadow-lg shadow-emerald-200 gap-2 transition-all hover:scale-[1.02]"
                        onClick={handleReceive}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Truck className="h-5 w-5" />}
                        Confirm Stock Intake
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Side info */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-6">
                        <div>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Supplier Information</h3>
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-slate-50 rounded-xl flex items-center justify-center border">
                                    <Warehouse className="h-5 w-5 text-slate-400" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800">{purchaseOrder?.supplier_name || 'Generic Supplier'}</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Main Provider</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Order Summary</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 font-medium">Status</span>
                                    <Badge className="capitalize bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-50">
                                        {purchaseOrder?.status}
                                    </Badge>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 font-medium">Items</span>
                                    <span className="font-bold">{purchaseOrder?.purchase_order_items.length}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 font-medium">Order Date</span>
                                    <span className="font-bold">{format(new Date(purchaseOrder?.created_at), 'PP')}</span>
                                </div>
                            </div>
                        </div>

                        {purchaseOrder?.notes && (
                            <div className="pt-4 border-t border-dashed">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 text-red-500 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    PO Notes
                                </h3>
                                <p className="text-xs text-slate-600 italic leading-relaxed bg-amber-50 p-3 rounded-xl border border-amber-100">
                                    "{purchaseOrder.notes}"
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10">
                        <h3 className="text-sm font-black text-primary mb-2 flex items-center gap-2">
                            <PlusCircle className="h-4 w-4" />
                            Add Extra Items
                        </h3>
                        <p className="text-xs text-primary/60 font-medium mb-4 leading-tight">Search and select items delivered that weren't on the PO.</p>
                        
                        <Popover open={isAddingItem} onOpenChange={setIsAddingItem}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={isAddingItem}
                                    className="w-full h-12 rounded-2xl bg-white border-primary/20 shadow-sm font-bold text-slate-600 justify-between px-4"
                                >
                                    <div className="flex items-center gap-2">
                                        <PlusCircle className="h-4 w-4 text-primary" />
                                        Select extra item...
                                    </div>
                                    <ChevronRight className="ml-2 h-4 w-4 shrink-0 opacity-50 rotate-90" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0 rounded-2xl border-slate-100 shadow-2xl overflow-hidden" align="start">
                                <Command className="rounded-none">
                                    <CommandInput 
                                        placeholder="Search by name or code..." 
                                        className="h-12 border-none focus:ring-0"
                                        value={searchQuery}
                                        onValueChange={setSearchQuery}
                                    />
                                    <CommandList className="max-h-[300px]">
                                        <CommandEmpty className="py-6 text-center text-sm text-slate-400 font-medium">No items found.</CommandEmpty>
                                        <CommandGroup>
                                            {inventoryItems
                                                .filter(i => !receivedItems.some(ri => ri.item_id === i.id))
                                                .map((item) => (
                                                    <CommandItem
                                                        key={item.id}
                                                        value={`${item.name} ${item.code || ''}`}
                                                        onSelect={() => handleAddExtraItem(item.id)}
                                                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50 aria-selected:bg-slate-50 rounded-xl m-1 transition-colors"
                                                    >
                                                        <div className="h-8 w-8 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                                                            <Tag className="h-4 w-4 text-slate-400" />
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-slate-700 truncate leading-tight">{item.name}</span>
                                                                {item.item_size && <Badge variant="outline" className="h-4 px-1 text-[8px] border-slate-200 font-bold bg-white">{item.item_size}</Badge>}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{item.unit?.name || item.unit}</span>
                                                                {item.code && (
                                                                    <>
                                                                        <span className="h-0.5 w-0.5 bg-slate-300 rounded-full" />
                                                                        <span className="text-[10px] text-primary font-black uppercase tracking-wider">{item.code}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                {/* Main Item List */}
                <div className="lg:col-span-3 space-y-4">
                    <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
                        <div className="p-6 border-b bg-slate-50/50 flex justify-between items-center">
                            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                <ShoppingCart className="h-5 w-5 text-slate-400" />
                                Receipt Details
                            </h2>
                            <Badge variant="outline" className="bg-white font-black text-[10px] tracking-widest text-slate-400">
                                {receivedItems.length} TOTAL ITEMS
                            </Badge>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            {receivedItems.map((item, idx) => (
                                <div key={item.id} className={cn(
                                    "p-6 rounded-2xl border transition-all hover:border-primary/20",
                                    item.is_extra ? "bg-amber-50/20 border-amber-100" : "bg-white border-slate-100"
                                )}>
                                    <div className="flex flex-col xl:flex-row gap-6">
                                        {/* Item Info */}
                                        <div className="flex-1 min-w-[240px]">
                                            <div className="flex items-start gap-3">
                                                <div className={cn(
                                                    "h-12 w-12 rounded-xl flex items-center justify-center border shrink-0",
                                                    item.is_extra ? "bg-amber-100 border-amber-200" : "bg-slate-50 border-slate-100"
                                                )}>
                                                    {item.is_extra ? <PlusCircle className="h-6 w-6 text-amber-600" /> : <PackageCheck className="h-6 w-6 text-slate-400" />}
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-black text-lg text-slate-800 leading-tight">{item.item_name}</h4>
                                                        {item.is_extra && (
                                                            <Badge className="bg-amber-500 text-white border-none font-black text-[8px] uppercase tracking-tighter h-4">EXTRA</Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                        {item.item_size && <span className="text-primary font-black">{item.item_size}</span>}
                                                        <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{item.unit?.name || item.unit}</span>
                                                        {!item.is_extra && (
                                                            <>
                                                                <span className="h-1 w-1 bg-slate-300 rounded-full" />
                                                                Ordered: {item.quantity}
                                                            </>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Input Controls */}
                                        <div className="flex-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 flex-grow">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Received Qty</label>
                                                <Input 
                                                    className="h-11 rounded-xl font-bold bg-slate-50 border-slate-200 focus:bg-white transition-all"
                                                    type="number"
                                                    value={receivedQuantities[item.id] ?? ''}
                                                    onChange={e => setReceivedQuantities(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unit Price (LKR)</label>
                                                <Input 
                                                    className="h-11 rounded-xl font-bold bg-slate-50 border-slate-200 focus:bg-white transition-all"
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="LKR 0.00"
                                                    value={itemPrices[item.id] ?? ''}
                                                    onChange={e => setItemPrices(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Batch Number</label>
                                                <Input 
                                                    className="h-11 rounded-xl font-mono text-xs bg-slate-50 border-slate-200 focus:bg-white transition-all"
                                                    placeholder="BATCH-XXXX"
                                                    value={batchNumbers[item.id] ?? ''}
                                                    onChange={e => setBatchNumbers(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Expiry Date</label>
                                                <Input 
                                                    className="h-11 rounded-xl text-xs bg-slate-50 border-slate-200 focus:bg-white transition-all"
                                                    type="date"
                                                    value={expiryDates[item.id] ?? ''}
                                                    onChange={e => setExpiryDates(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                />
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-end pb-1 gap-2">
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-11 w-11 rounded-xl text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100"
                                                onClick={() => handleRemoveItem(item.id)}
                                            >
                                                <Trash2 className="h-5 w-5" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Metadata Expandable Area */}
                                    <div className="mt-4 pt-4 border-t border-dashed grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] ml-1 flex items-center gap-1">
                                                <Tag className="h-2 w-2" /> Brand
                                            </label>
                                            <Input 
                                                className="h-9 rounded-lg text-xs bg-transparent border-slate-100 focus:border-primary/20"
                                                placeholder="e.g. Anchor, Munchee"
                                                value={receiveMetadata[item.id]?.brand ?? item.brand ?? ''}
                                                onChange={e => setReceiveMetadata(prev => ({ 
                                                    ...prev, 
                                                    [item.id]: { ...(prev[item.id] || { brand: item.brand || '', supplier: item.supplier_name || '', size: item.item_size || '' }), brand: e.target.value } 
                                                }))}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] ml-1 flex items-center gap-1">
                                                <Tag className="h-2 w-2" /> Supplier Name
                                            </label>
                                            <Input 
                                                className="h-9 rounded-lg text-xs bg-transparent border-slate-100 focus:border-primary/20"
                                                placeholder="Override supplier if needed"
                                                value={receiveMetadata[item.id]?.supplier ?? item.supplier_name ?? purchaseOrder.supplier_name ?? ''}
                                                onChange={e => setReceiveMetadata(prev => ({ 
                                                    ...prev, 
                                                    [item.id]: { ...(prev[item.id] || { brand: item.brand || '', supplier: item.supplier_name || '', size: item.item_size || '' }), supplier: e.target.value } 
                                                }))}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] ml-1 flex items-center gap-1">
                                                <Tag className="h-2 w-2" /> Size/Spec
                                            </label>
                                            <Input 
                                                className="h-9 rounded-lg text-xs bg-transparent border-slate-100 focus:border-primary/20"
                                                placeholder="e.g. 500g, 1L"
                                                value={receiveMetadata[item.id]?.size ?? item.item_size ?? ''}
                                                onChange={e => setReceiveMetadata(prev => ({ 
                                                    ...prev, 
                                                    [item.id]: { ...(prev[item.id] || { brand: item.brand || '', supplier: item.supplier_name || '', size: item.item_size || '' }), size: e.target.value } 
                                                }))}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {receivedItems.length === 0 && (
                                <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                                    <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center">
                                        <ShoppingCart className="h-8 w-8 text-slate-200" />
                                    </div>
                                    <p className="text-slate-400 font-bold">No items in this receipt. Add items or go back.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-900 p-8 rounded-3xl text-white flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="space-y-1">
                            <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Ready to finish?</p>
                            <h3 className="text-xl font-bold">Confirm your stock intake to update inventory.</h3>
                        </div>
                        <div className="flex gap-4">
                            <Button variant="ghost" className="text-white hover:bg-white/10 rounded-xl font-bold h-12" onClick={() => router.back()}>
                                Go Back
                            </Button>
                            <Button 
                                className="bg-white text-slate-900 hover:bg-slate-100 rounded-xl font-black h-12 px-10 shadow-xl transition-all hover:scale-[1.05]"
                                onClick={handleReceive}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Receive All Items"}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
