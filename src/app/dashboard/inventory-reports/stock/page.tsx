'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileBarChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

export default function InventoryStockReportPage() {
    const [items, setItems] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [selectedWarehouseIds, setSelectedWarehouseIds] = useState<string[]>([]);
    const [page, setPage] = useState(1);
    const pageSize = 20;

    useEffect(() => {
        Promise.all([fetch('/api/admin/inventory/items?includeStock=true'), fetch('/api/admin/inventory/warehouses')])
            .then(async ([itemsResponse, warehousesResponse]) => {
                const [itemData, warehouseData] = await Promise.all([itemsResponse.json(), warehousesResponse.json()]);
                setItems(itemData.items || []);
                setWarehouses(warehouseData.warehouses || []);
            });
    }, []);

    const visibleWarehouses = selectedWarehouseIds.length === 0 ? warehouses : warehouses.filter(warehouse => selectedWarehouseIds.includes(warehouse.id));
    const filteredItems = useMemo(() => {
        const query = search.trim().toLowerCase();
        return items.filter(item => !query || String(item.name || '').toLowerCase().includes(query) || String(item.code || '').toLowerCase().includes(query));
    }, [items, search]);
    const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    return <div className="w-full space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div><Link href="/dashboard/inventory-reports" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><ArrowLeft className="h-3 w-3" /> Back to Inventory Reports</Link><h1 className="flex items-center gap-3 text-3xl font-headline font-bold"><FileBarChart className="h-8 w-8 text-primary" /> Stock by Warehouse</h1><p className="text-muted-foreground">Full inventory availability across all warehouses.</p></div>
        </div>
        <div className="flex flex-wrap items-start gap-3 rounded-md border bg-white p-4"><Input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search item name or code..." className="h-9 w-64" /><div className="min-w-[280px]"><p className="mb-2 text-xs font-semibold text-muted-foreground">Select warehouse columns</p><div className="flex max-h-24 flex-wrap gap-x-4 gap-y-2 overflow-y-auto">{warehouses.map(warehouse => <label key={warehouse.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedWarehouseIds.length === 0 || selectedWarehouseIds.includes(warehouse.id)} onChange={event => { setSelectedWarehouseIds(current => { const allIds = warehouses.map(item => item.id); if (event.target.checked) return current.length === 0 ? allIds : [...current, warehouse.id]; const next = (current.length === 0 ? allIds : current).filter(id => id !== warehouse.id); return next.length === allIds.length ? [] : next; }); setPage(1); }} />{warehouse.name}</label>)}</div><p className="mt-2 text-[11px] text-muted-foreground">Clear all selections to show every warehouse.</p></div></div>
        <div className="overflow-auto rounded-md border bg-white"><Table className="min-w-full"><TableHeader className="sticky top-0 z-10 bg-slate-50"><TableRow><TableHead className="sticky left-0 z-20 min-w-[280px] bg-slate-50">Item</TableHead>{visibleWarehouses.map(warehouse => <TableHead key={warehouse.id} className="min-w-[150px] text-center">{warehouse.name}</TableHead>)}</TableRow></TableHeader><TableBody>{paginatedItems.map(item => <TableRow key={item.id}><TableCell className="sticky left-0 bg-white font-semibold">{item.name}</TableCell>{visibleWarehouses.map(warehouse => { const stock = item.warehouse_stock?.find((entry: any) => entry.id === warehouse.id)?.total_stock ?? 0; return <TableCell key={warehouse.id} className={`text-center font-bold ${Number(stock) > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>{stock}</TableCell>; })}</TableRow>)}{!paginatedItems.length && <TableRow><TableCell colSpan={visibleWarehouses.length + 1} className="py-12 text-center text-muted-foreground">No inventory items found.</TableCell></TableRow>}</TableBody></Table></div>
        <DataTablePagination currentPage={currentPage} totalPages={totalPages} totalItems={filteredItems.length} itemsPerPage={pageSize} onPageChange={setPage} />
    </div>;
}
