'use client';

import { useState, useMemo } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InventoryItem } from '@/lib/types';

const requestFormSchema = z.object({
    request_type: z.enum(['ADD_STOCK', 'NEW_ITEM']),
    item_id: z.string().optional(),
    requested_quantity: z.coerce.number().min(1, { message: 'Must be at least 1.' }),
    estimated_cost: z.coerce.number().optional(),
    brand: z.string().optional(),
    supplier_name: z.string().optional(),
    item_size: z.string().optional(),
    notes: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.request_type === 'ADD_STOCK' && !data.item_id) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Item selection is required for adding stock.',
            path: ['item_id'],
        });
    }
    if (data.request_type === 'NEW_ITEM' && (!data.notes || data.notes.length < 3)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Please describe the new item in the notes section.',
            path: ['notes'],
        });
    }
});

interface RequestFormProps {
    items: InventoryItem[];
    onSubmit: (values: z.infer<typeof requestFormSchema>) => void;
    defaultItemId?: string;
}

export function InventoryRequestForm({ items, onSubmit, defaultItemId }: RequestFormProps) {
    const form = useForm<z.infer<typeof requestFormSchema>>({
        resolver: zodResolver(requestFormSchema),
        defaultValues: {
            request_type: defaultItemId ? 'ADD_STOCK' : 'ADD_STOCK',
            item_id: defaultItemId || '',
            requested_quantity: 1,
            estimated_cost: 0,
            brand: '',
            supplier_name: '',
            item_size: '',
            notes: '',
        },
    });

    const requestType = form.watch('request_type');
    const selectedItemId = form.watch('item_id');
    const [open, setOpen] = useState(false);

    const selectedItem = items.find(i => i.id === selectedItemId);

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                <FormField
                    control={form.control}
                    name="request_type"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Request Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select request type" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="ADD_STOCK">Restock Existing Item</SelectItem>
                                    <SelectItem value="NEW_ITEM">Request New Product</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {requestType === 'ADD_STOCK' && (
                    <FormField
                        control={form.control}
                        name="item_id"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Select Product</FormLabel>
                                <Popover open={open} onOpenChange={setOpen} modal={true}>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={open}
                                                className={cn(
                                                    "justify-between font-normal",
                                                    !field.value && "text-muted-foreground"
                                                )}
                                            >
                                                {field.value
                                                    ? items.find((item) => item.id === field.value)?.name
                                                    : "Select an inventory item"}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[400px] sm:w-[500px] p-0" align="start">
                                        <Command filter={(value, search) => {
                                            if (value.toLowerCase().includes(search.toLowerCase())) return 1;
                                            return 0;
                                        }}>
                                            <CommandInput placeholder="Search inventory items..." />
                                            <CommandList>
                                                <CommandEmpty>No product found.</CommandEmpty>
                                                <CommandGroup>
                                                    {items.map((item) => {
                                                        const itemName = item.name || '';
                                                        const itemUnit = item.unit?.name || 'Nos';
                                                        const totalStock = item.total_stock || 0;
                                                        
                                                        return (
                                                            <CommandItem
                                                                value={itemName}
                                                                key={item.id}
                                                                onSelect={() => {
                                                                    form.setValue("item_id", item.id, { shouldValidate: true });
                                                                    setOpen(false);
                                                                }}
                                                            >
                                                                <div className={cn("flex items-center gap-2 w-full", totalStock === 0 ? "text-red-500 font-medium" : "")}>
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4 flex-shrink-0",
                                                                            item.id === field.value
                                                                                ? "opacity-100"
                                                                                : "opacity-0"
                                                                        )}
                                                                    />
                                                                    <span className="truncate">{itemName}</span>
                                                                    <span className={cn("ml-auto text-xs", totalStock === 0 ? "text-red-400" : "text-muted-foreground")}>
                                                                        {totalStock} {itemUnit} in stock
                                                                    </span>
                                                                </div>
                                                            </CommandItem>
                                                        );
                                                    })}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="brand"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Brand / Make</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g. Samsung, Holcim" {...field} />
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
                                    <Input placeholder="e.g. 50kg, 1L, Large" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="supplier_name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Preferred Supplier</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g. Keells, Local Vendor" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="requested_quantity"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Quantity {selectedItem ? `(${selectedItem.unit?.name || 'Nos'})` : ''}</FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="estimated_cost"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Estimated Total Cost (LKR)</FormLabel>
                                <FormControl>
                                    <Input type="number" step="0.01" {...field} />
                                </FormControl>
                                <FormDescription className="text-xs">Optional</FormDescription>
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
                            <FormLabel>{requestType === 'NEW_ITEM' ? 'Product Description / Details *' : 'Notes / Justification'}</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder={requestType === 'NEW_ITEM' ? "Describe the new item you want to request in detail..." : "Optional notes for the admin..."}
                                    rows={3}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="pt-4 border-t flex justify-end">
                    <Button type="submit">Submit Request</Button>
                </div>
            </form>
        </Form>
    );
}
