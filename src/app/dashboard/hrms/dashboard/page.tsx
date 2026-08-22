'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileCheck2,
  RefreshCw,
  Search,
  Timer,
  UserMinus,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type DailyEmployee = {
  id: string;
  employee_number?: string | null;
  name: string;
  email: string;
  role: string;
  department?: string | null;
  job_title?: string | null;
  status?: 'present' | 'absent' | 'half-day' | 'on-leave' | 'not-marked';
  attendance: null | {
    clock_in?: string | null;
    clock_out?: string | null;
    status: string;
  };
  leave: null | {
    status: string;
    reason?: string | null;
    half_day_type?: string | null;
    leave_type?: { name?: string } | null;
  };
  overtime: null | { ot_hours: number | string; status: string };
  report_submitted: boolean;
  monthly?: {
    present_days: number;
    absent_days: number;
    half_days: number;
    leave_days: number;
    worked_hours: number;
    reports_submitted: number;
    approved_ot_hours: number;
    pending_ot_hours: number;
  };
  payroll?: null | {
    basic_salary: number | string;
    allowances: number | string;
    gross_salary: number | string;
    total_deductions: number;
    tax: number | string;
    net_salary: number | string;
    payroll_status: string;
  };
};

type DashboardData = {
  date: string;
  summary: {
    total: number;
    present: number;
    on_leave: number;
    absent: number;
    half_day: number;
    not_marked: number;
    clocked_in: number;
    reports_submitted: number;
    pending_leave_requests: number;
    approved_ot_hours: number;
    worked_hours?: number;
    payroll_records?: number;
    total_net_pay?: number;
  };
  employees: DailyEmployee[];
  temporary_workers: TemporaryWorker[];
  temporary_summary: Record<string, number>;
};

type TemporaryWorker = {
  id: string;
  name: string;
  phone?: string | null;
  nic?: string | null;
  department?: string | null;
  daily_rate: number | string;
  payment?: null | { day_type: 'full' | 'half' | 'absent'; amount: number | string; is_paid: boolean };
  monthly?: { full_days: number; half_days: number; absent_days: number; total_earned: number; total_paid: number; total_unpaid: number };
};

type DailyStatus = NonNullable<DailyEmployee['status']>;

const statusLabels: Record<DailyStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  'half-day': 'Half Day',
  'on-leave': 'On Leave',
  'not-marked': 'Not Marked',
};

const statusStyles: Record<DailyStatus, string> = {
  present: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  absent: 'border-red-200 bg-red-50 text-red-700',
  'half-day': 'border-amber-200 bg-amber-50 text-amber-700',
  'on-leave': 'border-blue-200 bg-blue-50 text-blue-700',
  'not-marked': 'border-slate-200 bg-slate-50 text-slate-600',
};

