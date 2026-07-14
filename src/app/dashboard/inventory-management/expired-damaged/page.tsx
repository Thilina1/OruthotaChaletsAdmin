'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    AlertTriangle, Loader2, RefreshCw, Search, BadgeDollarSign,
    Undo2, CheckCircle2, Filter, TrendingDown,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────
type DmgRecord = {
    id: string;
    transaction_type: 'damage' | 'expired';
    quantity: number;
    remarks: string | null;
    created_at: string;
    unit_value: number | null;
    total_loss_value: number | null;
    action_taken: 'written_off' | 'returned' | null;
    action_notes: string | null;
    action_at: string | null;
    item: { id: string; name: string; category: { id: string; name: string } | null; unit: { id: string; name: string } | null } | null;
    batch: { id: string; batch_number: string | null; expiry_date: string | null; buying_price: number | null } | null;
    reporter: { id: string; name: string } | null;
    actioner: { id: string; name: string } | null;
    warehouse: { id: string; name: string; department: { name: string } | null } | null;
};

type Warehouse = { id: string; name: string; department: { name: string } | null };

const fmt = (n: number) =>
    `LKR ${n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ExpiredDamagedPage() {
    const { toast } = useToast();

    const [records, setRecords] = useState<DmgRecord[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [warehouseFilter, setWarehouseFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [from, setFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [to, setTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

    // Process dialog
    const [processRec, setProcessRec] = useState<DmgRecord | null>(null);
    const [unitValue, setUnitValue] = useState('');
    const [actionType, setActionType] = useState<'written_off' | 'returned'>('written_off');
    const [returnToStock, setReturnToStock] = useState(false);
    const [actionNotes, setActionNotes] = useState('');
    const [saving, setSaving] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [recRes, whRes] = await Promise.all([
                fetch(`/api/admin/inventory/damage-reports?from=${from}&to=${to}`),
                fetch('/api/admin/inventory/warehouses'),
            ]);
            const [recData, whData] = await Promise.all([recRes.json(), whRes.json()]);
            if (recData.error) throw new Error(recData.error);
            setRecords(recData.records ?? []);
            setWarehouses(whData.warehouses ?? []);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setLoading(false);
        }
    }, [from, to, toast]);

    useEffect(() => { loadData(); }, [loadData]);

    const filtered = useMemo(() => {
        let r = records;
        if (warehouseFilter !== 'all') r = r.filter(x => x.warehouse?.id === warehouseFilter);
        if (typeFilter !== 'all') r = r.filter(x => x.transaction_type === typeFilter);
        if (statusFilter === 'pending')  r = r.filter(x => x.action_taken === null);
        if (statusFilter === 'written_off') r = r.filter(x => x.action_taken === 'written_off');
        if (statusFilter === 'returned') r = r.filter(x => x.action_taken === 'returned');
        if (search) {
            const q = search.toLowerCase();
            r = r.filter(x =>
                x.item?.name.toLowerCase().includes(q) ||
                x.item?.category?.name.toLowerCase().includes(q) ||
                x.warehouse?.name.toLowerCase().includes(q) ||
                x.batch?.batch_number?.toLowerCase().includes(q) ||
                false
            );
        }
        return r;
    }, [records, warehouseFilter, typeFilter, statusFilter, search]);

    const totals = useMemo(() => {
        let qty = 0, lossValued = 0, lossPending = 0;
        let qtyDmg = 0, qtyExp = 0;
        for (const r of filtered) {
            qty += r.quantity;
            if (r.transaction_type === 'damage') qtyDmg += r.quantity;
            else qtyExp += r.quantity;
            if (r.total_loss_value != null) lossValued += r.total_loss_value;
            else lossPending += r.quantity * (r.batch?.buying_price ?? 0);
        }
        const pendingCount = filtered.filter(r => r.action_taken === null).length;
        return { qty, qtyDmg, qtyExp, lossValued, lossPending, pendingCount };
    }, [filtered]);

    const openProcess = (rec: DmgRecord) => {
        setProcessRec(rec);
        setUnitValue(rec.batch?.buying_price != null ? String(rec.batch.buying_price) : '');
        setActionType('written_off');
        setReturnToStock(false);
        setActionNotes('');
    };

    const doProcess = async () => {
        if (!processRec) return;
        const uv = unitValue === '' ? null : Number(unitValue);
        if (uv !== null && (isNaN(uv) || uv < 0)) return;
        setSaving(true);
        try {
            const res = await fetch('/api/admin/inventory/damage-reports', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: processRec.id,
                    unit_value: uv,
                    action_taken: actionType,
                    action_notes: actionNotes.trim() || undefined,
                    return_to_stock: actionType === 'returned' && returnToStock,
                }),
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error);
            toast({
                title: 'Processed',
                description: actionType === 'returned'
                    ? `${processRec.item?.name} marked as returned${returnToStock ? ' and stock restored' : ''}.`
                    : `${processRec.item?.name} written off.`,
            });
            setProcessRec(null);
            loadData();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setSaving(false);
        }
    };

    const statusBadge = (rec: DmgRecord) => {
        if (rec.action_taken === null)
            return <Badge className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px]">Pending</Badge>;
        if (rec.action_taken === 'returned')
            return <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px]">Returned</Badge>;
        return <Badge className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px]">Written Off</Badge>;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-headline font-bold flex items-center gap-2">
                        <AlertTriangle className="h-7 w-7 text-amber-500" />
                        Expired &amp; Damaged
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        View, value, and process all expired and damaged stock across all warehouses.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="border-amber-100 bg-amber-50/40">
                    <CardContent className="pt-4 pb-3">
                        <div className="text-xs font-bold uppercase text-amber-700 tracking-wider">Total Items</div>
                        <div className="text-2xl font-black text-amber-800 mt-1">{totals.qty}</div>
                        <div className="text-[10px] text-amber-600 mt-0.5">{totals.qtyDmg} damaged · {totals.qtyExp} expired</div>
                    </CardContent>
                </Card>
                <Card className="border-red-100 bg-red-50/40">
                    <CardContent className="pt-4 pb-3">
                        <div className="text-xs font-bold uppercase text-red-700 tracking-wider">Total Loss (Valued)</div>
                        <div className="text-lg font-black text-red-800 mt-1">{fmt(totals.lossValued)}</div>
                        <div className="text-[10px] text-red-600 mt-0.5">Confirmed write-offs</div>
                    </CardContent>
                </Card>
                <Card className="border-orange-100 bg-orange-50/40">
                    <CardContent className="pt-4 pb-3">
                        <div className="text-xs font-bold uppercase text-orange-700 tracking-wider">Est. Loss (Pending)</div>
                        <div className="text-lg font-black text-orange-800 mt-1">{fmt(totals.lossPending)}</div>
                        <div className="text-[10px] text-orange-600 mt-0.5">Based on buying price</div>
                    </CardContent>
                </Card>
                <Card className={`${totals.pendingCount > 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-100 bg-slate-50/40'}`}>
                    <CardContent className="pt-4 pb-3">
                        <div className={`text-xs font-bold uppercase tracking-wider ${totals.pendingCount > 0 ? 'text-amber-700' : 'text-slate-600'}`}>
                            Unprocessed
                        </div>
                        <div className={`text-2xl font-black mt-1 ${totals.pendingCount > 0 ? 'text-amber-800' : 'text-slate-700'}`}>
                            {totals.pendingCount}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Need valuation / action</div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-4 pb-3">
                    <div className="flex flex-wrap gap-3 items-center">
                        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />

                        <div className="flex items-center gap-1.5">
                            <Label className="text-xs shrink-0 text-muted-foreground">From</Label>
                            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 text-xs w-36" />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Label className="text-xs shrink-0 text-muted-foreground">To</Label>
                            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 text-xs w-36" />
                        </div>

                        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                            <SelectTrigger className="h-8 text-xs w-44">
                                <SelectValue placeholder="All Warehouses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Warehouses</SelectItem>
                                {warehouses.map(w => (
                                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="h-8 text-xs w-32">
                                <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="damage">Damaged</SelectItem>
                                <SelectItem value="expired">Expired</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-8 text-xs w-36">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="written_off">Written Off</SelectItem>
                                <SelectItem value="returned">Returned</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="relative flex-1 min-w-40">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Search item, batch, warehouse…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="h-8 text-xs pl-8"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-red-500" />
                        Records
                        <Badge variant="secondary" className="ml-1 text-[10px]">{filtered.length}</Badge>
                        {totals.pendingCount > 0 && (
                            <Badge className="ml-1 text-[10px] bg-amber-100 text-amber-800 border border-amber-200">
                                {totals.pendingCount} pending action
                            </Badge>
                        )}
                    </CardTitle>
                    <CardDescription>
                        Click &ldquo;Process&rdquo; to assign a value and mark a record as written off or returned.
                        Valued records automatically appear as <strong>Inventory Loss</strong> expenses in Accounting.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-14 text-center text-sm text-muted-foreground">
                            <AlertTriangle className="h-9 w-9 mx-auto mb-3 opacity-20" />
                            No expired or damaged records for this period / filter.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Item</TableHead>
                                        <TableHead>Warehouse</TableHead>
                                        <TableHead>Batch</TableHead>
                                        <TableHead className="text-right">Qty</TableHead>
                                        <TableHead className="text-right">Unit Cost</TableHead>
                                        <TableHead className="text-right">Total Loss</TableHead>
                                        <TableHead>Reason</TableHead>
                                        <TableHead>Reporter</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map(r => {
                                        const unitCost = r.unit_value ?? r.batch?.buying_price ?? null;
                                        const totalEst = unitCost != null ? unitCost * r.quantity : null;
                                        const isPending = r.action_taken === null;
                                        return (
                                            <TableRow key={r.id} className={isPending ? 'bg-amber-50/30' : ''}>
                                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                    {format(new Date(r.created_at), 'dd MMM yyyy')}
                                                    <div className="text-[10px]">{format(new Date(r.created_at), 'HH:mm')}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={`text-[10px] border ${r.transaction_type === 'expired' ? 'bg-red-100 text-red-800 border-red-200' : 'bg-orange-100 text-orange-800 border-orange-200'}`}>
                                                        {r.transaction_type === 'expired' ? 'Expired' : 'Damaged'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-semibold text-sm">{r.item?.name ?? '—'}</div>
                                                    {r.item?.category && (
                                                        <div className="text-[10px] text-muted-foreground">{r.item.category.name}</div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm font-medium">{r.warehouse?.name ?? '—'}</div>
                                                    {r.warehouse?.department && (
                                                        <div className="text-[10px] text-muted-foreground">{r.warehouse.department.name}</div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">
                                                    {r.batch?.batch_number ?? '—'}
                                                    {r.batch?.expiry_date && (
                                                        <div className="text-[10px] text-muted-foreground">
                                                            Exp: {format(new Date(r.batch.expiry_date), 'dd MMM yyyy')}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    {r.quantity} <span className="text-muted-foreground text-[10px]">{r.item?.unit?.name}</span>
                                                </TableCell>
                                                <TableCell className="text-right text-sm">
                                                    {r.unit_value != null
                                                        ? <span className="font-semibold text-foreground">{r.unit_value.toLocaleString()}</span>
                                                        : unitCost != null
                                                            ? <span className="text-muted-foreground">{unitCost.toLocaleString()} <span className="text-[9px]">(est)</span></span>
                                                            : <span className="text-muted-foreground">—</span>
                                                    }
                                                </TableCell>
                                                <TableCell className="text-right font-bold">
                                                    {r.total_loss_value != null
                                                        ? <span className="text-red-700">{fmt(r.total_loss_value)}</span>
                                                        : totalEst != null
                                                            ? <span className="text-muted-foreground text-sm">{fmt(totalEst)} <span className="text-[9px]">(est)</span></span>
                                                            : <span className="text-muted-foreground">—</span>
                                                    }
                                                </TableCell>
                                                <TableCell className="max-w-[160px]">
                                                    <span className="truncate block text-xs text-muted-foreground" title={r.remarks ?? ''}>
                                                        {r.remarks?.replace(/^(EXPIRED|DAMAGE|DAMAGED): /i, '') ?? '—'}
                                                    </span>
                                                    {r.action_notes && (
                                                        <span className="block text-[10px] text-slate-400 truncate" title={r.action_notes}>
                                                            {r.action_notes}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-sm">{r.reporter?.name ?? '—'}</TableCell>
                                                <TableCell>{statusBadge(r)}</TableCell>
                                                <TableCell>
                                                    {isPending ? (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 px-2 text-xs font-semibold border-amber-300 text-amber-700 hover:bg-amber-50"
                                                            onClick={() => openProcess(r)}
                                                        >
                                                            <BadgeDollarSign className="h-3 w-3 mr-1" />
                                                            Process
                                                        </Button>
                                                    ) : (
                                                        <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                            {r.actioner?.name}<br />
                                                            {r.action_at ? format(new Date(r.action_at), 'dd MMM') : ''}
                                                        </div>
                                                    )}
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

            {/* Process Dialog */}
            <Dialog open={!!processRec} onOpenChange={open => { if (!open) setProcessRec(null); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <BadgeDollarSign className="h-5 w-5 text-primary" />
                            Process Record
                        </DialogTitle>
                        <DialogDescription>
                            {processRec?.item?.name} — {processRec?.quantity} {processRec?.item?.unit?.name ?? 'units'} ·{' '}
                            <span className={processRec?.transaction_type === 'expired' ? 'text-red-600 font-semibold' : 'text-orange-600 font-semibold'}>
                                {processRec?.transaction_type === 'expired' ? 'Expired' : 'Damaged'}
                            </span>
                            {processRec?.batch?.batch_number && <> · Batch: {processRec.batch.batch_number}</>}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-1">
                        {/* Unit value */}
                        <div className="space-y-1.5">
                            <Label>Unit Value (LKR per {processRec?.item?.unit?.name ?? 'unit'})</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number" min="0" step="0.01"
                                    placeholder="0.00"
                                    value={unitValue}
                                    onChange={e => setUnitValue(e.target.value)}
                                    autoFocus
                                />
                                {unitValue && processRec && (
                                    <div className="text-sm font-bold text-red-700 whitespace-nowrap">
                                        = {fmt(Number(unitValue) * processRec.quantity)}
                                    </div>
                                )}
                            </div>
                            {processRec?.batch?.buying_price != null && (
                                <p className="text-[11px] text-muted-foreground">
                                    Buying price: LKR {processRec.batch.buying_price.toLocaleString()} — pre-filled above.
                                </p>
                            )}
                        </div>

                        {/* Action */}
                        <div className="space-y-1.5">
                            <Label>Action Taken</Label>
                            <div className="flex gap-2">
                                {(['written_off', 'returned'] as const).map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => { setActionType(t); if (t !== 'returned') setReturnToStock(false); }}
                                        className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-all ${actionType === t ? (t === 'written_off' ? 'bg-slate-800 text-white border-slate-800' : 'bg-emerald-600 text-white border-emerald-600') : 'border-muted-foreground/30 text-muted-foreground hover:border-foreground'}`}
                                    >
                                        {t === 'written_off' ? '✕ Write Off' : '↩ Return Items'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Return to stock option */}
                        {actionType === 'returned' && (
                            <label className="flex items-center gap-2.5 cursor-pointer select-none p-3 rounded-lg border bg-emerald-50 border-emerald-200">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded accent-emerald-600"
                                    checked={returnToStock}
                                    onChange={e => setReturnToStock(e.target.checked)}
                                />
                                <div>
                                    <div className="text-sm font-semibold text-emerald-800">Restore stock quantity</div>
                                    <div className="text-[11px] text-emerald-700">
                                        Adds {processRec?.quantity} {processRec?.item?.unit?.name ?? 'units'} back to warehouse inventory
                                    </div>
                                </div>
                            </label>
                        )}

                        <div className="space-y-1.5">
                            <Label>Notes <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                            <Textarea
                                placeholder="e.g., Returned to supplier, credit received…"
                                value={actionNotes}
                                onChange={e => setActionNotes(e.target.value)}
                                rows={2}
                            />
                        </div>

                        {actionType === 'written_off' && unitValue && processRec && (
                            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
                                <strong>Accounting impact:</strong> {fmt(Number(unitValue) * processRec.quantity)} will be logged as an <em>Inventory Loss</em> expense.
                            </div>
                        )}
                        {actionType === 'returned' && !returnToStock && unitValue && processRec && (
                            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
                                <strong>Note:</strong> Marking as returned without restoring stock — use this when items were sent back to supplier.
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setProcessRec(null)} disabled={saving}>Cancel</Button>
                        <Button
                            onClick={doProcess}
                            disabled={saving}
                            variant={actionType === 'returned' ? 'default' : 'destructive'}
                        >
                            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            {actionType === 'written_off' ? (
                                <><CheckCircle2 className="h-4 w-4 mr-1.5" /> Confirm Write-Off</>
                            ) : (
                                <><Undo2 className="h-4 w-4 mr-1.5" /> Confirm Return</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
