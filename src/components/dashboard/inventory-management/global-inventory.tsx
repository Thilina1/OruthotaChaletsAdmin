'use client';

import { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Boxes, Package, Warehouse, Info, Plus, Send, Search, LayoutGrid } from 'lucide-react';
import { useUserContext } from '@/context/user-context';
import { useToast } from '@/hooks/use-toast';
import type { HotelInventoryItem, InventoryDepartment, MenuSection } from '@/lib/types';
import { cn } from '@/lib/utils';
import { InventoryItemForm } from '@/components/dashboard/inventory-management/inventory-item-form';

interface GlobalInventoryProps {
    items: HotelInventoryItem[];
    departments: InventoryDepartment[];
}

export function GlobalInventory({ items: allItems, departments: allDepartments }: GlobalInventoryProps) {
    const [viewMode, setViewMode] = useState('by-product');
    const { user } = useUserContext();
    const isStockKeeperOrAdmin = user?.role === 'admin' || user?.department === 'Stores' || user?.job_title === 'Store keeper';
    const { toast } = useToast();
    const [isRegistering, setIsRegistering] = useState<string | null>(null);
    const [requestItem, setRequestItem] = useState<{ id: string, name: string, unit: string } | null>(null);
    const [requestQuantity, setRequestQuantity] = useState<string>('');
    const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
    const [isAddingProduct, setIsAddingProduct] = useState(false);
    const [isCreatingNewItem, setIsCreatingNewItem] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [menuCategories, setMenuCategories] = useState<MenuSection[]>([]);
    const [rolInputs, setRolInputs] = useState<Record<string, string>>({});

    const userDepartment = useMemo(() => {
        if (!user?.department) return null;
        return allDepartments.find(d => d.name === user.department);
    }, [user, allDepartments]);

    // For the Master-Detail sidebar: exclude any store that acts as a central warehouse
    const departments = useMemo(() =>
        allDepartments.filter(d => {
            if (d.status !== 'active') return false;
            const name = d.name.toLowerCase();
            return !(name === 'store' || name === 'warehouse' || name === 'store (warehouse)' || name === 'store wearehouse' || name.includes('warehouse') || name.includes('wearehouse'));
        })
        , [allDepartments]);

    // For aggregation (By Product view): filter stores based on role (admins see all, others see own)
    const items = useMemo(() => {
        let activeDepts = allDepartments.filter(d => d.status === 'active');
        
        if (user?.role !== 'admin' && userDepartment) {
            activeDepts = activeDepts.filter(d => d.id === userDepartment.id);
        }
        
        const activeDeptIds = activeDepts.map(d => d.id);
        return allItems.filter(item => activeDeptIds.includes(item.department_id));
    }, [allItems, allDepartments, user, userDepartment]);

    const [selectedStoreId, setSelectedStoreId] = useState<string | null>(departments[0]?.id || null);

    const handleRegisterItem = async (productName: string, category: string, unit: string, targetDeptId: string, targetDeptName: string) => {
        const reorderLevel = parseFloat(rolInputs[`${productName}-${category}-${targetDeptId}`] || '0');

        if (!targetDeptId) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Target store not specified."
            });
            return;
        }

        setIsRegistering(productName);
        try {
            const res = await fetch('/api/admin/hotel-inventory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: productName,
                    category,
                    unit,
                    department_id: targetDeptId,
                    current_stock: 0,
                    reorder_level: reorderLevel,
                    status: 'active'
                }),
            });

            if (!res.ok) throw new Error('Failed to register item');

            toast({
                title: "Success",
                description: `${productName} has been added to ${targetDeptName}. You can now request stock from the warehouse.`,
            });

            // Refresh the page data
            window.location.reload();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to add item to your store."
            });
        } finally {
            setIsRegistering(null);
        }
    };

    const handleRequestStock = async () => {
        const requestingDept = userDepartment || activeStore;
        if (!requestItem || !requestQuantity || !requestingDept) {
            console.log("Missing data for request:", { requestItem, requestQuantity, requestingDept });
            return;
        }

        setIsSubmittingRequest(true);
        try {
            const res = await fetch('/api/admin/inventory-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    request_type: 'TRANSFER_REQUEST',
                    item_id: requestItem.id,
                    requested_quantity: parseFloat(requestQuantity),
                    notes: `Transfer request for ${requestItem.name} from central warehouse to ${requestingDept.name}`,
                    action_metadata: {
                        requesting_department_id: requestingDept.id,
                        requesting_department_name: requestingDept.name
                    }
                }),
            });

            if (!res.ok) throw new Error('Failed to submit request');

            toast({
                title: "Request Submitted",
                description: `Your transfer request for ${requestQuantity} ${requestItem.unit} of ${requestItem.name} has been sent for approval.`,
            });

            setRequestItem(null);
            setRequestQuantity('');
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to submit request."
            });
        } finally {
            setIsSubmittingRequest(false);
        }
    };

    const handleCreateNewItem = async (values: any) => {
        try {
            const res = await fetch('/api/admin/hotel-inventory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...values,
                    department_id: activeStore?.id // Force current active store
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast({
                title: "Item Created",
                description: `New item ${values.name} has been created and assigned to ${activeStore?.name}.`,
            });

            setIsCreatingNewItem(false);
            window.location.reload();
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: error.message || "Failed to create item." });
        }
    };

    useMemo(() => {
        const fetchCategories = async () => {
            const res = await fetch('/api/admin/menu-sections');
            const data = await res.json();
            if (data.sections) setMenuCategories(data.sections);
        };
        fetchCategories();
    }, []);

    // Group items by name and category
    const aggregatedProducts = useMemo(() => {
        const groups: Record<string, {
            name: string;
            category: string;
            unit: string;
            totalStock: number;
            minSafetyStock: number;
            stores: { storeName: string; stock: number; safetyStock: number; reorderLevel: number }[]
        }> = {};

        items.forEach(item => {
            const key = `${item.name.toLowerCase()}-${item.category.toLowerCase()}`;
            if (!groups[key]) {
                groups[key] = {
                    name: item.name,
                    category: item.category,
                    unit: item.unit,
                    totalStock: 0,
                    minSafetyStock: item.safety_stock,
                    stores: []
                };
            }
            groups[key].totalStock += Number(item.current_stock);
            groups[key].minSafetyStock = Math.min(groups[key].minSafetyStock, item.safety_stock);
            groups[key].stores.push({
                storeName: item.department?.name || 'Unassigned',
                stock: Number(item.current_stock),
                safetyStock: item.safety_stock,
                reorderLevel: item.reorder_level || 0
            });
        });

        return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
    }, [items]);

    // Group items by store
    const storesOverview = useMemo(() => {
        // Explicitly exclude variations of "Store (Warehouse)" from the browsing list
        let allowedDepts = departments.filter(d => {
            if (d.status !== 'active') return false;
            const name = d.name.toLowerCase();
            return !(name === 'store' || name === 'warehouse' || name === 'store (warehouse)' || name === 'store wearehouse' || name.includes('warehouse') || name.includes('wearehouse'));
        });

        // Filter for non-admins to only see their department
        if (user?.role !== 'admin' && userDepartment) {
            allowedDepts = allowedDepts.filter(d => d.id === userDepartment.id);
        }

        return allowedDepts
            .map(dept => ({
                ...dept,
                items: items.filter(item => item.department_id === dept.id)
                    .sort((a, b) => a.name.localeCompare(b.name))
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [items, departments, user, userDepartment]);

    const activeStore = useMemo(() => {
        return storesOverview.find(s => s.id === selectedStoreId) || storesOverview[0];
    }, [selectedStoreId, storesOverview]);

    const warehouseStore = useMemo(() => {
        return allDepartments.find(d => {
            const name = d.name.toLowerCase();
            return name === 'store' || name === 'warehouse' || name === 'store (warehouse)' || name === 'store wearehouse' || name.includes('warehouse') || name.includes('wearehouse');
        });
    }, [allDepartments]);

    return (
        <Card className="border-none shadow-none bg-transparent">
            <CardContent className="p-0">
                <Tabs defaultValue="by-product" className="w-full" onValueChange={setViewMode}>
                    <div className="flex justify-between items-center mb-6">
                        <TabsList className="grid w-[400px] grid-cols-2">
                            <TabsTrigger value="by-product" className="flex items-center gap-2">
                                <Package className="h-4 w-4" />
                                By Product
                            </TabsTrigger>
                            <TabsTrigger value="by-store" className="flex items-center gap-2">
                                <Warehouse className="h-4 w-4" />
                                By Store
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="by-product" className="mt-0">
                        <div className="rounded-md border bg-background overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/30">
                                        <TableHead className="w-[40%] text-foreground font-semibold">Product Name</TableHead>
                                        <TableHead className="text-foreground font-semibold">Category</TableHead>
                                        <TableHead className="text-foreground font-semibold">Total Stock</TableHead>
                                        <TableHead className="text-foreground font-semibold">Distribution</TableHead>
                                        <TableHead className="text-foreground font-semibold text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {aggregatedProducts.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                                No inventory data available.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        aggregatedProducts.map((product) => {
                                            const isInMyStore = userDepartment ? product.stores.some(s => s.storeName === userDepartment.name) : false;

                                            return (
                                                <TableRow key={`${product.name}-${product.category}`} className="hover:bg-muted/10">
                                                    <TableCell className="font-medium align-top py-4">
                                                        {product.name}
                                                    </TableCell>
                                                    <TableCell className="align-top py-4">
                                                        <Badge variant="outline" className="font-normal">
                                                            {product.category}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="align-top py-4">
                                                        <div className="flex flex-col">
                                                            <span className={cn(
                                                                "font-bold text-lg",
                                                                product.totalStock <= product.minSafetyStock ? "text-destructive" : "text-foreground"
                                                            )}>
                                                                {product.totalStock}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground uppercase tracking-wider">{product.unit}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <div className="space-y-1 mt-1">
                                                            {product.stores.map((s, idx) => (
                                                                <div key={idx} className="flex justify-between items-center text-sm p-1 rounded hover:bg-muted/20">
                                                                    <span className="text-muted-foreground">{s.storeName}:</span>
                                                                    <span className={cn(
                                                                        "font-medium tabular-nums",
                                                                        s.stock <= s.safetyStock ? "text-destructive" : "text-foreground"
                                                                    )}>
                                                                        {s.stock} {product.unit}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right align-top py-4">
                                                        <div className="flex flex-col items-end gap-2">
                                                            {userDepartment && !isInMyStore && (
                                                                <div className="flex items-center gap-2">
                                                                    <div className="flex flex-col items-end">
                                                                        <Label htmlFor={`rol-${product.name}-${product.category}`} className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Set ROL</Label>
                                                                        <Input
                                                                            id={`rol-${product.name}-${product.category}`}
                                                                            type="number"
                                                                            placeholder="ROL"
                                                                            className="h-8 w-20 text-right px-2"
                                                                            value={rolInputs[`${product.name}-${product.category}-${userDepartment.id}`] || ''}
                                                                            onChange={(e) => setRolInputs(prev => ({ ...prev, [`${product.name}-${product.category}-${userDepartment.id}`]: e.target.value }))}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {userDepartment && (
                                                                isInMyStore ? (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="gap-2"
                                                                        onClick={() => {
                                                                            const storeItem = allItems.find(i => i.department?.name === userDepartment.name && i.name === product.name);
                                                                            if (storeItem) {
                                                                                setRequestItem({ id: storeItem.id, name: product.name, unit: product.unit });
                                                                            }
                                                                        }}
                                                                    >
                                                                        <Package className="h-4 w-4" />
                                                                        Request Stock
                                                                    </Button>
                                                                ) : (
                                                                    <Button
                                                                        variant="secondary"
                                                                        size="sm"
                                                                        className="gap-2"
                                                                        disabled={isRegistering === product.name}
                                                                        onClick={() => handleRegisterItem(product.name, product.category, product.unit, userDepartment.id, userDepartment.name)}
                                                                    >
                                                                        {isRegistering === product.name ? (
                                                                            <span className="animate-spin mr-2">...</span>
                                                                        ) : (
                                                                            <Plus className="h-4 w-4" />
                                                                        )}
                                                                        Add to my Store
                                                                    </Button>
                                                                )
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>

                    <TabsContent value="by-store" className="mt-0">
                        <div className="flex flex-col md:flex-row gap-6 h-[600px]">
                            {/* Sidebar - Master List */}
                            <div className="w-full md:w-64 flex flex-col gap-2 overflow-y-auto pr-2 pb-4 scrollbar-thin scrollbar-thumb-muted-foreground/20">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2 mb-2">Select Store</h3>
                                {storesOverview.map((store) => (
                                    <button
                                        key={store.id}
                                        onClick={() => setSelectedStoreId(store.id)}
                                        className={cn(
                                            "flex flex-col items-start p-3 rounded-lg border transition-all text-left",
                                            selectedStoreId === store.id
                                                ? "bg-primary/10 border-primary ring-1 ring-primary"
                                                : "bg-background hover:bg-muted/50 border-transparent hover:border-muted-foreground/20"
                                        )}
                                    >
                                        <div className="flex items-center gap-2 w-full">
                                            <Warehouse className={cn("h-4 w-4", selectedStoreId === store.id ? "text-primary" : "text-muted-foreground")} />
                                            <span className={cn("font-semibold truncate", selectedStoreId === store.id ? "text-primary" : "text-foreground")}>
                                                {store.name}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2">
                                            <Package className="h-3 w-3" />
                                            {store.items.length} {store.items.length === 1 ? 'Item' : 'Items'}
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Detail View */}
                            <div className="flex-1 overflow-hidden flex flex-col border rounded-xl bg-background shadow-sm">
                                {activeStore ? (
                                    <>
                                        <div className="p-4 border-b bg-muted/20 flex justify-between items-center">
                                            <div>
                                                <h3 className="font-bold text-lg flex items-center gap-2">
                                                    <Warehouse className="h-5 w-5 text-primary" />
                                                    {activeStore.name}
                                                </h3>
                                                <p className="text-xs text-muted-foreground">{activeStore.description || 'Inventory breakdown for this store'}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {(user?.role === 'admin' || userDepartment?.id === activeStore.id) && (
                                                    <>
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            className="gap-2"
                                                            onClick={() => setIsAddingProduct(true)}
                                                        >
                                                            <Plus className="h-4 w-4" />
                                                            Add Product
                                                        </Button>
                                                        {isStockKeeperOrAdmin && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="gap-2 border-primary/20 hover:bg-primary/5"
                                                                onClick={() => setIsCreatingNewItem(true)}
                                                            >
                                                                <LayoutGrid className="h-4 w-4" />
                                                                New Item
                                                            </Button>
                                                        )}
                                                    </>
                                                )}
                                                <Badge variant="outline" className="bg-background">
                                                    {activeStore.items.length} Products
                                                </Badge>
                                            </div>
                                        </div>

                                        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-muted-foreground/20">
                                            {activeStore.items.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center h-full text-center py-10 opacity-60">
                                                    <Boxes className="h-12 w-12 text-muted-foreground mb-4" />
                                                    <p className="text-muted-foreground font-medium">No items currently in this store.</p>
                                                </div>
                                            ) : (
                                                <div className="rounded-md border overflow-hidden">
                                                    <Table>
                                                        <TableHeader className="bg-muted/30">
                                                            <TableRow>
                                                                <TableHead className="font-semibold text-xs py-2 uppercase tracking-wider">Item Name</TableHead>
                                                                <TableHead className="font-semibold text-xs py-2 uppercase tracking-wider text-right">ROL</TableHead>
                                                                <TableHead className="font-semibold text-xs py-2 uppercase tracking-wider text-right">Current Stock</TableHead>
                                                                <TableHead className="font-semibold text-xs py-2 uppercase tracking-wider text-right">Status</TableHead>
                                                                <TableHead className="font-semibold text-xs py-2 uppercase tracking-wider text-right">Actions</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {activeStore.items.map((item) => (
                                                                <TableRow key={item.id} className="hover:bg-muted/5">
                                                                    <TableCell className="py-3">
                                                                        <div className="font-medium text-sm">{item.name}</div>
                                                                        <div className="text-[10px] text-muted-foreground">{item.category}</div>
                                                                    </TableCell>
                                                                    <TableCell className="text-right py-3 font-medium">
                                                                        {item.reorder_level}
                                                                    </TableCell>
                                                                    <TableCell className="text-right tabular-nums font-bold py-3">
                                                                        {item.current_stock} <span className="text-[10px] text-muted-foreground font-normal ml-1 whitespace-nowrap">{item.unit}</span>
                                                                    </TableCell>
                                                                    <TableCell className="text-right py-3">
                                                                        {Number(item.current_stock) <= Number(item.safety_stock) ? (
                                                                            <Badge variant="destructive" className="text-[10px] py-0 h-5">Low Stock</Badge>
                                                                        ) : Number(item.current_stock) <= Number(item.reorder_level) ? (
                                                                            <Badge variant="outline" className="text-[10px] py-0 h-5 bg-amber-100 text-amber-700 border-amber-200 uppercase font-bold">Low</Badge>
                                                                        ) : (
                                                                            <Badge variant="outline" className="text-[10px] py-0 h-5 text-green-600 border-green-600/30 bg-green-50 uppercase font-bold">Safe</Badge>
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="text-right py-3">
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="h-8 gap-1 text-[10px]"
                                                                            onClick={() => setRequestItem({ id: item.id, name: item.name, unit: item.unit })}
                                                                        >
                                                                            <Send className="h-3 w-3" />
                                                                            Request
                                                                        </Button>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-center p-10">
                                        <Warehouse className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                                        <p className="text-muted-foreground">Select a store from the list to view its contents.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>

            <Dialog open={!!requestItem} onOpenChange={(open) => !open && setRequestItem(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Send className="h-5 w-5 text-primary" />
                            Request Stock
                        </DialogTitle>
                        <DialogDescription>
                            Request items from the central warehouse for <strong>{requestItem?.name}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="quantity" className="text-right">
                                Quantity
                            </Label>
                            <div className="col-span-3 flex items-center gap-2">
                                <Input
                                    id="quantity"
                                    type="number"
                                    placeholder="0.00"
                                    value={requestQuantity}
                                    onChange={(e) => setRequestQuantity(e.target.value)}
                                    className="flex-1"
                                />
                                <span className="text-sm text-muted-foreground font-medium">{requestItem?.unit}</span>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRequestItem(null)}>Cancel</Button>
                        <Button
                            onClick={handleRequestStock}
                            disabled={!requestQuantity || parseFloat(requestQuantity) <= 0 || isSubmittingRequest}
                            className="gap-2"
                        >
                            {isSubmittingRequest ? (
                                <span className="animate-spin mr-2">...</span>
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                            Submit Request
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isAddingProduct} onOpenChange={setIsAddingProduct}>
                <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Plus className="h-5 w-5 text-primary" />
                            Add Product to {activeStore?.name}
                        </DialogTitle>
                        <DialogDescription>
                            Browse all system products and add them to this store.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="relative mt-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search products..."
                            className="pl-10"
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto mt-4 border rounded-md">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead className="text-right">ROL</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {aggregatedProducts
                                    .filter(p => {
                                        // User logic: only display items that are available in the main warehouse
                                        const inWarehouse = p.stores.some(s => {
                                            const name = s.storeName.toLowerCase();
                                            return name === 'store' || name === 'warehouse' || name === 'store (warehouse)' || name === 'store wearehouse' || name.includes('warehouse') || name.includes('wearehouse');
                                        });
                                        if (!inWarehouse) return false;

                                        const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                                            p.category.toLowerCase().includes(productSearch.toLowerCase());
                                        return matchesSearch;
                                    })
                                    .map((product) => {
                                        const alreadyInStore = activeStore && product.stores.some(s => s.storeName === activeStore.name);
                                        return (
                                            <TableRow key={`${product.name}-${product.category}`}>
                                                <TableCell className="font-medium">
                                                    {product.name}
                                                    <div className="text-[10px] text-muted-foreground uppercase">{product.unit}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-[10px]">{product.category}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {alreadyInStore ? (
                                                        <span className="text-xs font-medium text-muted-foreground">
                                                            {product.stores.find(s => s.storeName === activeStore?.name)?.reorderLevel || 0}
                                                        </span>
                                                    ) : (
                                                        <Input
                                                            type="number"
                                                            placeholder="ROL"
                                                            className="h-8 w-16 ml-auto text-right px-2"
                                                            value={rolInputs[`${product.name}-${product.category}-${activeStore?.id}`] || ''}
                                                            onChange={(e) => setRolInputs(prev => ({ ...prev, [`${product.name}-${product.category}-${activeStore?.id}`]: e.target.value }))}
                                                        />
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {alreadyInStore ? (
                                                        <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">Added</Badge>
                                                    ) : (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                            disabled={isRegistering === product.name}
                                                            onClick={() => activeStore && handleRegisterItem(product.name, product.category, product.unit, activeStore.id, activeStore.name)}
                                                        >
                                                            {isRegistering === product.name ? (
                                                                <span className="animate-spin text-xs">...</span>
                                                            ) : (
                                                                <Plus className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                }
                                {aggregatedProducts.filter(p => {
                                    const inWarehouse = p.stores.some(s => {
                                        const name = s.storeName.toLowerCase();
                                        return name === 'store' || name === 'warehouse' || name === 'store (warehouse)' || name === 'store wearehouse' || name.includes('warehouse') || name.includes('wearehouse');
                                    });
                                    if (!inWarehouse) return false;

                                    const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                                        p.category.toLowerCase().includes(productSearch.toLowerCase());
                                    return matchesSearch;
                                }).length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                                                No products available from central warehouse.
                                            </TableCell>
                                        </TableRow>
                                    )}
                            </TableBody>
                        </Table>
                    </div>

                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setIsAddingProduct(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isCreatingNewItem} onOpenChange={setIsCreatingNewItem}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <LayoutGrid className="h-5 w-5 text-primary" />
                            New Item for {activeStore?.name}
                        </DialogTitle>
                        <DialogDescription>
                            Define a brand new product. It will be automatically assigned to your store.
                        </DialogDescription>
                    </DialogHeader>
                    <InventoryItemForm
                        onSubmit={handleCreateNewItem}
                        departments={departments}
                        menuCategories={menuCategories}
                        item={activeStore ? { department_id: activeStore.id } as any : null}
                    />
                </DialogContent>
            </Dialog>
        </Card>
    );
}
