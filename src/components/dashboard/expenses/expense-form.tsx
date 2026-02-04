
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
import type { Expense } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const formSchema = z.object({
  date: z.date({
    required_error: "An expense date is required.",
  }),
  name: z.string().min(1, { message: 'Expense name or reference is required.' }),
  price: z.coerce.number().min(0, { message: 'Price must be a positive number.' }),
  remark: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ExpenseFormProps {
  expense?: Expense | null;
  onSubmit: (values: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export function ExpenseForm({ expense, onSubmit }: ExpenseFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: expense?.date ? new Date(expense.date) : new Date(),
      name: expense?.name || '',
      price: expense?.price || 0,
      remark: expense?.remark || '',
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
              <FormLabel>Date of Expense</FormLabel>
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
                <Input placeholder="e.g., Office Supplies" {...field} />
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
              <FormLabel>Price (LKR)</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" placeholder="e.g., 5000.00" {...field} />
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
                <Textarea placeholder="Additional notes about the expense." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit" className="w-full">
            {expense ? 'Update Expense' : 'Add Expense'}
        </Button>
      </form>
    </Form>
  );
}
