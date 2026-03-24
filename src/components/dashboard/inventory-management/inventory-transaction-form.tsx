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
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoIcon } from 'lucide-react';

const TRANSACTION_TYPES = [
    { value: 'receive', label: 'Receive (Stock In)' },
    { value: 'issue', label: 'Issue (Stock Out)' },
    { value: 'damage', label: 'Record Damage/Wastage' },
    { value: 'audit_adjustment', label: 'Physical Stock Take' },
] as const;

const DAMAGE_REASONS = ['Expired', 'Broken', 'Rotten', 'Theft', 'Other'] as const;

const formSchema = z.object({
    transaction_type: z.enum(['receive', 'issue', 'damage', 'audit_adjustment', 'initial_stock']),
    quantity: z.coerce.number().min(0.01, { message: 'Quantity must be greater than 0.' }),
    reference_department: z.string().optional(),
    reason: z.string().optional(),
    remarks: z.string().optional(),
});

interface InventoryTransactionFormProps {
    item: HotelInventoryItem;
    departments: InventoryDepartment[];
    onSuccess: () => void;
}

export function InventoryTransactionForm({ item, departments, onSuccess }: InventoryTransactionFormProps) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            transaction_type: 'issue',
            quantity: 1,
            reference_department: 'none',
            reason: 'Expired',
            remarks: '',
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

                <FormField
                    control={form.control}
                    name="remarks"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Remarks</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Optional details..." {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <Button type="submit" className="w-full mt-6" disabled={isSubmitting}>
                    {isSubmitting ? 'Processing...' : 'Confirm Transaction'}
                </Button>
            </form>
        </Form>
    );
}
