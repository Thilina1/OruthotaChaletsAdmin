'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
    Clock,
    ChevronDown,
    ChevronRight
} from 'lucide-react';
import { format, isBefore, addDays, parseISO } from 'date-fns';
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { KitchenSectionItemMatrix } from '@/components/dashboard/inventory/kitchen-section-item-matrix';

interface StockRequestPortalProps {
    title: string;
    descriptionText: string;
    badgeLabel?: string;
    /** Locks the Active Department picker to the department whose name matches
     * this (case-insensitive), even for admins. Omit for the generic, any-department portal. */
    lockedDepartmentName?: string;
    requestSections?: readonly string[];
    compactHeader?: boolean;
}

const ITEMS_PER_PAGE = 20;

export default function StockRequestPortal({ title, descriptionText, badgeLabel = 'Inventory Management', lockedDepartmentName, requestSections, compactHeader = false }: StockRequestPortalProps) {
    const router = useRouter();
    const { toast } = useToast();
    const { user, hasRole } = useUserContext();
    const isAdmin = (hasRole('admin') || user?.inventory_admin === true) && !lockedDepartmentName;

    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

    const toggleRowExpand = (id: string) => {
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const getExpiryStatus = (expiryDate: string | null) => {
        if (!expiryDate) return { label: 'No Expiry', color: 'text-slate-400' };
        const date = parseISO(expiryDate);
        const now = new Date();
        const formattedDate = format(date, 'MMM dd, yyyy');

        if (isBefore(date, now)) return { label: `Expired (${formattedDate})`, color: 'text-red-600 font-bold' };
        if (isBefore(date, addDays(now, 7))) return { label: formattedDate, color: 'text-orange-600 font-bold' };
        if (isBefore(date, addDays(now, 30))) return { label: formattedDate, color: 'text-amber-500' };

        return { label: formattedDate, color: 'text-emerald-600' };
    };

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [departments, setDepartments] = useState<any[]>([]);
    const [selectedDeptId, setSelectedDeptId] = useState<string>('');
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [portalTab, setPortalTab] = useState<'request' | 'assignments'>('request');
    const [sectionAssignments, setSectionAssignments] = useState<Array<{ id: string; section: string; item_id: string }>>([]);

    // Request Creation State
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [requestQuantity, setRequestQuantity] = useState('');
    const [requestNotes, setRequestNotes] = useState('');
    const [sourceDeptId, setSourceDeptId] = useState<string>('');
    const [selectedRequestSection, setSelectedRequestSection] = useState(requestSections?.[0] || '');

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [deptRes, invRes] = await Promise.all([
                fetch('/api/admin/inventory-departments?all=true'),
                fetch('/api/admin/inventory/items?includeStock=true')
            ]);

            const deptData = await deptRes.json();
            const invData = await invRes.json();

            if (deptData.error) throw new Error(deptData.error);
            if (invData.error) throw new Error(invData.error);

            const depts = deptData.departments || [];
            setDepartments(depts);
            setInventoryItems(invData.items || []);

            // Select default department using the freshly fetched list.
            // user is always loaded before this page renders (UserContext shows loading skeleton).
            const isStore = (d: any) =>
                d.name?.toLowerCase().includes('store') || d.name?.toLowerCase().includes('warehouse');
            const store = depts.find(isStore);
            if (store) setSourceDeptId(store.id);

            const adminUser = (user?.role === 'admin' && !user?.restrict_admin_permissions) || user?.inventory_admin === true;
            if (lockedDepartmentName) {
                const locked = depts.find((d: any) => d.name?.toLowerCase().trim() === lockedDepartmentName.toLowerCase().trim());
                if (locked) setSelectedDeptId(locked.id);
            } else if (adminUser) {
                // prefer a store/warehouse dept, fall back to first dept
                const adminDefault = store ?? depts[0];
                if (adminDefault) setSelectedDeptId(adminDefault.id);
            } else {
                const userDeptName = (user?.department ?? '').toLowerCase().trim();
                const match =
                    (userDeptName && depts.find((d: any) => d.name?.toLowerCase().trim() === userDeptName)) ||
                    (userDeptName && depts.find((d: any) => d.name?.toLowerCase().includes(userDeptName) || userDeptName.includes(d.name?.toLowerCase().trim()))) ||
                    depts.find((d: any) => !isStore(d)) ||
                    depts[0];
                if (match) setSelectedDeptId(match.id);
            }

        } catch (error: any) {
            console.error("Error fetching data:", error);
            toast({ variant: 'destructive', title: "Error", description: error.message || "Failed to fetch data." });
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSectionAssignments = async () => {
        if (!requestSections?.length) return;
        try {
            const res = await fetch('/api/admin/inventory/kitchen-section-items', { cache: 'no-store' });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'Failed to load Kitchen assignments.');
            setSectionAssignments(data.assignments || []);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Kitchen Assignments Unavailable', description: error.message });
        }
    };

    useEffect(() => {
        if (user) {
            fetchData();
            fetchSectionAssignments();
        }
    }, [user?.id]);

    // Fallback: if departments loaded but nothing was matched, pick first non-store dept.
    // Skipped when locked to a specific department — better to show "not found" than silently switch.
    useEffect(() => {
        if (!departments.length || selectedDeptId || lockedDepartmentName) return;
        const isStore = (d: any) =>
            d.name?.toLowerCase().includes('store') || d.name?.toLowerCase().includes('warehouse');
        const fallback = departments.find((d: any) => !isStore(d)) ?? departments[0];
        if (fallback) setSelectedDeptId(fallback.id);
    }, [departments.length, selectedDeptId, lockedDepartmentName]);


    const selectedDeptName = useMemo(() => {
        return departments.find(d => d.id === selectedDeptId)?.name || 'Department';
    }, [selectedDeptId, departments]);

    const departmentItems = useMemo(() => {
        return inventoryItems.map(item => {
            const selectedDeptNameLower = selectedDeptName.toLowerCase();
            const deptStock = item.warehouse_stock?.find((ws: any) =>
                ws.department_id === selectedDeptId ||       // FK match (ideal)
                ws.department?.id === selectedDeptId ||      // nested object match
                ws.id === selectedDeptId ||                  // warehouse id match
                ws.name?.toLowerCase() === selectedDeptNameLower ||  // name match fallback
                ws.department?.name?.toLowerCase() === selectedDeptNameLower
            );

            if (!deptStock) return null;

            return {
                ...item,
                local_stock: deptStock ? deptStock.total_stock : 0,
                batches: deptStock ? deptStock.batches : []
            };
        }).filter((item): item is any => item !== null);
    }, [inventoryItems, selectedDeptId, selectedDeptName]);

    const filteredItems = useMemo(() => {
        const assignedItemIds = new Set(
            sectionAssignments
                .filter(assignment => assignment.section === selectedRequestSection)
                .map(assignment => assignment.item_id)
        );
        return departmentItems.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.code?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesSection = !requestSections?.length || assignedItemIds.has(item.id);
            return matchesSearch && matchesSection;
        });
    }, [departmentItems, searchQuery, requestSections, sectionAssignments, selectedRequestSection]);

    const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
    const paginatedItems = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredItems.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredItems, currentPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedDeptId]);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

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
                    source_warehouse_name: sourceDept?.name || 'Store',
                    ...(selectedRequestSection ? { request_section: selectedRequestSection } : {}),
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
        <div className="space-y-4 pb-10">
            {/* Header Section */}
            <div className={cn("relative overflow-hidden bg-slate-900 text-white", compactHeader ? "rounded-2xl p-4 md:p-5" : "rounded-[2rem] p-8")}>
                <div className={cn("absolute top-0 right-0 bg-primary/20 rounded-full blur-[100px]", compactHeader ? "-mr-12 -mt-12 h-40 w-40" : "-mr-20 -mt-20 h-64 w-64")} />
                <div className="relative z-10">
                    <div className={cn("flex items-center", compactHeader ? "gap-2 mb-3" : "gap-4 mb-6")}>
                        <Button
                            variant="ghost"
                            className={cn("text-white/60 hover:text-white hover:bg-white/10 rounded-xl", compactHeader && "h-8 px-2 text-xs")}
                            onClick={() => router.back()}
                        >
                            <ArrowLeft className="h-5 w-5 mr-2" />
                            Back
                        </Button>
                        <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary px-4 py-1 rounded-full font-black text-[10px] uppercase tracking-widest">
                            {badgeLabel}
                        </Badge>
                    </div>
                    <h1 className={cn("font-black tracking-tight", compactHeader ? "text-xl mb-1" : "text-3xl mb-2")}>{title}</h1>
                    <p className={cn("text-slate-400 max-w-2xl font-medium leading-tight", compactHeader ? "text-sm pr-0 md:pr-44" : "text-lg")}>
                        {descriptionText}
                    </p>
                </div>
                {!lockedDepartmentName && (
                    <div className={cn("flex gap-4 z-20", compactHeader ? "mt-4 md:mt-0 md:absolute md:bottom-5 md:right-5" : "absolute bottom-8 right-8")}>
                        <Button
                            className={cn("bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 font-black gap-2 border-none transition-all hover:scale-[1.02] active:scale-[0.98]", compactHeader ? "rounded-xl h-9 px-4 text-xs" : "rounded-2xl h-12 px-6")}
                            onClick={() => router.push(`/dashboard/inventory-requests/view-history?deptId=${selectedDeptId}`)}
                        >
                            <Clock className="h-5 w-5" />
                            View History
                        </Button>
                    </div>
                )}
            </div>

            {requestSections && requestSections.length > 0 && (
                <div className="grid w-full grid-cols-2 rounded-xl bg-slate-100 p-1 sm:w-fit">
                    <Button type="button" variant={portalTab === 'request' ? 'default' : 'ghost'} className="font-bold" onClick={() => setPortalTab('request')}>
                        🍽️ Request Items
                    </Button>
                    <Button type="button" variant={portalTab === 'assignments' ? 'default' : 'ghost'} className="font-bold" onClick={() => setPortalTab('assignments')}>
                        👨‍🍳 Kitchen Assigned Items
                    </Button>
                </div>
            )}

            {portalTab === 'assignments' && requestSections && (
                <KitchenSectionItemMatrix
                    items={departmentItems}
                    sections={requestSections}
                    assignments={sectionAssignments}
                    onRefresh={fetchSectionAssignments}
                />
            )}

            {/* Department Selection & Search */}
            <div className={cn("grid grid-cols-1 lg:grid-cols-3 gap-8", portalTab === 'assignments' && "hidden")}>
                <div className="lg:col-span-1 space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Active Department</label>
                    {isAdmin ? (
                        <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
                            <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-white shadow-sm font-bold text-base px-4">
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
                    ) : (
                        <div className="h-12 rounded-2xl border border-slate-200 bg-slate-50 shadow-sm font-bold text-base px-4 flex items-center gap-3 cursor-not-allowed select-none">
                            <Warehouse className="h-5 w-5 text-primary shrink-0" />
                            <span className="text-slate-700 truncate">
                                {lockedDepartmentName ? (selectedDeptName || 'No Department Assigned') : (user?.department || 'No Department Assigned')}
                            </span>
                        </div>
                    )}
                    {requestSections && requestSections.length > 0 && (
                        <div className="space-y-2 pt-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Kitchen Request Section</label>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {requestSections.map(section => (
                                    <Button
                                        key={section}
                                        type="button"
                                        variant={selectedRequestSection === section ? 'default' : 'outline'}
                                        className="h-9 shrink-0 px-3 text-xs font-bold"
                                        onClick={() => setSelectedRequestSection(section)}
                                    >
                                        {section}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="lg:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Find Items</label>
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Search by name or code..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-12 pl-12 pr-4 rounded-2xl border-slate-200 bg-white shadow-sm text-base font-medium focus:ring-primary/20 transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Items Table (Grouped, with batch-level detail like Inventory Stock Overview) */}
            <div className={cn("space-y-4", portalTab === 'assignments' && "hidden")}>
                <div className="flex items-center justify-between pl-2">
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Department Inventory</h2>
                    <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 px-3 py-1 rounded-full font-black text-[10px] uppercase tracking-widest">
                        {filteredItems.length} Total Items
                    </Badge>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <Table className="text-xs">
                        <TableHeader className="bg-slate-50/50">
                            <TableRow className="hover:bg-transparent border-slate-100">
                                <TableHead className="py-6 pl-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Item Details</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Batch No</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Expiry Date</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Available Stock</TableHead>
                                <TableHead className="text-right pr-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedItems.map((item) => (
                                <React.Fragment key={item.id}>
                                    <TableRow
                                        className="group bg-slate-50/50 hover:bg-slate-100/60 transition-colors border-slate-100 cursor-pointer"
                                        onClick={() => toggleRowExpand(item.id)}
                                    >
                                        <TableCell className="py-3 pl-6" colSpan={3}>
                                            <div className="flex items-center gap-3">
                                                <div className="text-slate-400 shrink-0">
                                                    {expandedRows[item.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                </div>
                                                <div className="h-9 w-9 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-primary/5 group-hover:border-primary/20 transition-all shrink-0">
                                                    <Package className="h-4 w-4 text-slate-300 group-hover:text-primary transition-colors" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-800 text-sm tracking-tight">{item.name}</span>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <Badge variant="outline" className="font-black text-[10px] uppercase tracking-widest bg-slate-50 text-slate-400 border-slate-200">
                                                            {item.code}
                                                        </Badge>
                                                        <span className="font-bold text-slate-400 uppercase text-[10px]">{item.unit?.name || 'Unit'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className={cn("text-base font-black", item.local_stock > 0 ? "text-slate-800" : "text-slate-300")}>{item.local_stock}</span>
                                                <span className={cn("text-[10px] font-black uppercase tracking-widest", item.local_stock > 0 ? "text-emerald-500" : "text-slate-400")}>
                                                    {item.local_stock > 0 ? 'In Stock' : 'Out of Stock'}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right pr-8">
                                            <Button
                                                className="rounded-xl font-black text-[11px] h-9 px-4 gap-2 shadow-sm shadow-primary/10 hover:shadow-primary/20 transition-all"
                                                onClick={(e) => { e.stopPropagation(); handleOpenRequest(item); }}
                                            >
                                                <Send className="h-4 w-4" />
                                                Request Stock
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                    {expandedRows[item.id] && (
                                        (item.batches && item.batches.filter((b: any) => Number(b.quantity) > 0).length > 0) ? (
                                            item.batches.filter((b: any) => Number(b.quantity) > 0).map((batch: any, bIdx: number) => (
                                                <TableRow key={`${item.id}-${bIdx}`} className="hover:bg-slate-50/30 transition-colors border-l-4 border-l-primary/10">
                                                    <TableCell className="pl-16">
                                                        <span className="text-xs text-slate-400 font-bold">Batch</span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="font-mono text-[10px] bg-slate-50 text-slate-600 px-1.5">
                                                            {batch.batch_number || '—'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className={cn("text-xs font-bold", getExpiryStatus(batch.expiry_date).color)}>
                                                            {getExpiryStatus(batch.expiry_date).label}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-sm font-black text-slate-800">{batch.quantity}</span>
                                                            <span className="text-[10px] text-muted-foreground font-bold">{item.unit?.name}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell />
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow className="border-l-4 border-l-primary/10">
                                                <TableCell colSpan={5} className="pl-16 py-4 text-xs text-slate-400 italic">
                                                    No stock available for this item.
                                                </TableCell>
                                            </TableRow>
                                        )
                                    )}
                                </React.Fragment>
                            ))}
                            {filteredItems.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center">
                                                <Search className="h-8 w-8 text-slate-200" />
                                            </div>
                                            <p className="text-slate-400 font-bold">
                                                {requestSections?.length ? `No items are assigned to ${selectedRequestSection}. Use Kitchen Assigned Items to initialize them.` : 'No available items found matching your criteria.'}
                                            </p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    {filteredItems.length > 0 && (
                        <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                            <span>
                                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)} of {filteredItems.length} items
                            </span>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                                >
                                    Previous
                                </Button>
                                <span className="min-w-20 text-center font-semibold text-slate-600">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
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
                                    {selectedRequestSection && (
                                        <Badge variant="outline" className="mt-2 border-primary/30 bg-primary/5 text-[10px] text-primary">
                                            {selectedRequestSection}
                                        </Badge>
                                    )}
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
