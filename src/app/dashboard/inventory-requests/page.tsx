'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Search,
    ArrowLeft,
    Warehouse,
    Package,
    Send,
    AlertCircle,
    Loader2,
    ArrowRight,
    Clock
} from 'lucide-react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

export default function NewInventoryRequestPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { user, hasRole } = useUserContext();
    const isAdmin = hasRole('admin');
    const supabase = createClient();

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [departments, setDepartments] = useState<any[]>([]);
    const [selectedDeptId, setSelectedDeptId] = useState<string>('');
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Request Creation State
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [requestQuantity, setRequestQuantity] = useState('');
    const [requestNotes, setRequestNotes] = useState('');
    const [sourceDeptId, setSourceDeptId] = useState<string>('');

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [deptRes, invRes] = await Promise.all([
                fetch('/api/admin/inventory-departments'),
                fetch('/api/admin/inventory/items?includeStock=true')
            ]);

            const deptData = await deptRes.json();
            const invData = await invRes.json();

            if (deptData.error) throw new Error(deptData.error);
            if (invData.error) throw new Error(invData.error);

            const depts = deptData.departments || [];
            setDepartments(depts);
            setInventoryItems(invData.items || []);

            // Set default department
            if (isAdmin) {
                const store = depts.find((d: any) => d.name?.toLowerCase().includes('store') || d.name?.toLowerCase().includes('warehouse'));
                if (store) {
                    setSelectedDeptId(store.id);
                    setSourceDeptId(store.id);
                }
            } else {
                const userDept = depts.find((d: any) => d.name === user?.department);
                if (userDept) setSelectedDeptId(userDept.id);

                const store = depts.find((d: any) => d.name?.toLowerCase().includes('store') || d.name?.toLowerCase().includes('warehouse'));
                if (store) setSourceDeptId(store.id);
            }

        } catch (error: any) {
            console.error("Error fetching data:", error);
            toast({ variant: 'destructive', title: "Error", description: error.message || "Failed to fetch data." });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const selectedDeptName = useMemo(() => {
        return departments.find(d => d.id === selectedDeptId)?.name || 'Department';
    }, [selectedDeptId, departments]);

    const filteredItems = useMemo(() => {
        const searched = inventoryItems.filter(item =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.code?.toLowerCase().includes(searchQuery.toLowerCase())
        );

        return searched.map(item => {
            const deptStock = item.warehouse_stock?.find((ws: any) =>
                ws.department_id === selectedDeptId ||
                ws.department?.id === selectedDeptId ||
                ws.id === selectedDeptId
            );
            return {
                ...item,
                local_stock: deptStock ? deptStock.total_stock : 0,
                batches: deptStock ? deptStock.batches : []
            };
        }).filter(item => item.local_stock > 0);
    }, [inventoryItems, searchQuery, selectedDeptId]);

    const handleOpenRequest = (item: any) => {
        setSelectedItem(item);
        setRequestQuantity('');
        setRequestNotes('');
        setIsRequestModalOpen(true);
    };

    const handleSubmitRequest = async () => {
        if (!selectedItem || !requestQuantity || Number(requestQuantity) <= 0) {
            toast({ variant: 'destructive', title: "Validation Error", description: "Please enter a valid quantity." });
            return;
        }

        setIsSubmitting(true);
        try {
            const sourceDept = departments.find(d => d.id === sourceDeptId);

            const payload = {
                request_type: 'TRANSFER_REQUEST',
                item_id: selectedItem.id,
                requested_quantity: Number(requestQuantity),
                notes: requestNotes,
                action_metadata: {
                    requesting_department_id: selectedDeptId,
                    requesting_department_name: selectedDeptName,
                    source_warehouse_id: sourceDeptId,
                    source_warehouse_name: sourceDept?.name || 'Store'
                }
            };

            const res = await fetch('/api/admin/inventory-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast({
                title: "Request Created",
                description: `Successfully requested ${requestQuantity} ${selectedItem.unit?.name || 'units'} of ${selectedItem.name}.`,
            });

            setIsRequestModalOpen(false);
            fetchData();
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: error.message || "Failed to create request." });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground font-medium animate-pulse">Initializing request portal...</p>
            </div>
        );
    }

    return (
        <div className="space-y-12 pb-20">
            {/* Header Section */}
            <div className="relative overflow-hidden bg-slate-900 rounded-[3rem] p-12 text-white">
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
                            Inventory Management
                        </Badge>
                    </div>
                    <h1 className="text-5xl font-black mb-4 tracking-tight">Stock Request Portal</h1>
                    <p className="text-xl text-slate-400 max-w-2xl font-medium leading-relaxed">
                        Request items from the Main Store or view your department's inventory status.
                    </p>
                </div>
                <div className="absolute bottom-12 right-12 flex gap-4 z-20">
                    <Button
                        className="bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 rounded-2xl h-14 px-8 font-black gap-2 border-none transition-all hover:scale-[1.02] active:scale-[0.98]"
                        onClick={() => router.push(`/dashboard/inventory-requests/view-history?deptId=${selectedDeptId}`)}
                    >
                        <Clock className="h-5 w-5" />
                        View Approvals & Transfers
                    </Button>
                </div>
            </div>

            {/* Department Selection & Search */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-4">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-widest pl-2">Active Department</label>
                    <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
                        <SelectTrigger className="h-16 rounded-3xl border-slate-200 bg-white shadow-sm font-bold text-lg px-6">
                            <div className="flex items-center gap-3">
                                <Warehouse className="h-5 w-5 text-primary" />
                                <SelectValue placeholder="Select Department" />
                            </div>
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-slate-100 shadow-2xl">
                            {departments.map((dept) => (
                                <SelectItem key={dept.id} value={dept.id} className="h-12 font-bold rounded-xl m-1">
                                    {dept.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="lg:col-span-2 space-y-4">
                    <label className="text-sm font-black text-slate-500 uppercase tracking-widest pl-2">Find Items</label>
                    <div className="relative group">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Search by name or code..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-16 pl-16 pr-6 rounded-3xl border-slate-200 bg-white shadow-sm text-lg font-medium focus:ring-primary/20 transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Items Table (Grid) */}
            <div className="space-y-6">
                <div className="flex items-center justify-between pl-2">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Currently Available Items</h2>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 px-4 py-1.5 rounded-full font-black text-[10px] uppercase tracking-widest">
                        {filteredItems.length} Items with Stock
                    </Badge>
                </div>

                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow className="hover:bg-transparent border-slate-100">
                                <TableHead className="py-6 pl-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Item Details</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Code</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Unit</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Available Stock</TableHead>
                                <TableHead className="text-right pr-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredItems.map((item) => (
                                <TableRow key={item.id} className="group hover:bg-slate-50/30 transition-colors border-slate-50">
                                    <TableCell className="py-5 pl-8">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-primary/5 group-hover:border-primary/20 transition-all">
                                                <Package className="h-6 w-6 text-slate-300 group-hover:text-primary transition-colors" />
                                            </div>
                                            <span className="font-black text-slate-800 text-lg tracking-tight">{item.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="font-black text-[10px] uppercase tracking-widest bg-slate-50 text-slate-400 border-slate-200">
                                            {item.code}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-bold text-slate-500 uppercase text-xs">{item.unit?.name || 'Unit'}</span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-2xl font-black text-slate-800">{item.local_stock}</span>
                                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">In Stock</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right pr-8">
                                        <Button
                                            className="rounded-2xl font-black text-xs h-12 px-8 gap-2 shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all"
                                            onClick={() => handleOpenRequest(item)}
                                        >
                                            <Send className="h-4 w-4" />
                                            Request Stock
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filteredItems.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center">
                                                <Search className="h-8 w-8 text-slate-200" />
                                            </div>
                                            <p className="text-slate-400 font-bold">No available items found matching your criteria.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Request Modal */}
            <Dialog open={isRequestModalOpen} onOpenChange={setIsRequestModalOpen}>
                <DialogContent className="sm:max-w-[500px] rounded-[2.5rem] border-slate-100 p-0 overflow-hidden shadow-2xl">
                    <div className="bg-primary/5 p-8 pb-4">
                        <DialogHeader>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-14 w-14 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-primary/10">
                                    <Send className="h-7 w-7 text-primary" />
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-black text-slate-900">Confirm Request</DialogTitle>
                                    <DialogDescription className="font-medium text-slate-500">
                                        Fulfilling to <span className="text-primary font-bold">{selectedDeptName}</span>
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                    </div>

                    <div className="p-8 pt-6 space-y-8">
                        {selectedItem && (
                            <div className="flex items-center gap-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                <div className="flex-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Requesting Item</p>
                                    <h4 className="text-xl font-black text-slate-800 leading-tight">{selectedItem.name}</h4>
                                    <p className="text-xs font-bold text-slate-500 mt-1">{selectedItem.code} • {selectedItem.unit?.name}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">In Stock</p>
                                    <p className="text-2xl font-black text-slate-800">{selectedItem.local_stock}</p>
                                </div>
                            </div>
                        )}

                        <div className="grid gap-6">
                            <div className="space-y-3">
                                <label className="text-sm font-black text-slate-700 flex items-center gap-2">
                                    Source Warehouse
                                </label>
                                <Select value={sourceDeptId} onValueChange={setSourceDeptId}>
                                    <SelectTrigger className="h-14 rounded-2xl border-slate-200 bg-slate-50 font-bold px-6">
                                        <div className="flex items-center gap-3">
                                            <Warehouse className="h-4 w-4 text-primary" />
                                            <SelectValue placeholder="Select Source" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-slate-100 shadow-2xl">
                                        {departments.filter(d => d.name?.toLowerCase().includes('store') || d.name?.toLowerCase().includes('warehouse')).map((dept) => (
                                            <SelectItem key={dept.id} value={dept.id} className="font-bold rounded-xl m-1">
                                                {dept.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-black text-slate-700 flex items-center gap-2">
                                    Requested Quantity
                                    <AlertCircle className="h-4 w-4 text-slate-300" />
                                </label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        placeholder="0.00"
                                        value={requestQuantity}
                                        onChange={(e) => setRequestQuantity(e.target.value)}
                                        className="h-16 text-2xl font-black bg-slate-50 border-slate-200 rounded-2xl focus:ring-primary/20 focus:border-primary pl-6"
                                    />
                                    <div className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-300 uppercase tracking-widest pointer-events-none">
                                        {selectedItem?.unit?.name || 'Units'}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-black text-slate-700">Reason / Notes (Optional)</label>
                                <Textarea
                                    placeholder="Why is this stock needed?"
                                    value={requestNotes}
                                    onChange={(e) => setRequestNotes(e.target.value)}
                                    className="min-h-[120px] bg-slate-50 border-slate-200 rounded-2xl resize-none p-5 font-medium"
                                />
                            </div>
                        </div>

                        <DialogFooter className="gap-3 sm:gap-0 pt-2">
                            <Button variant="ghost" onClick={() => setIsRequestModalOpen(false)} className="rounded-2xl font-bold h-14 px-8">
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSubmitRequest}
                                disabled={isSubmitting}
                                className="flex-1 rounded-2xl font-black text-lg h-14 gap-2 shadow-lg shadow-primary/20"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        Send Request
                                        <ArrowRight className="h-5 w-5" />
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