function localDateString() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function formatTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function calculateHours(clockIn?: string | null, clockOut?: string | null) {
  if (!clockIn || !clockOut) return '—';
  const hours = (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 3_600_000;
  return hours >= 0 ? `${hours.toFixed(1)}h` : '—';
}

function formatCurrency(value: number | string | undefined) {
  return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', maximumFractionDigits: 2 })
    .format(Number(value || 0));
}

function downloadCsv(headers: string[], rows: Array<Array<string | number>>, filename: string) {
  const csv = [headers, ...rows]
    .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function HrmsDashboardPage() {
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
  const [date, setDate] = useState(localDateString);
  const [month, setMonth] = useState(() => localDateString().slice(0, 7));
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const periodQuery = viewMode === 'monthly'
        ? `month=${encodeURIComponent(month)}`
        : `date=${encodeURIComponent(date)}`;
      const response = await fetch(`/api/hrms/dashboard?${periodQuery}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to load HRMS dashboard.');
      setData(payload);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [date, month, viewMode]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const departments = useMemo(
    () => Array.from(new Set([
      ...(data?.employees || []).map(item => item.department),
      ...(data?.temporary_workers || []).map(item => item.department),
    ].filter(Boolean) as string[])).sort(),
    [data],
  );

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.employees || []).filter(employee => {
      const matchesSearch = !term || [employee.name, employee.employee_number, employee.email, employee.job_title]
        .some(value => value?.toLowerCase().includes(term));
      const matchesStatus = statusFilter === 'all' || (viewMode === 'daily'
        ? employee.status === statusFilter
        : statusFilter === 'present' ? Boolean(employee.monthly?.present_days)
        : statusFilter === 'absent' ? Boolean(employee.monthly?.absent_days)
        : statusFilter === 'half-day' ? Boolean(employee.monthly?.half_days)
        : statusFilter === 'on-leave' ? Boolean(employee.monthly?.leave_days)
        : false);
      const matchesDepartment = departmentFilter === 'all' || employee.department === departmentFilter;
      return matchesSearch && matchesStatus && matchesDepartment;
    });
  }, [data, departmentFilter, search, statusFilter, viewMode]);

  const filteredTemporaryWorkers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.temporary_workers || []).filter(worker => {
      const matchesSearch = !term || [worker.name, worker.nic, worker.phone]
        .some(value => value?.toLowerCase().includes(term));
      const matchesDepartment = departmentFilter === 'all' || worker.department === departmentFilter;
      return matchesSearch && matchesDepartment;
    });
  }, [data, departmentFilter, search]);

  const filteredTemporarySummary = useMemo(() => {
    if (viewMode === 'monthly') {
      return {
        total: filteredTemporaryWorkers.length,
        total_earned: filteredTemporaryWorkers.reduce((sum, worker) => sum + Number(worker.monthly?.total_earned || 0), 0),
        total_paid: filteredTemporaryWorkers.reduce((sum, worker) => sum + Number(worker.monthly?.total_paid || 0), 0),
        total_unpaid: filteredTemporaryWorkers.reduce((sum, worker) => sum + Number(worker.monthly?.total_unpaid || 0), 0),
      };
    }
    return {
      total: filteredTemporaryWorkers.length,
      present: filteredTemporaryWorkers.filter(worker => worker.payment && worker.payment.day_type !== 'absent').length,
      total_pay: filteredTemporaryWorkers.reduce((sum, worker) => sum + Number(worker.payment?.amount || 0), 0),
      paid: filteredTemporaryWorkers.filter(worker => worker.payment?.is_paid).reduce((sum, worker) => sum + Number(worker.payment?.amount || 0), 0),
    };
  }, [filteredTemporaryWorkers, viewMode]);

  const exportCsv = () => {
    if (viewMode === 'monthly') {
      const headers = ['Month', 'Employee Number', 'Employee', 'Department', 'Job Title', 'Present Days', 'Absent Days', 'Half Days', 'Leave Days', 'Worked Hours', 'Reports Submitted', 'Approved OT Hours', 'Pending OT Hours', 'Basic Salary', 'Allowances', 'Gross Pay', 'Tax', 'Total Deductions', 'Net Pay', 'Payroll Status'];
      const rows = filteredEmployees.map(employee => [month, employee.employee_number || '', employee.name, employee.department || '', employee.job_title || employee.role, employee.monthly?.present_days || 0, employee.monthly?.absent_days || 0, employee.monthly?.half_days || 0, employee.monthly?.leave_days || 0, employee.monthly?.worked_hours || 0, employee.monthly?.reports_submitted || 0, employee.monthly?.approved_ot_hours || 0, employee.monthly?.pending_ot_hours || 0, employee.payroll?.basic_salary || 0, employee.payroll?.allowances || 0, employee.payroll?.gross_salary || 0, employee.payroll?.tax || 0, employee.payroll?.total_deductions || 0, employee.payroll?.net_salary || 0, employee.payroll?.payroll_status || 'Not processed']);
      downloadCsv(headers, rows, `hrms-monthly-report-${month}.csv`);
      return;
    }
    const headers = [
      'Date', 'Employee Number', 'Employee', 'Department', 'Job Title', 'Status',
      'Clock In', 'Clock Out', 'Hours', 'Leave Type', 'Leave Status', 'Daily Report', 'OT Hours', 'OT Status',
    ];
    const rows = filteredEmployees.map(employee => [
      date,
      employee.employee_number || '',
      employee.name,
      employee.department || '',
      employee.job_title || employee.role,
      statusLabels[employee.status!],
      formatTime(employee.attendance?.clock_in),
      formatTime(employee.attendance?.clock_out),
      calculateHours(employee.attendance?.clock_in, employee.attendance?.clock_out),
      employee.leave?.leave_type?.name || '',
      employee.leave?.status || '',
      employee.report_submitted ? 'Submitted' : 'Not submitted',
      employee.overtime?.ot_hours || '',
      employee.overtime?.status || '',
    ]);
    downloadCsv(headers, rows, `hrms-daily-report-${date}.csv`);
  };

  const exportTemporaryCsv = () => {
    const workers = filteredTemporaryWorkers;
    if (viewMode === 'monthly') {
      downloadCsv(
        ['Month', 'Worker', 'NIC', 'Phone', 'Department', 'Daily Rate', 'Full Days', 'Half Days', 'Absent Days', 'Earned', 'Paid', 'Unpaid'],
        workers.map(worker => [month, worker.name, worker.nic || '', worker.phone || '', worker.department || '', worker.daily_rate, worker.monthly?.full_days || 0, worker.monthly?.half_days || 0, worker.monthly?.absent_days || 0, worker.monthly?.total_earned || 0, worker.monthly?.total_paid || 0, worker.monthly?.total_unpaid || 0]),
        `temporary-staff-${month}.csv`,
      );
      return;
    }
    downloadCsv(
      ['Date', 'Worker', 'NIC', 'Phone', 'Department', 'Daily Rate', 'Attendance', 'Amount', 'Payment Status'],
      workers.map(worker => [date, worker.name, worker.nic || '', worker.phone || '', worker.department || '', worker.daily_rate, worker.payment?.day_type || 'Not marked', worker.payment?.amount || 0, worker.payment?.is_paid ? 'Paid' : 'Unpaid']),
      `temporary-staff-${date}.csv`,
    );
  };

  const summaryCards = data ? [
    { label: 'Total Employees', value: data.summary.total, icon: Users, className: 'text-slate-700 bg-slate-100' },
    { label: viewMode === 'monthly' ? 'Present Days' : 'Present', value: data.summary.present, icon: CheckCircle2, className: 'text-emerald-700 bg-emerald-100' },
    { label: viewMode === 'monthly' ? 'Leave Days' : 'On Leave', value: data.summary.on_leave, icon: CalendarDays, className: 'text-blue-700 bg-blue-100' },
    { label: viewMode === 'monthly' ? 'Absent Days' : 'Absent', value: data.summary.absent, icon: UserMinus, className: 'text-red-700 bg-red-100' },
    { label: viewMode === 'monthly' ? 'Half Days' : 'Half Day', value: data.summary.half_day, icon: Clock3, className: 'text-amber-700 bg-amber-100' },
    { label: viewMode === 'monthly' ? 'Worked Hours' : 'Not Marked', value: viewMode === 'monthly' ? `${data.summary.worked_hours || 0}h` : data.summary.not_marked, icon: Timer, className: 'text-violet-700 bg-violet-100' },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold">HRMS Dashboard</h1>
          <p className="text-muted-foreground">Daily and monthly workforce, attendance, leave, reports, and overtime overview.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border p-1">
            <Button size="sm" variant={viewMode === 'daily' ? 'secondary' : 'ghost'} onClick={() => { setViewMode('daily'); setStatusFilter('all'); }}>Daily</Button>
            <Button size="sm" variant={viewMode === 'monthly' ? 'secondary' : 'ghost'} onClick={() => { setViewMode('monthly'); setStatusFilter('all'); }}>Monthly</Button>
          </div>
          <Input
            aria-label={viewMode === 'monthly' ? 'Dashboard month' : 'Dashboard date'}
            type={viewMode === 'monthly' ? 'month' : 'date'}
            value={viewMode === 'monthly' ? month : date}
            onChange={event => viewMode === 'monthly' ? setMonth(event.target.value) : setDate(event.target.value)}
            className="w-auto"
          />
          <Button variant="outline" onClick={loadDashboard} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button onClick={exportCsv} disabled={!filteredEmployees.length}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-5 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {summaryCards.map(card => (
          <Card key={card.label}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                <p className="mt-1 text-3xl font-bold">{card.value}</p>
              </div>
              <div className={`rounded-full p-3 ${card.className}`}><card.icon className="h-5 w-5" /></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {data && (
        <div className={`grid gap-4 ${viewMode === 'monthly' ? 'md:grid-cols-5' : 'md:grid-cols-3'}`}>
          <OperationalCard label={viewMode === 'monthly' ? 'Total Worked Hours' : 'Currently Clocked In'} value={viewMode === 'monthly' ? `${data.summary.worked_hours || 0}h` : data.summary.clocked_in} icon={Clock3} />
          <OperationalCard label={viewMode === 'monthly' ? 'Reports Submitted' : 'Daily Reports Submitted'} value={data.summary.reports_submitted} icon={FileCheck2} />
          <OperationalCard label="Pending Leave Requests" value={data.summary.pending_leave_requests} icon={CalendarDays} />
          {viewMode === 'monthly' && <OperationalCard label="Payroll Records" value={data.summary.payroll_records || 0} icon={FileCheck2} />}
          {viewMode === 'monthly' && <OperationalCard label="Total Net Payroll" value={formatCurrency(data.summary.total_net_pay)} icon={Users} />}
        </div>
      )}

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>{viewMode === 'monthly' ? 'Employee Monthly Summary' : 'Employee Daily Status'}</CardTitle>
            <span className="text-sm text-muted-foreground">{filteredEmployees.length} employee(s)</span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search employee or number" className="pl-9" />
            </div>
            <select
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">All statuses</option>
              {Object.entries(statusLabels).filter(([value]) => viewMode === 'daily' || value !== 'not-marked').map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select
              value={departmentFilter}
              onChange={event => setDepartmentFilter(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">All departments</option>
              {departments.map(department => <option key={department} value={department}>{department}</option>)}
            </select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                {viewMode === 'monthly' ? <>
                  <TableHead>Present</TableHead><TableHead>Absent</TableHead><TableHead>Half Days</TableHead><TableHead>Leave</TableHead><TableHead>Hours</TableHead><TableHead>Reports</TableHead><TableHead>OT</TableHead><TableHead>Basic Salary</TableHead><TableHead>Gross Pay</TableHead><TableHead>Tax</TableHead><TableHead>Deductions</TableHead><TableHead>Net Pay</TableHead><TableHead>Payroll</TableHead>
                </> : <>
                  <TableHead>Status</TableHead><TableHead>Clock In</TableHead><TableHead>Clock Out</TableHead><TableHead>Hours</TableHead><TableHead>Leave</TableHead><TableHead>Report</TableHead><TableHead>Overtime</TableHead>
                </>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={viewMode === 'monthly' ? 15 : 9} className="py-12 text-center text-muted-foreground">Loading workforce data…</TableCell></TableRow>
              ) : filteredEmployees.length === 0 ? (
                <TableRow><TableCell colSpan={viewMode === 'monthly' ? 15 : 9} className="py-12 text-center text-muted-foreground">No employees match these filters.</TableCell></TableRow>
              ) : filteredEmployees.map(employee => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <div className="font-medium">{employee.name}</div>
                    <div className="text-xs text-muted-foreground">#{employee.employee_number || '—'} · {employee.job_title || employee.role}</div>
                  </TableCell>
                  <TableCell>{employee.department || 'Unassigned'}</TableCell>
                  {viewMode === 'monthly' ? <>
                    <TableCell>{employee.monthly?.present_days || 0}</TableCell>
                    <TableCell>{employee.monthly?.absent_days || 0}</TableCell>
                    <TableCell>{employee.monthly?.half_days || 0}</TableCell>
                    <TableCell>{employee.monthly?.leave_days || 0}</TableCell>
                    <TableCell>{employee.monthly?.worked_hours || 0}h</TableCell>
                    <TableCell>{employee.monthly?.reports_submitted || 0}</TableCell>
                    <TableCell>{employee.monthly?.approved_ot_hours || 0}h</TableCell>
                    <TableCell>{employee.payroll ? formatCurrency(employee.payroll.basic_salary) : '—'}</TableCell>
                    <TableCell>{employee.payroll ? formatCurrency(employee.payroll.gross_salary) : '—'}</TableCell>
                    <TableCell>{employee.payroll ? formatCurrency(employee.payroll.tax) : '—'}</TableCell>
                    <TableCell>{employee.payroll ? formatCurrency(employee.payroll.total_deductions) : '—'}</TableCell>
                    <TableCell className="font-medium">{employee.payroll ? formatCurrency(employee.payroll.net_salary) : '—'}</TableCell>
                    <TableCell>
                      <Badge variant={employee.payroll ? 'default' : 'outline'} className="capitalize">
                        {employee.payroll?.payroll_status || 'Not processed'}
                      </Badge>
                    </TableCell>
                  </> : <>
                  <TableCell><Badge variant="outline" className={statusStyles[employee.status!]}>{statusLabels[employee.status!]}</Badge></TableCell>
                  <TableCell>{formatTime(employee.attendance?.clock_in)}</TableCell>
                  <TableCell>{formatTime(employee.attendance?.clock_out)}</TableCell>
                  <TableCell>{calculateHours(employee.attendance?.clock_in, employee.attendance?.clock_out)}</TableCell>
                  <TableCell>
                    {employee.leave ? (
                      <div>
                        <p className="text-sm font-medium">{employee.leave.leave_type?.name || 'Leave'}</p>
                        <p className="text-xs capitalize text-muted-foreground">{employee.leave.status.replace('_', ' ')}</p>
                      </div>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={employee.report_submitted ? 'default' : 'outline'}>
                      {employee.report_submitted ? 'Submitted' : 'Missing'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {employee.overtime ? `${employee.overtime.ot_hours}h (${employee.overtime.status})` : '—'}
                  </TableCell>
                  </>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Temporary Staff (Daily Workers)</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {viewMode === 'monthly' ? 'Monthly attendance and wage totals for active daily workers.' : 'Daily attendance and payment status for active daily workers.'}
            </p>
          </div>
          <Button variant="outline" onClick={exportTemporaryCsv} disabled={!filteredTemporaryWorkers.length}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 overflow-x-auto">
          {data && <div className="flex flex-wrap gap-3">
            <Badge variant="outline">Active workers: {filteredTemporarySummary.total || 0}</Badge>
            {viewMode === 'monthly' ? <>
              <Badge variant="outline">Total earned: {formatCurrency(filteredTemporarySummary.total_earned)}</Badge>
              <Badge variant="outline">Paid: {formatCurrency(filteredTemporarySummary.total_paid)}</Badge>
              <Badge variant="outline">Unpaid: {formatCurrency(filteredTemporarySummary.total_unpaid)}</Badge>
            </> : <>
              <Badge variant="outline">Present: {filteredTemporarySummary.present || 0}</Badge>
              <Badge variant="outline">Total pay: {formatCurrency(filteredTemporarySummary.total_pay)}</Badge>
              <Badge variant="outline">Paid: {formatCurrency(filteredTemporarySummary.paid)}</Badge>
            </>}
          </div>}
          <Table>
            <TableHeader><TableRow>
              <TableHead>Worker</TableHead><TableHead>Department</TableHead><TableHead>Daily Rate</TableHead>
              {viewMode === 'monthly' ? <><TableHead>Full Days</TableHead><TableHead>Half Days</TableHead><TableHead>Absent</TableHead><TableHead>Earned</TableHead><TableHead>Paid</TableHead><TableHead>Unpaid</TableHead></> : <><TableHead>Attendance</TableHead><TableHead>Amount</TableHead><TableHead>Payment</TableHead></>}
            </TableRow></TableHeader>
            <TableBody>
              {!filteredTemporaryWorkers.length ? <TableRow><TableCell colSpan={viewMode === 'monthly' ? 9 : 6} className="py-10 text-center text-muted-foreground">No temporary staff match these filters.</TableCell></TableRow> : filteredTemporaryWorkers.map(worker => <TableRow key={worker.id}>
                <TableCell><div className="font-medium">{worker.name}</div><div className="text-xs text-muted-foreground">{worker.nic || worker.phone || '—'}</div></TableCell>
                <TableCell>{worker.department || 'Unassigned'}</TableCell>
                <TableCell>{formatCurrency(worker.daily_rate)}</TableCell>
                {viewMode === 'monthly' ? <>
                  <TableCell>{worker.monthly?.full_days || 0}</TableCell><TableCell>{worker.monthly?.half_days || 0}</TableCell><TableCell>{worker.monthly?.absent_days || 0}</TableCell><TableCell>{formatCurrency(worker.monthly?.total_earned)}</TableCell><TableCell>{formatCurrency(worker.monthly?.total_paid)}</TableCell><TableCell>{formatCurrency(worker.monthly?.total_unpaid)}</TableCell>
                </> : <>
                  <TableCell><Badge variant="outline" className="capitalize">{worker.payment?.day_type || 'Not marked'}</Badge></TableCell><TableCell>{worker.payment ? formatCurrency(worker.payment.amount) : '—'}</TableCell><TableCell>{worker.payment ? (worker.payment.is_paid ? <Badge>Paid</Badge> : <Badge variant="outline">Unpaid</Badge>) : '—'}</TableCell>
                </>}
              </TableRow>)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function OperationalCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Clock3 }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="rounded-lg bg-primary/10 p-3"><Icon className="h-5 w-5 text-primary" /></div>
        <div><p className="text-2xl font-bold">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div>
      </CardContent>
    </Card>
  );
}
