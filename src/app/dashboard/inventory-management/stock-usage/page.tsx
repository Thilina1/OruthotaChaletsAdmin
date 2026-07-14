'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUserContext } from '@/context/user-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    PackageOpen, ChevronDown, ChevronRight, Loader2, RefreshCw,
    Boxes, AlertTriangle, CheckCircle2, Search, Warehouse, Building2,
} from 'lucide-react';
import { format } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────
type Batch = {
    stock_id: string;
    batch_id: string;
    batch_number: string | null;
    expiry_date: string | null;
    buying_price: number | null;
    quantity: number;
};

type StockItem = {
    id: string;
    name: string;
    category: { id: string; name: string } | null;
    unit: { id: string; name: string } | null;
    total_quantity: number;
    batches: Batch[];
};

type Warehouse = {
    id: string;
    name: string;
    department_id: string | null;
    department: { id: string; name: string } | null;
    is_main: boolean;
    is_active: boolean;
};

type DmgRecord = {
    id: string;
    transaction_type: string;
    quantity: number;
    remarks: string | null;
    created_at: string;
    item: { id: string; name: string; category: { name: string } | null; unit: { name: string } | null } | null;
    batch: { id: string; batch_number: string | null; expiry_date: string | null } | null;
    user: { id: string; name: string } | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const isExpiringSoon = (date: string | null) => {
    if (!date) return false;
    const diff = new Date(date).getTime() - Date.now();
    return diff > 0 && diff < 7 * 86400000;
};
const isExpired = (date: string | null) => {
    if (!date) return false;
    return new Date(date).getTime() < Date.now();
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function StockUsagePage() {
    const { user, hasRole } = useUserContext();
    const { toast } = useToast();
    const isAdmin = hasRole('admin') || (user as any)?.inventory_admin === true;

    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [warehouseId, setWarehouseId] = useState('');
    const [items, setItems] = useState<StockItem[]>([]);
    const [history, setHistory] = useState<DmgRecord[]>([]);
    const [loadingWh, setLoadingWh] = useState(true);
    const [loadingItems, setLoadingItems] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    // Use dialog
    const [useItem, setUseItem] = useState<{ item: StockItem; batch: Batch } | null>(null);
    const [useQty, setUseQty] = useState('');
    const [useReason, setUseReason] = useState('');
    const [saving, setSaving] = useState(false);

    // Damage/Expired dialog
    const [dmgItem, setDmgItem] = useState<{ item: StockItem; batch: Batch } | null>(null);
    const [dmgType, setDmgType] = useState<'damage' | 'expired'>('damage');
    const [dmgQty, setDmgQty] = useState('');
    const [dmgReason, setDmgReason] = useState('');
    const [savingDmg, setSavingDmg] = useState(false);

    // Load warehouses once
    useEffect(() => {
        fetch('/api/admin/inventory/warehouses?all=true')
            .then(r => r.json())
            .then(d => {
                const active = (d.warehouses ?? []).filter((w: Warehouse) => w.is_active);
                setWarehouses(active);

                // Non-admin: auto-select warehouse matching user's HR department
                if (!isAdmin && user?.department) {
                    const match = active.find((w: Warehouse) =>
                        w.department?.name?.toLowerCase() === user.department?.toLowerCase()
                    );
                    if (match) setWarehouseId(match.id);
                }
            })
            .catch(() => toast({ variant: 'destructive', title: 'Error', description: 'Failed to load warehouses.' }))
            .finally(() => setLoadingWh(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdmin, user?.department]);

    const loadItems = useCallback(async () => {
        if (!warehouseId) return;
        setLoadingItems(true);
        try {
            const res = await fetch(`/api/admin/inventory/stock-usage?warehouse_id=${warehouseId}`);
            const d = await res.json();
            if (d.error) throw new Error(d.error);
            setItems(d.items ?? []);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setLoadingItems(false);
        }
    }, [warehouseId, toast]);

    const loadHistory = useCallback(async () => {
        if (!warehouseId) return;
        setLoadingHistory(true);
        try {
            const res = await fetch(`/api/admin/inventory/stock-usage?warehouse_id=${warehouseId}&history=1`);
            const d = await res.json();
            if (d.error) throw new Error(d.error);
            setHistory(d.transactions ?? []);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setLoadingHistory(false);
        }
    }, [warehouseId, toast]);

    useEffect(() => {
        if (warehouseId) {
            loadItems();
            loadHistory();
        } else {
            setItems([]);
            setHistory([]);
        }
    }, [warehouseId, loadItems, loadHistory]);

    const filteredItems = useMemo(() =>
        items.filter(i =>
            i.name.toLowerCase().includes(search.toLowerCase()) ||
            i.category?.name.toLowerCase().includes(search.toLowerCase()) || false
        ), [items, search]);

    const toggleExpand = (id: string) =>
        setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

    const openUse = (item: StockItem, batch: Batch) => {
        setUseItem({ item, batch });
        setUseQty('');
        setUseReason('');
    };

    const openDmg = (item: StockItem, batch: Batch, type: 'damage' | 'expired') => {
        setDmgItem({ item, batch });
        setDmgType(type);
        setDmgQty('');
        setDmgReason('');
    };

    const doUse = async () => {
        if (!useItem) return;
        const qty = Number(useQty);
        if (isNaN(qty) || qty <= 0 || qty > useItem.batch.quantity) return;
        setSaving(true);
        try {
            const res = await fetch('/api/admin/inventory/stock-usage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    warehouse_id: warehouseId,
                    item_id: useItem.item.id,
                    batch_id: useItem.batch.batch_id,
                    stock_id: useItem.batch.stock_id,
                    quantity: qty,
                    type: 'use',
                    reason: useReason.trim() || undefined,
                }),
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error);
            toast({ title: 'Recorded', description: `${qty} ${useItem.item.unit?.name ?? 'units'} of ${useItem.item.name} marked as used.` });
            setUseItem(null);
            loadItems();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setSaving(false);
        }
    };

    const doDmg = async () => {
        if (!dmgItem) return;
        const qty = Number(dmgQty);
        if (isNaN(qty) || qty <= 0 || qty > dmgItem.batch.quantity) return;
        if (!dmgReason.trim()) return;
        setSavingDmg(true);
        try {
            const res = await fetch('/api/admin/inventory/stock-usage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    warehouse_id: warehouseId,
                    item_id: dmgItem.item.id,
                    batch_id: dmgItem.batch.batch_id,
                    stock_id: dmgItem.batch.stock_id,
                    quantity: qty,
                    type: dmgType,
                    reason: dmgReason.trim(),
                }),
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error);
            toast({ title: 'Reported', description: `${qty} ${dmgItem.item.unit?.name ?? 'units'} of ${dmgItem.item.name} reported as ${dmgType}.` });
            setDmgItem(null);
            loadItems();
            loadHistory();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setSavingDmg(false);
        }
    };

    const selectedWarehouse = warehouses.find(w => w.id === warehouseId);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-headline font-bold flex items-center gap-2">
                        <PackageOpen className="h-7 w-7 text-primary" />
                        Stock Usage & Damage
                    </h1>
                    <p className="text-muted-foreground mt-1">Use inventory items, or report expired and damaged stock.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => { loadItems(); loadHistory(); }} disabled={!warehouseId || loadingItems}>
                    <RefreshCw className={`h-4 w-4 mr-1 ${loadingItems ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Department / Warehouse selector */}
            <Card>
                <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground shrink-0">
                            <Building2 className="h-4 w-4" />
                            Department / Warehouse
                        </div>

                        {loadingWh ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                            </div>
                        ) : isAdmin ? (
                            /* Admin: dropdown to pick any warehouse */
                            <Select value={warehouseId || '__none__'} onValueChange={v => setWarehouseId(v === '__none__' ? '' : v)}>
                                <SelectTrigger className="w-64">
                                    <SelectValue placeholder="Select a warehouse" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">— Select warehouse —</SelectItem>
                                    {warehouses.map(w => (
                                        <SelectItem key={w.id} value={w.id}>
                                            {w.name}{w.department ? ` (${w.department.name})` : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            /* Non-admin: shows their department auto-filled, read-only */
                            <div className="flex items-center gap-2">
                                <div className="px-4 py-2 bg-muted rounded-lg text-sm font-medium min-w-48">
                                    {user?.department ?? '—'}
                                </div>
                                {!warehouseId && !loadingWh && (
                                    <span className="text-xs text-amber-600 font-medium">
                                        No warehouse linked to your department yet.
                                    </span>
                                )}
                            </div>
                        )}

                        {selectedWarehouse && (
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Warehouse className="h-3.5 w-3.5" />
                                <span className="font-medium text-foreground">{selectedWarehouse.name}</span>
                                {selectedWarehouse.is_main && (
                                    <Badge className="text-[10px] h-4 bg-emerald-500 text-white">Main</Badge>
                                )}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {!warehouseId ? (
                <Card>
                    <CardContent className="py-16 text-center text-sm text-muted-foreground">
                        <Warehouse className="h-10 w-10 mx-auto mb-3 opacity-20" />
                        {isAdmin ? 'Select a warehouse above to view items.' : 'No warehouse is linked to your department yet.'}
                    </CardContent>
                </Card>
            ) : (
                <Tabs defaultValue="items">
                    <TabsList>
                        <TabsTrigger value="items">
                            Available Items
                            {items.length > 0 && (
                                <Badge variant="secondary" className="ml-1.5 text-[10px]">{items.length}</Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="history">
                            Expired &amp; Damaged
                            {history.length > 0 && (
                                <Badge variant="secondary" className="ml-1.5 text-[10px] bg-red-100 text-red-700">{history.length}</Badge>
                            )}
                        </TabsTrigger>
                    </TabsList>

                    {/* ── Available Items tab ─────────────────────────── */}
                    <TabsContent value="items" className="space-y-3 mt-4">
                        <div className="relative max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search items or category…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>

                        {loadingItems ? (
                            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                                <Loader2 className="h-5 w-5 animate-spin" /> Loading items…
                            </div>
                        ) : filteredItems.length === 0 ? (
                            <Card>
                                <CardContent className="py-16 text-center text-sm text-muted-foreground">
                                    <Boxes className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                    No items with available stock{search ? ' matching your search' : ''}.
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-2">
                                {filteredItems.map(item => {
                                    const open = expanded.has(item.id);
                                    return (
                                        <Card key={item.id} className="overflow-hidden">
                                            {/* Item header row */}
                                            <button
                                                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors"
                                                onClick={() => toggleExpand(item.id)}
                                            >
                                                {open
                                                    ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                                }
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-semibold text-sm">{item.name}</span>
                                                        {item.category && (
                                                            <Badge variant="outline" className="text-[10px]">{item.category.name}</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-sm font-bold text-primary shrink-0">
                                                    {item.total_quantity} {item.unit?.name ?? 'units'}
                                                </div>
                                            </button>

                                            {/* Expanded batches */}
                                            {open && (
                                                <div className="border-t">
                                                    {item.batches.map((batch, idx) => {
                                                        const expired = isExpired(batch.expiry_date);
                                                        const expiring = !expired && isExpiringSoon(batch.expiry_date);
                                                        return (
                                                            <div key={batch.batch_id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${idx > 0 ? 'border-t border-dashed border-slate-100' : ''} ${expired ? 'bg-red-50' : expiring ? 'bg-amber-50' : ''}`}>
                                                                <div className="flex-1 min-w-0 space-y-0.5">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className="font-mono text-xs text-muted-foreground">
                                                                            {batch.batch_number ?? `Batch ${idx + 1}`}
                                                                        </span>
                                                                        {batch.expiry_date && (
                                                                            <span className={`text-[10px] font-semibold ${expired ? 'text-red-600' : expiring ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                                                                {expired ? '⚠ Expired' : expiring ? '⚠ Expires soon'  : 'Exp'}: {format(new Date(batch.expiry_date), 'dd MMM yyyy')}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <span className="text-xs font-semibold text-foreground">
                                                                        {batch.quantity} {item.unit?.name ?? 'units'} available
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-1 shrink-0">
                                                                    <Button
                                                                        size="sm"
                                                                        className="h-7 px-2 text-xs"
                                                                        onClick={() => openUse(item, batch)}
                                                                        disabled={expired}
                                                                    >
                                                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                                                        Use
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-7 px-2 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                                                                        onClick={() => openDmg(item, batch, expired ? 'expired' : 'damage')}
                                                                    >
                                                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                                                        {expired ? 'Expired' : 'Damaged'}
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </TabsContent>

                    {/* ── Expired & Damaged tab ───────────────────────── */}
                    <TabsContent value="history" className="mt-4">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                                    Expired &amp; Damaged Records
                                </CardTitle>
                                <CardDescription>Items removed from stock due to expiry or damage.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                {loadingHistory ? (
                                    <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                                        <Loader2 className="h-5 w-5 animate-spin" /> Loading…
                                    </div>
                                ) : history.length === 0 ? (
                                    <div className="py-12 text-center text-sm text-muted-foreground">
                                        No expired or damaged reports yet.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Type</TableHead>
                                                    <TableHead>Item</TableHead>
                                                    <TableHead>Batch</TableHead>
                                                    <TableHead className="text-right">Qty</TableHead>
                                                    <TableHead>Reason</TableHead>
                                                    <TableHead>Recorded By</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {history.map(r => (
                                                    <TableRow key={r.id}>
                                                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                            {format(new Date(r.created_at), 'dd MMM yyyy HH:mm')}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge className={`text-[10px] border ${r.transaction_type === 'expired' ? 'bg-red-100 text-red-800 border-red-200' : 'bg-orange-100 text-orange-800 border-orange-200'}`}>
                                                                {r.transaction_type === 'expired' ? 'Expired' : 'Damaged'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="font-medium text-sm">{r.item?.name ?? '—'}</div>
                                                            {r.item?.category && (
                                                                <div className="text-[10px] text-muted-foreground">{r.item.category.name}</div>
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
                                                            {r.quantity} {r.item?.unit?.name ?? ''}
                                                        </TableCell>
                                                        <TableCell className="max-w-[200px] text-sm text-muted-foreground">
                                                            <span className="truncate block" title={r.remarks ?? ''}>
                                                                {r.remarks?.replace(/^(EXPIRED|DAMAGE|DAMAGED): /i, '') ?? '—'}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-sm">{r.user?.name ?? '—'}</TableCell>
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
            )}

            {/* ── Use Item Dialog ────────────────────────────────────────── */}
            <Dialog open={!!useItem} onOpenChange={open => { if (!open) setUseItem(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-primary" /> Use Item
                        </DialogTitle>
                        <DialogDescription>
                            {useItem?.item.name} — Batch {useItem?.batch.batch_number ?? 'N/A'} — Available: {useItem?.batch.quantity} {useItem?.item.unit?.name ?? 'units'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-1">
                        <div className="space-y-1.5">
                            <Label>Quantity Used ({useItem?.item.unit?.name ?? 'units'}) *</Label>
                            <Input
                                type="number" min="0.01" step="0.01"
                                max={useItem?.batch.quantity}
                                placeholder="0"
                                value={useQty}
                                onChange={e => setUseQty(e.target.value)}
                                autoFocus
                            />
                            {useQty && Number(useQty) > (useItem?.batch.quantity ?? 0) && (
                                <p className="text-xs text-destructive">Exceeds available stock ({useItem?.batch.quantity}).</p>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <Label>Notes <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                            <Textarea placeholder="What was this used for?" value={useReason} onChange={e => setUseReason(e.target.value)} rows={2} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setUseItem(null)} disabled={saving}>Cancel</Button>
                        <Button
                            onClick={doUse}
                            disabled={saving || !useQty || Number(useQty) <= 0 || Number(useQty) > (useItem?.batch.quantity ?? 0)}
                        >
                            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Confirm Usage
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Damage / Expired Dialog ────────────────────────────────── */}
            <Dialog open={!!dmgItem} onOpenChange={open => { if (!open) setDmgItem(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" /> Report Damaged / Expired
                        </DialogTitle>
                        <DialogDescription>
                            {dmgItem?.item.name} — Batch {dmgItem?.batch.batch_number ?? 'N/A'} — Available: {dmgItem?.batch.quantity} {dmgItem?.item.unit?.name ?? 'units'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-1">
                        <div className="space-y-1.5">
                            <Label>Report Type</Label>
                            <div className="flex gap-2">
                                {(['damage', 'expired'] as const).map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setDmgType(t)}
                                        className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${dmgType === t ? (t === 'expired' ? 'bg-red-600 text-white border-red-600' : 'bg-orange-500 text-white border-orange-500') : 'border-muted-foreground/30 text-muted-foreground hover:border-foreground'}`}
                                    >
                                        {t === 'expired' ? '⏰ Expired' : '⚠️ Damaged'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Quantity ({dmgItem?.item.unit?.name ?? 'units'}) *</Label>
                            <Input
                                type="number" min="0.01" step="0.01"
                                max={dmgItem?.batch.quantity}
                                placeholder="0"
                                value={dmgQty}
                                onChange={e => setDmgQty(e.target.value)}
                            />
                            {dmgQty && Number(dmgQty) > (dmgItem?.batch.quantity ?? 0) && (
                                <p className="text-xs text-destructive">Exceeds available stock ({dmgItem?.batch.quantity}).</p>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <Label>Reason *</Label>
                            <Textarea
                                placeholder={dmgType === 'expired' ? 'e.g. Found past expiry date during stock check' : 'e.g. Broken packaging, contamination, etc.'}
                                value={dmgReason}
                                onChange={e => setDmgReason(e.target.value)}
                                rows={2}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDmgItem(null)} disabled={savingDmg}>Cancel</Button>
                        <Button
                            onClick={doDmg}
                            variant="destructive"
                            disabled={savingDmg || !dmgQty || Number(dmgQty) <= 0 || Number(dmgQty) > (dmgItem?.batch.quantity ?? 0) || !dmgReason.trim()}
                        >
                            {savingDmg && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Report {dmgType === 'expired' ? 'Expired' : 'Damaged'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
