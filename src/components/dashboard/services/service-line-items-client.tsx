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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Pencil, Trash2 } from 'lucide-react';
import type { ServiceLineItemMaster } from '@/lib/types';

// Must match the serviceType each services page passes to ServiceIncomeClient
// (or the Experience Inquiries page for 'Experience').
export const SERVICE_TYPES = [
  { value: 'Laundry', label: 'Laundry' },
  { value: 'Transport & Excursion', label: 'Transport & Excursion' },
  { value: 'Spa/Pool', label: 'Spa & Pool' },
  // Experience inquiries use these as the experience list; the amount is the rate per person.
  { value: 'Experience', label: 'Experience (rate per person)' },
];

const ALL = 'all';

export default function ServiceLineItemsClient() {
  const { toast } = useToast();
  const [items, setItems] = useState<ServiceLineItemMaster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>(ALL);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ServiceLineItemMaster | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0].value);
  const [name, setName] = useState('');
  const [defaultAmount, setDefaultAmount] = useState('');
  const [isActive, setIsActive] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/service-line-items');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setItems(data.items || []);
    } catch (error) {
      console.error("Error fetching line items:", error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to fetch service line items." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const visibleItems = filterType === ALL ? items : items.filter(i => i.service_type === filterType);

  const serviceLabel = (value: string) => SERVICE_TYPES.find(s => s.value === value)?.label || value;

  const handleOpenDialog = (item?: ServiceLineItemMaster) => {
    if (item) {
      setEditingItem(item);
      setServiceType(item.service_type);
      setName(item.name);
      setDefaultAmount(item.default_amount.toString());
      setIsActive(item.is_active);
    } else {
      setEditingItem(null);
      setServiceType(filterType === ALL ? SERVICE_TYPES[0].value : filterType);
      setName('');
      setDefaultAmount('');
      setIsActive(true);
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/service-line-items', {
        method: editingItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingItem?.id,
          service_type: serviceType,
          name,
          default_amount: parseFloat(defaultAmount) || 0,
          is_active: isActive,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      toast({
        title: editingItem ? "Line Item Updated" : "Line Item Added",
        description: `${name.trim()} is saved for ${serviceLabel(serviceType)}.`,
      });
      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Error", description: error.message || "Failed to save line item." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (item: ServiceLineItemMaster, value: boolean) => {
    setItems(items.map(i => i.id === item.id ? { ...i, is_active: value } : i));
    try {
      const res = await fetch('/api/admin/service-line-items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, is_active: value }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
    } catch (error) {
      setItems(items);
      toast({ variant: 'destructive', title: "Error", description: "Failed to update status." });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/admin/service-line-items?id=${deleteId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      toast({ title: "Line Item Deleted", description: "Existing records keep their saved description." });
      setItems(items.filter(i => i.id !== deleteId));
    } catch (error) {
      toast({ variant: 'destructive', title: "Error", description: "Failed to delete line item." });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-headline font-bold">Service Line Items</h1>
          <p className="text-muted-foreground">Set up the line items and default prices offered in the services dropdown.</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Line Item
        </Button>
      </div>

      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Service</Label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-9 w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All services</SelectItem>
              {SERVICE_TYPES.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service</TableHead>
              <TableHead>Line Item</TableHead>
              <TableHead className="text-right">Default Amount (LKR)</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10">Loading...</TableCell>
              </TableRow>
            ) : visibleItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No line items set up yet.</TableCell>
              </TableRow>
            ) : (
              visibleItems.map((item) => (
                <TableRow key={item.id} className={item.is_active ? '' : 'opacity-60'}>
                  <TableCell>{serviceLabel(item.service_type)}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-right">LKR {Number(item.default_amount).toFixed(2)}</TableCell>
                  <TableCell>
                    <Switch checked={item.is_active} onCheckedChange={(v) => handleToggleActive(item, v)} />
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(item)} title="Edit line item">
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
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Line Item' : 'Add Line Item'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Service</Label>
              <Select value={serviceType} onValueChange={setServiceType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="itemName">Line Item Name</Label>
              <Input id="itemName" placeholder="e.g. Shirt wash & iron" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultAmount">Default Amount (LKR)</Label>
              <Input id="defaultAmount" type="number" step="0.01" min="0" placeholder="0.00" value={defaultAmount} onChange={(e) => setDefaultAmount(e.target.value)} />
              <p className="text-xs text-muted-foreground">Filled in when the item is picked; it can still be changed on the record.</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
              <Label htmlFor="isActive">Active (shown in the dropdown)</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this line item?</AlertDialogTitle>
            <AlertDialogDescription>
              It will no longer appear in the dropdown. Records that already used it are not changed. To hide it temporarily, turn off Active instead.
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
