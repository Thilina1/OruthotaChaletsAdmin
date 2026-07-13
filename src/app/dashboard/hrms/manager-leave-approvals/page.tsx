'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Clock, Users } from "lucide-react";
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
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
    status: 'pending_manager' | 'pending' | 'approved' | 'rejected';
    half_day_type?: string;
    created_at?: string;
    leave_type?: { id: string; name: string };
    employee?: { id: string; name: string; email: string; reporting_manager_id?: string };
};

export default function ManagerLeaveApprovalsPage() {
    const [teamLeaves, setTeamLeaves] = useState<LeaveEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [confirming, setConfirming] = useState<{ id: string; action: 'approved' | 'rejected' } | null>(null);
    const { toast } = useToast();

    const fetchLeaves = useCallback(async (uid: string) => {
        setLoading(true);
        try {
            const res = await fetch('/api/hrms/leaves');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            const all: LeaveEntry[] = data.leaves ?? [];
            setTeamLeaves(all.filter(l =>
                l.employee?.reporting_manager_id === uid && l.status === 'pending_manager'
            ));
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        const init = async () => {
            const res = await fetch('/api/auth/me');
            const data = await res.json();
            if (data.user) {
                setUserId(data.user.id);
                fetchLeaves(data.user.id);
            }
        };
        init();
    }, [fetchLeaves]);

    const handleAction = async () => {
        if (!confirming || !userId) return;
        try {
            const res = await fetch('/api/hrms/leaves', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: confirming.id,
                    status: confirming.action,
                    approved_by: userId,
                    action_type: 'manager',
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            const msg = confirming.action === 'approved'
                ? 'Approved and forwarded to HR for final approval.'
                : 'Leave request rejected.';
            toast({ title: 'Done', description: msg });
            setConfirming(null);
            fetchLeaves(userId);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        }
    };

    const pendingCount = teamLeaves.filter(l => l.status === 'pending_manager').length;

    const { currentPage, totalPages, totalItems, paginatedItems, itemsPerPage, setCurrentPage } = usePagination(teamLeaves, 20);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Users className="h-6 w-6 text-primary" />
                <div>
                    <h1 className="text-3xl font-headline font-bold">Manager Leave Approvals</h1>
                    <p className="text-muted-foreground">Leave requests from your direct subordinates awaiting your approval.</p>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-5 pb-4 flex items-center gap-3">
                        <Clock className="h-8 w-8 text-orange-500 flex-shrink-0" />
                        <div>
                            <p className="text-2xl font-bold">{pendingCount}</p>
                            <p className="text-xs text-muted-foreground">Awaiting Your Approval</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Pending Team Requests</CardTitle>
                    <CardDescription>
                        Approving a request forwards it to HR for final approval. Rejecting closes it immediately.
                    </CardDescription>
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
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Loading...</TableCell></TableRow>
                            ) : paginatedItems.length === 0 ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No pending requests from your team.</TableCell></TableRow>
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
                                        <p>{leave.start_date}{leave.end_date !== leave.start_date && ` → ${leave.end_date}`}</p>
                                        {leave.half_day_type && <p className="text-xs text-muted-foreground capitalize">{leave.half_day_type} session</p>}
                                    </TableCell>
                                    <TableCell>{leave.days_count}</TableCell>
                                    <TableCell className="max-w-[160px]">
                                        <p className="truncate text-sm">{leave.reason}</p>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                        {leave.created_at ? new Date(leave.created_at).toLocaleDateString() : '—'}
                                    </TableCell>
                                    <TableCell className="text-right">
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
                            {confirming?.action === 'approved'
                                ? 'This will approve the request and forward it to HR for final approval.'
                                : 'This will reject the leave request.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleAction}
                            className={confirming?.action === 'rejected' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
                        >
                            {confirming?.action === 'approved' ? 'Approve & Forward to HR' : 'Reject'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
