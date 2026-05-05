'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft as ArrowIcon, ShoppingCart as CartIcon } from 'lucide-react';
import Link from 'next/link';
import { POForm } from '@/components/dashboard/purchase-orders/po-form';

export default function CreatePurchaseOrderPage() {
    const { toast } = useToast();
    const router = useRouter();

    const [inventoryItems, setInventoryItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchInventory = async () => {
            try {
                const res = await fetch('/api/admin/inventory/items');
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                setInventoryItems(data.items ?? []);
            } catch (err: any) {
                toast({ variant: 'destructive', title: 'Error', description: err.message });
            } finally {
                setIsLoading(false);
            }
        };
        fetchInventory();
    }, [toast]);

    const handleCreate = async (formData: any) => {
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/admin/purchase-orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            toast({ title: 'Purchase Order Created', description: `${data.purchase_order.po_number} has been created.` });
            router.push('/dashboard/purchase-orders');
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Loading Inventory Items...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <Link href="/dashboard/purchase-orders" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 w-fit">
                    <ArrowIcon className="h-4 w-4" /> Back to Purchase Orders
                </Link>
                <div>
                    <h1 className="text-3xl font-headline font-bold flex items-center gap-3">
                        <CartIcon className="h-8 w-8 text-primary" />
                        Create Purchase Order
                    </h1>
                    <p className="text-muted-foreground mt-1">Select items from inventory and specify quantities for your new PO.</p>
                </div>
            </div>

            <div className="bg-card border rounded-lg p-6 shadow-sm">
                <POForm 
                    inventoryItems={inventoryItems}
                    onSubmit={handleCreate}
                    onCancel={() => router.push('/dashboard/purchase-orders')}
                    isSubmitting={isSubmitting}
                    submitLabel="Create Purchase Order"
                />
            </div>
        </div>
    );
}
