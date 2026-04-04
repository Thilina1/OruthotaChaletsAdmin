'use client';

import { useForm, useWatch } from 'react-hook-form';
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
import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const TRANSACTION_TYPES = [
    { value: 'issue', label: 'Issue (Stock Out)' },
    { value: 'damage', label: 'Record Damage/Wastage' },
    { value: 'audit_adjustment', label: 'Physical Stock Take' },
] as const;

const DAMAGE_REASONS = ['Expired', 'Broken', 'Rotten', 'Theft', 'Other'] as const;

const formSchema = z.object({
    transaction_type: z.enum(['issue', 'damage', 'audit_adjustment']),
    quantity: z.coerce.number().min(0.01, { message: 'Quantity must be greater than 0.' }),
    reference_department: z.string().optional(),
    reason: z.string().optional(),
    remarks: z.string().min(1, { message: 'Please provide a reason for this change.' }),
    barcode: z.string().optional(),
    batch_number: z.string().optional(),
    brand: z.string().optional(),
    item_size: z.string().optional(),
    supplier: z.string().optional(),
    unit_price: z.coerce.number().optional(),
    expiry_date: z.string().optional(),
});

interface InventoryTransactionFormProps {
    item: HotelInventoryItem;
    departments: InventoryDepartment[];
    onSuccess: () => void;
}

export function InventoryTransactionForm({ item, departments, onSuccess }: InventoryTransactionFormProps) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [brands, setBrands] = useState<string[]>([]);
    const [suppliers, setSuppliers] = useState<string[]>([]);
    const [sizes, setSizes] = useState<string[]>([]);

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const [brandsRes, suppliersRes, sizesRes] = await Promise.all([
                    fetch('/api/admin/inventory-brands'),
                    fetch('/api/admin/inventory-suppliers'),
                    fetch('/api/admin/inventory-sizes')
                ]);
                const [brandsData, suppliersData, sizesData] = await Promise.all([
                    brandsRes.json(),
                    suppliersRes.json(),
                    sizesRes.json()
                ]);
                if (Array.isArray(brandsData)) setBrands(brandsData);
                if (Array.isArray(suppliersData)) setSuppliers(suppliersData);
                if (Array.isArray(sizesData)) setSizes(sizesData);
            } catch (err) {
                console.error("Failed to fetch inventory metadata:", err);
            }
        };
        fetchMetadata();
    }, []);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            transaction_type: 'issue',
            quantity: 1,
            reference_department: 'none',
            reason: 'Expired',
            remarks: '',
            barcode: '',
            batch_number: '',
            brand: item?.brand || '',
            item_size: item?.item_size || '',
            supplier: item?.supplier || '',
        },
    });

    const transactionType = useWatch({ control: form.control, name: 'transaction_type' });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            setIsSubmitting(true);

            const payload = {
                request_type: values.transaction_type,
                item_id: item.id,
                requested_quantity: values.quantity,
                action_metadata: {
                    reference_department: values.reference_department === 'none' ? null : values.reference_department,
                    reason: values.reason,
                    barcode: values.barcode,
                    batch_number: values.batch_number,
                    brand: values.brand,
                    item_size: values.item_size,
                    supplier: values.supplier,
                },
                notes: values.remarks,
            };

            const res = await fetch('/api/admin/inventory-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast({
                title: "Transaction Submitted",
                description: `Request to update stock for ${item.name} has been submitted for approval.`,
            });
            onSuccess();
        } catch (error: any) {
            console.error("Transaction Error:", error);
            toast({ variant: 'destructive', title: "Error", description: error.message || "Failed to process transaction." });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <ScrollArea className="h-[70vh] pr-4">
                    <div className="space-y-4 pt-2">

                <Alert>
                    <InfoIcon className="h-4 w-4" />
                    <AlertDescription>
                        Current Stock: <strong>{item.current_stock} {item.unit}</strong>
                    </AlertDescription>
                </Alert>

                <FormField
                    control={form.control}
                    name="transaction_type"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Action</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Action" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {TRANSACTION_TYPES.map(type => (
                                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>
                                {transactionType === 'audit_adjustment' ? 'Actual Count (Total)' : 'Quantity'}
                                <span className="text-muted-foreground font-normal ml-1">({item.unit})</span>
                            </FormLabel>
                            <FormControl>
                                <Input type="number" step="0.01" {...field} />
                            </FormControl>
                            <FormDescription>
                                {transactionType === 'audit_adjustment'
                                    ? 'Enter the physical count. System will adjust variance automatically.'
                                    : 'Enter the amount to add or deduct.'}
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-lg bg-muted/30">
                    <h4 className="col-span-full text-sm font-semibold text-primary">
                        Batch/Reference Info (Optional)
                    </h4>
                    
                    <FormField
                        control={form.control}
                        name="brand"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Brand</FormLabel>
                                <FormControl>
                                    <Input placeholder="Enter Brand" list="brands-list-manual" {...field} />
                                </FormControl>
                                <datalist id="brands-list-manual">
                                    {brands.map(b => (
                                        <option key={b} value={b} />
                                    ))}
                                </datalist>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="barcode"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Barcode Number</FormLabel>
                                <FormControl>
                                    <Input placeholder="Scan or type barcode" {...field} />
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
                                    <Input placeholder="Lot/Batch #" {...field} />
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
                                    <Input placeholder="e.g. 500ml, 1kg" {...field} list="sizes-list-manual" autoComplete="off" />
                                </FormControl>
                                <datalist id="sizes-list-manual">
                                    {sizes.map(s => (
                                        <option key={s} value={s} />
                                    ))}
                                </datalist>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="supplier"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Supplier</FormLabel>
                                <FormControl>
                                    <Input placeholder="Supplier Name" list="suppliers-list-manual" {...field} />
                                </FormControl>
                                <datalist id="suppliers-list-manual">
                                    {suppliers.map(s => (
                                        <option key={s} value={s} />
                                    ))}
                                </datalist>
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
                        name="expiry_date"
                        render={({ field }) => (
                            <FormItem className="col-span-full">
                                <FormLabel>Expiry Date</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} />
                                </FormControl>
                                <FormDescription>Leave blank if not applicable</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                {transactionType === 'issue' && (
                    <FormField
                        control={form.control}
                        name="reference_department"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Issuing To Store/Department</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Department" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="none">-- Select Department --</SelectItem>
                                        {departments.map(dept => (
                                            <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                {transactionType === 'damage' && (
                    <FormField
                        control={form.control}
                        name="reason"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Damage Reason</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Reason" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {DAMAGE_REASONS.map(reason => (
                                            <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                    </div>
                </ScrollArea>

                <div className="pt-4 border-t">
                    <Button type="submit" className="w-full font-bold" disabled={isSubmitting}>
                        {isSubmitting ? 'Processing...' : 'Confirm Transaction'}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
