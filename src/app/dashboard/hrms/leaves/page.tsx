'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus, Clock, CheckCircle2, XCircle, CalendarDays } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { LeaveRequestForm, type LeaveRequestPayload } from '@/components/dashboard/hrms/leave-request-form';
import { Badge } from "@/components/ui/badge";
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import type { LeaveSchemeType } from '@/lib/types';

type LeaveEntry = {
    id: string;
    user_id: string;
    leave_type_id: string;
    start_date: string;
    end_date: string;
    days_count: number;
    reason?: string;
    status: 'pending' | 'approved' | 'rejected';
    approved_by?: string;
    half_day_type?: string;
    created_at?: string;
    leave_type?: { id: string; name: string; days_count: number };
    employee?: { id: string; name: string; email: string };
    approver?: { id: string; name: string };
};

type BalanceItem = LeaveSchemeType & {
    used_days: number;
    pending_days: number;
    available_days: number;
};

function StatusBadge({ status }: { status: string }) {
    if (status === 'approved') return <Badge className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400">Approved</Badge>;
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
                    <div
                        className="bg-primary h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                    />
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

export default function LeaveManagementPage() {
    const [myLeaves, setMyLeaves] = useState<LeaveEntry[]>([]);
    const [balance, setBalance] = useState<BalanceItem[]>([]);
    const [schemeTypes, setSchemeTypes] = useState<LeaveSchemeType[]>([]);
    const [hasScheme, setHasScheme] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isRequestOpen, setIsRequestOpen] = useState(false);
    const { toast } = useToast();
    const [userId, setUserId] = useState<string | null>(null);

    const fetchLeaves = useCallback(async (uid: string) => {
        setLoading(true);
        try {
            const res = await fetch('/api/hrms/leaves');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            const all: LeaveEntry[] = data.leaves ?? [];
            setMyLeaves(all.filter(l => l.user_id === uid));
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    const fetchBalance = useCallback(async (uid: string) => {
        try {
            const res = await fetch(`/api/hrms/leave-balance?userId=${uid}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setHasScheme(data.hasScheme ?? false);
            setBalance(data.balance ?? []);
            setSchemeTypes(data.balance ?? []);
        } catch {
            // supplementary — fail silently
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            const res = await fetch('/api/auth/me');
            const data = await res.json();
            if (data.user) {
                setUserId(data.user.id);
                fetchLeaves(data.user.id);
                fetchBalance(data.user.id);
            }
        };
        init();
    }, [fetchLeaves, fetchBalance]);

    const handleCreateLeave = async (values: LeaveRequestPayload) => {
        try {
            const res = await fetch('/api/hrms/leaves', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...values, user_id: userId }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            toast({ title: "Request Sent", description: "Your leave request has been submitted." });
            setIsRequestOpen(false);
            if (userId) {
                fetchLeaves(userId);
                fetchBalance(userId);
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: (error as Error).message });
        }
    };

    const pendingCount = myLeaves.filter(l => l.status === 'pending').length;
    const approvedCount = myLeaves.filter(l => l.status === 'approved').length;
    const rejectedCount = myLeaves.filter(l => l.status === 'rejected').length;

    const {
        currentPage, totalPages, totalItems, paginatedItems, itemsPerPage, setCurrentPage,
    } = usePagination(myLeaves, 20);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-headline font-bold">My Leaves</h1>
                    <p className="text-muted-foreground">View your leave balance and submit new requests.</p>
                </div>
                <Dialog open={isRequestOpen} onOpenChange={setIsRequestOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Request Leave</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Request Leave</DialogTitle></DialogHeader>
                        <LeaveRequestForm schemeTypes={schemeTypes} onSubmit={handleCreateLeave} />
                    </DialogContent>
                </Dialog>
            </div>

            {/* Leave Balance Cards */}
            {hasScheme && balance.length > 0 && (
                <div>
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Leave Balance — {new Date().getFullYear()}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {balance.map(item => <BalanceCard key={item.id} item={item} />)}
                    </div>
                </div>
            )}

            {!hasScheme && !loading && (
                <Card className="border-dashed">
                    <CardContent className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
                        <CalendarDays className="h-5 w-5 flex-shrink-0" />
                        No leave scheme assigned to your account. Contact HR to set one up.
                    </CardContent>
                </Card>
            )}

            {/* My Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-5 pb-4 flex items-center gap-3">
                        <Clock className="h-8 w-8 text-yellow-500 flex-shrink-0" />
                        <div>
                            <p className="text-2xl font-bold">{pendingCount}</p>
                            <p className="text-xs text-muted-foreground">Pending</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-5 pb-4 flex items-center gap-3">
                        <CheckCircle2 className="h-8 w-8 text-green-500 flex-shrink-0" />
                        <div>
                            <p className="text-2xl font-bold">{approvedCount}</p>
                            <p className="text-xs text-muted-foreground">Approved</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-5 pb-4 flex items-center gap-3">
                        <XCircle className="h-8 w-8 text-red-500 flex-shrink-0" />
                        <div>
                            <p className="text-2xl font-bold">{rejectedCount}</p>
                            <p className="text-xs text-muted-foreground">Rejected</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Leave History */}
            <Card>
                <CardHeader><CardTitle>My Leave History</CardTitle></CardHeader>
                <CardContent>
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
                            {loading ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Loading...</TableCell></TableRow>
                            ) : paginatedItems.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No leave records found.</TableCell></TableRow>
                            ) : paginatedItems.map(leave => (
                                <TableRow key={leave.id}>
                                    <TableCell className="font-medium">{leave.leave_type?.name ?? '—'}</TableCell>
                                    <TableCell className="text-sm">
                                        {leave.start_date}
                                        {leave.end_date !== leave.start_date && ` → ${leave.end_date}`}
                                        {leave.half_day_type && <span className="ml-1 text-xs text-muted-foreground">({leave.half_day_type})</span>}
                                    </TableCell>
                                    <TableCell>{leave.days_count}</TableCell>
                                    <TableCell className="max-w-[200px] truncate">{leave.reason}</TableCell>
                                    <TableCell><StatusBadge status={leave.status} /></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <DataTablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
                </CardContent>
            </Card>
        </div>
    );
}
