'use client';

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
import { ScrollArea } from '@/components/ui/scroll-area';

const INVENTORY_CATEGORIES = [
  'Food & Beverage',
  'Cleaning Materials & Chemicals',
  'Guest Amenities',
  'Linen & Fabrics',
  'Maintenance & Hardware',
  'Garden Supplies',
  'Stationery & Packaging',
  'Crockery, Cutlery & Glassware',
  'Kitchen Utensils',
  'Staff Uniforms',
  'Fuel & Gas',
  'First Aid & Safety'
] as const;

const UOM_TYPES = ['kg', 'packets', 'L', 'bottles', 'Nos', 'rolls', 'tins', 'reams', 'cylinders', 'cards'] as const;

const formSchema = z.object({
  name: z.string().min(1, { message: 'Item name is required.' }),
  description: z.string().optional(),
  category: z.enum(INVENTORY_CATEGORIES),
  department_id: z.string().min(1, { message: 'Please select an assigned department.' }),
  unit: z.enum(UOM_TYPES),
  buying_price: z.coerce.number().min(0, { message: 'Must be a positive number.' }),
  current_stock: z.coerce.number().min(0),
  safety_stock: z.coerce.number().min(0, { message: 'Safety stock cannot be negative.' }),
  reorder_level: z.coerce.number().min(0, { message: 'Reorder level cannot be negative.' }),
  maximum_level: z.coerce.number().min(0),
  status: z.enum(['active', 'inactive']).default('active'),
  is_menu_item: z.boolean().default(false).optional(),
  menu_price: z.coerce.number().optional(),
  menu_category: z.string().optional(),
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
      name: item?.name || '',
      description: item?.description || '',
      category: (item?.category as any) || 'Food & Beverage',
      department_id: item?.department_id || (departments.find(d => d.name === 'Store')?.id || departments.find(d => d.name.toLowerCase() === 'store')?.id || (departments.length > 0 ? departments[0].id : '')),
      unit: (item?.unit as any) || 'Nos',
      buying_price: item?.buying_price || 0,
      current_stock: item?.current_stock || 0,
      safety_stock: item?.safety_stock || 0,
      reorder_level: item?.reorder_level || 0,
      maximum_level: item?.maximum_level || 0,
      status: item?.status || 'active',
      is_menu_item: !!item?.menu_items && item.menu_items.length > 0,
      menu_price: item?.menu_items?.[0]?.price || 0,
      menu_category: item?.menu_items?.[0]?.category || 'Beverages',
    },
  });

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
                      <Input placeholder="e.g., A4 Paper, Soap, Dhal" {...field} />
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
                    <FormLabel>Description / Brand</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Specific details or brand" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4 mt-4">
              <h3 className="text-lg font-semibold border-b pb-2">Category & Store</h3>
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INVENTORY_CATEGORIES.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit of Measurement (UoM)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select UoM" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {UOM_TYPES.map(u => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
