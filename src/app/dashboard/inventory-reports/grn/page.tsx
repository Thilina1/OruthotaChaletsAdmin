'use client';

import { useEffect, useState } from 'react';
import { FileBarChart, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TransactionHistoryTable } from '@/components/dashboard/inventory-management/transaction-history-table';

export default function InventoryGRNReportPage() {
    const [warehouses, setWarehouses] = useState<any[]>([]);

    useEffect(() => {
        fetch('/api/admin/inventory/warehouses')
            .then(response => response.json())
            .then(data => setWarehouses(data.warehouses || []))
            .catch(() => setWarehouses([]));
    }, []);

    return (
        <div className="w-full space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <Link href="/dashboard/inventory-reports" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><ArrowLeft className="h-3 w-3" /> Back to Inventory Reports</Link>
                    <h1 className="flex items-center gap-3 text-3xl font-headline font-bold"><FileBarChart className="h-8 w-8 text-primary" /> GRN Report</h1>
                    <p className="text-muted-foreground">Stock received from suppliers into the Main Store.</p>
                </div>
                <Button variant="outline" asChild><Link href="/dashboard/inventory-management/grn">Open GRN Management</Link></Button>
            </div>
            <TransactionHistoryTable
                type="receive"
                title="Goods Received Notes"
                warehouses={warehouses}
                showFilters
                showWarehouseFilters={false}
                destinationWarehouseId={warehouses.find(warehouse => warehouse.is_main)?.id}
                externalOnly
            />
        </div>
    );
}
