'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { InventoryBatch } from '@/lib/types';
import { AlertCircle, CheckCircle2, Layers, RefreshCw, Trash2 } from 'lucide-react';

interface BatchPricingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    inventoryItemId: string;
    inventoryItemName: string;
    menuItemId: string;
}

type BatchRow = InventoryBatch & {
    total_stock: number;
    warehouse_stock: { name: string; quantity: number }[];
    pricing_id: string | null;
    selling_price: number | null;
    _editPrice: string;
    _saving: boolean;
    _saved: boolean;
};

function isExpired(dateStr?: string) {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
}

function isExpiringSoon(dateStr?: string) {
    if (!dateStr) return false;
    const expiry = new Date(dateStr);
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + 30);
    return !isExpired(dateStr) && expiry <= threshold;
}

function formatDate(dateStr?: string) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
    });
}

export function BatchPricingDialog({
    open,
    onOpenChange,
    inventoryItemId,
    inventoryItemName,
    menuItemId,
}: BatchPricingDialogProps) {
    const { toast } = useToast();
    const [batches, setBatches] = useState<BatchRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchBatches = useCallback(async () => {
        if (!inventoryItemId || !menuItemId) return;
        setIsLoading(true);
        try {
            const res = await fetch(
                `/api/admin/inventory/batches?item_id=${inventoryItemId}&menu_item_id=${menuItemId}`
            );
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setBatches(
                (data.batches as InventoryBatch[]).map((b) => ({
                    ...b,
                    total_stock: (b as any).total_stock ?? 0,
                    warehouse_stock: (b as any).warehouse_stock ?? [],
                    pricing_id: (b as any).pricing_id ?? null,
                    selling_price: (b as any).selling_price ?? null,
                    _editPrice: (b as any).selling_price != null ? String((b as any).selling_price) : '',
                    _saving: false,
                    _saved: false,
                }))
            );
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        } finally {
            setIsLoading(false);
        }
    }, [inventoryItemId, menuItemId, toast]);

    useEffect(() => {
        if (open) fetchBatches();
    }, [open, fetchBatches]);

    const handlePriceChange = (batchId: string, value: string) => {
        setBatches((prev) =>
            prev.map((b) => b.id === batchId ? { ...b, _editPrice: value, _saved: false } : b)
        );
    };

    const handleSavePrice = async (batchId: string) => {
        const batch = batches.find((b) => b.id === batchId);
        if (!batch) return;

        const parsed = parseFloat(batch._editPrice);
        if (batch._editPrice === '' || isNaN(parsed) || parsed < 0) {
            toast({ variant: 'destructive', title: 'Invalid price', description: 'Enter a valid positive number.' });
            return;
        }

        setBatches((prev) => prev.map((b) => b.id === batchId ? { ...b, _saving: true } : b));

        try {
            const res = await fetch('/api/admin/inventory/batches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ menu_item_id: menuItemId, batch_id: batchId, selling_price: parsed }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setBatches((prev) =>
                prev.map((b) =>
                    b.id === batchId
                        ? { ...b, pricing_id: data.pricing.id, selling_price: parsed, _saving: false, _saved: true }
                        : b
                )
            );
            toast({ title: 'Price Set', description: `Selling price saved for batch ${batch.batch_number || '(no number)'}` });
        } catch (err: any) {
            setBatches((prev) => prev.map((b) => b.id === batchId ? { ...b, _saving: false } : b));
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        }
    };

    const handleRemovePrice = async (batchId: string) => {
        const batch = batches.find((b) => b.id === batchId);
        if (!batch?.pricing_id) return;

        setBatches((prev) => prev.map((b) => b.id === batchId ? { ...b, _saving: true } : b));

        try {
            const res = await fetch('/api/admin/inventory/batches', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pricing_id: batch.pricing_id }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setBatches((prev) =>
                prev.map((b) =>
                    b.id === batchId
                        ? { ...b, pricing_id: null, selling_price: null, _editPrice: '', _saving: false, _saved: false }
                        : b
                )
            );
            toast({ title: 'Price Removed', description: `Batch will use the default menu price.` });
        } catch (err: any) {
            setBatches((prev) => prev.map((b) => b.id === batchId ? { ...b, _saving: false } : b));
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Layers className="h-5 w-5" />
                        Batch Details — {inventoryItemName}
                    </DialogTitle>
                    <DialogDescription>
                        All active inventory batches linked to this menu item. Set a batch-specific selling price to override the default menu price at POS.
                        Leave blank to use the menu item's default price.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex justify-end mb-2">
                    <Button variant="ghost" size="sm" onClick={fetchBatches} disabled={isLoading}>
                        <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                {isLoading ? (
                    <div className="space-y-2">
                        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                ) : batches.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        No active batches found for this item.
                        <br />
                        <span className="text-sm">Receive stock via Inventory → Stock Intake to create batches.</span>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Batch #</TableHead>
                                <TableHead>Supplier</TableHead>
                                <TableHead>Expiry Date</TableHead>
                                <TableHead className="text-right">Buying Price</TableHead>
                                <TableHead className="text-center">Total Stock</TableHead>
                                <TableHead>Warehouses</TableHead>
                                <TableHead className="min-w-[200px]">Selling Price (LKR)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {batches.map((batch) => {
                                const expired = isExpired(batch.expiry_date);
                                const expiringSoon = isExpiringSoon(batch.expiry_date);
                                return (
                                    <TableRow key={batch.id} className={expired ? 'opacity-60' : ''}>
                                        <TableCell className="font-mono text-sm">
                                            {batch.batch_number || <span className="text-muted-foreground italic">—</span>}
                                            {expired && <Badge variant="destructive" className="ml-2 text-xs">Expired</Badge>}
                                            {expiringSoon && <Badge variant="outline" className="ml-2 text-xs border-orange-400 text-orange-600">Expiring Soon</Badge>}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {batch.supplier || <span className="text-muted-foreground italic">—</span>}
                                        </TableCell>
                                        <TableCell>
                                            <span className={expired ? 'text-destructive font-semibold' : expiringSoon ? 'text-orange-600 font-medium' : ''}>
                                                {formatDate(batch.expiry_date)}
                                                {expired && <AlertCircle className="inline ml-1 h-3 w-3" />}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm">
                                            LKR {batch.buying_price.toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className={`font-semibold ${batch.total_stock === 0 ? 'text-muted-foreground' : ''}`}>
                                                {batch.total_stock}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-0.5">
                                                {batch.warehouse_stock.length === 0 ? (
                                                    <span className="text-muted-foreground text-xs italic">—</span>
                                                ) : (
                                                    batch.warehouse_stock.map((w, idx) => (
                                                        <div key={idx} className="text-xs">
                                                            <span className="text-muted-foreground">{w.name}:</span>{' '}
                                                            <span className="font-medium">{w.quantity}</span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    placeholder="Default"
                                                    className="h-8 w-28 text-sm"
                                                    value={batch._editPrice}
                                                    onChange={(e) => handlePriceChange(batch.id, e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSavePrice(batch.id); }}
                                                    disabled={batch._saving}
                                                />
                                                <Button
                                                    size="sm"
                                                    variant={batch._saved ? 'outline' : 'default'}
                                                    className="h-8 px-2"
                                                    onClick={() => handleSavePrice(batch.id)}
                                                    disabled={batch._saving}
                                                >
                                                    {batch._saving ? (
                                                        <RefreshCw className="h-3 w-3 animate-spin" />
                                                    ) : batch._saved ? (
                                                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                                                    ) : (
                                                        'Set'
                                                    )}
                                                </Button>
                                                {batch.pricing_id && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 px-2 text-muted-foreground hover:text-destructive"
                                                        onClick={() => handleRemovePrice(batch.id)}
                                                        disabled={batch._saving}
                                                        title="Remove price override"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                )}
                                            </div>
                                            {batch.selling_price != null && !batch._saved && (
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    Current: LKR {batch.selling_price.toFixed(2)}
                                                </p>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                )}
            </DialogContent>
        </Dialog>
    );
}
