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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Banknote, Loader2, RefreshCw, ShoppingCart, CheckCircle2,
    AlertTriangle, Clock, User, RotateCcw, TrendingUp, Eye, PackageCheck,
} from 'lucide-react';
import { format } from 'date-fns';

type LinkedPurchaseOrder = {
    id: string;
    po_number: string;
    supplier_name: string | null;
    payment_type: 'cash' | 'credit';
    status: string;
    notes: string | null;
    created_at: string;
    liability_settled_at?: string | null;
    purchase_order_items: {
        id: string;
        item_name: string;
        unit: string;
        quantity: number;
        unit_price: number | null;
        total_price: number | null;
        received_quantity?: number | null;
        batch_number?: string | null;
        expiry_date?: string | null;
    }[];
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
    issued_at: string | null;
    settled_at: string | null;
    created_at: string;
    requested_by_user: { id: string; name: string; email: string; department: string | null } | null;
    approved_by_user: { name: string } | null;
    issued_by_user: { name: string } | null;
    purchase_order: LinkedPurchaseOrder | null;
};

type Account = { id: string; name: string; current_balance: number; is_active: boolean };

type DirectGRN = {
    grn_number: string;
    payment_type: 'cash' | 'credit';
    purchase_order_id: string | null;
    liability_settled_at: string | null;
    liability_settled_by: string | null;
    supplier: string | null;
    remarks: string | null;
    created_at: string;
    warehouse: { id: string; name: string } | null;
    items: {
        id: string;
        item: { id: string; name: string; code: string | null } | null;
        quantity: number;
        unit_price: number | null;
        batch_number: string | null;
        expiry_date: string | null;
    }[];
};

type CreditLiability =
    | { id: string; kind: 'po'; reference: string; supplier: string | null; created_at: string; amount: number; settled_at: string | null; po: LinkedPurchaseOrder }
    | { id: string; kind: 'grn'; reference: string; supplier: string | null; created_at: string; amount: number; settled_at: string | null; grn: DirectGRN };

