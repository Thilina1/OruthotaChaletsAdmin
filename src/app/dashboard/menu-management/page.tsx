'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MoreHorizontal, PlusCircle, Trash2, Edit } from 'lucide-react';
import type { MenuItem as MenuItemType, MenuCategory, MenuSection, HotelInventoryItem, InventoryDepartment } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { MenuItemForm } from '@/components/dashboard/menu-management/menu-item-form';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { useUserContext } from '@/context/user-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from '@/components/ui/switch';
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';



export default function MenuManagementPage() {
    const supabase = createClient();
    const { toast } = useToast();
    const { user: currentUser } = useUserContext();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<MenuItemType | null>(null);
    const [menuItems, setMenuItems] = useState<MenuItemType[]>([]);
    const [categories, setCategories] = useState<MenuSection[]>([]);
    const [inventoryItems, setInventoryItems] = useState<HotelInventoryItem[]>([]);
    const [departments, setDepartments] = useState<InventoryDepartment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);


    const fetchData = async () => {
        setIsLoading(true);
        setFetchError(null);
        try {
            const [itemsRes, categoriesRes, inventoryRes, deptsRes] = await Promise.all([
                supabase.from('menu_items').select('*').order('name'),
                fetch('/api/admin/menu-sections').then(res => res.json()),
                supabase.from('hotel_inventory_items').select('id, name, unit, current_stock, department_id').eq('status', 'active').order('name'),
                supabase.from('inventory_departments').select('*').order('name')
            ]);

            if (itemsRes.error) throw itemsRes.error;
            setMenuItems(itemsRes.data as MenuItemType[]);

            if (categoriesRes.error) throw new Error(categoriesRes.error);
            setCategories(categoriesRes.sections || []);

            if (inventoryRes.error) throw inventoryRes.error;
            setInventoryItems((inventoryRes.data as HotelInventoryItem[]) || []);

            if (deptsRes.error) throw deptsRes.error;
            setDepartments((deptsRes.data as InventoryDepartment[]) || []);

        } catch (error: any) {
            console.error("Error fetching data:", error);
            setFetchError(error.message || "Failed to fetch data.");
            toast({ variant: 'destructive', title: "Error", description: "Failed to fetch data. Check the table for details." });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (currentUser) {
            fetchData();
            // Variety of dishes - stub functionality or fetch if table exists
            // setVarietyOfDishes([]); 
        }
    }, [currentUser]);

    const handleAddItemClick = () => {
        setEditingItem(null);
        setIsDialogOpen(true);
    };

    const handleEditItemClick = (item: MenuItemType) => {
        setEditingItem(item);
        setIsDialogOpen(true);
    };

    const handleDeleteItem = async (id: string) => {
        toast({
            variant: "destructive",
            title: "Deletion Disabled",
            description: "To maintain historical records, item deletion is disabled. Please toggle the Availability switch instead.",
        });
    };

    const handleFormSubmit = async (values: any) => {
        if (!currentUser) return;

        try {
            let finalLinkedId = values.linked_inventory_item_id && values.linked_inventory_item_id !== 'none' ? values.linked_inventory_item_id : null;

            if (values.stockType === 'Inventoried' && values.linked_inventory_item_id === 'none') {
                const newInventoryData = {
                    name: values.name,
                    description: values.description || `Auto-created from POS Menu`,
                    category: values.inventory_category || 'Food & Beverage',
                    department_id: values.department_id === 'none' ? null : values.department_id,
                    unit: values.unit || 'Nos',
                    buying_price: values.buyingPrice || 0,
                    current_stock: values.stock || 0,
                    safety_stock: values.safety_stock || 0,
                    reorder_level: values.reorder_level || 0,
                    maximum_level: values.maximum_level || 0,
                    status: 'active',
                };

                const { data: newInvItem, error: invError } = await supabase.from('hotel_inventory_items').insert([{
                    ...newInventoryData,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }]).select().single();

                if (invError) throw invError;
                finalLinkedId = newInvItem.id;

                setInventoryItems(prev => [...prev, newInvItem as HotelInventoryItem].sort((a, b) => a.name.localeCompare(b.name)));

                if (values.stock && values.stock > 0) {
                    await supabase.from('inventory_transactions').insert([{
                        item_id: newInvItem.id,
                        transaction_type: 'initial_stock',
                        quantity: values.stock,
                        previous_stock: 0,
                        new_stock: values.stock,
                        reason: 'Auto-created from POS menu with initial stock',
                        created_by: currentUser.id,
                    }]);
                }
            }

            // Map form values (camelCase) to DB values (snake_case)
            const dataToSave = {
                name: values.name,
                description: values.description,
                price: values.price,
                buying_price: values.buyingPrice,
                category: values.category,
                availability: values.availability,
                stock_type: values.stockType,
                stock: values.stockType === 'Non-Inventoried' ? null : (finalLinkedId ? null : values.stock),
                linked_inventory_item_id: finalLinkedId,
                sell_type: 'Direct',
            };
            if (editingItem) {
                // Update existing item
                const { data, error } = await supabase.from('menu_items').update({
                    ...dataToSave,
                    updated_at: new Date().toISOString(),
                }).eq('id', editingItem.id).select().single();

                if (error) throw error;

                setMenuItems(prev => prev.map(item => item.id === (data as MenuItemType).id ? (data as MenuItemType) : item));

                toast({ title: "Menu Item Updated", description: "The item details have been updated." });

            } else {
                // Create new item
                const { data, error } = await supabase.from('menu_items').insert([{
                    ...dataToSave,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }]).select().single();

                if (error) throw error;

                setMenuItems(prev => [...prev, (data as MenuItemType)].sort((a, b) => a.name.localeCompare(b.name)));

                toast({ title: "Menu Item Created", description: "A new item has been successfully added to the menu." });
            }
            // fetchData(); // No longer needed for optimistic update, but can keep if we want to be sure. 
            // Commenting out to strictly test "without reload" feel, 
            // but relying on the mapped data is safer if select() returns everything.

        } catch (error: any) {
            console.error("Error saving menu item: ", JSON.stringify(error, null, 2));
            toast({ variant: "destructive", title: "Error", description: `Failed to save menu item: ${error.message || 'Unknown error'}` });
        }

        setIsDialogOpen(false);
        setEditingItem(null);
    };

    const handleAvailabilityChange = async (item: MenuItemType, checked: boolean) => {
        try {
            const { error } = await supabase.from('menu_items').update({ availability: checked }).eq('id', item.id);
            if (error) throw error;
            toast({
                title: "Availability Updated",
                description: `${item.name} is now ${checked ? 'available' : 'unavailable'}.`,
            });
            // Optimistic update
            setMenuItems(prev => prev.map(i => i.id === item.id ? { ...i, availability: checked } : i));
        } catch (error) {
            console.error("Error updating availability: ", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to update item availability.",
            });
        }
    }

    if (!currentUser || isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-start">
                    <Skeleton className="h-12 w-1/2" />
                    <Skeleton className="h-10 w-28" />
                </div>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-1/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-48 w-full" />
                    </CardContent>
                </Card>
            </div>
        )
    }

    const renderTableForCategory = (category: string) => {
        const filteredItems = menuItems.filter(item => item.category === category);
        return (
            <PaginatedMenuCategory
                items={filteredItems}
                inventoryItems={inventoryItems}
                departments={departments}
                onAvailabilityChange={handleAvailabilityChange}
                onEditClick={handleEditItemClick}
                fetchError={fetchError}
            />
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Menu Management</h1>
                    <p className="text-muted-foreground">Manage food and drinks for all menus.</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    if (!open) setEditingItem(null);
                    setIsDialogOpen(open);
                }}>
                    <Button onClick={handleAddItemClick}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Menu Item
                    </Button>
                    <DialogContent className="max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>{editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}</DialogTitle>
                        </DialogHeader>
                        <MenuItemForm
                            item={editingItem}
                            onSubmit={handleFormSubmit}

                            categories={categories}
                            inventoryItems={inventoryItems}
                            departments={departments}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Menu Items</CardTitle>
                    <CardDescription>A list of all items in your menus, organized by category.</CardDescription>
                </CardHeader>
                <CardContent>
                    {categories?.length > 0 ? (
                        <Tabs defaultValue={categories[0].name}>
                            <TabsList className="grid w-full h-auto flex-wrap grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                {categories.map(category => (
                                    <TabsTrigger key={category.id} value={category.name}>{category.name}</TabsTrigger>
                                ))}
                            </TabsList>
                            {categories.map(category => (
                                <TabsContent key={category.id} value={category.name}>
                                    <Card>
                                        <CardContent className="p-0">
                                            {renderTableForCategory(category.name)}
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            ))}
                        </Tabs>
                    ) : (
                        <div className="text-center py-10 text-muted-foreground">
                            No categories found. Please add sections in Menu Settings.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function PaginatedMenuCategory({
    items,
    inventoryItems,
    departments,
    onAvailabilityChange,
    onEditClick,
    fetchError
}: {
    items: MenuItemType[],
    inventoryItems: HotelInventoryItem[],
    departments: InventoryDepartment[],
    onAvailabilityChange: (item: MenuItemType, checked: boolean) => void,
    onEditClick: (item: MenuItemType) => void,
    fetchError: string | null
}) {
    const {
        currentPage,
        totalPages,
        totalItems,
        paginatedItems,
        itemsPerPage,
        setCurrentPage,
    } = usePagination(items, 20);

    return (
        <div className="flex flex-col">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Buying Price</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Availability</TableHead>
                        <TableHead>Last Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {paginatedItems.map((item) => (
                        <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>LKR {item.price.toFixed(2)}</TableCell>
                            <TableCell>LKR {item.buying_price ? item.buying_price.toFixed(2) : 'N/A'}</TableCell>
                            <TableCell>
                                {item.stock_type === 'Inventoried'
                                    ? (item.linked_inventory_item_id
                                        ? (() => {
                                            const linkedItem = inventoryItems.find(inv => inv.id === item.linked_inventory_item_id);
                                            if (linkedItem) {
                                                const restDept = departments.find(d => d.name.toLowerCase() === 'restaurant' || d.name.toLowerCase() === 'kitchen');
                                                const storeDept = departments.find(d => d.name.toLowerCase() === 'store');
                                                
                                                const restItem = restDept ? inventoryItems.find(inv => inv.name === linkedItem.name && inv.department_id === restDept.id) : null;
                                                const storeItem = storeDept ? inventoryItems.find(inv => inv.name === linkedItem.name && inv.department_id === storeDept.id) : null;
                                                
                                                const restQty = restItem ? (restItem.current_stock ?? 0) : (linkedItem.department_id === storeDept?.id ? 0 : (linkedItem.current_stock ?? 0));
                                                const storeQty = storeItem ? (storeItem.current_stock ?? 0) : (linkedItem.department_id === storeDept?.id ? (linkedItem.current_stock ?? 0) : 0);
                                                
                                                return (
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold">{restQty} / {storeQty} {linkedItem.unit || ''}</span>
                                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">(Rest. / Store)</span>
                                                    </div>
                                                );
                                            }
                                            return 'Linked to Hotel Inv.';
                                        })()
                                        : item.stock)
                                    : 'N/A'}
                            </TableCell>
                            <TableCell>
                                <Switch
                                    checked={item.availability}
                                    onCheckedChange={(checked) => onAvailabilityChange(item, checked)}
                                />
                            </TableCell>
                            <TableCell>{item.updated_at ? new Date(item.updated_at).toLocaleString() : 'N/A'}</TableCell>
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                            <span className="sr-only">Open menu</span>
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => onEditClick(item)}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            Edit
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                    {(!paginatedItems || paginatedItems.length === 0) && (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                                {fetchError ? (
                                    <div className="text-destructive font-semibold">
                                        Error loading menu items: {fetchError}
                                        <br />
                                        <span className="text-sm font-normal text-muted-foreground mt-2 inline-block">If you recently enabled soft-deletes, please ensure you have ran the SQL migrations.</span>
                                    </div>
                                ) : (
                                    "No items found in this category."
                                )}
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
            <DataTablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
            />
        </div>
    );
}
