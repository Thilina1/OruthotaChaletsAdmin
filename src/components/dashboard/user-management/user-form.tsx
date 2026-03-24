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
import type { User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { KeyRound } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useState, useEffect } from 'react';
import { STAFF_HIERARCHY, DEPARTMENTS } from '@/lib/staff-hierarchy';

const APP_SECTIONS = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/dashboard/profile', label: 'Profile' },
  { path: '/dashboard/user-management', label: 'User Management' },
  { path: '/dashboard/settings/roles', label: 'Roles & Permissions' },
  { path: '/dashboard/customers', label: 'Customers' },
  { path: '/dashboard/loyalty', label: 'Loyalty Customers' },
  { path: '/dashboard/billing', label: 'Restaurant Billing' },
  { path: '/dashboard/menu-management', label: 'Menu Management' },
  { path: '/dashboard/table-management', label: 'Table Management' },
  { path: '/dashboard/inventory-management', label: 'Inventory' },
  { path: '/dashboard/inventory-management/stock-overview', label: 'Store Overview' },
  { path: '/dashboard/inventory-requests', label: 'Inventory Requests' },
  { path: '/dashboard/inventory-reports', label: 'Inventory Reports' },
  { path: '/dashboard/menu-settings', label: 'Menu Section Settings' },
  { path: '/dashboard/restaurant-settings', label: 'Restaurant Settings' },
  { path: '/dashboard/expenses', label: 'Expenses' },
  { path: '/dashboard/other-incomes', label: 'Other Incomes' },
  { path: '/dashboard/room-management', label: 'Room Management' },
  { path: '/dashboard/reservations', label: 'Reservation Management' },
  { path: '/dashboard/hrms/employees', label: 'HRMS: Employees' },
  { path: '/dashboard/hrms/leaves', label: 'HRMS: Leaves' },
  { path: '/dashboard/hrms/reports', label: 'HRMS: Daily Reports' },
  { path: '/dashboard/hrms/payroll', label: 'HRMS: Payroll' },
  { path: '/dashboard/hrms/attendance', label: 'HRMS: Attendance' },
  { path: '/dashboard/activities', label: 'Activities' },
  { path: '/dashboard/experiences', label: 'Experiences' },
  { path: '/dashboard/blogs', label: 'Blog Management' },
  { path: '/dashboard/reports', label: 'Financial Reports' },
];

const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email.' }),
  role: z.enum(['admin', 'waiter', 'payment', 'kitchen']),
  phone_number: z.string().optional(),
  address: z.string().optional(),
  nic: z.string().optional(),
  job_title: z.string().optional(),
  department: z.string().optional(),
  join_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date format (YYYY-MM-DD)" }).optional().or(z.literal('')),
  updatePassword: z.boolean().default(false),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
  permissions: z.array(z.string()).default([]),
}).refine((data) => {
  if (data.updatePassword && (!data.password || data.password.length < 6)) {
    return false;
  }
  return true;
}, {
  message: 'Password must be at least 6 characters.',
  path: ['password'],
}).refine((data) => {
  if (data.updatePassword && data.password !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "Passwords don't match.",
  path: ['confirmPassword'],
});

interface UserFormProps {
  user?: User | null;
  onSubmit: (values: any) => void;
}

export function UserForm({ user, onSubmit }: UserFormProps) {
  const [showPassword, setShowPassword] = useState(!user);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: user?.name || '',
      email: user ? user.email : '',
      role: user?.role || 'waiter',
      phone_number: user?.phone_number || '',
      address: user?.address || '',
      nic: user?.nic || '',
      job_title: user?.job_title || '',
      department: user?.department || '',
      join_date: user?.join_date || new Date().toISOString().split('T')[0],
      updatePassword: !user,
      password: '',
      confirmPassword: '',
      permissions: user?.permissions || [],
    },
  });


  useEffect(() => {
    form.reset({
      name: user?.name || '',
      email: user ? user.email : '',
      role: user?.role || 'waiter',
      phone_number: user?.phone_number || '',
      address: user?.address || '',
      nic: user?.nic || '',
      job_title: user?.job_title || '',
      department: user?.department || '',
      join_date: user?.join_date || new Date().toISOString().split('T')[0],
      updatePassword: !user,
      password: '',
      confirmPassword: '',
      permissions: user?.permissions || [],
    });
    setShowPassword(!user);
  }, [user, form]);

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    const { confirmPassword, updatePassword, ...submissionData } = values;
    if (!updatePassword) {
      delete submissionData.password;
    }
    onSubmit(submissionData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="john.doe@example.com" {...field} disabled={!!user} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="phone_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <Input placeholder="+94 77 123 4567" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="nic"
            render={({ field }) => (
              <FormItem>
                <FormLabel>NIC</FormLabel>
                <FormControl>
                  <Input placeholder="National Identity Card" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Input placeholder="123 Street, City" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="department"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Department</FormLabel>
                <Select
                  onValueChange={(value) => {
                    field.onChange(value);
                    form.setValue('job_title', '');
                  }}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Department" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {DEPARTMENTS.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="job_title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Job Title</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={!form.watch('department')}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Job Title" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {form.watch('department') &&
                      STAFF_HIERARCHY[form.watch('department') as string]?.map(role => (
                        <SelectItem key={role} value={role}>{role}</SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="join_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Join Date</FormLabel>
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
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="waiter">Waiter</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="kitchen">Kitchen</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {user && (
          <FormField
            control={form.control}
            name="updatePassword"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked);
                      setShowPassword(!!checked);
                    }}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Update Password</FormLabel>
                </div>
              </FormItem>
            )}
          />
        )}

        {showPassword && (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="password" placeholder="••••••••" {...field} className="pl-10" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="password" placeholder="••••••••" {...field} className="pl-10" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <div className="space-y-3 pt-4 border-t">
          <h3 className="text-sm font-semibold">Custom Section Permissions</h3>
          <p className="text-xs text-muted-foreground">Select which sections this staff member can access. (Admins have access to all by default).</p>
          <FormField
            control={form.control}
            name="permissions"
            render={() => (
              <FormItem>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                  {APP_SECTIONS.map((item) => (
                    <FormField
                      key={item.path}
                      control={form.control}
                      name="permissions"
                      render={({ field }) => {
                        return (
                          <FormItem
                            key={item.path}
                            className="flex flex-row items-start space-x-3 space-y-0"
                          >
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(item.path)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...field.value, item.path])
                                    : field.onChange(
                                      field.value?.filter(
                                        (value) => value !== item.path
                                      )
                                    )
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal text-sm cursor-pointer">
                              {item.label}
                            </FormLabel>
                          </FormItem>
                        )
                      }}
                    />
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" className="w-full">
          {user ? 'Update User' : 'Create User'}
        </Button>
      </form>
    </Form>
  );
}
