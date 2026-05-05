'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { POForm, POItemRecord } from '@/components/dashboard/purchase-orders/po-form';

export default function EditPurchaseOrderPage({ 
    params, 
    searchParams 
}: { 
    params: Promise<{ id: string }>,
    searchParams: Promise<{ from?: string }>
}) {
    const { id } = use(params);
    const { from } = use(searchParams);
    const { toast } = useToast();
    const router = useRouter();

    const [inventoryItems, setInventoryItems] = useState([]);
    const [poData, setPOData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const returnPath = from === 'approvals' ? '/dashboard/purchase-orders/approvals' : '/dashboard/purchase-orders';

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [poRes, invRes] = await Promise.all([
                    fetch(`/api/admin/purchase-orders/${id}`),
                    fetch('/api/admin/inventory/items')
                ]);
                const [poJson, invJson] = await Promise.all([poRes.json(), invRes.json()]);
                
                if (poJson.error) throw new Error(poJson.error);
                if (invJson.error) throw new Error(invJson.error);

                setPOData(poJson.purchase_order);
                setInventoryItems(invJson.items || []);
            } catch (err: any) {
                toast({ variant: 'destructive', title: 'Error', description: err.message });
                router.push(returnPath);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [id, router, toast, returnPath]);

    const handleSubmit = async (formData: any) => {
        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/admin/purchase-orders/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            
            toast({ title: 'Purchase Order Updated', description: `PO ${poData.po_number} has been updated.` });
            router.push(returnPath);
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Loading Purchase Order...</p>
            </div>
        );
    }

    // Map DB items to form items
    const initialItems: POItemRecord[] = poData.purchase_order_items.map((item: any) => ({
        id: item.id,
        item_id: item.item_id || '',
        item_name: item.item_name,
        unit: item.unit,
        quantity: String(item.quantity),
        brand: item.brand || '',
        supplier_name: item.supplier_name || '',
        item_size: item.item_size || '',
        unit_price: item.unit_price != null ? String(item.unit_price) : ''
    }));

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <Link href={returnPath} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 w-fit">
                    <ArrowLeft className="h-4 w-4" /> Back to {from === 'approvals' ? 'Approvals' : 'Purchase Orders'}
                </Link>
                <div>
                    <h1 className="text-3xl font-headline font-bold flex items-center gap-3">
                        <ShoppingCart className="h-8 w-8 text-primary" />
                        Edit PO: {poData.po_number}
                    </h1>
                    <p className="text-muted-foreground mt-1">Modify items, quantities, and prices for this purchase order.</p>
                </div>
            </div>

            <div className="bg-card border rounded-lg p-6 shadow-sm">
                <POForm 
                    initialData={{
                        supplier_name: poData.supplier_name,
                        notes: poData.notes,
                        items: initialItems
                    }}
                    inventoryItems={inventoryItems}
                    onSubmit={handleSubmit}
                    onCancel={() => router.push(returnPath)}
                    isSubmitting={isSubmitting}
                    submitLabel="Update Purchase Order"
                />
            </div>
        </div>
    );
}
