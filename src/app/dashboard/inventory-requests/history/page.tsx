'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Badge } from '@/components/ui/badge';
import { useUserContext } from '@/context/user-context';
import { cn } from "@/lib/utils";
import {
    ArrowLeft,
    History,
    Package,
    ArrowRight,
    Loader2,
    Plus,
    AlertCircle
} from 'lucide-react';

export default function InventoryRequestHistoryPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const deptIdParam = searchParams.get('deptId');
    const { toast } = useToast();
    const { user, hasRole } = useUserContext();
    const isAdmin = hasRole('admin');
    const supabase = createClient();

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [existingRequests, setExistingRequests] = useState<any[]>([]);
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);
    const [requestFilter, setRequestFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');
    
    // Pagination
    const {
        currentPage,
        totalPages,
        totalItems,
        paginatedItems: paginatedRequests,
        itemsPerPage,
        setCurrentPage,
    } = usePagination(useMemo(() => {
        return existingRequests
            .filter(r => requestFilter === 'ALL' || r.status === requestFilter)
            .filter(r => !deptIdParam || r.action_metadata?.requesting_department_id === deptIdParam);
    }, [existingRequests, requestFilter, deptIdParam]), 20);

    // Transfer Modal State
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferRequest, setTransferRequest] = useState<any>(null);
    const [selectedBatches, setSelectedBatches] = useState<any[]>([]); // { batch_id, warehouse_id, quantity, available }

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [reqRes, invRes] = await Promise.all([
                fetch('/api/admin/inventory-requests'),
                fetch('/api/admin/inventory/items?includeStock=true')
            ]);

            const reqData = await reqRes.json();
            const invData = await invRes.json();

            if (reqData.error) throw new Error(reqData.error);
            if (invData.error) throw new Error(invData.error);

            setExistingRequests(reqData.requests || []);
            setInventoryItems(invData.items || []);
        } catch (error: any) {
            console.error("Error fetching data:", error);
            toast({ variant: 'destructive', title: "Error", description: error.message || "Failed to fetch requests." });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleOpenTransfer = (request: any) => {
        const item = inventoryItems.find(i => i.id === request.item_id);
        if (!item) {
            toast({ variant: 'destructive', title: "Error", description: "Item details not found." });
            return;
        }

        setTransferRequest({ ...request, item });
        setSelectedBatches([]);
        setIsTransferModalOpen(true);
    };

    const handleAddBatchToTransfer = (batch: any, warehouse: any) => {
        if (selectedBatches.find(b => b.batch_id === batch.id && b.warehouse_id === warehouse.id)) return;

        setSelectedBatches([...selectedBatches, {
            batch_id: batch.id,
            batch_number: batch.batch_number,
            warehouse_id: warehouse.id,
            warehouse_name: warehouse.name,
            quantity: 0,
            available: batch.quantity
        }]);
    };

    const handleUpdateBatchQty = (index: number, qty: string) => {
        const newBatches = [...selectedBatches];
        newBatches[index].quantity = Number(qty);
        setSelectedBatches(newBatches);
    };

    const handleRemoveBatch = (index: number) => {
        setSelectedBatches(selectedBatches.filter((_, i) => i !== index));
    };

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [requestFilter, deptIdParam, setCurrentPage]);

    const handleFulfillTransfer = async () => {
        const totalAllocated = selectedBatches.reduce((sum, b) => sum + b.quantity, 0);

        if (totalAllocated <= 0) {
            toast({ variant: 'destructive', title: "Error", description: "Please allocate quantity to transfer." });
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/admin/inventory-requests', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: transferRequest.id,
                    status: 'COMPLETED',
                    received_quantity: totalAllocated,
                    batch_allocations: selectedBatches.map(b => ({
                        batch_id: b.batch_id,
                        warehouse_id: b.warehouse_id,
                        quantity: b.quantity
                    }))
                }),
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast({ title: "Transfer Successful", description: "Inventory has been moved and request marked as completed." });
            setIsTransferModalOpen(false);
            fetchData();
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Transfer Failed", description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground font-medium animate-pulse">Loading Inventory Approvals & Transfers...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-10">
            {/* Header Section */}
            <div className="relative overflow-hidden bg-slate-900 rounded-[2rem] p-8 text-white">
                <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 bg-primary/20 rounded-full blur-[100px]" />
                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-6">
                        <Button
                            variant="ghost"
                            className="text-white/60 hover:text-white hover:bg-white/10 rounded-xl"
                            onClick={() => router.back()}
                        >
                            <ArrowLeft className="h-5 w-5 mr-2" />
                            Back
                        </Button>
                        <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary px-4 py-1 rounded-full font-black text-[10px] uppercase tracking-widest">
                            Inventory Approvals & Transfers
                        </Badge>
                    </div>
                    <h1 className="text-3xl font-black mb-2 tracking-tight">Inventory Approvals & Transfers</h1>
                    <p className="text-lg text-slate-400 max-w-2xl font-medium leading-tight">
                        Track and manage all stock requests across departments.
                    </p>
                </div>
            </div>

            {/* Main Content */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                            <History className="h-5 w-5 text-primary" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                            {deptIdParam ? `Requests for ${existingRequests.find(r => r.action_metadata?.requesting_department_id === deptIdParam)?.action_metadata?.requesting_department_name || 'Department'}` : 'All Requests'}
                        </h2>
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        {deptIdParam && (
                            <button
                                onClick={() => router.push('/dashboard/inventory-requests/history')}
                                className="px-4 py-1.5 rounded-lg text-xs font-black bg-primary text-white shadow-sm mr-2"
                            >
                                Clear Dept Filter
                            </button>
                        )}
                        {(['ALL', 'PENDING', 'COMPLETED'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setRequestFilter(f)}
                                className={cn(
                                    "px-4 py-1.5 rounded-lg text-xs font-black transition-all",
                                    requestFilter === f ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow className="hover:bg-transparent border-slate-100">
                                <TableHead className="py-6 pl-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Request Info</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Item</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Route (From → To)</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Quantity</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Status</TableHead>
                                <TableHead className="text-right pr-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedRequests.map((req) => (
                                    <TableRow key={req.id} className="group hover:bg-slate-50/30 transition-colors border-slate-50">
                                        <TableCell className="py-5 pl-8">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700">#{req.id.substring(0, 8)}</span>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                    {new Date(req.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                                                    <Package className="h-5 w-5 text-slate-300" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-800">{req.item?.name || 'Unknown Item'}</span>
                                                    <span className="text-[10px] font-bold text-slate-400">{req.item?.code}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase">From</span>
                                                    <span className="font-bold text-slate-700">{req.action_metadata?.source_warehouse_name || 'Main Store'}</span>
                                                </div>
                                                <ArrowRight className="h-3 w-3 text-slate-300 mx-2" />
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase">To</span>
                                                    <span className="font-bold text-primary">
                                                        {req.action_metadata?.requesting_department_name || req.requester?.department || 'Department'}
                                                    </span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-lg font-black text-slate-700">{req.requested_quantity}</span>
                                                <span className="text-[10px] font-black text-slate-300 uppercase">{req.item?.unit?.name || 'units'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={cn(
                                                "rounded-full font-black text-[10px] px-3 py-0.5",
                                                req.status === 'PENDING' ? "bg-amber-100 text-amber-700 hover:bg-amber-100" :
                                                    req.status === 'COMPLETED' ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" :
                                                        "bg-slate-100 text-slate-700 hover:bg-slate-100"
                                            )}>
                                                {req.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right pr-8">
                                            {isAdmin && req.status === 'PENDING' && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-9 rounded-lg font-black text-[10px] gap-2 border-primary/20 text-primary hover:bg-primary hover:text-white"
                                                    onClick={() => handleOpenTransfer(req)}
                                                >
                                                    <ArrowRight className="h-3 w-3" />
                                                    Transfer
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            {existingRequests.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-12 text-center text-slate-400 font-medium italic">
                                        No requests found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                <DataTablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                />
            </div>

            {/* Transfer Modal */}
            <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferModalOpen}>
                <DialogContent className="sm:max-w-[700px] rounded-[2.5rem] border-slate-100 p-0 overflow-hidden shadow-2xl">
                    <div className="bg-emerald-50/50 p-8 pb-4">
                        <DialogHeader>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-14 w-14 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-emerald-100">
                                    <ArrowRight className="h-7 w-7 text-emerald-600" />
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-black text-slate-900">Fulfill Transfer</DialogTitle>
                                    <DialogDescription className="font-medium text-slate-500">
                                        Fulfill request from <span className="text-primary font-bold">Main Store</span> batches
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                    </div>

                    <div className="p-8 pt-6 space-y-8">
                        {transferRequest && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                                            <Package className="h-6 w-6 text-slate-300" />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-800">{transferRequest.item?.name}</h4>
                                            <p className="text-xs font-bold text-slate-400 italic">Requested: {transferRequest.requested_quantity} {transferRequest.item?.unit?.name}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black uppercase text-slate-400">Total Allocated</p>
                                        <p className="text-2xl font-black text-emerald-600">
                                            {selectedBatches.reduce((sum, b) => sum + b.quantity, 0)}
                                            <span className="text-[10px] ml-1 text-slate-300">/ {transferRequest.requested_quantity}</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Available Batches</label>
                                    <div className="grid grid-cols-1 gap-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                                        {transferRequest.item?.warehouse_stock?.map((wh: any) => (
                                            wh.batches?.map((batch: any, bIdx: number) => (
                                                <div key={`${wh.id}-${bIdx}`} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-primary/30 transition-all group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-black text-slate-700">Batch {batch.batch_number}</span>
                                                            <span className="text-[10px] font-bold text-slate-400">{wh.name} • Exp: {batch.expiry_date || 'N/A'}</span>
                                                        </div>
                                                        <Badge variant="outline" className="text-[10px] bg-slate-50">{batch.quantity} available</Badge>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0 rounded-lg text-primary hover:bg-primary/5"
                                                        onClick={() => handleAddBatchToTransfer(batch, wh)}
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Allocated Batches</label>
                                    <div className="space-y-2">
                                        {selectedBatches.map((sb, idx) => (
                                            <div key={idx} className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                <div className="flex-1">
                                                    <p className="text-xs font-black text-slate-700">{sb.batch_number}</p>
                                                    <p className="text-[10px] font-bold text-slate-400">{sb.warehouse_name}</p>
                                                </div>
                                                <div className="w-24">
                                                    <Input
                                                        type="number"
                                                        value={sb.quantity}
                                                        onChange={(e) => handleUpdateBatchQty(idx, e.target.value)}
                                                        className="h-9 font-black text-right"
                                                    />
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => handleRemoveBatch(idx)}
                                                >
                                                    <AlertCircle className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        <DialogFooter className="pt-4">
                            <Button variant="ghost" onClick={() => setIsTransferModalOpen(false)} className="rounded-2xl font-bold h-12 px-6">
                                Cancel
                            </Button>
                            <Button
                                onClick={handleFulfillTransfer}
                                disabled={isSubmitting || selectedBatches.length === 0}
                                className="rounded-2xl font-black h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fulfill Transfer"}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
