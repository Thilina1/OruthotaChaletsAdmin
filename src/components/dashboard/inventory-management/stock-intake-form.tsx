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
import type { HotelInventoryItem, InventoryDepartment } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoIcon, PackageOpen, Search, Barcode } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CreatableCombobox } from '@/components/ui/creatable-combobox';

const formSchema = z.object({
    item_id: z.string().min(1, { message: 'Please select an item.' }),
    quantity: z.coerce.number().min(0.01, { message: 'Quantity must be greater than 0.' }),
    brand: z.string().optional(),
    batch_number: z.string().optional(),
    supplier: z.string().optional(),
    expiry_date: z.string().optional(),
    unit_price: z.string().optional(),
    barcode: z.string().optional(),
    item_size: z.string().optional(),
    remarks: z.string().optional(),
});

interface StockIntakeFormProps {
    items: HotelInventoryItem[];
    departments: InventoryDepartment[];
    onSuccess: () => void;
}

export function StockIntakeForm({ items: allItems, departments, onSuccess }: StockIntakeFormProps) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [metadata, setMetadata] = useState<{
        brands: string[],
        suppliers: string[],
        sizes: string[],
        units: string[]
    }>({
        brands: [],
        suppliers: [],
        sizes: [],
        units: []
    });

    const fetchMetadata = async () => {
        try {
            const res = await fetch('/api/admin/inventory-metadata');
            if (!res.ok) {
                console.warn(`Metadata fetch failed with status ${res.status}`);
                return;
            }
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                const data = await res.json();
                if (data && !data.error) {
                    setMetadata(data);
                }
            }
        } catch (err) {
            console.error("Failed to fetch inventory metadata:", err);
        }
    };

    useEffect(() => {
        fetchMetadata();
    }, []);

    const handleCreateMetadata = async (type: string, name: string) => {
        if (!name) return;
        try {
            const res = await fetch('/api/admin/inventory-metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, name })
            });
            const data = await res.json();
            if (data.success || data.error === 'Already exists') {
                // Refresh metadata to show the new item in the list
                await fetchMetadata();
            }
        } catch (err) {
            console.error(`Failed to create ${type}:`, err);
        }
    };

    // Identify the Main Store/Warehouse
    const warehouse = useMemo(() => {
        return departments.find(d => {
            const name = d.name.toLowerCase();
            return name === 'store' || name === 'warehouse' || name === 'store (warehouse)' || name.includes('warehouse');
        });
    }, [departments]);

    // Only items in the Main Store
    const warehouseItems = useMemo(() => {
        if (!warehouse) return [];
        return allItems.filter(item => item.department_id === warehouse.id);
    }, [allItems, warehouse]);

    // Filter items based on search
    const filteredItems = useMemo(() => {
        if (!searchTerm) return warehouseItems.slice(0, 50); // Show first 50 by default
        const search = searchTerm.toLowerCase();
        return warehouseItems.filter(item => 
            item.name.toLowerCase().includes(search) || 
            item.category.toLowerCase().includes(search) ||
            item.barcode?.toLowerCase().includes(search)
        );
    }, [warehouseItems, searchTerm]);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            item_id: '',
            quantity: 1,
            brand: '',
            batch_number: '',
            supplier: '',
            expiry_date: '',
            unit_price: '',
            barcode: '',
            item_size: '',
            remarks: '',
        },
    });

    const selectedItemId = form.watch('item_id');
    const selectedItem = useMemo(() => 
        warehouseItems.find(i => i.id === selectedItemId), 
        [warehouseItems, selectedItemId]
    );

    // Auto-fill size and metadata when item changes
    useEffect(() => {
        if (selectedItem) {
            form.setValue('item_size', selectedItem.item_size || '');
        }
    }, [selectedItem, form]);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            setIsSubmitting(true);

            const payload = {
                item_id: values.item_id,
                received_quantity: values.quantity,
                brand: values.brand,
                item_size: values.item_size,
                batch_number: values.batch_number,
                supplier: values.supplier,
                expiry_date: values.expiry_date,
                unit_price: values.unit_price ? parseFloat(values.unit_price) : undefined,
                barcode: values.barcode,
                notes: values.remarks,
            };

            const res = await fetch('/api/admin/inventory-direct-grn', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast({
                title: "Stock Updated Successfully",
                description: `${values.quantity} ${selectedItem?.unit} of ${selectedItem?.name} added to stock.`,
            });
            onSuccess();
        } catch (error: any) {
            console.error("GRN Error:", error);
            toast({ variant: 'destructive', title: "Error", description: error.message || "Failed to process stock intake." });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!warehouse) {
        return (
            <Alert variant="destructive">
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                    Primary warehouse/store not found. Please ensure a department named "Store" or "Warehouse" exists.
                </AlertDescription>
            </Alert>
        );
    }

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

                    <FormField
                        control={form.control}
                        name="item_id"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Search & Select Item</FormLabel>
                                <div className="space-y-2">
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                            placeholder="Type product name or category..." 
                                            className="pl-8"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="bg-background">
                                                <SelectValue placeholder="Select from filtered results" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {filteredItems.length === 0 ? (
                                                <div className="p-2 text-sm text-center text-muted-foreground">No items found in Main Store</div>
                                            ) : (
                                                filteredItems.map(item => (
                                                    <SelectItem key={item.id} value={item.id}>
                                                        {item.name} <span className="text-xs text-muted-foreground">({item.category})</span>
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {selectedItem && (
                        <div className="flex items-center justify-between text-xs px-2 py-1 bg-background rounded-md border border-primary/10">
                            <span className="text-muted-foreground uppercase font-bold tracking-tight">Available Stock:</span>
                            <span className="font-bold text-primary">{selectedItem.current_stock} {selectedItem.unit}</span>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-lg bg-muted/30">
                    <h4 className="col-span-full text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Barcode className="h-3 w-3" />
                        Batch & Pricing Details (GRN)
                    </h4>
                    
                    <Alert className="col-span-full bg-blue-50 border-blue-200">
                        <InfoIcon className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-blue-700 text-xs">
                            This will <strong>immediately</strong> update the current stock levels and record a historical entry.
                        </AlertDescription>
                    </Alert>
                    
                    <FormField
                        control={form.control}
                        name="quantity"
                        render={({ field }) => (
                            <FormItem className="col-span-full">
                                <FormLabel className="font-bold text-foreground">Intake Quantity {selectedItem ? `(${selectedItem.unit})` : ''}</FormLabel>
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
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="item_size"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Size / Pkg</FormLabel>
                                <FormControl>
                                    <CreatableCombobox 
                                        options={metadata.sizes}
                                        value={field.value}
                                        onValueChange={(val) => {
                                            field.onChange(val);
                                            if (!metadata.sizes.some(s => s.toLowerCase() === val.toLowerCase())) {
                                                handleCreateMetadata('size', val);
                                            }
                                        }}
                                        placeholder="e.g. 1kg, 500ml"
                                    />
                                </FormControl>
                                <FormDescription className="text-[10px]">Confirmed variant size</FormDescription>
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

                        <FormField
                            control={form.control}
                            name="brand"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Brand</FormLabel>
                                    <FormControl>
                                        <CreatableCombobox 
                                            options={metadata.brands}
                                            value={field.value}
                                            onValueChange={(val) => {
                                                field.onChange(val);
                                                // Case-insensitive check
                                                if (val && !metadata.brands.some(b => b.toLowerCase() === val.toLowerCase())) {
                                                    handleCreateMetadata('brand', val);
                                                }
                                            }}
                                            placeholder="Select or type brand"
                                        />
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
                                            options={metadata.suppliers}
                                            value={field.value}
                                            onValueChange={(val) => {
                                                field.onChange(val);
                                                // Case-insensitive check
                                                if (val && !metadata.suppliers.some(s => s.toLowerCase() === val.toLowerCase())) {
                                                    handleCreateMetadata('supplier', val);
                                                }
                                            }}
                                            placeholder="Select or type supplier"
                                        />
                                    </FormControl>
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
                        name="barcode"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Batch Barcode (Optional)</FormLabel>
                                <FormControl>
                                    <Input placeholder="Scan or type barcode" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                    </div>
                </ScrollArea>

                <div className="pt-4 border-t">
                    <Button type="submit" className="w-full h-12 text-lg font-bold bg-green-600 hover:bg-green-700" disabled={isSubmitting || !selectedItemId}>
                        {isSubmitting ? 'Updating Stock...' : 'Post & Update Stock Immediately'}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
