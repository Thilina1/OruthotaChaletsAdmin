'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { PlusCircle, Truck, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { StockIntakeForm } from '@/components/dashboard/inventory-management/stock-intake-form';
import { TransactionHistoryTable } from '@/components/dashboard/inventory-management/transaction-history-table';
import Link from 'next/link';

export default function GRNPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [inventoryCategories, setInventoryCategories] = useState<any[]>([]);
  const [inventoryUnits, setInventoryUnits] = useState<any[]>([]);
  const [inventorySuppliers, setInventorySuppliers] = useState<any[]>([]);
  const [isGRNDialogOpen, setIsGRNDialogOpen] = useState(false);
  const [refreshHistory, setRefreshHistory] = useState(0);

  const fetchData = async () => {
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
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
            <ChevronRight className="h-4 w-4" />
            <Link href="/dashboard/inventory-management" className="hover:text-foreground transition-colors">Inventory</Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">GRN</span>
          </div>
          <h1 className="text-3xl font-headline font-bold flex items-center gap-2 text-primary">
            <Truck className="h-8 w-8" />
            Goods Received Note (GRN)
          </h1>
          <p className="text-muted-foreground">Record and manage all incoming stock (Stock In).</p>
        </div>
        <Link href="/dashboard/inventory-management/grn/new">
          <Button size="lg" className="bg-primary hover:bg-primary/90 font-bold shadow-lg gap-2">
            <PlusCircle className="h-5 w-5" /> New Stock Intake (GRN)
          </Button>
        </Link>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <TransactionHistoryTable 
            type="receive,initial_stock" 
            title="Recent Stock Intake (GRN) History" 
            refreshKey={refreshHistory}
        />
      </div>
    </div>
  );
}
