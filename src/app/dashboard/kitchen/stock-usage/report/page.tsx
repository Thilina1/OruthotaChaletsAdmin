'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { BarChart3, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const SECTIONS = ['Staff', 'Function', 'A la carte', 'Room guest'] as const;
type UsageRecord = {
    id: string; quantity: number; remarks: string | null; usage_section: string;
    created_at: string; item: { name: string; unit: { name: string } | null } | null;
    batch: { batch_number: string | null } | null; user: { name: string } | null;
};

export default function KitchenStockUsageReportPage() {
    const { toast } = useToast();
    const [warehouseId, setWarehouseId] = useState('');
    const [rows, setRows] = useState<UsageRecord[]>([]);
    const [section, setSection] = useState('all');
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            let kitchenWarehouseId = warehouseId;
            if (!kitchenWarehouseId) {
                const warehouseResponse = await fetch('/api/admin/inventory/warehouses?all=true');
                const warehouseData = await warehouseResponse.json();
                if (!warehouseResponse.ok || warehouseData.error) throw new Error(warehouseData.error || 'Failed to load Kitchen warehouse.');
                const kitchen = (warehouseData.warehouses || []).find((warehouse: any) =>
                    warehouse.is_active && warehouse.department?.name?.toLowerCase().trim() === 'kitchen'
                );
                if (!kitchen) throw new Error('No active warehouse is linked to the Kitchen department.');
                kitchenWarehouseId = kitchen.id;
                setWarehouseId(kitchen.id);
            }
            const response = await fetch(`/api/admin/inventory/stock-usage?warehouse_id=${kitchenWarehouseId}&usage_history=1`);
            const data = await response.json();
            if (!response.ok || data.error) throw new Error(data.error || 'Failed to load usage report.');
            setRows(data.transactions || []);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Report Unavailable', description: error.message });
        } finally {
            setLoading(false);
        }
    }, [warehouseId, toast]);

    useEffect(() => { void load(); }, [load]);
    const visibleRows = useMemo(() => rows.filter(row => section === 'all' || row.usage_section === section), [rows, section]);

    return <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div><h1 className="flex items-center gap-2 text-3xl font-bold"><BarChart3 className="h-7 w-7 text-primary" /> Kitchen Stock Usage Report</h1><p className="mt-1 text-muted-foreground">Section-based stock consumed from the Kitchen warehouse.</p></div>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{SECTIONS.map(name => { const sectionRows = rows.filter(row => row.usage_section === name); return <Card key={name} className="cursor-pointer" onClick={() => setSection(name)}><CardContent className="p-4"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{name}</p><p className="mt-1 text-2xl font-black">{sectionRows.reduce((sum, row) => sum + Number(row.quantity), 0).toLocaleString()}</p><p className="text-xs text-muted-foreground">{sectionRows.length} usage records</p></CardContent></Card>; })}</div>
        <div className="flex gap-2 overflow-x-auto"><Button size="sm" variant={section === 'all' ? 'default' : 'outline'} onClick={() => setSection('all')}>All Sections</Button>{SECTIONS.map(name => <Button key={name} size="sm" className="shrink-0" variant={section === name ? 'default' : 'outline'} onClick={() => setSection(name)}>{name}</Button>)}</div>
        <Card><CardHeader className="pb-3"><CardTitle className="text-base">Usage Records</CardTitle><CardDescription>{visibleRows.length} records shown</CardDescription></CardHeader><CardContent className="p-0">{loading ? <div className="flex justify-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading report…</div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Section</TableHead><TableHead>Item</TableHead><TableHead>Batch</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead>Notes</TableHead><TableHead>Recorded By</TableHead></TableRow></TableHeader><TableBody>{visibleRows.map(row => <TableRow key={row.id}><TableCell className="whitespace-nowrap text-xs">{format(new Date(row.created_at), 'dd MMM yyyy HH:mm')}</TableCell><TableCell><Badge variant="outline">{row.usage_section}</Badge></TableCell><TableCell className="font-medium">{row.item?.name || '—'}</TableCell><TableCell className="font-mono text-xs">{row.batch?.batch_number || '—'}</TableCell><TableCell className="text-right font-bold">{row.quantity} {row.item?.unit?.name || ''}</TableCell><TableCell className="max-w-[220px] text-sm text-muted-foreground">{row.remarks?.replace(/^(Staff|Function|A la carte|Room guest) usage:?\s*/i, '') || '—'}</TableCell><TableCell>{row.user?.name || '—'}</TableCell></TableRow>)}{visibleRows.length === 0 && <TableRow><TableCell colSpan={7} className="h-28 text-center text-muted-foreground">No Kitchen usage recorded for this section.</TableCell></TableRow>}</TableBody></Table></div>}</CardContent></Card>
    </div>;
}
