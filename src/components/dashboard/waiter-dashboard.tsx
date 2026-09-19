
'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Utensils, Users, Clock, RefreshCw, Warehouse } from "lucide-react";
import type { Table, RestaurantSection, OrderItem, InventoryItem } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderModal } from './waiter/order-modal';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';

type BilledOrder = { id: string; table_id: string; total_price: number; confirmed_total: number | null; status: string };
type TableBillInfo = { order: BilledOrder; items: OrderItem[] };
type RestaurantStockSummary = {
  warehouseCount: number;
  itemCount: number;
  totalQuantity: number;
  lowStockCount: number;
  warehouses: { id: string; name: string; quantity: number; itemCount: number }[];
};

const statusStyles: Record<string, { badge: string, border: string }> = {
  'occupied': { badge: 'bg-yellow-500', border: 'border-yellow-500' },
  'available': { badge: 'bg-green-500', border: 'border-green-500' },
  'reserved': { badge: 'bg-purple-500', border: 'border-purple-500' },
};

export default function WaiterDashboard() {
  const supabase = createClient();
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [sections, setSections] = useState<RestaurantSection[]>([]);
  const [billedOrders, setBilledOrders] = useState<Record<string, TableBillInfo>>({});
  const [restaurantStock, setRestaurantStock] = useState<RestaurantStockSummary>({
    warehouseCount: 0,
    itemCount: 0,
    totalQuantity: 0,
    lowStockCount: 0,
    warehouses: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [tablesRes, sectionsRes, restaurantWarehouseSettingsRes, inventoryItemsRes] = await Promise.all([
        supabase.from('restaurant_tables').select('*'),
        fetch('/api/admin/restaurant-sections').then(res => res.json()),
        fetch('/api/admin/app-settings?key=restaurant_warehouse_ids').then(res => res.json()).catch(() => ({ value: [] })),
        fetch('/api/admin/inventory/items?includeStock=true').then(res => res.json()).catch(() => ({ items: [] })),
      ]);

      if (tablesRes.error) {
        console.error("Error fetching tables:", tablesRes.error);
      } else {
        setTables(tablesRes.data as any as Table[]);

        const tableIds = (tablesRes.data ?? []).map((t: any) => t.id);
        if (tableIds.length > 0) {
          const { data: ordersData } = await supabase
            .from('orders')
            .select('id, table_id, total_price, confirmed_total, status')
            .in('table_id', tableIds)
            .eq('status', 'billed')
            .order('created_at', { ascending: false });

          if (ordersData && ordersData.length > 0) {
            const ordersByTable: Record<string, BilledOrder> = {};
            ordersData.forEach((o: any) => {
              if (!ordersByTable[o.table_id]) ordersByTable[o.table_id] = o;
            });
            const orderIds = Object.values(ordersByTable).map(o => o.id);
            const { data: itemsData } = await supabase.from('order_items').select('*').in('order_id', orderIds);
            const billMap: Record<string, TableBillInfo> = {};
            Object.values(ordersByTable).forEach(order => {
              billMap[order.table_id] = {
                order,
                items: (itemsData ?? []).filter((i: any) => i.order_id === order.id) as OrderItem[],
              };
            });
            setBilledOrders(billMap);
          } else {
            setBilledOrders({});
          }
        }
      }

      if (sectionsRes.error) {
        console.error("Error fetching sections:", sectionsRes.error);
      } else {
        setSections(sectionsRes.sections || []);
      }

      const restaurantWarehouseIds: string[] = Array.isArray(restaurantWarehouseSettingsRes.value)
        ? restaurantWarehouseSettingsRes.value
        : [];
      const inventoryItems: InventoryItem[] = inventoryItemsRes.items || [];
      const warehouseMap = new Map<string, { id: string; name: string; quantity: number; itemIds: Set<string> }>();
      const availableItemIds = new Set<string>();
      let totalQuantity = 0;
      let lowStockCount = 0;

      inventoryItems.forEach((item: any) => {
        let itemQuantity = 0;
        (item.warehouse_stock || []).forEach((stock: any) => {
          if (!restaurantWarehouseIds.includes(stock.id)) return;
          const qty = Number(stock.total_stock || 0);
          if (qty <= 0) return;
          itemQuantity += qty;
          totalQuantity += qty;
          availableItemIds.add(item.id);
          const current = warehouseMap.get(stock.id) || { id: stock.id, name: stock.name, quantity: 0, itemIds: new Set<string>() };
          current.quantity += qty;
          current.itemIds.add(item.id);
          warehouseMap.set(stock.id, current);
        });
        if (itemQuantity > 0 && itemQuantity <= Number(item.reorder_level || 5)) lowStockCount += 1;
      });

      setRestaurantStock({
        warehouseCount: restaurantWarehouseIds.length,
        itemCount: availableItemIds.size,
        totalQuantity,
        lowStockCount,
        warehouses: [...warehouseMap.values()].map(warehouse => ({
          id: warehouse.id,
          name: warehouse.name,
          quantity: warehouse.quantity,
          itemCount: warehouse.itemIds.size,
        })),
      });

    } catch (e) {
      console.error("Error in fetchData:", e);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();

    const channel = supabase.channel('table-updates-waiter')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const tablesBySection = useMemo(() => {
    if (!tables) return {};
    return tables.reduce((acc, table) => {
      const section = (table as any).location || 'Sri Lankan'; // Use location as section
      if (!acc[section]) {
        acc[section] = [];
      }
      acc[section].push(table);
      return acc;
    }, {} as Record<string, Table[]>);
  }, [tables]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  const handleTableClick = (table: Table) => {
    setSelectedTable(table);
  };

  const handleCloseModal = () => {
    setSelectedTable(null);
    fetchData();
  };


  if (!isLoading && sections.length === 0) {
    return <div className="p-8 text-center">No restaurant sections found. Please contact admin.</div>
  }

  return (
    <>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-headline font-bold">Waiter Dashboard</h1>
            <p className="text-muted-foreground">Oversee tables and manage orders efficiently.</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Card className="border-slate-100">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-primary/10 p-2"><Warehouse className="h-4 w-4 text-primary" /></div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Restaurant Warehouses</p>
                <p className="text-xl font-bold">{restaurantStock.warehouseCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-100">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-emerald-50 p-2"><Package className="h-4 w-4 text-emerald-600" /></div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Available Items</p>
                <p className="text-xl font-bold">{restaurantStock.itemCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-100">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-blue-50 p-2"><Package className="h-4 w-4 text-blue-600" /></div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Total Available Qty</p>
                <p className="text-xl font-bold">{restaurantStock.totalQuantity.toLocaleString('en-LK')}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-100">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-amber-50 p-2"><Clock className="h-4 w-4 text-amber-600" /></div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Low Stock Items</p>
                <p className="text-xl font-bold">{restaurantStock.lowStockCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {restaurantStock.warehouses.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {restaurantStock.warehouses.map(warehouse => (
              <Badge key={warehouse.id} variant="outline" className="bg-slate-50 px-3 py-1 text-xs">
                {warehouse.name}: {warehouse.itemCount} items / {warehouse.quantity.toLocaleString('en-LK')} qty
              </Badge>
            ))}
          </div>
        )}

        {/* Ensure we have sections before rendering Tabs */}
        {sections.length > 0 ? (
          <Tabs defaultValue={sections[0].name} className="w-full">
            <ScrollArea>
              <TabsList className="mb-4 flex w-full">
                {sections.map(section => (
                  <TabsTrigger className="flex-1" key={section.id} value={section.name}>{section.name}</TabsTrigger>
                ))}
              </TabsList>
            </ScrollArea>

            {sections.map(section => (
              <TabsContent value={section.name} key={section.id}>
                <div className="grid grid-cols-[repeat(auto-fill,260px)] justify-center gap-4 sm:justify-start">
                  {isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[260px] w-[260px]" />)}

                  {!isLoading && tablesBySection[section.name] && tablesBySection[section.name].map(table => {
                    const billInfo = billedOrders[table.id];
                    return (
                      <Card
                        key={table.id}
                        className={`h-[260px] w-[260px] overflow-hidden border-2 transition-shadow hover:shadow-lg flex flex-col ${billInfo ? 'border-orange-400' : statusStyles[table.status]?.border || 'border-gray-300'}`}
                      >
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <CardTitle className="text-lg font-bold font-headline">Table {table.table_number}</CardTitle>
                          {billInfo ? (
                            <Badge className="bg-orange-500 text-white flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Awaiting Payment
                            </Badge>
                          ) : (
                            <Badge className={`text-white capitalize ${statusStyles[table.status]?.badge || 'bg-gray-500'}`}>
                              {table.status}
                            </Badge>
                          )}
                        </CardHeader>
                        <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                          {billInfo ? (
                            <div className="space-y-1.5">
                              {billInfo.items.length > 0 ? billInfo.items.map(item => (
                                <div key={item.id} className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">{item.name} × {item.quantity}</span>
                                  <span className="font-medium">LKR {(item.price * item.quantity).toFixed(2)}</span>
                                </div>
                              )) : (
                                <p className="text-xs text-muted-foreground">No item details.</p>
                              )}
                              <Separator className="my-1" />
                              {billInfo.order.confirmed_total ? (
                                <>
                                  <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Subtotal</span>
                                    <span>LKR {billInfo.order.total_price.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-sm font-bold text-green-700 dark:text-green-400">
                                    <span>Total (incl. charges)</span>
                                    <span>LKR {billInfo.order.confirmed_total.toFixed(2)}</span>
                                  </div>
                                </>
                              ) : (
                                <div className="flex justify-between text-sm font-bold">
                                  <span>Total</span>
                                  <span>LKR {billInfo.order.total_price.toFixed(2)}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Users className="w-4 h-4 mr-2" />
                              <span>{table.capacity} Covers</span>
                            </div>
                          )}
                        </CardContent>
                        <div className="p-4 pt-0">
                          <Button
                            className="w-full"
                            variant={billInfo ? 'outline' : 'default'}
                            onClick={() => handleTableClick(table)}
                          >
                            <Utensils className="w-4 h-4 mr-2" />
                            <span>{billInfo ? 'View Bill' : 'View / Add Order'}</span>
                          </Button>
                        </div>
                      </Card>
                    );
                  })}

                  {!isLoading && (!tablesBySection[section.name] || tablesBySection[section.name].length === 0) && (
                    <div className="col-span-full text-center text-muted-foreground py-10">
                      No tables found in this section.
                    </div>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          isLoading ? <Skeleton className="h-64 w-full" /> : null
        )}
      </div>
      {selectedTable && (
        <OrderModal
          table={selectedTable}
          isOpen={!!selectedTable}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}
