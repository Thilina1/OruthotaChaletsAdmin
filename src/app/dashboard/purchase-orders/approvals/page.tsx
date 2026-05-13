'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
    Tabs, TabsContent, TabsList, TabsTrigger
} from '@/components/ui/tabs';
import { format } from 'date-fns';
import {
    ShoppingCart, CheckCircle2, XCircle, Loader2, ChevronRight, Eye, ClipboardCheck, Pencil
} from 'lucide-react';
import Link from 'next/link';
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

type PurchaseOrderItem = {
    id: string;
    item_name: string;
    unit: string;
    quantity: number;
    unit_price: number | null;
    total_price: number | null;
    brand: string | null;
    supplier_name: string | null;
    item_size: string | null;
};

type PurchaseOrder = {
    id: string;
    po_number: string;
    status: 'draft' | 'pending_approval' | 'approved' | 'sent' | 'received' | 'cancelled';
    supplier_name: string | null;
    notes: string | null;
    created_at: string;
    approved_at?: string;
    created_by_user?: { name: string; email: string };
    approved_by_user?: { name: string; email: string };
    purchase_order_items: PurchaseOrderItem[];
};

const STATUS_CONFIG = {
    draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700 border-gray-300' },
    pending_approval: { label: 'Pending Approval', className: 'bg-amber-100 text-amber-700 border-amber-300' },
    approved: { label: 'Approved', className: 'bg-green-100 text-green-700 border-green-300' },
    sent: { label: 'Sent', className: 'bg-blue-100 text-blue-700 border-blue-300' },
    received: { label: 'Received', className: 'bg-teal-100 text-teal-700 border-teal-300' },
    cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700 border-red-300' },
};

