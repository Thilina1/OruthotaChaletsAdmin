'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  PlusCircle, Pencil, Trash2, ArrowRightLeft, AlertTriangle, Search, Filter, Warehouse,
  ChevronRight, ChevronDown, Edit, MoveRight, Package, Calendar, Truck, Tag, Layers 
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { InventoryItem, InventoryWarehouse, MenuSection } from '@/lib/types';
import { InventoryItemFormV2 } from '@/components/dashboard/inventory-management/inventory-item-form-v2';
import { InventoryTransactionForm } from '@/components/dashboard/inventory-management/inventory-transaction-form';
import { StockIntakeForm } from '@/components/dashboard/inventory-management/stock-intake-form';
import { InventoryRequestForm } from '@/components/dashboard/inventory-management/request-form';
import { Badge } from '@/components/ui/badge';
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransactionHistoryTable } from '@/components/dashboard/inventory-management/transaction-history-table';
import { WarehouseItemMatrix } from '@/components/dashboard/inventory-management/warehouse-item-matrix';
import { cn } from "@/lib/utils";

export default function InventoryManagementPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
  const [menuCategories, setMenuCategories] = useState<MenuSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('inventory');
  const [refreshHistory, setRefreshHistory] = useState(0);

  // Filtering state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedReorderStatus, setSelectedReorderStatus] = useState<string>('all');
  const [inventoryCategories, setInventoryCategories] = useState<any[]>([]);
  const [inventoryUnits, setInventoryUnits] = useState<any[]>([]);
  const [inventorySuppliers, setInventorySuppliers] = useState<any[]>([]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [itemsRes, warehousesRes, categoriesRes, invCategoriesRes, unitsRes, suppliersRes] = await Promise.all([
        fetch('/api/admin/inventory/items'),
        fetch('/api/admin/inventory/warehouses'), 
        fetch('/api/admin/menu-sections'),
        fetch('/api/admin/inventory/categories'),
        fetch('/api/admin/inventory/units'),
        fetch('/api/admin/inventory/suppliers')
      ]);

      const dataItems = await itemsRes.json();
      const dataWarehouses = await warehousesRes.json();
      const dataCategories = await categoriesRes.json();
      const dataInvCats = await invCategoriesRes.json();
      const dataUnits = await unitsRes.json();
      const dataSuppliers = await suppliersRes.json();

      if (dataItems.error) throw new Error(dataItems.error);
      setItems(dataItems.items || []);

      if (dataWarehouses.error) throw new Error(dataWarehouses.error);
      setWarehouses(dataWarehouses.warehouses || []);

      if (dataCategories.error) throw new Error(dataCategories.error);
      setMenuCategories(dataCategories.sections || []);

      setInventoryCategories(dataInvCats.categories || []);
      setInventoryUnits(dataUnits.units || []);
      setInventorySuppliers(dataSuppliers.suppliers || []);

    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to fetch inventory." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenDialog = (item?: InventoryItem) => {
    setEditingItem(item || null);
    setIsDialogOpen(true);
  };

  const handleOpenTransactionDialog = (item: InventoryItem) => {
    setEditingItem(item);
    setIsTransactionDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    // Check if item has stock before deletion
    const item = items.find(i => i.id === id);
    if (item && item.total_stock > 0) {
      toast({ variant: 'destructive', title: "Cannot Delete", description: "This item currently has stock. Please adjust or issue the stock before deleting." });
      return;
    }

    try {
      const res = await fetch(`/api/admin/inventory/items?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      toast({ title: "Item Deleted", description: "The inventory entry has been removed." });
      fetchData();
    } catch (error) {
      console.error("Error deleting item:", error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to delete item." });
    }
  };

  const handleRequestSubmit = async (values: any) => {
    try {
      const res = await fetch('/api/admin/inventory/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          warehouse_id: warehouses.find(w => w.is_main)?.id || warehouses[0]?.id // Default to main store for requests
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      toast({
        title: "Request Submitted",
        description: "Your inventory request has been sent for approval.",
      });

      setIsRequestDialogOpen(false);
    } catch (error) {
      console.error("Error submitting request:", error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to submit request." });
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const itemName = item.name || '';
      const itemCode = item.code || '';
      const itemDescription = item.description || '';

      const matchesSearch = 
        itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        itemCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        itemDescription.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = selectedCategory === 'all' || item.category_id === selectedCategory;
      const matchesWarehouse = selectedDepartment === 'all' || item.warehouse_stock?.some(ws => ws.id === selectedDepartment);

      const matchesStatus = selectedReorderStatus === 'all' ||
        (selectedReorderStatus === 'critical' && item.total_stock === 0) ||
        (selectedReorderStatus === 'healthy' && item.total_stock > 0);

      return matchesSearch && matchesCategory && matchesWarehouse && matchesStatus;
    });
  }, [items, searchQuery, selectedCategory, selectedDepartment, selectedReorderStatus]);

  const {
    currentPage,
    totalPages,
    totalItems,
    paginatedItems,
    itemsPerPage,
    setCurrentPage,
  } = usePagination(filteredItems, 20);

  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedDepartment, selectedReorderStatus, setCurrentPage]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Hotel Inventory Management</h1>
          <p className="text-muted-foreground">Manage centralized hotel inventory, stores, and stock limits.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeTab === 'inventory' && (
            <Button onClick={() => handleOpenDialog()} variant="secondary">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Item
            </Button>
          )}
          <Link href="/dashboard/inventory-management/grn/new">
            <Button variant="default" className="bg-primary hover:bg-primary/90 font-bold">
              <PlusCircle className="mr-2 h-4 w-4" /> Stock In (GRN)
            </Button>
          </Link>
          <Button onClick={() => setIsRequestDialogOpen(true)} variant="outline">
            Request Products
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 md:w-fit">
          <TabsTrigger value="inventory" className="px-8 font-bold">📦 Inventory List</TabsTrigger>
          <TabsTrigger value="warehouses" className="px-8 font-bold">🏢 Warehouse Items</TabsTrigger>
          <TabsTrigger value="grn" className="px-8 font-bold">📥 Stock In (GRN)</TabsTrigger>
          <TabsTrigger value="history" className="px-8 font-bold">🧭 Movement History</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items by name or description..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {inventoryCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Warehouse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Warehouses</SelectItem>
                  {warehouses.map(wh => (
                    <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedReorderStatus} onValueChange={setSelectedReorderStatus}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="critical">Out of Stock</SelectItem>
                  <SelectItem value="healthy">In Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="w-[120px]">Code</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Total Stock</TableHead>
                  <TableHead className="w-[150px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <div className="flex items-center justify-center gap-2">
                        Loading items...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No inventory items found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedItems.map((item) => (
                    <React.Fragment key={item.id}>
                      <TableRow className={cn("cursor-pointer hover:bg-slate-50", expandedRows[item.id] && "bg-slate-50/50")}>
                        <TableCell onClick={() => toggleRow(item.id)}>
                          <div className={cn("p-1 rounded-full transition-transform", expandedRows[item.id] && "rotate-180")}>
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs" onClick={() => toggleRow(item.id)}>{item.code}</TableCell>
                        <TableCell className="font-medium" onClick={() => toggleRow(item.id)}>
                          <div className="flex flex-col">
                            <span>{item.name}</span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[300px]">{item.description}</span>
                          </div>
                        </TableCell>
                        <TableCell onClick={() => toggleRow(item.id)}>
                          <Badge variant="outline" className="bg-slate-100/50">{item.category?.name || 'Uncategorized'}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold" onClick={() => toggleRow(item.id)}>
                          <div className="flex flex-col items-end">
                            <span className={cn(item.total_stock === 0 ? "text-destructive" : "text-primary")}>
                              {item.total_stock}
                            </span>
                            <span className="text-[9px] text-muted-foreground uppercase">{item.unit?.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(item)}>
                              <Edit className="h-4 w-4 text-primary" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-amber-600 hover:text-amber-700 hover:bg-amber-50" onClick={() => handleOpenTransactionDialog(item)}>
                              <ArrowRightLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteId(item.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      
                      {expandedRows[item.id] && (
                        <TableRow className="bg-slate-50/30">
                          <TableCell colSpan={6} className="p-0 border-t-0">
                            <div className="p-4 bg-slate-100/30 flex flex-col gap-3">
                              <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Store-wise Stock Breakdown</h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {item.warehouse_stock && item.warehouse_stock.length > 0 ? (
                                  item.warehouse_stock.map((ws: any) => (
                                    <div key={ws.id} className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm">
                                      <div className="flex items-center gap-2">
                                        <Warehouse className="h-3.5 w-3.5 text-primary/70" />
                                        <span className="text-xs font-semibold">{ws.name}</span>
                                      </div>
                                      <span className="text-sm font-bold">{ws.total_stock} <span className="text-[10px] font-normal text-muted-foreground uppercase">{item.unit?.name}</span></span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="col-span-3 text-center py-4 text-xs text-muted-foreground italic">
                                    No stock recorded for this item in any warehouse.
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
            {!isLoading && (
              <DataTablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="warehouses" className="space-y-6">
          <WarehouseItemMatrix 
            items={items} 
            warehouses={warehouses} 
            onRefresh={fetchData} 
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="grn">
          <TransactionHistoryTable 
            type="receive,initial_stock" 
            title="Recent Stock Intake (GRN)" 
            refreshKey={refreshHistory}
          />
        </TabsContent>

        <TabsContent value="history">
          <TransactionHistoryTable 
            title="All Inventory Movements" 
            refreshKey={refreshHistory}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Item' : 'New Inventory Item'}</DialogTitle>
          </DialogHeader>
          <InventoryItemFormV2
            key={editingItem ? editingItem.id : 'new'}
            item={editingItem}
            onSuccess={() => {
              setIsDialogOpen(false);
              setEditingItem(null);
              fetchData();
              toast({
                title: editingItem ? "Item Updated" : "Item Created",
                description: editingItem ? "Inventory details updated." : "New inventory item added.",
              });
            }}
          />
        </DialogContent>
      </Dialog>



      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Stock Transaction</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <InventoryTransactionForm
              item={editingItem as any}
              departments={warehouses as any}
              onSuccess={() => {
                setIsTransactionDialogOpen(false);
                fetchData();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen} modal={false}>
        <DialogContent
          className="max-w-xl"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Request Inventory Products</DialogTitle>
          </DialogHeader>
          <InventoryRequestForm
            items={items as any}
            onSubmit={handleRequestSubmit}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the inventory item.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && handleDelete(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
