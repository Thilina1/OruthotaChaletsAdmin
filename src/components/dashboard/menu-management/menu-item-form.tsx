
'use client';

import { useForm, useWatch } from 'react-hook-form';
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
import type { MenuItem, MenuCategory, MenuSection, HotelInventoryItem, InventoryDepartment } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';

const stockTypes = ['Inventoried', 'Non-Inventoried'] as const;

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
  price: z.coerce.number().min(0, { message: 'Price must be a positive number.' }),
  buyingPrice: z.coerce.number().min(0, { message: 'Buying price must be a positive number.' }),
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

interface MenuItemFormProps {
  item?: MenuItem | null;
  onSubmit: (values: z.infer<typeof formSchema>) => void;

  categories: MenuSection[] | undefined;
  inventoryItems?: HotelInventoryItem[] | undefined;
  departments?: InventoryDepartment[] | undefined;
}

export function MenuItemForm({ item, onSubmit, categories, inventoryItems = [], departments = [] }: MenuItemFormProps) {
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

  const watchedStockType = useWatch({
    control: form.control,
    name: 'stockType',
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <ScrollArea className="h-[75vh] w-full pr-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">General Details</h3>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Fish and Chips" {...field} />
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
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="A short description of the item." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Menu Section (Category)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories?.map(cat => (
                          <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Pricing & Availability</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Selling Price (LKR)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="e.g., 1250.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="buyingPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Buying Price (LKR)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="e.g., 800.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="availability"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Available for Sale</FormLabel>
                      <FormMessage />
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="col-span-1 md:col-span-2 space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Inventory Settings</h3>

              <FormField
                control={form.control}
                name="stockType"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Stock Type</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex space-x-4"
                      >
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="Non-Inventoried" />
                          </FormControl>
                          <FormLabel className="font-normal">
                            Non-Inventoried
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="Inventoried" />
                          </FormControl>
                          <FormLabel className="font-normal">
                            Inventoried
                          </FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchedStockType === 'Inventoried' && (
                <FormField
                  control={form.control}
                  name="linked_inventory_item_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Link to Hotel Inventory (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || 'none'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an inventory item..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Create New Hotel Inventory Item</SelectItem>
                          {inventoryItems?.map(invItem => (
                            <SelectItem key={invItem.id} value={invItem.id}>
                              {invItem.name} ({invItem.unit})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Select an existing Hotel Inventory item, or choose 'Create New' to auto-generate one synced to this menu item.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {watchedStockType === 'Inventoried' && form.watch('linked_inventory_item_id') === 'none' && (
                <div className="space-y-4 border p-4 rounded-md bg-muted/30">
                  <h4 className="font-semibold text-sm">New Hotel Inventory Link Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="inventory_category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Inventory Category</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select Category" />
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
                          <FormLabel>Primary Department</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select Department" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">-- Select Department --</SelectItem>
                              {departments?.map(dept => (
                                <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="unit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>UoM</FormLabel>
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
                      name="stock"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Stock</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="0" {...field} />
                          </FormControl>
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
                            <Input type="number" placeholder="0" {...field} />
                          </FormControl>
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
                            <Input type="number" placeholder="0" {...field} />
                          </FormControl>
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
                            <Input type="number" placeholder="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

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
