
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
import type { MenuItem, MenuCategory, MenuSection } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEffect } from 'react';

const stockTypes = ['Inventoried', 'Non-Inventoried'] as const;
const sellTypes = ['Direct', 'Indirect'] as const;
const units = ['kg', 'g', 'l', 'ml'] as const;

const formSchema = z.object({
  name: z.string().min(1, { message: 'Item name is required.' }),
  description: z.string().optional(),
  price: z.coerce.number().min(0, { message: 'Price must be a positive number.' }),
  buyingPrice: z.coerce.number().min(0, { message: 'Buying price must be a positive number.' }),
  category: z.string().optional(),
  availability: z.boolean(),
  stockType: z.enum(stockTypes),
  stock: z.coerce.number().optional(),
  varietyOfDishes: z.string().optional(),
  sellType: z.enum(sellTypes).default('Direct'),
  unit: z.enum(units).optional(),
});

interface InventoryItemFormProps {
  item?: MenuItem | null;
  onSubmit: (values: z.infer<typeof formSchema>) => void;
  varietyOfDishes: Array<{ id: string; name: string; }>;
  categories: MenuSection[];
}

export function InventoryItemForm({ item, onSubmit, varietyOfDishes, categories }: InventoryItemFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: item?.name || '',
      description: item?.description || '',
      price: item?.price || 0,
      buyingPrice: item?.buying_price || 0,
      category: item?.category || (categories.length > 0 ? categories[0].name : ''),
      availability: item?.availability ?? true,
      stockType: 'Inventoried', // Always inventoried for this form
      stock: item?.stock || 0,
      varietyOfDishes: item?.variety_of_dishes || '',
      sellType: item?.sell_type || 'Direct',
      unit: item?.unit || undefined,
    },
  });

  const { control, setValue } = form;

  const watchedSellType = useWatch({
    control,
    name: 'sellType',
    defaultValue: item?.sell_type || 'Direct'
  });

  useEffect(() => {
    if (watchedSellType === 'Indirect') {
      setValue('category', undefined);
      setValue('varietyOfDishes', undefined);
    } else {
      setValue('category', item?.category || (categories.length > 0 ? categories[0].name : ''));
      setValue('varietyOfDishes', item?.variety_of_dishes || '');
    }
  }, [watchedSellType, setValue, item, categories]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <ScrollArea className="h-[60vh] w-full">
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
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price (LKR)</FormLabel>
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

          <FormField
            control={form.control}
            name="sellType"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>Sell Type</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="flex space-x-4"
                  >
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="Direct" />
                      </FormControl>
                      <FormLabel className="font-normal">
                        Direct Sell
                      </FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="Indirect" />
                      </FormControl>
                      <FormLabel className="font-normal">
                        Indirect Sell
                      </FormLabel>
                    </FormItem>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {watchedSellType !== 'Indirect' && (
            <>
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
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="varietyOfDishes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Variety of Dishes</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a variety" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {varietyOfDishes.map(variety => (
                          <SelectItem key={variety.id} value={variety.name}>{variety.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          <>
            {watchedSellType === 'Indirect' && (
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {units.map(u => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="stock"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{watchedSellType === 'Indirect' ? 'Count of Unit' : 'Stock'}</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 100" {...field} />
                  </FormControl>
                  <FormDescription>
                    Current quantity on hand.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>

          <FormField
            control={form.control}
            name="availability"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <FormLabel>Available</FormLabel>
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
        </ScrollArea>
        <Button type="submit" className="w-full">
          {item ? 'Update Item' : 'Create Item'}
        </Button>
      </form>
    </Form>
  );
}