const fmt = (n: number | null | undefined) =>
    n != null ? `Rs ${Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

function PurchaseOrderPreview({ po }: { po: LinkedPurchaseOrder }) {
    const total = po.purchase_order_items.reduce(
        (sum, item) => sum + (item.total_price ?? (item.unit_price ?? 0) * item.quantity),
        0
    );

    return (
        <div className="rounded-lg border bg-slate-50/70 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                <div>
                    <p className="font-semibold">{po.po_number}</p>
                    <p className="text-xs text-muted-foreground">{po.supplier_name || 'Supplier not specified'}</p>
                </div>
                <div className="flex gap-2">
                    <Badge variant="secondary" className="capitalize">{po.payment_type || 'credit'} Order</Badge>
                    <Badge variant="outline" className="capitalize">{po.status.replaceAll('_', ' ')}</Badge>
                </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Unit Price</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {po.purchase_order_items.map(item => {
                            const lineTotal = item.total_price ?? (item.unit_price ?? 0) * item.quantity;
                            return (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <div className="font-medium text-xs">{item.item_name}</div>
                                        <div className="text-[10px] text-muted-foreground">{item.unit}</div>
                                    </TableCell>
                                    <TableCell className="text-right text-xs">{item.quantity}</TableCell>
                                    <TableCell className="text-right text-xs">{fmt(item.unit_price)}</TableCell>
                                    <TableCell className="text-right text-xs font-medium">{fmt(lineTotal)}</TableCell>
                                </TableRow>
                            );
                        })}
                        <TableRow className="bg-muted/40">
                            <TableCell colSpan={3} className="text-right text-xs font-semibold">PO Total</TableCell>
                            <TableCell className="text-right font-bold">{fmt(total)}</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
            {po.notes && <p className="border-t px-4 py-2 text-xs text-muted-foreground">Notes: {po.notes}</p>}
        </div>
    );
}

function PurchaseOrderGRNPreview({ po }: { po: LinkedPurchaseOrder }) {
    const total = po.purchase_order_items.reduce(
        (sum, item) => sum + Number(item.unit_price ?? 0) * Number(item.received_quantity ?? item.quantity), 0
    );
    return (
        <div className="overflow-hidden rounded-lg border border-emerald-200 bg-emerald-50/30">
            <div className="flex items-center justify-between border-b border-emerald-100 px-4 py-3">
                <div><p className="font-semibold text-emerald-900">Goods Received Note</p><p className="text-xs text-emerald-700">Received against PO {po.po_number}</p></div>
                <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200">Received</Badge>
            </div>
            <div className="max-h-72 overflow-y-auto">
                <Table>
                    <TableHeader><TableRow>
                        <TableHead>Item</TableHead><TableHead>Batch</TableHead><TableHead>Expiry</TableHead>
                        <TableHead className="text-right">Received Qty</TableHead><TableHead className="text-right">Unit Price</TableHead><TableHead className="text-right">Line Total</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                        {po.purchase_order_items.map(item => {
                            const quantity = Number(item.received_quantity ?? item.quantity);
                            return <TableRow key={item.id}>
                                <TableCell><div className="text-xs font-medium">{item.item_name}</div><div className="text-[10px] text-muted-foreground">{item.unit}</div></TableCell>
                                <TableCell className="text-xs">{item.batch_number || '—'}</TableCell>
                                <TableCell className="whitespace-nowrap text-xs">{item.expiry_date ? format(new Date(item.expiry_date), 'dd MMM yyyy') : '—'}</TableCell>
                                <TableCell className="text-right text-xs">{quantity}</TableCell>
                                <TableCell className="text-right text-xs">{fmt(item.unit_price)}</TableCell>
                                <TableCell className="text-right text-xs font-medium">{fmt(Number(item.unit_price ?? 0) * quantity)}</TableCell>
                            </TableRow>;
                        })}
                        <TableRow className="bg-emerald-50"><TableCell colSpan={5} className="text-right text-xs font-semibold">GRN Total</TableCell><TableCell className="text-right font-bold text-emerald-800">{fmt(total)}</TableCell></TableRow>
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

function DirectGRNPreview({ grn }: { grn: DirectGRN }) {
    const total = grn.items.reduce((sum, item) => sum + Number(item.unit_price ?? 0) * Number(item.quantity), 0);
    return (
        <div className="overflow-hidden rounded-lg border bg-slate-50/70">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                <div>
                    <p className="font-semibold">{grn.grn_number}</p>
                    <p className="text-xs text-muted-foreground">{grn.supplier || 'Supplier not specified'} · {grn.warehouse?.name || 'Warehouse not specified'}</p>
                </div>
                <Badge className="bg-orange-100 text-orange-800 border border-orange-200">Direct Credit GRN</Badge>
            </div>
            <div className="max-h-72 overflow-y-auto">
                <Table>
                    <TableHeader><TableRow>
                        <TableHead>Item</TableHead><TableHead>Batch</TableHead>
                        <TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Line Total</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                        {grn.items.map(item => (
                            <TableRow key={item.id}>
                                <TableCell><div className="text-xs font-medium">{item.item?.name || 'Unknown item'}</div><div className="text-[10px] text-muted-foreground">{item.item?.code || ''}</div></TableCell>
                                <TableCell className="text-xs">{item.batch_number || '—'}</TableCell>
                                <TableCell className="text-right text-xs">{item.quantity}</TableCell>
                                <TableCell className="text-right text-xs">{fmt(item.unit_price)}</TableCell>
                                <TableCell className="text-right text-xs font-medium">{fmt(Number(item.unit_price ?? 0) * Number(item.quantity))}</TableCell>
                            </TableRow>
                        ))}
                        <TableRow className="bg-muted/40"><TableCell colSpan={4} className="text-right text-xs font-semibold">GRN Total</TableCell><TableCell className="text-right font-bold">{fmt(total)}</TableCell></TableRow>
                    </TableBody>
                </Table>
            </div>
            {grn.remarks && <p className="border-t px-4 py-2 text-xs text-muted-foreground">Notes: {grn.remarks}</p>}
        </div>
    );
}

export default function AccountingInventoryCashPage() {
    const { toast } = useToast();
    const [requests, setRequests] = useState<CashRequest[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<LinkedPurchaseOrder[]>([]);
    const [directGRNs, setDirectGRNs] = useState<DirectGRN[]>([]);
    const [viewingLiability, setViewingLiability] = useState<CreditLiability | null>(null);
    const [settlingLiabilityId, setSettlingLiabilityId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');
    const [issuanceType, setIssuanceType] = useState<'cash' | 'credit'>('cash');

    // Issue cash dialog
    const [issueReq, setIssueReq] = useState<CashRequest | null>(null);
    const [issueAmount, setIssueAmount] = useState('');
    const [issueAccount, setIssueAccount] = useState('');
    const [issuing, setIssuing] = useState(false);

    // Issue additional dialog
    const [issueAddReq, setIssueAddReq] = useState<CashRequest | null>(null);
    const [issueAddAmount, setIssueAddAmount] = useState('');
    const [issueAddAccount, setIssueAddAccount] = useState('');
    const [issuingAdd, setIssuingAdd] = useState(false);
    const [accounts, setAccounts] = useState<Account[]>([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [res, poRes, grnRes, accountsRes] = await Promise.all([
                fetch('/api/admin/inventory-cash-requests?view=all'),
                fetch('/api/admin/purchase-orders'),
                fetch('/api/admin/inventory/stock-intake'),
                fetch('/api/admin/accounts'),
            ]);
            const [data, poData, grnData, accountsData] = await Promise.all([res.json(), poRes.json(), grnRes.json(), accountsRes.json()]);
            setRequests(data.requests ?? []);
            setPurchaseOrders(poData.purchase_orders ?? []);
            setDirectGRNs(grnData.grns ?? []);
            setAccounts((accountsData.accounts ?? []).filter((account: Account) => account.is_active));
        } catch {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to load requests.' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const markLiabilitySettled = async (liability: CreditLiability) => {
        setSettlingLiabilityId(liability.id);
        try {
            const res = await fetch('/api/admin/inventory-credit-liabilities', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source: liability.kind,
                    source_id: liability.kind === 'po' ? liability.po.id : liability.grn.grn_number,
                    settled: true,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to settle liability.');
            toast({ title: 'Liability Settled', description: `${liability.reference} has been marked as settled.` });
            await fetchData();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Settlement Failed', description: error.message });
        } finally {
            setSettlingLiabilityId(null);
        }
    };

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
                    account_id: issueAccount,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast({ title: 'Cash Issued', description: `${issueReq.request_number}: ${fmt(Number(issueAmount) || issueReq.approved_amount)} issued to ${issueReq.requested_by_user?.name}.` });
            window.dispatchEvent(new Event('notifications-changed'));
            setIssueReq(null);
            setIssueAmount('');
            setIssueAccount('');
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
                    account_id: issueAddAccount,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast({ title: 'Additional Cash Issued', description: `Additional funds issued to ${issueAddReq.requested_by_user?.name}.` });
            window.dispatchEvent(new Event('notifications-changed'));
            setIssueAddReq(null);
            setIssueAddAmount('');
            setIssueAddAccount('');
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
        setIssueAccount('');
    };

    const openIssueAdditional = (req: CashRequest) => {
        setIssueAddReq(req);
        setIssueAddAmount(String(req.additional_approved_amount ?? ''));
        setIssueAddAccount('');
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
    const cashToIssue = toIssue.filter(request => request.purchase_order?.payment_type !== 'credit');
    const creditLiabilities = useMemo<CreditLiability[]>(() => {
        const poLiabilities: CreditLiability[] = purchaseOrders
            .filter(po => po.payment_type === 'credit' && ['approved', 'sent', 'received'].includes(po.status))
            .map(po => ({
                id: `po-${po.id}`, kind: 'po', reference: po.po_number,
                supplier: po.supplier_name, created_at: po.created_at,
                amount: po.purchase_order_items.reduce((sum, item) => sum + (item.total_price ?? Number(item.unit_price ?? 0) * Number(item.quantity)), 0),
                settled_at: po.liability_settled_at ?? null,
                po,
            }));
        const grnLiabilities: CreditLiability[] = directGRNs
            .filter(grn => grn.payment_type === 'credit' && !grn.purchase_order_id)
            .map(grn => ({
                id: `grn-${grn.grn_number}`, kind: 'grn', reference: grn.grn_number,
                supplier: grn.supplier, created_at: grn.created_at,
                amount: grn.items.reduce((sum, item) => sum + Number(item.unit_price ?? 0) * Number(item.quantity), 0),
                settled_at: grn.liability_settled_at ?? null,
                grn,
            }));
        return [...poLiabilities, ...grnLiabilities].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [purchaseOrders, directGRNs]);
    const displayedToIssue = cashToIssue;
    const issued = filteredRequests.filter(r => r.status === 'ISSUED');
    const additionalToIssue = filteredRequests.filter(r => r.status === 'ISSUED' && r.additional_status === 'APPROVED');
    const settled = filteredRequests.filter(r => r.status === 'SETTLED');

    // Financial summary
    const totalApproved = cashToIssue.reduce((s, r) => s + (r.approved_amount ?? 0), 0);
    const outstandingCreditLiabilities = creditLiabilities.filter(liability => !liability.settled_at);
    const settledCreditLiabilities = creditLiabilities.filter(liability => !!liability.settled_at);
    const outstandingCreditLiability = outstandingCreditLiabilities.reduce((sum, liability) => sum + liability.amount, 0);
    const totalCashDisbursed = requests
        .filter(request => request.status === 'ISSUED' || request.status === 'SETTLED')
        .reduce((sum, request) => sum + (request.issued_amount ?? 0) + (request.additional_issued_amount ?? 0), 0);
    const totalSettledCreditDisbursed = settledCreditLiabilities.reduce((sum, liability) => sum + liability.amount, 0);
    const totalDisbursed = totalCashDisbursed + totalSettledCreditDisbursed;
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                    { label: 'Awaiting Cash Issuance', value: fmt(totalApproved), sub: `${cashToIssue.length} request${cashToIssue.length !== 1 ? 's' : ''}`, color: 'text-blue-600' },
                    { label: 'Cash in Hand (Issued)', value: fmt(issued.reduce((s, r) => s + (r.issued_amount ?? 0) + (r.additional_issued_amount ?? 0), 0)), sub: `${issued.length} active`, color: 'text-purple-600' },
                    { label: 'Total Disbursed', value: fmt(totalDisbursed), sub: 'cash issued + settled credit', color: 'text-slate-600' },
                    { label: 'Total Returned', value: fmt(totalReturned), sub: `${settled.length} settled`, color: 'text-green-600' },
                    { label: 'Credit Liabilities', value: fmt(outstandingCreditLiability), sub: `${outstandingCreditLiabilities.length} outstanding`, color: 'text-orange-600' },
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
                    <TabsTrigger value="settled" className="gap-1">
                        Settled
                        {(settled.length + settledCreditLiabilities.length) > 0 && <Badge className="h-4 min-w-4 text-[10px] bg-green-600 text-white">{settled.length + settledCreditLiabilities.length}</Badge>}
                    </TabsTrigger>
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
                            <div className="flex gap-2 border-t border-b bg-muted/20 px-4 py-3">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={issuanceType === 'cash' ? 'default' : 'outline'}
                                    onClick={() => setIssuanceType('cash')}
                                    className="gap-2"
                                >
                                    Cash Requests
                                    <Badge variant="secondary" className="h-5 min-w-5 px-1.5">{cashToIssue.length}</Badge>
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={issuanceType === 'credit' ? 'default' : 'outline'}
                                    onClick={() => setIssuanceType('credit')}
                                    className="gap-2"
                                >
                                    Credit Liabilities
                                    <Badge variant="secondary" className="h-5 min-w-5 px-1.5">{outstandingCreditLiabilities.length}</Badge>
                                </Button>
                            </div>
                            {issuanceType === 'credit' && (
                                <div className="flex items-center justify-between gap-4 border-b bg-orange-50 px-4 py-3 text-sm">
                                    <div>
                                        <div className="font-semibold text-orange-800">Outstanding Supplier Liability</div>
                                        <div className="text-xs text-orange-700">Credit orders are liabilities and do not require cash issuance.</div>
                                    </div>
                                    <div className="text-lg font-bold text-orange-700">{fmt(outstandingCreditLiability)}</div>
                                </div>
                            )}
                            {loading ? (
                                <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                                    <Loader2 className="h-5 w-5 animate-spin" /> Loading…
                                </div>
                            ) : issuanceType === 'credit' ? (
                                outstandingCreditLiabilities.length === 0 ? (
                                    <div className="py-10 text-center text-muted-foreground text-sm border-t">
                                        No outstanding Credit POs or direct Credit GRNs found.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader><TableRow>
                                                <TableHead>Source</TableHead>
                                                <TableHead>Reference</TableHead>
                                                <TableHead>Related PO</TableHead>
                                                <TableHead>Supplier</TableHead>
                                                <TableHead>Items</TableHead>
                                                <TableHead className="text-right">Liability Amount</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Date</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow></TableHeader>
                                            <TableBody>
                                                {outstandingCreditLiabilities.map(liability => (
                                                    <TableRow key={liability.id}>
                                                        <TableCell>
                                                            <Badge className={liability.kind === 'po' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-orange-100 text-orange-800 border border-orange-200'}>
                                                                {liability.kind === 'po' ? 'Credit PO' : 'Direct Credit GRN'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="font-mono text-xs font-bold">{liability.reference}</TableCell>
                                                        <TableCell className="font-mono text-xs">
                                                            {liability.kind === 'po' ? liability.po.po_number : '—'}
                                                        </TableCell>
                                                        <TableCell className="text-sm">{liability.supplier || '—'}</TableCell>
                                                        <TableCell className="text-sm">{liability.kind === 'po' ? liability.po.purchase_order_items.length : liability.grn.items.length}</TableCell>
                                                        <TableCell className="text-right font-bold text-orange-700">{fmt(liability.amount)}</TableCell>
                                                        <TableCell>
                                                            {liability.settled_at ? (
                                                                <div>
                                                                    <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200">Settled</Badge>
                                                                    <div className="mt-1 whitespace-nowrap text-[10px] text-muted-foreground">{format(new Date(liability.settled_at), 'dd MMM yyyy, HH:mm')}</div>
                                                                </div>
                                                            ) : (
                                                                <Badge className="bg-orange-100 text-orange-800 border border-orange-200">Outstanding</Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{format(new Date(liability.created_at), 'dd MMM yyyy')}</TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => setViewingLiability(liability)}>
                                                                    <Eye className="h-3 w-3" /> View
                                                                </Button>
                                                                {!liability.settled_at && (
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        className="h-7 gap-1 bg-emerald-600 px-2 text-xs hover:bg-emerald-700"
                                                                        disabled={settlingLiabilityId === liability.id}
                                                                        onClick={() => markLiabilitySettled(liability)}
                                                                    >
                                                                        {settlingLiabilityId === liability.id
                                                                            ? <Loader2 className="h-3 w-3 animate-spin" />
                                                                            : <CheckCircle2 className="h-3 w-3" />}
                                                                        Mark Settled
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )
                            ) : displayedToIssue.length === 0 ? (
                                <div className="py-10 text-center text-muted-foreground text-sm border-t">
                                    No approved {issuanceType} requests awaiting issuance.
                                </div>
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
                                            {displayedToIssue.map(req => (
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
                    <Tabs defaultValue="settled-requests" className="space-y-4">
                        <TabsList>
                            <TabsTrigger value="settled-requests" className="gap-2">
                                Settled Requests
                                <Badge variant="secondary" className="h-5 min-w-5 px-1.5">{settled.length}</Badge>
                            </TabsTrigger>
                            <TabsTrigger value="settled-credit-liabilities" className="gap-2">
                                Settled Credit Liabilities
                                <Badge variant="secondary" className="h-5 min-w-5 px-1.5">{settledCreditLiabilities.length}</Badge>
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="settled-requests">
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
                        <TabsContent value="settled-credit-liabilities">
                    <Card>
                        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Settled Credit Liabilities</CardTitle><CardDescription>Credit POs and direct Credit GRNs that have been paid and settled.</CardDescription></CardHeader>
                        <CardContent className="p-0">
                            {loading ? <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div> : settledCreditLiabilities.length === 0 ? <div className="border-t py-10 text-center text-sm text-muted-foreground">No settled credit liabilities yet.</div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Source</TableHead><TableHead>Reference</TableHead><TableHead>Related PO</TableHead><TableHead>Supplier</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Settled On</TableHead><TableHead className="text-right">Details</TableHead></TableRow></TableHeader><TableBody>{settledCreditLiabilities.map(liability => <TableRow key={liability.id}><TableCell><Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200">{liability.kind === 'po' ? 'Credit PO' : 'Direct Credit GRN'}</Badge></TableCell><TableCell className="font-mono text-xs font-bold">{liability.reference}</TableCell><TableCell className="font-mono text-xs">{liability.kind === 'po' ? liability.po.po_number : '—'}</TableCell><TableCell className="text-sm">{liability.supplier || '—'}</TableCell><TableCell className="text-right text-sm font-bold text-emerald-700">{fmt(liability.amount)}</TableCell><TableCell className="whitespace-nowrap text-xs text-muted-foreground">{liability.settled_at ? format(new Date(liability.settled_at), 'dd MMM yyyy, HH:mm') : '—'}</TableCell><TableCell className="text-right"><Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => setViewingLiability(liability)}><Eye className="h-3 w-3" /> View</Button></TableCell></TableRow>)}</TableBody></Table></div>}
                        </CardContent>
                    </Card>
                        </TabsContent>
                    </Tabs>
                </TabsContent>
            </Tabs>

            <Dialog open={!!viewingLiability} onOpenChange={open => { if (!open) setViewingLiability(null); }}>
                <DialogContent className="flex h-[80vh] w-[calc(100vw-2rem)] max-w-[920px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[920px]">
                    <DialogHeader className="shrink-0 border-b bg-slate-50/80 px-5 py-4 pr-12">
                        <DialogTitle className="flex items-center gap-2 text-base">
                            <PackageCheck className="h-4 w-4 text-orange-600" />
                            Credit Liability Details
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            {viewingLiability?.kind === 'po'
                                ? `Purchase Order ${viewingLiability.reference}`
                                : `Direct GRN ${viewingLiability?.reference}`}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="min-h-0 flex-1 overflow-y-auto p-4 text-xs [&_td]:py-2 [&_td]:text-xs [&_th]:h-8 [&_th]:py-1 [&_th]:text-[10px] [&_p]:leading-tight">
                        {viewingLiability?.kind === 'po' && (
                            <div className="space-y-3">
                                <PurchaseOrderPreview po={viewingLiability.po} />
                                {viewingLiability.po.status === 'received' && <PurchaseOrderGRNPreview po={viewingLiability.po} />}
                            </div>
                        )}
                        {viewingLiability?.kind === 'grn' && <DirectGRNPreview grn={viewingLiability.grn} />}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Issue Cash Dialog */}
            <Dialog open={!!issueReq} onOpenChange={open => { if (!open) setIssueReq(null); }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                        {issueReq?.purchase_order && (
                            <PurchaseOrderPreview po={issueReq.purchase_order} />
                        )}
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
                            <Label>Source Account</Label>
                            <Select value={issueAccount} onValueChange={setIssueAccount}>
                                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                                <SelectContent>{accounts.map(account => <SelectItem key={account.id} value={account.id}>{account.name} — {fmt(account.current_balance)}</SelectItem>)}</SelectContent>
                            </Select>
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
                        <Button onClick={doIssue} disabled={issuing || !issueAmount || !issueAccount}>
                            {issuing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Issue {issueAmount ? fmt(Number(issueAmount)) : ''}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Issue Additional Dialog */}
            <Dialog open={!!issueAddReq} onOpenChange={open => { if (!open) setIssueAddReq(null); }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                        {issueAddReq?.purchase_order && (
                            <PurchaseOrderPreview po={issueAddReq.purchase_order} />
                        )}
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
                            <Label>Source Account</Label>
                            <Select value={issueAddAccount} onValueChange={setIssueAddAccount}>
                                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                                <SelectContent>{accounts.map(account => <SelectItem key={account.id} value={account.id}>{account.name} — {fmt(account.current_balance)}</SelectItem>)}</SelectContent>
                            </Select>
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
                        <Button onClick={doIssueAdditional} disabled={issuingAdd || !issueAddAmount || !issueAddAccount}>
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
