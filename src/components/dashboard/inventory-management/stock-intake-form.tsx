'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { InventoryItem, InventoryWarehouse, InventoryItemCategory, InventoryUnit } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from 'react';
import { PackageOpen, Barcode } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CreatableCombobox } from '@/components/ui/creatable-combobox';

const formSchema = z.object({
    item_id: z.string().optional(),
    name: z.string().optional(),
    category_id: z.string().optional(),
    unit_id: z.string().optional(),
    quantity: z.coerce.number().min(0.01, { message: 'Quantity must be greater than 0.' }),
    warehouse_id: z.string().min(1, { message: 'Please select a warehouse.' }),
    unit_price: z.string().optional().refine(val => !val || parseFloat(val) >= 0, { message: "Price cannot be negative." }),
    batch_number: z.string().optional(),
    supplier: z.string().optional(),
    expiry_date: z.string().optional(),
    notes: z.string().optional(),
}).refine(data => data.item_id || data.name, {
    message: "Please select or enter a product name.",
    path: ["item_id"]
});

interface StockIntakeFormProps {
    items: InventoryItem[];
    warehouses: InventoryWarehouse[];
    categories: InventoryItemCategory[];
    units: InventoryUnit[];
    suppliers: any[];
    onSuccess: () => void;
}

export function StockIntakeForm({ items, warehouses, categories, units, suppliers, onSuccess }: StockIntakeFormProps) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Identify main warehouse
    const defaultWarehouse = useMemo(() => {
        return warehouses.find(w => w.is_main) || warehouses[0];
    }, [warehouses]);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            item_id: '',
            name: '',
            category_id: categories[0]?.id || '',
            unit_id: units[0]?.id || '',
            quantity: 1,
            warehouse_id: defaultWarehouse?.id || '',
            unit_price: '',
            batch_number: '',
            supplier: '',
            expiry_date: '',
            notes: '',
        },
    });

    const watchedItemId = form.watch('item_id');
    const watchedName = form.watch('name');

    const selectedItem = useMemo(() => {
        if (watchedItemId) return items.find(i => i.id === watchedItemId);
        return null;
    }, [items, watchedItemId]);

    const isNewItem = !selectedItem && (!!watchedName);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            setIsSubmitting(true);

            let finalCategoryId = values.category_id;
            let finalUnitId = values.unit_id;
            let finalSupplier = values.supplier;

            // Handle potential new category creation
            if (isNewItem && finalCategoryId && !categories.some(c => c.id === finalCategoryId)) {
                const res = await fetch('/api/admin/inventory/categories', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: finalCategoryId })
                });
                const data = await res.json();
                if (data.category) finalCategoryId = data.category.id;
            }

            // Handle potential new unit creation
            if (isNewItem && finalUnitId && !units.some(u => u.id === finalUnitId)) {
                const res = await fetch('/api/admin/inventory/units', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: finalUnitId })
                });
                const data = await res.json();
                if (data.unit) finalUnitId = data.unit.id;
            }

            // Handle potential new supplier creation
            if (finalSupplier && !suppliers?.some((s: any) => s.name === finalSupplier)) {
                await fetch('/api/admin/inventory/suppliers', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: finalSupplier })
                });
                // supplier is kept as string in inventory_batches anyway
            }

            const res = await fetch('/api/admin/inventory/stock-intake', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...values,
                    category_id: finalCategoryId,
                    unit_id: finalUnitId,
                    supplier: finalSupplier,
                    unit_price: values.unit_price ? parseFloat(values.unit_price) : 0
                }),
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast({
                title: "Stock Processed",
                description: `Inventory updated for ${selectedItem?.name || values.name}.`,
            });
            onSuccess();
        } catch (error: any) {
            console.error("GRN Error:", error);
            toast({ variant: 'destructive', title: "Error", description: error.message || "Failed to process stock intake." });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <ScrollArea className="h-[70vh] pr-4">
                    <div className="space-y-4">
                        <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <PackageOpen className="h-5 w-5 text-primary" />
                                <h3 className="font-bold text-primary">Goods Received Note (GRN)</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="item_id"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Select Product</FormLabel>
                                            <FormControl>
                                                <CreatableCombobox 
                                                    options={items.map(i => {
                                                        const unitName = units.find(u => u.id === i.unit_id)?.name;
                                                        return unitName ? `${i.name} (${unitName})` : i.name;
                                                    })}
                                                    value={selectedItem ? (selectedItem.unit?.name ? `${selectedItem.name} (${selectedItem.unit.name})` : selectedItem.name) : (form.watch('name') || '')}
                                                    onValueChange={(val) => {
                                                        // Parse "Name (Unit)" format
                                                        const nameMatch = val.match(/^(.*?)(?:\s\((.*?)\))?$/);
                                                        const actualName = nameMatch ? nameMatch[1] : val;
                                                        const unitHint = nameMatch ? nameMatch[2] : null;

                                                        const found = items.find(i => {
                                                            const itemUnitName = units.find(u => u.id === i.unit_id)?.name;
                                                            if (unitHint) {
                                                                return i.name.toLowerCase() === actualName.toLowerCase() && 
                                                                       itemUnitName?.toLowerCase() === unitHint.toLowerCase();
                                                            }
                                                            return i.name.toLowerCase() === actualName.toLowerCase();
                                                        });

                                                        if (found) {
                                                            form.setValue('item_id', found.id);
                                                            form.setValue('name', found.name);
                                                            form.setValue('category_id', found.category_id);
                                                            form.setValue('unit_id', found.unit_id);
                                                        } else {
                                                            form.setValue('item_id', '');
                                                            form.setValue('name', val);
                                                        }
                                                    }}
                                                    placeholder="Search or type new product..."
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="warehouse_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Target Warehouse</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select warehouse" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {warehouses.map(w => (
                                                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className={`grid grid-cols-2 gap-4 p-3 rounded-md transition-colors ${isNewItem ? 'bg-amber-50 border border-amber-200 animation-in fade-in' : 'bg-slate-50 border'}`}>
                                <FormField
                                    control={form.control}
                                    name="category_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={isNewItem ? "text-amber-800" : "text-slate-500"}>Category</FormLabel>
                                            <FormControl>
                                                <CreatableCombobox 
                                                    options={categories.map(c => c.name)}
                                                    value={categories.find(c => c.id === field.value)?.name || field.value || ''}
                                                    onValueChange={(val) => {
                                                        const found = categories.find(c => c.name === val);
                                                        field.onChange(found ? found.id : val);
                                                    }}
                                                    placeholder="Select or type new..."
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="unit_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className={isNewItem ? "text-amber-800" : "text-slate-500"}>Unit of Measure</FormLabel>
                                            <FormControl>
                                                <CreatableCombobox 
                                                    options={units.map(u => u.name)}
                                                    value={units.find(u => u.id === field.value)?.name || field.value || ''}
                                                    onValueChange={(val) => {
                                                        const found = units.find(u => u.name === val);
                                                        field.onChange(found ? found.id : val);
                                                    }}
                                                    placeholder="Select or type new..."
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-lg bg-muted/30">
                            <h4 className="col-span-full text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <Barcode className="h-3 w-3" />
                                Batch & Pricing Details
                            </h4>
                            
                            <FormField
                                control={form.control}
                                name="quantity"
                                render={({ field }) => (
                                    <FormItem className="col-span-full">
                                        <FormLabel className="font-bold text-foreground">
                                            Intake Quantity {selectedItem?.unit?.name ? `(${selectedItem.unit.name})` : ''}
                                        </FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" placeholder="0.00" {...field} className="text-lg font-bold" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="unit_price"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Unit Price (LKR)</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" placeholder="0.00" {...field} />
                                        </FormControl>
                                        <FormDescription className="text-[10px]">Price per unit for this intake</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="batch_number"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Batch Number</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Lot / Batch ID" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="supplier"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Supplier / Vendor</FormLabel>
                                        <FormControl>
                                            <CreatableCombobox 
                                                options={suppliers.map((s: any) => s.name)}
                                                value={field.value || ''}
                                                onValueChange={field.onChange}
                                                placeholder="Select or type new..."
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="expiry_date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Expiry Date</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notes / Remarks</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Any additional info..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </ScrollArea>

                <div className="pt-4 border-t">
                    <Button type="submit" className="w-full h-12 text-lg font-bold bg-green-600 hover:bg-green-700" disabled={isSubmitting}>
                        {isSubmitting ? 'Processing GRN...' : 'Post & Update Stock'}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
