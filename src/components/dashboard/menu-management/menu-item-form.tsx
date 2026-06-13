
'use client';

import { useForm, useWatch } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { MenuItem, MenuSection, HotelInventoryItem, InventoryDepartment } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle } from 'lucide-react';

const stockTypes = ['Inventoried', 'Non-Inventoried'] as const;

const INVENTORY_CATEGORIES = [
  'Food & Beverage', 'Cleaning Materials & Chemicals', 'Guest Amenities',
  'Linen & Fabrics', 'Maintenance & Hardware', 'Garden Supplies',
  'Stationery & Packaging', 'Crockery, Cutlery & Glassware', 'Kitchen Utensils',
  'Staff Uniforms', 'Fuel & Gas', 'First Aid & Safety',
] as const;

const UOM_TYPES = ['kg', 'packets', 'L', 'bottles', 'Nos', 'rolls', 'tins', 'reams', 'cylinders', 'cards'] as const;

const formSchema = z.object({
  name: z.string().min(1, { message: 'Item name is required.' }),
  description: z.string().optional(),
  price: z.coerce.number().min(0),
  buyingPrice: z.coerce.number().min(0),
  category: z.string().min(1, { message: 'Category is required.' }),
  availability: z.boolean(),
  stockType: z.enum(stockTypes),
  stock: z.coerce.number().optional(),
  linked_inventory_item_id: z.string().optional(),
  inventory_category: z.string().optional(),
  department_id: z.string().optional(),
  unit: z.string().optional(),
  safety_stock: z.coerce.number().optional(),
  reorder_level: z.coerce.number().optional(),
  maximum_level: z.coerce.number().optional(),
});

export type BatchPriceEntry = {
  batch_id: string;
  pricing_id: string | null;
  selling_price: number;
};

export type MenuItemFormValues = z.infer<typeof formSchema> & {
  batchPrices?: BatchPriceEntry[];
};

interface BatchRow {
  id: string;
  batch_number: string;
  supplier?: string;
  expiry_date?: string;
  buying_price: number;
  pricing_id: string | null;
  selling_price: number | null;
  total_stock: number;
  warehouse_stock: { name: string; quantity: number }[];
  _price: string;
}

interface MenuItemFormProps {
  item?: MenuItem | null;
  onSubmit: (values: MenuItemFormValues) => void;
  categories: MenuSection[] | undefined;
  inventoryItems?: HotelInventoryItem[] | undefined;
  departments?: InventoryDepartment[] | undefined;
  restaurantWarehouseIds?: string[];
}

