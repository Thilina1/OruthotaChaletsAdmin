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
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Pencil, Trash2 } from 'lucide-react';
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
import type { MenuItem, MenuSection } from '@/lib/types';
import { InventoryItemForm } from '@/components/dashboard/inventory-management/inventory-item-form';

export default function InventoryManagementPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [itemsRes, categoriesRes] = await Promise.all([
        fetch('/api/admin/inventory'),
        fetch('/api/admin/menu-sections')
      ]);

      const dataItems = await itemsRes.json();
      const dataCategories = await categoriesRes.json();

      if (dataItems.error) throw new Error(dataItems.error);
      setItems(dataItems.items || []);

      if (dataCategories.error) throw new Error(dataCategories.error);
      setCategories(dataCategories.sections || []);

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

  const handleOpenDialog = (item?: MenuItem) => {
    setEditingItem(item || null);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      const url = editingItem ? '/api/admin/inventory' : '/api/admin/inventory';
      const method = editingItem ? 'PUT' : 'POST';

      // Map values if necessary, assuming API expects database schema
      // InventoryItemForm returns camelCase or matches internal state. 
      // We need to map to snake_case for DB if the API doesn't handle it.
      // My API implementation expects snake_case for `insert` but `InventoryItemForm` produces:
      // name, description, price, buyingPrice, category, availability, stockType, stock, varietyOfDishesh, sellType, unit

      const body = {
        id: editingItem?.id,
        name: values.name,
        description: values.description,
        price: values.price,
        buying_price: values.buyingPrice,
        category: values.category,
        availability: values.availability,
        stock_type: 'Inventoried', // Force inventoried
        stock: values.stock,
        variety_of_dishes: values.varietyOfDishes,
        sell_type: values.sellType,
        unit: values.unit
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

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
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/admin/inventory?id=${deleteId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      toast({ title: "Item Deleted", description: "The item has been removed." });
      setItems(items.filter(i => i.id !== deleteId));
    } catch (error) {
      console.error("Error deleting item:", error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to delete item." });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-headline font-bold">Inventory Management</h1>
          <p className="text-muted-foreground">Manage inventoried items and stock levels.</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Item
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Buying Price</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">Loading...</TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No inventory items found.</TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.name}
                    {item.description && <div className="text-xs text-muted-foreground">{item.description}</div>}
                  </TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>
                    <div className={`font-bold ${item.stock && item.stock < 10 ? 'text-red-500' : ''}`}>
                      {item.stock}
                    </div>
                  </TableCell>
                  <TableCell>{item.unit || '-'}</TableCell>
                  <TableCell>LKR {item.buying_price?.toFixed(2) || '0.00'}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(item.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Item' : 'New Inventory Item'}</DialogTitle>
          </DialogHeader>
          {/* Key forces re-render when switching between add/edit or new item to reset internal form state */}
          <InventoryItemForm
            key={editingItem ? editingItem.id : 'new'}
            item={editingItem}
            onSubmit={handleSubmit}
            categories={categories}
            varietyOfDishes={categories} // Use same sections for variety
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the inventory item.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
