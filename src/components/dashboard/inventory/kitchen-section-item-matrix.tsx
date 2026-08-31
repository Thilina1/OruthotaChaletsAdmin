'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Plus, Search, UtensilsCrossed, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Assignment = { id: string; section: string; item_id: string };

export function KitchenSectionItemMatrix({
    items,
    sections,
    assignments,
    onRefresh,
}: {
    items: any[];
    sections: readonly string[];
    assignments: Assignment[];
    onRefresh: () => Promise<void> | void;
}) {
    const { toast } = useToast();
    const [search, setSearch] = useState('');
    const [processing, setProcessing] = useState<string | null>(null);
    const filtered = useMemo(() => items.filter(item =>
        item.name?.toLowerCase().includes(search.toLowerCase()) ||
        item.code?.toLowerCase().includes(search.toLowerCase())
    ), [items, search]);

    const changeAssignment = async (item: any, section: string, assigned: boolean) => {
        const key = `${item.id}-${section}`;
        setProcessing(key);
        try {
            const query = new URLSearchParams({ item_id: item.id, section });
            const res = await fetch(`/api/admin/inventory/kitchen-section-items${assigned ? `?${query}` : ''}`, {
                method: assigned ? 'DELETE' : 'POST',
                headers: assigned ? undefined : { 'Content-Type': 'application/json' },
                body: assigned ? undefined : JSON.stringify({ item_id: item.id, section }),
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'Could not update assignment.');
            toast({
                title: assigned ? 'Assignment Removed' : 'Kitchen Item Initialized',
                description: `${item.name} ${assigned ? 'removed from' : 'assigned to'} ${section}.`,
            });
            await onRefresh();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setProcessing(null);
        }
    };

    return <div className="space-y-4">
        <div className="flex items-center gap-4 rounded-xl border bg-white p-4 shadow-sm">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} className="bg-slate-50 pl-9" placeholder="Search Kitchen items to assign..." />
            </div>
            <Badge variant="outline" className="hidden gap-1 md:flex"><UtensilsCrossed className="h-3 w-3" /> {items.length} Kitchen Items</Badge>
        </div>
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader><TableRow className="bg-slate-50/50">
                        <TableHead className="min-w-[260px] font-bold">Kitchen Item</TableHead>
                        {sections.map(section => <TableHead key={section} className="min-w-[135px] text-center font-bold">{section}</TableHead>)}
                    </TableRow></TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? <TableRow><TableCell colSpan={sections.length + 1} className="h-32 text-center text-muted-foreground">No initialized Kitchen items found.</TableCell></TableRow> : filtered.map(item =>
                            <TableRow key={item.id}>
                                <TableCell>
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <div className="font-bold">{item.name}</div>
                                            <div className="text-[10px] text-muted-foreground">{item.code} • {item.unit?.name}</div>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <div className={Number(item.local_stock) > 0 ? 'text-sm font-black text-emerald-600' : 'text-sm font-black text-slate-400'}>
                                                {Number(item.local_stock || 0).toLocaleString()}
                                            </div>
                                            <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                                                {item.unit?.name || 'units'} available
                                            </div>
                                        </div>
                                    </div>
                                </TableCell>
                                {sections.map(section => {
                                    const assigned = assignments.some(a => a.item_id === item.id && a.section === section);
                                    const busy = processing === `${item.id}-${section}`;
                                    return <TableCell key={section} className="text-center">
                                        <Button variant="ghost" size="sm" disabled={!!processing} onClick={() => changeAssignment(item, section, assigned)} className={assigned ? 'gap-1 text-emerald-600 hover:text-red-600' : 'gap-1 text-muted-foreground hover:text-primary'}>
                                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : assigned ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                                            {assigned ? <><span>Assigned</span><X className="h-3 w-3" /></> : 'Initialize'}
                                        </Button>
                                    </TableCell>;
                                })}
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
        <p className="px-2 text-[11px] text-muted-foreground">Only items initialized in the Kitchen warehouse appear here. Assigned items become available in that section's request list.</p>
    </div>;
}
