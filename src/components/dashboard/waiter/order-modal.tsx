
'use client';
import { useMemo, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type {
  Table as TableType,
  MenuItem,
  Order,
  OrderItem,
  MenuCategory,
} from '@/lib/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  PlusCircle,
  MinusCircle,
  ShoppingCart,
  Search,
  Utensils,
  CheckCircle,
  Trash2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useUserContext } from '@/context/user-context';

interface OrderModalProps {
  table: TableType;
  isOpen: boolean;
  onClose: () => void;
}



export function OrderModal({ table, isOpen, onClose }: OrderModalProps) {
  const supabase = createClient();
  const { toast } = useToast();
  const { user: currentUser } = useUserContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory | null>(null);

  const fallbackImage = PlaceHolderImages.find((p) => p.id === 'login-background');

  // Data states
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [openOrder, setOpenOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch logic
  const fetchData = useCallback(async () => {
    if (!isOpen) return;
    setIsLoading(true);
    try {
      // Fetch Restaurant Warehouse ID
      const { data: restaurantWH } = await supabase.from('inventory_warehouses').select('id').eq('name', 'Restaurant').maybeSingle();
      const restaurantWHId = restaurantWH?.id;

      // Fetch Menu Items, Categories, and Stock concurrently
      const [tablesRes, menuRes, categoriesRes, stockRes] = await Promise.all([
        supabase.from('restaurant_tables').select('*'),
        supabase.from('menu_items').select('*'),
        supabase.from('menu_sections').select('*').order('name'),
        restaurantWHId ? supabase.from('inventory_stock').select('*, batch:inventory_batches(*)').eq('warehouse_id', restaurantWHId) : Promise.resolve({ data: [] })
      ]);

      if (menuRes.data) {
        const stockData = stockRes.data || [];
        const todayStr = new Date().toISOString().split('T')[0];

        const enhancedMenuItems = menuRes.data.map((item: any) => {
          let available_batches: any[] = [];
          let restaurant_stock = 0;

          if (item.stock_type === 'Inventoried' && item.linked_inventory_item_id) {
             const itemStock = stockData.filter((s: any) => s.item_id === item.linked_inventory_item_id && s.batch);
             itemStock.forEach((s: any) => {
               // Exclude expired batches
               if (s.batch.expiry_date && s.batch.expiry_date < todayStr) return;
               if (s.quantity <= 0) return;

               available_batches.push({
                 id: s.batch.id,
                 batch_number: s.batch.batch_number,
                 expiry_date: s.batch.expiry_date,
                 quantity: s.quantity
               });
               restaurant_stock += s.quantity;
             });
             // Sort by expiry date ascending (FIFO)
             available_batches.sort((a, b) => {
               if (!a.expiry_date) return 1;
               if (!b.expiry_date) return -1;
               return a.expiry_date.localeCompare(b.expiry_date);
             });
          } else if (item.stock_type === 'Inventoried' && !item.linked_inventory_item_id) {
             // Fallback for manually managed inventory items without a link
             restaurant_stock = item.stock || 0;
          }

          return {
            ...item,
            available_batches,
            restaurant_stock
          };
        });
        setMenuItems(enhancedMenuItems);
      }

      if (categoriesRes.data) {
        setMenuCategories(categoriesRes.data.map((s: any) => s.name));
      }

      // Fetch Open Order
      const { data: orderData } = await supabase.from('orders')
        .select('*')
        .eq('table_id', table.id)
        .eq('status', 'open')
        .maybeSingle(); // Assuming only one open order per table

      if (orderData) {
        setOpenOrder(orderData as any);
        // Fetch Order Items
        const { data: itemsData } = await supabase.from('order_items').select('*').eq('order_id', orderData.id);
        if (itemsData) setOrderItems(itemsData as any);
      } else {
        setOpenOrder(null);
        setOrderItems([]);
      }

    } catch (e) {
      console.error("Error fetching data", e);
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, table.id, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  const [localMenuItems, setLocalMenuItems] = useState<MenuItem[] | null>(null);

  useEffect(() => {
    if (menuItems) setLocalMenuItems(menuItems);
  }, [menuItems]);

  // No need for separate hooks, all fetched in fetchData
  // const openOrderQuery ...
  // const orderItemsRef ...

  // Clean up unused hooks output usage:
  // areMenuItemsLoading, areOrdersLoading, etc replaced by single isLoading


  const [localOrder, setLocalOrder] = useState<Record<string, number>>({});

  // reset UI state on close (but keep localOrder for persistence)
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setSelectedCategory(null);
    }
  }, [isOpen]);

  // adjust local menu stocks with order items
  useEffect(() => {
    if (menuItems) {
      let currentLocalItems = menuItems;
      if (orderItems) {
        currentLocalItems = currentLocalItems.map((menuItem: any) => {
          const orderedItemsForThisMenu = orderItems.filter((oi) => oi.menu_item_id === menuItem.id);
          const totalQuantity = orderedItemsForThisMenu.reduce((sum, item) => sum + item.quantity, 0);

          if (totalQuantity > 0 && menuItem.stock_type === 'Inventoried') {
            if (menuItem.linked_inventory_item_id) {
              return {
                ...menuItem,
                restaurant_stock: (menuItem.restaurant_stock || 0) - totalQuantity,
                available_batches: (menuItem.available_batches || []).map((b: any) => {
                   const batchOrdered = orderedItemsForThisMenu.filter(oi => oi.batch_id === b.id).reduce((sum, item) => sum + item.quantity, 0);
                   return { ...b, quantity: b.quantity - batchOrdered };
                })
              } as any;
            }
            return { ...menuItem, restaurant_stock: (menuItem.restaurant_stock || 0) - totalQuantity };
          }
          return menuItem;
        });
      }
      setLocalMenuItems(currentLocalItems);
    }
  }, [menuItems, orderItems]);

  // Real-time subscription for Order Items
  useEffect(() => {
    if (!openOrder?.id || !isOpen) return;

    const channel = supabase.channel(`order-items-${openOrder.id}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'order_items', 
          filter: `order_id=eq.${openOrder.id}` 
        }, 
        () => {
          // Refetch items and order total
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [openOrder?.id, isOpen, fetchData, supabase]);

  const filteredMenuItems = useMemo(() => {
    if (!localMenuItems) return [];
    return localMenuItems
      .filter((item) => item.availability && item.sell_type !== 'Indirect')
      .filter((item) => (selectedCategory ? item.category === selectedCategory : true))
      .filter((item) => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [localMenuItems, searchTerm, selectedCategory]);

  const [batchSelectionItem, setBatchSelectionItem] = useState<any | null>(null);

  const handleAddItemClick = (menuItem: any) => {
    const itemInLocalMenu = localMenuItems?.find((m) => m.id === menuItem.id) as any;
    
    if (itemInLocalMenu && itemInLocalMenu.stock_type === 'Inventoried' && itemInLocalMenu.linked_inventory_item_id) {
       if (itemInLocalMenu.available_batches && itemInLocalMenu.available_batches.length > 0) {
          setBatchSelectionItem(itemInLocalMenu);
          return;
       } else {
          toast({ variant: 'destructive', title: 'Out of Stock', description: `${menuItem.name} has no available batches.` });
          return;
       }
    }
    handleAddConfirmedItem(menuItem, null);
  };

  const handleAddConfirmedItem = (menuItem: any, batchId: string | null) => {
    const itemInLocalMenu = localMenuItems?.find((m) => m.id === menuItem.id) as any;
    const isLinked = !!itemInLocalMenu?.linked_inventory_item_id;
    let effectiveStock = 0;
    
    if (isLinked) {
       if (batchId) {
          const batch = itemInLocalMenu.available_batches?.find((b: any) => b.id === batchId);
          effectiveStock = batch ? batch.quantity : 0;
       } else {
          effectiveStock = itemInLocalMenu.restaurant_stock ?? 0;
       }
    } else {
       effectiveStock = itemInLocalMenu?.restaurant_stock ?? 0;
    }

    const orderKey = batchId ? `${menuItem.id}::${batchId}` : menuItem.id;
    const currentCountInCart = localOrder[orderKey] || 0;

    if (
      menuItem.stock_type === 'Inventoried' &&
      effectiveStock - currentCountInCart <= 0
    ) {
      toast({ variant: 'destructive', title: 'Out of Stock', description: `Not enough stock available.` });
      return;
    }
    
    setLocalOrder((prev) => ({
      ...prev,
      [orderKey]: (prev[orderKey] || 0) + 1,
    }));
    
    if (batchSelectionItem) {
      setBatchSelectionItem(null);
    }
  };

  const handleRemoveItem = (orderKey: string) => {
    setLocalOrder((prev) => {
      const newCount = (prev[orderKey] || 0) - 1;
      if (newCount <= 0) {
        const { [orderKey]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [orderKey]: newCount };
    });
  };

  const handleAddItemsToBill = async () => {
    if (!table || !currentUser || Object.keys(localOrder).length === 0) return;

    let currentOrderId = openOrder?.id;
    try {
      if (!currentOrderId) {
        // Create new order
        const { data: newOrder, error: createError } = await supabase.from('orders').insert([{
          table_id: table.id,
          table_number: table.table_number,
          status: 'open',
          total_price: 0,
          waiter_id: currentUser.id,
          waiter_name: currentUser.name,
        }]).select().single();

        if (createError) throw createError;
        currentOrderId = newOrder.id;
      }

      if (!currentOrderId) throw new Error('Failed to create or find order.');

      let orderTotalPriceUpdate = 0;

      for (const orderKey in localOrder) {
        const quantityToAdd = localOrder[orderKey];
        const [menuItemId, batchId] = orderKey.split('::');
        const menuItem = menuItems?.find((m) => m.id === menuItemId);
        
        if (menuItem) {
          orderTotalPriceUpdate += menuItem.price * quantityToAdd;

          // Check if item exists in order
          let query = supabase.from('order_items').select('*').eq('order_id', currentOrderId).eq('menu_item_id', menuItemId);
          if (batchId) {
            query = query.eq('batch_id', batchId);
          } else {
            query = query.is('batch_id', null);
          }
          const { data: existingItems } = await query;

          if (existingItems && existingItems.length > 0) {
            const existingItem = existingItems[0];
            await supabase.from('order_items').update({
              quantity: existingItem.quantity + quantityToAdd
            }).eq('id', existingItem.id);
          } else {
            await supabase.from('order_items').insert([{
              order_id: currentOrderId,
              menu_item_id: menuItemId,
              batch_id: batchId || null,
              name: menuItem.name,
              price: menuItem.price,
              quantity: quantityToAdd
            }]);
          }

          if (menuItem.stock_type === 'Inventoried') {
            if (menuItem.linked_inventory_item_id) {
              // Deduct from new inventory system if batchId provided
              if (batchId) {
                const { data: currentWH } = await supabase.from('inventory_warehouses').select('id').eq('name', 'Restaurant').maybeSingle();
                if (currentWH) {
                   const { data: currentStock } = await supabase.from('inventory_stock')
                     .select('*')
                     .eq('warehouse_id', currentWH.id)
                     .eq('batch_id', batchId)
                     .maybeSingle();

                   if (currentStock) {
                     const newStock = (currentStock.quantity || 0) - quantityToAdd;
                     await supabase.from('inventory_stock').update({ quantity: newStock }).eq('id', currentStock.id);

                     await supabase.from('inventory_transactions').insert([{
                       item_id: menuItem.linked_inventory_item_id,
                       batch_id: batchId,
                       transaction_type: 'issue',
                       quantity: quantityToAdd,
                       previous_stock: currentStock.quantity || 0,
                       new_stock: newStock,
                       reason: 'Sold via POS',
                       reference_department: currentWH.id,
                       created_by: currentUser.id,
                     }]);
                   }
                }
              }
            } else {
              // Decrement manual stock
              const { error: rpcError } = await supabase.rpc('decrement_stock', { item_id: menuItem.id, quantity: quantityToAdd });
              if (rpcError) {
                const { data: currentItem } = await supabase.from('menu_items').select('stock').eq('id', menuItem.id).single();
                if (currentItem) {
                  await supabase.from('menu_items').update({ stock: (currentItem.stock || 0) - quantityToAdd }).eq('id', menuItem.id);
                }
              }
            }
          }
        }
      }

      // Update Order Total
      const { data: freshOrder } = await supabase.from('orders').select('total_price').eq('id', currentOrderId).single();
      const currentTotal = freshOrder?.total_price || 0;
      await supabase.from('orders').update({
        total_price: currentTotal + orderTotalPriceUpdate,
        updated_at: new Date().toISOString(),
        waiter_id: currentUser.id,
        waiter_name: currentUser.name
      }).eq('id', currentOrderId);

      // Update Table Status
      if (table.status === 'available') {
        await supabase.from('restaurant_tables').update({ status: 'occupied' }).eq('id', table.id);
      }

      setLocalOrder({});
      toast({ title: 'Items Added', description: 'New items have been added to the bill.' });
      fetchData(); // Refetch
    } catch (error) {
      console.error('Error adding items to order:', error);
      toast({ variant: 'destructive', title: 'Order Failed', description: 'Could not add items to the order.' });
    }
  };

  const handleUpdateOrderItemQuantity = async (item: OrderItem, delta: number) => {
    if (delta === 0) return;
    const newQuantity = item.quantity + delta;
    if (newQuantity < 1) {
      handleRemoveOrderItem(item);
      return;
    }

    const menuItem = menuItems.find(m => m.id === item.menu_item_id);
    if (delta > 0 && menuItem && menuItem.stock_type === 'Inventoried') {
      const itemInLocalMenu = localMenuItems?.find((m) => m.id === item.menu_item_id);
      const isLinked = !!itemInLocalMenu?.linked_inventory_item_id;
      const effectiveStock = isLinked
        ? ((itemInLocalMenu as any)?.hotel_inventory_items?.current_stock ?? 0)
        : (itemInLocalMenu?.stock ?? 0);

      if (effectiveStock <= 0) {
        toast({ variant: 'destructive', title: 'Out of Stock', description: `Cannot add more ${item.name}.` });
        return;
      }
    }

    try {
      // Update quantity in DB
      await supabase.from('order_items').update({ quantity: newQuantity }).eq('id', item.id);

      // Adjust stock
      if (menuItem && menuItem.stock_type === 'Inventoried') {
        const adjustment = delta; // positive means we add to order (deduct from stock)
        if (menuItem.linked_inventory_item_id) {
          if (item.batch_id) {
            const { data: currentWH } = await supabase.from('inventory_warehouses').select('id').eq('name', 'Restaurant').maybeSingle();
            if (currentWH) {
              const { data: currentStock } = await supabase.from('inventory_stock').select('*').eq('warehouse_id', currentWH.id).eq('batch_id', item.batch_id).maybeSingle();
              if (currentStock) {
                const newStock = (currentStock.quantity || 0) - adjustment;
                await supabase.from('inventory_stock').update({ quantity: newStock }).eq('id', currentStock.id);
                
                await supabase.from('inventory_transactions').insert([{
                  item_id: menuItem.linked_inventory_item_id,
                  batch_id: item.batch_id,
                  transaction_type: adjustment > 0 ? 'issue' : 'return',
                  quantity: Math.abs(adjustment),
                  previous_stock: currentStock.quantity || 0,
                  new_stock: newStock,
                  reason: adjustment > 0 ? 'Updated quantity in POS' : 'Reduced quantity in POS',
                  reference_department: currentWH.id,
                  created_by: currentUser?.id,
                }]);
              }
            }
          }
        } else {
          // Manual stock adjustment
          const { data: currentM } = await supabase.from('menu_items').select('stock').eq('id', menuItem.id).single();
          if (currentM) {
            await supabase.from('menu_items').update({ stock: (currentM.stock || 0) - adjustment }).eq('id', menuItem.id);
          }
        }
      }

      // Update Order Total
      const { data: freshOrder } = await supabase.from('orders').select('total_price').eq('id', openOrder?.id).single();
      const currentTotal = freshOrder?.total_price || 0;
      await supabase.from('orders').update({
        total_price: currentTotal + (item.price * delta),
        updated_at: new Date().toISOString(),
      }).eq('id', openOrder?.id);

      fetchData();
    } catch (error) {
      console.error('Error updating item quantity:', error);
      toast({ variant: 'destructive', title: 'Update Failed' });
    }
  };

  const handleRemoveOrderItem = async (item: OrderItem) => {
    try {
      const menuItem = menuItems.find(m => m.id === item.menu_item_id);
      
      // Delete from DB
      await supabase.from('order_items').delete().eq('id', item.id);

      // Restore stock
      if (menuItem && menuItem.stock_type === 'Inventoried') {
        if (menuItem.linked_inventory_item_id) {
          if (item.batch_id) {
            const { data: currentWH } = await supabase.from('inventory_warehouses').select('id').eq('name', 'Restaurant').maybeSingle();
            if (currentWH) {
              const { data: currentStock } = await supabase.from('inventory_stock').select('*').eq('warehouse_id', currentWH.id).eq('batch_id', item.batch_id).maybeSingle();
              if (currentStock) {
                const newStock = (currentStock.quantity || 0) + item.quantity;
                await supabase.from('inventory_stock').update({ quantity: newStock }).eq('id', currentStock.id);
                
                await supabase.from('inventory_transactions').insert([{
                  item_id: menuItem.linked_inventory_item_id,
                  batch_id: item.batch_id,
                  transaction_type: 'return',
                  quantity: item.quantity,
                  previous_stock: currentStock.quantity || 0,
                  new_stock: newStock,
                  reason: 'Removed from POS bill',
                  reference_department: currentWH.id,
                  created_by: currentUser?.id,
                }]);
              }
            }
          }
        } else {
          const { data: currentM } = await supabase.from('menu_items').select('stock').eq('id', menuItem.id).single();
          if (currentM) {
            await supabase.from('menu_items').update({ stock: (currentM.stock || 0) + item.quantity }).eq('id', menuItem.id);
          }
        }
      }

      // Update Order Total
      const { data: freshOrder } = await supabase.from('orders').select('total_price').eq('id', openOrder?.id).single();
      const currentTotal = freshOrder?.total_price || 0;
      await supabase.from('orders').update({
        total_price: Math.max(0, currentTotal - (item.price * item.quantity)),
        updated_at: new Date().toISOString(),
      }).eq('id', openOrder?.id);

      fetchData();
      toast({ title: 'Item Removed' });
    } catch (error) {
      console.error('Error removing item:', error);
      toast({ variant: 'destructive', title: 'Removal Failed' });
    }
  };

  const handleProcessPayment = async () => {
    if (!openOrder || !table) {
      toast({ variant: 'destructive', title: 'Cannot Process Payment', description: 'There is no open order for this table.' });
      return;
    }

    try {
      // Just update status to 'billed' for now as bills table might be missing
      // If we want to be fancy we insert to 'bills' if it existed
      await supabase.from('orders').update({
        status: 'billed',
        updated_at: new Date().toISOString()
      }).eq('id', openOrder.id);

      toast({ title: 'Bill Sent for Payment', description: `The bill for Table ${table.table_number} is now pending payment.` });
      onClose();
    } catch (error) {
      console.error('Error processing payment:', error);
      toast({ variant: 'destructive', title: 'Process Failed', description: 'Could not send the bill for payment.' });
    }
  };

  // const isLoading ... already defined

  const totalLocalprice = Object.entries(localOrder).reduce((acc, [orderKey, quantity]) => {
    const menuItemId = orderKey.split('::')[0];
    const item = menuItems?.find((m) => m.id === menuItemId);
    return acc + (item ? item.price * quantity : 0);
  }, 0);
  const totalBill = (openOrder?.total_price || 0) + totalLocalprice;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="flex-shrink-0 p-6 pb-0">
          <DialogTitle>Table {table?.table_number} - Order</DialogTitle>
        </DialogHeader>

        {/* Grid container: using min-h-0 & flex-1 to allow children to size correctly */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 items-start flex-1 min-h-0 p-6 pt-2">
          {/* Menu Card */}
          <Card className="lg:col-span-2 h-full flex flex-col overflow-hidden">
            <CardHeader className="flex-shrink-0">
              <CardTitle>Menu</CardTitle>
              <CardDescription>Select items to add to the order.</CardDescription>

              <div className="flex gap-2 items-center flex-wrap mt-3">
                <div className="relative flex-grow min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search menu..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full"
                  />
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">{selectedCategory || 'All Categories'}</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => setSelectedCategory(null)}>All Categories</DropdownMenuItem>
                    {menuCategories.map((cat) => (
                      <DropdownMenuItem key={cat} onSelect={() => setSelectedCategory(cat)}>{cat}</DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>


              </div>
            </CardHeader>

            <CardContent className="flex-1 min-h-0 overflow-hidden">
              {/* ScrollArea must fill the remaining height */}
              <ScrollArea className="h-full pr-4">
                <div className="space-y-2">
                  {isLoading ? (
                    [...Array(10)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
                  ) : filteredMenuItems.length > 0 ? (
                    filteredMenuItems.map((item) => {
                      const currentCountInCart = Object.entries(localOrder)
                        .filter(([k]) => k.startsWith(item.id))
                        .reduce((sum, [_, qty]) => sum + qty, 0);
                      const isLinked = !!item.linked_inventory_item_id;
                      const effectiveStock = isLinked
                        ? ((item as any).restaurant_stock ?? 0)
                        : (item.stock ?? 0);
                      const isOutOfStock = item.stock_type === 'Inventoried' && effectiveStock - currentCountInCart <= 0;
                      return (
                        <div key={item.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted">
                          <div className="flex items-center gap-4">
                            <div className="relative w-16 h-16 rounded-md overflow-hidden bg-muted flex items-center justify-center shrink-0">
                              {fallbackImage ? (
                                <Image src={fallbackImage.imageUrl} alt={item.name} fill className="object-cover" />
                              ) : (
                                <Utensils className="h-8 w-8 text-muted-foreground" />
                              )}
                            </div>

                            <div>
                              <p className="font-semibold">{item.name}</p>
                              <p className="text-sm text-muted-foreground">LKR {item.price.toFixed(2)}</p>
                              {item.stock_type === 'Inventoried' && (
                                <p className={`text-xs ${!isOutOfStock ? 'text-primary' : 'text-destructive'}`}>
                                  Stock: {effectiveStock - currentCountInCart}
                                </p>
                              )}
                            </div>
                          </div>

                          <Button size="sm" onClick={() => handleAddItemClick(item)} disabled={isOutOfStock}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add
                          </Button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center text-muted-foreground py-10">No menu items found.</div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Current Bill Card */}
          <Card className="h-full flex flex-col overflow-hidden sticky top-0">
            <CardHeader className="flex-shrink-0">
              <CardTitle className="flex items-center">
                <ShoppingCart className="mr-2" /> Current Bill
              </CardTitle>

              {table && <Badge className="capitalize w-fit">{table.status}</Badge>}
              {openOrder?.waiter_name && <p className="text-sm text-muted-foreground pt-1">Waiter: {openOrder.waiter_name}</p>}
            </CardHeader>

            <CardContent className="flex-1 min-h-0 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-4">
                  <Separator />
                  <h3 className="font-semibold">Current Order</h3>
                  <div className="space-y-2">
                    {isLoading ? (
                      <Skeleton className="h-16 w-full" />
                    ) : orderItems && orderItems.length > 0 ? (
                      orderItems.map((item) => (
                        <div key={item.id} className="flex justify-between items-center text-sm bg-secondary/20 p-2 rounded-md">
                          <div className="flex-1">
                            <p className="font-medium">{item.name}</p>
                            <p className="text-xs text-muted-foreground">LKR {(item.price * item.quantity).toFixed(2)}</p>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleUpdateOrderItemQuantity(item, -1)}>
                              <MinusCircle className="h-3 w-3" />
                            </Button>
                            <span className="w-4 text-center font-bold">{item.quantity}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleUpdateOrderItemQuantity(item, 1)}>
                              <PlusCircle className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveOrderItem(item)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground pt-1">No items in the current order.</p>
                    )}
                  </div>

                  <Separator />
                  <h3 className="font-semibold">New Items</h3>
                  <div className="space-y-1">
                    {Object.keys(localOrder).length > 0 ? (
                      Object.entries(localOrder).map(([orderKey, quantity]) => {
                        const [menuItemId, batchId] = orderKey.split('::');
                        const item = menuItems?.find((m) => m.id === menuItemId);
                        if (!item) return null;
                        
                        let batchLabel = "";
                        if (batchId && (item as any).available_batches) {
                           const b = (item as any).available_batches.find((b: any) => b.id === batchId);
                           if (b) batchLabel = ` (Batch: ${b.batch_number})`;
                        }

                        return (
                          <div key={orderKey} className="flex justify-between items-center text-sm mb-1">
                            <div><p>{item.name}{batchLabel} x {quantity}</p></div>
                            <div className="flex items-center gap-2">
                              <p>LKR {(item.price * quantity).toFixed(2)}</p>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleAddConfirmedItem(item, batchId || null)}>
                                <PlusCircle className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveItem(orderKey)}>
                                <MinusCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground">Add items from the menu.</p>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </CardContent>

            <CardFooter className="flex flex-col gap-4 mt-auto border-t pt-4 flex-shrink-0">
              <div className="w-full flex justify-between items-center text-xl font-bold">
                <span>Total Bill:</span>
                <span>LKR {totalBill.toFixed(2)}</span>
              </div>

              <Button className="w-full" onClick={handleAddItemsToBill} disabled={Object.keys(localOrder).length === 0}>
                Add Items to Bill
              </Button>

              <Button className="w-full" variant="secondary" onClick={handleProcessPayment} disabled={!openOrder}>
                <CheckCircle className="mr-2" /> Send to Payment
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        {/* Batch Selection Dialog */}
        <Dialog open={!!batchSelectionItem} onOpenChange={(open) => !open && setBatchSelectionItem(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Select Batch for {batchSelectionItem?.name}</DialogTitle>
              <DialogDescription>
                Choose which batch to use for this item.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              {batchSelectionItem?.available_batches?.map((b: any) => {
                const orderKey = `${batchSelectionItem.id}::${b.id}`;
                const inCart = localOrder[orderKey] || 0;
                const outOfStock = b.quantity - inCart <= 0;
                return (
                  <div key={b.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-semibold text-sm">Batch: {b.batch_number}</p>
                      <p className="text-xs text-muted-foreground">Expires: {b.expiry_date}</p>
                      <p className="text-xs font-medium mt-1">Avail Stock: {b.quantity - inCart}</p>
                    </div>
                    <Button size="sm" onClick={() => handleAddConfirmedItem(batchSelectionItem, b.id)} disabled={outOfStock}>
                      Add to Order
                    </Button>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>

      </DialogContent>
    </Dialog>
  );
}
