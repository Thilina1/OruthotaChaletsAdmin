'use client';

import React, { useState, useEffect, useRef } from 'react';
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
import { Search, Printer, Check, X, AlertCircle, ShoppingCart, RefreshCw, Send, Plus, Filter, Info, Package, ArrowRight, Trash2, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
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
    const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionData, setActionData] = useState<{ id: string, status: 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'EDIT', requestType?: string, requestedQuantity?: number, itemId?: string, itemName?: string, itemCategory?: string, currentNotes?: string, currentStatus?: string, action_metadata?: any } | null>(null);
    const [actualCost, setActualCost] = useState<string>('');
    const [receivedQuantity, setReceivedQuantity] = useState<string>('');
    const [itemPrice, setItemPrice] = useState<string>('');
    const [isNewBuyRequestOpen, setIsNewBuyRequestOpen] = useState(false);
    const [newRequestType, setNewRequestType] = useState<'ADD_STOCK' | 'NEW_ITEM'>('ADD_STOCK');
    const [selectedInventoryItemId, setSelectedInventoryItemId] = useState<string>('');
    const [newRequestQuantity, setNewRequestQuantity] = useState<string>('');
    const [newRequestNotes, setNewRequestNotes] = useState<string>('');
    const [newRequestEstimatedCost, setNewRequestEstimatedCost] = useState<string>('');
    const [isSubmittingNewRequest, setIsSubmittingNewRequest] = useState(false);
    const [editNotes, setEditNotes] = useState<string>('');
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    const toggleRow = (id: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedRows(newExpanded);
    };
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
            const [reqRes, invRes, poRes] = await Promise.all([
                fetch('/api/admin/inventory-requests'),
                fetch('/api/admin/hotel-inventory'),
                fetch('/api/admin/purchase-orders')
            ]);
            const reqData = await reqRes.json();
            const invData = await invRes.json();
            const poData = await poRes.json();

            if (reqData.error) throw new Error(reqData.error);
            if (invData.error) throw new Error(invData.error);
            if (poData.error) throw new Error(poData.error);

            setRequests(reqData.requests || []);
            setInventoryItems(invData.items || []);
            setPurchaseOrders(poData.purchase_orders || []);
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
            return req.request_type === 'ADD_STOCK' || req.request_type === 'NEW_ITEM' || (req.request_type === 'TRANSFER_REQUEST' && req.action_metadata?.needs_external_purchase);
        }
    });

    // Merge standalone Purchase Orders into the 'Buy' view
    const allItems = [...filteredRequests];
    if (activeTab === 'buy') {
        const standalonePOs = purchaseOrders.filter(po => {
            // Check if this PO is ALREADY represented by a request in our list (through purchase_order_id)
            const isLinked = requests.some(req => req.purchase_order_id === po.id);
            return !isLinked;
        }).map(po => {
            const totalCost = po.purchase_order_items?.reduce((sum: number, item: any) => sum + (Number(item.total_price) || 0), 0) || 0;
            const itemNames = po.purchase_order_items?.map((i: any) => i.item_name).join(', ') || 'No Items';
            const totalReceived = po.status === 'received' 
                ? po.purchase_order_items?.reduce((sum: number, i: any) => sum + Number(i.received_quantity !== null && i.received_quantity !== undefined ? i.received_quantity : i.quantity), 0)
                : null;
            
            return {
                id: po.id,
                isPO: true, // Identify as a PO for UI differences
                created_at: po.created_at,
                updated_at: po.updated_at,
                request_type: 'PO',
                status: po.status.toUpperCase(),
                item: { name: itemNames, unit: '' },
                requested_quantity: po.purchase_order_items?.reduce((sum: number, i: any) => sum + Number(i.quantity), 0) || 0,
                requester: po.created_by_user || { name: 'Store Manager', email: '' },
                action_metadata: {
                    po_number: po.po_number,
                    supplier: po.supplier_name,
                    item_count: po.purchase_order_items?.length || 0,
                    notes: po.notes,
                    actual_cost: totalCost > 0 ? totalCost : null,
                    item_list: itemNames,
                    received_quantity: totalReceived,
                    items: po.purchase_order_items // Full items for expanding
                }
            };
        });
        allItems.push(...standalonePOs);
        // Sort merged list by date
        allItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

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
    } = usePagination(allItems, 20);

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
                    status: 'PENDING',
                    requested_quantity: receivedQuantity ? parseFloat(receivedQuantity) : actionData.requestedQuantity,
                    action_metadata: {
                        needs_external_purchase: true
                    }
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
        req => (req.request_type === 'ADD_STOCK' || (req.request_type === 'TRANSFER_REQUEST' && req.action_metadata?.needs_external_purchase)) && req.status === 'APPROVED' && !req.purchase_order_id
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

    const handleCreateManualBuyRequest = async () => {
        if (newRequestType === 'ADD_STOCK' && !selectedInventoryItemId) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please select an item.' });
            return;
        }
        if (!newRequestQuantity || parseFloat(newRequestQuantity) <= 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please enter a valid quantity.' });
            return;
        }

        setIsSubmittingNewRequest(true);
        try {
            const res = await fetch('/api/admin/inventory-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    request_type: newRequestType,
                    item_id: newRequestType === 'ADD_STOCK' ? selectedInventoryItemId : null,
                    requested_quantity: parseFloat(newRequestQuantity),
                    estimated_cost: newRequestEstimatedCost ? parseFloat(newRequestEstimatedCost) : 0,
                    notes: newRequestNotes,
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast({ title: 'Success', description: 'Buy request created successfully.' });
            setIsNewBuyRequestOpen(false);
            setNewRequestQuantity('');
            setNewRequestNotes('');
            setNewRequestEstimatedCost('');
            setSelectedInventoryItemId('');
            fetchRequests();
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setIsSubmittingNewRequest(false);
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
                    {activeTab === 'buy' && (
                        <Button onClick={() => setIsNewBuyRequestOpen(true)} className="gap-2 bg-primary hover:bg-primary/90">
                            <Plus className="h-4 w-4" />
                            <span className="hidden sm:inline">New Buy Request</span>
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

            {/* New Buy Request Dialog */}
            <Dialog open={isNewBuyRequestOpen} onOpenChange={setIsNewBuyRequestOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Plus className="h-5 w-5 text-primary" />
                            New Buy Request
                        </DialogTitle>
                        <DialogDescription>
                            Create a manual request to purchase stock. This will appear as PENDING in the Buy Products tab.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="flex bg-muted p-1 rounded-lg">
                            <button
                                onClick={() => setNewRequestType('ADD_STOCK')}
                                className={cn(
                                    "flex-1 py-1.5 text-xs font-medium rounded-md transition-all",
                                    newRequestType === 'ADD_STOCK' ? "bg-background shadow-sm text-primary" : "text-muted-foreground"
                                )}
                            >
                                Existing Item
                            </button>
                            <button
                                onClick={() => setNewRequestType('NEW_ITEM')}
                                className={cn(
                                    "flex-1 py-1.5 text-xs font-medium rounded-md transition-all",
                                    newRequestType === 'NEW_ITEM' ? "bg-background shadow-sm text-primary" : "text-muted-foreground"
                                )}
                            >
                                New Product
                            </button>
                        </div>

                        {newRequestType === 'ADD_STOCK' ? (
                            <div>
                                <label className="block text-sm font-medium mb-1">Select Item</label>
                                <Select value={selectedInventoryItemId} onValueChange={setSelectedInventoryItemId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Search or select an item..." />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[300px]">
                                        {/* Group by category for better UX */}
                                        {Object.entries(
                                            inventoryItems.reduce((acc: any, item: any) => {
                                                if (!acc[item.category]) acc[item.category] = [];
                                                acc[item.category].push(item);
                                                return acc;
                                            }, {})
                                        ).map(([category, items]: [string, any]) => (
                                            <div key={category}>
                                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 uppercase tracking-wider">{category}</div>
                                                {items.map((item: any) => (
                                                    <SelectItem key={item.id} value={item.id}>
                                                        {item.name} ({item.current_stock} {item.unit} in {item.department?.name})
                                                    </SelectItem>
                                                ))}
                                            </div>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-sm font-medium mb-1">Product Details</label>
                                <Textarea
                                    placeholder="Enter item name, category, and any specifications..."
                                    value={newRequestNotes}
                                    onChange={(e) => setNewRequestNotes(e.target.value)}
                                    className="min-h-[80px]"
                                />
                                <p className="text-[10px] text-muted-foreground mt-1">Example: "Coca Cola 500ml, Beverage, Bottles"</p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Quantity</label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={newRequestQuantity}
                                    onChange={(e) => setNewRequestQuantity(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Est. Cost (LKR)</label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={newRequestEstimatedCost}
                                    onChange={(e) => setNewRequestEstimatedCost(e.target.value)}
                                />
                            </div>
                        </div>

                        {newRequestType === 'ADD_STOCK' && (
                            <div>
                                <label className="block text-sm font-medium mb-1">Justification / Notes</label>
                                <Textarea
                                    placeholder="Why is this purchase needed?"
                                    value={newRequestNotes}
                                    onChange={(e) => setNewRequestNotes(e.target.value)}
                                    className="min-h-[60px]"
                                />
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsNewBuyRequestOpen(false)} disabled={isSubmittingNewRequest}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateManualBuyRequest} disabled={isSubmittingNewRequest} className="gap-2">
                            {isSubmittingNewRequest ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                            Submit Request
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
                                    <TableHead>From/To</TableHead>
                                    <TableHead>Requested By</TableHead>
                                    <TableHead>Status</TableHead>
                                    {canManageRequests && <TableHead className="text-right">Actions</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-10">
                                            <div className="flex flex-col items-center gap-2">
                                                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                                                <p className="text-sm text-muted-foreground">Loading requests...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (!paginatedItems || paginatedItems.length === 0) ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-20">
                                            <div className="flex flex-col items-center gap-3">
                                                <Info className="h-8 w-8 text-muted-foreground/50" />
                                                <p className="text-muted-foreground font-medium">No transfer requests found.</p>
                                                <p className="text-xs text-muted-foreground/70 max-w-xs mx-auto">Requests from departments for stock from the main warehouse will appear here.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedItems.map((req) => (
                                        <TableRow key={req.id} className="group hover:bg-muted/30 transition-colors">
                                            <TableCell className="font-medium whitespace-nowrap">
                                                <div className="text-sm">{format(new Date(req.created_at), 'MMM d, yyyy')}</div>
                                                <div className="text-[10px] text-muted-foreground">{format(new Date(req.created_at), 'p')}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={cn("font-medium", getRequestTypeColor(req.request_type))}>
                                                    {getRequestTypeLabel(req.request_type)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    <span className="font-semibold text-sm">{req.item?.name}</span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-primary/5 text-primary border-primary/10">
                                                        {req.requested_quantity} {req.item?.unit || 'units'}
                                                    </Badge>
                                                    {req.action_metadata?.needs_external_purchase && (
                                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-amber-50 text-amber-700 border-amber-200">
                                                            Awaiting External Stock
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-1.5 text-xs">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                                        <span className="text-muted-foreground uppercase font-bold text-[10px]">Store</span>
                                                    </div>
                                                    <ArrowRight className="h-3 w-3 text-muted-foreground/50 ml-0.5" />
                                                    <div className="flex items-center gap-1.5 text-xs">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                                        <span className="font-semibold">{req.item?.department?.name || 'Department'}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm font-medium">{req.requester?.name || 'Unknown User'}</div>
                                                <div className="text-[10px] text-muted-foreground max-w-[120px] truncate">{req.requester?.email}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={cn(
                                                    "font-medium shadow-sm",
                                                    req.status === 'COMPLETED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                    req.status === 'APPROVED' ? 'bg-green-50 text-green-700 border-green-200' :
                                                    req.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200' :
                                                    'bg-yellow-50 text-yellow-700 border-yellow-200'
                                                )}>
                                                    <div className="flex items-center gap-1.5">
                                                        {req.status === 'PENDING' && <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />}
                                                        {req.status}
                                                    </div>
                                                </Badge>
                                                {req.reviewer && (
                                                    <div className="text-[10px] text-muted-foreground mt-1 px-1">
                                                        By {req.reviewer.name}
                                                    </div>
                                                )}
                                            </TableCell>
                                            {canManageRequests && (
                                                <TableCell className="text-right">
                                                    {req.status === 'PENDING' ? (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Button variant="outline" size="sm" onClick={() => {
                                                                setActionData({ 
                                                                    id: req.id, 
                                                                    status: 'EDIT', 
                                                                    currentStatus: req.status,
                                                                    requestType: req.request_type, 
                                                                    requestedQuantity: req.requested_quantity,
                                                                    itemName: req.item?.name,
                                                                    currentNotes: req.notes,
                                                                    action_metadata: req.action_metadata
                                                                });
                                                                setReceivedQuantity(String(req.requested_quantity));
                                                                setEditNotes(req.notes || '');
                                                            }}>
                                                                Edit
                                                            </Button>
                                                            <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => {
                                                                setActionData({ id: req.id, status: 'REJECTED', requestType: req.request_type });
                                                            }}>
                                                                Reject
                                                            </Button>
                                                            {!req.action_metadata?.needs_external_purchase && (
                                                                <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => {
                                                                    setActionData({ 
                                                                        id: req.id, 
                                                                        status: 'APPROVED', 
                                                                        requestType: req.request_type, 
                                                                        requestedQuantity: req.requested_quantity,
                                                                        itemId: req.item_id,
                                                                        itemName: req.item?.name,
                                                                        itemCategory: req.item?.category,
                                                                        action_metadata: req.action_metadata
                                                                    });
                                                                    setReceivedQuantity(String(req.requested_quantity));
                                                                }}>
                                                                    Approve
                                                                </Button>
                                                            )}
                                                        </div>
                                                    ) : req.status === 'APPROVED' ? (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Button variant="outline" size="sm" onClick={() => {
                                                                setActionData({ 
                                                                    id: req.id, 
                                                                    status: 'EDIT', 
                                                                    currentStatus: req.status,
                                                                    requestType: req.request_type, 
                                                                    requestedQuantity: req.requested_quantity,
                                                                    itemName: req.item?.name,
                                                                    currentNotes: req.notes,
                                                                    action_metadata: req.action_metadata
                                                                });
                                                                setReceivedQuantity(String(req.requested_quantity));
                                                                setEditNotes(req.notes || '');
                                                            }}>
                                                                Edit
                                                            </Button>
                                                            <Button 
                                                                variant="default" 
                                                                size="sm" 
                                                                className="gap-2"
                                                                disabled={(() => {
                                                                    const warehouseItem = inventoryItems.find(item => {
                                                                        if (item.name !== req.item?.name) return false;
                                                                        const deptName = item.department?.name?.toLowerCase() || '';
                                                                        return deptName === 'store' || deptName === 'warehouse' || 
                                                                               deptName === 'store (warehouse)' || deptName.includes('warehouse') || 
                                                                               deptName.includes('wearehouse');
                                                                    });
                                                                    return !warehouseItem || Number(warehouseItem.current_stock) < req.requested_quantity;
                                                                })()}
                                                                onClick={() => {
                                                                    setActionData({ 
                                                                        id: req.id, 
                                                                        status: 'COMPLETED', 
                                                                        requestType: req.request_type, 
                                                                        requestedQuantity: req.requested_quantity,
                                                                        itemName: req.item?.name,
                                                                        action_metadata: req.action_metadata
                                                                    });
                                                                    setReceivedQuantity(String(req.requested_quantity));
                                                                }}
                                                            >
                                                                <Send className="h-3.5 w-3.5" />
                                                                Issue Stock
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic px-3">No actions</span>
                                                    )}
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                        {!isLoading && filteredRequests.length > 0 && (
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
                        <div className="rounded-md border bg-muted/20 p-12 text-center flex flex-col items-center gap-4">
                            <div className="p-4 rounded-full bg-amber-50">
                                <AlertCircle className="h-8 w-8 text-amber-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold mb-1">Restricted Access</h3>
                                <p className="text-muted-foreground text-sm max-w-sm mx-auto">Only the Store management can handle external product purchases and buy requests.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between bg-card p-4 rounded-lg border shadow-sm">
                                <div>
                                    <h3 className="font-semibold flex items-center gap-2">
                                        <ShoppingCart className="h-4 w-4 text-primary" />
                                        External Procurement
                                    </h3>
                                    <p className="text-xs text-muted-foreground">Manage purchase requests for stock arrival from external suppliers.</p>
                                </div>
                                <Button onClick={() => setIsNewBuyRequestOpen(true)} size="sm" className="gap-2">
                                    <Plus className="h-4 w-4" />
                                    New Buy Request
                                </Button>
                            </div>

                            <div className="rounded-md border bg-card">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[40px]"></TableHead>
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
                                                <TableCell colSpan={7} className="text-center py-10">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                                                        <p className="text-sm text-muted-foreground">Loading requests...</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (!paginatedItems || paginatedItems.length === 0) ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center py-20">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <ShoppingCart className="h-8 w-8 text-muted-foreground/50" />
                                                        <p className="text-muted-foreground font-medium">No purchase requests found.</p>
                                                        <p className="text-xs text-muted-foreground/70 max-w-xs mx-auto">Requests converted from internal transfers or manually created buy requests will appear here.</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            paginatedItems.map((req) => (
                                                <React.Fragment key={req.id}>
                                                    <TableRow className="group hover:bg-muted/30 transition-colors">
                                                        <TableCell className="p-2 text-center">
                                                            {req.isPO && (
                                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleRow(req.id)}>
                                                                    {expandedRows.has(req.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="font-medium whitespace-nowrap">
                                                            <div className="text-sm">{format(new Date(req.created_at), 'MMM d, yyyy')}</div>
                                                            <div className="text-[10px] text-muted-foreground">{format(new Date(req.created_at), 'p')}</div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="font-semibold text-sm">
                                                                {req.isPO ? (
                                                                    <span className="font-mono text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                                                                        {req.action_metadata.po_number}
                                                                    </span>
                                                                ) : (
                                                                    req.request_type === 'NEW_ITEM' ? (req.notes || 'New Item Detail') : req.item?.name
                                                                )}
                                                            </div>
                                                            {!req.isPO && (
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                                                                        Ordered: {req.requested_quantity} {req.item?.unit || 'units'}
                                                                    </Badge>
                                                                    {req.status === 'COMPLETED' && req.action_metadata?.received_quantity && (
                                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-green-50 text-green-700 border-green-200">
                                                                            Received: {req.action_metadata.received_quantity}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="text-sm font-medium">{req.requester?.name || 'System User'}</div>
                                                            <div className="text-[10px] text-muted-foreground truncate max-w-[120px]">{req.requester?.email}</div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className={cn(
                                                                "font-medium shadow-sm",
                                                                req.status === 'COMPLETED' || req.status === 'RECEIVED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                                req.status === 'APPROVED' || req.status === 'SENT' ? 'bg-green-50 text-green-700 border-green-200' :
                                                                req.status === 'REJECTED' || req.status === 'CANCELLED' ? 'bg-red-50 text-red-700 border-red-200' :
                                                                'bg-yellow-50 text-yellow-700 border-yellow-200'
                                                            )}>
                                                                {req.status}
                                                            </Badge>
                                                            {!req.isPO && req.status === 'COMPLETED' && (
                                                                <div className="mt-1 flex flex-col items-start gap-0.5">
                                                                    <span className="text-[9px] text-muted-foreground font-medium">Received on:</span>
                                                                    <span className="text-[10px] font-semibold text-blue-600">
                                                                        {format(new Date(req.updated_at || req.created_at), 'MMM d, yyyy')}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {req.request_type === 'TRANSFER_REQUEST' && req.status !== 'COMPLETED' && (
                                                                <div className="mt-1">
                                                                    <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 text-[9px] py-0 h-4">
                                                                        For Internal Transfer
                                                                    </Badge>
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                    {canManageRequests && (
                                                        <TableCell className="text-right">
                                                            {req.isPO ? (
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <Button variant="outline" size="sm" asChild>
                                                                        <a href="/dashboard/purchase-orders">Manage PO</a>
                                                                    </Button>
                                                                </div>
                                                            ) : req.status === 'PENDING' ? (
                                                                <div className="flex items-center justify-end gap-2 text-right">
                                                                    <Button variant="outline" size="sm" onClick={() => {
                                                                        setActionData({ 
                                                                            id: req.id, 
                                                                            status: 'EDIT', 
                                                                            currentStatus: req.status,
                                                                            requestType: req.request_type, 
                                                                            requestedQuantity: req.requested_quantity,
                                                                            itemName: req.item?.name || req.notes,
                                                                            currentNotes: req.notes,
                                                                            action_metadata: req.action_metadata
                                                                        });
                                                                        setReceivedQuantity(String(req.requested_quantity));
                                                                        setEditNotes(req.notes || '');
                                                                    }}>
                                                                        Edit
                                                                    </Button>
                                                                    <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => {
                                                                        setActionData({ id: req.id, status: 'REJECTED', requestType: req.request_type });
                                                                    }}>
                                                                        Reject
                                                                    </Button>
                                                                    <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => {
                                                                        setActionData({ 
                                                                            id: req.id, 
                                                                            status: 'APPROVED', 
                                                                            requestType: req.request_type, 
                                                                            requestedQuantity: req.requested_quantity,
                                                                            itemName: req.item?.name || req.notes,
                                                                            action_metadata: req.action_metadata
                                                                        });
                                                                        setReceivedQuantity(String(req.requested_quantity));
                                                                    }}>
                                                                        Approve
                                                                    </Button>
                                                                </div>
                                                            ) : req.status === 'APPROVED' ? (
                                                                <div className="flex items-center justify-end gap-2 text-right">
                                                                    <Button variant="outline" size="sm" onClick={() => {
                                                                        setActionData({ 
                                                                            id: req.id, 
                                                                            status: 'EDIT', 
                                                                            currentStatus: req.status,
                                                                            requestType: req.request_type, 
                                                                            requestedQuantity: req.requested_quantity,
                                                                            itemName: req.item?.name || req.notes,
                                                                            currentNotes: req.notes,
                                                                            action_metadata: req.action_metadata
                                                                        });
                                                                        setReceivedQuantity(String(req.requested_quantity));
                                                                        setEditNotes(req.notes || '');
                                                                    }}>
                                                                        Edit
                                                                    </Button>
                                                                    <Button variant="default" size="sm" className="gap-2" onClick={() => {
                                                                        setActionData({ 
                                                                            id: req.id, 
                                                                            status: 'COMPLETED', 
                                                                            requestType: req.request_type, 
                                                                            requestedQuantity: req.requested_quantity,
                                                                            itemName: req.item?.name || req.notes,
                                                                            action_metadata: req.action_metadata
                                                                        });
                                                                        setReceivedQuantity(String(req.requested_quantity));
                                                                    }}>
                                                                        <ShoppingCart className="h-3.5 w-3.5" />
                                                                        Receive Stock
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground italic px-3">No actions</span>
                                                            )}
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                                
                                                {expandedRows.has(req.id) && req.isPO && (
                                                    <TableRow className="bg-muted/5">
                                                        <TableCell colSpan={7} className="p-4 pt-0">
                                                            <div className="rounded-xl border bg-card shadow-lg ml-8 mt-2 overflow-hidden border-blue-100">
                                                                {/* PO Header Information */}
                                                                <div className="bg-blue-50/50 p-4 border-b border-blue-100 flex flex-wrap items-center justify-between gap-4">
                                                                    <div className="flex items-center gap-4">
                                                                        <div className="bg-white p-2 rounded-lg border border-blue-100">
                                                                            <Package className="h-5 w-5 text-blue-600" />
                                                                        </div>
                                                                        <div>
                                                                            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Supplier</div>
                                                                            <div className="text-sm font-bold text-blue-900">{req.action_metadata.supplier || 'Not Specified'}</div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex gap-6">
                                                                        <div>
                                                                            <div className="text-[10px] font-bold text-muted-foreground uppercase">Ordered Total</div>
                                                                            <div className="text-sm font-semibold">{req.requested_quantity} units</div>
                                                                        </div>
                                                                        {req.action_metadata?.received_quantity && (
                                                                            <div>
                                                                                <div className="text-[10px] font-bold text-green-600 uppercase">Received Total</div>
                                                                                <div className="text-sm font-bold text-green-700">{req.action_metadata.received_quantity} units</div>
                                                                            </div>
                                                                        )}
                                                                        {(req.status === 'COMPLETED' || req.status === 'RECEIVED') && (
                                                                            <div>
                                                                                <div className="text-[10px] font-bold text-blue-600 uppercase">Receive Date</div>
                                                                                <div className="text-sm font-semibold">{format(new Date(req.updated_at || req.created_at), 'MMM d, yyyy')}</div>
                                                                            </div>
                                                                        )}
                                                                        {req.action_metadata?.actual_cost && (
                                                                            <div className="bg-green-600 text-white px-3 py-1 rounded-lg flex flex-col items-center justify-center">
                                                                                <div className="text-[9px] font-bold uppercase opacity-80">Total Cost</div>
                                                                                <div className="text-xs font-black">LKR {req.action_metadata.actual_cost}</div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Itemized List */}
                                                                <div className="p-4">
                                                                    <div className="text-[10px] font-bold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
                                                                        <div className="h-px flex-1 bg-muted"></div>
                                                                        Item Details
                                                                        <div className="h-px flex-1 bg-muted"></div>
                                                                    </div>
                                                                    <div className="grid gap-2">
                                                                        {req.action_metadata.items?.map((item: any) => (
                                                                            <div key={item.id} className="flex items-center justify-between p-2 rounded-lg border border-transparent hover:border-muted hover:bg-muted/20 transition-all">
                                                                                <div className="flex-1">
                                                                                    <div className="font-semibold text-blue-900">{item.item_name}</div>
                                                                                    <div className="text-[10px] text-muted-foreground">Unit: {item.unit || 'units'}</div>
                                                                                </div>
                                                                                <div className="flex gap-8 text-right">
                                                                                    <div className="w-32">
                                                                                        <div className="text-[9px] text-muted-foreground uppercase font-bold">Quantity</div>
                                                                                        <div className="text-xs">
                                                                                            <span className="text-muted-foreground">Ord:</span> <span className="font-semibold">{item.quantity}</span>
                                                                                            <span className="mx-1 text-muted-foreground">•</span>
                                                                                            <span className="text-green-600 font-bold">Rec: {item.received_quantity ?? item.quantity}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="w-24">
                                                                                        <div className="text-[9px] text-muted-foreground uppercase font-bold">Unit Price</div>
                                                                                        <div className="text-xs font-medium">LKR {item.unit_price || '0'}</div>
                                                                                    </div>
                                                                                    <div className="w-28">
                                                                                        <div className="text-[9px] text-muted-foreground uppercase font-bold">Total</div>
                                                                                        <div className="text-xs font-bold text-blue-700">LKR {item.total_price || '0'}</div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                    
                                                                    {req.action_metadata.notes && (
                                                                        <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
                                                                            <div className="text-[10px] font-bold text-amber-700 uppercase mb-1">Notes / Instructions</div>
                                                                            <p className="text-xs text-amber-800 leading-relaxed">{req.action_metadata.notes}</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        ))
                                        )}
                                    </TableBody>
                                </Table>
                                {!isLoading && filteredRequests.length > 0 && (
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
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {actionData?.status === 'COMPLETED' ? 'Complete Fulfillment' :
                             actionData?.status === 'APPROVED' ? 'Confirm Approval' :
                             actionData?.status === 'REJECTED' ? 'Confirm Rejection' :
                             actionData?.status === 'EDIT' ? `Edit Request: ${actionData.itemName}` : 'Are you sure?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {actionData?.status === 'COMPLETED'
                                ? (actionData.requestType === 'TRANSFER_REQUEST'
                                    ? 'Confirm the quantity being issued from the main Store. This will update stock levels for both locations.'
                                    : 'Enter the actual totals and quantity received to complete this purchase and update stock.')
                                : actionData?.status === 'APPROVED'
                                    ? 'Review and approve this request. You can adjust the quantity if needed.'
                                    : actionData?.status === 'REJECTED'
                                    ? 'This will reject the request. This action cannot be undone.'
                                    : actionData?.status === 'EDIT'
                                    ? 'Adjust the request details below.'
                                    : 'Please confirm this action.'
                            }
                            {actionData?.status === 'APPROVED' && actionData?.requestType === 'TRANSFER_REQUEST' && !actionData?.action_metadata?.needs_external_purchase && (
                                <span className="mt-2 font-medium text-amber-600 block text-xs">
                                    Note: This request will remain in the Internal Transfer tab for stock issuance.
                                </span>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {(actionData?.status === 'APPROVED' || actionData?.status === 'EDIT' || actionData?.status === 'COMPLETED') && (
                        <div className="py-2 space-y-4">
                            {/* Stock Info for Transfers */}
                            {actionData.requestType === 'TRANSFER_REQUEST' && (() => {
                                const warehouseItem = inventoryItems.find(item => {
                                    if (item.name !== actionData.itemName) return false;
                                    const deptName = item.department?.name?.toLowerCase() || '';
                                    return deptName === 'store' || deptName === 'warehouse' || deptName === 'store (warehouse)' || 
                                           deptName.includes('warehouse') || deptName.includes('wearehouse');
                                });
                                const stockAvailable = warehouseItem ? Number(warehouseItem.current_stock) : 0;
                                return (
                                    <div className="p-3 bg-muted rounded-md text-sm border">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-muted-foreground font-medium">Warehouse stock ({warehouseItem?.unit || 'units'}):</span>
                                            <span className={cn("font-bold", stockAvailable <= 0 ? "text-red-500" : "text-green-600")}>
                                                {stockAvailable}
                                            </span>
                                        </div>
                                        {stockAvailable <= 0 && (
                                            <p className="text-[10px] text-red-500 mt-1 italic leading-tight">
                                                Insufficient stock in Warehouse. You should convert this to an External Purchase.
                                            </p>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Inputs */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Quantity</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={receivedQuantity}
                                        onChange={(e) => setReceivedQuantity(e.target.value)}
                                        placeholder="0.00"
                                    />
                                </div>
                                {actionData.status === 'COMPLETED' && actionData.requestType !== 'TRANSFER_REQUEST' && (
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Actual Cost (LKR)</label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={actualCost}
                                            onChange={(e) => setActualCost(e.target.value)}
                                            placeholder="0.00"
                                        />
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Notes / Justification</label>
                                <Textarea
                                    className="min-h-[80px]"
                                    value={editNotes}
                                    onChange={(e) => setEditNotes(e.target.value)}
                                    placeholder="Add any additional context..."
                                />
                            </div>
                        </div>
                    )}

                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                        <div className="flex-1 flex gap-2">
                            {actionData?.status === 'APPROVED' && actionData.requestType === 'TRANSFER_REQUEST' && !actionData.action_metadata?.needs_external_purchase && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="text-amber-600 border-amber-200 hover:bg-amber-50"
                                    onClick={handleConvertToExternal}
                                >
                                    Convert to External
                                </Button>
                            )}
                        </div>
                        <AlertDialogCancel onClick={() => {
                            setActionData(null);
                            setReceivedQuantity('');
                            setEditNotes('');
                            setActualCost('');
                        }}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleAction}
                            className={cn(
                                actionData?.status === 'REJECTED' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 
                                actionData?.status === 'APPROVED' ? 'bg-green-600 hover:bg-green-700' : ''
                            )}
                            disabled={
                                (actionData?.status === 'COMPLETED' && (!receivedQuantity || (actionData.requestType !== 'TRANSFER_REQUEST' && !actualCost))) ||
                                ((actionData?.status === 'APPROVED' || actionData?.status === 'EDIT') && !receivedQuantity)
                            }
                        >
                            {actionData?.status === 'EDIT' ? 'Save Changes' : 
                             actionData?.status === 'APPROVED' ? 'Approve & Adjust' : 
                             actionData?.status === 'COMPLETED' ? 'Finalize' : 'Confirm'}
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
                                createdPOItems.map((req: any, idx: number) => (
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
