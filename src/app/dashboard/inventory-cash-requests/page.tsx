'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUserContext } from '@/context/user-context';
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
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Wallet, Plus, Loader2, ShoppingCart, CheckCircle2, Clock,
    XCircle, AlertTriangle, RefreshCw, Info, Banknote, RotateCcw,
} from 'lucide-react';
import { format } from 'date-fns';

type PurchaseOrder = {
    id: string;
    po_number: string;
    supplier_name: string | null;
    purchase_order_items: { unit_price: number | null; quantity: number }[];
};

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
    rejection_reason: string | null;
    created_at: string;
    purchase_order: { id: string; po_number: string; supplier_name: string | null } | null;
    approved_by_user: { name: string } | null;
    issued_by_user: { name: string } | null;
};

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    PENDING: { label: 'Pending Approval', className: 'bg-amber-100 text-amber-800 border-amber-200', icon: <Clock className="h-3 w-3" /> },
    APPROVED: { label: 'Approved', className: 'bg-blue-100 text-blue-800 border-blue-200', icon: <CheckCircle2 className="h-3 w-3" /> },
    REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-800 border-red-200', icon: <XCircle className="h-3 w-3" /> },
    ISSUED: { label: 'Cash Issued', className: 'bg-purple-100 text-purple-800 border-purple-200', icon: <Banknote className="h-3 w-3" /> },
    SETTLED: { label: 'Settled', className: 'bg-green-100 text-green-800 border-green-200', icon: <CheckCircle2 className="h-3 w-3" /> },
};