export default function POApprovalsPage() {
    const { toast } = useToast();
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewPO, setViewPO] = useState<PurchaseOrder | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const newApprovals = purchaseOrders.filter(po => po.status === 'pending_approval');
    const alreadyApproved = purchaseOrders.filter(po => po.status === 'approved' || po.status === 'sent' || po.status === 'received');

    const paginatedNew = usePagination(newApprovals, 15);
    const paginatedAlready = usePagination(alreadyApproved, 15);

    const fetchOrders = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin/purchase-orders');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setPurchaseOrders(data.purchase_orders ?? []);
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchOrders(); }, []);

    const handleApproval = async (id: string, approve: boolean) => {
        setIsSubmitting(true);
        try {
            const status = approve ? 'approved' : 'draft'; // Rejecting returns to draft
            const res = await fetch(`/api/admin/purchase-orders/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            
            toast({ 
                title: approve ? 'PO Approved' : 'PO Rejected', 
                description: approve ? 'The purchase order has been authorized.' : 'The PO was sent back to draft.' 
            });
            
            setViewPO(null);
            fetchOrders();
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setIsSubmitting(false);
        }
    };


    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">Dashboard</Link>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    <Link href="/dashboard/purchase-orders" className="text-sm text-muted-foreground hover:text-foreground">Purchase Orders</Link>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Approvals</span>
                </div>
                <h1 className="text-3xl font-headline font-bold flex items-center gap-3">
                    <CheckCircle2 className="h-8 w-8 text-primary" />
                    Purchase Order Approvals
                </h1>
                <p className="text-muted-foreground mt-1">Review and authorize pending procurement requests.</p>
            </div>

            <Tabs defaultValue="new" className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="new" className="gap-2">
                        New Approvals
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 min-w-[20px]">{newApprovals.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="already" className="gap-2">
                        Already Approvals
                        <Badge variant="outline" className="ml-1 h-5 px-1.5 min-w-[20px]">{alreadyApproved.length}</Badge>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="new">
                    <div className="rounded-md border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>PO Number</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Supplier</TableHead>
                                    <TableHead>Items</TableHead>
                                    <TableHead>Requested By</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-10">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                                        </TableCell>
                                    </TableRow>
                                ) : newApprovals.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                            <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                            <p>No new purchase orders awaiting approval.</p>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedNew.paginatedItems.map((po) => (
                                        <TableRow key={po.id}>
                                            <TableCell className="font-mono font-semibold text-sm">{po.po_number}</TableCell>
                                            <TableCell>
                                                {format(new Date(po.created_at), 'PPP')}
                                            </TableCell>
                                            <TableCell>{po.supplier_name || <span className="text-muted-foreground italic">—</span>}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{po.purchase_order_items.length} item(s)</Badge>
                                            </TableCell>
                                            <TableCell>{po.created_by_user?.name || '—'}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button variant="ghost" size="sm" onClick={() => setViewPO(po)}>
                                                        <Eye className="h-4 w-4 mr-1" /> Review
                                                    </Button>
                                                    <Button variant="outline" size="sm" className="text-green-600 border-green-200 bg-green-50 hover:bg-green-100" 
                                                        onClick={() => handleApproval(po.id, true)} disabled={isSubmitting}>
                                                        Approve
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                        <DataTablePagination
                            currentPage={paginatedNew.currentPage}
                            totalPages={paginatedNew.totalPages}
                            totalItems={paginatedNew.totalItems}
                            itemsPerPage={paginatedNew.itemsPerPage}
                            onPageChange={paginatedNew.setCurrentPage}
                        />
                    </div>
                </TabsContent>

                <TabsContent value="already">
                    <div className="rounded-md border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>PO Number</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Approved By</TableHead>
                                    <TableHead>Approved Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-10">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                                        </TableCell>
                                    </TableRow>
                                ) : alreadyApproved.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                            <ClipboardCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                            <p>No approved purchase orders found.</p>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedAlready.paginatedItems.map((po) => (
                                        <TableRow key={po.id}>
                                            <TableCell className="font-mono font-semibold text-sm">{po.po_number}</TableCell>
                                            <TableCell>{format(new Date(po.created_at), 'PPP')}</TableCell>
                                            <TableCell>
                                                <div className="font-medium text-green-700">{po.approved_by_user?.name || 'System Auto'}</div>
                                            </TableCell>
                                            <TableCell>
                                                {po.approved_at ? format(new Date(po.approved_at), 'PP p') : '—'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={STATUS_CONFIG[po.status].className}>
                                                    {STATUS_CONFIG[po.status].label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" onClick={() => setViewPO(po)}>
                                                    <Eye className="h-4 w-4 mr-1" /> View Details
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                        <DataTablePagination
                            currentPage={paginatedAlready.currentPage}
                            totalPages={paginatedAlready.totalPages}
                            totalItems={paginatedAlready.totalItems}
                            itemsPerPage={paginatedAlready.itemsPerPage}
                            onPageChange={paginatedAlready.setCurrentPage}
                        />
                    </div>
                </TabsContent>
            </Tabs>

            {/* Review Dialog */}
            <Dialog open={!!viewPO} onOpenChange={(open) => !open && setViewPO(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center justify-between">
                            <span>PO Details: {viewPO?.po_number}</span>
                            <Badge variant="outline" className={viewPO ? STATUS_CONFIG[viewPO.status].className : ''}>
                                {viewPO ? STATUS_CONFIG[viewPO.status].label : ''}
                            </Badge>
                        </DialogTitle>
                        <DialogDescription>
                            {viewPO && `Submitted on ${format(new Date(viewPO.created_at), 'PPP')} by ${viewPO.created_by_user?.name ?? 'Unknown'}`}
                        </DialogDescription>
                    </DialogHeader>
                    {viewPO && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
                                <div>
                                    <span className="text-muted-foreground block text-xs uppercase tracking-wider font-semibold">Supplier</span> 
                                    <span className="font-medium text-base">{viewPO.supplier_name || 'Not Specified'}</span>
                                </div>
                                {viewPO.approved_by_user && (
                                    <div>
                                        <span className="text-muted-foreground block text-xs uppercase tracking-wider font-semibold text-green-700">Approved By</span> 
                                        <span className="font-medium text-base text-green-700">{viewPO.approved_by_user.name}</span>
                                        <div className="text-[10px] text-muted-foreground uppercase">{viewPO.approved_at ? format(new Date(viewPO.approved_at), 'PP p') : ''}</div>
                                    </div>
                                )}
                                {viewPO.notes && (
                                    <div className="col-span-2">
                                        <span className="text-muted-foreground block text-xs uppercase tracking-wider font-semibold">Notes</span> 
                                        <p className="mt-1">{viewPO.notes}</p>
                                    </div>
                                )}
                            </div>

                            <div className="border rounded-lg overflow-hidden bg-card">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                                            <TableHead>Item</TableHead>
                                            <TableHead>Identity</TableHead>
                                            <TableHead className="text-right">Qty</TableHead>
                                            <TableHead className="text-right">Price</TableHead>
                                            <TableHead className="text-right">Subtotal</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {viewPO.purchase_order_items.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell>
                                                    <div className="font-medium">{item.item_name}</div>
                                                    <div className="text-[10px] text-muted-foreground uppercase">{item.unit}</div>
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {(item.brand || item.item_size) ? (
                                                        <>
                                                            {item.brand && <div className="text-muted-foreground">Brand: {item.brand}</div>}
                                                            {item.item_size && <div className="text-muted-foreground">Size: {item.item_size}</div>}
                                                        </>
                                                    ) : '—'}
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {item.quantity}
                                                </TableCell>
                                                <TableCell className="text-right text-xs">
                                                    {item.unit_price ? `LKR ${item.unit_price.toLocaleString()}` : '—'}
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-semibold">
                                                    {item.total_price ? `LKR ${item.total_price.toLocaleString()}` : '—'}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow className="bg-slate-50 font-bold border-t-2">
                                            <TableCell colSpan={4} className="text-right uppercase tracking-wider text-xs text-muted-foreground">
                                                Estimated Total
                                            </TableCell>
                                            <TableCell className="text-right text-primary font-mono text-lg">
                                                LKR {viewPO.purchase_order_items.reduce((sum, item) => sum + (item.total_price || 0), 0).toLocaleString()}
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="gap-2 sm:gap-0">
                        {viewPO?.status === 'pending_approval' && (
                            <>
                                <Button variant="ghost" onClick={() => handleApproval(viewPO!.id, false)} disabled={isSubmitting} className="text-destructive hover:text-destructive hover:bg-red-50">
                                    Reject & Return to Draft
                                </Button>
                                <div className="flex-1" />
                                <Link href={`/dashboard/purchase-orders/${viewPO.id}/edit?from=approvals`}>
                                    <Button variant="outline" size="sm" className="gap-2">
                                        <Pencil className="h-4 w-4" /> Edit PO Before Approval
                                    </Button>
                                </Link>
                                <div className="w-2" />
                            </>
                        )}
                        <Button variant="outline" onClick={() => setViewPO(null)}>Close</Button>
                        {viewPO?.status === 'pending_approval' && (
                            <Button onClick={() => handleApproval(viewPO!.id, true)} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
                               Authorized & Approve PO
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
