'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X, Loader2 } from 'lucide-react';

export type POItemRecord = {
    id?: string;
    item_id: string;
    item_name: string;
    unit: string;
    quantity: string;
    brand: string;
    supplier_name: string;
    item_size: string;
    unit_price: string;
};

type InventoryItem = { 
    id: string; 
    name: string; 
    unit?: { id: string; name: string } | string; 
    brand?: string; 
    supplier?: string; 
    item_size?: string 
};

interface POFormProps {
    initialData?: {
        supplier_name?: string;
        notes?: string;
        items?: POItemRecord[];
    };
    inventoryItems: InventoryItem[];
    onSubmit: (data: any) => Promise<void>;
    onCancel: () => void;
    isSubmitting: boolean;
    submitLabel?: string;
}

export function POForm({ 
    initialData, 
    inventoryItems, 
    onSubmit, 
    onCancel, 
    isSubmitting,
    submitLabel = 'Save Purchase Order'
}: POFormProps) {
    const [supplierName, setSupplierName] = useState(initialData?.supplier_name || '');
    const [notes, setNotes] = useState(initialData?.notes || '');
    const [lineItems, setLineItems] = useState<POItemRecord[]>(
        initialData?.items && initialData.items.length > 0 
            ? initialData.items 
            : [{ item_id: '', item_name: '', unit: 'units', quantity: '', brand: '', supplier_name: '', item_size: '', unit_price: '' }]
    );

    const addLine = () => setLineItems(prev => [...prev, { item_id: '', item_name: '', unit: 'units', quantity: '', brand: '', supplier_name: '', item_size: '', unit_price: '' }]);
    const removeLine = (idx: number) => setLineItems(prev => prev.filter((_, i) => i !== idx));
    
    const updateLine = (idx: number, field: keyof POItemRecord, value: string) => {
        setLineItems(prev => prev.map((item, i) => {
            if (i !== idx) return item;
            if (field === 'item_id') {
                const inv = inventoryItems.find(it => it.id === value);
                const unitName = typeof inv?.unit === 'string' ? inv.unit : (inv?.unit?.name ?? 'units');
                return { 
                    ...item, 
                    item_id: value, 
                    item_name: inv?.name ?? '', 
                    unit: unitName,
                    brand: inv?.brand ?? item.brand,
                    supplier_name: inv?.supplier ?? item.supplier_name,
                    item_size: unitName
                };
            }
            return { ...item, [field]: value };
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const validItems = lineItems.filter(l => l.item_name && l.quantity);
        onSubmit({
            supplier_name: supplierName || undefined,
            notes: notes || undefined,
            items: validItems.map(l => ({
                id: l.id,
                item_id: l.item_id || null,
                item_name: l.item_name,
                unit: l.unit,
                quantity: parseFloat(l.quantity),
                unit_price: l.unit_price ? parseFloat(l.unit_price) : null,
                brand: l.brand || null,
                item_size: l.item_size || null,
                supplier_name: l.supplier_name || null
            }))
        });
    };

    const calculateTotal = () => {
        return lineItems.reduce((sum, item) => {
            const qty = parseFloat(item.quantity) || 0;
            const price = parseFloat(item.unit_price) || 0;
            return sum + (qty * price);
        }, 0);
    };

    const hasPrices = lineItems.some(l => l.unit_price);

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            {/* General Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <Label className="text-sm font-semibold">Supplier Name <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
                    <Input className="mt-1" placeholder="e.g. ABC Suppliers" value={supplierName} onChange={e => setSupplierName(e.target.value)} />
                </div>
                <div>
                    <Label className="text-sm font-semibold">Notes <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
                    <Input className="mt-1" placeholder="Any additional delivery instructions..." value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
            </div>

            {/* Line Items */}
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                    <Label className="text-base font-semibold">Order Items</Label>
                    <Button type="button" variant="outline" size="sm" className="gap-2" onClick={addLine}>
                        <Plus className="h-4 w-4" /> Add Line Item
                    </Button>
                </div>
                
                <div className="space-y-4">
                    {lineItems.map((line, idx) => (
                        <div key={idx} className="p-4 border rounded-lg bg-slate-50/50 space-y-3 relative group">
                            {lineItems.length > 1 && (
                                <Button 
                                    type="button"
                                    variant="ghost" 
                                    size="icon" 
                                    className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity" 
                                    onClick={() => removeLine(idx)}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                <div className="md:col-span-5 space-y-1">
                                    <Label className="text-xs text-muted-foreground">Item Selection</Label>
                                    <div className="flex gap-2">
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            value={line.item_id}
                                            onChange={e => updateLine(idx, 'item_id', e.target.value)}
                                        >
                                            <option value="">Select item from inventory…</option>
                                            {inventoryItems.map(it => {
                                                const unitName = typeof it.unit === 'string' ? it.unit : (it.unit?.name ?? 'units');
                                                return (
                                                    <option key={it.id} value={it.id}>{it.name} ({unitName})</option>
                                                );
                                            })}
                                        </select>
                                        {!line.item_id && (
                                            <Input
                                                className="w-full"
                                                placeholder="Or custom item name"
                                                value={line.item_name}
                                                onChange={e => updateLine(idx, 'item_name', e.target.value)}
                                            />
                                        )}
                                    </div>
                                </div>
                                
                                <div className="md:col-span-2 space-y-1">
                                    <Label className="text-xs text-muted-foreground">Quantity</Label>
                                    <Input
                                        className="h-10"
                                        type="number"
                                        placeholder="Qty"
                                        value={line.quantity}
                                        onChange={e => updateLine(idx, 'quantity', e.target.value)}
                                    />
                                </div>

                                <div className="md:col-span-2 space-y-1">
                                    <Label className="text-xs text-muted-foreground">Est. Unit Price</Label>
                                    <Input
                                        className="h-10"
                                        type="number"
                                        step="0.01"
                                        placeholder="Price (LKR)"
                                        value={line.unit_price}
                                        onChange={e => updateLine(idx, 'unit_price', e.target.value)}
                                    />
                                </div>

                                <div className="md:col-span-3 space-y-1">
                                    <Label className="text-xs text-muted-foreground">Subtotal</Label>
                                    <div className="h-10 flex items-center px-3 bg-muted/50 rounded-md text-sm font-mono font-semibold">
                                        {line.quantity && line.unit_price 
                                            ? (parseFloat(line.quantity) * parseFloat(line.unit_price)).toLocaleString('en-US', { minimumFractionDigits: 2 })
                                            : '0.00'
                                        }
                                    </div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Brand</Label>
                                    <Input 
                                        className="h-9 text-sm" 
                                        placeholder="Brand (optional)" 
                                        value={line.brand} 
                                        onChange={e => updateLine(idx, 'brand', e.target.value)} 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Size / Pkg</Label>
                                    <Input 
                                        className="h-9 text-sm" 
                                        placeholder="Size/Pkg (optional)" 
                                        value={line.item_size} 
                                        onChange={e => updateLine(idx, 'item_size', e.target.value)} 
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Form Footer */}
            <div className="pt-6 border-t flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-right w-full md:w-auto">
                    {hasPrices && (
                        <div className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Estimated Total</span>
                            <span className="text-2xl font-headline font-bold text-primary">
                                LKR {calculateTotal().toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-3 w-full md:w-auto">
                    <Button variant="outline" onClick={onCancel} type="button">
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting} className="gap-2 px-8">
                        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        {submitLabel}
                    </Button>
                </div>
            </div>
        </form>
    );
}
