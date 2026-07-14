'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
    ArrowLeft,
    Download,
    Filter,
    Loader2,
    ArrowUpCircle,
    ArrowDownCircle,
    AlertCircle,
    History,
    RefreshCw,
    Building2,
    Search,
    ChevronLeft,
    ChevronRight,
    Eye,
    X,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
    receive:          { label: 'Stock In',      color: 'bg-green-100 text-green-800' },
    issue:            { label: 'Issued',         color: 'bg-blue-100 text-blue-800' },
    damage:           { label: 'Damaged',        color: 'bg-red-100 text-red-800' },
    expired:          { label: 'Expired',        color: 'bg-orange-100 text-orange-800' },
    transfer:         { label: 'Transfer',       color: 'bg-purple-100 text-purple-800' },
    audit_adjustment: { label: 'Audit Adj.',     color: 'bg-slate-100 text-slate-700' },
    initial_stock:    { label: 'Initial Stock',  color: 'bg-teal-100 text-teal-800' },
};

const ACTION_DESCRIPTIONS: Record<string, { label: string; color: string }> = {
    issue:            { label: 'Issue (Stock Out)',   color: 'text-blue-700' },
    damage:           { label: 'Damage',              color: 'text-red-700' },
    expired:          { label: 'Expired Stock',       color: 'text-orange-700' },
    transfer:         { label: 'Stock Transfer',      color: 'text-purple-700' },
    audit_adjustment: { label: 'Physical Stock Take', color: 'text-slate-700' },
    receive:          { label: 'Stock In (GRN)',      color: 'text-green-700' },
    initial_stock:    { label: 'Initial Stock',       color: 'text-teal-700' },
};

function getSource(tx: any): 'him' | 'grn' | 'stock-usage' | 'system' {
    if (tx.from_him) return 'him';
    const r = (tx.remarks || '').toLowerCase();
    if (r.includes('po received') || r.includes('grn') || r.includes('purchase order') || r.includes('fulfilling')) return 'grn';
    if (r.includes('employee consumption') || r.includes('damage') || r.includes('expired')) return 'stock-usage';
    if (tx.transaction_type === 'initial_stock') return 'system';
    return 'system';
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
    him:         { label: 'HIM Direct',   color: 'bg-violet-100 text-violet-800' },
    grn:         { label: 'GRN / PO',     color: 'bg-green-100 text-green-800' },
    'stock-usage': { label: 'Stock Usage', color: 'bg-amber-100 text-amber-800' },
    system:      { label: 'System',       color: 'bg-slate-100 text-slate-600' },
};

const PAGE_SIZE = 25;

