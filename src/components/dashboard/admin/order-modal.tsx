
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
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
      // Fetch Menu Items and Categories concurrently
      const [menuRes, categoriesRes] = await Promise.all([
        supabase.from('menu_items').select('*'),
        fetch('/api/admin/menu-sections').then(res => res.json())
      ]);

      if (menuRes.data) {
        setMenuItems(menuRes.data as any);
      }

      if (categoriesRes && categoriesRes.sections) {
        setMenuCategories(categoriesRes.sections.map((s: any) => s.name));
      }

      // Fetch Open Order
      const { data: orderData } = await supabase.from('orders')
        .select('*')
        .eq('table_id', table.id)
        .eq('status', 'open')
        .single();

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

  // No need for separate hooks


  const [localOrder, setLocalOrder] = useState<Record<string, number>>({});

  // reset on close
  useEffect(() => {
    if (!isOpen) {
      setLocalOrder({});
      setSearchTerm('');
      setSelectedCategory(null);

    }
  }, [isOpen]);

  // adjust local menu stocks with order items
  useEffect(() => {
    if (menuItems) {
      let currentLocalItems = menuItems;
      if (orderItems) {
        currentLocalItems = currentLocalItems.map((menuItem) => {
          const orderedItem = orderItems.find((oi) => oi.menu_item_id === menuItem.id);
          if (orderedItem && menuItem.stock_type === 'Inventoried') {
            return { ...menuItem, stock: (menuItem.stock || 0) - orderedItem.quantity };
          }
          return menuItem;
        });
      }
      setLocalMenuItems(currentLocalItems);
    }
  }, [menuItems, orderItems]);



  const filteredMenuItems = useMemo(() => {
    if (!localMenuItems) return [];
    return localMenuItems
      .filter((item) => item.availability && item.sell_type !== 'Indirect')
      .filter((item) => (selectedCategory ? item.category === selectedCategory : true))
      .filter((item) => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [localMenuItems, searchTerm, selectedCategory]);

  const handleAddItem = (menuItem: MenuItem) => {
    const itemInLocalMenu = localMenuItems?.find((m) => m.id === menuItem.id);
    const currentStock = itemInLocalMenu?.stock ?? 0;
    const currentCountInCart = localOrder[menuItem.id] || 0;
    if (
      menuItem.stock_type === 'Inventoried' &&
      currentStock <= 0 &&
      (menuItem.stock ?? 0) - currentCountInCart <= 0
    ) {
      toast({ variant: 'destructive', title: 'Out of Stock', description: `${menuItem.name} is currently unavailable.` });
      return;
    }
    setLocalOrder((prev) => ({
      ...prev,
      [menuItem.id]: (prev[menuItem.id] || 0) + 1,
    }));
  };

  const handleRemoveItem = (menuItemId: string) => {
    setLocalOrder((prev) => {
      const newCount = (prev[menuItemId] || 0) - 1;
      if (newCount <= 0) {
        const { [menuItemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [menuItemId]: newCount };
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

      for (const menuItemId in localOrder) {
        const quantityToAdd = localOrder[menuItemId];
        const menuItem = menuItems?.find((m) => m.id === menuItemId);
        if (menuItem) {
          orderTotalPriceUpdate += menuItem.price * quantityToAdd;

          // Check if item exists in order
          const { data: existingItems } = await supabase.from('order_items')
            .select('*')
            .eq('order_id', currentOrderId)
            .eq('menu_item_id', menuItemId);

          if (existingItems && existingItems.length > 0) {
            const existingItem = existingItems[0];
            await supabase.from('order_items').update({
              quantity: existingItem.quantity + quantityToAdd
            }).eq('id', existingItem.id);
          } else {
            await supabase.from('order_items').insert([{
              order_id: currentOrderId,
              menu_item_id: menuItemId,
              name: menuItem.name,
              price: menuItem.price,
              quantity: quantityToAdd
            }]);
          }

          if (menuItem.stock_type === 'Inventoried') {
            // Decrement stock
            const { error: rpcError } = await supabase.rpc('decrement_stock', { item_id: menuItem.id, quantity: quantityToAdd });
            if (rpcError) {
              // Fallback if RPC doesn't exist: read-write
              const { data: currentItem } = await supabase.from('menu_items').select('stock').eq('id', menuItem.id).single();
              if (currentItem) {
                await supabase.from('menu_items').update({ stock: (currentItem.stock || 0) - quantityToAdd }).eq('id', menuItem.id);
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
        waiter_id: currentUser.id, // Update waiter info if changed?
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

  const handleProcessPayment = async () => {
    if (!openOrder || !table) {
      toast({ variant: 'destructive', title: 'Cannot Process Payment', description: 'There is no open order for this table.' });
      return;
    }

    try {
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

  // const isLoading ...

  const totalLocalPrice = Object.entries(localOrder).reduce((acc, [id, quantity]) => {
    const item = menuItems?.find((m) => m.id === id);
    return acc + (item ? item.price * quantity : 0);
  }, 0);
  const totalBill = (openOrder?.total_price || 0) + totalLocalPrice;

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
                      const currentCountInCart = localOrder[item.id] || 0;
                      const effectiveStock = item.stock ?? 0;
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
                                <p className={`text-xs ${!isOutOfStock ? 'text-primary' : 'text-destructive'}`}>Stock: {effectiveStock - currentCountInCart}</p>
                              )}
                            </div>
                          </div>

                          <Button size="sm" onClick={() => handleAddItem(item)} disabled={isOutOfStock}>
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
                  <div className="space-y-1">
                    {isLoading ? (
                      <Skeleton className="h-16 w-full" />
                    ) : orderItems && orderItems.length > 0 ? (
                      orderItems.map((item) => (
                        <div key={item.id} className="flex justify-between items-center text-sm">
                          <p>{item.name} x {item.quantity}</p>
                          <p>LKR {(item.price * item.quantity).toFixed(2)}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No items in the current order.</p>
                    )}
                  </div>

                  <Separator />
                  <h3 className="font-semibold">New Items</h3>
                  <div className="space-y-1">
                    {Object.keys(localOrder).length > 0 ? (
                      Object.entries(localOrder).map(([id, quantity]) => {
                        const item = menuItems?.find((m) => m.id === id);
                        if (!item) return null;
                        return (
                          <div key={id} className="flex justify-between items-center text-sm mb-1">
                            <div><p>{item.name} x {quantity}</p></div>
                            <div className="flex items-center gap-2">
                              <p>LKR {(item.price * quantity).toFixed(2)}</p>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleAddItem(item)}>
                                <PlusCircle className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveItem(id)}>
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
      </DialogContent>
    </Dialog>
  );
}
