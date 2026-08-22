
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
  Clock,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useUserContext } from '@/context/user-context';

type ChargeEntry = { id: string; name: string; type: 'percentage' | 'fixed'; value: number; enabled: boolean };
type BillingCfg = { vat: { enabled: boolean; rate: number }; service_charges: ChargeEntry[]; other_charges: ChargeEntry[] };

const KITCHEN_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: 'Waiting for kitchen', className: 'border-slate-300 bg-slate-50 text-slate-600' },
  preparing: { label: 'Preparing', className: 'border-amber-300 bg-amber-50 text-amber-700' },
  ready: { label: 'Prepared · Ready', className: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
  done: { label: 'Served / Done', className: 'border-blue-300 bg-blue-50 text-blue-700' },
};

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
  const [customerMobile, setCustomerMobile] = useState('');
  const [billingConfig, setBillingConfig] = useState<BillingCfg | null>(null);
  const [showBillBreakdown, setShowBillBreakdown] = useState(false);
  const [updatingPresentedItemId, setUpdatingPresentedItemId] = useState<string | null>(null);

  // Fetch logic
  const fetchData = useCallback(async () => {
    if (!isOpen) return;
    setIsLoading(true);
    try {
      // Fetch Menu Items, Categories, and restaurant warehouse stock concurrently
      const [menuApiRes, restaurantWH] = await Promise.all([
        fetch('/api/admin/menu-items').then(r => r.json()),
        supabase.from('inventory_warehouses').select('id').eq('name', 'Restaurant').maybeSingle(),
      ]);

      const restaurantWHId = (restaurantWH as any)?.data?.id as string | undefined;
      const stockRes = restaurantWHId
        ? await supabase.from('inventory_stock').select('*, batch:inventory_batches(*)').eq('warehouse_id', restaurantWHId)
        : { data: [] };

      const menuRawItems: any[] = menuApiRes.menuItems ?? [];
      const stockData: any[] = (stockRes as any).data || [];
      const todayStr = new Date().toISOString().split('T')[0];

      // Fetch batch pricing for all menu items
      const menuItemIds = menuRawItems.map((m: any) => m.id);
      const { data: pricingData } = menuItemIds.length > 0
        ? await supabase.from('menu_item_batch_pricing').select('menu_item_id, batch_id, selling_price').in('menu_item_id', menuItemIds)
        : { data: [] };
      // Build lookup: pricingMap[menuItemId][batchId] = selling_price
      const pricingMap: Record<string, Record<string, number>> = {};
      (pricingData ?? []).forEach((p: any) => {
        if (!pricingMap[p.menu_item_id]) pricingMap[p.menu_item_id] = {};
        pricingMap[p.menu_item_id][p.batch_id] = p.selling_price;
      });

      const enhancedMenuItems = menuRawItems.map((item: any) => {
        let available_batches: any[] = [];
        let restaurant_stock = 0;
        if (item.stock_type === 'Inventoried' && item.linked_inventory_item_id) {
          stockData
            .filter((s: any) => s.item_id === item.linked_inventory_item_id && s.batch)
            .forEach((s: any) => {
              if (s.batch.expiry_date && s.batch.expiry_date < todayStr) return;
              if (s.quantity <= 0) return;
              restaurant_stock += s.quantity;
              available_batches.push({
                id: s.batch.id,
                batch_number: s.batch.batch_number,
                expiry_date: s.batch.expiry_date,
                quantity: s.quantity,
                selling_price: pricingMap[item.id]?.[s.batch.id] ?? null,
              });
            });
          available_batches.sort((a, b) => {
            if (!a.expiry_date) return 1;
            if (!b.expiry_date) return -1;
            return a.expiry_date.localeCompare(b.expiry_date);
          });
        } else if (item.stock_type === 'Inventoried') {
          restaurant_stock = item.stock || 0;
        }
        return { ...item, available_batches, restaurant_stock };
      });

      setMenuItems(enhancedMenuItems);

      if (menuApiRes.menuSections) {
        setMenuCategories(menuApiRes.menuSections.map((s: any) => s.name));
      }

      // Fetch the most recent open or billed order for this table
      const { data: orderData } = await supabase.from('orders')
        .select('*')
        .eq('table_id', table.id)
        .in('status', ['open', 'billed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (orderData) {
        setOpenOrder(orderData as any);
        setCustomerMobile((orderData as any).customer_mobile || '');
        // Fetch Order Items
        const { data: itemsData } = await supabase.from('order_items').select('*').eq('order_id', orderData.id);
        if (itemsData) setOrderItems(itemsData as any);
      } else {
        setOpenOrder(null);
        setOrderItems([]);
        setCustomerMobile('');
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
        currentLocalItems = currentLocalItems.map((menuItem) => {
          const orderedItemsForThisMenu = orderItems.filter((oi) => oi.menu_item_id === menuItem.id);
          const totalQuantity = orderedItemsForThisMenu.reduce((sum, item) => sum + item.quantity, 0);

          if (totalQuantity > 0 && menuItem.stock_type === 'Inventoried') {
            return { ...menuItem, restaurant_stock: ((menuItem as any).restaurant_stock || 0) - totalQuantity } as any;
          }
          return menuItem;
        });
      }
      setLocalMenuItems(currentLocalItems);
    }
  }, [menuItems, orderItems]);

  // Real-time subscription for order_items and orders (catches confirmed_total from cashier)
  useEffect(() => {
    if (!openOrder?.id || !isOpen) return;

    const channel = supabase.channel(`admin-order-${openOrder.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'order_items', filter: `order_id=eq.${openOrder.id}` },
        (payload: any) => {
          if (payload.eventType === 'UPDATE' && payload.new?.id) {
            setOrderItems(current => current.map(item => item.id === payload.new.id
              ? { ...item, ...payload.new }
              : item));
            return;
          }
          // Inserts and deletes change the list shape and still need a full refresh.
          fetchData();
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${openOrder.id}` },
        () => { fetchData(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [openOrder?.id, isOpen, fetchData, supabase]);

  useEffect(() => {
    if (openOrder?.status !== 'billed') { setBillingConfig(null); return; }
    fetch('/api/admin/app-settings?key=restaurant_billing_config')
      .then(r => r.json())
      .then(res => { if (res.value) setBillingConfig(res.value as BillingCfg); })
      .catch(() => {});
  }, [openOrder?.status, openOrder?.id]);



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
    if (itemInLocalMenu?.stock_type === 'Inventoried' && itemInLocalMenu?.linked_inventory_item_id) {
      if (itemInLocalMenu.available_batches?.length > 0) {
        setBatchSelectionItem(itemInLocalMenu);
        return;
      }
      toast({ variant: 'destructive', title: 'Out of Stock', description: `${menuItem.name} has no available batches.` });
      return;
    }
    handleAddConfirmedItem(menuItem, null);
  };

  const handleAddConfirmedItem = (menuItem: any, batchId: string | null) => {
    const itemInLocalMenu = localMenuItems?.find((m) => m.id === menuItem.id) as any;
    const orderKey = batchId ? `${menuItem.id}::${batchId}` : menuItem.id;
    let effectiveStock = 0;
    if (batchId) {
      const batch = itemInLocalMenu?.available_batches?.find((b: any) => b.id === batchId);
      effectiveStock = batch ? batch.quantity : 0;
    } else {
      effectiveStock = itemInLocalMenu?.restaurant_stock ?? itemInLocalMenu?.stock ?? 0;
    }
    const currentCountInCart = localOrder[orderKey] || 0;
    if (menuItem.stock_type === 'Inventoried' && effectiveStock - currentCountInCart <= 0) {
      toast({ variant: 'destructive', title: 'Out of Stock', description: `Not enough stock available.` });
      return;
    }
    setLocalOrder((prev) => ({ ...prev, [orderKey]: (prev[orderKey] || 0) + 1 }));
    if (batchSelectionItem) setBatchSelectionItem(null);
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

  const handleSaveCustomerMobile = async () => {
    if (!openOrder?.id || !customerMobile) return;
    await supabase.from('orders').update({ customer_mobile: customerMobile }).eq('id', openOrder.id);
  };

  const handlePresentedToggle = async (item: OrderItem) => {
    const isPresented = (item.served_quantity ?? 0) >= item.quantity;
    const nextServed = isPresented ? 0 : item.quantity;

    setUpdatingPresentedItemId(item.id);
    try {
      const { error } = await supabase.from('order_items').update({ served_quantity: nextServed }).eq('id', item.id);
      if (error) throw error;
      setOrderItems(current => current.map(existing => existing.id === item.id ? { ...existing, served_quantity: nextServed } : existing));
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: error?.message || 'Could not update presentation status.' });
    } finally {
      setUpdatingPresentedItemId(null);
    }
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
          ...(customerMobile ? { customer_mobile: customerMobile } : {}),
        }]).select().single();

        if (createError) throw createError;
        currentOrderId = newOrder.id;
      }

      if (!currentOrderId) throw new Error('Failed to create or find order.');

      let orderTotalPriceUpdate = 0;

      for (const orderKey in localOrder) {
        const quantityToAdd = localOrder[orderKey];
        const [menuItemId, batchId] = orderKey.split('::');
        const menuItem = menuItems?.find((m) => m.id === menuItemId) as any;
        if (menuItem) {
          // Use batch selling price if available, else menu item price
          const batch = batchId ? menuItem.available_batches?.find((b: any) => b.id === batchId) : null;
          const itemPrice = batch?.selling_price || menuItem.price;
          orderTotalPriceUpdate += itemPrice * quantityToAdd;

          // Check if item (with same price) already in order
          const { data: existingItems } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', currentOrderId!)
            .eq('menu_item_id', menuItemId)
            .eq('price', itemPrice);

          if (existingItems && existingItems.length > 0) {
            const existingItem = existingItems[0];
            const quantityUpdate: Record<string, any> = { quantity: existingItem.quantity + quantityToAdd };
            if (menuItem.stock_type === 'Non-Inventoried' && ['ready', 'done'].includes(existingItem.kitchen_status)) {
              quantityUpdate.kitchen_status = 'preparing';
              quantityUpdate.prepared_at = null;
            }
            await supabase.from('order_items').update(quantityUpdate).eq('id', existingItem.id);
          } else {
            await supabase.from('order_items').insert([{
              order_id: currentOrderId,
              menu_item_id: menuItemId,
              name: menuItem.name,
              price: itemPrice,
              quantity: quantityToAdd,
            }]);
          }

          if (menuItem.stock_type === 'Inventoried') {
            if (menuItem.linked_inventory_item_id && batchId) {
              const { data: whData } = await supabase.from('inventory_warehouses').select('id').eq('name', 'Restaurant').maybeSingle();
              if (whData) {
                const { data: stockRow } = await supabase.from('inventory_stock').select('*').eq('warehouse_id', whData.id).eq('batch_id', batchId).maybeSingle();
                if (stockRow) {
                  const newStock = (stockRow.quantity || 0) - quantityToAdd;
                  await supabase.from('inventory_stock').update({ quantity: newStock }).eq('id', stockRow.id);
                  await supabase.from('inventory_transactions').insert([{
                    item_id: menuItem.linked_inventory_item_id,
                    batch_id: batchId,
                    transaction_type: 'issue',
                    quantity: quantityToAdd,
                    previous_stock: stockRow.quantity || 0,
                    new_stock: newStock,
                    reason: 'Sold via Admin POS',
                    reference_department: whData.id,
                    created_by: currentUser?.id,
                  }]);
                }
              }
            } else if (!menuItem.linked_inventory_item_id) {
              const { error: rpcError } = await supabase.rpc('decrement_stock', { item_id: menuItem.id, quantity: quantityToAdd });
              if (rpcError) {
                const { data: currentItem } = await supabase.from('menu_items').select('stock').eq('id', menuItem.id).single();
                if (currentItem) await supabase.from('menu_items').update({ stock: (currentItem.stock || 0) - quantityToAdd }).eq('id', menuItem.id);
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
        waiter_name: currentUser.name,
        ...(customerMobile ? { customer_mobile: customerMobile } : {}),
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
      const effectiveStock = (itemInLocalMenu as any)?.restaurant_stock ?? itemInLocalMenu?.stock ?? 0;
      if (effectiveStock <= 0) {
        toast({ variant: 'destructive', title: 'Out of Stock' });
        return;
      }
    }

    try {
      const quantityUpdate: Record<string, any> = { quantity: newQuantity };
      if (menuItem?.stock_type === 'Non-Inventoried') {
        quantityUpdate.prepared_quantity = Math.min(item.prepared_quantity ?? 0, newQuantity);
        quantityUpdate.served_quantity = Math.min(item.served_quantity ?? 0, newQuantity);
        if (delta > 0 && ['ready', 'done'].includes(item.kitchen_status || 'pending')) {
          quantityUpdate.kitchen_status = 'preparing';
          quantityUpdate.prepared_at = null;
        }
      }
      await supabase.from('order_items').update(quantityUpdate).eq('id', item.id);

      if (menuItem && menuItem.stock_type === 'Inventoried') {
        const adjustment = delta;
        if (menuItem.linked_inventory_item_id && (item as any).batch_id) {
          const { data: whData } = await supabase.from('inventory_warehouses').select('id').eq('name', 'Restaurant').maybeSingle();
          if (whData) {
            const { data: stockRow } = await supabase.from('inventory_stock').select('*').eq('warehouse_id', whData.id).eq('batch_id', (item as any).batch_id).maybeSingle();
            if (stockRow) {
              const newStock = (stockRow.quantity || 0) - adjustment;
              await supabase.from('inventory_stock').update({ quantity: newStock }).eq('id', stockRow.id);
              await supabase.from('inventory_transactions').insert([{
                item_id: menuItem.linked_inventory_item_id,
                batch_id: (item as any).batch_id,
                transaction_type: adjustment > 0 ? 'issue' : 'return',
                quantity: Math.abs(adjustment),
                previous_stock: stockRow.quantity || 0,
                new_stock: newStock,
                reason: adjustment > 0 ? 'Updated quantity in Admin POS' : 'Reduced quantity in Admin POS',
                reference_department: whData.id,
                created_by: currentUser?.id,
              }]);
            }
          }
        } else if (!menuItem.linked_inventory_item_id) {
          const { data: currentM } = await supabase.from('menu_items').select('stock').eq('id', menuItem.id).single();
          if (currentM) await supabase.from('menu_items').update({ stock: (currentM.stock || 0) - adjustment }).eq('id', menuItem.id);
        }
      }

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
      await supabase.from('order_items').delete().eq('id', item.id);

      if (menuItem && menuItem.stock_type === 'Inventoried') {
        if (menuItem.linked_inventory_item_id && (item as any).batch_id) {
          const { data: whData } = await supabase.from('inventory_warehouses').select('id').eq('name', 'Restaurant').maybeSingle();
          if (whData) {
            const { data: stockRow } = await supabase.from('inventory_stock').select('*').eq('warehouse_id', whData.id).eq('batch_id', (item as any).batch_id).maybeSingle();
            if (stockRow) {
              const newStock = (stockRow.quantity || 0) + item.quantity;
              await supabase.from('inventory_stock').update({ quantity: newStock }).eq('id', stockRow.id);
              await supabase.from('inventory_transactions').insert([{
                item_id: menuItem.linked_inventory_item_id,
                batch_id: (item as any).batch_id,
                transaction_type: 'return',
                quantity: item.quantity,
                previous_stock: stockRow.quantity || 0,
                new_stock: newStock,
                reason: 'Removed from Admin POS bill',
                reference_department: whData.id,
                created_by: currentUser?.id,
              }]);
            }
          }
        } else if (!menuItem.linked_inventory_item_id) {
          const { data: currentM } = await supabase.from('menu_items').select('stock').eq('id', menuItem.id).single();
          if (currentM) await supabase.from('menu_items').update({ stock: (currentM.stock || 0) + item.quantity }).eq('id', menuItem.id);
        }
      }

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
      await supabase.from('orders').update({
        status: 'billed',
        updated_at: new Date().toISOString()
      }).eq('id', openOrder.id);

      // Keep table occupied — only the cashier confirming payment should free it
      await supabase.from('restaurant_tables').update({ status: 'occupied' }).eq('id', table.id);

      toast({ title: 'Bill Sent for Payment', description: `The bill for Table ${table.table_number} is now pending payment.` });
      onClose();
    } catch (error) {
      console.error('Error processing payment:', error);
      toast({ variant: 'destructive', title: 'Process Failed', description: 'Could not send the bill for payment.' });
    }
  };

  const totalLocalPrice = Object.entries(localOrder).reduce((acc, [orderKey, quantity]) => {
    const [menuItemId, batchId] = orderKey.split('::');
    const item = menuItems?.find((m) => m.id === menuItemId) as any;
    if (!item) return acc;
    const batch = batchId ? item.available_batches?.find((b: any) => b.id === batchId) : null;
    const price = batch?.selling_price || item.price;
    return acc + price * quantity;
  }, 0);
  const totalBill = (openOrder?.total_price || 0) + totalLocalPrice;
  const isBilled = openOrder?.status === 'billed';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="flex-shrink-0 p-6 pb-0">
          <DialogTitle>Table {table?.table_number} - Order</DialogTitle>
        </DialogHeader>

        {/* Grid container: using min-h-0 & flex-1 to allow children to size correctly */}
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6 items-start flex-1 min-h-0 p-6 pt-2">
          {/* Menu Card */}
          <Card className="lg:col-span-3 h-full flex flex-col overflow-hidden">
            <CardHeader className="flex-shrink-0 p-4 pb-3">
              <CardTitle className="text-base">Menu</CardTitle>
              <CardDescription className="text-xs">Select items to add to the order.</CardDescription>

              <div className="flex gap-2 items-center flex-wrap mt-2">
                <div className="relative flex-grow min-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search menu..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8 pl-8 w-full text-xs"
                  />
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 max-w-[180px] truncate px-3 text-xs">{selectedCategory || 'All Categories'}</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="max-h-64 overflow-y-auto text-xs">
                    <DropdownMenuItem className="py-1.5 text-xs" onSelect={() => setSelectedCategory(null)}>All Categories</DropdownMenuItem>
                    {menuCategories.map((cat) => (
                      <DropdownMenuItem className="py-1.5 text-xs" key={cat} onSelect={() => setSelectedCategory(cat)}>{cat}</DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>


              </div>
            </CardHeader>

            <CardContent className="flex-1 min-h-0 overflow-hidden px-4 pb-4">
              {/* ScrollArea must fill the remaining height */}
              <ScrollArea className="h-full pr-4">
                <div className="space-y-2">
                  {isLoading ? (
                    [...Array(10)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
                  ) : filteredMenuItems.length > 0 ? (
                    filteredMenuItems.map((item) => {
                      const currentCountInCart = Object.entries(localOrder)
                        .filter(([k]) => k.startsWith(item.id))
                        .reduce((sum, [, qty]) => sum + qty, 0);
                      const effectiveStock = (item as any).restaurant_stock ?? item.stock ?? 0;
                      const isOutOfStock = item.stock_type === 'Inventoried' && effectiveStock - currentCountInCart <= 0;
                      return (
                        <div key={item.id} className="flex items-center justify-between gap-3 p-1.5 rounded-lg hover:bg-muted">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="relative w-12 h-12 rounded-md overflow-hidden bg-muted flex items-center justify-center shrink-0">
                              {fallbackImage ? (
                                <Image src={fallbackImage.imageUrl} alt={item.name} fill className="object-cover" />
                              ) : (
                                <Utensils className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>

                            <div>
                              <p className="truncate text-sm font-semibold">{item.name}</p>
                              {item.stock_type === 'Inventoried' ? (() => {
                                const batches: any[] = (item as any).available_batches ?? [];
                                const prices = [...new Set(batches.map((b: any) => b.selling_price).filter((p: any) => p != null && p > 0))] as number[];
                                if (prices.length === 0) return <p className="text-xs text-muted-foreground">Price by batch</p>;
                                const min = Math.min(...prices); const max = Math.max(...prices);
                                return <p className="text-xs text-muted-foreground">LKR {min === max ? min.toFixed(2) : `${min.toFixed(2)} – ${max.toFixed(2)}`}</p>;
                              })() : (
                                <p className="text-xs text-muted-foreground">LKR {item.price.toFixed(2)}</p>
                              )}
                              {item.stock_type === 'Inventoried' && (
                                <p className={`text-xs ${!isOutOfStock ? 'text-primary' : 'text-destructive'}`}>Stock: {effectiveStock - currentCountInCart}</p>
                              )}
                            </div>
                          </div>

                          <Button size="sm" className="h-7 shrink-0 px-2.5 text-xs" onClick={() => handleAddItemClick(item)} disabled={isOutOfStock}>
                            <PlusCircle className="mr-1 h-3.5 w-3.5" /> Add
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
          <Card className="lg:col-span-2 h-full flex flex-col overflow-hidden sticky top-0">
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

                  {/* Customer Mobile (Loyalty) */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Customer Mobile (Loyalty)</label>
                    <Input
                      placeholder="e.g. 0771234567 (optional)"
                      value={customerMobile}
                      onChange={(e) => setCustomerMobile(e.target.value)}
                      onBlur={handleSaveCustomerMobile}
                      className="h-8 text-sm"
                    />
                  </div>

                  {isBilled && (
                    <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-300 dark:border-yellow-700 rounded-lg px-3 py-2 text-sm text-yellow-800 dark:text-yellow-300">
                      <Clock className="h-4 w-4 shrink-0" />
                      <span>Bill sent — awaiting payment from cashier.</span>
                    </div>
                  )}

                  <Separator />
                  <h3 className="font-semibold">Current Order</h3>
                  <div className="space-y-2">
                    {isLoading ? (
                      <Skeleton className="h-16 w-full" />
                    ) : orderItems && orderItems.length > 0 ? (
                      orderItems.map((item) => {
                        const menuItem = menuItems.find(menu => menu.id === item.menu_item_id);
                        const kitchenStatus = KITCHEN_STATUS[item.kitchen_status || 'pending'];
                        const needsKitchenPreparation = menuItem?.stock_type === 'Non-Inventoried';
                        const preparedQuantity = item.kitchen_status === 'ready' || item.kitchen_status === 'done'
                          ? item.quantity
                          : Math.min(item.quantity, item.prepared_quantity ?? 0);
                        const isFullyPrepared = needsKitchenPreparation && preparedQuantity >= item.quantity;
                        const isPresented = (item.served_quantity ?? 0) >= item.quantity;

                        return (
                          <div key={item.id} className={`flex justify-between items-center text-sm p-2 rounded-md border ${isFullyPrepared ? 'bg-emerald-50 border-emerald-200' : 'bg-secondary/20 border-transparent'}`}>
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium flex items-center gap-1.5 ${isFullyPrepared ? 'text-emerald-800' : ''}`}>
                                {isFullyPrepared && <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />}
                                {item.name}
                              </p>
                              <p className="text-xs text-muted-foreground">LKR {(item.price * item.quantity).toFixed(2)}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                {needsKitchenPreparation && kitchenStatus && (
                                  <Badge variant="outline" className={`h-5 text-[10px] ${kitchenStatus.className}`}>
                                    {isFullyPrepared && <CheckCircle className="mr-1 h-3 w-3" />}
                                    {preparedQuantity}/{item.quantity}
                                  </Badge>
                                )}
                                <Button type="button" size="sm" variant="outline" className={`h-6 w-6 p-0 ${isPresented ? 'border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600 hover:text-white' : 'border-slate-300 text-slate-400'}`} disabled={updatingPresentedItemId === item.id} onClick={() => handlePresentedToggle(item)} title={isPresented ? 'Unmark as presented' : 'Mark as presented to the customer'} aria-label={isPresented ? 'Unmark as presented' : 'Mark as presented to the customer'} aria-pressed={isPresented}><CheckCircle className="h-3.5 w-3.5" /></Button>
                              </div>
                            </div>
                            {isBilled ? (
                              <span className="text-sm font-medium ml-2">× {item.quantity}</span>
                            ) : (
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleUpdateOrderItemQuantity(item, -1)}><MinusCircle className="h-3 w-3" /></Button>
                                <span className="w-4 text-center font-bold">{item.quantity}</span>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleUpdateOrderItemQuantity(item, 1)}><PlusCircle className="h-3 w-3" /></Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveOrderItem(item)}><Trash2 className="h-3 w-3" /></Button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground pt-1">No items in the current order.</p>
                    )}
                  </div>

                  {!isBilled && <><Separator />
                  <h3 className="font-semibold">New Items</h3>
                  <div className="space-y-1">
                    {Object.keys(localOrder).length > 0 ? (
                      Object.entries(localOrder).map(([orderKey, quantity]) => {
                        const [menuItemId, batchId] = orderKey.split('::');
                        const item = menuItems?.find((m) => m.id === menuItemId) as any;
                        if (!item) return null;
                        const batch = batchId ? item.available_batches?.find((b: any) => b.id === batchId) : null;
                        const price = batch?.selling_price || item.price;
                        const batchLabel = batch ? ` (Batch: ${batch.batch_number})` : '';
                        return (
                          <div key={orderKey} className="flex justify-between items-center text-sm mb-1">
                            <div><p>{item.name}{batchLabel} x {quantity}</p></div>
                            <div className="flex items-center gap-2">
                              <p>LKR {(price * quantity).toFixed(2)}</p>
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
                  </>}
                </div>
              </ScrollArea>
            </CardContent>

            <CardFooter className="flex flex-col gap-4 mt-auto border-t pt-4 flex-shrink-0">
              {!isBilled && (
                <>
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
                </>
              )}

              {isBilled && (
                <>
                  <div className="w-full flex items-center justify-between gap-2 text-sm text-yellow-700 dark:text-yellow-400 font-medium py-1">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Waiting for cashier to complete payment…
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => fetchData()}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    className="w-full"
                    variant="default"
                    disabled={!(openOrder as any)?.confirmed_total}
                    onClick={() => setShowBillBreakdown(true)}
                  >
                    {(openOrder as any)?.confirmed_total
                      ? `View Bill — LKR ${((openOrder as any).confirmed_total as number).toFixed(2)}`
                      : 'View Bill (awaiting cashier confirmation)'}
                  </Button>
                </>
              )}
            </CardFooter>
          </Card>
        </div>

        {/* Bill Breakdown Dialog — shown after cashier confirms */}
        <Dialog open={showBillBreakdown} onOpenChange={setShowBillBreakdown}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Bill — Table {table.table_number}</DialogTitle>
            </DialogHeader>
            {billingConfig && openOrder && (() => {
              const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
              const scLines = (billingConfig.service_charges || []).filter(s => s.enabled).map(s => ({ ...s, amt: s.type === 'percentage' ? subtotal * s.value / 100 : s.value }));
              const ocLines = (billingConfig.other_charges || []).filter(o => o.enabled).map(o => ({ ...o, amt: o.type === 'percentage' ? subtotal * o.value / 100 : o.value }));
              const scTotal = scLines.reduce((a, l) => a + l.amt, 0);
              const ocTotal = ocLines.reduce((a, l) => a + l.amt, 0);
              const vatAmt = billingConfig.vat?.enabled ? (subtotal + scTotal + ocTotal) * billingConfig.vat.rate / 100 : 0;
              const grandTotal = (openOrder as any).confirmed_total ?? (subtotal + scTotal + ocTotal + vatAmt);
              return (
                <div className="space-y-3 py-2">
                  <div className="space-y-1 text-sm">
                    {orderItems.map(item => (
                      <div key={item.id} className="flex justify-between text-muted-foreground">
                        <span>{item.name} × {item.quantity}</span>
                        <span>LKR {(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>LKR {subtotal.toFixed(2)}</span></div>
                    {scLines.map(s => <div key={s.id} className="flex justify-between text-muted-foreground"><span>{s.name}{s.type === 'percentage' ? ` (${s.value}%)` : ''}</span><span>LKR {s.amt.toFixed(2)}</span></div>)}
                    {ocLines.map(o => <div key={o.id} className="flex justify-between text-muted-foreground"><span>{o.name}{o.type === 'percentage' ? ` (${o.value}%)` : ''}</span><span>LKR {o.amt.toFixed(2)}</span></div>)}
                    {billingConfig.vat?.enabled && <div className="flex justify-between text-muted-foreground"><span>VAT ({billingConfig.vat.rate}%)</span><span>LKR {vatAmt.toFixed(2)}</span></div>}
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-lg text-green-700 dark:text-green-400">
                    <span>Total</span><span>LKR {grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              );
            })()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBillBreakdown(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Batch Selection Dialog */}
        <Dialog open={!!batchSelectionItem} onOpenChange={(open) => !open && setBatchSelectionItem(null)}>
          <DialogContent className="max-w-md" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>Select Batch — {batchSelectionItem?.name}</DialogTitle>
              <DialogDescription>Choose which batch to use for this item.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
              {batchSelectionItem?.available_batches?.map((b: any) => {
                const orderKey = `${batchSelectionItem.id}::${b.id}`;
                const inCart = localOrder[orderKey] || 0;
                const outOfStock = b.quantity - inCart <= 0;
                const noPriceSet = !b.selling_price;
                return (
                  <div key={b.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-semibold text-sm">Batch: {b.batch_number || '—'}</p>
                      {b.expiry_date && <p className="text-xs text-muted-foreground">Expires: {b.expiry_date}</p>}
                      <p className="text-xs font-medium mt-1">Stock: {b.quantity - inCart}</p>
                      {noPriceSet
                        ? <p className="text-xs text-destructive font-semibold">Selling Price: Not set — set in Menu Management</p>
                        : <p className="text-xs text-primary font-semibold">Selling Price: LKR {b.selling_price.toFixed(2)}</p>
                      }
                    </div>
                    <Button size="sm" onClick={() => handleAddConfirmedItem(batchSelectionItem, b.id)} disabled={outOfStock || noPriceSet}>
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