export default function TransactionLogPage() {
    const { toast } = useToast();
    const [transactions, setTransactions] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [selectedTx, setSelectedTx] = useState<any>(null);

    // Filters
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [warehouseFilter, setWarehouseFilter] = useState('all');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            let url = `/api/admin/inventory-transactions?limit=1000`;
            if (fromDate) url += `&startDate=${fromDate}`;
            if (toDate) url += `&endDate=${toDate}`;

            const [txRes, whRes] = await Promise.all([
                fetch(url),
                fetch('/api/admin/inventory/warehouses'),
            ]);
            const txData = await txRes.json();
            const whData = await whRes.json();
            if (txData.error) throw new Error(txData.error);
            setTransactions(txData.transactions || []);
            setWarehouses(whData.warehouses || []);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsLoading(false);
        }
    }, [fromDate, toDate]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filtered = useMemo(() => {
        let rows = transactions.filter(t => t.from_him === true);
        if (typeFilter !== 'all') rows = rows.filter(t => t.transaction_type === typeFilter);
        if (warehouseFilter !== 'all') rows = rows.filter(t => t.department_id === warehouseFilter);
        if (search.trim()) {
            const q = search.toLowerCase();
            rows = rows.filter(t =>
                t.item?.name?.toLowerCase().includes(q) ||
                t.remarks?.toLowerCase().includes(q) ||
                t.user?.name?.toLowerCase().includes(q) ||
                t.batch?.batch_number?.toLowerCase().includes(q) ||
                t.warehouse_name?.toLowerCase().includes(q)
            );
        }
        return rows;
    }, [transactions, typeFilter, warehouseFilter, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // Reset page on filter change
    useEffect(() => { setPage(1); }, [typeFilter, warehouseFilter, search]);

    const exportCSV = () => {
        const headers = ['Date', 'Item', 'Category', 'Type', 'Source', 'Qty', 'Warehouse', 'Ref Warehouse', 'Batch', 'Expiry', 'Remarks', 'User'];
        const rows = filtered.map(t => [
            t.created_at ? format(new Date(t.created_at), 'yyyy-MM-dd HH:mm') : '',
            t.item?.name || '',
            t.item?.category?.name || '',
            TYPE_LABELS[t.transaction_type]?.label || t.transaction_type,
            SOURCE_LABELS[getSource(t)]?.label || '',
            t.quantity ?? '',
            t.warehouse_name || t.department_id || '',
            t.reference_warehouse_name || t.reference_department || '',
            (t.batch?.batch_number === 'INITIAL' ? '' : t.batch?.batch_number) || '',
            t.batch?.expiry_date ? format(new Date(t.batch.expiry_date), 'yyyy-MM-dd') : '',
            (t.remarks || '').replace(/,/g, ';'),
            t.user?.name || 'System',
        ]);

        const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transaction-log-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const getTypeIcon = (type: string) => {
        if (['receive', 'initial_stock'].includes(type)) return <ArrowUpCircle className="h-3.5 w-3.5 text-green-500" />;
        if (type === 'issue') return <ArrowDownCircle className="h-3.5 w-3.5 text-blue-500" />;
        if (['damage', 'expired'].includes(type)) return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
        return <History className="h-3.5 w-3.5 text-slate-400" />;
    };

    return (
        <>
        <div className="space-y-6 pb-16">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div className="space-y-1">
                    <Link href="/dashboard/inventory-management" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                        <ArrowLeft className="h-3 w-3" /> Back to Inventory
                    </Link>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center">
                            <History className="h-6 w-6 text-primary" />
                        </div>
                        Transaction Log
                    </h1>
                    <p className="text-muted-foreground text-sm">Direct transactions from Hotel Inventory Management</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading} className="gap-2">
                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} /> Refresh
                    </Button>
                    <Button size="sm" onClick={exportCSV} disabled={filtered.length === 0} className="gap-2">
                        <Download className="h-4 w-4" /> Export CSV
                    </Button>
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'HIM Direct Total', value: filtered.length, color: 'text-violet-700' },
                    { label: 'Issues', value: filtered.filter(t => t.transaction_type === 'issue').length, color: 'text-blue-700' },
                    { label: 'Transfers', value: filtered.filter(t => t.transaction_type === 'transfer').length, color: 'text-purple-700' },
                    { label: 'Damage / Expired', value: filtered.filter(t => ['damage','expired'].includes(t.transaction_type)).length, color: 'text-red-700' },
                ].map(c => (
                    <Card key={c.label} className="border-none shadow-sm bg-white/70">
                        <CardContent className="p-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{c.label}</p>
                            <p className={cn("text-2xl font-black mt-1", c.color)}>{c.value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl border shadow-sm p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                    <Filter className="h-3.5 w-3.5" /> Filters
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    <div className="relative lg:col-span-2">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search item, user, batch, warehouse..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-8 h-9 text-sm"
                        />
                    </div>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All Types" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            {Object.entries(TYPE_LABELS).map(([v, { label }]) => (
                                <SelectItem key={v} value={v}>{label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All Warehouses" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Warehouses</SelectItem>
                            {warehouses.map((w: any) => (
                                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="flex gap-1.5">
                        <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-9 text-xs" />
                        <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-9 text-xs" />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-700">
                        {filtered.length} record{filtered.length !== 1 ? 's' : ''}
                        {(typeFilter !== 'all' || warehouseFilter !== 'all' || search || fromDate || toDate) && ' (filtered)'}
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px] text-violet-700 bg-violet-50 px-2 py-1 rounded-lg border border-violet-200 font-bold">
                        <span className="h-2.5 w-1 rounded-full bg-violet-400 inline-block" /> HIM Direct only
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <Table className="min-w-[900px]">
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="w-[140px] text-[10px] font-black uppercase tracking-wider">Date & Time</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-wider">Item</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-wider">Type</TableHead>
                                <TableHead className="text-center text-[10px] font-black uppercase tracking-wider">Qty</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-wider">Warehouse</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-wider">Remarks</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-wider">User</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-wider">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-32 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            ) : paginated.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                        No transactions found.
                                    </TableCell>
                                </TableRow>
                            ) : paginated.map(tx => {
                                const isHIM = tx.from_him === true;
                                const typeInfo = TYPE_LABELS[tx.transaction_type];
                                const isIn = ['receive', 'initial_stock'].includes(tx.transaction_type);
                                const remarkText = tx.reference_warehouse_name
                                    ? (tx.transaction_type === 'receive'
                                        ? `From: ${tx.reference_warehouse_name}`
                                        : `To: ${tx.reference_warehouse_name}`)
                                    : (tx.remarks || '—');

                                return (
                                    <TableRow key={tx.id} className={cn(
                                        "transition-colors",
                                        isHIM
                                            ? "bg-violet-50/70 hover:bg-violet-100/70 border-l-4 border-l-violet-400"
                                            : "hover:bg-slate-50"
                                    )}>
                                        <TableCell className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                                            {tx.created_at ? format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm') : '—'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-semibold text-sm leading-tight">{tx.item?.name || '—'}</div>
                                            <div className="text-[10px] text-muted-foreground">{tx.item?.category?.name || ''}</div>
                                            {tx.batch?.batch_number && tx.batch.batch_number !== 'INITIAL' && (
                                                <div className="text-[10px] font-mono text-slate-400">{tx.batch.batch_number}</div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5">
                                                {getTypeIcon(tx.transaction_type)}
                                                <Badge className={cn("text-[10px] border-none hover:opacity-80", typeInfo?.color ?? 'bg-slate-100 text-slate-700')}>
                                                    {typeInfo?.label ?? tx.transaction_type}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className={cn("font-black text-sm", isIn ? 'text-green-600' : 'text-red-600')}>
                                                {isIn ? '+' : '−'}{tx.quantity}
                                            </span>
                                            <div className="text-[9px] text-muted-foreground">{tx.item?.unit?.name || ''}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1 text-sm">
                                                <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                                                <span className="truncate max-w-[120px]">{tx.warehouse_name || '—'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs text-muted-foreground italic max-w-[180px] truncate block" title={remarkText}>
                                                {remarkText}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-sm font-medium">
                                            {tx.user?.name || 'System'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div>
                                                    <p className={cn("text-xs font-semibold leading-tight", ACTION_DESCRIPTIONS[tx.transaction_type]?.color ?? 'text-slate-700')}>
                                                        {ACTION_DESCRIPTIONS[tx.transaction_type]?.label ?? tx.transaction_type}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                                        {tx.quantity} {tx.item?.unit?.name || ''}
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 text-slate-400 hover:text-violet-600 hover:bg-violet-50 shrink-0"
                                                    onClick={() => setSelectedTx(tx)}
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-4 border-t flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                            Page {page} of {totalPages} · {filtered.length} total
                        </span>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Detail modal */}
        {selectedTx && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setSelectedTx(null)}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-5 py-4 border-b bg-violet-50">
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-1.5 rounded-full bg-violet-400" />
                            <span className="font-bold text-violet-900 text-sm">Transaction Details</span>
                            <Badge className={cn("text-[10px] border-none ml-1", TYPE_LABELS[selectedTx.transaction_type]?.color ?? 'bg-slate-100 text-slate-700')}>
                                {TYPE_LABELS[selectedTx.transaction_type]?.label ?? selectedTx.transaction_type}
                            </Badge>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSelectedTx(null)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="p-5 space-y-3 text-sm">
                        {[
                            { label: 'Date & Time', value: selectedTx.created_at ? format(new Date(selectedTx.created_at), 'yyyy-MM-dd HH:mm:ss') : '—' },
                            { label: 'Item', value: selectedTx.item?.name || '—' },
                            { label: 'Category', value: selectedTx.item?.category?.name || '—' },
                            { label: 'Batch Number', value: (selectedTx.batch?.batch_number && selectedTx.batch.batch_number !== 'INITIAL') ? selectedTx.batch.batch_number : '—' },
                            { label: 'Expiry Date', value: selectedTx.batch?.expiry_date ? format(new Date(selectedTx.batch.expiry_date), 'yyyy-MM-dd') : '—' },
                            { label: 'Quantity', value: `${selectedTx.quantity} ${selectedTx.item?.unit?.name || ''}`.trim() },
                            { label: 'Warehouse', value: selectedTx.warehouse_name || selectedTx.department_id || '—' },
                            ...(selectedTx.reference_warehouse_name || selectedTx.reference_department
                                ? [{ label: selectedTx.transaction_type === 'receive' ? 'From Warehouse' : 'To Warehouse', value: selectedTx.reference_warehouse_name || selectedTx.reference_department }]
                                : []),
                            { label: 'Remarks', value: selectedTx.remarks || '—' },
                            { label: 'Recorded By', value: selectedTx.user?.name || 'System' },
                        ].map(({ label, value }) => (
                            <div key={label} className="flex gap-3">
                                <span className="text-muted-foreground w-32 shrink-0 text-xs pt-0.5">{label}</span>
                                <span className="font-medium text-slate-800 flex-1">{value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
