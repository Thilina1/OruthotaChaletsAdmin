import { useMemo, useState, useEffect } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Table as TableType, MenuItem, Order, OrderItem, MenuCategory } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, MinusCircle, ShoppingCart, Search, Utensils } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useUserContext } from '@/context/user-context';

interface AddToBillModalProps {
    table: TableType;
    isOpen: boolean;
    onClose: () => void;
}



export function AddToBillModal({ table, isOpen, onClose }: AddToBillModalProps) {
    const supabase = createClient();
    const { toast } = useToast();
    const { user: currentUser } = useUserContext();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<MenuCategory | null>(null);
    const fallbackImage = PlaceHolderImages.find(p => p.id === 'login-background');

    // Data states
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [openOrder, setOpenOrder] = useState<Order | null>(null);
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);

    // Fetch logic
    useEffect(() => {
        if (!isOpen) return;
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch Menu and Categories
                const [menuRes, categoriesRes] = await Promise.all([
                    supabase.from('menu_items').select('*, hotel_inventory_items(current_stock)'),
                    supabase.from('menu_sections').select('*').order('name')
                ]);

                if (menuRes.data) setMenuItems(menuRes.data as any);

                if (categoriesRes && categoriesRes.data) {
                    setMenuCategories(categoriesRes.data.map((s: any) => s.name));
                }

                // Fetch Order
                const { data: orderData } = await supabase.from('orders')
                    .select('*')
                    .eq('table_id', table.id)
                    .eq('status', 'open')
                    .single();

                if (orderData) {
                    setOpenOrder(orderData as any);
                    // Fetch Items
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
        };
        fetchData();
    }, [isOpen, table.id, supabase]);

    const [localOrder, setLocalOrder] = useState<Record<string, number>>({});

    useEffect(() => {
        if (!isOpen) {
            setLocalOrder({});
            setSearchTerm('');
            setSelectedCategory(null);
        }
    }, [isOpen]);

    const filteredMenuItems = useMemo(() => {
        if (!menuItems) return [];
        return menuItems
            .filter(item => item.availability && item.sell_type !== 'Indirect')
            .filter(item => selectedCategory ? item.category === selectedCategory : true)
            .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [menuItems, searchTerm, selectedCategory]);

    const handleAddItem = (menuItem: MenuItem) => {
        const isLinked = !!menuItem.linked_inventory_item_id;
        const effectiveStock = isLinked
            ? ((menuItem as any).hotel_inventory_items?.current_stock ?? 0)
            : (menuItem.stock ?? 0);
        const currentCountInCart = localOrder[menuItem.id] || 0;

        if (menuItem.stock_type === 'Inventoried' && effectiveStock - currentCountInCart <= 0) {
            toast({ variant: 'destructive', title: 'Out of Stock', description: `${menuItem.name} is currently unavailable.` });
            return;
        }
        setLocalOrder(prev => ({
            ...prev,
            [menuItem.id]: (prev[menuItem.id] || 0) + 1,
        }));
    };

    const handleRemoveItem = (menuItemId: string) => {
        setLocalOrder(prev => {
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

            if (!currentOrderId) throw new Error("Failed to create or find order.");

            let orderTotalPriceUpdate = 0;

            for (const menuItemId in localOrder) {
                const quantity = localOrder[menuItemId];
                const menuItem = menuItems?.find(m => m.id === menuItemId);

                if (menuItem) {
                    orderTotalPriceUpdate += menuItem.price * quantity;

                    // Check existing
                    const { data: existingItems } = await supabase.from('order_items')
                        .select('*')
                        .eq('order_id', currentOrderId)
                        .eq('menu_item_id', menuItemId);

                    if (existingItems && existingItems.length > 0) {
                        const existing = existingItems[0];
                        await supabase.from('order_items').update({ quantity: existing.quantity + quantity }).eq('id', existing.id);
                    } else {
                        await supabase.from('order_items').insert([{
                            order_id: currentOrderId,
                            menu_item_id: menuItemId,
                            name: menuItem.name,
                            price: menuItem.price,
                            quantity
                        }]);
                    }

                    if (menuItem.stock_type === 'Inventoried') {
                        if (menuItem.linked_inventory_item_id) {
                            const { data: currentItem } = await supabase.from('hotel_inventory_items').select('current_stock').eq('id', menuItem.linked_inventory_item_id).single();
                            if (currentItem) {
                                const newStock = (currentItem.current_stock || 0) - quantity;
                                await supabase.from('hotel_inventory_items').update({ current_stock: newStock }).eq('id', menuItem.linked_inventory_item_id);

                                await supabase.from('inventory_transactions').insert([{
                                    item_id: menuItem.linked_inventory_item_id,
                                    transaction_type: 'issue',
                                    quantity: quantity,
                                    previous_stock: currentItem.current_stock || 0,
                                    new_stock: newStock,
                                    reason: 'Sold via POS',
                                    created_by: currentUser.id,
                                }]);
                            }
                        } else {
                            const { error } = await supabase.rpc('decrement_stock', { item_id: menuItem.id, quantity });
                            if (error) {
                                const { data: curr } = await supabase.from('menu_items').select('stock').eq('id', menuItem.id).single();
                                if (curr) await supabase.from('menu_items').update({ stock: (curr.stock || 0) - quantity }).eq('id', menuItem.id);
                            }
                        }
                    }
                }
            }

            // Update Total
            const { data: freshOrder } = await supabase.from('orders').select('total_price').eq('id', currentOrderId).single();
            const currentTotal = freshOrder?.total_price || 0;

            await supabase.from('orders').update({
                total_price: currentTotal + orderTotalPriceUpdate,
                updated_at: new Date().toISOString(),
                waiter_id: currentUser.id,
                waiter_name: currentUser.name,
            }).eq('id', currentOrderId);

            if (table.status === 'available') {
                await supabase.from('restaurant_tables').update({ status: 'occupied' }).eq('id', table.id);
            }

            setLocalOrder({});
            toast({ title: 'Items Added', description: 'New items have been added to the bill.' });
            onClose();

        } catch (error) {
            console.error('Error adding items to order:', error);
            toast({ variant: 'destructive', title: 'Order Failed', description: 'Could not add items to the order.' });
        }
    };

    // const isLoading ...

    const totalLocalPrice = Object.entries(localOrder).reduce((acc, [id, quantity]) => {
        const item = menuItems?.find(m => m.id === id);
        return acc + (item ? item.price * quantity : 0);
    }, 0);

    const totalBill = (openOrder?.total_price || 0) + totalLocalPrice;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Table {table?.table_number} - Order</DialogTitle>
                </DialogHeader>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 items-start flex-1 overflow-hidden">
                    <Card className="lg:col-span-2 h-full flex flex-col">
                        <CardHeader>
                            <CardTitle>Menu</CardTitle>
                            <CardDescription>Select items to add to the order.</CardDescription>
                            <div className="flex gap-2 items-center flex-wrap">
                                <div className="relative flex-grow min-w-[200px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search menu..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10 w-full"
                                    />
                                </div>
                                <Button variant={!selectedCategory ? 'default' : 'outline'} onClick={() => setSelectedCategory(null)} size="sm">All</Button>
                                {menuCategories.map(cat => (
                                    <Button key={cat} variant={selectedCategory === cat ? 'default' : 'outline'} onClick={() => setSelectedCategory(cat)} size="sm">{cat}</Button>
                                ))}
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-hidden">
                            <ScrollArea className="h-full">
                                <div className="space-y-2 pr-4">
                                    {isLoading ? (
                                        [...Array(10)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
                                    ) : filteredMenuItems.map(item => {
                                        const currentCountInCart = localOrder[item.id] || 0;
                                        const isLinked = !!item.linked_inventory_item_id;
                                        const effectiveStock = isLinked
                                            ? ((item as any).hotel_inventory_items?.current_stock ?? 0)
                                            : (item.stock ?? 0);
                                        const isOutOfStock = item.stock_type === 'Inventoried' && effectiveStock - currentCountInCart <= 0;
                                        return (
                                            <div key={item.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted">
                                                <div className="flex items-center gap-4">
                                                    <div className="relative w-16 h-16 rounded-md overflow-hidden bg-muted flex items-center justify-center shrink-0">
                                                        {fallbackImage ? (
                                                            <Image src={fallbackImage.imageUrl} alt={item.name} layout="fill" className="object-cover" />
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
                                                <Button size="sm" onClick={() => handleAddItem(item)} disabled={isOutOfStock}>
                                                    <PlusCircle className="mr-2 h-4 w-4" /> Add
                                                </Button>
                                            </div>
                                        )
                                    })}
                                    {!isLoading && filteredMenuItems.length === 0 && (
                                        <div className="text-center text-muted-foreground py-10">
                                            No menu items found.
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    <Card className="sticky top-0 h-full flex flex-col">
                        <CardHeader>
                            <CardTitle className="flex items-center"><ShoppingCart className="mr-2" /> Current Bill</CardTitle>
                            {table && <Badge className="capitalize w-fit">{table.status}</Badge>}
                            {openOrder?.waiter_name && <p className="text-sm text-muted-foreground pt-1">Waiter: {openOrder.waiter_name}</p>}
                        </CardHeader>
                        <CardContent className="space-y-4 flex-1 overflow-auto">

                            <Separator />
                            <h3 className="font-semibold my-2">Current Order</h3>
                            <div className="space-y-1 pr-2 max-h-32 overflow-y-auto">
                                {isLoading ? <Skeleton className="h-16 w-full" /> :
                                    orderItems && orderItems.length > 0 ? (
                                        orderItems.map(item => (
                                            <div key={item.id} className="flex justify-between items-center text-sm">
                                                <p>{item.name} x {item.quantity}</p>
                                                <p>LKR {(item.price * item.quantity).toFixed(2)}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No items in the current order.</p>
                                    )}
                            </div>

                            <Separator className="my-2" />
                            <h3 className="font-semibold mb-2">New Items</h3>
                            <div className="space-y-1 pr-2 max-h-48 overflow-y-auto">
                                {Object.keys(localOrder).length > 0 ? (
                                    Object.entries(localOrder).map(([id, quantity]) => {
                                        const item = menuItems?.find(m => m.id === id);
                                        if (!item) return null;
                                        return (
                                            <div key={id} className="flex justify-between items-center text-sm mb-1">
                                                <div><p>{item.name} x {quantity}</p></div>
                                                <div className="flex items-center gap-2">
                                                    <p>LKR {(item.price * quantity).toFixed(2)}</p>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleAddItem(item)}><PlusCircle className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveItem(id)}><MinusCircle className="h-4 w-4" /></Button>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-sm text-muted-foreground">Add items from the menu.</p>
                                )}
                            </div>

                        </CardContent>
                        <CardFooter className="flex flex-col gap-4 mt-auto border-t pt-4">
                            <div className="w-full flex justify-between items-center text-xl font-bold">
                                <span>Total Bill:</span>
                                <span>LKR {totalBill.toFixed(2)}</span>
                            </div>
                            <Button className="w-full" onClick={handleAddItemsToBill} disabled={Object.keys(localOrder).length === 0}>Add Items to Bill</Button>
                        </CardFooter>
                    </Card>
                </div>
            </DialogContent>
        </Dialog>
    );
}
