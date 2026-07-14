'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Banknote, Loader2, RefreshCw, ShoppingCart, CheckCircle2,
    AlertTriangle, Clock, User, RotateCcw, TrendingUp,
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
    additional_requested_amount: number | null;
    additional_reason: string | null;
    additional_status: string | null;
    additional_approved_amount: number | null;
    additional_issued_amount: number | null;
    notes: string | null;
    issued_at: string | null;
    settled_at: string | null;
    created_at: string;
    requested_by_user: { id: string; name: string; email: string; department: string | null } | null;
    approved_by_user: { name: string } | null;
    issued_by_user: { name: string } | null;
    purchase_order: { id: string; po_number: string; supplier_name: string | null } | null;
};

const fmt = (n: number | null | undefined) =>
    n != null ? `Rs ${Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

export default function AccountingInventoryCashPage() {
    const { toast } = useToast();
    const [requests, setRequests] = useState<CashRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');

    // Issue cash dialog
    const [issueReq, setIssueReq] = useState<CashRequest | null>(null);
    const [issueAmount, setIssueAmount] = useState('');
    const [issuing, setIssuing] = useState(false);

    // Issue additional dialog
    const [issueAddReq, setIssueAddReq] = useState<CashRequest | null>(null);
    const [issueAddAmount, setIssueAddAmount] = useState('');
    const [issuingAdd, setIssuingAdd] = useState(false);

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

    const doIssue = async () => {
        if (!issueReq) return;
        setIssuing(true);
        try {
            const res = await fetch(`/api/admin/inventory-cash-requests/${issueReq.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'issue',
                    issued_amount: issueAmount ? Number(issueAmount) : undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast({ title: 'Cash Issued', description: `${issueReq.request_number}: ${fmt(Number(issueAmount) || issueReq.approved_amount)} issued to ${issueReq.requested_by_user?.name}.` });
            setIssueReq(null);
            setIssueAmount('');
            fetchData();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIssuing(false);
        }
    };

    const doIssueAdditional = async () => {
        if (!issueAddReq) return;
        setIssuingAdd(true);
        try {
            const res = await fetch(`/api/admin/inventory-cash-requests/${issueAddReq.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'issue_additional',
                    additional_issued_amount: issueAddAmount ? Number(issueAddAmount) : undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast({ title: 'Additional Cash Issued', description: `Additional funds issued to ${issueAddReq.requested_by_user?.name}.` });
            setIssueAddReq(null);
            setIssueAddAmount('');
            fetchData();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIssuingAdd(false);
        }
    };

    const openIssue = (req: CashRequest) => {
        setIssueReq(req);
        setIssueAmount(String(req.approved_amount ?? ''));
    };

    const openIssueAdditional = (req: CashRequest) => {
        setIssueAddReq(req);
        setIssueAddAmount(String(req.additional_approved_amount ?? ''));
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

    const toIssue = filteredRequests.filter(r => r.status === 'APPROVED');
    const issued = filteredRequests.filter(r => r.status === 'ISSUED');
    const additionalToIssue = filteredRequests.filter(r => r.status === 'ISSUED' && r.additional_status === 'APPROVED');
    const settled = filteredRequests.filter(r => r.status === 'SETTLED');

    // Financial summary
    const totalApproved = toIssue.reduce((s, r) => s + (r.approved_amount ?? 0), 0);
    const totalIssued = [...issued, ...settled].reduce((s, r) => s + (r.issued_amount ?? 0) + (r.additional_issued_amount ?? 0), 0);
    const totalReturned = settled.reduce((s, r) => s + (r.returned_amount ?? 0), 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-headline font-bold flex items-center gap-2">
                        <Banknote className="h-7 w-7 text-primary" />
                        Inventory Cash Issuance
                    </h1>
                    <p className="text-muted-foreground mt-1">Issue approved cash requests to employees and manage settlements.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    <DateFilterBar value={dateFilter} onChange={setDateFilter} />
                    <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Financial summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Awaiting Issuance', value: fmt(totalApproved), sub: `${toIssue.length} request${toIssue.length !== 1 ? 's' : ''}`, color: 'text-blue-600' },
                    { label: 'Cash in Hand (Issued)', value: fmt(issued.reduce((s, r) => s + (r.issued_amount ?? 0) + (r.additional_issued_amount ?? 0), 0)), sub: `${issued.length} active`, color: 'text-purple-600' },
                    { label: 'Total Disbursed', value: fmt(totalIssued), sub: 'all time', color: 'text-slate-600' },
                    { label: 'Total Returned', value: fmt(totalReturned), sub: `${settled.length} settled`, color: 'text-green-600' },
                ].map(s => (
                    <Card key={s.label} className="py-4 px-5">
                        <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                        <div className="text-xs font-medium text-muted-foreground mt-1">{s.label}</div>
                        <div className="text-[11px] text-muted-foreground">{s.sub}</div>
                    </Card>
                ))}
            </div>

            <Tabs defaultValue="to-issue">
                <TabsList>
                    <TabsTrigger value="to-issue" className="gap-1">
                        To Issue
                        {toIssue.length > 0 && <Badge className="h-4 min-w-4 text-[10px] bg-blue-500 text-white">{toIssue.length}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="issued" className="gap-1">
                        Issued
                        {issued.length > 0 && <Badge className="h-4 min-w-4 text-[10px] bg-purple-500 text-white">{issued.length}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="additional" className="gap-1">
                        Additional Requests
                        {additionalToIssue.length > 0 && <Badge className="h-4 min-w-4 text-[10px] bg-orange-500 text-white">{additionalToIssue.length}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="settled">Settled</TabsTrigger>
                </TabsList>

                {/* TO ISSUE */}
                <TabsContent value="to-issue">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Clock className="h-4 w-4 text-blue-500" /> Approved — Ready to Issue
                            </CardTitle>
                            <CardDescription>These requests have been approved. Issue cash to the employee.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                                    <Loader2 className="h-5 w-5 animate-spin" /> Loading…
                                </div>
                            ) : toIssue.length === 0 ? (
                                <div className="py-10 text-center text-muted-foreground text-sm border-t">No approved requests awaiting issuance.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Request #</TableHead>
                                                <TableHead>Employee</TableHead>
                                                <TableHead>Purpose</TableHead>
                                                <TableHead>PO</TableHead>
                                                <TableHead className="text-right">Approved Amount</TableHead>
                                                <TableHead>Approved By</TableHead>
                                                <TableHead>Date</TableHead>
                                                <TableHead className="text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {toIssue.map(req => (
                                                <TableRow key={req.id}>
                                                    <TableCell className="font-mono text-xs font-bold">{req.request_number}</TableCell>
                                                    <TableCell>
                                                        <div className="text-sm font-medium">{req.requested_by_user?.name ?? '—'}</div>
                                                        {req.requested_by_user?.department && (
                                                            <div className="text-xs text-muted-foreground">{req.requested_by_user.department}</div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="max-w-[160px]">
                                                        <div className="truncate text-sm">{req.purpose}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {req.purchase_order ? (
                                                            <Badge variant="outline" className="text-[10px] gap-1">
                                                                <ShoppingCart className="h-2.5 w-2.5" />
                                                                {req.purchase_order.po_number}
                                                            </Badge>
                                                        ) : '—'}
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold text-sm text-blue-700">
                                                        {fmt(req.approved_amount)}
                                                    </TableCell>
                                                    <TableCell className="text-sm">{req.approved_by_user?.name ?? '—'}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {format(new Date(req.created_at), 'dd MMM yyyy')}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button size="sm" className="h-7 px-3 text-xs" onClick={() => openIssue(req)}>
                                                            <Banknote className="h-3 w-3 mr-1" />
                                                            Issue Cash
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ISSUED */}
                <TabsContent value="issued">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Banknote className="h-4 w-4 text-purple-500" /> Cash Issued — Awaiting Settlement
                            </CardTitle>
                            <CardDescription>Cash has been given to employees. Waiting for settlement reports.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                                    <Loader2 className="h-5 w-5 animate-spin" /> Loading…
                                </div>
                            ) : issued.length === 0 ? (
                                <div className="py-10 text-center text-muted-foreground text-sm border-t">No active issued requests.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Request #</TableHead>
                                                <TableHead>Employee</TableHead>
                                                <TableHead>Purpose</TableHead>
                                                <TableHead className="text-right">Issued</TableHead>
                                                <TableHead>Issued By</TableHead>
                                                <TableHead>Issued On</TableHead>
                                                <TableHead>Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {issued.map(req => (
                                                <TableRow key={req.id}>
                                                    <TableCell className="font-mono text-xs font-bold">{req.request_number}</TableCell>
                                                    <TableCell>
                                                        <div className="text-sm font-medium">{req.requested_by_user?.name ?? '—'}</div>
                                                        {req.requested_by_user?.department && (
                                                            <div className="text-xs text-muted-foreground">{req.requested_by_user.department}</div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="max-w-[160px]">
                                                        <div className="truncate text-sm">{req.purpose}</div>
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm text-purple-700">
                                                        <div className="font-bold">{fmt((req.issued_amount ?? 0) + (req.additional_issued_amount ?? 0))}</div>
                                                        {req.additional_issued_amount != null && req.additional_issued_amount > 0 && (
                                                            <div className="text-[10px] text-muted-foreground">
                                                                {fmt(req.issued_amount)} + {fmt(req.additional_issued_amount)} extra
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-sm">{req.issued_by_user?.name ?? '—'}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {req.issued_at ? format(new Date(req.issued_at), 'dd MMM yyyy') : '—'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {req.additional_status === 'PENDING' ? (
                                                            <Badge className="text-[10px] bg-orange-100 text-orange-800 border border-orange-200">
                                                                Overspend Pending
                                                            </Badge>
                                                        ) : req.additional_status === 'APPROVED' ? (
                                                            <Badge className="text-[10px] bg-teal-100 text-teal-800 border border-teal-200">
                                                                Additional Approved
                                                            </Badge>
                                                        ) : req.additional_status === 'ISSUED' ? (
                                                            <Badge className="text-[10px] bg-violet-100 text-violet-800 border border-violet-200">
                                                                Awaiting Final Settlement
                                                            </Badge>
                                                        ) : (
                                                            <Badge className="text-[10px] bg-purple-100 text-purple-800 border border-purple-200">
                                                                Awaiting Settlement
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ADDITIONAL REQUESTS */}
                <TabsContent value="additional">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-orange-500" /> Additional Cash — Ready to Issue
                            </CardTitle>
                            <CardDescription>
                                Employees overspent and additional funds were approved by the inventory manager. Issue additional cash.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                                    <Loader2 className="h-5 w-5 animate-spin" /> Loading…
                                </div>
                            ) : additionalToIssue.length === 0 ? (
                                <div className="py-10 text-center text-muted-foreground text-sm border-t">No additional requests to issue.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Request #</TableHead>
                                                <TableHead>Employee</TableHead>
                                                <TableHead>Original Issue</TableHead>
                                                <TableHead>Spent</TableHead>
                                                <TableHead>Overspend</TableHead>
                                                <TableHead>Reason</TableHead>
                                                <TableHead className="text-right">Additional Approved</TableHead>
                                                <TableHead className="text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {additionalToIssue.map(req => {
                                                const overspend = (req.spent_amount ?? 0) - ((req.issued_amount ?? 0));
                                                return (
                                                    <TableRow key={req.id}>
                                                        <TableCell className="font-mono text-xs font-bold">{req.request_number}</TableCell>
                                                        <TableCell>
                                                            <div className="text-sm font-medium">{req.requested_by_user?.name ?? '—'}</div>
                                                            {req.requested_by_user?.department && (
                                                                <div className="text-xs text-muted-foreground">{req.requested_by_user.department}</div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-sm">{fmt(req.issued_amount)}</TableCell>
                                                        <TableCell className="text-sm font-medium text-red-600">{fmt(req.spent_amount)}</TableCell>
                                                        <TableCell className="text-sm font-medium text-red-600">{fmt(overspend)}</TableCell>
                                                        <TableCell className="max-w-[140px] text-xs text-muted-foreground">
                                                            <div className="truncate">{req.additional_reason ?? '—'}</div>
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold text-sm text-teal-700">
                                                            {fmt(req.additional_approved_amount)}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button size="sm" className="h-7 px-3 text-xs" onClick={() => openIssueAdditional(req)}>
                                                                <Banknote className="h-3 w-3 mr-1" />
                                                                Issue Additional
                                                            </Button>
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

                {/* SETTLED */}
                <TabsContent value="settled">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" /> Settled Requests
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                                    <Loader2 className="h-5 w-5 animate-spin" /> Loading…
                                </div>
                            ) : settled.length === 0 ? (
                                <div className="py-10 text-center text-muted-foreground text-sm border-t">No settled requests yet.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Request #</TableHead>
                                                <TableHead>Employee</TableHead>
                                                <TableHead>Purpose</TableHead>
                                                <TableHead className="text-right">Issued</TableHead>
                                                <TableHead className="text-right">Spent</TableHead>
                                                <TableHead className="text-right">Returned</TableHead>
                                                <TableHead>Settled On</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {settled.map(req => (
                                                <TableRow key={req.id}>
                                                    <TableCell className="font-mono text-xs font-bold">{req.request_number}</TableCell>
                                                    <TableCell>
                                                        <div className="text-sm font-medium">{req.requested_by_user?.name ?? '—'}</div>
                                                        {req.requested_by_user?.department && (
                                                            <div className="text-xs text-muted-foreground">{req.requested_by_user.department}</div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="max-w-[160px]">
                                                        <div className="truncate text-sm">{req.purpose}</div>
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm">
                                                        {fmt((req.issued_amount ?? 0) + (req.additional_issued_amount ?? 0))}
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm font-medium">
                                                        {fmt(req.spent_amount)}
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm font-medium text-green-700">
                                                        {fmt(req.returned_amount)}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {req.settled_at ? format(new Date(req.settled_at), 'dd MMM yyyy') : '—'}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Issue Cash Dialog */}
            <Dialog open={!!issueReq} onOpenChange={open => { if (!open) setIssueReq(null); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Banknote className="h-5 w-5 text-primary" />
                            Issue Cash
                        </DialogTitle>
                        <DialogDescription>
                            {issueReq?.request_number} — {issueReq?.requested_by_user?.name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="p-3 rounded-lg bg-slate-50 border text-sm space-y-1">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Purpose</span>
                                <span className="font-medium text-right max-w-[200px] truncate">{issueReq?.purpose}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Approved Amount</span>
                                <span className="font-bold text-blue-700">{fmt(issueReq?.approved_amount)}</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="issue-amount">Amount to Issue (Rs)</Label>
                            <Input
                                id="issue-amount"
                                type="number"
                                min="0"
                                step="0.01"
                                value={issueAmount}
                                onChange={e => setIssueAmount(e.target.value)}
                                autoFocus
                            />
                            <p className="text-xs text-muted-foreground">Defaults to approved amount. You can adjust.</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIssueReq(null)} disabled={issuing}>Cancel</Button>
                        <Button onClick={doIssue} disabled={issuing || !issueAmount}>
                            {issuing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Issue {issueAmount ? fmt(Number(issueAmount)) : ''}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Issue Additional Dialog */}
            <Dialog open={!!issueAddReq} onOpenChange={open => { if (!open) setIssueAddReq(null); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-orange-500" />
                            Issue Additional Cash
                        </DialogTitle>
                        <DialogDescription>
                            {issueAddReq?.request_number} — {issueAddReq?.requested_by_user?.name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="p-3 rounded-lg bg-orange-50 border border-orange-100 text-sm space-y-1">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Originally Issued</span>
                                <span className="font-medium">{fmt(issueAddReq?.issued_amount)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Spent</span>
                                <span className="font-medium text-red-600">{fmt(issueAddReq?.spent_amount)}</span>
                            </div>
                            <div className="flex justify-between border-t pt-1 mt-1">
                                <span className="text-muted-foreground">Additional Approved</span>
                                <span className="font-bold text-teal-700">{fmt(issueAddReq?.additional_approved_amount)}</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="issue-add-amount">Additional Amount to Issue (Rs)</Label>
                            <Input
                                id="issue-add-amount"
                                type="number"
                                min="0"
                                step="0.01"
                                value={issueAddAmount}
                                onChange={e => setIssueAddAmount(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIssueAddReq(null)} disabled={issuingAdd}>Cancel</Button>
                        <Button onClick={doIssueAdditional} disabled={issuingAdd || !issueAddAmount}>
                            {issuingAdd && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Issue Additional {issueAddAmount ? fmt(Number(issueAddAmount)) : ''}
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
