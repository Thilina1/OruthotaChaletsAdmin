'use client';

import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useUserContext } from '@/context/user-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import {
    ShoppingCart, PlusCircle, Printer, Trash2, Plus, X, ChevronRight,
    ClipboardList, Loader2, PackageCheck, Send, Pencil
} from 'lucide-react';
import Link from 'next/link';

type PurchaseOrderItem = {
    id: string;
    item_id: string | null;
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
    created_by_user?: { name: string; email: string };
    approved_by?: string;
    approved_at?: string;
    approved_by_user?: { name: string; email: string };
    purchase_order_items: PurchaseOrderItem[];
};

type InventoryItem = { 
    id: string; 
    name: string; 
    unit?: { id: string; name: string } | string; 
    category?: { id: string; name: string };
    brand?: string; 
    supplier?: string; 
    item_size?: string 
};

const STATUS_CONFIG = {
    draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700 border-gray-300' },
    pending_approval: { label: 'Pending Approval', className: 'bg-amber-100 text-amber-700 border-amber-300' },
    approved: { label: 'Approved', className: 'bg-green-100 text-green-700 border-green-300' },
    sent: { label: 'Sent', className: 'bg-blue-100 text-blue-700 border-blue-300' },
    received: { label: 'Received', className: 'bg-teal-100 text-teal-700 border-teal-300' },
    cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700 border-red-300' },
};

