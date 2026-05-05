'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { Truck, ChevronLeft } from 'lucide-react';
import { GRNMultiForm } from '@/components/dashboard/inventory-management/grn-multi-form';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NewGRNPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [inventoryCategories, setInventoryCategories] = useState<any[]>([]);
  const [inventoryUnits, setInventoryUnits] = useState<any[]>([]);
  const [inventorySuppliers, setInventorySuppliers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [itemsRes, warehousesRes, invCategoriesRes, unitsRes, suppliersRes] = await Promise.all([
        fetch('/api/admin/inventory/items'),
        fetch('/api/admin/inventory/warehouses'),
        fetch('/api/admin/inventory/categories'),
        fetch('/api/admin/inventory/units'),
        fetch('/api/admin/inventory/suppliers')
      ]);

      const dataItems = await itemsRes.json();
      const dataWarehouses = await warehousesRes.json();
      const dataInvCats = await invCategoriesRes.json();
      const dataUnits = await unitsRes.json();
      const dataSuppliers = await suppliersRes.json();

      setItems(dataItems.items || []);
      setWarehouses(dataWarehouses.warehouses || []);
      setInventoryCategories(dataInvCats.categories || []);
      setInventoryUnits(dataUnits.units || []);
      setInventorySuppliers(dataSuppliers.suppliers || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to fetch necessary data." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (formData: any) => {
    setIsSubmitting(true);
    try {
      // First, handle any new categories or units (optional, API handles them too but front-end creation is cleaner for cache)
      // Actually, my new API handles them.
      
      const res = await fetch('/api/admin/inventory/stock-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      toast({
        title: "GRN Posted Successfully",
        description: `Successfully processed ${data.processed_count || 1} items into inventory.`,
      });

      router.push('/dashboard/inventory-management/grn');
    } catch (error: any) {
      console.error("GRN Submission Error:", error);
      toast({ variant: 'destructive', title: "Error", description: error.message || "Failed to process GRN." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Truck className="h-12 w-12 text-primary animate-bounce" />
        <p className="text-muted-foreground animate-pulse font-medium">Preparing GRN Workdesk...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col gap-2">
        <Link href="/dashboard/inventory-management/grn">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground p-0">
                <ChevronLeft className="h-4 w-4" /> Back to GRN History
            </Button>
        </Link>
        <div className="flex items-center justify-between">
            <div className="space-y-1">
                <h1 className="text-3xl font-headline font-bold flex items-center gap-3">
                    <Truck className="h-9 w-9 text-primary" />
                    New Goods Received Note
                </h1>
                <p className="text-muted-foreground">Enter all items received in this batch to update stock levels.</p>
            </div>
            <div className="hidden md:block px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                <span className="text-xs text-amber-800 font-bold uppercase tracking-wider">Multi-Item Mode</span>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-1 border">
        <div className="bg-card rounded-2xl p-6">
            <GRNMultiForm 
                inventoryItems={items}
                warehouses={warehouses}
                categories={inventoryCategories}
                units={inventoryUnits}
                suppliers={inventorySuppliers}
                onSubmit={handleSubmit}
                onCancel={() => router.push('/dashboard/inventory-management/grn')}
                isSubmitting={isSubmitting}
            />
        </div>
      </div>
    </div>
  );
}
