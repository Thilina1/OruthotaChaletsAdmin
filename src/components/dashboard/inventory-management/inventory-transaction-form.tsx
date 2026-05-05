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
import type { InventoryItem, InventoryWarehouse, InventoryBatch } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoIcon, Warehouse, Layers, ArrowRightLeft } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const TRANSACTION_TYPES = [
    { value: 'issue', label: 'Issue (Stock Out)' },
    { value: 'transfer', label: 'Transfer between Warehouses' },
    { value: 'damage', label: 'Record Damage/Wastage' },
    { value: 'audit_adjustment', label: 'Physical Stock Take' },
] as const;

const DAMAGE_REASONS = ['Expired', 'Broken', 'Rotten', 'Theft', 'Other'] as const;

const formSchema = z.object({
    transaction_type: z.enum(['issue', 'damage', 'audit_adjustment', 'transfer']),
    warehouse_id: z.string().min(1, { message: 'Please select a source warehouse.' }),
    batch_id: z.string().optional(),
    quantity: z.coerce.number().min(0.01, { message: 'Quantity must be greater than 0.' }),
    reference_department: z.string().optional(),
    to_warehouse_id: z.string().optional(),
    reason: z.string().optional(),
    remarks: z.string().min(1, { message: 'Please provide a reason/remarks for this change.' }),
}).refine((data) => {
    if (data.transaction_type === 'transfer' && !data.to_warehouse_id) {
        return false;
    }
    return true;
}, {
    message: "Please select a destination warehouse for transfers.",
    path: ["to_warehouse_id"],
});

interface InventoryTransactionFormProps {
    item: InventoryItem;
    departments: InventoryWarehouse[]; // Passing warehouses as departments for compatibility
    onSuccess: () => void;
}

export function InventoryTransactionForm({ item, departments: warehouses, onSuccess }: InventoryTransactionFormProps) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            transaction_type: 'issue',
            warehouse_id: '',
            batch_id: 'auto',
            quantity: 1,
            reference_department: 'none',
            to_warehouse_id: '',
            reason: 'Expired',
            remarks: '',
        },
    });

    const transactionType = useWatch({ control: form.control, name: 'transaction_type' });
    const selectedWarehouseId = useWatch({ control: form.control, name: 'warehouse_id' });

    // Available batches for selected warehouse
    const availableBatches = useMemo(() => {
        if (!selectedWarehouseId || !item.warehouse_stock) return [];
        const whStock = item.warehouse_stock.find(ws => ws.id === selectedWarehouseId);
        return whStock?.batches || [];
    }, [item.warehouse_stock, selectedWarehouseId]);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            setIsSubmitting(true);

            const payload = {
                request_type: values.transaction_type,
                item_id: item.id,
                batch_id: values.batch_id || null,
                requested_quantity: values.quantity,
                warehouse_id: values.warehouse_id, // Pass to API for stock deduction
                action_metadata: {
                    requesting_department_id: values.warehouse_id,
                    reference_department: values.reference_department === 'none' ? null : values.reference_department,
                    reason: values.reason,
                },
                notes: values.remarks,
            };

            const res = await fetch('/api/admin/inventory-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...payload,
                    batch_id: values.batch_id === 'auto' ? null : values.batch_id,
                    immediate: values.transaction_type === 'transfer' || values.transaction_type === 'audit_adjustment' || values.transaction_type === 'issue' || values.transaction_type === 'damage', 
                    to_warehouse_id: values.to_warehouse_id,
                    action_metadata: {
                        ...payload.action_metadata,
                        transfer_to_warehouse_id: values.to_warehouse_id,
                    }
                }),
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast({
                title: values.transaction_type === 'transfer' ? "Stock Transferred" : "Transaction Submitted",
                description: values.transaction_type === 'transfer' 
                    ? `Successfully moved ${values.quantity} ${item.unit?.name || 'units'} across warehouses.`
                    : `Request for ${item.name} has been submitted for approval.`,
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
                        Total Stock: <strong>{item.total_stock} {item.unit?.name || 'Nos'}</strong>
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

                <div className="grid grid-cols-1 gap-4 p-4 border rounded-lg bg-muted/20">
                    <FormField
                        control={form.control}
                        name="warehouse_id"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-2">
                                    <Warehouse className="h-4 w-4" /> Source Warehouse
                                </FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select where stock is coming from" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {warehouses.map(wh => {
                                            const stockObj = item.warehouse_stock?.find(ws => ws.id === wh.id);
                                            const available = stockObj?.total_stock || 0;
                                            return (
                                                <SelectItem key={wh.id} value={wh.id}>
                                                    {wh.name} ({available} available)
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="batch_id"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-2">
                                    <Layers className="h-4 w-4" /> Specific Batch (Optional)
                                </FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Automatic (FIFO)" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="auto">Automatic (FIFO)</SelectItem>
                                        {availableBatches.map((batch: any) => (
                                            <SelectItem key={batch.id} value={batch.id}>
                                                {batch.batch_number} - {batch.quantity} remaining {batch.expiry_date ? `(Exp: ${batch.expiry_date})` : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormDescription className="text-[10px]">Leave empty to use oldest stock first.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>
                                {transactionType === 'audit_adjustment' ? 'Actual Count (Total)' : 'Quantity'}
                                <span className="text-muted-foreground font-normal ml-1">({item.unit?.name || 'Nos'})</span>
                            </FormLabel>
                            <FormControl>
                                <Input type="number" step="0.01" {...field} />
                            </FormControl>
                            <FormDescription>
                                {transactionType === 'audit_adjustment'
                                    ? 'Enter the physical count. System will adjust variance automatically.'
                                    : 'Enter the amount to affect from stock.'}
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {transactionType === 'issue' && (
                    <FormField
                        control={form.control}
                        name="reference_department"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Issuing To Department</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Department" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="none">-- Internal Use/General --</SelectItem>
                                        {warehouses.map(dept => (
                                            <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                {transactionType === 'transfer' && (
                    <FormField
                        control={form.control}
                        name="to_warehouse_id"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-2">
                                    <ArrowRightLeft className="h-4 w-4" /> Destination Warehouse
                                </FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select where to move stock to" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {warehouses.filter(w => w.id !== selectedWarehouseId).map(wh => (
                                            <SelectItem key={wh.id} value={wh.id}>
                                                {wh.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormDescription className="text-xs text-amber-600 font-medium">
                                    Stock will be moved immediately upon submission.
                                </FormDescription>
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

                <FormField
                    control={form.control}
                    name="remarks"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Remarks / Explanation</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Explain why this change is being made..." {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                    </div>
                </ScrollArea>

                <div className="pt-4 border-t">
                    <Button type="submit" className="w-full font-bold h-12 text-lg" disabled={isSubmitting}>
                        {isSubmitting ? 'Processing...' : (transactionType === 'transfer' ? 'Transfer Now' : 'Submit for Approval')}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
