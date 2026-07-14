'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    CheckSquare, XCircle, Loader2, RefreshCw, ShoppingCart,
    AlertTriangle, CheckCircle2, Clock, Banknote, User,
} from 'lucide-react';
import { format } from 'date-fns';

type CashRequest = {
    id: string;
    request_number: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ISSUED' | 'SETTLED';
    purpose: string;
    requested_amount: number;
    approved_amount: number | null;
    issued_amount: number | null;
    spent_amount: number | null;
    returned_amount: number | null;
    notes: string | null;
    rejection_reason: string | null;
    additional_status: string | null;
    additional_requested_amount: number | null;
    additional_reason: string | null;
    additional_approved_amount: number | null;
    additional_issued_amount: number | null;
    created_at: string;
    requested_by_user: { id: string; name: string; email: string; department: string | null } | null;
    purchase_order: { id: string; po_number: string; supplier_name: string | null } | null;
    approved_by_user: { name: string } | null;
};

const fmt = (n: number | null | undefined) =>
    n != null ? `Rs ${Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

export default function InventoryCashApprovalsPage() {
    const { toast } = useToast();
    const [requests, setRequests] = useState<CashRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');

    // Approve dialog
    const [approveReq, setApproveReq] = useState<CashRequest | null>(null);
    const [approvedAmount, setApprovedAmount] = useState('');
    const [approveNotes, setApproveNotes] = useState('');
    const [approving, setApproving] = useState(false);

    // Reject dialog
    const [rejectReq, setRejectReq] = useState<CashRequest | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [rejecting, setRejecting] = useState(false);

    // Additional approve dialog
    const [addApproveReq, setAddApproveReq] = useState<CashRequest | null>(null);
    const [addApprovedAmount, setAddApprovedAmount] = useState('');
    const [addApproving, setAddApproving] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/inventory-cash-requests?view=all');
            const data = await res.json();
            setRequests(data.requests ?? []);
        } catch {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to load requests.' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const doApprove = async () => {
        if (!approveReq) return;
        setApproving(true);
        try {
            const res = await fetch(`/api/admin/inventory-cash-requests/${approveReq.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'approve',
                    approved_amount: approvedAmount ? Number(approvedAmount) : undefined,
                    notes: approveNotes.trim() || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast({ title: 'Approved', description: `${approveReq.request_number} approved for ${fmt(Number(approvedAmount) || approveReq.requested_amount)}.` });
            setApproveReq(null);
            setApprovedAmount(''); setApproveNotes('');
            fetchData();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setApproving(false);
        }
    };

    const doReject = async () => {
        if (!rejectReq) return;
        setRejecting(true);
        try {
            const res = await fetch(`/api/admin/inventory-cash-requests/${rejectReq.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reject', rejection_reason: rejectReason.trim() || undefined }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast({ title: 'Rejected', description: `${rejectReq.request_number} rejected.` });
            setRejectReq(null);
            setRejectReason('');
            fetchData();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setRejecting(false);
        }
    };

    const doApproveAdditional = async () => {
        if (!addApproveReq) return;
        setAddApproving(true);
        try {
            const res = await fetch(`/api/admin/inventory-cash-requests/${addApproveReq.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'approve_additional',
                    additional_approved_amount: addApprovedAmount ? Number(addApprovedAmount) : undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast({ title: 'Additional Approved' });
            setAddApproveReq(null);
            setAddApprovedAmount('');
            fetchData();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setAddApproving(false);
        }
    };

    const doRejectAdditional = async (req: CashRequest) => {
        try {
            const res = await fetch(`/api/admin/inventory-cash-requests/${req.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reject_additional' }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast({ title: 'Additional Request Rejected' });
            fetchData();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
    };

    const openApprove = (req: CashRequest) => {
        setApproveReq(req);
        setApprovedAmount(String(req.requested_amount));
        setApproveNotes('');
    };

    const openAddApprove = (req: CashRequest) => {
        setAddApproveReq(req);
        setAddApprovedAmount(String(req.additional_requested_amount ?? ''));
    };

    const filteredRequests = useMemo(() => {
        const now = new Date();
        return requests.filter(r => {
            const d = new Date(r.created_at);
            if (dateFilter === 'today') return d.toDateString() === now.toDateString();
            if (dateFilter === 'week') {
                const start = new Date(now);
                start.setDate(now.getDate() - now.getDay());
                start.setHours(0, 0, 0, 0);
                return d >= start;
            }
            if (dateFilter === 'month') {
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }
            return true;
        });
    }, [requests, dateFilter]);

    const pending = filteredRequests.filter(r => r.status === 'PENDING');
    const additionalPending = filteredRequests.filter(r => r.additional_status === 'PENDING');
    const history = filteredRequests.filter(r => r.status !== 'PENDING');

    const RequestTable = ({ items, showAdditional = false }: { items: CashRequest[]; showAdditional?: boolean }) => (
        items.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm border-t">No requests found.</div>
        ) : (
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Request #</TableHead>
                            <TableHead>Requested By</TableHead>
                            <TableHead>Purpose</TableHead>
                            <TableHead>PO</TableHead>
                            <TableHead className="text-right">{showAdditional ? 'Additional' : 'Requested'}</TableHead>
                            {showAdditional && <TableHead>Reason</TableHead>}
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map(req => (
                            <TableRow key={req.id}>
                                <TableCell className="font-mono text-xs font-bold">{req.request_number}</TableCell>
                                <TableCell>
                                    <div className="text-sm font-medium">{req.requested_by_user?.name ?? '—'}</div>
                                    {req.requested_by_user?.department && (
                                        <div className="text-xs text-muted-foreground">{req.requested_by_user.department}</div>
                                    )}
                                </TableCell>
                                <TableCell className="max-w-[160px]">
                                    <div className="truncate text-sm" title={req.purpose}>{req.purpose}</div>
                                    {req.notes && <div className="text-xs text-muted-foreground truncate">{req.notes}</div>}
                                </TableCell>
                                <TableCell>
                                    {req.purchase_order ? (
                                        <Badge variant="outline" className="text-[10px] gap-1">
                                            <ShoppingCart className="h-2.5 w-2.5" />
                                            {req.purchase_order.po_number}
                                        </Badge>
                                    ) : '—'}
                                </TableCell>
                                <TableCell className="text-right text-sm font-medium">
                                    {showAdditional ? fmt(req.additional_requested_amount) : fmt(req.requested_amount)}
                                </TableCell>
                                {showAdditional && (
                                    <TableCell className="max-w-[160px] text-sm text-muted-foreground">
                                        <div className="truncate" title={req.additional_reason ?? ''}>{req.additional_reason ?? '—'}</div>
                                    </TableCell>
                                )}
                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                    {format(new Date(req.created_at), 'dd MMM yyyy')}
                                </TableCell>
                                <TableCell>
                                    {showAdditional ? (
                                        <Badge className="text-[10px] bg-orange-100 text-orange-800 border border-orange-200">
                                            Overspend Pending
                                        </Badge>
                                    ) : (
                                        <StatusBadge status={req.status} />
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        {!showAdditional && req.status === 'PENDING' && (
                                            <>
                                                <Button size="sm" className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700"
                                                    onClick={() => openApprove(req)}>
                                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                                    Approve
                                                </Button>
                                                <Button size="sm" variant="destructive" className="h-7 px-2 text-xs"
                                                    onClick={() => { setRejectReq(req); setRejectReason(''); }}>
                                                    <XCircle className="h-3 w-3 mr-1" />
                                                    Reject
                                                </Button>
                                            </>
                                        )}
                                        {showAdditional && req.additional_status === 'PENDING' && (
                                            <>
                                                <Button size="sm" className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700"
                                                    onClick={() => openAddApprove(req)}>
                                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                                    Approve
                                                </Button>
                                                <Button size="sm" variant="destructive" className="h-7 px-2 text-xs"
                                                    onClick={() => doRejectAdditional(req)}>
                                                    <XCircle className="h-3 w-3 mr-1" />
                                                    Reject
                                                </Button>
                                            </>
                                        )}
                                        {!showAdditional && req.status !== 'PENDING' && (
                                            <StatusBadge status={req.status} />
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        )
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-headline font-bold flex items-center gap-2">
                        <CheckSquare className="h-7 w-7 text-primary" />
                        Inventory Cash Approvals
                    </h1>
                    <p className="text-muted-foreground mt-1">Review and approve cash requests before they proceed to accounting.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    <DateFilterBar value={dateFilter} onChange={setDateFilter} />
                    <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Pending Approval', count: pending.length, color: 'text-amber-600' },
                    { label: 'Overspend Pending', count: additionalPending.length, color: 'text-orange-600' },
                    { label: 'Approved', count: filteredRequests.filter(r => r.status === 'APPROVED').length, color: 'text-blue-600' },
                    { label: 'Total Requests', count: filteredRequests.length, color: 'text-slate-600' },
                ].map(s => (
                    <Card key={s.label} className="text-center py-4">
                        <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
                        <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                    </Card>
                ))}
            </div>

            <Tabs defaultValue="pending">
                <TabsList>
                    <TabsTrigger value="pending" className="gap-1">
                        Pending Approval
                        {pending.length > 0 && <Badge className="h-4 min-w-4 text-[10px] bg-amber-500 text-white">{pending.length}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="additional" className="gap-1">
                        Overspend Requests
                        {additionalPending.length > 0 && <Badge className="h-4 min-w-4 text-[10px] bg-orange-500 text-white">{additionalPending.length}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>

                <TabsContent value="pending">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Clock className="h-4 w-4 text-amber-500" /> Awaiting Your Approval
                            </CardTitle>
                            <CardDescription>These cash requests are waiting for approval before proceeding to accounting.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                                    <Loader2 className="h-5 w-5 animate-spin" /> Loading…
                                </div>
                            ) : <RequestTable items={pending} />}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="additional">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-orange-500" /> Overspend Requests
                            </CardTitle>
                            <CardDescription>Employees have spent more than issued. Review and approve additional cash.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                                    <Loader2 className="h-5 w-5 animate-spin" /> Loading…
                                </div>
                            ) : <RequestTable items={additionalPending} showAdditional />}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="history">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">All Requests History</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                                    <Loader2 className="h-5 w-5 animate-spin" /> Loading…
                                </div>
                            ) : filteredRequests.length === 0 ? (
                                <div className="py-10 text-center text-muted-foreground text-sm border-t">No requests found.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Request #</TableHead>
                                                <TableHead>Requested By</TableHead>
                                                <TableHead>Purpose / PO</TableHead>
                                                <TableHead className="text-right">Requested</TableHead>
                                                <TableHead className="text-right">Approved</TableHead>
                                                <TableHead className="text-right">Issued</TableHead>
                                                <TableHead className="text-right">Settlement</TableHead>
                                                <TableHead>Additional</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Date</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredRequests.map(req => {
                                                const totalIssued = (req.issued_amount ?? 0) + (req.additional_issued_amount ?? 0);
                                                return (
                                                    <TableRow key={req.id}>
                                                        <TableCell className="font-mono text-xs font-bold">{req.request_number}</TableCell>
                                                        <TableCell>
                                                            <div className="text-sm font-medium">{req.requested_by_user?.name ?? '—'}</div>
                                                            {req.requested_by_user?.department && (
                                                                <div className="text-xs text-muted-foreground">{req.requested_by_user.department}</div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="max-w-[160px]">
                                                            <div className="truncate text-sm" title={req.purpose}>{req.purpose}</div>
                                                            {req.purchase_order && (
                                                                <Badge variant="outline" className="text-[10px] mt-1 gap-1">
                                                                    <ShoppingCart className="h-2.5 w-2.5" />
                                                                    {req.purchase_order.po_number}
                                                                </Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right text-sm">{fmt(req.requested_amount)}</TableCell>
                                                        <TableCell className="text-right text-sm">
                                                            {req.approved_amount != null ? (
                                                                <span className={req.approved_amount < req.requested_amount ? 'text-amber-600 font-medium' : ''}>
                                                                    {fmt(req.approved_amount)}
                                                                </span>
                                                            ) : '—'}
                                                        </TableCell>
                                                        <TableCell className="text-right text-sm">
                                                            {req.issued_amount != null ? (
                                                                <div>
                                                                    <div className="font-medium">{fmt(totalIssued)}</div>
                                                                    {req.additional_issued_amount != null && req.additional_issued_amount > 0 && (
                                                                        <div className="text-[10px] text-muted-foreground">
                                                                            {fmt(req.issued_amount)} + {fmt(req.additional_issued_amount)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : '—'}
                                                        </TableCell>
                                                        <TableCell className="text-right text-sm">
                                                            {req.status === 'SETTLED' ? (
                                                                <div>
                                                                    <div className="font-medium">Spent: {fmt(req.spent_amount)}</div>
                                                                    {req.returned_amount != null && req.returned_amount > 0 && (
                                                                        <div className="text-[10px] text-green-600 font-semibold">
                                                                            Returned: {fmt(req.returned_amount)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : '—'}
                                                        </TableCell>
                                                        <TableCell>
                                                            {req.additional_status ? (
                                                                <div className="space-y-1">
                                                                    <div className="text-xs font-semibold">{fmt(req.additional_requested_amount)}</div>
                                                                    <AdditionalBadge status={req.additional_status} />
                                                                    {req.additional_issued_amount != null && req.additional_issued_amount > 0 && (
                                                                        <div className="text-[10px] text-muted-foreground">Issued: {fmt(req.additional_issued_amount)}</div>
                                                                    )}
                                                                </div>
                                                            ) : <span className="text-muted-foreground text-xs">—</span>}
                                                        </TableCell>
                                                        <TableCell><StatusBadge status={req.status} /></TableCell>
                                                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                            {format(new Date(req.created_at), 'dd MMM yyyy')}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Approve Dialog */}
            <Dialog open={!!approveReq} onOpenChange={open => { if (!open) setApproveReq(null); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            Approve Cash Request
                        </DialogTitle>
                        <DialogDescription>
                            {approveReq?.request_number} — {approveReq?.purpose}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="approve-amount">Approved Amount (Rs)</Label>
                            <Input
                                id="approve-amount"
                                type="number"
                                min="0"
                                step="0.01"
                                value={approvedAmount}
                                onChange={e => setApprovedAmount(e.target.value)}
                                placeholder="Leave as requested amount"
                            />
                            <p className="text-xs text-muted-foreground">Requested: {fmt(approveReq?.requested_amount)}</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="approve-notes">Notes <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                            <Textarea
                                id="approve-notes"
                                placeholder="Any notes for the employee or accounting…"
                                value={approveNotes}
                                onChange={e => setApproveNotes(e.target.value)}
                                rows={2}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setApproveReq(null)} disabled={approving}>Cancel</Button>
                        <Button onClick={doApprove} disabled={approving} className="bg-green-600 hover:bg-green-700">
                            {approving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Approve Request
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Dialog */}
            <Dialog open={!!rejectReq} onOpenChange={open => { if (!open) setRejectReq(null); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <XCircle className="h-5 w-5 text-destructive" />
                            Reject Cash Request
                        </DialogTitle>
                        <DialogDescription>
                            {rejectReq?.request_number} — {rejectReq?.purpose}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        <Label htmlFor="reject-reason">Reason for Rejection</Label>
                        <Textarea
                            id="reject-reason"
                            placeholder="Explain why this request is being rejected…"
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            rows={3}
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectReq(null)} disabled={rejecting}>Cancel</Button>
                        <Button variant="destructive" onClick={doReject} disabled={rejecting}>
                            {rejecting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Reject Request
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Additional Approve Dialog */}
            <Dialog open={!!addApproveReq} onOpenChange={open => { if (!open) setAddApproveReq(null); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            Approve Additional Cash
                        </DialogTitle>
                        <DialogDescription>
                            {addApproveReq?.request_number} — Overspend reason: {addApproveReq?.additional_reason}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        <Label htmlFor="add-approve-amount">Additional Approved Amount (Rs)</Label>
                        <Input
                            id="add-approve-amount"
                            type="number"
                            min="0"
                            step="0.01"
                            value={addApprovedAmount}
                            onChange={e => setAddApprovedAmount(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Additional requested: {fmt(addApproveReq?.additional_requested_amount)}
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddApproveReq(null)} disabled={addApproving}>Cancel</Button>
                        <Button onClick={doApproveAdditional} disabled={addApproving} className="bg-green-600 hover:bg-green-700">
                            {addApproving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Approve Additional
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

type DateFilter = 'today' | 'week' | 'month' | 'all';
function DateFilterBar({ value, onChange }: { value: DateFilter; onChange: (v: DateFilter) => void }) {
    const options: { key: DateFilter; label: string }[] = [
        { key: 'today', label: 'Today' },
        { key: 'week', label: 'This Week' },
        { key: 'month', label: 'This Month' },
        { key: 'all', label: 'All Time' },
    ];
    return (
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {options.map(o => (
                <button
                    key={o.key}
                    onClick={() => onChange(o.key)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                        value === o.key
                            ? 'bg-white shadow text-primary'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

function AdditionalBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        PENDING: 'bg-orange-100 text-orange-800 border-orange-200',
        APPROVED: 'bg-teal-100 text-teal-800 border-teal-200',
        REJECTED: 'bg-red-100 text-red-800 border-red-200',
        ISSUED: 'bg-violet-100 text-violet-800 border-violet-200',
    };
    const labels: Record<string, string> = {
        PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected', ISSUED: 'Issued',
    };
    return (
        <Badge className={`text-[10px] border ${map[status] ?? 'bg-gray-100 text-gray-800'}`}>
            {labels[status] ?? status}
        </Badge>
    );
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
        APPROVED: 'bg-blue-100 text-blue-800 border-blue-200',
        REJECTED: 'bg-red-100 text-red-800 border-red-200',
        ISSUED: 'bg-purple-100 text-purple-800 border-purple-200',
        SETTLED: 'bg-green-100 text-green-800 border-green-200',
    };
    const labels: Record<string, string> = {
        PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected',
        ISSUED: 'Issued', SETTLED: 'Settled',
    };
    return (
        <Badge className={`text-[10px] border ${map[status] ?? 'bg-gray-100 text-gray-800'}`}>
            {labels[status] ?? status}
        </Badge>
    );
}
