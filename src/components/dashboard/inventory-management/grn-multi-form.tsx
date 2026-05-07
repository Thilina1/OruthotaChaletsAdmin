'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X, Loader2, Truck, PackageOpen, Barcode, Trash2 } from 'lucide-react';
import { CreatableCombobox } from '@/components/ui/creatable-combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export type GRNItemRecord = {
    temp_id: string; // for React key tracking
    item_id: string;
    item_name: string;
    category_id: string;
    unit_id: string;
    quantity: string;
    unit_price: string;
    batch_number: string;
    expiry_date: string;
    brand: string;
    item_size: string;
};

interface GRNMultiFormProps {
    inventoryItems: any[];
    warehouses: any[];
    categories: any[];
    units: any[];
    suppliers: any[];
    onSubmit: (data: any) => Promise<void>;
    onCancel: () => void;
    isSubmitting: boolean;
}

export function GRNMultiForm({
    inventoryItems,
    warehouses,
    categories,
    units,
    suppliers,
    onSubmit,
    onCancel,
    isSubmitting
}: GRNMultiFormProps) {
    const { toast } = useToast();
    
    // Global Header State
    const [warehouseId, setWarehouseId] = useState('');

    useEffect(() => {
        const storeWh = warehouses.find(w => w.is_main) || 
                        warehouses.find(w => w.name.toLowerCase() === 'store') || 
                        warehouses.find(w => w.name.toLowerCase().includes('store')) ||
                        warehouses.find(w => w.name.toLowerCase().includes('main')) ||
                        warehouses[0];
        if (storeWh) setWarehouseId(storeWh.id);
    }, [warehouses]);

    const [supplierName, setSupplierName] = useState('');
    const [notes, setNotes] = useState('');

    // Line Items State
    const [lineItems, setLineItems] = useState<GRNItemRecord[]>([
        { temp_id: Math.random().toString(), item_id: '', item_name: '', category_id: '', unit_id: '', quantity: '1', unit_price: '', batch_number: '', expiry_date: '', brand: '', item_size: '' }
    ]);

    const addLine = () => {
        setLineItems(prev => [
            ...prev,
            { temp_id: Math.random().toString(), item_id: '', item_name: '', category_id: '', unit_id: '', quantity: '1', unit_price: '', batch_number: '', expiry_date: '', brand: '', item_size: '' }
        ]);
    };

    const removeLine = (id: string) => {
        if (lineItems.length <= 1) return;
        setLineItems(prev => prev.filter(item => item.temp_id !== id));
    };

    const updateLine = (tempId: string, field: keyof GRNItemRecord, value: string) => {
        setLineItems(prev => prev.map(item => {
            if (item.temp_id !== tempId) return item;

            if (field === 'item_id') {
                // If it's a known item, auto-fill metadata
                const nameMatch = value.match(/^(.*?)(?:\s\((.*?)\))?$/);
                const actualName = nameMatch ? nameMatch[1] : value;
                const unitHint = nameMatch ? nameMatch[2] : null;

                const found = inventoryItems.find(i => {
                    const itemUnitName = typeof i.unit === 'string' ? i.unit : (i.unit?.name ?? 'units');
                    if (unitHint) {
                        return i.name.toLowerCase() === actualName.toLowerCase() && 
                               itemUnitName.toLowerCase() === unitHint.toLowerCase();
                    }
                    return i.name.toLowerCase() === actualName.toLowerCase();
                });

                if (found) {
                    return { 
                        ...item, 
                        item_id: found.id, 
                        item_name: found.name, 
                        category_id: found.category_id || '', 
                        unit_id: found.unit_id || '',
                        brand: found.brand || '',
                        item_size: found.item_size || ''
                    };
                } else {
                    return { ...item, item_id: '', item_name: value };
                }
            }

            return { ...item, [field]: value };
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const validItems = lineItems.filter(l => (l.item_id || l.item_name) && l.quantity);
        if (validItems.length === 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please add at least one valid item.' });
            return;
        }

        if (!warehouseId) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please select a target warehouse.' });
            return;
        }

        onSubmit({
            warehouse_id: warehouseId,
            supplier: supplierName || undefined,
            notes: notes || undefined,
            items: validItems.map(l => ({
                item_id: l.item_id || null,
                name: l.item_name,
                category_id: l.category_id,
                unit_id: l.unit_id,
                quantity: parseFloat(l.quantity),
                unit_price: l.unit_price ? parseFloat(l.unit_price) : 0,
                batch_number: l.batch_number || null,
                expiry_date: l.expiry_date || null,
                brand: l.brand || null,
                item_size: l.item_size || null,
                notes: notes // Use global notes if line notes are added later
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

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            {/* Header / Global Details */}
            <div className="bg-primary/5 p-6 rounded-xl border border-primary/20 shadow-sm space-y-6">
                <div className="flex items-center gap-3">
                    <Truck className="h-6 w-6 text-primary" />
                    <h2 className="text-xl font-headline font-bold text-primary italic">Goods Received Note Header</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Target Warehouse <span className="text-destructive">*</span></Label>
                        <Select onValueChange={setWarehouseId} value={warehouseId} disabled>
                            <SelectTrigger className="bg-slate-100 cursor-not-allowed">
                                <SelectValue placeholder="Select warehouse" />
                            </SelectTrigger>
                            <SelectContent>
                                {warehouses.map(w => (
                                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground mt-1">GRN is always posted to the central store.</p>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Global Supplier (optional)</Label>
                        <CreatableCombobox 
                            options={suppliers.map(s => s.name)}
                            value={supplierName}
                            onValueChange={setSupplierName}
                            placeholder="Select or type supplier..."
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">General Notes</Label>
                        <Input 
                            value={notes} 
                            onChange={e => setNotes(e.target.value)} 
                            placeholder="Delivery remarks, invoice refs..."
                        />
                    </div>
                </div>
            </div>

            {/* Line Items */}
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-4">
                    <div className="flex items-center gap-2">
                        <PackageOpen className="h-5 w-5 text-muted-foreground" />
                        <h3 className="text-lg font-bold">Received Items</h3>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="gap-2 border-primary text-primary hover:bg-primary/5" onClick={addLine}>
                        <Plus className="h-4 w-4" /> Add Item Row
                    </Button>
                </div>

                <div className="space-y-6">
                    {lineItems.map((line, idx) => (
                        <div key={line.temp_id} className="relative group p-4 border rounded-xl bg-card hover:border-primary/50 transition-all shadow-sm">
                            <Button 
                                type="button"
                                variant="ghost" 
                                size="icon" 
                                className="absolute -right-3 -top-3 h-7 w-7 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" 
                                onClick={() => removeLine(line.temp_id)}
                            >
                                <X className="h-4 w-4" />
                            </Button>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                {/* Product Section */}
                                <div className="md:col-span-4 space-y-1.5">
                                    <Label className="text-xs font-bold text-muted-foreground tracking-wider uppercase">Item / Product Name</Label>
                                    <CreatableCombobox 
                                        options={inventoryItems.map(i => {
                                            const unitName = typeof i.unit === 'string' ? i.unit : (i.unit?.name ?? 'units');
                                            return `${i.name} (${unitName})`;
                                        })}
                                        value={line.item_id ? (line.item_name + (inventoryItems.find(it => it.id === line.item_id)?.unit?.name ? ` (${inventoryItems.find(it => it.id === line.item_id).unit.name})` : '')) : line.item_name}
                                        onValueChange={val => updateLine(line.temp_id, 'item_id', val)}
                                        placeholder="Search inventory or type new..."
                                    />
                                </div>

                                <div className="md:col-span-2 space-y-1.5">
                                    <Label className="text-xs font-bold text-muted-foreground tracking-wider uppercase">Qty</Label>
                                    <Input
                                        type="number"
                                        placeholder="0.00"
                                        value={line.quantity}
                                        onChange={e => updateLine(line.temp_id, 'quantity', e.target.value)}
                                        className="font-bold text-lg"
                                    />
                                </div>

                                <div className="md:col-span-2 space-y-1.5">
                                    <Label className="text-xs font-bold text-muted-foreground tracking-wider uppercase">Unit Price</Label>
                                    <Input
                                        type="number"
                                        placeholder="LKR"
                                        value={line.unit_price}
                                        onChange={e => updateLine(line.temp_id, 'unit_price', e.target.value)}
                                    />
                                </div>

                                <div className="md:col-span-2 space-y-1.5">
                                    <Label className="text-xs font-bold text-muted-foreground tracking-wider uppercase flex items-center gap-1"><Barcode className="h-3 w-3" /> Batch</Label>
                                    <Input 
                                        placeholder="L-001" 
                                        value={line.batch_number} 
                                        onChange={e => updateLine(line.temp_id, 'batch_number', e.target.value)} 
                                    />
                                </div>

                                <div className="md:col-span-2 space-y-1.5">
                                    <Label className="text-xs font-bold text-muted-foreground tracking-wider uppercase">Expiry</Label>
                                    <Input 
                                        type="date" 
                                        value={line.expiry_date} 
                                        onChange={e => updateLine(line.temp_id, 'expiry_date', e.target.value)} 
                                    />
                                </div>
                            </div>

                            {/* Additional Metadata (shown if it's a new item or if we want extra detail) */}
                            <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Category</Label>
                                    <CreatableCombobox 
                                        options={categories.map(c => c.name)}
                                        value={categories.find(c => c.id === line.category_id)?.name || line.category_id || ''}
                                        onValueChange={val => {
                                            const found = categories.find(c => c.name === val);
                                            updateLine(line.temp_id, 'category_id', found ? found.id : val);
                                        }}
                                        placeholder="Category..."
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Unit</Label>
                                    <CreatableCombobox 
                                        options={units.map(u => u.name)}
                                        value={units.find(u => u.id === line.unit_id)?.name || line.unit_id || ''}
                                        onValueChange={val => {
                                            const found = units.find(u => u.name === val);
                                            updateLine(line.temp_id, 'unit_id', found ? found.id : val);
                                        }}
                                        placeholder="Unit..."
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Brand</Label>
                                    <Input 
                                        className="h-8 text-xs" 
                                        placeholder="Brand (optional)" 
                                        value={line.brand} 
                                        onChange={e => updateLine(line.temp_id, 'brand', e.target.value)} 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Size / Pkg</Label>
                                    <Input 
                                        className="h-8 text-xs" 
                                        placeholder="e.g. 500g (optional)" 
                                        value={line.item_size} 
                                        onChange={e => updateLine(line.temp_id, 'item_size', e.target.value)} 
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer / Summary */}
            <div className="pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <div className="flex flex-col items-start px-4 py-2 bg-slate-100 rounded-lg border border-slate-200">
                        <span className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Estimated GRN Value</span>
                        <span className="text-2xl font-headline font-bold text-primary">
                            LKR {calculateTotal().toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
                
                <div className="flex gap-4 w-full md:w-auto">
                    <Button type="button" variant="ghost" onClick={onCancel} className="flex-1 md:flex-none">
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting} className="flex-1 md:flex-none h-14 px-12 text-lg font-bold bg-green-600 hover:bg-green-700 shadow-lg gap-2">
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Processing GRN...
                            </>
                        ) : (
                            <>
                                <Truck className="h-5 w-5" />
                                Post Goods Received Note
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </form>
    );
}
