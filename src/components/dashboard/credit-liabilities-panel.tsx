'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Eye, Loader2, PackageCheck, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Line = { id: string; name: string; code?: string | null; unit?: string; quantity: number; unit_price: number | null; batch_number?: string | null; expiry_date?: string | null };
type Liability = {
    id: string; kind: 'po' | 'grn'; reference: string; relatedPO: string | null;
    supplier: string | null; createdAt: string; settledAt: string | null; status?: string;
    lines: Line[]; notes: string | null;
};

const money = (value: number | null | undefined) =>
    value == null ? '—' : `Rs ${Number(value).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function CreditLiabilitiesPanel() {
    const [liabilities, setLiabilities] = useState<Liability[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Liability | null>(null);
    const [statusFilter, setStatusFilter] = useState<'all' | 'outstanding' | 'settled'>('outstanding');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [poRes, grnRes] = await Promise.all([
                fetch('/api/admin/purchase-orders'),
                fetch('/api/admin/inventory/stock-intake'),
            ]);
            const [poData, grnData] = await Promise.all([poRes.json(), grnRes.json()]);
            const creditPOs: Liability[] = (poData.purchase_orders ?? [])
                .filter((po: any) => po.payment_type === 'credit' && ['approved', 'sent', 'received'].includes(po.status))
                .map((po: any) => ({
                    id: `po-${po.id}`, kind: 'po', reference: po.po_number, relatedPO: po.po_number,
                    supplier: po.supplier_name, createdAt: po.created_at, settledAt: po.liability_settled_at ?? null,
                    status: po.status, notes: po.notes,
                    lines: (po.purchase_order_items ?? []).map((item: any) => ({
                        id: item.id, name: item.item_name, unit: item.unit,
                        quantity: Number(item.received_quantity ?? item.quantity), unit_price: item.unit_price,
                        batch_number: item.batch_number, expiry_date: item.expiry_date,
                    })),
                }));
            const directGRNs: Liability[] = (grnData.grns ?? [])
                .filter((grn: any) => grn.payment_type === 'credit' && !grn.purchase_order_id)
                .map((grn: any) => ({
                    id: `grn-${grn.grn_number}`, kind: 'grn', reference: grn.grn_number, relatedPO: null,
                    supplier: grn.supplier, createdAt: grn.created_at, settledAt: grn.liability_settled_at ?? null,
                    notes: grn.remarks,
                    lines: (grn.items ?? []).map((item: any) => ({
                        id: item.id, name: item.item?.name || 'Unknown item', code: item.item?.code,
                        quantity: Number(item.quantity), unit_price: item.unit_price,
                        batch_number: item.batch_number, expiry_date: item.expiry_date,
                    })),
                }));
            setLiabilities([...creditPOs, ...directGRNs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);
    const total = (liability: Liability) => liability.lines.reduce((sum, line) => sum + Number(line.unit_price ?? 0) * line.quantity, 0);
    const outstanding = useMemo(() => liabilities.filter(item => !item.settledAt), [liabilities]);
    const settled = useMemo(() => liabilities.filter(item => !!item.settledAt), [liabilities]);
    const displayedLiabilities = useMemo(() => {
        if (statusFilter === 'outstanding') return outstanding;
        if (statusFilter === 'settled') return settled;
        return liabilities;
    }, [liabilities, outstanding, settled, statusFilter]);

    return (
        <>
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                        <div><CardTitle className="text-base text-orange-800">Credit Liabilities</CardTitle><CardDescription>Credit POs and standalone Credit GRNs.</CardDescription></div>
                        <div className="flex items-center gap-2">
                            <Badge className="bg-orange-100 text-orange-800 border border-orange-200">{outstanding.length} Outstanding · {money(outstanding.reduce((sum, item) => sum + total(item), 0))}</Badge>
                            <Button size="sm" variant="outline" className="h-8" onClick={load} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /></Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="flex flex-wrap gap-2 border-y bg-muted/20 px-4 py-3">
                        {([
                            ['all', `All (${liabilities.length})`],
                            ['outstanding', `Outstanding (${outstanding.length})`],
                            ['settled', `Settled (${settled.length})`],
                        ] as const).map(([value, label]) => (
                            <Button key={value} type="button" size="sm" variant={statusFilter === value ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setStatusFilter(value)}>{label}</Button>
                        ))}
                    </div>
                    {loading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div> : liabilities.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground">No credit liabilities found.</div> : displayedLiabilities.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground">No {statusFilter} credit liabilities found.</div> : (
                        <div className="overflow-x-auto"><Table><TableHeader><TableRow>
                            <TableHead>Source</TableHead><TableHead>Reference</TableHead><TableHead>Related PO</TableHead><TableHead>Supplier</TableHead><TableHead>Items</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead>Settled On</TableHead><TableHead className="text-right">Details</TableHead>
                        </TableRow></TableHeader><TableBody>{displayedLiabilities.map(item => (
                            <TableRow key={item.id}>
                                <TableCell><Badge variant="outline" className="text-[10px]">{item.kind === 'po' ? 'Credit PO' : 'Direct Credit GRN'}</Badge></TableCell>
                                <TableCell className="font-mono text-xs font-bold">{item.reference}</TableCell><TableCell className="font-mono text-xs">{item.relatedPO || '—'}</TableCell>
                                <TableCell className="text-xs">{item.supplier || '—'}</TableCell><TableCell className="text-xs">{item.lines.length}</TableCell><TableCell className="text-right text-xs font-bold text-orange-700">{money(total(item))}</TableCell>
                                <TableCell>{item.settledAt ? <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200">Settled</Badge> : <Badge className="bg-orange-100 text-orange-800 border border-orange-200">Outstanding</Badge>}</TableCell>
                                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{item.settledAt ? format(new Date(item.settledAt), 'dd MMM yyyy, HH:mm') : '—'}</TableCell>
                                <TableCell className="text-right"><Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => setSelected(item)}><Eye className="h-3 w-3" /> View</Button></TableCell>
                            </TableRow>
                        ))}</TableBody></Table></div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
                <DialogContent className="flex h-[80vh] w-[calc(100vw-2rem)] max-w-[920px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[920px]">
                    <DialogHeader className="shrink-0 border-b bg-slate-50 px-5 py-4 pr-12"><DialogTitle className="flex items-center gap-2 text-base"><PackageCheck className="h-4 w-4 text-orange-600" />Credit Liability Details</DialogTitle><DialogDescription className="text-xs">{selected?.kind === 'po' ? `Purchase Order ${selected.reference}` : `Direct GRN ${selected?.reference}`}</DialogDescription></DialogHeader>
                    {selected && <div className="min-h-0 flex-1 overflow-y-auto p-4 text-xs">
                        <div className="mb-3 grid grid-cols-2 gap-3 rounded-lg border bg-slate-50 p-3 sm:grid-cols-4">
                            <div><div className="text-[10px] uppercase text-muted-foreground">Supplier</div><div className="font-semibold">{selected.supplier || '—'}</div></div>
                            <div><div className="text-[10px] uppercase text-muted-foreground">Related PO</div><div className="font-mono font-semibold">{selected.relatedPO || '—'}</div></div>
                            <div><div className="text-[10px] uppercase text-muted-foreground">Date</div><div className="font-semibold">{format(new Date(selected.createdAt), 'dd MMM yyyy')}</div></div>
                            <div><div className="text-[10px] uppercase text-muted-foreground">Status</div><div className="font-semibold">{selected.settledAt ? `Settled ${format(new Date(selected.settledAt), 'dd MMM yyyy')}` : 'Outstanding'}</div></div>
                        </div>
                        <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Batch</TableHead><TableHead>Expiry</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Unit Price</TableHead><TableHead className="text-right">Line Total</TableHead></TableRow></TableHeader><TableBody>
                            {selected.lines.map(line => <TableRow key={line.id}><TableCell className="py-2 text-xs font-medium">{line.name}<div className="text-[10px] text-muted-foreground">{line.code || line.unit || ''}</div></TableCell><TableCell className="py-2 text-xs">{line.batch_number || '—'}</TableCell><TableCell className="py-2 text-xs">{line.expiry_date ? format(new Date(line.expiry_date), 'dd MMM yyyy') : '—'}</TableCell><TableCell className="py-2 text-right text-xs">{line.quantity}</TableCell><TableCell className="py-2 text-right text-xs">{money(line.unit_price)}</TableCell><TableCell className="py-2 text-right text-xs font-bold">{money(Number(line.unit_price ?? 0) * line.quantity)}</TableCell></TableRow>)}
                            <TableRow className="bg-orange-50"><TableCell colSpan={5} className="text-right text-xs font-bold">Total Liability</TableCell><TableCell className="text-right font-bold text-orange-800">{money(total(selected))}</TableCell></TableRow>
                        </TableBody></Table></div>
                        {selected.notes && <div className="mt-3 rounded border p-3 text-xs text-muted-foreground">Notes: {selected.notes}</div>}
                    </div>}
                </DialogContent>
            </Dialog>
        </>
    );
}
