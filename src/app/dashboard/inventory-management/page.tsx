'use client';

import { useState, useEffect } from 'react';
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusCircle, Pencil, Trash2, ArrowRightLeft, AlertTriangle, Search, Filter } from 'lucide-react';
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
import type { HotelInventoryItem, InventoryDepartment, MenuSection } from '@/lib/types';
import { InventoryItemForm } from '@/components/dashboard/inventory-management/inventory-item-form';
import { InventoryTransactionForm } from '@/components/dashboard/inventory-management/inventory-transaction-form';
import { InventoryRequestForm } from '@/components/dashboard/inventory-management/request-form';
import { Badge } from '@/components/ui/badge';
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

export default function InventoryManagementPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<HotelInventoryItem[]>([]);
  const [departments, setDepartments] = useState<InventoryDepartment[]>([]);
  const [menuCategories, setMenuCategories] = useState<MenuSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HotelInventoryItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Filtering state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedReorderStatus, setSelectedReorderStatus] = useState<string>('all');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [itemsRes, deptsRes, categoriesRes] = await Promise.all([
        fetch('/api/admin/hotel-inventory'),
        fetch('/api/admin/inventory-departments'),
        fetch('/api/admin/menu-sections')
      ]);

      const dataItems = await itemsRes.json();
      const dataDepts = await deptsRes.json();
      const dataCategories = await categoriesRes.json();

      if (dataItems.error) throw new Error(dataItems.error);
      setItems(dataItems.items || []);

      if (dataDepts.error) throw new Error(dataDepts.error);
      setDepartments(dataDepts.departments || []);

      if (dataCategories.error) throw new Error(dataCategories.error);
      setMenuCategories(dataCategories.sections || []);

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

  const handleOpenDialog = (item?: HotelInventoryItem) => {
    setEditingItem(item || null);
    setIsDialogOpen(true);
  };

  const handleOpenTransactionDialog = (item: HotelInventoryItem) => {
    setEditingItem(item);
    setIsTransactionDialogOpen(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      const url = editingItem ? '/api/admin/hotel-inventory' : '/api/admin/hotel-inventory';
      const method = editingItem ? 'PUT' : 'POST';

      const body = {
        id: editingItem?.id,
        name: values.name,
        description: values.description,
        category: values.category,
        department_id: values.department_id,
        unit: values.unit,
        buying_price: values.buying_price,
        current_stock: values.current_stock,
        safety_stock: values.safety_stock,
        reorder_level: values.reorder_level,
        maximum_level: values.maximum_level,
        is_menu_item: values.is_menu_item,
        menu_price: values.menu_price,
        menu_category: values.menu_category
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // If new item and starting stock > 0, we could automatically record an initial_stock transaction.
      // But for simplicity, we'll let them add stock manually or just set it here.

      toast({
        title: editingItem ? "Item Updated" : "Item Created",
        description: editingItem ? "Inventory details updated." : "New inventory item added.",
      });

      setIsDialogOpen(false);
      setEditingItem(null);
      fetchData();
    } catch (error) {
      console.error("Error saving item:", error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to save item." });
    }
  };

  const handleDelete = async () => {
    toast({ variant: 'destructive', title: "Deletion Disabled", description: "To maintain historical records and avoid transaction issues, deletion is disabled. Please set the status to inactive instead." });
    setDeleteId(null);
  };

  const handleRequestSubmit = async (values: any) => {
    try {
      const res = await fetch('/api/admin/inventory-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
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

  const uniqueCategories = Array.from(new Set(items.map(item => item.category))).filter(Boolean);

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesDepartment = selectedDepartment === 'all' || item.department_id === selectedDepartment;

    const matchesReorderStatus = selectedReorderStatus === 'all' ||
      (selectedReorderStatus === 'critical' && item.current_stock <= item.safety_stock) ||
      (selectedReorderStatus === 'needs_reorder' && item.current_stock <= item.reorder_level && item.current_stock > item.safety_stock) ||
      (selectedReorderStatus === 'healthy' && item.current_stock > item.reorder_level);

    return matchesSearch && matchesCategory && matchesDepartment && matchesReorderStatus;
  });

  const {
    currentPage,
    totalPages,
    totalItems,
    paginatedItems,
    itemsPerPage,
    setCurrentPage,
  } = usePagination(filteredItems, 20);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedDepartment, selectedReorderStatus, setCurrentPage]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Hotel Inventory Management</h1>
          <p className="text-muted-foreground">Manage centralized hotel inventory, departments, and stock limits.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsRequestDialogOpen(true)} variant="outline">
            Request Products
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Item
          </Button>
        </div>
      </div>

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
              {uniqueCategories.map(category => (
                <SelectItem key={category} value={category}>{category}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map(dept => (
                <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedReorderStatus} onValueChange={setSelectedReorderStatus}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="critical">Critical Stock</SelectItem>
              <SelectItem value="needs_reorder">Needs Reorder</SelectItem>
              <SelectItem value="healthy">Healthy</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item Name</TableHead>
              <TableHead>Category & Dept</TableHead>
              <TableHead>Stock (UoM)</TableHead>
              <TableHead>Reorder Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10">Loading...</TableCell>
              </TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No inventory items found.</TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((item) => {
                const isLowStock = item.current_stock <= item.reorder_level;
                const isCriticalStock = item.current_stock <= item.safety_stock;

                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.name}
                      {item.description && <div className="text-xs text-muted-foreground">{item.description}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm">{item.category}</span>
                        <Badge variant="outline" className="w-fit text-xs">{item.department?.name}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-bold flex items-center gap-2">
                        <span className={isCriticalStock ? 'text-destructive' : isLowStock ? 'text-orange-500' : ''}>
                          {item.current_stock}
                        </span>
                        <span className="text-sm font-normal text-muted-foreground">{item.unit}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isCriticalStock ? (
                        <div className="flex items-center text-destructive text-sm font-semibold">
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          Critical Stock
                        </div>
                      ) : isLowStock ? (
                        <div className="flex items-center text-orange-500 text-sm font-semibold">
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          Needs Reorder
                        </div>
                      ) : (
                        <span className="text-green-600 text-sm">Healthy</span>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        Reorder at: {item.reorder_level}
                      </div>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleOpenTransactionDialog(item)}>
                        <ArrowRightLeft className="h-4 w-4 mr-2" /> Match / Transfer
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Item' : 'New Inventory Item'}</DialogTitle>
          </DialogHeader>
          <InventoryItemForm
            key={editingItem ? editingItem.id : 'new'}
            item={editingItem}
            onSubmit={handleSubmit}
            departments={departments}
            menuCategories={menuCategories}
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
              item={editingItem}
              departments={departments}
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
            items={items}
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
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