function isExpired(d?: string) { return d ? new Date(d) < new Date() : false; }
function isExpiringSoon(d?: string) {
  if (!d || isExpired(d)) return false;
  const t = new Date(); t.setDate(t.getDate() + 30);
  return new Date(d) <= t;
}
function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function MenuItemForm({ item, onSubmit, categories, inventoryItems = [], departments = [], restaurantWarehouseIds = [] }: MenuItemFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: item?.name || '',
      description: item?.description || '',
      price: item?.price || 0,
      buyingPrice: item?.buying_price || 0,
      category: item?.category || (categories && categories.length > 0 ? categories[0].name : ''),
      availability: item?.availability ?? true,
      stockType: item?.stock_type || 'Non-Inventoried',
      stock: item?.stock || 0,
      linked_inventory_item_id: item?.linked_inventory_item_id || 'none',
      inventory_category: 'Food & Beverage',
      department_id: 'none',
      unit: 'Nos',
      safety_stock: 0,
      reorder_level: 0,
      maximum_level: 0,
    },
  });

  const watchedStockType = useWatch({ control: form.control, name: 'stockType' });
  const watchedLinkedId = useWatch({ control: form.control, name: 'linked_inventory_item_id' });

  // Batch state
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  // Fetch batches whenever selected inventory item changes
  useEffect(() => {
    if (watchedStockType !== 'Inventoried' || !watchedLinkedId || watchedLinkedId === 'none') {
      setBatches([]);
      setBatchError(null);
      return;
    }
    let cancelled = false;
    setBatchesLoading(true);
    setBatchError(null);

    const menuItemId = item?.id ?? '';
    const url = menuItemId
      ? `/api/admin/inventory/batches?item_id=${watchedLinkedId}&menu_item_id=${menuItemId}`
      : `/api/admin/inventory/batches?item_id=${watchedLinkedId}`;

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.error) { setBatchError(data.error); return; }
        setBatches((data.batches as any[]).map(b => ({
          ...b,
          _price: b.selling_price != null ? String(b.selling_price) : '',
        })));
      })
      .catch(e => { if (!cancelled) setBatchError(e.message); })
      .finally(() => { if (!cancelled) setBatchesLoading(false); });

    return () => { cancelled = true; };
  }, [watchedStockType, watchedLinkedId, item?.id]);

  const handleBatchPriceChange = (batchId: string, value: string) => {
    setBatches(prev => prev.map(b => b.id === batchId ? { ...b, _price: value } : b));
  };

  // Restaurant warehouse filtering using saved setting
  const restaurantItems = restaurantWarehouseIds.length > 0
    ? inventoryItems.filter(inv => {
        const ws = (inv as any).warehouse_stock as Array<{ id: string; total_stock: number }> | undefined;
        return ws?.some(wh => restaurantWarehouseIds.includes(wh.id) && wh.total_stock > 0);
      })
    : inventoryItems;

  const dropdownItems = restaurantItems;

  const getRestaurantStock = (inv: HotelInventoryItem) => {
    const ws = (inv as any).warehouse_stock as Array<{ id: string; total_stock: number }> | undefined;
    if (!ws?.length) return (inv as any).total_stock ?? 0;
    if (restaurantWarehouseIds.length > 0) {
      return ws.filter(wh => restaurantWarehouseIds.includes(wh.id)).reduce((sum, wh) => sum + wh.total_stock, 0);
    }
    return ws.reduce((sum, wh) => sum + wh.total_stock, 0);
  };

  const getUnit = (inv: HotelInventoryItem) =>
    typeof inv.unit === 'string' ? inv.unit : ((inv.unit as any)?.name ?? '');

  // Wrap submit to merge batch prices
  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    const batchPrices: BatchPriceEntry[] = batches
      .filter(b => b._price !== '' && !isNaN(parseFloat(b._price)))
      .map(b => ({
        batch_id: b.id,
        pricing_id: b.pricing_id,
        selling_price: parseFloat(b._price),
      }));
    onSubmit({ ...values, batchPrices });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <ScrollArea className="h-[75vh] w-full pr-4">
          <div className="space-y-6">

            {/* ── 1. Inventory Settings ── */}
            <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
              <h3 className="text-lg font-semibold">Inventory Settings</h3>

              <FormField
                control={form.control}
                name="stockType"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel>Stock Type</FormLabel>
                    <FormControl>
                      <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-6">
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormControl><RadioGroupItem value="Non-Inventoried" /></FormControl>
                          <FormLabel className="font-normal cursor-pointer">Non-Inventoried</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormControl><RadioGroupItem value="Inventoried" /></FormControl>
                          <FormLabel className="font-normal cursor-pointer">Inventoried</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchedStockType === 'Inventoried' && (
                <>
                  {/* Item dropdown */}
                  <FormField
                    control={form.control}
                    name="linked_inventory_item_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Restaurant Warehouse Item
                          {restaurantItems.length > 0 && (
                            <Badge variant="outline" className="ml-2 text-xs font-normal">
                              {restaurantItems.length} available
                            </Badge>
                          )}
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value || 'none'}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select an item from inventory..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {dropdownItems.map(inv => {
                              const qty = getRestaurantStock(inv);
                              const unit = getUnit(inv);
                              return (
                                <SelectItem key={inv.id} value={inv.id}>
                                  <span className="flex items-center gap-2">
                                    {inv.name}
                                    <span className={`text-xs ${qty === 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                      ({qty} {unit})
                                    </span>
                                  </span>
                                </SelectItem>
                              );
                            })}
                            <SelectItem value="none">
                              <span className="text-muted-foreground italic">+ Create new inventory item</span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {restaurantItems.length > 0
                            ? 'Showing items with stock in the restaurant warehouse.'
                            : 'No restaurant-warehouse items found — showing all inventory.'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Batch pricing table */}
                  {watchedLinkedId && watchedLinkedId !== 'none' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold">Available Batches — Set Selling Price</h4>
                        {batchesLoading && <span className="text-xs text-muted-foreground">Loading…</span>}
                      </div>

                      {batchError && (
                        <div className="flex items-center gap-2 text-sm text-destructive border border-destructive/30 rounded p-2 bg-destructive/5">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          {batchError}
                        </div>
                      )}

                      {batchesLoading ? (
                        <div className="space-y-1">
                          {[1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                        </div>
                      ) : !batchError && batches.length === 0 ? (
                        <p className="text-sm text-muted-foreground border rounded p-3 text-center">
                          No active batches found. Receive stock via Inventory → Stock Intake first.
                        </p>
                      ) : !batchError && (
                        <div className="border rounded-md overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/40">
                                <TableHead className="text-xs">Batch #</TableHead>
                                <TableHead className="text-xs">Expiry</TableHead>
                                <TableHead className="text-xs text-right">Buying</TableHead>
                                <TableHead className="text-xs text-center">Stock</TableHead>
                                <TableHead className="text-xs">Selling Price (LKR)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {batches.map(batch => {
                                const expired = isExpired(batch.expiry_date);
                                const expiringSoon = isExpiringSoon(batch.expiry_date);
                                return (
                                  <TableRow key={batch.id} className={expired ? 'opacity-50' : ''}>
                                    <TableCell className="font-mono text-xs py-2">
                                      {batch.batch_number || <span className="italic text-muted-foreground">—</span>}
                                      {expired && <Badge variant="destructive" className="ml-1 text-[10px] px-1 py-0">Exp</Badge>}
                                      {expiringSoon && <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0 border-orange-400 text-orange-600">Soon</Badge>}
                                    </TableCell>
                                    <TableCell className={`text-xs py-2 ${expired ? 'text-destructive font-medium' : expiringSoon ? 'text-orange-600' : ''}`}>
                                      {fmtDate(batch.expiry_date)}
                                    </TableCell>
                                    <TableCell className="text-xs text-right py-2 font-mono">
                                      {batch.buying_price.toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-xs text-center py-2 font-semibold">
                                      {batch.total_stock}
                                    </TableCell>
                                    <TableCell className="py-2">
                                      <div className="flex items-center gap-1">
                                        <Input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          placeholder={batch.selling_price != null ? String(batch.selling_price) : 'Set price…'}
                                          className="h-7 w-28 text-xs"
                                          value={batch._price}
                                          onChange={e => handleBatchPriceChange(batch.id, e.target.value)}
                                        />
                                        {batch.selling_price != null && batch._price === '' && (
                                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                            current: {batch.selling_price.toFixed(2)}
                                          </span>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Create new inventory item sub-form */}
                  {watchedLinkedId === 'none' && (
                    <div className="space-y-4 border p-4 rounded-md bg-background">
                      <h4 className="font-semibold text-sm">New Inventory Item Details</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="inventory_category" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Inventory Category</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger></FormControl>
                              <SelectContent>
                                {INVENTORY_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="department_id" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Primary Department</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="none">-- Select --</SelectItem>
                                {departments?.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="unit" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Unit of Measure</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select UoM" /></SelectTrigger></FormControl>
                              <SelectContent>
                                {UOM_TYPES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="stock" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Initial Stock</FormLabel>
                            <FormControl><Input type="number" placeholder="0" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="safety_stock" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Safety Stock</FormLabel>
                            <FormControl><Input type="number" placeholder="0" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="reorder_level" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Reorder Level</FormLabel>
                            <FormControl><Input type="number" placeholder="0" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── 2. General Details + Pricing ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">General Details</h3>
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl><Input placeholder="e.g., Fish and Chips" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea placeholder="A short description." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Menu Section</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {categories?.map(cat => <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Pricing & Availability</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="price" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Selling Price (LKR)</FormLabel>
                      <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="buyingPrice" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Buying Price (LKR)</FormLabel>
                      <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="availability" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <FormLabel>Available for Sale</FormLabel>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />
              </div>
            </div>

          </div>
        </ScrollArea>

        <Button type="submit" className="w-full">
          {item ? 'Update Item' : 'Create Item'}
        </Button>
      </form>
    </Form>
  );
}
