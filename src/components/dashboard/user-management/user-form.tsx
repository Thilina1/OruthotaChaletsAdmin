'use client';

import { useForm, useFieldArray } from 'react-hook-form';
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
import type { User, LeaveScheme, WorkingCalendar } from '@/lib/types';
import { cn } from '@/lib/utils';
import { KeyRound, CalendarIcon, Plus, X, Banknote } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useState, useEffect } from 'react';
import { STAFF_HIERARCHY, DEPARTMENTS } from '@/lib/staff-hierarchy';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, parse, isValid } from 'date-fns';

const APP_SECTION_GROUPS = [
  {
    name: 'General',
    sections: [
      { path: '/dashboard/profile', label: 'Profile' },
      { path: '/dashboard/user-management', label: 'User Management' },
      { path: '/dashboard/settings/roles', label: 'Roles & Permissions' },
    ]
  },
  {
    name: 'Customers',
    sections: [
      { path: '/dashboard/customers', label: 'Customers' },
      { path: '/dashboard/loyalty', label: 'Loyalty Customers' },
    ]
  },
  {
    name: 'Restaurant',
    sections: [
      { path: '/dashboard', label: 'Dashboard' },
      { path: '/dashboard/billing', label: 'Restaurant Billing' },
      { path: '/dashboard/menu-management', label: 'Menu Management' },
      { path: '/dashboard/table-management', label: 'Table Management' },
      { path: '/dashboard/menu-settings', label: 'Menu Section Settings' },
      { path: '/dashboard/restaurant-settings', label: 'Restaurant Settings' },
    ]
  },
  {
    name: 'Inventory',
    sections: [
      { path: '/dashboard/inventory-management/warehouses', label: 'Manage Store' },
      { path: '/dashboard/inventory-management/add-item', label: 'Add New Item' },
      { path: '/dashboard/inventory-requests', label: 'Inventory Requests' },
      { path: '/dashboard/inventory-requests/history', label: 'Inventory Approvals' },
      { path: '/dashboard/purchase-orders', label: 'Purchase Orders' },
      { path: '/dashboard/purchase-orders/approvals', label: 'PO Approvals' },
      { path: '/dashboard/inventory-stock-overview', label: 'Stock Overview' },
      { path: '/dashboard/inventory-management/grn', label: 'GRN (Stock In)' },
      { path: '/dashboard/inventory-management', label: 'Manage Items' },
      { path: '/dashboard/inventory-reports', label: 'Inventory Reports' },
    ]
  },
  {
    name: 'Rooms & Bookings',
    sections: [
      { path: '/dashboard/room-management', label: 'Room Management' },
      { path: '/dashboard/reservations', label: 'Reservation Management' },
      { path: '/dashboard/inquiries', label: 'Inquiries' },
      { path: '/dashboard/buffet-bookings', label: 'Buffet Bookings' },
    ]
  },
  {
    name: 'Financial',
    sections: [
      { path: '/dashboard/expenses', label: 'Expenses' },
      { path: '/dashboard/other-incomes', label: 'Other Incomes' },
      { path: '/dashboard/reports', label: 'Financial Reports' },
    ]
  },
  {
    name: 'HRMS',
    sections: [
      { path: '/dashboard/hrms/employees', label: 'HRMS: Employees' },
      { path: '/dashboard/hrms/leaves', label: 'HRMS: Leaves' },
      { path: '/dashboard/hrms/reports', label: 'HRMS: Daily Reports' },
      { path: '/dashboard/hrms/payroll', label: 'HRMS: Payroll' },
      { path: '/dashboard/hrms/attendance', label: 'HRMS: Attendance' },
    ]
  },
  {
    name: 'Other Content',
    sections: [],
  },
  {
    name: 'Services',
    sections: [
      { path: '/dashboard/services/laundry', label: 'Laundry Service' },
      { path: '/dashboard/services/spa', label: 'Spa Service' },
      { path: '/dashboard/services/transport', label: 'Transport Service' },
    ],
  },
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
  restrict_admin_permissions: z.boolean().default(false),
  gender: z.string().optional().or(z.literal('')),
  leave_scheme_id: z.string().optional().or(z.literal('')),
  reporting_manager_id: z.string().optional().or(z.literal('')),
  working_calendar_id: z.string().optional().or(z.literal('')),
  basic_salary: z.coerce.number().min(0, 'Must be 0 or greater').optional().or(z.literal('')),
  allowances: z.array(z.object({
    name: z.string().min(1, 'Name is required'),
    amount: z.coerce.number().min(0, 'Must be 0 or greater'),
  })).default([]),
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
  const [leaveSchemes, setLeaveSchemes] = useState<LeaveScheme[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [workingCalendars, setWorkingCalendars] = useState<WorkingCalendar[]>([]);
  const [salaryLoading, setSalaryLoading] = useState(false);

  useEffect(() => {
    fetch('/api/hrms/leave-schemes')
      .then(r => r.json())
      .then(d => setLeaveSchemes((d.schemes ?? []).filter((s: LeaveScheme) => s.is_active)))
      .catch(() => {});
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(d => setAllUsers(d.users ?? []))
      .catch(() => {});
    fetch('/api/hrms/working-calendars')
      .then(r => r.json())
      .then(d => setWorkingCalendars((d.calendars ?? []).filter((c: WorkingCalendar) => c.is_active)))
      .catch(() => {});
  }, []);

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
      permissions: user?.permissions || ['/dashboard/profile'],
      restrict_admin_permissions: user?.restrict_admin_permissions || false,
      gender: user?.gender || '',
      leave_scheme_id: user?.leave_scheme_id || 'none',
      reporting_manager_id: user?.reporting_manager_id || 'none',
      working_calendar_id: user?.working_calendar_id || 'none',
      basic_salary: undefined,
      allowances: [],
    },
  });

  const { fields: allowanceFields, append: appendAllowance, remove: removeAllowance } = useFieldArray({
    control: form.control,
    name: 'allowances',
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
      permissions: user?.permissions || ['/dashboard/profile'],
      restrict_admin_permissions: user?.restrict_admin_permissions || false,
      gender: user?.gender || '',
      leave_scheme_id: user?.leave_scheme_id || 'none',
      reporting_manager_id: user?.reporting_manager_id || 'none',
      working_calendar_id: user?.working_calendar_id || 'none',
      basic_salary: undefined,
      allowances: [],
    });
    setShowPassword(!user);

    if (user?.id) {
      setSalaryLoading(true);
      fetch(`/api/hrms/payroll/settings?userId=${user.id}`)
        .then(r => r.json())
        .then(d => {
          const sd = d.salaryDetails?.[0];
          if (sd) {
            form.setValue('basic_salary', sd.basic_salary ?? undefined);
            form.setValue('allowances', Array.isArray(sd.allowances_json) ? sd.allowances_json : []);
          }
        })
        .catch(() => {})
        .finally(() => setSalaryLoading(false));
    }
  }, [user, form]);

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    const { confirmPassword, updatePassword, leave_scheme_id, reporting_manager_id, working_calendar_id, basic_salary, allowances, ...submissionData } = values;
    if (!updatePassword) {
      delete submissionData.password;
    }
    onSubmit({
      ...submissionData,
      leave_scheme_id: leave_scheme_id && leave_scheme_id !== 'none' ? leave_scheme_id : null,
      reporting_manager_id: reporting_manager_id && reporting_manager_id !== 'none' ? reporting_manager_id : null,
      working_calendar_id: working_calendar_id && working_calendar_id !== 'none' ? working_calendar_id : null,
      basic_salary: basic_salary != null && basic_salary !== '' ? Number(basic_salary) : null,
      allowances: allowances || [],
    });
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
            name="gender"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Gender</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
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
          <FormField
            control={form.control}
            name="join_date"
            render={({ field }) => {
              const dateValue = field.value
                ? parse(field.value, 'yyyy-MM-dd', new Date())
                : undefined;
              const validDate = dateValue && isValid(dateValue) ? dateValue : undefined;
              return (
                <FormItem className="flex flex-col">
                  <FormLabel>Join Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {validDate ? format(validDate, 'PPP') : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={validDate}
                        onSelect={(date) => field.onChange(date ? format(date, 'yyyy-MM-dd') : '')}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              );
            }}
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

        <FormField
          control={form.control}
          name="leave_scheme_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Leave Scheme</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a leave scheme" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">— No scheme —</SelectItem>
                  {leaveSchemes.map(scheme => (
                    <SelectItem key={scheme.id} value={scheme.id}>
                      {scheme.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="reporting_manager_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reporting Manager</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a reporting manager" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">— No manager —</SelectItem>
                  {allUsers
                    .filter(u => u.id !== user?.id)
                    .map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.job_title || u.role})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="working_calendar_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Working Calendar</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a working calendar" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">— No calendar —</SelectItem>
                  {workingCalendars.map(cal => (
                    <SelectItem key={cal.id} value={cal.id}>
                      {cal.name} ({cal.year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Salary & Allowances */}
        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Salary & Allowances</h3>
          </div>

          <FormField
            control={form.control}
            name="basic_salary"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Monthly Basic Salary (LKR)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={field.value == null || (typeof field.value === 'number' && isNaN(field.value)) ? '' : field.value}
                    onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
                    disabled={salaryLoading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Allowances</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => appendAllowance({ name: '', amount: 0 })}
              >
                <Plus className="h-3 w-3 mr-1" /> Add Allowance
              </Button>
            </div>

            {allowanceFields.length === 0 && (
              <p className="text-xs text-muted-foreground">No allowances added. Click "Add Allowance" to add P/s Budgetary Relief, transport, etc.</p>
            )}

            {allowanceFields.map((af, index) => (
              <div key={af.id} className="flex gap-2 items-start">
                <FormField
                  control={form.control}
                  name={`allowances.${index}.name`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input placeholder="e.g. P/s Budgetary Relief" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`allowances.${index}.amount`}
                  render={({ field }) => (
                    <FormItem className="w-32">
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          name={field.name}
                          ref={field.ref}
                          onBlur={field.onBlur}
                          value={field.value == null || (typeof field.value === 'number' && isNaN(field.value)) ? '' : field.value}
                          onChange={e => field.onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeAllowance(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {allowanceFields.length > 0 && (
              <div className="flex justify-end text-xs text-muted-foreground pt-1">
                Total allowances: LKR {allowanceFields.reduce((sum, _, i) => {
                  const val = form.watch(`allowances.${i}.amount`);
                  return sum + (Number(val) || 0);
                }, 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </div>
            )}
          </div>
        </div>

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
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-semibold">Custom Section Permissions</h3>
              <p className="text-xs text-muted-foreground">Select which sections this staff member can access. (Admins have access to all by default unless restricted above).</p>
            </div>
            {form.watch('role') === 'admin' && (
              <FormField
                control={form.control}
                name="restrict_admin_permissions"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2 space-y-0">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <Label className="text-xs font-medium cursor-pointer">Restrict Admin Access to Selected Only</Label>
                  </FormItem>
                )}
              />
            )}
          </div>
          <FormField
            control={form.control}
            name="permissions"
            render={() => (
              <FormItem className="space-y-4">
                {APP_SECTION_GROUPS.map((group) => (
                  <div key={group.name} className="space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 border-b pb-1 mb-2">
                      {group.name}
                    </h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4 gap-y-2">
                      {group.sections.map((item) => (
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
                                        ? field.onChange([...(field.value || []), item.path])
                                        : field.onChange(
                                          field.value?.filter(
                                            (value) => value !== item.path
                                          )
                                        )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal text-sm cursor-pointer whitespace-nowrap">
                                  {item.label}
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
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
