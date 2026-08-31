
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
  Unlock,
  Pencil,
  ReceiptText,
  Plus,
  X,
  ScanLine,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useUserContext } from '@/context/user-context';
import { BarcodeScanner } from '@/components/dashboard/inventory-management/barcode-scanner';

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
  const [customerMobile, setCustomerMobile] = useState('');
  const [guestCustomer, setGuestCustomer] = useState<{ id: string; name: string; current_room?: string } | null>(null);
  const [billingConfig, setBillingConfig] = useState<BillingCfg | null>(null);
  const [showBillBreakdown, setShowBillBreakdown] = useState(false);
  const [updatingPresentedItemId, setUpdatingPresentedItemId] = useState<string | null>(null);
  const [isReleasingTable, setIsReleasingTable] = useState(false);
  const [mobileView, setMobileView] = useState<'menu' | 'bill'>('menu');
  const [showMobileNewItems, setShowMobileNewItems] = useState(false);

  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const isTableLocked = Boolean(openOrder?.waiter_id && openOrder.waiter_id !== currentUser?.id);

  const showTableLockedMessage = () => {
    toast({
      variant: 'destructive',
      title: 'Table Assigned to Another Waiter',
      description: `${openOrder?.waiter_name || 'Another waiter'} is currently handling this table.`,
    });
  };

  const getPreparedQuantity = (item: OrderItem) =>
    ['ready', 'done'].includes(item.kitchen_status || '')
      ? item.quantity
      : Math.min(item.quantity, item.prepared_quantity ?? 0);

  const showPreparedItemMessage = () => {
    toast({
      variant: 'destructive',
      title: 'Item Already Prepared',
      description: 'The quantity cannot be reduced below the amount already prepared by the kitchen.',
    });
  };

  // Fetch logic
  const fetchData = useCallback(async () => {
    if (!isOpen) return;
    setIsLoading(true);
    try {
      // Fetch Menu Items and Categories via API route (service role key — bypasses RLS)
      const menuApiRes = await fetch('/api/admin/menu-items').then(r => r.json());

      // Fetch Restaurant Warehouse ID and stock concurrently
      const { data: restaurantWH } = await supabase.from('inventory_warehouses').select('id').eq('name', 'Restaurant').maybeSingle();
      const restaurantWHId = restaurantWH?.id;
      const stockRes = restaurantWHId
        ? await supabase.from('inventory_stock').select('*, batch:inventory_batches(*)').eq('warehouse_id', restaurantWHId)
        : { data: [] };

      const menuRawItems = menuApiRes.menuItems ?? [];

      if (menuRawItems.length > 0) {
        const stockData = stockRes.data || [];
        const todayStr = new Date().toISOString().split('T')[0];

        // Fetch batch pricing for all menu items in one query
        const allMenuItemIds = menuRawItems.map((m: any) => m.id);
        const { data: allPricingData } = allMenuItemIds.length > 0
          ? await supabase.from('menu_item_batch_pricing').select('menu_item_id, batch_id, selling_price').in('menu_item_id', allMenuItemIds)
          : { data: [] };
        const pricingMap: Record<string, Record<string, number>> = {};
        (allPricingData ?? []).forEach((p: any) => {
          if (!pricingMap[p.menu_item_id]) pricingMap[p.menu_item_id] = {};
          pricingMap[p.menu_item_id][p.batch_id] = p.selling_price;
        });

        const enhancedMenuItems = menuRawItems.map((item: any) => {
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
                 quantity: s.quantity,
                 selling_price: pricingMap[item.id]?.[s.batch.id] ?? null,
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
        if ((orderData as any).customer_id) {
          const customerRes = await fetch(`/api/admin/customers?id=${encodeURIComponent((orderData as any).customer_id)}`);
          const customerData = await customerRes.json();
          setGuestCustomer(customerData.customers?.[0] || null);
        } else {
          setGuestCustomer(null);
        }
        const { data: itemsData } = await supabase.from('order_items').select('*').eq('order_id', orderData.id);
        if (itemsData) setOrderItems(itemsData as any);
      } else {
        setOpenOrder(null);
        setOrderItems([]);
        setCustomerMobile('');
        setGuestCustomer(null);
        setBillingConfig(null);
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

  // Load billing config as soon as order is billed so breakdown shows immediately
  useEffect(() => {
    if (openOrder?.status !== 'billed') { setBillingConfig(null); return; }
    fetch('/api/admin/app-settings?key=restaurant_billing_config')
      .then(r => r.json())
      .then(res => { if (res.value) setBillingConfig(res.value as BillingCfg); })
      .catch(() => {});
  }, [openOrder?.status, openOrder?.id]);

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
  const [customItems, setCustomItems] = useState<Array<{ id: string; name: string; price: number; quantity: number }>>([]);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [customItemQuantity, setCustomItemQuantity] = useState('1');
  const [editingCustomItemId, setEditingCustomItemId] = useState<string | null>(null);
  const [editingCustomItemName, setEditingCustomItemName] = useState('');
  const [editingCustomItemPrice, setEditingCustomItemPrice] = useState('');
  const [editingCustomItemQuantity, setEditingCustomItemQuantity] = useState('1');

  // reset UI state on close (but keep localOrder for persistence)
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setSelectedCategory(null);
      setMobileView('menu');
      setShowMobileNewItems(false);
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

  // Real-time subscription for Order Items and Order row (catches confirmed_total updates from cashier)
  useEffect(() => {
    if (!openOrder?.id || !isOpen) return;

    const channel = supabase.channel(`order-waiter-${openOrder.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'order_items', filter: `order_id=eq.${openOrder.id}` },
        (payload: any) => {
          if (payload.eventType === 'UPDATE' && payload.new?.id) {
            setOrderItems(current => current.map(item => item.id === payload.new.id
              ? { ...item, ...payload.new }
              : item));
            return;
          }
          if (payload.eventType === 'INSERT' && payload.new?.id) {
            setOrderItems(current => current.some(item => item.id === payload.new.id)
              ? current
              : [...current, payload.new as OrderItem]);
            return;
          }
          if (payload.eventType === 'DELETE' && payload.old?.id) {
            setOrderItems(current => current.filter(item => item.id !== payload.old.id));
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${openOrder.id}` },
        (payload: any) => {
          if (payload.new?.id) {
            setOpenOrder(current => current ? { ...current, ...payload.new } : current);
          }
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
    if (isTableLocked) return showTableLockedMessage();
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
    if (isTableLocked) return showTableLockedMessage();
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
    if (isTableLocked) return showTableLockedMessage();
    setLocalOrder((prev) => {
      const newCount = (prev[orderKey] || 0) - 1;
      if (newCount <= 0) {
        const { [orderKey]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [orderKey]: newCount };
    });
  };

  const handleAddCustomItem = () => {
    if (isTableLocked) return showTableLockedMessage();
    const name = customItemName.trim();
    const price = Number(customItemPrice);
    const quantity = Number(customItemQuantity);

    if (!name || !Number.isFinite(price) || price < 0 || !Number.isInteger(quantity) || quantity < 1) {
      toast({
        variant: 'destructive',
        title: 'Invalid Custom Item',
        description: 'Enter an item name, a valid unit price, and a whole-number quantity.',
      });
      return;
    }

    setCustomItems(current => [...current, { id: crypto.randomUUID(), name, price, quantity }]);
    setCustomItemName('');
    setCustomItemPrice('');
    setCustomItemQuantity('1');
  };

  const handleSaveCustomItemName = async (item: OrderItem) => {
    const name = editingCustomItemName.trim();
    const price = Number(editingCustomItemPrice);
    const quantity = Number(editingCustomItemQuantity);
    const preparedQuantity = getPreparedQuantity(item);
    if (!name || !Number.isFinite(price) || price < 0 || !Number.isInteger(quantity) || quantity < 1) {
      toast({ variant: 'destructive', title: 'Invalid Custom Item', description: 'Enter a name, valid unit price, and whole-number quantity.' });
      return;
    }
    if (isTableLocked) return showTableLockedMessage();
    if (quantity < preparedQuantity) return showPreparedItemMessage();

    const itemUpdate: Record<string, any> = { name, price, quantity };
    if (quantity > item.quantity && ['ready', 'done'].includes(item.kitchen_status || '')) {
      itemUpdate.prepared_quantity = item.quantity;
      itemUpdate.kitchen_status = 'preparing';
      itemUpdate.prepared_at = null;
    }
    const { error } = await supabase.from('order_items').update(itemUpdate).eq('id', item.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
      return;
    }
    const newTotal = Math.max(0, (openOrder?.total_price ?? 0) - (item.price * item.quantity) + (price * quantity));
    const { error: totalError } = await supabase.from('orders').update({ total_price: newTotal, updated_at: new Date().toISOString() }).eq('id', openOrder?.id);
    if (totalError) {
      toast({ variant: 'destructive', title: 'Total Update Failed', description: totalError.message });
      return;
    }
    setOrderItems(current => current.map(existing => existing.id === item.id ? { ...existing, ...itemUpdate } : existing));
    setOpenOrder(current => current ? { ...current, total_price: newTotal } : current);
    setEditingCustomItemId(null);
    setEditingCustomItemName('');
    setEditingCustomItemPrice('');
    setEditingCustomItemQuantity('1');
  };

  const handleAddItemsToBill = async () => {
    if (isTableLocked) return showTableLockedMessage();
    if (!table || !currentUser || (Object.keys(localOrder).length === 0 && customItems.length === 0)) return;

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
          ...(guestCustomer ? { customer_id: guestCustomer.id } : {}),
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
          const batch = batchId ? (menuItem as any).available_batches?.find((b: any) => b.id === batchId) : null;
          const itemPrice = batch?.selling_price || menuItem.price;
          orderTotalPriceUpdate += itemPrice * quantityToAdd;

          // Check if item (with same price) exists in order
          const { data: existingItems } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', currentOrderId)
            .eq('menu_item_id', menuItemId)
            .eq('price', itemPrice);

          if (existingItems && existingItems.length > 0) {
            const existingItem = existingItems[0];
            const quantityUpdate: Record<string, any> = {
              quantity: existingItem.quantity + quantityToAdd,
            };
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

      for (const customItem of customItems) {
        orderTotalPriceUpdate += customItem.price * customItem.quantity;
        const { error: customItemError } = await supabase.from('order_items').insert([{
          order_id: currentOrderId,
          menu_item_id: null,
          name: customItem.name,
          price: customItem.price,
          quantity: customItem.quantity,
        }]);
        if (customItemError) throw customItemError;
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
        ...(guestCustomer ? { customer_id: guestCustomer.id } : {}),
      }).eq('id', currentOrderId);

      // Update Table Status
      if (table.status === 'available') {
        await supabase.from('restaurant_tables').update({ status: 'occupied' }).eq('id', table.id);
      }

      setLocalOrder({});
      setCustomItems([]);
      setMobileView('bill');
      setShowMobileNewItems(false);
      toast({ title: 'Items Added', description: 'New items have been added to the bill.' });
      await fetchData();
    } catch (error) {
      console.error('Error adding items to order:', error);
      toast({ variant: 'destructive', title: 'Order Failed', description: 'Could not add items to the order.' });
    }
  };

  const handleGuestQrScan = async (code: string) => {
    if (isTableLocked) return showTableLockedMessage();
    try {
      const res = await fetch(`/api/admin/front-desk/guest-pass?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Guest QR pass was not recognized');
      const customer = data.customer;
      setGuestCustomer(customer);
      if (customer.phone) setCustomerMobile(customer.phone);
      if (openOrder?.id) {
        const { error } = await supabase.from('orders').update({
          customer_id: customer.id,
          ...(customer.phone ? { customer_mobile: customer.phone } : {}),
        }).eq('id', openOrder.id);
        if (error) throw error;
        setOpenOrder(current => current ? { ...current, customer_id: customer.id } : current);
      }
      toast({ title: 'Guest Added', description: `${customer.name}${customer.current_room ? ` — ${customer.current_room}` : ''}` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Guest Not Found', description: error.message });
    }
  };

  const handleUpdateOrderItemQuantity = async (item: OrderItem, delta: number) => {
    if (isTableLocked) return showTableLockedMessage();
    if (delta === 0) return;
    const newQuantity = item.quantity + delta;
    if (delta < 0 && newQuantity < getPreparedQuantity(item)) return showPreparedItemMessage();
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
      const newTotal = currentTotal + (item.price * delta);
      await supabase.from('orders').update({
        total_price: newTotal,
        updated_at: new Date().toISOString(),
      }).eq('id', openOrder?.id);

      setOrderItems(current => current.map(existing => existing.id === item.id
        ? { ...existing, ...quantityUpdate }
        : existing));
      setOpenOrder(current => current ? { ...current, total_price: newTotal } : current);
    } catch (error) {
      console.error('Error updating item quantity:', error);
      toast({ variant: 'destructive', title: 'Update Failed' });
    }
  };

  const handleRemoveOrderItem = async (item: OrderItem) => {
    if (isTableLocked) return showTableLockedMessage();
    if (getPreparedQuantity(item) > 0) return showPreparedItemMessage();
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
      const newTotal = Math.max(0, currentTotal - (item.price * item.quantity));
      await supabase.from('orders').update({
        total_price: newTotal,
        updated_at: new Date().toISOString(),
      }).eq('id', openOrder?.id);

      setOrderItems(current => current.filter(existing => existing.id !== item.id));
      setOpenOrder(current => current ? { ...current, total_price: newTotal } : current);
      toast({ title: 'Item Removed' });
    } catch (error) {
      console.error('Error removing item:', error);
      toast({ variant: 'destructive', title: 'Removal Failed' });
    }
  };

  const handleSaveCustomerMobile = async () => {
    if (isTableLocked) return;
    if (!openOrder?.id || !customerMobile) return;
    await supabase.from('orders').update({ customer_mobile: customerMobile }).eq('id', openOrder.id);
  };

  const handlePresentedToggle = async (item: OrderItem) => {
    if (isTableLocked) return showTableLockedMessage();
    const isPresented = (item.served_quantity ?? 0) >= item.quantity;
    const nextServed = isPresented ? 0 : item.quantity;

    setUpdatingPresentedItemId(item.id);
    try {
      const { error } = await supabase
        .from('order_items')
        .update({ served_quantity: nextServed })
        .eq('id', item.id);
      if (error) throw error;

      setOrderItems(current => current.map(existing => existing.id === item.id
        ? { ...existing, served_quantity: nextServed }
        : existing));
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: error?.message || 'Could not update presentation status.' });
    } finally {
      setUpdatingPresentedItemId(null);
    }
  };

  const handleProcessPayment = async () => {
    if (isTableLocked) return showTableLockedMessage();
    if (!openOrder || !table) {
      toast({ variant: 'destructive', title: 'Cannot Process Payment', description: 'There is no open order for this table.' });
      return;
    }

    try {
      const { error: billingError } = await supabase.from('orders').update({
        status: 'billed',
        updated_at: new Date().toISOString()
      }).eq('id', openOrder.id);
      if (billingError) throw billingError;

      // Keep table occupied — only the cashier confirming payment should free it
      await supabase.from('restaurant_tables').update({ status: 'occupied' }).eq('id', table.id);

      setLocalOrder({});
      toast({ title: 'Bill Sent for Payment', description: `The bill for Table ${table.table_number} is now pending payment.` });
      window.dispatchEvent(new Event('notifications-changed'));
      fetchData();
    } catch (error) {
      console.error('Error processing payment:', error);
      toast({ variant: 'destructive', title: 'Process Failed', description: 'Could not send the bill for payment.' });
    }
  };

  const handleReleaseTable = async () => {
    if (!openOrder || openOrder.waiter_id !== currentUser?.id) return;

    setIsReleasingTable(true);
    try {
      const response = await fetch('/api/waiter/release-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: table.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not release table');

      setLocalOrder({});
      toast({ title: 'Table Released', description: `Table ${table.table_number} can now be handled by another waiter.` });
      await fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Release Failed', description: error.message });
    } finally {
      setIsReleasingTable(false);
    }
  };

  const isBilled = openOrder?.status === 'billed';

  const totalLocalprice = Object.entries(localOrder).reduce((acc, [orderKey, quantity]) => {
    const [menuItemId, batchId] = orderKey.split('::');
    const item = menuItems?.find((m) => m.id === menuItemId) as any;
    if (!item) return acc;
    const batch = batchId ? item.available_batches?.find((b: any) => b.id === batchId) : null;
    const price = batch?.selling_price || item.price;
    return acc + price * quantity;
  }, 0) + customItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalBill = (openOrder?.total_price || 0) + totalLocalprice;
  const newItemCount = Object.values(localOrder).reduce((sum, quantity) => sum + quantity, 0)
    + customItems.reduce((sum, item) => sum + item.quantity, 0);

  const renderNewItemsEditor = () => (
    <div className="space-y-3">
      <h3 className="font-semibold">New Items</h3>
      <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/20 p-3 sm:grid-cols-12 sm:p-2">
        <Input
          className="col-span-2 h-10 text-sm sm:col-span-5 sm:h-8"
          placeholder="Custom item (e.g. Hoppers)"
          value={customItemName}
          onChange={event => setCustomItemName(event.target.value)}
          disabled={isTableLocked}
        />
        <Input
          className="h-10 text-sm sm:col-span-3 sm:h-8"
          type="number"
          min="0"
          step="0.01"
          placeholder="Unit price"
          value={customItemPrice}
          onChange={event => setCustomItemPrice(event.target.value)}
          disabled={isTableLocked}
        />
        <Input
          className="h-10 text-sm sm:col-span-2 sm:h-8"
          type="number"
          min="1"
          step="1"
          aria-label="Custom item quantity"
          value={customItemQuantity}
          onChange={event => setCustomItemQuantity(event.target.value)}
          disabled={isTableLocked}
        />
        <Button className="col-span-2 h-10 sm:col-span-2 sm:h-8" size="sm" type="button" onClick={handleAddCustomItem} disabled={isTableLocked}>
          Add
        </Button>
      </div>
      <div className="space-y-2">
        {newItemCount > 0 ? (
          <>
            {Object.entries(localOrder).map(([orderKey, quantity]) => {
              const [menuItemId, batchId] = orderKey.split('::');
              const item = menuItems?.find((menuItem) => menuItem.id === menuItemId) as any;
              if (!item) return null;
              const batch = batchId ? item.available_batches?.find((entry: any) => entry.id === batchId) : null;
              const price = batch?.selling_price || item.price;
              const batchLabel = batch ? ` (Batch: ${batch.batch_number})` : '';
              return (
                <div key={orderKey} className="flex items-center justify-between gap-2 text-sm">
                  <p className="min-w-0 flex-1 truncate">{item.name}{batchLabel} x {quantity}</p>
                  <p className="shrink-0">LKR {(price * quantity).toFixed(2)}</p>
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 sm:h-6 sm:w-6 sm:border-0" disabled={isTableLocked} onClick={() => handleAddConfirmedItem(item, batchId || null)} aria-label={`Add another ${item.name}`}>
                    <PlusCircle className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 sm:h-6 sm:w-6 sm:border-0" disabled={isTableLocked} onClick={() => handleRemoveItem(orderKey)} aria-label={`Remove one ${item.name}`}>
                    <MinusCircle className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
            {customItems.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                <p className="min-w-0 flex-1 truncate">{item.name} x {item.quantity}</p>
                <p className="shrink-0">LKR {(item.price * item.quantity).toFixed(2)}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-destructive sm:h-6 sm:w-6"
                  disabled={isTableLocked}
                  onClick={() => setCustomItems(current => current.filter(existing => existing.id !== item.id))}
                  aria-label={`Remove ${item.name}`}
                >
                  <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                </Button>
              </div>
            ))}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Add items from the menu or enter a custom item.</p>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="h-[100dvh] max-h-[100dvh] max-w-6xl flex flex-col overflow-hidden border-0 p-0 sm:h-[90vh] sm:max-h-[90vh] sm:border">
        <DialogHeader className="flex-shrink-0 px-4 pb-0 pt-4 text-left sm:p-6 sm:pb-0">
          <DialogTitle>Table {table?.table_number} - Order</DialogTitle>
        </DialogHeader>

        {!isBilled && (
          <div className="grid grid-cols-2 gap-1 border-b px-4 pb-3 pt-3 md:hidden">
            <Button
              type="button"
              variant={mobileView === 'menu' ? 'default' : 'ghost'}
              className="h-11"
              onClick={() => setMobileView('menu')}
            >
              <Utensils className="mr-2 h-4 w-4" />
              Menu
            </Button>
            <Button
              type="button"
              variant={mobileView === 'bill' ? 'default' : 'ghost'}
              className="relative h-11"
              onClick={() => setMobileView('bill')}
            >
              <ReceiptText className="mr-2 h-4 w-4" />
              Bill
              {newItemCount > 0 && (
                <span className="ml-2 min-w-5 rounded-full bg-background px-1.5 text-xs font-bold text-foreground">
                  {newItemCount}
                </span>
              )}
            </Button>
          </div>
        )}

        {/* Grid container: using min-h-0 & flex-1 to allow children to size correctly */}
        <div className={`grid flex-1 min-h-0 items-start gap-0 overflow-hidden p-3 sm:p-6 sm:pt-2 md:gap-6 ${isBilled ? 'grid-cols-1 max-w-xl mx-auto w-full' : 'md:grid-cols-2 lg:grid-cols-5'}`}>
          {/* Menu Card — hidden when bill is sent to payment */}
          {!isBilled && <Card className={`${mobileView === 'menu' ? 'flex' : 'hidden'} h-full flex-col overflow-hidden md:flex lg:col-span-3`}>
            <CardHeader className="flex-shrink-0 p-4 pb-3">
              <CardTitle className="text-base">Menu</CardTitle>
              <CardDescription className="text-xs">Select items to add to the order.</CardDescription>

              <div className="flex gap-2 items-center flex-wrap mt-2">
                <div className="relative min-w-0 flex-grow sm:min-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search menu..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-10 w-full pl-9 text-sm sm:h-8 sm:pl-8 sm:text-xs"
                  />
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-10 max-w-[150px] truncate px-3 text-xs sm:h-8 sm:max-w-[180px]">
                      {selectedCategory || 'All Categories'}
                    </Button>
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
                        .reduce((sum, [_, qty]) => sum + qty, 0);
                      const isLinked = !!item.linked_inventory_item_id;
                      const effectiveStock = isLinked
                        ? ((item as any).restaurant_stock ?? 0)
                        : (item.stock ?? 0);
                      const isOutOfStock = item.stock_type === 'Inventoried' && effectiveStock - currentCountInCart <= 0;
                      return (
                        <div key={item.id} className="flex min-h-16 items-center justify-between gap-3 rounded-md border-b p-2 last:border-b-0 hover:bg-muted sm:min-h-0 sm:border-0 sm:p-1.5">
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
                                <p className={`text-xs ${!isOutOfStock ? 'text-primary' : 'text-destructive'}`}>
                                  Stock: {effectiveStock - currentCountInCart}
                                </p>
                              )}
                            </div>
                          </div>

                          <Button size="sm" className="h-10 shrink-0 px-3 text-xs sm:h-7 sm:px-2.5" onClick={() => handleAddItemClick(item)} disabled={isOutOfStock || isTableLocked}>
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
            <div className="flex-shrink-0 border-t bg-background md:hidden">
              <div className="flex h-14 items-center justify-between px-4">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">New Items</span>
                  {newItemCount > 0 && (
                    <Badge variant="secondary" className="min-w-6 justify-center px-1.5">
                      {newItemCount}
                    </Badge>
                  )}
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant={showMobileNewItems ? 'secondary' : 'default'}
                  className="h-10 w-10"
                  onClick={() => setShowMobileNewItems(current => !current)}
                  title={showMobileNewItems ? 'Close new item editor' : 'Add a new item'}
                  aria-label={showMobileNewItems ? 'Close new item editor' : 'Add a new item'}
                  aria-expanded={showMobileNewItems}
                >
                  {showMobileNewItems ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                </Button>
              </div>
              {showMobileNewItems && (
                <div className="max-h-[42vh] overflow-y-auto border-t p-4">
                  {renderNewItemsEditor()}
                </div>
              )}
              <div className="border-t p-3">
                <Button
                  type="button"
                  className="h-11 w-full"
                  onClick={handleAddItemsToBill}
                  disabled={newItemCount === 0 || isTableLocked}
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Add {newItemCount} {newItemCount === 1 ? 'Item' : 'Items'} to Order
                </Button>
              </div>
            </div>
          </Card>}

          {/* Current Bill Card */}
          <Card className={`${isBilled || mobileView === 'bill' ? 'flex' : 'hidden'} h-full flex-col overflow-hidden md:flex lg:col-span-2`}>
            <CardHeader className="flex-shrink-0 p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center">
                  <ShoppingCart className="mr-2" /> Current Bill
                </CardTitle>
                {openOrder?.waiter_id === currentUser?.id && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 shrink-0 px-2.5 text-xs sm:px-3"
                    disabled={isReleasingTable}
                    onClick={handleReleaseTable}
                  >
                    <Unlock className="mr-1.5 h-3.5 w-3.5" />
                    {isReleasingTable ? 'Releasing…' : 'Release Table'}
                  </Button>
                )}
              </div>
              {table && <Badge className="capitalize w-fit">{table.status}</Badge>}
              {openOrder?.waiter_name && <p className="text-sm text-muted-foreground pt-1">Waiter: {openOrder.waiter_name}</p>}
              {isTableLocked && (
                <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  View only — {openOrder?.waiter_name || 'another waiter'} is handling this table.
                </div>
              )}
            </CardHeader>

            <CardContent className="flex-1 min-h-0 overflow-hidden px-4 sm:px-6">
              <ScrollArea className="h-full pr-2 sm:pr-4">
                <div className="space-y-3 sm:space-y-4">

                  {/* Customer Mobile (Loyalty) */}
                  <div className="space-y-2 rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">In-House Guest</p>
                        {guestCustomer ? (
                          <p className="text-sm font-semibold">{guestCustomer.name}{guestCustomer.current_room ? ` · ${guestCustomer.current_room}` : ''}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground">No guest attached</p>
                        )}
                      </div>
                      <BarcodeScanner
                        onScan={handleGuestQrScan}
                        title="Scan Guest QR Pass"
                        description="Scan an active in-house guest's QR pass to attach them to this order."
                        successTitle="Guest QR Captured"
                        trigger={<Button type="button" size="sm" variant="outline" disabled={isTableLocked}><ScanLine className="mr-2 h-4 w-4" />Scan QR</Button>}
                      />
                    </div>
                  </div>

                  {/* Customer Mobile (Loyalty) */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Customer Mobile (Loyalty)</label>
                    <Input
                      placeholder="e.g. 0771234567 (optional)"
                      value={customerMobile}
                      onChange={(e) => setCustomerMobile(e.target.value)}
                      onBlur={handleSaveCustomerMobile}
                      disabled={isTableLocked}
                      className="h-8 text-sm"
                    />
                  </div>

                  {/* Payment-pending banner */}
                  {isBilled && (
                    <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-300 dark:border-yellow-700 rounded-lg px-3 py-2 text-sm text-yellow-800 dark:text-yellow-300">
                      <Clock className="h-4 w-4 shrink-0" />
                      <span>Bill sent — awaiting payment from cashier.</span>
                    </div>
                  )}

                  <Separator />
                  <h3 className="text-sm font-semibold sm:text-base">Order Items</h3>
                  <div className="space-y-1.5 sm:space-y-2">
                    {isLoading ? (
                      <Skeleton className="h-16 w-full" />
                    ) : orderItems && orderItems.length > 0 ? (
                      orderItems.map((item) => {
                        const menuItem = menuItems.find(menu => menu.id === item.menu_item_id);
                        const kitchenStatus = KITCHEN_STATUS[item.kitchen_status || 'pending'];
                        // Custom items have no menu_item_id, but still go through
                        // the kitchen preparation workflow.
                        const needsKitchenPreparation = !menuItem || menuItem.stock_type === 'Non-Inventoried';
                        const preparedQuantity = item.kitchen_status === 'ready' || item.kitchen_status === 'done'
                          ? item.quantity
                          : Math.min(item.quantity, item.prepared_quantity ?? 0);
                        const isFullyPrepared = needsKitchenPreparation && preparedQuantity >= item.quantity;
                        const cannotReducePreparedItem = needsKitchenPreparation && item.quantity <= preparedQuantity;
                        const cannotRemovePreparedItem = needsKitchenPreparation && preparedQuantity > 0;
                        const isPresented = (item.served_quantity ?? 0) >= item.quantity;

                        return (
                          <div
                            key={item.id}
                            className={`flex flex-col items-stretch gap-1.5 rounded-md border p-2 text-xs sm:flex-row sm:items-center sm:gap-2 sm:text-sm ${
                              !item.menu_item_id
                                ? 'border-amber-300 bg-amber-50/70'
                                : isFullyPrepared
                                ? 'bg-emerald-50 border-emerald-200'
                                : 'bg-secondary/20 border-transparent'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              {editingCustomItemId === item.id ? (
                                <div className="grid grid-cols-12 gap-1.5 pr-2">
                                  <Input className="col-span-12 h-7 text-sm sm:col-span-5" value={editingCustomItemName} onChange={event => setEditingCustomItemName(event.target.value)} placeholder="Item name" autoFocus />
                                  <Input className="col-span-5 h-7 text-sm sm:col-span-3" type="number" min="0" step="0.01" value={editingCustomItemPrice} onChange={event => setEditingCustomItemPrice(event.target.value)} placeholder="Price" />
                                  <Input className="col-span-3 h-7 text-sm sm:col-span-2" type="number" min={preparedQuantity || 1} step="1" value={editingCustomItemQuantity} onChange={event => setEditingCustomItemQuantity(event.target.value)} aria-label="Quantity" />
                                  <Button size="sm" className="h-7 px-2" onClick={() => handleSaveCustomItemName(item)}>Save</Button>
                                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingCustomItemId(null)}>Cancel</Button>
                                </div>
                              ) : (
                                <div className={`flex items-center gap-1.5 text-sm font-medium ${isFullyPrepared ? 'text-emerald-800' : ''}`}>
                                  {isFullyPrepared && <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />}
                                  {item.name}
                                  {!item.menu_item_id && <Badge className="h-5 bg-amber-500 text-[10px] text-white">Custom</Badge>}
                                  {!item.menu_item_id && !isTableLocked && !isBilled && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingCustomItemId(item.id); setEditingCustomItemName(item.name); setEditingCustomItemPrice(String(item.price)); setEditingCustomItemQuantity(String(item.quantity)); }} aria-label={`Edit ${item.name}`}>
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              )}
                              <p className="text-[11px] text-muted-foreground sm:text-xs">LKR {(item.price * item.quantity).toFixed(2)}</p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1 sm:mt-1 sm:gap-1.5">
                                {needsKitchenPreparation && kitchenStatus && (
                                  <Badge variant="outline" className={`h-5 text-[10px] ${kitchenStatus.className}`}>
                                    {isFullyPrepared && <CheckCircle className="mr-1 h-3 w-3" />}
                                    {preparedQuantity}/{item.quantity}
                                  </Badge>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className={`h-6 w-6 p-0 ${isPresented ? 'border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600 hover:text-white' : 'border-slate-300 text-slate-400'}`}
                                  disabled={updatingPresentedItemId === item.id || isTableLocked}
                                  onClick={() => handlePresentedToggle(item)}
                                  title={isPresented ? 'Unmark as presented' : 'Mark as presented to the customer'}
                                  aria-label={isPresented ? 'Unmark as presented' : 'Mark as presented to the customer'}
                                  aria-pressed={isPresented}
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                            {isBilled ? (
                              <span className="text-sm font-medium ml-2">× {item.quantity}</span>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5 border-t pt-1.5 sm:justify-start sm:gap-1 sm:border-0 sm:pt-0">
                                <Button variant="outline" size="icon" className="h-8 w-8 sm:h-6 sm:w-6 sm:border-0" disabled={isTableLocked || cannotReducePreparedItem} onClick={() => handleUpdateOrderItemQuantity(item, -1)} title={cannotReducePreparedItem ? 'Prepared items cannot be reduced' : 'Reduce quantity'}>
                                  <MinusCircle className="h-4 w-4 sm:h-3 sm:w-3" />
                                </Button>
                                <span className="w-7 text-center text-sm font-bold sm:w-4">{item.quantity}</span>
                                <Button variant="outline" size="icon" className="h-8 w-8 sm:h-6 sm:w-6 sm:border-0" disabled={isTableLocked} onClick={() => handleUpdateOrderItemQuantity(item, 1)}>
                                  <PlusCircle className="h-4 w-4 sm:h-3 sm:w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="ml-auto h-8 w-8 text-destructive sm:ml-0 sm:h-6 sm:w-6" disabled={isTableLocked || cannotRemovePreparedItem} onClick={() => handleRemoveOrderItem(item)} title={cannotRemovePreparedItem ? 'Prepared items cannot be removed' : 'Remove item'}>
                                  <Trash2 className="h-4 w-4 sm:h-3 sm:w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground pt-1">No items in the current order.</p>
                    )}
                  </div>

                  {/* New-item editor remains in Current Bill on desktop. */}
                  {!isBilled && (
                    <div className="hidden md:block">
                      <Separator />
                      <div className="pt-4">{renderNewItemsEditor()}</div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>

            <CardFooter className="mt-auto flex flex-shrink-0 flex-col gap-3 border-t bg-background p-4 sm:gap-4 sm:px-6 sm:pb-6 sm:pt-4">
              {!isBilled && (
                <>
                  <div className="flex w-full items-center justify-between text-lg font-bold sm:text-xl">
                    <span>Total Bill:</span>
                    <span>LKR {totalBill.toFixed(2)}</span>
                  </div>
                  <Button className="h-11 w-full" onClick={handleAddItemsToBill} disabled={(Object.keys(localOrder).length === 0 && customItems.length === 0) || isTableLocked}>
                    Add {newItemCount > 0 ? `${newItemCount} New ` : ''}Items to Bill
                  </Button>
                  <Button className="h-11 w-full" variant="secondary" onClick={handleProcessPayment} disabled={!openOrder || isTableLocked}>
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
                      <p className="font-semibold text-sm">Batch: {b.batch_number || '—'}</p>
                      {b.expiry_date && <p className="text-xs text-muted-foreground">Expires: {b.expiry_date}</p>}
                      <p className="text-xs font-medium mt-1">Stock: {b.quantity - inCart}</p>
                      <p className="text-xs text-primary font-semibold">Selling Price: LKR {(b.selling_price || batchSelectionItem.price).toFixed(2)}</p>
                    </div>
                    <Button size="sm" onClick={() => handleAddConfirmedItem(batchSelectionItem, b.id)} disabled={outOfStock || isTableLocked}>
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
