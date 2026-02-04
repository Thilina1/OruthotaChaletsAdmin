
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { LoyaltyCustomer } from '@/lib/types';
import { format } from 'date-fns';

const formSchema = z.object({
  name: z.string().min(1, { message: 'Customer name is required.' }),
  mobile_number: z.string().min(10, { message: 'A valid mobile number is required.' }),
  dob_day: z.string().min(1, 'Day is required.'),
  dob_month: z.string().min(1, 'Month is required.'),
  dob_year: z.string().min(1, 'Year is required.'),
  total_loyalty_points: z.coerce.number().min(0, { message: 'Loyalty points must be a positive number.' }),
});

type FormValues = z.infer<typeof formSchema>;

interface LoyaltyFormProps {
  customer?: LoyaltyCustomer | null;
  onSubmit: (values: Omit<LoyaltyCustomer, 'id' | 'created_at' | 'updated_at'>) => void;
}
// ... (omitting unchanged lines for brevity if possible, but replace needs full match or enough context)
// Let's replace the schema and props definition first.


const months = [
  { value: '01', label: 'January' }, { value: '02', label: 'February' },
  { value: '03', label: 'March' }, { value: '04', label: 'April' },
  { value: '05', label: 'May' }, { value: '06', label: 'June' },
  { value: '07', label: 'July' }, { value: '08', label: 'August' },
  { value: '09', label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' }, { value: '12', label: 'December' },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 100 }, (_, i) => (currentYear - i).toString());
const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));


export function LoyaltyForm({ customer, onSubmit }: LoyaltyFormProps) {
  const defaultDob = customer?.dob ? new Date(customer.dob) : null;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: customer?.name || '',
      mobile_number: customer?.mobile_number || '',
      dob_day: defaultDob ? format(defaultDob, 'dd') : '',
      dob_month: defaultDob ? format(defaultDob, 'MM') : '',
      dob_year: defaultDob ? format(defaultDob, 'yyyy') : '',
      total_loyalty_points: customer?.total_loyalty_points || 0,
    },
  });

  const handleFormSubmit = (values: FormValues) => {
    const { dob_day, dob_month, dob_year, ...rest } = values;
    const dob = `${dob_year}-${dob_month}-${dob_day}`;

    // Validate date
    const date = new Date(dob);
    if (isNaN(date.getTime()) || format(date, 'yyyy-MM-dd') !== dob) {
      form.setError('dob_day', { type: 'manual', message: 'Invalid date.' });
      return;
    }

    onSubmit({
      ...rest,
      dob,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., John Doe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="mobile_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mobile Number</FormLabel>
              <FormControl>
                <Input placeholder="e.g., 0771234567" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
          <FormLabel>Date of Birth</FormLabel>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <FormField
              control={form.control}
              name="dob_day"
              render={({ field }) => (
                <FormItem>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger></FormControl>
                    <SelectContent>{days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dob_month"
              render={({ field }) => (
                <FormItem>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger></FormControl>
                    <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dob_year"
              render={({ field }) => (
                <FormItem>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger></FormControl>
                    <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </div>
          {form.formState.errors.dob_day && <FormMessage className="mt-2">{form.formState.errors.dob_day.message}</FormMessage>}
          {form.formState.errors.dob_month && <FormMessage className="mt-2">{form.formState.errors.dob_month.message}</FormMessage>}
          {form.formState.errors.dob_year && <FormMessage className="mt-2">{form.formState.errors.dob_year.message}</FormMessage>}
        </div>

        <FormField
          control={form.control}
          name="total_loyalty_points"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Total Loyalty Points</FormLabel>
              <FormControl>
                <Input type="number" {...field} disabled />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">
          {customer ? 'Update Customer' : 'Register Customer'}
        </Button>
      </form>
    </Form>
  );
}
