'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
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

export default function InventoryRequestsPage() {
    const { toast } = useToast();
    const { user, hasPathAccess } = useUserContext();
    const canManageRequests = user?.role === 'admin' || hasPathAccess('/dashboard/inventory-requests');
    const [requests, setRequests] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionData, setActionData] = useState<{ id: string, status: 'APPROVED' | 'REJECTED' | 'COMPLETED', requestType?: string, requestedQuantity?: number } | null>(null);
    const [actualCost, setActualCost] = useState<string>('');
    const [receivedQuantity, setReceivedQuantity] = useState<string>('');
    const [itemPrice, setItemPrice] = useState<string>('');
    const [filterDate, setFilterDate] = useState<string>('');

    const fetchRequests = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin/inventory-requests');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setRequests(data.requests || []);
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
        if (!filterDate) return true;
        const reqDate = new Date(req.created_at).toISOString().split('T')[0];
        return reqDate === filterDate;
    });

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
            const payload: any = { id: actionData.id, status: actionData.status };
            if (actionData.status === 'COMPLETED') {
                if (actualCost) payload.actual_cost = parseFloat(actualCost);
                if (receivedQuantity) payload.received_quantity = parseFloat(receivedQuantity);
                if (itemPrice) payload.item_price = parseFloat(itemPrice);
            }

            const res = await fetch('/api/admin/inventory-requests', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast({
                title: actionData.status === 'APPROVED' ? "Request Approved" : actionData.status === 'COMPLETED' ? "Stock Received" : "Request Rejected",
                description: `The inventory request has been ${actionData.status.toLowerCase()}.`,
            });
            fetchRequests();
        } catch (error) {
            console.error("Error updating request:", error);
            toast({ variant: 'destructive', title: "Error", description: "Failed to update request status." });
        } finally {
            setActionData(null);
            setActualCost('');
            setReceivedQuantity('');
            setItemPrice('');
        }
    };

    const getRequestTypeLabel = (type: string) => {
        switch (type) {
            case 'NEW_ITEM': return 'New Item';
            case 'ADD_STOCK': return 'Add Stock';
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
        if (['issue', 'damage'].includes(type)) return 'text-red-500 border-red-200';
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
                    <Button variant="outline" onClick={() => window.print()} className="gap-2">
                        <Printer className="h-4 w-4" />
                        <span className="hidden sm:inline">Print Shopping List</span>
                    </Button>
                </div>
            </div>

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
                                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No requests found.</TableCell>
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
                                                {['issue', 'damage'].includes(req.request_type) ? '-' : '+'} {req.requested_quantity} {req.item?.unit || 'units'}
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
                                                    <Button variant="outline" size="sm" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => setActionData({ id: req.id, status: 'APPROVED', requestType: req.request_type, requestedQuantity: req.requested_quantity })}>Approve</Button>
                                                    <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setActionData({ id: req.id, status: 'REJECTED' })}>Reject</Button>
                                                </>
                                            ) : req.status === 'APPROVED' && req.request_type === 'ADD_STOCK' ? (
                                                <Button variant="default" size="sm" onClick={() => {
                                                    setActionData({ id: req.id, status: 'COMPLETED', requestType: req.request_type, requestedQuantity: req.requested_quantity });
                                                    setReceivedQuantity(String(req.requested_quantity));
                                                }}>Receive Stock</Button>
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

            <AlertDialog open={!!actionData} onOpenChange={(open) => {
                if (!open) {
                    setActionData(null);
                    setActualCost('');
                    setReceivedQuantity('');
                    setItemPrice('');
                }
            }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {actionData?.status === 'COMPLETED' ? 'Receive Stock' : 'Are you sure?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {actionData?.status === 'COMPLETED'
                                ? 'Enter the actual total cost of the items purchased to complete this request and update the inventory stock.'
                                : `This will mark the request as ${actionData?.status.toLowerCase()}.`
                            }
                            {actionData?.status === 'APPROVED' && actionData?.requestType !== 'ADD_STOCK' && ' This will automatically update the inventory stock.'}
                            {actionData?.status === 'APPROVED' && actionData?.requestType === 'ADD_STOCK' && ' This will add the items to the Shopping List so they can be purchased.'}
                            {actionData?.status === 'REJECTED' && ' This action cannot be undone.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {actionData?.status === 'COMPLETED' && (
                        <div className="py-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Received Quantity</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={receivedQuantity}
                                    onChange={(e) => {
                                        setReceivedQuantity(e.target.value);
                                        if (itemPrice && e.target.value) {
                                            setActualCost((parseFloat(e.target.value) * parseFloat(itemPrice)).toFixed(2));
                                        }
                                    }}
                                />
                            </div>
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
                        </div>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleAction}
                            className={actionData?.status === 'REJECTED' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
                            disabled={actionData?.status === 'COMPLETED' && (!actualCost || !receivedQuantity)}
                        >
                            Confirm
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Hidden Printable Shopping List Area */}
            <div id="print-area" className="hidden print:block">
                <div className="p-8 bg-white text-black min-h-screen">
                    <div className="mb-8 text-center border-b pb-4">
                        <h1 className="text-3xl font-bold mb-2">Shopping List</h1>
                        <p className="text-lg text-gray-600">
                            {filterDate
                                ? `Requests for ${format(new Date(filterDate), 'PP')}`
                                : `All Active Requests (${format(new Date(), 'PP')})`}
                        </p>
                    </div>

                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b-2 border-black">
                                <th className="py-3 px-2">Item</th>
                                <th className="py-3 px-2">Qty</th>
                                <th className="py-3 px-2">Notes</th>
                                <th className="py-3 px-2">Requested By</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRequests
                                .filter(req => req.request_type === 'ADD_STOCK' && req.status === 'APPROVED')
                                .map(req => (
                                    <tr key={req.id} className="border-b border-gray-300">
                                        <td className="py-3 px-2 font-medium">
                                            {req.item?.name}
                                        </td>
                                        <td className="py-3 px-2">
                                            {req.requested_quantity} {req.item?.unit || 'units'}
                                        </td>
                                        <td className="py-3 px-2 text-sm text-gray-600">
                                            {req.notes}
                                        </td>
                                        <td className="py-3 px-2 text-sm">
                                            {req.requester?.name || 'Unknown'}
                                        </td>
                                    </tr>
                                ))}
                            {filteredRequests.filter(req => req.request_type === 'ADD_STOCK' && req.status === 'APPROVED').length === 0 && (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-gray-500 italic">
                                        No approved stock requests found for this selection.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    <div className="mt-16 flex justify-between text-sm text-gray-500">
                        <p>Generated by Taprovia Management System</p>
                        <p>Signature: ______________________</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
