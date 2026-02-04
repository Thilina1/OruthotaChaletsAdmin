
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import type { OtherIncome } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const formSchema = z.object({
  date: z.date({
    required_error: "An income date is required.",
  }),
  name: z.string().min(1, { message: 'Income name or reference is required.' }),
  price: z.coerce.number().min(0, { message: 'Amount must be a positive number.' }),
  remark: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface OtherIncomeFormProps {
  income?: OtherIncome | null;
  onSubmit: (values: Omit<OtherIncome, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export function OtherIncomeForm({ income, onSubmit }: OtherIncomeFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: income?.date ? new Date(income.date) : new Date(),
      name: income?.name || '',
      price: income?.price || 0,
      remark: income?.remark || '',
    },
  });

  const handleFormSubmit = (values: FormValues) => {
    onSubmit({
      ...values,
      date: format(values.date, 'yyyy-MM-dd'),
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
         <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Date of Income</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name / Reference</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Event Space Rental" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount (LKR)</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" placeholder="e.g., 50000.00" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="remark"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Remark</FormLabel>
              <FormControl>
                <Textarea placeholder="Additional notes about the income." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit" className="w-full">
            {income ? 'Update Income' : 'Add Income'}
        </Button>
      </form>
    </Form>
  );
}
