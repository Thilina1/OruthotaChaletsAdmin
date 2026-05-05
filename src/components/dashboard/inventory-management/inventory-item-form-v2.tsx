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
import type { InventoryItem, InventoryItemCategory, InventoryUnit } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Plus } from 'lucide-react';
import { CreatableCombobox } from '@/components/ui/creatable-combobox';
import { BarcodeScanner } from './barcode-scanner';
import { Camera } from 'lucide-react';


const formSchema = z.object({
  name: z.string().min(1, { message: 'Item name is required.' }),
  code: z.string().optional(),
  description: z.string().optional(),
  category_id: z.string().min(1, { message: 'Category is required.' }),
  unit_id: z.string().min(1, { message: 'Unit is required.' }),
  item_size: z.string().optional(),
  
  // Initial Batch Info
  batch_number: z.string().optional(),
  supplier: z.string().optional(),
  buying_price: z.coerce.number().min(0, { message: 'Buying price must be positive.' }),
  expiry_date: z.string().optional(),
  initial_quantity: z.coerce.number().min(0, { message: 'Quantity cannot be negative.' }),
});

interface InventoryItemFormV2Props {
  item?: InventoryItem | null;
  onSuccess: () => void;
}

export function InventoryItemFormV2({ item, onSuccess }: InventoryItemFormV2Props) {
  const [categories, setCategories] = useState<InventoryItemCategory[]>([]);
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: item?.name || '',
      code: item?.code || '',
      description: item?.description || '',
      category_id: item?.category_id || '',
      unit_id: item?.unit_id || '',
      item_size: item?.item_size || '',
      batch_number: '',
      supplier: '',
      buying_price: 0,
      expiry_date: '',
      initial_quantity: 0,
    },
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const [catRes, unitRes, sizesRes, suppRes, itemsRes] = await Promise.all([
          fetch('/api/admin/inventory/categories'),
          fetch('/api/admin/inventory/units'),
          fetch('/api/admin/inventory/sizes'),
          fetch('/api/admin/inventory/suppliers'),
          fetch('/api/admin/inventory/items?includeStock=false')
        ]);
        const catData = await catRes.json();
        const unitData = await unitRes.json();
        const sizesData = await sizesRes.json();
        const suppData = await suppRes.json();
        const itemsData = await itemsRes.json();
        
        setCategories(catData.categories || []);
        setUnits(unitData.units || []);
        setSizes(sizesData.sizes || []);
        setSuppliers(suppData.suppliers || []);
        setItems(itemsData.items || []);
      } catch (error) {
        console.error('Error fetching form data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  // Check for duplicates in real-time
  const selectedName = form.watch('name');
  const selectedUnit = form.watch('unit_id');

  useEffect(() => {
    if (selectedName && selectedUnit && !item) {
        const duplicate = items.find(i => 
            i.name.toLowerCase() === selectedName.toLowerCase() && 
            i.unit_id === selectedUnit
        );
        if (duplicate) {
            setDuplicateWarning(`Warning: "${selectedName}" is already registered with this unit.`);
        } else {
            setDuplicateWarning(null);
        }
    } else {
        setDuplicateWarning(null);
    }
  }, [selectedName, selectedUnit, items, item]);

  const handleNameSelect = (displayName: string) => {
    // Extract actual name if it follows "Name (Unit)" format
    const nameMatch = displayName.match(/^(.*?)(?:\s\((.*?)\))?$/);
    const actualName = nameMatch ? nameMatch[1] : displayName;
    const unitHint = nameMatch ? nameMatch[2] : null;

    form.setValue('name', actualName);
    
    // Find item to auto-fill
    // If we have a unitHint, try to find the exact name+unit combination
    const existing = items.find(i => {
        const itemUnitName = units.find(u => u.id === i.unit_id)?.name;
        if (unitHint) {
            return i.name.toLowerCase() === actualName.toLowerCase() && 
                   itemUnitName?.toLowerCase() === unitHint.toLowerCase();
        }
        return i.name.toLowerCase() === actualName.toLowerCase();
    });

    if (existing) {
        form.setValue('category_id', existing.category_id);
        form.setValue('unit_id', existing.unit_id);
        form.setValue('item_size', existing.item_size || '');
        form.setValue('code', existing.code);
        form.setValue('description', existing.description || '');
        setDuplicateWarning(null); // It's an existing item being "loaded"
    }
  };

  const handleCreateMetadata = async (type: 'category' | 'unit' | 'size', name: string) => {
    try {
      const endpoint = type === 'category' ? 'categories' : type === 'unit' ? 'units' : 'sizes';
      const res = await fetch(`/api/admin/inventory/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data[type]) {
        if (type === 'category') setCategories(prev => [...prev, data.category]);
        if (type === 'unit') setUnits(prev => [...prev, data.unit]);
        if (type === 'size') setSizes(prev => [...prev, data.size]);
        return data[type];
      }
    } catch (error) {
      console.error(`Error creating ${type}:`, error);
    }
    return null;
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      let finalSupplier = values.supplier;
      if (finalSupplier && !suppliers.some(s => s.name === finalSupplier)) {
        await fetch('/api/admin/inventory/suppliers', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: finalSupplier })
        });
      }

      const res = await fetch('/api/admin/inventory/items', {
        method: item ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item ? { ...values, id: item.id } : values),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setFormError(null);
      onSuccess();
    } catch (error: any) {
      console.error('Error submitting form:', error);
      setFormError(error.message || 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <ScrollArea className="h-[70vh] pr-4">
          <div className="space-y-8 pb-4">
            {/* Section 1: Item Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">1. Item Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="col-span-2 md:col-span-1">
                      <FormLabel>Item Name</FormLabel>
                      <FormControl>
                        <CreatableCombobox 
                            options={items.map(i => {
                                const unitName = units.find(u => u.id === i.unit_id)?.name;
                                return unitName ? `${i.name} (${unitName})` : i.name;
                            })}
                            value={field.value}
                            onValueChange={handleNameSelect}
                            placeholder="e.g. Basmati Rice"
                        />
                      </FormControl>
                      {duplicateWarning && (
                        <p className="text-[11px] font-medium text-amber-600 bg-amber-50 p-1 px-2 rounded-md border border-amber-200 mt-1 animate-in fade-in slide-in-from-top-1">
                            {duplicateWarning}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem className="col-span-2 md:col-span-1">
                      <FormLabel>Item Code / SKU</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input className="flex-1" placeholder="Leave blank to auto-generate" {...field} />
                          <BarcodeScanner 
                            onScan={(code) => form.setValue('code', code)} 
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Unique identifier. Leave blank for automatic creation.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <CreatableCombobox 
                            options={categories.map(cat => cat.name)}
                            value={categories.find(cat => cat.id === field.value)?.name || field.value || ''}
                            onValueChange={async (val) => {
                                const found = categories.find(c => c.name === val);
                                if (found) {
                                    field.onChange(found.id);
                                } else {
                                    const created = await handleCreateMetadata('category', val);
                                    if (created) field.onChange(created.id);
                                }
                            }}
                            placeholder="Select or type new..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unit_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit of Measure</FormLabel>
                      <FormControl>
                        <CreatableCombobox 
                            options={units.map(unit => unit.name)}
                            value={units.find(u => u.id === field.value)?.name || field.value || ''}
                            onValueChange={async (val) => {
                                const found = units.find(u => u.name === val);
                                if (found) {
                                    field.onChange(found.id);
                                } else {
                                    const created = await handleCreateMetadata('unit', val);
                                    if (created) field.onChange(created.id);
                                }
                            }}
                            placeholder="Select or type new..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="item_size"
                  render={({ field }) => (
                    <FormItem className="col-span-2 md:col-span-1">
                      <FormLabel>Package / Size</FormLabel>
                      <FormControl>
                        <CreatableCombobox 
                            options={sizes.map(s => s.name)}
                            value={field.value || ''}
                            onValueChange={async (val) => {
                                field.onChange(val);
                                const found = sizes.find(s => s.name.toLowerCase() === val.toLowerCase());
                                if (!found && val) {
                                    await handleCreateMetadata('size', val);
                                }
                            }}
                            placeholder="e.g. 500g, 1L"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Optional details about the item..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Section 2: Initial Batch (Only for new items) */}
            {!item && (
              <div className="space-y-4 p-4 rounded-xl border bg-primary/5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                  <Plus className="h-4 w-4" /> 2. Initial Batch & Stock
                </h3>
                <p className="text-[11px] text-muted-foreground italic mb-2">
                  Establishing the system? Add your opening balance here. All stock will be added to the Main Warehouse.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="batch_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Batch Number</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. B-001 or Auto" {...field} />
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

                <FormField
                  control={form.control}
                  name="supplier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier / Brand</FormLabel>
                      <FormControl>
                        <CreatableCombobox 
                            options={suppliers.map(s => s.name)}
                            value={field.value || ''}
                            onValueChange={field.onChange}
                            placeholder="Select or type new..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
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
                  <FormField
                    control={form.control}
                    name="initial_quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Opening Quantity</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {formError && (
            <div className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2 animate-in fade-in slide-in-from-bottom-1">
                <span className="font-bold">Error:</span> {formError}
            </div>
        )}

        <div className="flex justify-end pt-4 border-t">
          <Button type="submit" disabled={isSubmitting} className="min-w-[150px]">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : item ? 'Save Changes' : 'Create & Record Stock'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
