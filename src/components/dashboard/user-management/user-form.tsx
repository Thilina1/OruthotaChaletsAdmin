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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, parse, isValid } from 'date-fns';
import { APP_SECTION_GROUPS } from '@/lib/section-groups';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email.' }),
  role: z.string().min(1, 'Please select a role'),
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
  inventory_admin: z.boolean().default(false),
  gender: z.string().optional().or(z.literal('')),
  leave_scheme_id: z.string().optional().or(z.literal('')),
  reporting_manager_id: z.string().optional().or(z.literal('')),
  working_calendar_id: z.string().optional().or(z.literal('')),
  basic_salary: z.coerce.number().min(0, 'Must be 0 or greater').optional().or(z.literal('')),
  service_charge_applicable: z.boolean().default(false),
  service_charge_rate: z.coerce.number().min(0).optional().or(z.literal('')),
  allowances: z.array(z.object({
    name: z.string().min(1, 'Name is required'),
    amount: z.coerce.number().min(0, 'Must be 0 or greater'),
    allowance_type_id: z.string().optional(),
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
  const [allowanceTypes, setAllowanceTypes] = useState<{ id: string; name: string; default_amount: number }[]>([]);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [rolePermissionsMap, setRolePermissionsMap] = useState<Record<string, string[]>>({});
  const [jobTitlesByDept, setJobTitlesByDept] = useState<Record<string, string[]>>({});

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
    fetch('/api/hrms/allowance-types')
      .then(r => r.json())
      .then(d => setAllowanceTypes(d.allowanceTypes ?? []))
      .catch(() => {});
    fetch('/api/admin/job-titles')
      .then(r => r.json())
      .then(d => setJobTitlesByDept(d.titles ?? {}))
      .catch(() => {});
    fetch('/api/admin/role-permissions')
      .then(r => r.json())
      .then(d => { if (d.permissions) setRolePermissionsMap(d.permissions); })
      .catch(() => {});
    // availableRoles is derived from rolePermissionsMap keys below
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
      inventory_admin: user?.inventory_admin || false,
      gender: user?.gender || '',
      leave_scheme_id: user?.leave_scheme_id || 'none',
      reporting_manager_id: user?.reporting_manager_id || 'none',
      working_calendar_id: user?.working_calendar_id || 'none',
      basic_salary: undefined,
      service_charge_applicable: user?.service_charge_applicable === true,
      service_charge_rate: user?.service_charge_rate ?? undefined,
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
      inventory_admin: user?.inventory_admin || false,
      gender: user?.gender || '',
      leave_scheme_id: user?.leave_scheme_id || 'none',
      reporting_manager_id: user?.reporting_manager_id || 'none',
      working_calendar_id: user?.working_calendar_id || 'none',
      basic_salary: undefined,
      service_charge_applicable: user?.service_charge_applicable === true,
      service_charge_rate: user?.service_charge_rate ?? undefined,
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
    const { confirmPassword, updatePassword, leave_scheme_id, reporting_manager_id, working_calendar_id, basic_salary, allowances, service_charge_applicable, service_charge_rate, ...submissionData } = values;
    if (!updatePassword) {
      delete submissionData.password;
    }
    onSubmit({
      ...submissionData,
      leave_scheme_id: leave_scheme_id && leave_scheme_id !== 'none' ? leave_scheme_id : null,
      reporting_manager_id: reporting_manager_id && reporting_manager_id !== 'none' ? reporting_manager_id : null,
      working_calendar_id: working_calendar_id && working_calendar_id !== 'none' ? working_calendar_id : null,
      basic_salary: basic_salary != null && basic_salary !== '' ? Number(basic_salary) : null,
      service_charge_applicable: service_charge_applicable === true,
      service_charge_rate: service_charge_applicable === true && service_charge_rate != null && service_charge_rate !== ''
        ? Number(service_charge_rate)
        : null,
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
                    {Object.keys(jobTitlesByDept).sort().map(dept => (
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
            render={({ field }) => {
              const dept = form.watch('department') as string | undefined;
              const titles = dept ? (jobTitlesByDept[dept] ?? []) : [];
              return (
                <FormItem>
                  <FormLabel>Job Title</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={!dept || titles.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={dept ? 'Select job title' : 'Select a department first'} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {titles.map(title => (
                        <SelectItem key={title} value={title}>{title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        </div>

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select
                onValueChange={(val) => {
                  field.onChange(val);
                  // Only auto-load role permissions for NEW employees
                  if (!user && rolePermissionsMap[val]) {
                    form.setValue('permissions', rolePermissionsMap[val]);
                  }
                }}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.keys(rolePermissionsMap).length > 0
                    ? Object.keys(rolePermissionsMap).map(r => (
                        <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                      ))
                    : (
                      <>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="waiter">Waiter</SelectItem>
                        <SelectItem value="payment">Payment</SelectItem>
                        <SelectItem value="kitchen">Kitchen</SelectItem>
                      </>
                    )
                  }
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

          <FormField
            control={form.control}
            name="service_charge_applicable"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel className="text-sm font-medium">Service Charge Applicable</FormLabel>
                  <p className="text-xs text-muted-foreground">Enable if service charge applies to this staff member.</p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={(val) => {
                    field.onChange(val);
                    if (!val) form.setValue('service_charge_rate', undefined);
                  }} />
                </FormControl>
              </FormItem>
            )}
          />

          {form.watch('service_charge_applicable') && (
            <FormField
              control={form.control}
              name="service_charge_rate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Charge Rate (%)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="e.g. 10"
                        min="0"
                        max="100"
                        step="0.01"
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        value={field.value == null || (typeof field.value === 'number' && isNaN(field.value)) ? '' : field.value}
                        onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Allowances</Label>
              <div className="flex gap-2">
                {allowanceTypes.length > 0 && (
                  <Select
                    onValueChange={(id) => {
                      const at = allowanceTypes.find(a => a.id === id);
                      if (at) appendAllowance({ name: at.name, amount: at.default_amount, allowance_type_id: at.id });
                    }}
                    value=""
                  >
                    <SelectTrigger className="h-8 text-xs w-44">
                      <SelectValue placeholder="Add from preset..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allowanceTypes.map(at => (
                        <SelectItem key={at.id} value={at.id}>
                          {at.name} — LKR {at.default_amount.toLocaleString('en-LK')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => appendAllowance({ name: '', amount: 0 })}
                >
                  <Plus className="h-3 w-3 mr-1" /> Custom
                </Button>
              </div>
            </div>

            {allowanceFields.length === 0 && (
              <p className="text-xs text-muted-foreground">No allowances added. Select a preset or click "Custom" to add one manually.</p>
            )}

            {allowanceFields.map((af, index) => {
              const isLinked = !!form.watch(`allowances.${index}.allowance_type_id`);
              return (
                <div key={af.id} className="flex gap-2 items-start">
                  <FormField
                    control={form.control}
                    name={`allowances.${index}.name`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <div className="relative">
                            <Input
                              placeholder="e.g. P/s Budgetary Relief"
                              {...field}
                              className={isLinked ? 'pr-16' : ''}
                            />
                            {isLinked && (
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                preset
                              </span>
                            )}
                          </div>
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
              );
            })}

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
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="space-y-0.5">
              <h3 className="text-sm font-semibold">Section Permissions</h3>
              <p className="text-xs text-muted-foreground">Sections this staff member can access. Pre-filled from their role defaults — you can add or remove individually.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const role = form.getValues('role');
                  if (rolePermissionsMap[role]) {
                    form.setValue('permissions', rolePermissionsMap[role]);
                  }
                }}
              >
                Reset to Role Defaults
              </Button>
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
            {form.watch('role') !== 'admin' && (
              <FormField
                control={form.control}
                name="inventory_admin"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Inventory Admin</FormLabel>
                      <p className="text-xs text-muted-foreground">Grants admin-level access in Inventory Stock Overview and Stock Request Portal pages.</p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
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
