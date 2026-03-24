'use client';

import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { GlobalInventory } from '@/components/dashboard/inventory-management/global-inventory';
import type { HotelInventoryItem, InventoryDepartment } from '@/lib/types';
import { BarChart3, ChevronRight, Loader2, PlusCircle, Package } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InventoryItemForm } from '@/components/dashboard/inventory-management/inventory-item-form';
import Link from 'next/link';
import { useUserContext } from '@/context/user-context';

export default function StockOverviewPage() {
    const { user, hasRole } = useUserContext();
    const isStockKeeperOrAdmin = hasRole('admin') || user?.department === 'Stores' || user?.job_title === 'Store keeper';
    const { toast } = useToast();
    const [items, setItems] = useState<HotelInventoryItem[]>([]);
    const [departments, setDepartments] = useState<InventoryDepartment[]>([]);
    const [menuCategories, setMenuCategories] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddItemOpen, setIsAddItemOpen] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch items, departments, and menu categories
            const [itemsRes, deptsRes, catsRes] = await Promise.all([
                fetch('/api/admin/hotel-inventory'),
                fetch('/api/admin/inventory-departments'),
                fetch('/api/admin/menu-sections')
            ]);

            const [itemsData, deptsData, catsData] = await Promise.all([
                itemsRes.json(),
                deptsRes.json(),
                catsRes.json()
            ]);

            if (itemsData.error) throw new Error(itemsData.error);
            if (deptsData.error) throw new Error(deptsData.error);
            if (catsData.error) throw new Error(catsData.error);

            setItems(itemsData.items || []);
            setDepartments(deptsData.departments || []);
            setMenuCategories(catsData.sections || []);
        } catch (error: any) {
            console.error("Error fetching overview data:", error);
            toast({
                variant: 'destructive',
                title: "Error",
                description: "Failed to load stock overview data."
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddItem = async (values: any) => {
        try {
            const res = await fetch('/api/admin/hotel-inventory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast({
                title: "Item Created",
                description: "New inventory item added to the system.",
            });

            setIsAddItemOpen(false);
            fetchData();
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: error.message || "Failed to add item." });
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Link
                            href="/dashboard"
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Dashboard
                        </Link>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        <Link
                            href="/dashboard/inventory-management"
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Inventory
                        </Link>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Stock Overview</span>
                    </div>
                    <h1 className="text-3xl font-headline font-bold flex items-center gap-3">
                        <BarChart3 className="h-8 w-8 text-primary" />
                        Inventory Stock Overview
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Comprehensive view of all your inventory distributed across multiple stores and departments.
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="gap-2" asChild>
                        <Link href="/dashboard/inventory-management">
                            <Package className="h-4 w-4" />
                            Manage Items
                        </Link>
                    </Button>
                    {isStockKeeperOrAdmin && (
                        <Button className="gap-2" onClick={() => setIsAddItemOpen(true)}>
                            <PlusCircle className="h-4 w-4" />
                            New Item
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid gap-6">
                {isLoading ? (
                    <div className="p-20 text-center border rounded-xl bg-card/50 backdrop-blur-sm">
                        <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-4" />
                        <div className="text-lg font-medium">Preparing your stock overview...</div>
                        <p className="text-muted-foreground text-sm mt-1">Fetching items from all departments</p>
                    </div>
                ) : (
                    <GlobalInventory
                        items={items}
                        departments={departments}
                    />
                )}
                <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>New Inventory Item</DialogTitle>
                        </DialogHeader>
                        <InventoryItemForm
                            onSubmit={handleAddItem}
                            departments={departments}
                            menuCategories={menuCategories}
                        />
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
