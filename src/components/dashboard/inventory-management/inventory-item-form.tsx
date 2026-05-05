'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import type { HotelInventoryItem, InventoryDepartment, MenuSection } from '@/lib/types';
import { INVENTORY_UOM } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CreatableCombobox } from '@/components/ui/creatable-combobox';
import { useMemo } from 'react';

// Categories will be fetched dynamically from the API

// The standard units will be merged with dynamic metadata units in the component

const formSchema = z.object({
  name: z.string().min(1, { message: 'Item name is required.' }),
  description: z.string().optional(),
  category: z.string().min(1, { message: 'Category is required.' }),
  department_id: z.string().min(1, { message: 'Please select an assigned department.' }),
  unit: z.string().min(1, { message: 'Unit of measure is required.' }),
  item_size: z.string().optional(),
  brand: z.string().optional(),
  supplier: z.string().optional(),
  buying_price: z.coerce.number().min(0, { message: 'Must be a positive number.' }),
  current_stock: z.coerce.number().min(0),
  safety_stock: z.coerce.number().min(0, { message: 'Safety stock cannot be negative.' }),
  reorder_level: z.coerce.number().min(0, { message: 'Reorder level cannot be negative.' }),
  maximum_level: z.coerce.number().min(0),
  status: z.enum(['active', 'inactive']).default('active'),
  is_menu_item: z.boolean().default(false).optional(),
  menu_price: z.coerce.number().optional(),
  menu_category: z.string().optional(),
  batch_number: z.string().optional(),
  expiry_date: z.string().optional(),
});

interface InventoryItemFormProps {
  item?: HotelInventoryItem | null;
  onSubmit: (values: z.infer<typeof formSchema>) => void;
  departments: InventoryDepartment[];
  menuCategories?: MenuSection[];
}

