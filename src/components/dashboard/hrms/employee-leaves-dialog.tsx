'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, CalendarDays } from 'lucide-react';
import {
    Dialog as SubDialog,
    DialogContent as SubDialogContent,
    DialogHeader as SubDialogHeader,
    DialogTitle as SubDialogTitle,
} from '@/components/ui/dialog';
import { LeaveRequestForm, type LeaveRequestPayload } from './leave-request-form';
import { useToast } from '@/hooks/use-toast';
import type { User, LeaveSchemeType } from '@/lib/types';

type BalanceItem = LeaveSchemeType & {
    used_days: number;
    pending_days: number;
    available_days: number;
};

type LeaveEntry = {
    id: string;
    leave_type_id: string;
    start_date: string;
    end_date: string;
    days_count: number;
    reason?: string;
    status: 'pending' | 'approved' | 'rejected';
    half_day_type?: string;
    leave_type?: { id: string; name: string };
    approver?: { id: string; name: string };
    created_at?: string;
};

function StatusBadge({ status }: { status: string }) {
    if (status === 'approved') return <Badge className="bg-green-100 text-green-800 border-green-300">Approved</Badge>;
    if (status === 'rejected') return <Badge variant="destructive">Rejected</Badge>;
    return <Badge variant="secondary">Pending</Badge>;
}

function BalanceCard({ item }: { item: BalanceItem }) {
    const pct = item.days_count > 0 ? Math.round((item.used_days / item.days_count) * 100) : 0;
    return (
        <Card>
            <CardContent className="pt-5 pb-4">
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <p className="text-sm font-semibold">{item.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{item.reset_period}</p>
                    </div>
                    <span className="text-2xl font-bold text-primary">{item.available_days}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 mb-2">
                    <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Used: <strong className="text-foreground">{item.used_days}</strong></span>
                    {item.pending_days > 0 && <span>Pending: <strong className="text-yellow-600">{item.pending_days}</strong></span>}
                    <span>Total: <strong className="text-foreground">{item.days_count}</strong></span>
                </div>
            </CardContent>
        </Card>
    );
}

interface EmployeeLeavesDialogProps {
    employee: User;
    isOpen: boolean;
    onClose: () => void;
    adminId: string | null;
}

export function EmployeeLeavesDialog({ employee, isOpen, onClose, adminId }: EmployeeLeavesDialogProps) {
    const { toast } = useToast();
    const [balance, setBalance] = useState<BalanceItem[]>([]);
    const [schemeTypes, setSchemeTypes] = useState<LeaveSchemeType[]>([]);
    const [hasScheme, setHasScheme] = useState(false);
    const [leaves, setLeaves] = useState<LeaveEntry[]>([]);
    const [loadingBalance, setLoadingBalance] = useState(false);
    const [loadingLeaves, setLoadingLeaves] = useState(false);
    const [isAddLeaveOpen, setIsAddLeaveOpen] = useState(false);

    const fetchBalance = useCallback(async () => {
        setLoadingBalance(true);
        try {
            const res = await fetch(`/api/hrms/leave-balance?userId=${employee.id}`);
            const data = await res.json();
            setHasScheme(data.hasScheme ?? false);
            setBalance(data.balance ?? []);
            setSchemeTypes(data.balance ?? []);
        } catch {
            // fail silently
        } finally {
            setLoadingBalance(false);
        }
    }, [employee.id]);

    const fetchLeaves = useCallback(async () => {
        setLoadingLeaves(true);
        try {
            const res = await fetch('/api/hrms/leaves');
            const data = await res.json();
            const all: LeaveEntry[] = data.leaves ?? [];
            setLeaves(all.filter(l => (l as any).user_id === employee.id));
        } catch {
            // fail silently
        } finally {
            setLoadingLeaves(false);
        }
    }, [employee.id]);

    useEffect(() => {
        if (isOpen) {
            fetchBalance();
            fetchLeaves();
        }
    }, [isOpen, fetchBalance, fetchLeaves]);

    const handleAddLeave = async (values: LeaveRequestPayload) => {
        try {
            const res = await fetch('/api/hrms/leaves', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...values,
                    user_id: employee.id,
                    status: 'approved',
                    approved_by: adminId,
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            toast({ title: 'Leave Added', description: `Leave has been assigned to ${employee.name} and auto-approved.` });
            setIsAddLeaveOpen(false);
            fetchBalance();
            fetchLeaves();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <DialogTitle>{employee.name} — Leave Management</DialogTitle>
                                <p className="text-sm text-muted-foreground mt-0.5">{employee.email}</p>
                            </div>
                            {hasScheme && (
                                <Button size="sm" onClick={() => setIsAddLeaveOpen(true)}>
                                    <Plus className="mr-2 h-4 w-4" /> Add Leave
                                </Button>
                            )}
                        </div>
                    </DialogHeader>

                    {!hasScheme && !loadingBalance && (
                        <Card className="border-dashed">
                            <CardContent className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
                                <CalendarDays className="h-5 w-5 flex-shrink-0" />
                                No leave scheme assigned to this employee. Assign one via Edit Employee.
                            </CardContent>
                        </Card>
                    )}

                    {hasScheme && (
                        <Tabs defaultValue="balance">
                            <TabsList className="w-full">
                                <TabsTrigger value="balance" className="flex-1">Leave Balance</TabsTrigger>
                                <TabsTrigger value="history" className="flex-1">Leave History</TabsTrigger>
                            </TabsList>

                            <TabsContent value="balance" className="mt-4">
                                {loadingBalance ? (
                                    <p className="text-sm text-muted-foreground text-center py-6">Loading balance…</p>
                                ) : balance.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-6">No leave types configured.</p>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {balance.map(item => <BalanceCard key={item.id} item={item} />)}
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="history" className="mt-4">
                                {loadingLeaves ? (
                                    <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
                                ) : leaves.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-6">No leave records for this employee.</p>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Dates</TableHead>
                                                <TableHead>Days</TableHead>
                                                <TableHead>Reason</TableHead>
                                                <TableHead>Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {leaves.map(leave => (
                                                <TableRow key={leave.id}>
                                                    <TableCell className="font-medium">{leave.leave_type?.name ?? '—'}</TableCell>
                                                    <TableCell className="text-sm">
                                                        {leave.start_date}
                                                        {leave.end_date !== leave.start_date && ` → ${leave.end_date}`}
                                                        {leave.half_day_type && (
                                                            <span className="ml-1 text-xs text-muted-foreground">({leave.half_day_type})</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>{leave.days_count}</TableCell>
                                                    <TableCell className="max-w-[160px] truncate">{leave.reason ?? '—'}</TableCell>
                                                    <TableCell><StatusBadge status={leave.status} /></TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </TabsContent>
                        </Tabs>
                    )}
                </DialogContent>
            </Dialog>

            {/* Add Leave sub-dialog */}
            <SubDialog open={isAddLeaveOpen} onOpenChange={setIsAddLeaveOpen}>
                <SubDialogContent>
                    <SubDialogHeader>
                        <SubDialogTitle>Add Leave for {employee.name}</SubDialogTitle>
                    </SubDialogHeader>
                    <LeaveRequestForm schemeTypes={schemeTypes} onSubmit={handleAddLeave} />
                </SubDialogContent>
            </SubDialog>
        </>
    );
}
