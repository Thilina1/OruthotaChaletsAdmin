'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Clock, Search } from "lucide-react";
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type LeaveEntry = {
    id: string;
    user_id: string;
    leave_type_id: string;
    start_date: string;
    end_date: string;
    days_count: number;
    reason?: string;
    status: 'pending' | 'approved' | 'rejected';
    half_day_type?: string;
    created_at?: string;
    leave_type?: { id: string; name: string };
    employee?: { id: string; name: string; email: string };
    approver?: { id: string; name: string };
};

function StatusBadge({ status }: { status: string }) {
    if (status === 'approved') return <Badge className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400">Approved</Badge>;
    if (status === 'rejected') return <Badge variant="destructive">Rejected</Badge>;
    return <Badge variant="secondary" className="text-yellow-700 dark:text-yellow-400">Pending</Badge>;
}

export default function LeaveApprovalsPage() {
    const [leaves, setLeaves] = useState<LeaveEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('pending');
    const [search, setSearch] = useState('');
    const [confirming, setConfirming] = useState<{ id: string; action: 'approved' | 'rejected' } | null>(null);
    const { toast } = useToast();
    useEffect(() => {
        const getUser = async () => {
            const res = await fetch('/api/auth/me');
            const data = await res.json();
            if (data.user) setUserId(data.user.id);
        };
        getUser();
    }, []);

    const fetchLeaves = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/hrms/leaves');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setLeaves(data.leaves ?? []);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchLeaves(); }, [fetchLeaves]);

    const handleAction = async () => {
        if (!confirming) return;
        try {
            const res = await fetch('/api/hrms/leaves', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: confirming.id, status: confirming.action, approved_by: userId }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            toast({ title: 'Done', description: `Leave request ${confirming.action}.` });
            setConfirming(null);
            fetchLeaves();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        }
    };

    const filtered = leaves.filter(l => {
        const matchesStatus = filterStatus === 'all' || l.status === filterStatus;
        const term = search.toLowerCase();
        const matchesSearch = !term
            || l.employee?.name.toLowerCase().includes(term)
            || l.employee?.email.toLowerCase().includes(term)
            || l.leave_type?.name.toLowerCase().includes(term);
        return matchesStatus && matchesSearch;
    });

    const pendingCount = leaves.filter(l => l.status === 'pending').length;
    const approvedCount = leaves.filter(l => l.status === 'approved').length;
    const rejectedCount = leaves.filter(l => l.status === 'rejected').length;

    const { currentPage, totalPages, totalItems, paginatedItems, itemsPerPage, setCurrentPage } = usePagination(filtered, 20);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-headline font-bold">Leave Approvals</h1>
                <p className="text-muted-foreground">Review and action employee leave requests.</p>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
                <Card className="cursor-pointer" onClick={() => setFilterStatus('pending')}>
                    <CardContent className="pt-5 pb-4 flex items-center gap-3">
                        <Clock className={`h-8 w-8 flex-shrink-0 ${filterStatus === 'pending' ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                        <div>
                            <p className="text-2xl font-bold">{pendingCount}</p>
                            <p className="text-xs text-muted-foreground">Pending</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer" onClick={() => setFilterStatus('approved')}>
                    <CardContent className="pt-5 pb-4 flex items-center gap-3">
                        <CheckCircle2 className={`h-8 w-8 flex-shrink-0 ${filterStatus === 'approved' ? 'text-green-500' : 'text-muted-foreground'}`} />
                        <div>
                            <p className="text-2xl font-bold">{approvedCount}</p>
                            <p className="text-xs text-muted-foreground">Approved</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="cursor-pointer" onClick={() => setFilterStatus('rejected')}>
                    <CardContent className="pt-5 pb-4 flex items-center gap-3">
                        <XCircle className={`h-8 w-8 flex-shrink-0 ${filterStatus === 'rejected' ? 'text-red-500' : 'text-muted-foreground'}`} />
                        <div>
                            <p className="text-2xl font-bold">{rejectedCount}</p>
                            <p className="text-xs text-muted-foreground">Rejected</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <CardTitle>Leave Requests</CardTitle>
                            <CardDescription>Click the cards above to filter by status.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Search employee…"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="pl-8 h-8 text-sm w-48"
                                />
                            </div>
                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                <SelectTrigger className="h-8 text-sm w-32">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="approved">Approved</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Employee</TableHead>
                                <TableHead>Leave Type</TableHead>
                                <TableHead>Dates</TableHead>
                                <TableHead>Days</TableHead>
                                <TableHead>Reason</TableHead>
                                <TableHead>Submitted</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Loading...</TableCell></TableRow>
                            ) : paginatedItems.length === 0 ? (
                                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No records found.</TableCell></TableRow>
                            ) : paginatedItems.map(leave => (
                                <TableRow key={leave.id}>
                                    <TableCell>
                                        <div>
                                            <p className="font-medium text-sm">{leave.employee?.name ?? '—'}</p>
                                            <p className="text-xs text-muted-foreground">{leave.employee?.email}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm">{leave.leave_type?.name ?? '—'}</TableCell>
                                    <TableCell className="text-sm">
                                        <div>
                                            <p>{leave.start_date}{leave.end_date !== leave.start_date && ` → ${leave.end_date}`}</p>
                                            {leave.half_day_type && <p className="text-xs text-muted-foreground capitalize">{leave.half_day_type} session</p>}
                                        </div>
                                    </TableCell>
                                    <TableCell>{leave.days_count}</TableCell>
                                    <TableCell className="max-w-[160px]">
                                        <p className="truncate text-sm">{leave.reason}</p>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                        {leave.created_at ? new Date(leave.created_at).toLocaleDateString() : '—'}
                                    </TableCell>
                                    <TableCell><StatusBadge status={leave.status} /></TableCell>
                                    <TableCell className="text-right">
                                        {leave.status === 'pending' && (
                                            <div className="flex justify-end gap-1.5">
                                                <Button
                                                    size="sm"
                                                    className="h-7 text-xs"
                                                    onClick={() => setConfirming({ id: leave.id, action: 'approved' })}
                                                >
                                                    <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    className="h-7 text-xs"
                                                    onClick={() => setConfirming({ id: leave.id, action: 'rejected' })}
                                                >
                                                    <XCircle className="h-3 w-3 mr-1" /> Reject
                                                </Button>
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <DataTablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
                </CardContent>
            </Card>

            <AlertDialog open={!!confirming} onOpenChange={open => { if (!open) setConfirming(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {confirming?.action === 'approved' ? 'Approve' : 'Reject'} Leave Request?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This will update the leave request status to <strong>{confirming?.action}</strong>. The employee will be notified.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleAction}
                            className={confirming?.action === 'rejected' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
                        >
                            {confirming?.action === 'approved' ? 'Approve' : 'Reject'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