const fmt = (n: number | null | undefined) =>
    n != null ? `Rs ${Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

export default function InventoryCashRequestsPage() {
    const { user, hasRole } = useUserContext();
    const { toast } = useToast();
    const isAdmin = hasRole('admin') || user?.inventory_admin === true;

    const [requests, setRequests] = useState<CashRequest[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');
    const [loading, setLoading] = useState(true);

    // Create dialog
    const [createOpen, setCreateOpen] = useState(false);
    const [newPurpose, setNewPurpose] = useState('');
    const [newAmount, setNewAmount] = useState('');
    const [newPoId, setNewPoId] = useState('__none__');
    const [newNotes, setNewNotes] = useState('');
    const [creating, setCreating] = useState(false);

    // Settlement dialog
    const [settleReq, setSettleReq] = useState<CashRequest | null>(null);
    const [spentAmount, setSpentAmount] = useState('');
    const [overspendReason, setOverspendReason] = useState('');
    const [settling, setSettling] = useState(false);

    // Detail dialog
    const [detailReq, setDetailReq] = useState<CashRequest | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [reqRes, poRes] = await Promise.all([
                fetch('/api/admin/inventory-cash-requests'),
                fetch('/api/admin/purchase-orders'),
            ]);
            const reqData = await reqRes.json();
            const poData = await poRes.json();
            setRequests(reqData.requests ?? []);
            setPurchaseOrders(poData.purchase_orders ?? []);
        } catch {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to load data.' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const poTotal = (po: PurchaseOrder) =>
        po.purchase_order_items.reduce((s, i) => s + (i.unit_price ?? 0) * i.quantity, 0);

    const handlePoChange = (poId: string) => {
        setNewPoId(poId);
        if (poId !== '__none__') {
            const po = purchaseOrders.find(p => p.id === poId);
            if (po) setNewAmount(String(poTotal(po)));
        }
    };

    const handleCreate = async () => {
        if (!newPurpose.trim() || !newAmount) return;
        setCreating(true);
        try {
            const res = await fetch('/api/admin/inventory-cash-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    purpose: newPurpose.trim(),
                    requested_amount: Number(newAmount),
                    purchase_order_id: newPoId !== '__none__' ? newPoId : null,
                    notes: newNotes.trim() || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast({ title: 'Request Created', description: `${data.request.request_number} submitted for approval.` });
            setCreateOpen(false);
            setNewPurpose(''); setNewAmount(''); setNewPoId('__none__'); setNewNotes('');
            fetchData();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setCreating(false);
        }
    };

    const handleSettle = async () => {
        if (!settleReq) return;
        const spent = Number(spentAmount);
        if (isNaN(spent) || spent < 0) return;
        const totalIssued = (settleReq.issued_amount || 0) + (settleReq.additional_issued_amount || 0);
        if (spent > totalIssued && !overspendReason.trim()) {
            toast({ variant: 'destructive', title: 'Reason required', description: 'Please explain why you spent more than issued.' });
            return;
        }
        setSettling(true);
        try {
            const res = await fetch(`/api/admin/inventory-cash-requests/${settleReq.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'settle',
                    spent_amount: spent,
                    additional_reason: overspendReason.trim() || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast({ title: 'Settlement Submitted' });
            setSettleReq(null);
            setSpentAmount(''); setOverspendReason('');
            fetchData();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setSettling(false);
        }
    };

    const openSettle = (req: CashRequest) => {
        setSettleReq(req);
        // Pre-fill with total issued (original + any additional)
        const total = (req.issued_amount ?? 0) + (req.additional_issued_amount ?? 0);
        setSpentAmount(total > 0 ? String(total) : '');
        setOverspendReason('');
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

    const spentNum = Number(spentAmount);
    const totalIssuedForSettle = settleReq
        ? (settleReq.issued_amount || 0) + (settleReq.additional_issued_amount || 0)
        : 0;
    const isOverspend = !isNaN(spentNum) && spentNum > totalIssuedForSettle;
    const returnAmount = !isNaN(spentNum) && spentNum <= totalIssuedForSettle ? totalIssuedForSettle - spentNum : 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-headline font-bold flex items-center gap-2">
                        <Wallet className="h-7 w-7 text-primary" />
                        Cash Requests
                    </h1>
                    <p className="text-muted-foreground mt-1">Request money from accounting to purchase inventory items.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    <DateFilterBar value={dateFilter} onChange={setDateFilter} />
                    <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button onClick={() => setCreateOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Request
                    </Button>
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Pending', count: filteredRequests.filter(r => r.status === 'PENDING').length, color: 'text-amber-600' },
                    { label: 'Approved', count: filteredRequests.filter(r => r.status === 'APPROVED').length, color: 'text-blue-600' },
                    { label: 'Issued', count: filteredRequests.filter(r => r.status === 'ISSUED').length, color: 'text-purple-600' },
                    { label: 'Settled', count: filteredRequests.filter(r => r.status === 'SETTLED').length, color: 'text-green-600' },
                ].map(s => (
                    <Card key={s.label} className="text-center py-4">
                        <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
                        <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                    </Card>
                ))}
            </div>

            {/* Requests table */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Your Requests</CardTitle>
                    <CardDescription>Track cash requests and submit settlements after purchases.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
                        </div>
                    ) : filteredRequests.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground border-t">
                            <Wallet className="h-10 w-10 mx-auto mb-3 opacity-20" />
                            No cash requests yet. Click <strong>New Request</strong> to get started.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Request #</TableHead>
                                        {isAdmin && <TableHead>Requested By</TableHead>}
                                        <TableHead>Purpose</TableHead>
                                        <TableHead>PO</TableHead>
                                        <TableHead className="text-right">Requested</TableHead>
                                        <TableHead className="text-right">Approved</TableHead>
                                        <TableHead className="text-right">Issued</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRequests.map(req => {
                                        const sc = STATUS_CONFIG[req.status];
                                        return (
                                            <TableRow key={req.id}>
                                                <TableCell className="font-mono text-xs font-bold">{req.request_number}</TableCell>
                                                {isAdmin && (
                                                    <TableCell className="text-sm">
                                                        {(req as any).requested_by_user?.name ?? '—'}
                                                    </TableCell>
                                                )}
                                                <TableCell className="max-w-[160px]">
                                                    <div className="truncate text-sm" title={req.purpose}>{req.purpose}</div>
                                                </TableCell>
                                                <TableCell>
                                                    {req.purchase_order ? (
                                                        <Badge variant="outline" className="text-[10px] gap-1">
                                                            <ShoppingCart className="h-2.5 w-2.5" />
                                                            {req.purchase_order.po_number}
                                                        </Badge>
                                                    ) : '—'}
                                                </TableCell>
                                                <TableCell className="text-right text-sm">{fmt(req.requested_amount)}</TableCell>
                                                <TableCell className="text-right text-sm">
                                                    {req.approved_amount != null ? (
                                                        <div>
                                                            <div>{fmt(req.approved_amount)}</div>
                                                            {req.additional_approved_amount != null && req.additional_approved_amount > 0 && (
                                                                <div className="text-[10px] text-teal-600">+{fmt(req.additional_approved_amount)} extra</div>
                                                            )}
                                                        </div>
                                                    ) : '—'}
                                                </TableCell>
                                                <TableCell className="text-right text-sm">
                                                    {req.issued_amount != null ? (
                                                        <div>
                                                            <div className="font-medium">{fmt((req.issued_amount ?? 0) + (req.additional_issued_amount ?? 0))}</div>
                                                            {req.additional_issued_amount != null && req.additional_issued_amount > 0 && (
                                                                <div className="text-[10px] text-muted-foreground">
                                                                    {fmt(req.issued_amount)} +{fmt(req.additional_issued_amount)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : '—'}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <Badge className={`text-[10px] border gap-1 ${sc.className}`}>
                                                            {sc.icon} {sc.label}
                                                        </Badge>
                                                        {req.status === 'SETTLED' && (
                                                            <div className="text-[10px] text-muted-foreground space-y-0.5 mt-1">
                                                                {req.spent_amount != null && (
                                                                    <div>Spent: <span className="font-semibold text-foreground">{fmt(req.spent_amount)}</span></div>
                                                                )}
                                                                {req.returned_amount != null && req.returned_amount > 0 && (
                                                                    <div className="text-green-600 font-semibold">Returned: {fmt(req.returned_amount)}</div>
                                                                )}
                                                            </div>
                                                        )}
                                                        {req.additional_status === 'PENDING' && (
                                                            <Badge className="text-[10px] border bg-orange-100 text-orange-800 border-orange-200 gap-1">
                                                                <AlertTriangle className="h-2.5 w-2.5" />
                                                                Overspend: {fmt(req.additional_requested_amount)}
                                                            </Badge>
                                                        )}
                                                        {req.additional_status === 'APPROVED' && (
                                                            <Badge className="text-[10px] border bg-teal-100 text-teal-800 border-teal-200">
                                                                +{fmt(req.additional_approved_amount)} Approved
                                                            </Badge>
                                                        )}
                                                        {req.additional_status === 'ISSUED' && (
                                                            <Badge className="text-[10px] border bg-violet-100 text-violet-800 border-violet-200">
                                                                +{fmt(req.additional_issued_amount)} Issued
                                                            </Badge>
                                                        )}
                                                        {req.additional_status === 'REJECTED' && (
                                                            <Badge className="text-[10px] border bg-red-100 text-red-800 border-red-200">
                                                                Extra Rejected
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                    {format(new Date(req.created_at), 'dd MMM yyyy')}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                                                            onClick={() => setDetailReq(req)}>
                                                            <Info className="h-3.5 w-3.5" />
                                                        </Button>
                                                        {req.status === 'ISSUED' && !req.additional_status && (
                                                            <Button size="sm" className="h-7 px-2 text-xs" onClick={() => openSettle(req)}>
                                                                <RotateCcw className="h-3 w-3 mr-1" />
                                                                Settle
                                                            </Button>
                                                        )}
                                                        {req.status === 'ISSUED' && req.additional_status === 'ISSUED' && (
                                                            <Button size="sm" className="h-7 px-2 text-xs" onClick={() => openSettle(req)}>
                                                                <RotateCcw className="h-3 w-3 mr-1" />
                                                                Final Settle
                                                            </Button>
                                                        )}
                                                    </div>
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

            {/* Create Dialog */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Wallet className="h-5 w-5 text-primary" />
                            New Cash Request
                        </DialogTitle>
                        <DialogDescription>
                            Request funds from accounting to purchase inventory items.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="cr-purpose">Purpose <span className="text-destructive">*</span></Label>
                            <Input
                                id="cr-purpose"
                                placeholder="e.g., Purchase cleaning supplies for housekeeping"
                                value={newPurpose}
                                onChange={e => setNewPurpose(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Link to Purchase Order <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                            <Select value={newPoId} onValueChange={handlePoChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a PO (optional)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">No Purchase Order</SelectItem>
                                    {purchaseOrders.map(po => (
                                        <SelectItem key={po.id} value={po.id}>
                                            {po.po_number}{po.supplier_name ? ` — ${po.supplier_name}` : ''} ({fmt(poTotal(po))})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cr-amount">Requested Amount (Rs) <span className="text-destructive">*</span></Label>
                            <Input
                                id="cr-amount"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={newAmount}
                                onChange={e => setNewAmount(e.target.value)}
                            />
                            {newPoId !== '__none__' && (
                                <p className="text-xs text-muted-foreground">Pre-filled from PO total. You can adjust this amount.</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cr-notes">Notes <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                            <Textarea
                                id="cr-notes"
                                placeholder="Any additional information…"
                                value={newNotes}
                                onChange={e => setNewNotes(e.target.value)}
                                rows={2}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={creating || !newPurpose.trim() || !newAmount}>
                            {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Submit Request
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Settlement Dialog */}
            <Dialog open={!!settleReq} onOpenChange={open => { if (!open) { setSettleReq(null); setSpentAmount(''); setOverspendReason(''); } }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Submit Settlement</DialogTitle>
                        <DialogDescription>
                            {settleReq?.request_number} — Cash issued: {fmt(totalIssuedForSettle)}
                        </DialogDescription>
                    </DialogHeader>
                    {settleReq && (
                        <div className="space-y-4 py-2">
                            <div className="space-y-2">
                                <Label htmlFor="spent-amount">Amount Spent (Rs) <span className="text-destructive">*</span></Label>
                                <Input
                                    id="spent-amount"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={spentAmount}
                                    onChange={e => setSpentAmount(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            {spentAmount && !isNaN(spentNum) && (
                                <div className={`p-3 rounded-lg text-sm ${isOverspend ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                                    {isOverspend ? (
                                        <div className="space-y-1">
                                            <p className="font-semibold text-red-700 flex items-center gap-1">
                                                <AlertTriangle className="h-4 w-4" />
                                                Overspend: {fmt(spentNum - totalIssuedForSettle)}
                                            </p>
                                            <p className="text-red-600 text-xs">An additional cash request will be raised to accounting for the difference.</p>
                                        </div>
                                    ) : (
                                        <p className="font-semibold text-green-700 flex items-center gap-1">
                                            <RotateCcw className="h-4 w-4" />
                                            Return to accounting: {fmt(returnAmount)}
                                        </p>
                                    )}
                                </div>
                            )}
                            {isOverspend && (
                                <div className="space-y-2">
                                    <Label htmlFor="overspend-reason">Reason for Overspend <span className="text-destructive">*</span></Label>
                                    <Textarea
                                        id="overspend-reason"
                                        placeholder="Explain why you spent more than issued…"
                                        value={overspendReason}
                                        onChange={e => setOverspendReason(e.target.value)}
                                        rows={3}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSettleReq(null)} disabled={settling}>Cancel</Button>
                        <Button
                            onClick={handleSettle}
                            disabled={settling || !spentAmount || isNaN(spentNum) || spentNum < 0 || (isOverspend && !overspendReason.trim())}
                            variant={isOverspend ? 'destructive' : 'default'}
                        >
                            {settling && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            {isOverspend ? 'Submit & Request Additional' : 'Submit Settlement'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={!!detailReq} onOpenChange={open => { if (!open) setDetailReq(null); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Request Details — {detailReq?.request_number}</DialogTitle>
                    </DialogHeader>
                    {detailReq && (
                        <div className="space-y-3 text-sm">
                            <Row label="Purpose" value={detailReq.purpose} />
                            <Row label="Status" value={<Badge className={`text-[11px] border gap-1 ${STATUS_CONFIG[detailReq.status].className}`}>{STATUS_CONFIG[detailReq.status].label}</Badge>} />
                            {detailReq.purchase_order && <Row label="Purchase Order" value={detailReq.purchase_order.po_number} />}
                            <Row label="Requested" value={fmt(detailReq.requested_amount)} />
                            {detailReq.approved_amount != null && <Row label="Approved" value={fmt(detailReq.approved_amount)} />}
                            {detailReq.issued_amount != null && <Row label="Issued" value={fmt(detailReq.issued_amount)} />}
                            {detailReq.spent_amount != null && <Row label="Spent" value={fmt(detailReq.spent_amount)} />}
                            {detailReq.returned_amount != null && <Row label="Returned" value={fmt(detailReq.returned_amount)} />}
                            {detailReq.rejection_reason && <Row label="Rejection Reason" value={detailReq.rejection_reason} />}
                            {detailReq.notes && <Row label="Notes" value={detailReq.notes} />}
                            {detailReq.additional_status && (
                                <>
                                    <div className="border-t pt-3">
                                        <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide mb-2">Additional Request</p>
                                        <Row label="Status" value={detailReq.additional_status} />
                                        {detailReq.additional_requested_amount != null && <Row label="Requested" value={fmt(detailReq.additional_requested_amount)} />}
                                        {detailReq.additional_reason && <Row label="Reason" value={detailReq.additional_reason} />}
                                        {detailReq.additional_approved_amount != null && <Row label="Approved" value={fmt(detailReq.additional_approved_amount)} />}
                                        {detailReq.additional_issued_amount != null && <Row label="Issued" value={fmt(detailReq.additional_issued_amount)} />}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-start gap-2">
            <span className="text-muted-foreground w-32 shrink-0 text-xs font-semibold uppercase tracking-wide">{label}</span>
            <span className="flex-1">{value}</span>
        </div>
    );
}
