'use client';

import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { StoreManagement } from '@/components/dashboard/inventory-management/store-management';
import type { InventoryDepartment } from '@/lib/types';
import { Warehouse, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function WarehouseManagementPage() {
    const { toast } = useToast();
    const [warehouses, setWarehouses] = useState<InventoryDepartment[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchWarehouses = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin/inventory-departments');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setWarehouses(data.departments || []);
        } catch (error: any) {
            console.error("Error fetching warehouses:", error);
            toast({
                variant: 'destructive',
                title: "Error",
                description: "Failed to fetch warehouses."
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchWarehouses();
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Link
                            href="/dashboard/inventory-management"
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Inventory
                        </Link>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Stores</span>
                    </div>
                    <h1 className="text-3xl font-headline font-bold flex items-center gap-3">
                        <Warehouse className="h-8 w-8 text-primary" />
                        Manage Store
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Create and manage storage locations for your inventory.
                    </p>
                </div>
            </div>

            <div className="grid gap-6">
                {isLoading ? (
                    <div className="p-10 text-center border rounded-md">
                        <div className="animate-pulse flex flex-col items-center gap-2">
                            <div className="h-8 w-8 bg-muted rounded-full"></div>
                            <div className="h-4 w-32 bg-muted rounded"></div>
                        </div>
                        <div className="mt-4 text-muted-foreground">Loading stores...</div>
                    </div>
                ) : (
                    <StoreManagement
                        warehouses={warehouses}
                        onUpdate={fetchWarehouses}
                    />
                )}
            </div>
        </div>
    );
}
