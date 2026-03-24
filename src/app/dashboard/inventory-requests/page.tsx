'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Printer, Loader2 } from "lucide-react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserContext } from '@/context/user-context';
import { format } from 'date-fns';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { cn } from "@/lib/utils";

export default function InventoryRequestsPage() {
    const { toast } = useToast();
    const { user, hasPathAccess } = useUserContext();
    const canManageRequests = user?.role === 'admin' || hasPathAccess('/dashboard/inventory-requests');
    const [requests, setRequests] = useState<any[]>([]);
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionData, setActionData] = useState<{ id: string, status: 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'EDIT', requestType?: string, requestedQuantity?: number, itemId?: string, itemName?: string, itemCategory?: string, currentNotes?: string, currentStatus?: string } | null>(null);
    const [actualCost, setActualCost] = useState<string>('');
    const [receivedQuantity, setReceivedQuantity] = useState<string>('');
    const [itemPrice, setItemPrice] = useState<string>('');
    const [editNotes, setEditNotes] = useState<string>('');
    const [filterDate, setFilterDate] = useState<string>('');
    const [activeTab, setActiveTab] = useState<string>('transfer');
    const [isCreatePOOpen, setIsCreatePOOpen] = useState(false);
    const [poSupplierName, setPoSupplierName] = useState('');
    const [isCreatingPO, setIsCreatingPO] = useState(false);
    const [createdPO, setCreatedPO] = useState<{ po_number: string; supplier_name: string | null; created_at: string } | null>(null);
    const [createdPOItems, setCreatedPOItems] = useState<any[]>([]); // items in the last printed PO
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

    const fetchRequests = async () => {
        setIsLoading(true);
        try {
            const [reqRes, invRes] = await Promise.all([
                fetch('/api/admin/inventory-requests'),
                fetch('/api/admin/hotel-inventory')
            ]);
            const reqData = await reqRes.json();
            const invData = await invRes.json();

            if (reqData.error) throw new Error(reqData.error);
            if (invData.error) throw new Error(invData.error);

            setRequests(reqData.requests || []);
            setInventoryItems(invData.items || []);
        } catch (error) {
            console.error("Error fetching requests:", error);
            toast({ variant: 'destructive', title: "Error", description: "Failed to fetch inventory requests." });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const filteredRequests = requests.filter(req => {
        const matchesDate = !filterDate || new Date(req.created_at).toISOString().split('T')[0] === filterDate;
        if (!matchesDate) return false;

        if (activeTab === 'transfer') {
            return req.request_type === 'TRANSFER_REQUEST';
        } else {
            return req.request_type === 'ADD_STOCK' || req.request_type === 'NEW_ITEM';
        }
    });

    const isWarehouseUser = user?.role === 'admin' || (user?.department && (
        user.department.toLowerCase().includes('warehouse') ||
        user.department.toLowerCase().includes('wearehouse') ||
        user.department.toLowerCase() === 'store'
    ));

    const {
        currentPage,
        totalPages,
        totalItems,
        paginatedItems,
        itemsPerPage,
        setCurrentPage,
    } = usePagination(filteredRequests, 20);

    useEffect(() => {
        setCurrentPage(1);
    }, [filterDate, setCurrentPage]);

    const handleAction = async () => {
        if (!actionData) return;
        try {
            const payload: any = { id: actionData.id, status: actionData.status === 'EDIT' ? actionData.currentStatus : actionData.status };
            if (actionData.status === 'COMPLETED') {
                if (actualCost) payload.actual_cost = parseFloat(actualCost);
                if (receivedQuantity) payload.received_quantity = parseFloat(receivedQuantity);
                if (itemPrice) payload.item_price = parseFloat(itemPrice);
            }
            if (actionData.status === 'APPROVED' || actionData.status === 'EDIT') {
                if (receivedQuantity) payload.requested_quantity = parseFloat(receivedQuantity);
                if (editNotes !== actionData.currentNotes) payload.notes = editNotes;
            }

            const res = await fetch('/api/admin/inventory-requests', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast({
                title: actionData.status === 'EDIT' ? "Request Updated" : actionData.status === 'APPROVED' ? "Request Approved" : actionData.status === 'COMPLETED' ? "Stock Received" : "Request Rejected",
                description: `The inventory request has been ${actionData.status === 'EDIT' ? 'updated' : actionData.status.toLowerCase()}.`,
            });
            fetchRequests();
        } catch (error) {
            console.error("Error updating request:", error);
            toast({ variant: 'destructive', title: "Error", description: "Failed to update request." });
        } finally {
            setActionData(null);
            setActualCost('');
            setReceivedQuantity('');
            setItemPrice('');
            setEditNotes('');
        }
    };

    const handleConvertToExternal = async () => {
        if (!actionData) return;
        try {
            const res = await fetch('/api/admin/inventory-requests', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: actionData.id,
                    status: 'APPROVED',
                    request_type: 'ADD_STOCK',
                    requested_quantity: receivedQuantity ? parseFloat(receivedQuantity) : actionData.requestedQuantity
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast({
                title: "Convered to Purchase",
                description: "The request has been converted to an external purchase request.",
            });
            fetchRequests();
        } catch (error) {
            console.error("Error converting request:", error);
            toast({ variant: 'destructive', title: "Error", description: "Failed to convert request." });
        } finally {
            setActionData(null);
            setReceivedQuantity('');
        }
    };

    // Exclude items already linked to a purchase order (DB-persisted)
    const approvedStockItems = filteredRequests.filter(
        req => req.request_type === 'ADD_STOCK' && req.status === 'APPROVED' && !req.purchase_order_id
    );

    const handleCreateAndPrintPO = async () => {
        const selectedItems = approvedStockItems.filter(req => selectedItemIds.has(req.id));
        if (selectedItems.length === 0) {
            toast({ variant: 'destructive', title: 'No Items Selected', description: 'Please select at least one item.' });
            return;
        }
        setIsCreatingPO(true);
        try {
            const res = await fetch('/api/admin/purchase-orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    supplier_name: poSupplierName || undefined,
                    request_ids: selectedItems.map(req => req.id),
                    items: selectedItems.map(req => ({
                        item_id: req.item_id || null,
                        item_name: req.item?.name || req.notes || 'Unknown Item',
                        unit: req.item?.unit || 'units',
                        quantity: req.requested_quantity,
                    })),
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            // Store the exact selected items for the print area
            setCreatedPOItems(selectedItems);
            setCreatedPO({ po_number: data.purchase_order.po_number, supplier_name: poSupplierName || null, created_at: data.purchase_order.created_at });
            setIsCreatePOOpen(false);
            setPoSupplierName('');
            toast({ title: 'Purchase Order Created', description: `${data.purchase_order.po_number} saved successfully.` });
            setTimeout(() => window.print(), 300);
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setIsCreatingPO(false);
        }
    };

    const getRequestTypeLabel = (type: string) => {
        switch (type) {
            case 'NEW_ITEM': return 'New Item';
            case 'ADD_STOCK': return 'Add Stock';
            case 'TRANSFER_REQUEST': return 'Transfer Request';
            case 'receive': return 'Receive Stock';
            case 'issue': return 'Issue Stock';
            case 'damage': return 'Damage/Wastage';
            case 'audit_adjustment': return 'Audit Adjustment';
            case 'initial_stock': return 'Initial Stock';
            default: return type;
        }
    };

    const getRequestTypeColor = (type: string) => {
        if (type === 'NEW_ITEM') return 'text-primary border-primary';
        if (['issue', 'damage', 'TRANSFER_REQUEST'].includes(type)) return 'text-red-500 border-red-200';
        if (['receive', 'ADD_STOCK', 'initial_stock'].includes(type)) return 'text-green-600 border-green-200';
        return 'text-orange-500 border-orange-200';
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Inventory Requests</h1>
                    <p className="text-muted-foreground">Manage and review incoming stock and product purchase requests.</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground hidden sm:inline">Filter:</span>
                    <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background py-2 px-3 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    {filterDate && (
                        <Button variant="ghost" size="icon" onClick={() => setFilterDate('')} title="Clear Date">
                            &times;
                        </Button>
                    )}
                    <Button variant="outline" onClick={() => {
                        setIsCreatePOOpen(true);
                        setSelectedItemIds(new Set(approvedStockItems.map(r => r.id)));
                    }} className="gap-2">
                        <Printer className="h-4 w-4" />
                        <span className="hidden sm:inline">Print Purchase Order</span>
                    </Button>
                </div>
            </div>

            {/* Create Purchase Order Dialog */}
            <Dialog open={isCreatePOOpen} onOpenChange={(open) => { setIsCreatePOOpen(open); if (!open) setPoSupplierName(''); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Printer className="h-5 w-5 text-primary" />
                            Create &amp; Print Purchase Order
                        </DialogTitle>
                        <DialogDescription>
                            {approvedStockItems.length > 0
                                ? 'Select the items to include, optionally enter a supplier name, then create and print.'
                                : 'No approved stock requests found. Please approve some requests on the Buy Products tab first.'}
                        </DialogDescription>
                    </DialogHeader>
                    {approvedStockItems.length > 0 && (
                        <div className="space-y-4 py-2">
                            <div>
                                <label className="block text-sm font-medium mb-1">Supplier Name <span className="text-muted-foreground text-xs">(optional)</span></label>
                                <Input placeholder="e.g. ABC Suppliers" value={poSupplierName} onChange={e => setPoSupplierName(e.target.value)} />
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-sm font-medium">Select Items ({selectedItemIds.size} of {approvedStockItems.length} selected)</p>
                                    <button
                                        className="text-xs text-primary hover:underline"
                                        onClick={() => {
                                            if (selectedItemIds.size === approvedStockItems.length) {
                                                setSelectedItemIds(new Set());
                                            } else {
                                                setSelectedItemIds(new Set(approvedStockItems.map(r => r.id)));
                                            }
                                        }}
                                    >
                                        {selectedItemIds.size === approvedStockItems.length ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>
                                <div className="rounded-md border divide-y max-h-56 overflow-y-auto">
                                    {approvedStockItems.map(req => (
                                        <label
                                            key={req.id}
                                            className="flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer hover:bg-muted/50 transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-gray-300 accent-primary"
                                                checked={selectedItemIds.has(req.id)}
                                                onChange={e => {
                                                    setSelectedItemIds(prev => {
                                                        const next = new Set(prev);
                                                        if (e.target.checked) next.add(req.id);
                                                        else next.delete(req.id);
                                                        return next;
                                                    });
                                                }}
                                            />
                                            <span className="flex-1 font-medium">{req.item?.name || req.notes || 'Unknown'}</span>
                                            <span className="text-muted-foreground shrink-0">{req.requested_quantity} {req.item?.unit || 'units'}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setIsCreatePOOpen(false); setPoSupplierName(''); }}>Cancel</Button>
                        <Button
                            onClick={handleCreateAndPrintPO}
                            disabled={isCreatingPO || selectedItemIds.size === 0}
                            className="gap-2"
                        >
                            {isCreatingPO ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                            {isCreatingPO ? 'Creating...' : `Create & Print (${selectedItemIds.size})`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Tabs defaultValue="transfer" value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="transfer">Internal Transfer</TabsTrigger>
                    <TabsTrigger value="buy">Buy Products (External)</TabsTrigger>
                </TabsList>

                <TabsContent value="transfer" className="mt-0">
                    <div className="rounded-md border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date Requested</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Item Details</TableHead>
                                    <TableHead>From Store</TableHead>
                                    <TableHead>Requested By</TableHead>
                                    <TableHead>Status</TableHead>
                                    {canManageRequests && <TableHead className="text-right">Actions</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-10">Loading...</TableCell>
                                    </TableRow>
                                ) : (!paginatedItems || paginatedItems.length === 0) ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No transfer requests found.</TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedItems.map((req) => (
                                        <TableRow key={req.id}>
                                            <TableCell className="font-medium whitespace-nowrap">
                                                {format(new Date(req.created_at), 'PPP')}
                                                <div className="text-xs text-muted-foreground">{format(new Date(req.created_at), 'p')}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={getRequestTypeColor(req.request_type)}>
                                                    {getRequestTypeLabel(req.request_type)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium">
                                                    {req.item?.name}
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    - {req.requested_quantity} {req.item?.unit || 'units'}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="font-normal">
                                                    Store
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {req.requester?.name || 'Unknown User'}
                                                <div className="text-xs text-muted-foreground text-ellipsis overflow-hidden max-w-[150px]">{req.requester?.email}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={
                                                    req.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                                                        req.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                                                            req.status === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                                                }>
                                                    {req.status}
                                                </Badge>
                                                {req.reviewer && (
                                                    <div className="text-[10px] text-muted-foreground mt-1">
                                                        Reviewed by {req.reviewer.name}
                                                    </div>
                                                )}
                                            </TableCell>
                                            {canManageRequests && (
                                                <TableCell className="text-right space-x-2">
                                                    {req.status === 'PENDING' ? (
                                                        <>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="text-green-600 border-green-200 hover:bg-green-50"
                                                                onClick={() => {
                                                                    setActionData({
                                                                        id: req.id,
                                                                        status: 'APPROVED',
                                                                        requestType: req.request_type,
                                                                        requestedQuantity: req.requested_quantity,
                                                                        itemId: req.item_id,
                                                                        itemName: req.item?.name,
                                                                        itemCategory: req.item?.category
                                                                    });
                                                                    setReceivedQuantity(String(req.requested_quantity));
                                                                }}
                                                            >
                                                                Approve
                                                            </Button>
                                                            <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setActionData({ id: req.id, status: 'REJECTED' })}>Reject</Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => {
                                                                    setActionData({
                                                                        id: req.id,
                                                                        status: 'EDIT',
                                                                        currentStatus: req.status,
                                                                        requestedQuantity: req.requested_quantity,
                                                                        currentNotes: req.notes || '',
                                                                        itemName: req.item?.name
                                                                    });
                                                                    setReceivedQuantity(String(req.requested_quantity));
                                                                    setEditNotes(req.notes || '');
                                                                }}
                                                            >
                                                                Edit
                                                            </Button>
                                                        </>
                                                    ) : req.status === 'APPROVED' ? (
                                                        <div className="flex gap-2 justify-end">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => {
                                                                    setActionData({
                                                                        id: req.id,
                                                                        status: 'EDIT',
                                                                        currentStatus: req.status,
                                                                        requestedQuantity: req.requested_quantity,
                                                                        currentNotes: req.notes || '',
                                                                        itemName: req.item?.name
                                                                    });
                                                                    setReceivedQuantity(String(req.requested_quantity));
                                                                    setEditNotes(req.notes || '');
                                                                }}
                                                            >
                                                                Edit
                                                            </Button>
                                                            <Button variant="default" size="sm" onClick={() => {
                                                                setActionData({ id: req.id, status: 'COMPLETED', requestType: req.request_type, requestedQuantity: req.requested_quantity });
                                                                setReceivedQuantity(String(req.requested_quantity));
                                                            }}>Issue Stock</Button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic">No actions</span>
                                                    )}
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                        {!isLoading && (
                            <div className="p-4 border-t border-border">
                                <DataTablePagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    totalItems={totalItems}
                                    itemsPerPage={itemsPerPage}
                                    onPageChange={setCurrentPage}
                                />
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="buy" className="mt-0">
                    {!isWarehouseUser ? (
                        <div className="rounded-md border bg-muted/20 p-12 text-center">
                            <h3 className="text-lg font-semibold mb-2">Restricted Access</h3>
                            <p className="text-muted-foreground">Only the Store management can handle external product purchases and buy requests.</p>
                        </div>
                    ) : (
                        <div className="rounded-md border bg-card">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date Requested</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Item Details</TableHead>
                                        <TableHead>Requested By</TableHead>
                                        <TableHead>Status</TableHead>
                                        {canManageRequests && <TableHead className="text-right">Actions</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-10">Loading...</TableCell>
                                        </TableRow>
                                    ) : (!paginatedItems || paginatedItems.length === 0) ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No purchase requests found.</TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedItems.map((req) => (
                                            <TableRow key={req.id}>
                                                <TableCell className="font-medium whitespace-nowrap">
                                                    {format(new Date(req.created_at), 'PPP')}
                                                    <div className="text-xs text-muted-foreground">{format(new Date(req.created_at), 'p')}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={getRequestTypeColor(req.request_type)}>
                                                        {getRequestTypeLabel(req.request_type)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-medium">
                                                        {req.request_type === 'NEW_ITEM' ? (req.notes || 'Unknown Item') : req.item?.name}
                                                    </div>
                                                    {req.request_type !== 'NEW_ITEM' && (
                                                        <div className="text-xs text-muted-foreground mt-0.5">
                                                            + {req.requested_quantity} {req.item?.unit || 'units'}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {req.requester?.name || 'Unknown User'}
                                                    <div className="text-xs text-muted-foreground">{req.requester?.email}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={
                                                        req.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                                                            req.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                                                                req.status === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                                                    }>
                                                        {req.status}
                                                    </Badge>
                                                    {req.reviewer && (
                                                        <div className="text-[10px] text-muted-foreground mt-1">
                                                            Reviewed by {req.reviewer.name}
                                                        </div>
                                                    )}
                                                    {req.action_metadata?.actual_cost && (
                                                        <div className="text-[10px] font-semibold mt-1">
                                                            LKR {req.action_metadata.actual_cost}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                {canManageRequests && (
                                                    <TableCell className="text-right space-x-2">
                                                        {req.status === 'PENDING' ? (
                                                            <>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="text-green-600 border-green-200 hover:bg-green-50"
                                                                    onClick={() => {
                                                                        setActionData({
                                                                            id: req.id,
                                                                            status: 'APPROVED',
                                                                            requestType: req.request_type,
                                                                            requestedQuantity: req.requested_quantity,
                                                                            itemId: req.item_id,
                                                                            itemName: req.item?.name,
                                                                            itemCategory: req.item?.category
                                                                        });
                                                                        setReceivedQuantity(String(req.requested_quantity));
                                                                    }}
                                                                >
                                                                    Approve
                                                                </Button>
                                                                <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setActionData({ id: req.id, status: 'REJECTED' })}>Reject</Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setActionData({
                                                                            id: req.id,
                                                                            status: 'EDIT',
                                                                            currentStatus: req.status,
                                                                            requestedQuantity: req.requested_quantity,
                                                                            currentNotes: req.notes || '',
                                                                            itemName: req.item?.name || req.notes
                                                                        });
                                                                        setReceivedQuantity(String(req.requested_quantity));
                                                                        setEditNotes(req.notes || '');
                                                                    }}
                                                                >
                                                                    Edit
                                                                </Button>
                                                            </>
                                                        ) : req.status === 'APPROVED' && (req.request_type === 'ADD_STOCK') ? (
                                                            <div className="flex gap-2 justify-end">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setActionData({
                                                                            id: req.id,
                                                                            status: 'EDIT',
                                                                            currentStatus: req.status,
                                                                            requestedQuantity: req.requested_quantity,
                                                                            currentNotes: req.notes || '',
                                                                            itemName: req.item?.name
                                                                        });
                                                                        setReceivedQuantity(String(req.requested_quantity));
                                                                        setEditNotes(req.notes || '');
                                                                    }}
                                                                >
                                                                    Edit
                                                                </Button>
                                                                <Button variant="default" size="sm" onClick={() => {
                                                                    setActionData({ id: req.id, status: 'COMPLETED', requestType: req.request_type, requestedQuantity: req.requested_quantity });
                                                                    setReceivedQuantity(String(req.requested_quantity));
                                                                }}>Receive Stock</Button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground italic">No actions</span>
                                                        )}
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                            {!isLoading && (
                                <div className="p-4 border-t border-border">
                                    <DataTablePagination
                                        currentPage={currentPage}
                                        totalPages={totalPages}
                                        totalItems={totalItems}
                                        itemsPerPage={itemsPerPage}
                                        onPageChange={setCurrentPage}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            <AlertDialog open={!!actionData} onOpenChange={(open) => {
                if (!open) {
                    setActionData(null);
                    setActualCost('');
                    setReceivedQuantity('');
                    setItemPrice('');
                    setEditNotes('');
                }
            }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {actionData?.status === 'COMPLETED' ? 'Issue Stock / complete Request' :
                                actionData?.status === 'APPROVED' ? 'Confirm Approval' :
                                    actionData?.status === 'EDIT' ? `Edit Request: ${actionData.itemName}` : 'Are you sure?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {actionData?.status === 'COMPLETED'
                                ? (actionData.requestType === 'TRANSFER_REQUEST'
                                    ? 'Confirm the quantity being issued from the Store. This will update stock levels for both the Store and the requesting department.'
                                    : 'Enter the actual total cost of the items purchased to complete this request and update the inventory stock.')
                                : actionData?.status === 'APPROVED'
                                    ? 'Review and approve this invitation. You can adjust the quantity if needed.'
                                    : actionData?.status === 'EDIT'
                                        ? 'Modify the requested quantity or notes for this request.'
                                        : `This will mark the request as ${actionData?.status.toLowerCase()}.`
                            }
                            {actionData?.status === 'APPROVED' && actionData?.requestType === 'ADD_STOCK' && ' This will add the items to the Purchase Order so they can be purchased.'}
                            {actionData?.status === 'REJECTED' && ' This action cannot be undone.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {actionData?.status === 'COMPLETED' && (
                        <div className="py-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    {actionData.requestType === 'TRANSFER_REQUEST' ? 'Issued Quantity' : 'Received Quantity'}
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={receivedQuantity}
                                    onChange={(e) => {
                                        setReceivedQuantity(e.target.value);
                                        if (actionData.requestType !== 'TRANSFER_REQUEST' && itemPrice && e.target.value) {
                                            setActualCost((parseFloat(e.target.value) * parseFloat(itemPrice)).toFixed(2));
                                        }
                                    }}
                                />
                            </div>
                            {actionData.requestType !== 'TRANSFER_REQUEST' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Unit Item Price (LKR)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            value={itemPrice}
                                            onChange={(e) => {
                                                setItemPrice(e.target.value);
                                                if (receivedQuantity && e.target.value) {
                                                    setActualCost((parseFloat(receivedQuantity) * parseFloat(e.target.value)).toFixed(2));
                                                }
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Total Actual Cost (LKR)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            placeholder="e.g. 1500.00"
                                            value={actualCost}
                                            onChange={(e) => setActualCost(e.target.value)}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {(actionData?.status === 'APPROVED' || actionData?.status === 'EDIT') && (
                        <div className="py-2 space-y-4">
                            {actionData.status === 'APPROVED' && actionData.requestType === 'TRANSFER_REQUEST' && (() => {
                                const warehouseItem = inventoryItems.find(item => {
                                    if (item.name !== actionData.itemName) return false;
                                    
                                    const deptName = item.department?.name?.toLowerCase() || '';
                                    return deptName === 'store' || 
                                           deptName === 'warehouse' || 
                                           deptName === 'store (warehouse)' || 
                                           deptName.includes('warehouse') || 
                                           deptName.includes('wearehouse');
                                });
                                const stockAvailable = warehouseItem ? Number(warehouseItem.current_stock) : 0;

                                return (
                                    <div className="p-3 bg-muted rounded-md text-sm">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-muted-foreground font-medium">Store Stock:</span>
                                            <span className={cn("font-bold", stockAvailable <= 0 ? "text-red-500" : "text-green-600")}>
                                                {stockAvailable} {warehouseItem?.unit || 'units'}
                                            </span>
                                        </div>
                                        {stockAvailable <= 0 && (
                                            <p className="text-xs text-red-500 mt-1 italic">
                                                No stock in Store. You may want to convert this to an external purchase.
                                            </p>
                                        )}
                                    </div>
                                );
                            })()}
                            <div>
                                <label className="block text-sm font-medium mb-1">Requested Quantity</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={receivedQuantity}
                                    onChange={(e) => setReceivedQuantity(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Notes</label>
                                <textarea
                                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={editNotes}
                                    onChange={(e) => setEditNotes(e.target.value)}
                                    placeholder="Add notes or justification..."
                                />
                            </div>
                        </div>
                    )}

                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                        <div className="flex-1 flex gap-2">
                            {actionData?.status === 'APPROVED' && actionData.requestType === 'TRANSFER_REQUEST' && (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="text-amber-600 hover:text-amber-700"
                                    onClick={handleConvertToExternal}
                                >
                                    Convert to External Purchase
                                </Button>
                            )}
                        </div>
                        <AlertDialogCancel onClick={() => {
                            setActionData(null);
                            setReceivedQuantity('');
                            setEditNotes('');
                        }}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleAction}
                            className={actionData?.status === 'REJECTED' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
                            disabled={(actionData?.status === 'COMPLETED' && (!receivedQuantity || (actionData.requestType !== 'TRANSFER_REQUEST' && !actualCost))) ||
                                ((actionData?.status === 'APPROVED' || actionData?.status === 'EDIT') && !receivedQuantity)}
                        >
                            {actionData?.status === 'EDIT' ? 'Save Changes' : actionData?.status === 'APPROVED' ? 'Confirm Approval' : 'Confirm'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Hidden Printable Purchase Order Area */}
            <div id="print-area" className="hidden print:block">
                <div className="p-10 bg-white text-black min-h-screen font-sans">

                    {/* Header */}
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h1 className="text-4xl font-extrabold tracking-tight">Oruthota Chalets</h1>
                            <p className="text-sm text-gray-500 mt-1">Internal Procurement Department</p>
                        </div>
                        <div className="text-right">
                            <h2 className="text-2xl font-bold text-gray-700 uppercase tracking-widest">Purchase Order</h2>
                            <p className="text-sm text-gray-500 mt-1">
                                PO Date: {createdPO ? format(new Date(createdPO.created_at), 'PP') : format(new Date(), 'PP')}
                            </p>
                            <p className="text-sm font-mono text-gray-700 mt-1">
                                PO# {createdPO?.po_number ?? `PO-${format(new Date(), 'yyyyMMdd')}`}
                            </p>
                        </div>
                    </div>

                    <hr className="border-t-2 border-black mb-8" />

                    {/* Addresses */}
                    <div className="flex gap-16 mb-8 text-sm">
                        <div>
                            <p className="font-bold uppercase tracking-wider text-gray-500 mb-1 text-xs">Bill To</p>
                            <p className="font-semibold">Oruthota Chalets</p>
                            <p className="text-gray-600">Central Stores Department</p>
                        </div>
                        <div>
                            <p className="font-bold uppercase tracking-wider text-gray-500 mb-1 text-xs">Supplier</p>
                            <p className="font-semibold">{createdPO?.supplier_name || '(To be confirmed)'}</p>
                        </div>
                        <div>
                            <p className="font-bold uppercase tracking-wider text-gray-500 mb-1 text-xs">Prepared By</p>
                            <p className="font-semibold">Store Manager</p>
                            <p className="text-gray-600">Procurement &amp; Inventory</p>
                        </div>
                    </div>

                    {/* Items Table */}
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="py-3 px-3 border border-gray-300 font-semibold">#</th>
                                <th className="py-3 px-3 border border-gray-300 font-semibold">Item Description</th>
                                <th className="py-3 px-3 border border-gray-300 font-semibold">Unit</th>
                                <th className="py-3 px-3 border border-gray-300 font-semibold text-right">Qty</th>
                                <th className="py-3 px-3 border border-gray-300 font-semibold text-right">Unit Price (LKR)</th>
                                <th className="py-3 px-3 border border-gray-300 font-semibold text-right">Total (LKR)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {createdPOItems.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-gray-500 italic border border-gray-300">
                                        No items in this purchase order.
                                    </td>
                                </tr>
                            ) : (
                                createdPOItems.map((req, idx) => (
                                    <tr key={req.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="py-3 px-3 border border-gray-300 text-gray-500">{idx + 1}</td>
                                        <td className="py-3 px-3 border border-gray-300 font-medium">
                                            {req.request_type === 'NEW_ITEM' ? (req.notes || 'New Item') : req.item?.name}
                                            {req.notes && req.request_type !== 'NEW_ITEM' && (
                                                <div className="text-xs text-gray-500 mt-0.5">{req.notes}</div>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 border border-gray-300 text-gray-600">{req.item?.unit || '—'}</td>
                                        <td className="py-3 px-3 border border-gray-300 text-right">{req.requested_quantity}</td>
                                        <td className="py-3 px-3 border border-gray-300 text-right text-gray-400 italic">—</td>
                                        <td className="py-3 px-3 border border-gray-300 text-right text-gray-400 italic">—</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        <tfoot>
                            <tr className="bg-gray-100">
                                <td colSpan={5} className="py-3 px-3 border border-gray-300 font-bold text-right">TOTAL</td>
                                <td className="py-3 px-3 border border-gray-300 font-bold text-right">—</td>
                            </tr>
                        </tfoot>
                    </table>

                    {/* Notes */}
                    <div className="mt-8 p-4 border border-dashed border-gray-300 rounded text-sm">
                        <p className="font-semibold mb-1">Notes &amp; Terms:</p>
                        <p className="text-gray-500">Please supply the above items as per the specifications. All prices are subject to confirmation by the supplier. This purchase order is subject to the standard terms and conditions of Oruthota Chalets.</p>
                    </div>

                    {/* Signatures */}
                    <div className="mt-16 grid grid-cols-3 gap-8 text-sm text-center">
                        <div>
                            <div className="border-t border-gray-400 pt-2 mt-8">Store Keeper Signature</div>
                        </div>
                        <div>
                            <div className="border-t border-gray-400 pt-2 mt-8">Approved By</div>
                        </div>
                        <div>
                            <div className="border-t border-gray-400 pt-2 mt-8">Received By</div>
                        </div>
                    </div>

                    <div className="mt-8 text-center text-xs text-gray-400">
                        <p>Generated by Oruthota Chalets Management System &bull; {format(new Date(), 'PPpp')}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
