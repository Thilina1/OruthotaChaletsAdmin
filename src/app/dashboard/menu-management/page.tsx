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
import type { MenuItem as MenuItemType, MenuCategory, MenuSection } from '@/lib/types';
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



export default function MenuManagementPage() {
    const supabase = createClient();
    const { toast } = useToast();
    const { user: currentUser } = useUserContext();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<MenuItemType | null>(null);
    const [menuItems, setMenuItems] = useState<MenuItemType[]>([]);
    const [categories, setCategories] = useState<MenuSection[]>([]);
    const [isLoading, setIsLoading] = useState(true);


    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [itemsRes, categoriesRes] = await Promise.all([
                supabase.from('menu_items').select('*').order('name'),
                fetch('/api/admin/menu-sections').then(res => res.json())
            ]);

            if (itemsRes.error) throw itemsRes.error;
            setMenuItems(itemsRes.data as MenuItemType[]);

            if (categoriesRes.error) throw new Error(categoriesRes.error);
            setCategories(categoriesRes.sections || []);

        } catch (error: any) {
            console.error("Error fetching data:", error);
            toast({ variant: 'destructive', title: "Error", description: "Failed to fetch data." });
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
        if (confirm('Are you sure you want to delete this menu item? This cannot be undone.')) {
            try {
                const { error } = await supabase.from('menu_items').delete().eq('id', id);
                if (error) throw error;
                toast({
                    title: 'Menu Item Deleted',
                    description: 'The item has been successfully removed from the menu.',
                });
                fetchData();
            } catch (error) {
                console.error("Error deleting menu item: ", error);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Failed to delete menu item.",
                });
            }
        }
    };

    const handleFormSubmit = async (values: any) => {
        if (!currentUser) return;

        // Map form values (camelCase) to DB values (snake_case)
        const dataToSave = {
            name: values.name,
            description: values.description,
            price: values.price,
            buying_price: values.buyingPrice,
            category: values.category,
            availability: values.availability,
            stock_type: values.stockType,
            stock: values.stockType === 'Non-Inventoried' ? null : values.stock,

            sell_type: 'Direct', // Default
        };

        try {
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

    const renderTableForCategory = (category: MenuCategory) => {
        const filteredItems = menuItems.filter(item => item.category === category);
        return (
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
                    {filteredItems.map((item) => (
                        <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>LKR {item.price.toFixed(2)}</TableCell>
                            <TableCell>LKR {item.buying_price ? item.buying_price.toFixed(2) : 'N/A'}</TableCell>
                            <TableCell>
                                {item.stock_type === 'Inventoried' ? item.stock : 'N/A'}
                            </TableCell>
                            <TableCell>
                                <Switch
                                    checked={item.availability}
                                    onCheckedChange={(checked) => handleAvailabilityChange(item, checked)}
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
                                        <DropdownMenuItem onClick={() => handleEditItemClick(item)}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="text-red-500 hover:!text-red-500" onClick={() => handleDeleteItem(item.id)}>
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                    {(!filteredItems || filteredItems.length === 0) && (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                                No items found in this category.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
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
                    <DialogTrigger asChild>
                        <Button onClick={handleAddItemClick}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Menu Item
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}</DialogTitle>
                        </DialogHeader>
                        <MenuItemForm
                            item={editingItem}
                            onSubmit={handleFormSubmit}

                            categories={categories}
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
                    {categories.length > 0 ? (
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