export default function PurchaseOrdersPage() {
    const { toast } = useToast();
    const { user } = useUserContext();
    const printRef = useRef<HTMLDivElement>(null);

    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewPO, setViewPO] = useState<PurchaseOrder | null>(null);
    const [receivePO, setReceivePO] = useState<PurchaseOrder | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [receivedQuantities, setReceivedQuantities] = useState<Record<string, string>>({});
    const [batchNumbers, setBatchNumbers] = useState<Record<string, string>>({});
    const [expiryDates, setExpiryDates] = useState<Record<string, string>>({});
    const [receiveMetadata, setReceiveMetadata] = useState<Record<string, { brand: string, supplier: string, size: string }>>({});
    const [itemPrices, setItemPrices] = useState<Record<string, string>>({});

    const fetchAll = async () => {
        setIsLoading(true);
        try {
            const [poRes, invRes] = await Promise.all([
                fetch('/api/admin/purchase-orders'),
                fetch('/api/admin/inventory/items'),
            ]);
            const [poData, invData] = await Promise.all([poRes.json(), invRes.json()]);
            if (poData.error) throw new Error(poData.error);
            setPurchaseOrders(poData.purchase_orders ?? []);
            setInventoryItems(invData.items ?? []);
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    const handleStatusUpdate = async (id: string, status: string) => {
        try {
            const res = await fetch(`/api/admin/purchase-orders/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            toast({ title: 'Status Updated' });
            fetchAll();
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        }
    };

    const handleReceive = async () => {
        if (!receivePO) return;
        setIsSubmitting(true);
        try {
            const item_prices = receivePO.purchase_order_items.map(item => ({
                id: item.id,
                quantity: item.quantity,
                unit_price: itemPrices[item.id] ? parseFloat(itemPrices[item.id]) : null,
                received_quantity: receivedQuantities[item.id] ? parseFloat(receivedQuantities[item.id]) : item.quantity,
                batch_number: batchNumbers[item.id] || '',
                expiry_date: expiryDates[item.id] || null,
                brand: receiveMetadata[item.id]?.brand || item.brand || '',
                supplier_name: receiveMetadata[item.id]?.supplier || item.supplier_name || receivePO.supplier_name || '',
                item_size: receiveMetadata[item.id]?.size || item.item_size || '',
            }));
            const res = await fetch(`/api/admin/purchase-orders/${receivePO.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'received', item_prices }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            toast({ title: 'Goods Received', description: 'PO marked as received with prices and stock updated.' });
            setReceivePO(null);
            setItemPrices({});
            setReceivedQuantities({});
            setBatchNumbers({});
            setExpiryDates({});
            setReceiveMetadata({});
            fetchAll();
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            const res = await fetch(`/api/admin/purchase-orders/${deleteId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            toast({ title: 'Deleted' });
            setDeleteId(null);
            fetchAll();
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        }
    };

    const handlePrint = (po: PurchaseOrder) => {
        setViewPO(po);
        setTimeout(() => window.print(), 300);
    };

    return (
        <div className="space-y-6">
            {/* Breadcrumb + Title */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Purchase Orders</span>
                    </div>
                    <h1 className="text-3xl font-headline font-bold flex items-center gap-3">
                        <ShoppingCart className="h-8 w-8 text-primary" />
                        Purchase Orders
                    </h1>
                    <p className="text-muted-foreground mt-1">Create, manage, and track all procurement purchase orders.</p>
                </div>
                <Link href="/dashboard/purchase-orders/create">
                    <Button className="gap-2">
                        <PlusCircle className="h-4 w-4" />
                        Create Purchase Order
                    </Button>
                </Link>
            </div>

            {/* PO List */}
            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>PO Number</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead>Items</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created By</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-10">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                                </TableCell>
                            </TableRow>
                        ) : purchaseOrders.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                    <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                    <p>No purchase orders yet. Create your first one!</p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            purchaseOrders.map((po) => {
                                const cfg = STATUS_CONFIG[po.status];
                                return (
                                    <TableRow key={po.id}>
                                        <TableCell className="font-mono font-semibold text-sm">{po.po_number}</TableCell>
                                        <TableCell className="whitespace-nowrap">
                                            {format(new Date(po.created_at), 'PPP')}
                                            <div className="text-xs text-muted-foreground">{format(new Date(po.created_at), 'p')}</div>
                                        </TableCell>
                                        <TableCell>{po.supplier_name || <span className="text-muted-foreground italic">—</span>}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{po.purchase_order_items.length} item{po.purchase_order_items.length !== 1 ? 's' : ''}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {po.created_by_user?.name || '—'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setViewPO(po)}>
                                                    View
                                                </Button>
                                                {(po.status === 'draft' || po.status === 'pending_approval') && (
                                                    <Link href={`/dashboard/purchase-orders/${po.id}/edit`}>
                                                        <Button variant="ghost" size="sm" className="gap-1 text-xs">
                                                            <Pencil className="h-3 w-3" /> Edit
                                                        </Button>
                                                    </Link>
                                                )}
                                                <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => handlePrint(po)}>
                                                    <Printer className="h-3 w-3" />
                                                    Print
                                                </Button>
                                                {po.status === 'draft' && (
                                                    <Button variant="ghost" size="sm" className="text-amber-600 text-xs gap-1"
                                                        onClick={() => handleStatusUpdate(po.id, 'pending_approval')}>
                                                        Submit for Approval
                                                    </Button>
                                                )}
                                                {po.status === 'approved' && (
                                                    <Button variant="ghost" size="sm" className="text-blue-600 text-xs gap-1"
                                                        onClick={() => handleStatusUpdate(po.id, 'sent')}>
                                                        <Send className="h-3 w-3" /> Mark Sent
                                                    </Button>
                                                )}
                                                {po.status === 'sent' && (
                                                    <Button variant="ghost" size="sm" className="text-green-600 text-xs gap-1"
                                                        onClick={() => { 
                                                            setReceivePO(po); 
                                                            setItemPrices({}); 
                                                            const initialQtys: Record<string, string> = {};
                                                            po.purchase_order_items.forEach(i => initialQtys[i.id] = String(i.quantity));
                                                            setReceivedQuantities(initialQtys);
                                                        }}>
                                                        <PackageCheck className="h-3 w-3" /> Receive
                                                    </Button>
                                                )}
                                                {(po.status === 'draft' || po.status === 'cancelled') && (
                                                    <Button variant="ghost" size="sm" className="text-destructive text-xs gap-1"
                                                        onClick={() => setDeleteId(po.id)}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* View PO Dialog */}
            <Dialog open={!!viewPO} onOpenChange={(open) => !open && setViewPO(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="font-mono">{viewPO?.po_number}</DialogTitle>
                        <DialogDescription>
                            {viewPO && `Created on ${format(new Date(viewPO.created_at), 'PPP')} by ${viewPO.created_by_user?.name ?? 'Unknown'}`}
                        </DialogDescription>
                    </DialogHeader>
                    {viewPO && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Supplier:</span>{' '}
                                    <span className="font-medium">{viewPO.supplier_name || '—'}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Status:</span>{' '}
                                    <Badge variant="outline" className={STATUS_CONFIG[viewPO.status].className}>
                                        {STATUS_CONFIG[viewPO.status].label}
                                    </Badge>
                                </div>
                                {viewPO.notes && (
                                    <div className="col-span-2">
                                        <span className="text-muted-foreground">Notes:</span>{' '}
                                        <span>{viewPO.notes}</span>
                                    </div>
                                )}
                            </div>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>#</TableHead>
                                        <TableHead>Item</TableHead>
                                        <TableHead>Brand / Supplier</TableHead>
                                        <TableHead>Size / Pkg</TableHead>
                                        <TableHead className="text-right">Qty</TableHead>
                                        <TableHead className="text-right">Unit Price</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {viewPO.purchase_order_items.map((item, idx) => (
                                        <TableRow key={item.id}>
                                            <TableCell>{idx + 1}</TableCell>
                                            <TableCell className="font-medium">
                                                {item.item_name}
                                                <div className="text-[10px] text-muted-foreground uppercase">{item.unit}</div>
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {item.brand || '—'} / {item.supplier_name || '—'}
                                            </TableCell>
                                            <TableCell className="text-xs">{item.item_size || '—'}</TableCell>
                                            <TableCell className="text-right font-semibold">{item.quantity}</TableCell>
                                            <TableCell className="text-right">
                                                {item.unit_price != null ? `LKR ${item.unit_price.toFixed(2)}` : <span className="text-muted-foreground italic">—</span>}
                                            </TableCell>
                                            <TableCell className="text-right font-bold">
                                                {item.total_price != null ? `LKR ${item.total_price.toFixed(2)}` : <span className="text-muted-foreground italic">—</span>}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setViewPO(null)}>Close</Button>
                        {viewPO && (
                            <Button className="gap-2" onClick={() => handlePrint(viewPO!)}>
                                <Printer className="h-4 w-4" /> Print PO
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Receive Goods Dialog */}
            <Dialog open={!!receivePO} onOpenChange={(open) => !open && setReceivePO(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <PackageCheck className="h-5 w-5 text-green-600" />
                            Receive Goods — {receivePO?.po_number}
                        </DialogTitle>
                        <DialogDescription>Enter the unit price for each received item. Leave blank if not yet known.</DialogDescription>
                    </DialogHeader>
                    {receivePO && (
                        <div className="space-y-6 py-2">
                             <div className="grid grid-cols-12 gap-2 mb-2 text-xs font-semibold text-muted-foreground px-1 uppercase tracking-wider">
                                <div className="col-span-3">Item details</div>
                                <div className="col-span-2">Receipt Info</div>
                                <div className="col-span-2">Batch/Expiry</div>
                                <div className="col-span-5">Identity (Brand/Supplier/Size)</div>
                            </div>
                            {receivePO.purchase_order_items.map(item => (
                                <div key={item.id} className="grid grid-cols-12 gap-3 items-start p-3 border rounded-lg bg-slate-50/50">
                                    <div className="col-span-3">
                                        <p className="text-sm font-bold truncate">{item.item_name}</p>
                                        <p className="text-xs text-muted-foreground">Ordered: {item.quantity} {item.unit}</p>
                                    </div>
                                    <div className="col-span-2 space-y-2">
                                        <Input
                                            className="h-8 text-xs"
                                            type="number"
                                            placeholder="Qty"
                                            value={receivedQuantities[item.id] ?? ''}
                                            onChange={e => setReceivedQuantities(prev => ({ ...prev, [item.id]: e.target.value }))}
                                        />
                                        <Input
                                            className="h-8 text-xs"
                                            type="number"
                                            step="0.01"
                                            placeholder="Price"
                                            value={itemPrices[item.id] ?? ''}
                                            onChange={e => setItemPrices(prev => ({ ...prev, [item.id]: e.target.value }))}
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-2">
                                        <Input
                                            className="h-8 text-xs font-mono"
                                            placeholder="Batch #"
                                            value={batchNumbers[item.id] ?? ''}
                                            onChange={e => setBatchNumbers(prev => ({ ...prev, [item.id]: e.target.value }))}
                                        />
                                        <Input
                                            className="h-8 text-xs"
                                            type="date"
                                            value={expiryDates[item.id] ?? ''}
                                            onChange={e => setExpiryDates(prev => ({ ...prev, [item.id]: e.target.value }))}
                                        />
                                    </div>
                                    <div className="col-span-5 grid grid-cols-1 gap-2">
                                        <div className="flex gap-2">
                                            <Input
                                                className="h-8 text-xs"
                                                placeholder="Brand"
                                                value={receiveMetadata[item.id]?.brand ?? item.brand ?? ''}
                                                onChange={e => setReceiveMetadata(prev => ({ 
                                                    ...prev, 
                                                    [item.id]: { ...(prev[item.id] || { brand: item.brand || '', supplier: item.supplier_name || '', size: item.item_size || '' }), brand: e.target.value } 
                                                }))}
                                            />
                                            <Input
                                                className="h-8 text-xs"
                                                placeholder="Size"
                                                value={receiveMetadata[item.id]?.size ?? item.item_size ?? ''}
                                                onChange={e => setReceiveMetadata(prev => ({ 
                                                    ...prev, 
                                                    [item.id]: { ...(prev[item.id] || { brand: item.brand || '', supplier: item.supplier_name || '', size: item.item_size || '' }), size: e.target.value } 
                                                }))}
                                            />
                                        </div>
                                        <Input
                                            className="h-8 text-xs"
                                            placeholder="Supplier Name"
                                            value={receiveMetadata[item.id]?.supplier ?? item.supplier_name ?? receivePO.supplier_name ?? ''}
                                            onChange={e => setReceiveMetadata(prev => ({ 
                                                ...prev, 
                                                [item.id]: { ...(prev[item.id] || { brand: item.brand || '', supplier: item.supplier_name || '', size: item.item_size || '' }), supplier: e.target.value } 
                                            }))}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setReceivePO(null)}>Cancel</Button>
                        <Button className="gap-2" onClick={handleReceive} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                            Confirm Receipt
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Purchase Order?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently remove the PO and all its items. This cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Hidden Purchase Order Print Area */}
            {viewPO && (
                <div id="print-area" className="hidden print:block">
                    <div className="p-10 bg-white text-black min-h-screen font-sans">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h1 className="text-4xl font-extrabold tracking-tight">Oruthota Chalets</h1>
                                <p className="text-sm text-gray-500 mt-1">Internal Procurement Department</p>
                            </div>
                            <div className="text-right">
                                <h2 className="text-2xl font-bold text-gray-700 uppercase tracking-widest">Purchase Order</h2>
                                <p className="text-sm font-mono text-gray-700 mt-1">PO# {viewPO.po_number}</p>
                                <p className="text-sm text-gray-500 mt-1">Date: {format(new Date(viewPO.created_at), 'PP')}</p>
                            </div>
                        </div>

                        <hr className="border-t-2 border-black mb-8" />

                        <div className="flex gap-16 mb-8 text-sm">
                            <div>
                                <p className="font-bold uppercase tracking-wider text-gray-500 mb-1 text-xs">Supplier</p>
                                <p className="font-semibold">{viewPO.supplier_name || '(To be confirmed)'}</p>
                            </div>
                            <div>
                                <p className="font-bold uppercase tracking-wider text-gray-500 mb-1 text-xs">Prepared By</p>
                                <p className="font-semibold">{viewPO.created_by_user?.name || 'Store Manager'}</p>
                                <p className="text-gray-600">Procurement &amp; Inventory</p>
                            </div>
                             <div>
                                <p className="font-bold uppercase tracking-wider text-gray-500 mb-1 text-xs">Status</p>
                                <p className="font-semibold capitalize">{viewPO.status}</p>
                            </div>
                            {viewPO.approved_by_user && (
                                <div>
                                    <p className="font-bold uppercase tracking-wider text-gray-500 mb-1 text-xs">Approved By</p>
                                    <p className="font-semibold">{viewPO.approved_by_user.name}</p>
                                    <p className="text-xs text-gray-400">{viewPO.approved_at ? format(new Date(viewPO.approved_at), 'PP p') : ''}</p>
                                </div>
                            )}
                        </div>

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
                                {viewPO.purchase_order_items.map((item, idx) => (
                                    <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="py-3 px-3 border border-gray-300 text-gray-500">{idx + 1}</td>
                                        <td className="py-3 px-3 border border-gray-300 font-medium">{item.item_name}</td>
                                        <td className="py-3 px-3 border border-gray-300">{item.unit}</td>
                                        <td className="py-3 px-3 border border-gray-300 text-right">{item.quantity}</td>
                                        <td className="py-3 px-3 border border-gray-300 text-right">
                                            {item.unit_price != null ? item.unit_price.toFixed(2) : '—'}
                                        </td>
                                        <td className="py-3 px-3 border border-gray-300 text-right">
                                            {item.total_price != null ? item.total_price.toFixed(2) : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-100">
                                    <td colSpan={5} className="py-3 px-3 border border-gray-300 font-bold text-right">TOTAL</td>
                                    <td className="py-3 px-3 border border-gray-300 font-bold text-right">
                                        {viewPO.purchase_order_items.some(i => i.total_price != null)
                                            ? `LKR ${viewPO.purchase_order_items.reduce((sum, i) => sum + (i.total_price ?? 0), 0).toFixed(2)}`
                                            : '—'}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>

                        {viewPO.notes && (
                            <div className="mt-6 p-4 border border-dashed border-gray-300 rounded text-sm">
                                <p className="font-semibold mb-1">Notes:</p>
                                <p className="text-gray-600">{viewPO.notes}</p>
                            </div>
                        )}

                        <div className="mt-8 p-4 border border-dashed border-gray-300 rounded text-sm">
                            <p className="font-semibold mb-1">Terms &amp; Conditions:</p>
                            <p className="text-gray-500">Please supply the above items as specified. All prices are subject to supplier confirmation. This purchase order is subject to the standard terms and conditions of Oruthota Chalets.</p>
                        </div>

                        <div className="mt-16 grid grid-cols-3 gap-8 text-sm text-center">
                            <div><div className="border-t border-gray-400 pt-2 mt-8">Store Keeper Signature</div></div>
                            <div><div className="border-t border-gray-400 pt-2 mt-8">Approved By</div></div>
                            <div><div className="border-t border-gray-400 pt-2 mt-8">Received By</div></div>
                        </div>

                        <div className="mt-8 text-center text-xs text-gray-400">
                            <p>Generated by Oruthota Chalets Management System &bull; {format(new Date(), 'PPpp')}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
