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
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Banknote, Users, CheckCircle2, Clock, UserX, Coins } from 'lucide-react';
import { format } from 'date-fns';

interface CasualWorker {
    id: string;
    name: string;
    phone?: string;
    nic?: string;
    department?: string;
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
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState<string | null>(null);
    const [workerDialogOpen, setWorkerDialogOpen] = useState(false);
    const [editingWorker, setEditingWorker] = useState<CasualWorker | null>(null);
    const [workerForm, setWorkerForm] = useState({ name: '', phone: '', nic: '', department: '', daily_rate: '', notes: '' });

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
        setWorkerForm({ name: '', phone: '', nic: '', department: '', daily_rate: '', notes: '' });
        setWorkerDialogOpen(true);
    };

    const openEditWorker = (w: CasualWorker) => {
        setEditingWorker(w);
        setWorkerForm({ name: w.name, phone: w.phone || '', nic: w.nic || '', department: w.department || '', daily_rate: String(w.daily_rate), notes: w.notes || '' });
        setWorkerDialogOpen(true);
    };

    const saveWorker = async () => {
        if (!workerForm.name.trim()) return toast({ variant: 'destructive', title: 'Name required' });
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
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
    };

    const toggleActive = async (w: CasualWorker) => {
        try {
            const res = await fetch('/api/hrms/casual-workers', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: w.id, name: w.name, phone: w.phone, nic: w.nic, department: w.department, daily_rate: w.daily_rate, is_active: !w.is_active, notes: w.notes }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            fetchWorkers();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
    };

    // Summary
    const present = workers.filter(w => w.payment && w.payment.day_type !== 'absent');
    const totalToPay = present.filter(w => !w.payment?.is_paid).reduce((s, w) => s + (w.payment?.amount || 0), 0);
    const totalPaid = present.filter(w => w.payment?.is_paid).reduce((s, w) => s + (w.payment?.amount || 0), 0);

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
                <Button onClick={openAddWorker}><Plus className="mr-2 h-4 w-4" /> Add Worker</Button>
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
                            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-auto" />
                        </div>
                        <div className="flex gap-3 ml-auto flex-wrap">
                            <Card className="px-4 py-2 flex items-center gap-2">
                                <Users className="h-4 w-4 text-blue-500" />
                                <div className="text-sm"><span className="font-bold">{present.length}</span> <span className="text-muted-foreground">Present</span></div>
                            </Card>
                            <Card className="px-4 py-2 flex items-center gap-2">
                                <Clock className="h-4 w-4 text-orange-500" />
                                <div className="text-sm"><span className="font-bold">LKR {totalToPay.toLocaleString()}</span> <span className="text-muted-foreground">To Pay</span></div>
                            </Card>
                            <Card className="px-4 py-2 flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <div className="text-sm"><span className="font-bold">LKR {totalPaid.toLocaleString()}</span> <span className="text-muted-foreground">Paid</span></div>
                            </Card>
                        </div>
                    </div>

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
                                <p className="text-sm text-muted-foreground py-8 text-center">No active casual workers. Add workers using the "Manage Workers" tab.</p>
                            ) : (
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
                                        {workers.map(w => {
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
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Manage Workers Tab ── */}
                <TabsContent value="workers">
                    <Card>
                        <CardHeader>
                            <CardTitle>Casual Workers</CardTitle>
                            <CardDescription>Register and manage day-wage workers. They do not have system logins.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Phone</TableHead>
                                        <TableHead>Department</TableHead>
                                        <TableHead>Daily Rate</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {workers.map(w => (
                                        <TableRow key={w.id}>
                                            <TableCell>
                                                <div className="font-medium">{w.name}</div>
                                                {w.nic && <div className="text-xs text-muted-foreground">NIC: {w.nic}</div>}
                                            </TableCell>
                                            <TableCell>{w.phone || '—'}</TableCell>
                                            <TableCell>{w.department || '—'}</TableCell>
                                            <TableCell className="font-medium">LKR {w.daily_rate.toLocaleString()}</TableCell>
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
                                    {workers.length === 0 && (
                                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No workers yet. Click "Add Worker" to register one.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
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
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Department</Label>
                                <Input placeholder="e.g. Kitchen, Garden" value={workerForm.department} onChange={e => setWorkerForm(f => ({ ...f, department: e.target.value }))} />
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
