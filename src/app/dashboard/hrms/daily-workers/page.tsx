'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Banknote, CheckCircle2, UserX, Coins, Search, ChevronsUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import Link from 'next/link';
import { DailyWorkerDaySummary } from '@/components/dashboard/hrms/daily-workers-finance';

interface CasualWorker {
    id: string;
    name: string;
    phone?: string;
    nic?: string;
    address?: string;
    department?: string;
    employee_number?: string;
    system_access?: boolean;
    user_id?: string | null;
    system_user?: { email?: string } | null;
    daily_rate: number;
    is_active: boolean;
    notes?: string;
    payment?: DailyPayment | null;
}

interface DailyPayment {
    id: string;
    worker_id: string;
    date: string;
    daily_rate: number;
    day_type: 'full' | 'half' | 'absent';
    amount: number;
    is_paid: boolean;
    paid_at?: string;
    notes?: string;
}

const today = format(new Date(), 'yyyy-MM-dd');

export default function DailyWorkersPage() {
    const { toast } = useToast();
    const [date, setDate] = useState(today);
    const [workers, setWorkers] = useState<CasualWorker[]>([]);
    const [managedWorkers, setManagedWorkers] = useState<CasualWorker[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState<string | null>(null);
    const [workerDialogOpen, setWorkerDialogOpen] = useState(false);
    const [editingWorker, setEditingWorker] = useState<CasualWorker | null>(null);
    const [workerForm, setWorkerForm] = useState({ name: '', phone: '', nic: '', address: '', department: '', daily_rate: '', notes: '', system_access: false, email: '', password: '' });
    const [assignmentDate, setAssignmentDate] = useState(today);
    const [assignedWorkerIds, setAssignedWorkerIds] = useState<string[]>([]);
    const [assignmentWorkerOpen, setAssignmentWorkerOpen] = useState(false);
    const [savingAssignments, setSavingAssignments] = useState(false);
    const [workerSearch, setWorkerSearch] = useState('');
    const [workerDepartmentFilter, setWorkerDepartmentFilter] = useState('all');
    const [workerAccessFilter, setWorkerAccessFilter] = useState('all');
    const [financeSummary, setFinanceSummary] = useState({ requested: 0, issued: 0, to_issue: 0, balance: 0 });

    const fetchWorkers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/hrms/daily-payments?date=${date}`);
            const data = await res.json();
            setWorkers(data.workers || []);
        } catch {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to load workers.' });
        } finally {
            setLoading(false);
        }
    }, [date, toast]);

    useEffect(() => { fetchWorkers(); }, [fetchWorkers]);

    useEffect(() => {
        fetch(`/api/hrms/daily-worker-finance?date=${date}`)
            .then(response => response.json())
            .then(payload => setFinanceSummary(payload.summary || { requested: 0, issued: 0, to_issue: 0, balance: 0 }))
            .catch(() => setFinanceSummary({ requested: 0, issued: 0, to_issue: 0, balance: 0 }));
    }, [date]);

    const fetchManagedWorkers = useCallback(async () => {
        const res = await fetch('/api/hrms/casual-workers');
        const data = await res.json();
        setManagedWorkers(data.workers || []);
    }, []);

    useEffect(() => { fetchManagedWorkers(); }, [fetchManagedWorkers]);

    const fetchAssignments = useCallback(async () => {
        const res = await fetch(`/api/hrms/casual-worker-assignments?date=${assignmentDate}`);
        const data = await res.json();
        setAssignedWorkerIds(data.worker_ids || []);
    }, [assignmentDate]);

    useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

    useEffect(() => {
        fetch('/api/admin/job-titles')
            .then(res => res.json())
            .then(data => setDepartments(Object.keys(data.titles || {}).sort()))
            .catch(() => setDepartments([]));
    }, []);

    const markAttendance = async (worker: CasualWorker, day_type: 'full' | 'half' | 'absent') => {
        setSaving(worker.id);
        try {
            const res = await fetch('/api/hrms/daily-payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ worker_id: worker.id, date, daily_rate: worker.daily_rate, day_type, is_paid: false }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setWorkers(prev => prev.map(w => w.id === worker.id ? { ...w, payment: data.payment } : w));
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setSaving(null);
        }
    };

    const markPaid = async (worker: CasualWorker) => {
        if (!worker.payment || worker.payment.day_type === 'absent') return;
        setSaving(worker.id);
        try {
            const res = await fetch('/api/hrms/daily-payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    worker_id: worker.id,
                    date,
                    daily_rate: worker.daily_rate,
                    day_type: worker.payment.day_type,
                    is_paid: true,
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setWorkers(prev => prev.map(w => w.id === worker.id ? { ...w, payment: data.payment } : w));
            toast({ title: 'Paid', description: `LKR ${data.payment.amount.toLocaleString()} paid to ${worker.name}.` });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setSaving(null);
        }
    };

    const payAll = async () => {
        const unpaid = workers.filter(w => w.payment && w.payment.day_type !== 'absent' && !w.payment.is_paid);
        for (const w of unpaid) await markPaid(w);
        toast({ title: 'Done', description: `Paid ${unpaid.length} worker(s).` });
    };

    const openAddWorker = () => {
        setEditingWorker(null);
        setWorkerForm({ name: '', phone: '', nic: '', address: '', department: '', daily_rate: '', notes: '', system_access: false, email: '', password: '' });
        setWorkerDialogOpen(true);
    };

    const openEditWorker = (w: CasualWorker) => {
        setEditingWorker(w);
        setWorkerForm({ name: w.name, phone: w.phone || '', nic: w.nic || '', address: w.address || '', department: w.department || '', daily_rate: String(w.daily_rate), notes: w.notes || '', system_access: !!w.system_access, email: w.system_user?.email || '', password: '' });
        setWorkerDialogOpen(true);
    };

    const saveWorker = async () => {
        if (!workerForm.name.trim()) return toast({ variant: 'destructive', title: 'Name required' });
        if (workerForm.system_access && !workerForm.email.trim()) return toast({ variant: 'destructive', title: 'Email required for system access' });
        if (workerForm.system_access && (!editingWorker?.user_id || !editingWorker.system_access) && workerForm.password.length < 6) return toast({ variant: 'destructive', title: 'Password must contain at least 6 characters' });
        try {
            const url = editingWorker ? '/api/hrms/casual-workers' : '/api/hrms/casual-workers';
            const method = editingWorker ? 'PUT' : 'POST';
            const body = editingWorker
                ? { id: editingWorker.id, ...workerForm, is_active: editingWorker.is_active }
                : workerForm;
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            toast({ title: editingWorker ? 'Updated' : 'Worker Added' });
            setWorkerDialogOpen(false);
            fetchWorkers();
            fetchManagedWorkers();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
    };

    const toggleActive = async (w: CasualWorker) => {
        try {
            const res = await fetch('/api/hrms/casual-workers', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: w.id,
                    name: w.name,
                    phone: w.phone,
                    nic: w.nic,
                    address: w.address,
                    department: w.department,
                    daily_rate: w.daily_rate,
                    is_active: !w.is_active,
                    notes: w.notes,
                    system_access: w.system_access,
                    email: w.system_user?.email,
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            fetchWorkers();
            fetchManagedWorkers();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
    };

    const saveAssignments = async () => {
        setSavingAssignments(true);
        try {
            const res = await fetch('/api/hrms/casual-worker-assignments', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: assignmentDate, worker_ids: assignedWorkerIds }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save assignments.');
            if (date === assignmentDate) fetchWorkers();
            toast({ title: 'Daily roster saved', description: `${assignedWorkerIds.length} worker(s) assigned for ${assignmentDate}.` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        } finally {
            setSavingAssignments(false);
        }
    };

    // Summary
    const present = workers.filter(w => w.payment && w.payment.day_type !== 'absent');
    const totalToPay = present.reduce((s, w) => s + (w.payment?.amount || 0), 0);
    const totalPaid = present.filter(w => w.payment?.is_paid).reduce((s, w) => s + (w.payment?.amount || 0), 0);

    const filteredManagedWorkers = managedWorkers.filter(worker => {
        const term = workerSearch.trim().toLowerCase();
        const matchesSearch = !term || [worker.name, worker.employee_number, worker.phone, worker.nic, worker.address]
            .some(value => value?.toLowerCase().includes(term));
        const matchesDepartment = workerDepartmentFilter === 'all' || worker.department === workerDepartmentFilter;
        const matchesAccess = workerAccessFilter === 'all'
            || (workerAccessFilter === 'enabled' ? worker.system_access : !worker.system_access);
        return matchesSearch && matchesDepartment && matchesAccess;
    });

    const {
        currentPage: workerCurrentPage,
        totalPages: workerTotalPages,
        totalItems: workerTotalItems,
        paginatedItems: paginatedManagedWorkers,
        itemsPerPage: workerItemsPerPage,
        setCurrentPage: setWorkerCurrentPage,
    } = usePagination(filteredManagedWorkers, 10);

    const {
        currentPage: attendanceCurrentPage,
        totalPages: attendanceTotalPages,
        totalItems: attendanceTotalItems,
        paginatedItems: paginatedAttendanceWorkers,
        itemsPerPage: attendanceItemsPerPage,
        setCurrentPage: setAttendanceCurrentPage,
    } = usePagination(workers, 10);

    const dayTypeBadge = (p: DailyPayment | null) => {
        if (!p) return <Badge variant="outline" className="text-muted-foreground">Not Marked</Badge>;
        if (p.day_type === 'absent') return <Badge variant="destructive">Absent</Badge>;
        if (p.day_type === 'half') return <Badge className="bg-yellow-500 text-white">Half Day</Badge>;
        return <Badge className="bg-green-600 text-white">Full Day</Badge>;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Daily Workers</h1>
                    <p className="text-muted-foreground">Mark attendance and pay casual / day-wage workers.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" asChild><Link href={`/dashboard/hrms/daily-workers/requests?date=${date}`}><Banknote className="mr-2 h-4 w-4" /> Money Requests</Link></Button>
                    <Button onClick={openAddWorker}><Plus className="mr-2 h-4 w-4" /> Add Worker</Button>
                </div>
            </div>

            <Tabs defaultValue="attendance">
                <TabsList>
                    <TabsTrigger value="attendance">Attendance & Pay</TabsTrigger>
                    <TabsTrigger value="workers">Manage Workers</TabsTrigger>
                </TabsList>

                {/* ── Attendance & Pay Tab ── */}
                <TabsContent value="attendance" className="space-y-4">
                    {/* Date + Summary */}
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Label className="text-sm font-medium whitespace-nowrap">Select Date:</Label>
                            <Input type="date" value={date} onChange={e => { setDate(e.target.value); setAttendanceCurrentPage(1); }} className="w-auto" />
                        </div>
                    </div>

                    <DailyWorkerDaySummary present={present.length} toPay={totalToPay} paid={totalPaid} requested={financeSummary.requested} issued={financeSummary.issued} toIssue={financeSummary.to_issue} balance={financeSummary.balance} />

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <div>
                                <CardTitle>Workers — {format(new Date(date + 'T00:00:00'), 'EEEE, dd MMM yyyy')}</CardTitle>
                                <CardDescription>Mark attendance in the morning. Pay at end of day.</CardDescription>
                            </div>
                            {totalToPay > 0 && (
                                <Button onClick={payAll} className="bg-green-600 hover:bg-green-700">
                                    <Coins className="mr-2 h-4 w-4" /> Pay All Unpaid (LKR {totalToPay.toLocaleString()})
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
                            ) : workers.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-8 text-center">No casual workers are assigned for this date. Create the daily roster in the "Manage Workers" tab.</p>
                            ) : (
                                <div className="space-y-4">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Worker</TableHead>
                                            <TableHead>Daily Rate</TableHead>
                                            <TableHead>Mark Attendance</TableHead>
                                            <TableHead>Amount</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Pay</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedAttendanceWorkers.map(w => {
                                            const isLoading = saving === w.id;
                                            const isPaid = !!w.payment?.is_paid;
                                            const amount = w.payment?.amount ?? 0;
                                            return (
                                                <TableRow key={w.id}>
                                                    <TableCell>
                                                        <div className="font-medium">{w.name}</div>
                                                        {(w.department || w.phone) && (
                                                            <div className="text-xs text-muted-foreground">{[w.department, w.phone].filter(Boolean).join(' · ')}</div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="font-medium">LKR {w.daily_rate.toLocaleString()}</TableCell>
                                                    <TableCell>
                                                        <div className="flex gap-1">
                                                            {(['full', 'half', 'absent'] as const).map(dt => (
                                                                <Button
                                                                    key={dt}
                                                                    size="sm"
                                                                    variant={w.payment?.day_type === dt ? 'default' : 'outline'}
                                                                    className={
                                                                        w.payment?.day_type === dt
                                                                            ? dt === 'absent' ? 'bg-red-500 hover:bg-red-600'
                                                                            : dt === 'half' ? 'bg-yellow-500 hover:bg-yellow-600'
                                                                            : 'bg-green-600 hover:bg-green-700'
                                                                            : ''
                                                                    }
                                                                    onClick={() => !isPaid && markAttendance(w, dt)}
                                                                    disabled={isLoading || isPaid}
                                                                >
                                                                    {dt === 'full' ? 'Full' : dt === 'half' ? 'Half' : 'Absent'}
                                                                </Button>
                                                            ))}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-bold">
                                                        {w.payment ? `LKR ${amount.toLocaleString()}` : '—'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {isPaid ? (
                                                            <Badge className="bg-green-600 text-white gap-1">
                                                                <CheckCircle2 className="h-3 w-3" /> Paid
                                                            </Badge>
                                                        ) : w.payment?.day_type === 'absent' ? (
                                                            <Badge variant="destructive">Absent</Badge>
                                                        ) : w.payment ? (
                                                            <Badge variant="secondary">Unpaid</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-muted-foreground">Not Marked</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            size="sm"
                                                            disabled={!w.payment || w.payment.day_type === 'absent' || isPaid || isLoading}
                                                            onClick={() => markPaid(w)}
                                                            className={isPaid ? '' : 'bg-green-600 hover:bg-green-700'}
                                                            variant={isPaid ? 'outline' : 'default'}
                                                        >
                                                            <Banknote className="h-3 w-3 mr-1" />
                                                            {isPaid ? 'Done' : `Pay LKR ${amount.toLocaleString()}`}
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                                <DataTablePagination
                                    currentPage={attendanceCurrentPage}
                                    totalPages={attendanceTotalPages}
                                    totalItems={attendanceTotalItems}
                                    itemsPerPage={attendanceItemsPerPage}
                                    onPageChange={setAttendanceCurrentPage}
                                />
                                </div>
                            )}
                        </CardContent>
                    </Card>

                </TabsContent>

                {/* ── Manage Workers Tab ── */}
                <TabsContent value="workers" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Assign Workers by Date</CardTitle>
                            <CardDescription>Select the casual workers who should appear in Attendance &amp; Pay on a specific date.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-wrap items-end gap-3">
                                <div>
                                    <Label>Work Date</Label>
                                    <Input type="date" value={assignmentDate} onChange={event => setAssignmentDate(event.target.value)} className="w-auto" />
                                </div>
                                <div className="min-w-64 flex-1">
                                    <Label>Employee</Label>
                                    <Popover open={assignmentWorkerOpen} onOpenChange={setAssignmentWorkerOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" role="combobox" aria-expanded={assignmentWorkerOpen} className="w-full justify-between font-normal">
                                                Search and select a casual worker
                                                <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                            <Command>
                                                <CommandInput placeholder="Search name, number, or department…" />
                                                <CommandList>
                                                    <CommandEmpty>No available worker found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {managedWorkers.filter(worker => worker.is_active && !assignedWorkerIds.includes(worker.id)).map(worker => (
                                                            <CommandItem
                                                                key={worker.id}
                                                                value={`${worker.employee_number || ''} ${worker.name} ${worker.department || ''}`}
                                                                onSelect={() => {
                                                                    setAssignedWorkerIds(current => [...new Set([...current, worker.id])]);
                                                                    setAssignmentWorkerOpen(false);
                                                                }}
                                                            >
                                                                <div>
                                                                    <div className="font-medium">{worker.employee_number || 'No number'} — {worker.name}</div>
                                                                    <div className="text-xs text-muted-foreground">{worker.department || 'Unassigned'}</div>
                                                                </div>
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <Button variant="outline" onClick={() => setAssignedWorkerIds(managedWorkers.filter(worker => worker.is_active).map(worker => worker.id))}>Select All Active</Button>
                                <Button variant="outline" onClick={() => setAssignedWorkerIds([])}>Clear All</Button>
                                <Button onClick={saveAssignments} disabled={savingAssignments}>{savingAssignments ? 'Saving…' : 'Save Daily Roster'}</Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {assignedWorkerIds.map(workerId => {
                                    const worker = managedWorkers.find(item => item.id === workerId);
                                    if (!worker) return null;
                                    return (
                                        <Badge key={workerId} variant="secondary" className="gap-2 py-1.5 pl-3 pr-1.5">
                                            {worker.employee_number || 'No number'} — {worker.name}
                                            <button type="button" aria-label={`Remove ${worker.name}`} onClick={() => setAssignedWorkerIds(current => current.filter(id => id !== workerId))} className="rounded px-1 hover:bg-background">×</button>
                                        </Badge>
                                    );
                                })}
                                {assignedWorkerIds.length === 0 && <p className="text-sm text-muted-foreground">No workers selected for this date.</p>}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Casual Workers</CardTitle>
                            <CardDescription>Register day-wage workers and manage their department and optional system access.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-3 md:grid-cols-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        value={workerSearch}
                                        onChange={event => { setWorkerSearch(event.target.value); setWorkerCurrentPage(1); }}
                                        placeholder="Search name, number, phone, NIC…"
                                        className="pl-9"
                                    />
                                </div>
                                <Select value={workerDepartmentFilter} onValueChange={value => { setWorkerDepartmentFilter(value); setWorkerCurrentPage(1); }}>
                                    <SelectTrigger><SelectValue placeholder="All departments" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All departments</SelectItem>
                                        {departments.map(department => <SelectItem key={department} value={department}>{department}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Select value={workerAccessFilter} onValueChange={value => { setWorkerAccessFilter(value); setWorkerCurrentPage(1); }}>
                                    <SelectTrigger><SelectValue placeholder="All access statuses" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All access statuses</SelectItem>
                                        <SelectItem value="enabled">System access enabled</SelectItem>
                                        <SelectItem value="disabled">System access disabled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Phone</TableHead>
                                        <TableHead>Department</TableHead>
                                        <TableHead>Daily Rate</TableHead>
                                        <TableHead>System Access</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedManagedWorkers.map(w => (
                                        <TableRow key={w.id}>
                                            <TableCell>
                                                <div className="font-medium">{w.name}</div>
                                                {w.employee_number && <div className="text-xs font-semibold text-primary">Employee No. {w.employee_number}</div>}
                                                {w.nic && <div className="text-xs text-muted-foreground">NIC: {w.nic}</div>}
                                            </TableCell>
                                            <TableCell>{w.phone || '—'}</TableCell>
                                            <TableCell>{w.department || '—'}</TableCell>
                                            <TableCell className="font-medium">LKR {w.daily_rate.toLocaleString()}</TableCell>
                                            <TableCell>
                                                {w.system_access
                                                    ? <Badge className="bg-blue-600 text-white">Enabled</Badge>
                                                    : <Badge variant="outline">Disabled</Badge>}
                                            </TableCell>
                                            <TableCell>
                                                {w.is_active
                                                    ? <Badge className="bg-green-600 text-white">Active</Badge>
                                                    : <Badge variant="secondary">Inactive</Badge>}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex gap-2 justify-end">
                                                    <Button size="sm" variant="outline" onClick={() => openEditWorker(w)}>
                                                        <Edit className="h-3 w-3 mr-1" /> Edit
                                                    </Button>
                                                    <Button size="sm" variant="outline" onClick={() => toggleActive(w)}>
                                                        {w.is_active ? <><UserX className="h-3 w-3 mr-1" /> Deactivate</> : 'Activate'}
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredManagedWorkers.length === 0 && (
                                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No casual workers match these filters.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            <DataTablePagination
                                currentPage={workerCurrentPage}
                                totalPages={workerTotalPages}
                                totalItems={workerTotalItems}
                                itemsPerPage={workerItemsPerPage}
                                onPageChange={setWorkerCurrentPage}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

            </Tabs>

            {/* Add / Edit Worker Dialog */}
            <Dialog open={workerDialogOpen} onOpenChange={setWorkerDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingWorker ? 'Edit Worker' : 'Add Casual Worker'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <Label>Full Name *</Label>
                            <Input placeholder="e.g. Sunil Perera" value={workerForm.name} onChange={e => setWorkerForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Phone</Label>
                                <Input placeholder="07X XXX XXXX" value={workerForm.phone} onChange={e => setWorkerForm(f => ({ ...f, phone: e.target.value }))} />
                            </div>
                            <div>
                                <Label>NIC</Label>
                                <Input placeholder="National ID" value={workerForm.nic} onChange={e => setWorkerForm(f => ({ ...f, nic: e.target.value }))} />
                            </div>
                        </div>
                        <div>
                            <Label>Address</Label>
                            <Input placeholder="Residential address" value={workerForm.address} onChange={e => setWorkerForm(f => ({ ...f, address: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Department</Label>
                                <Select
                                    value={workerForm.department || 'unassigned'}
                                    onValueChange={value => setWorkerForm(f => ({ ...f, department: value === 'unassigned' ? '' : value }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unassigned">Unassigned</SelectItem>
                                        {workerForm.department && !departments.includes(workerForm.department) && (
                                            <SelectItem value={workerForm.department}>{workerForm.department}</SelectItem>
                                        )}
                                        {departments.map(department => (
                                            <SelectItem key={department} value={department}>{department}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Daily Rate (LKR) *</Label>
                                <Input type="number" min="0" placeholder="0.00" value={workerForm.daily_rate} onChange={e => setWorkerForm(f => ({ ...f, daily_rate: e.target.value }))} />
                            </div>
                        </div>
                        <div>
                            <Label>Notes</Label>
                            <Input placeholder="Optional notes" value={workerForm.notes} onChange={e => setWorkerForm(f => ({ ...f, notes: e.target.value }))} />
                        </div>
                        <div className="rounded-md border border-input p-4 space-y-3">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <Label htmlFor="casual-system-access">Allow System Login</Label>
                                    <p className="text-xs text-muted-foreground">Creates limited Profile and Attendance access.</p>
                                </div>
                                <Switch id="casual-system-access" checked={workerForm.system_access} onCheckedChange={checked => setWorkerForm(f => ({ ...f, system_access: checked }))} />
                            </div>
                            {workerForm.system_access && (
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div>
                                        <Label>Login Email *</Label>
                                        <Input type="email" value={workerForm.email} onChange={e => setWorkerForm(f => ({ ...f, email: e.target.value }))} />
                                    </div>
                                    <div>
                                        <Label>{editingWorker?.user_id && editingWorker.system_access ? 'New Password (optional)' : 'Password *'}</Label>
                                        <Input type="password" minLength={6} placeholder={editingWorker?.user_id && editingWorker.system_access ? 'Leave blank to keep current' : 'Minimum 6 characters'} value={workerForm.password} onChange={e => setWorkerForm(f => ({ ...f, password: e.target.value }))} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setWorkerDialogOpen(false)}>Cancel</Button>
                        <Button onClick={saveWorker}>{editingWorker ? 'Update' : 'Add Worker'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