export function InventoryItemForm({ item, onSubmit, departments, menuCategories = [] }: InventoryItemFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: item?.product?.name || item?.name || '',
      description: item?.product?.description || item?.description || '',
      category: (item?.product?.category || item?.category || 'Food & Beverage') as any,
      department_id: item?.department_id || (departments.find(d => d.name === 'Store')?.id || departments.find(d => d.name.toLowerCase() === 'store')?.id || (departments.length > 0 ? departments[0].id : '')),
      unit: (item?.product?.unit || item?.unit || 'Nos') as any,
      item_size: item?.item_size || '',
      brand: item?.brand || '',
      supplier: item?.supplier || '',
      buying_price: item?.buying_price || 0,
      current_stock: item?.current_stock || 0,
      safety_stock: item?.product?.safety_stock ?? item?.safety_stock ?? 0,
      reorder_level: item?.product?.reorder_level ?? item?.reorder_level ?? 0,
      maximum_level: item?.maximum_level || 0,
      status: item?.status || 'active',
      is_menu_item: !!item?.menu_items && item.menu_items.length > 0,
      menu_price: item?.menu_items?.[0]?.price || 0,
      menu_category: item?.menu_items?.[0]?.category || 'Beverages',
      batch_number: item?.batch_number || '',
      expiry_date: item?.expiry_date || '',
    },
  });

  const [metadata, setMetadata] = useState<{
    brands: string[],
    suppliers: string[],
    sizes: string[],
    units: string[],
    categories: string[],
    itemNames: string[]
  }>({
    brands: [],
    suppliers: [],
    sizes: [],
    units: [],
    categories: [],
    itemNames: []
  });

  const [categoriesData, setCategoriesData] = useState<any[]>([]);
  const [unitsData, setUnitsData] = useState<any[]>([]);

  const fetchMetadata = async () => {
    try {
      const [catRes, unitRes, itemNamesRes, sizesRes] = await Promise.all([
        fetch('/api/admin/inventory/categories'),
        fetch('/api/admin/inventory/units'),
        fetch('/api/admin/inventory/item-names'),
        fetch('/api/admin/inventory/sizes')
      ]);

      const catJson = await catRes.json();
      const unitJson = await unitRes.json();
      const itemNamesData = await itemNamesRes.json();
      const sizesData = await sizesRes.json();

      setCategoriesData(catJson.categories || []);
      setUnitsData(unitJson.units || []);

      setMetadata(prev => ({
        ...prev,
        categories: catJson.categories?.map((c: any) => c.name) || [],
        units: Array.from(new Set([...INVENTORY_UOM, ...(unitJson.units?.map((u: any) => u.name) || [])])),
        itemNames: itemNamesData.itemNames?.map((n: any) => n.name) || [],
        sizes: sizesData.sizes?.map((s: any) => s.name) || []
      }));
    } catch (err) {
      console.error('Error fetching inventory metadata:', err);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  const handleCreateMetadata = async (type: string, name: string) => {
    if (!name) return;
    try {
      let endpoint = '';
      if (type === 'category') endpoint = '/api/admin/inventory/categories';
      else if (type === 'unit') endpoint = '/api/admin/inventory/units';
      else if (type === 'itemName') endpoint = '/api/admin/inventory/item-names';
      else if (type === 'size') endpoint = '/api/admin/inventory/sizes';
      
      if (!endpoint) return;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      
      if (res.ok) {
        const data = await res.json();
        await fetchMetadata();
        return data[type];
      }
    } catch (err) {
      console.error(`Failed to create ${type}:`, err);
    }
    return null;
  };

  const isMenuItem = form.watch('is_menu_item');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <ScrollArea className="h-[65vh] w-full pr-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="col-span-1 md:col-span-2 space-y-4">
              <h3 className="text-lg font-semibold">General Details</h3>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                        <CreatableCombobox 
                            options={metadata.itemNames}
                            value={field.value}
                            onValueChange={(val) => {
                              field.onChange(val);
                              if (val && !metadata.itemNames.some(n => n.toLowerCase() === val.toLowerCase())) {
                                handleCreateMetadata('itemName', val);
                              }
                            }}
                            placeholder="Select or type item name (e.g., A4 Paper)"
                        />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Specific details about the item" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

                <FormField
                  control={form.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand</FormLabel>
                      <FormControl>
                        <CreatableCombobox 
                            options={metadata.brands}
                            value={field.value}
                            onValueChange={(val) => {
                              field.onChange(val);
                              if (val && !metadata.brands.some(b => b.toLowerCase() === val.toLowerCase())) {
                                handleCreateMetadata('brand', val);
                              }
                            }}
                            placeholder="Select or type brand"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="supplier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Supplier / Vendor</FormLabel>
                      <FormControl>
                        <CreatableCombobox 
                            options={metadata.suppliers}
                            value={field.value}
                            onValueChange={(val) => {
                              field.onChange(val);
                              if (val && !metadata.suppliers.some(s => s.toLowerCase() === val.toLowerCase())) {
                                handleCreateMetadata('supplier', val);
                              }
                            }}
                            placeholder="Select or type supplier"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="batch_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Batch Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., B-101" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="expiry_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiry Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4 mt-4">
              <h3 className="text-lg font-semibold border-b pb-2">Category & Store</h3>
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                        <CreatableCombobox 
                            options={metadata.categories}
                            value={field.value}
                            onValueChange={async (val) => {
                              field.onChange(val);
                              if (val && !metadata.categories.some(c => c.toLowerCase() === val.toLowerCase())) {
                                await handleCreateMetadata('category', val);
                              }
                            }}
                            placeholder="Select or type category"
                        />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="department_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Store</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select store" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departments.map(dept => (
                          <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4 mt-4">
              <h3 className="text-lg font-semibold border-b pb-2">Unit & Pricing</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="unit"
                    render={({ field }) => {
                      const allUnits = useMemo(() => {
                        const standard = [...INVENTORY_UOM];
                        const fromMeta = metadata.units || [];
                        return Array.from(new Set([...standard, ...fromMeta])).sort();
                      }, [metadata.units]);

                      return (
                        <FormItem>
                          <FormLabel>UoM</FormLabel>
                          <FormControl>
                            <CreatableCombobox 
                              options={allUnits}
                              value={field.value}
                              onValueChange={async (val) => {
                                field.onChange(val);
                                if (val && !allUnits.some(u => u.toLowerCase() === val.toLowerCase())) {
                                  await handleCreateMetadata('unit', val);
                                }
                              }}
                              placeholder="Select or type unit"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                  <FormField
                    control={form.control}
                    name="item_size"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Size / Pkg</FormLabel>
                        <FormControl>
                          <CreatableCombobox 
                            options={metadata.sizes}
                            value={field.value}
                            onValueChange={async (val) => {
                              field.onChange(val);
                              if (val && !metadata.sizes.some(s => s.toLowerCase() === val.toLowerCase())) {
                                await handleCreateMetadata('size', val);
                              }
                            }}
                            placeholder="Select or type size"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              <FormField
                control={form.control}
                name="buying_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Buying Price (LKR)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="col-span-1 md:col-span-2 space-y-4 mt-6 p-4 rounded-md border bg-muted/20">
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Sell as Menu Item?</FormLabel>
                  <FormDescription>
                    Automatically create this as a sellable item in the Restaurant Menu.
                  </FormDescription>
                </div>
                <FormField
                  control={form.control}
                  name="is_menu_item"
                  render={({ field }) => (
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  )}
                />
              </div>

              {isMenuItem && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <FormField
                    control={form.control}
                    name="menu_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Selling Price (LKR)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormDescription>The customer-facing price.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="menu_category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Menu Section (Category)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Section" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {menuCategories.map(cat => (
                              <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>Where it appears on the menu.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            <div className="col-span-1 md:col-span-2 space-y-4 mt-6">
              <h3 className="text-lg font-semibold border-b pb-2">Stock Details (Alerts & Audits)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="current_stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Stock</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} disabled />
                      </FormControl>
                      <FormDescription className="text-xs">Value is managed via Add Stock requests.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="safety_stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Safety Stock</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormDescription className="text-xs">Emergency reserves.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reorder_level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reorder Level (ROL)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormDescription className="text-xs">Trigger for new order.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maximum_level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Stock Level</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormDescription className="text-xs">Ceiling amount.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

          </div>
        </ScrollArea>
        <div className="pt-4 border-t">
          <Button type="submit" className="w-full">
            {item ? 'Save Item Settings' : 'Create Inventory Item'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
