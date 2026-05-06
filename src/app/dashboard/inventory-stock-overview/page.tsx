'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { Loader2, Warehouse, ArrowRightLeft, Search, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InventoryTransactionForm } from '@/components/dashboard/inventory-management/inventory-transaction-form';
import type { InventoryItem, InventoryWarehouse } from '@/lib/types';
import { format, isBefore, addDays, parseISO } from 'date-fns';

import { useUserContext } from '@/context/user-context';

const ITEMS_PER_PAGE = 10;

function StockOverviewContent() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedWarehouseId = searchParams.get('warehouse');
  const { user, hasRole } = useUserContext();
  const isAdmin = hasRole('admin');
  
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [inventoryCategories, setInventoryCategories] = useState<any[]>([]);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [itemsRes, warehousesRes, categoriesRes] = await Promise.all([
        fetch('/api/admin/inventory/items?includeStock=true'),
        fetch('/api/admin/inventory/warehouses'),
        fetch('/api/admin/inventory/categories')
      ]);

      const dataItems = await itemsRes.json();
      const dataWarehouses = await warehousesRes.json();
      const dataInvCats = await categoriesRes.json();

      if (dataItems.error) throw new Error(dataItems.error);
      setItems(dataItems.items || []);

      if (dataWarehouses.error) throw new Error(dataWarehouses.error);
      const whList = dataWarehouses.warehouses || [];
      setWarehouses(whList);

      // Visibility Logic: Filter warehouses for departmental users
      const accessibleWarehouses = isAdmin 
        ? whList 
        : whList.filter((wh: any) => wh.department?.name === user?.department);

      // Security/Defaulting Check
      if (accessibleWarehouses.length > 0) {
        // If no warehouse selected, or selected warehouse is not accessible
        const isCurrentWhAccessible = selectedWarehouseId && accessibleWarehouses.some((w: any) => w.id === selectedWarehouseId);
        
        if (!selectedWarehouseId || !isCurrentWhAccessible) {
          const defaultWh = accessibleWarehouses.find((w: any) => w.is_main) || accessibleWarehouses[0];
          router.push(`?warehouse=${defaultWh.id}`);
        }
      }

      setInventoryCategories(dataInvCats.categories || []);

    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to fetch stock overview." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedWarehouseId]);

  const handleOpenTransactionDialog = (item: InventoryItem) => {
    setEditingItem(item);
    setIsTransactionDialogOpen(true);
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const itemName = item.name || '';
      const itemCode = item.code || '';
      
      const matchesSearch = 
        itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        itemCode.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = selectedCategory === 'all' || item.category_id === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [items, searchQuery, selectedCategory]);

  const accessibleWarehouses = useMemo(() => {
    if (!warehouses.length) return [];
    return isAdmin 
      ? warehouses 
      : warehouses.filter(wh => wh.department?.name === user?.department);
  }, [warehouses, isAdmin, user?.department]);

  const activeWarehouseData = useMemo(() => {
    if (!selectedWarehouseId || accessibleWarehouses.length === 0) return null;
    
    const warehouse = accessibleWarehouses.find(w => w.id === selectedWarehouseId);
    if (!warehouse) return null;

    const warehouseItems = filteredItems.map(item => {
      const ws = item.warehouse_stock?.find((ws: any) => ws.id === selectedWarehouseId);
      if (!ws) return null;
      return {
        ...item,
        local_stock: ws.total_stock,
        batches: ws.batches || []
      };
    }).filter(Boolean);

    return {
      warehouse,
      items: warehouseItems
    };
  }, [filteredItems, accessibleWarehouses, selectedWarehouseId]);

  const groupedBatchStock = useMemo(() => {
    if (!activeWarehouseData) return [];
    
    const itemMap: Record<string, { 
      item: InventoryItem; 
      locations: any[]; 
      totalQty: number;
    }> = {};

    activeWarehouseData.items.forEach((item: any) => {
      if (!itemMap[item.id]) {
        itemMap[item.id] = { 
          item: item, 
          locations: [], 
          totalQty: 0 
        };
      }

      if (item.batches && item.batches.length > 0) {
        item.batches.forEach((batch: any) => {
          itemMap[item.id].locations.push({
            id: `${item.id}-${activeWarehouseData.warehouse.id}-${batch.id}`,
            warehouseName: activeWarehouseData.warehouse.name,
            departmentName: activeWarehouseData.warehouse.department?.name || 'General',
            batchNumber: batch.batch_number,
            expiryDate: batch.expiry_date,
            quantity: batch.quantity,
            fullItem: item
          });
          itemMap[item.id].totalQty += batch.quantity;
        });
      }
    });
    return Object.values(itemMap);
  }, [activeWarehouseData]);

  const paginatedCardItems = useMemo(() => {
    if (!activeWarehouseData) return [];
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return activeWarehouseData.items.slice(start, start + ITEMS_PER_PAGE);
  }, [activeWarehouseData, currentPage]);

  const paginatedTableItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return groupedBatchStock.slice(start, start + ITEMS_PER_PAGE);
  }, [groupedBatchStock, currentPage]);

  const paginatedMatrixItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  const totalPages = useMemo(() => {
    // We use the filteredItems for the matrix view, and activeWarehouseData.items for other views
    // If we are in matrix view, we need the total count of filtered items
    // To keep it simple, let's use the larger set or context-aware count
    const count = filteredItems.length;
    return Math.ceil(count / ITEMS_PER_PAGE);
  }, [filteredItems]);

  const getExpiryStatus = (expiryDate: string | null) => {
    if (!expiryDate) return { label: 'No Expiry', color: 'text-slate-400' };
    const date = parseISO(expiryDate);
    const now = new Date();
    const formattedDate = format(date, 'MMM dd, yyyy');
    
    if (isBefore(date, now)) return { label: `Expired (${formattedDate})`, color: 'text-red-600 font-bold' };
    if (isBefore(date, addDays(now, 7))) return { label: formattedDate, color: 'text-orange-600 font-bold' };
    if (isBefore(date, addDays(now, 30))) return { label: formattedDate, color: 'text-amber-500' };
    
    return { label: formattedDate, color: 'text-emerald-600' };
  };

  const handleWarehouseChange = (id: string) => {
    router.push(`?warehouse=${id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-slate-900">Inventory Stock Overview</h1>
          <p className="text-muted-foreground">Manage stock and batch tracking for specific warehouses.</p>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-4">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-5 rounded-xl border shadow-sm">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Select Storage Unit</label>
            <Select value={selectedWarehouseId || ''} onValueChange={handleWarehouseChange}>
              <SelectTrigger className="bg-slate-50 border-slate-200 font-bold">
                <Warehouse className="mr-2 h-4 w-4 text-primary" />
                <SelectValue placeholder="Choose a Warehouse" />
              </SelectTrigger>
              <SelectContent>
                {accessibleWarehouses.map(wh => (
                  <SelectItem key={wh.id} value={wh.id} className="font-medium">
                    {wh.name} {wh.is_main ? '(Main)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Search Items</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Name or code..."
                className="pl-9 bg-slate-50 border-slate-200 font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Category</label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="bg-slate-50 border-slate-200 font-medium">
                <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {inventoryCategories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {!selectedWarehouseId ? (
        <div className="h-96 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-3xl bg-slate-50/30 gap-4">
          <div className="p-6 bg-white rounded-full shadow-sm">
            <Warehouse className="h-12 w-12 text-slate-300" />
          </div>
          <div className="text-center">
            <p className="text-xl font-black text-slate-900">Select a Warehouse</p>
            <p className="max-w-xs text-sm">Please choose a storage location from the dropdown above to view its stock levels.</p>
          </div>
        </div>
      ) : isLoading ? (
        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="font-medium">Loading items...</p>
        </div>
      ) : (
        <Tabs defaultValue="cards" className="w-full">
          <div className="flex justify-between items-center mb-6">
            <TabsList className="bg-slate-100 p-1">
              <TabsTrigger value="cards" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Card List</TabsTrigger>
              <TabsTrigger value="table" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Grouped Table</TabsTrigger>
              <TabsTrigger value="matrix" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Cross-Store View</TabsTrigger>
            </TabsList>
            <div className="hidden sm:block text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 px-4 py-2 rounded-full border border-primary/10">
              {activeWarehouseData?.items.length || 0} Products in {activeWarehouseData?.warehouse.name}
            </div>
          </div>

          <TabsContent value="cards" className="space-y-6">
            <div className="flex flex-col gap-3">
              {paginatedCardItems.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground italic bg-slate-100/30 rounded-2xl border border-dashed border-slate-200">
                  No items found in this warehouse.
                </div>
              ) : (
                paginatedCardItems.map((item: any) => (
                  <div key={item.id} className="group p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 hover:border-primary/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 overflow-hidden relative">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/10 group-hover:bg-primary transition-colors" />
                    
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100 shrink-0 group-hover:bg-primary/5 transition-colors">
                        <span className="text-xs font-black text-slate-400 group-hover:text-primary">{item.name.substring(0, 2).toUpperCase()}</span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-black text-slate-900 leading-tight group-hover:text-primary transition-colors truncate text-sm">
                          {item.name}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-black tracking-widest text-primary/60 uppercase">{item.code}</span>
                          <Badge variant="outline" className="text-[9px] h-4 font-medium border-slate-200 bg-slate-50/50">
                            {item.category?.name || 'Item'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 shrink-0 w-full sm:auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-50">
                      <div className="flex flex-col items-center sm:items-end gap-1">
                        {item.batches && item.batches.length > 0 && (
                          <span className={cn("text-[10px] font-bold px-1", 
                            getExpiryStatus(item.batches.reduce((min: string | null, b: any) => 
                              !min || (b.expiry_date && isBefore(parseISO(b.expiry_date), parseISO(min))) ? b.expiry_date : min, null)).color
                          )}>
                            Exp: {getExpiryStatus(item.batches.reduce((min: string | null, b: any) => 
                              !min || (b.expiry_date && isBefore(parseISO(b.expiry_date), parseISO(min))) ? b.expiry_date : min, null)).label}
                          </span>
                        )}
                        <Badge 
                            variant={item.local_stock <= (item.reorder_level || 5) ? "destructive" : "secondary"} 
                            className={cn(
                                "text-[9px] h-4 px-2 rounded-full font-bold",
                                item.local_stock > (item.reorder_level || 5) ? "bg-emerald-50 text-emerald-700 border-emerald-100" : ""
                            )}
                        >
                            {item.local_stock <= (item.reorder_level || 5) ? 'Low Stock' : 'Optimal'}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right min-w-[60px]">
                          <div className="text-xl font-black text-slate-900 leading-none">
                            {item.local_stock}
                          </div>
                          <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
                            {item.unit?.name || 'units'}
                          </div>
                        </div>
                        
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-9 w-9 p-0 rounded-lg hover:bg-primary/10 hover:text-primary transition-all shrink-0"
                          onClick={() => handleOpenTransactionDialog(item)}
                          disabled={!activeWarehouseData?.warehouse.is_main}
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {totalPages > 1 && (
              <div className="mt-8">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="cursor-pointer"
                      />
                    </PaginationItem>
                    
                    {[...Array(totalPages)].map((_, i) => (
                      <PaginationItem key={i} className="hidden sm:block">
                        <PaginationLink 
                          isActive={currentPage === i + 1}
                          onClick={() => setCurrentPage(i + 1)}
                          className="cursor-pointer"
                        >
                          {i + 1}
                        </PaginationLink>
                      </PaginationItem>
                    ))}

                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="cursor-pointer"
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </TabsContent>

          <TabsContent value="table">
            <div className="bg-white border rounded-xl shadow-sm overflow-hidden mb-6">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold w-[300px]">Item Details</TableHead>
                    <TableHead className="font-bold">Batch No</TableHead>
                    <TableHead className="font-bold">Expiry Date</TableHead>
                    <TableHead className="font-bold text-right">Qty in Store</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTableItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                        No stock data available.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedTableItems.map((group) => (
                      <React.Fragment key={group.item.id}>
                        <TableRow className="bg-slate-50/80 border-t-2 border-slate-100">
                          <TableCell colSpan={2} className="py-3">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center">
                                <span className="text-[10px] font-bold text-primary">{group.item.name.substring(0, 2).toUpperCase()}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="font-black text-slate-900 text-sm uppercase tracking-tight">{group.item.name}</span>
                                <span className="text-[10px] text-muted-foreground font-bold">{group.item.code} • {group.item.category?.name}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell colSpan={2} className="text-right py-3">
                            <div className="flex flex-col items-end">
                              <span className="text-sm font-black text-primary">{group.totalQty}</span>
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Total {group.item.unit?.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-3">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 text-[10px] font-bold"
                              onClick={() => handleOpenTransactionDialog(group.item)}
                              disabled={!activeWarehouseData?.warehouse.is_main}
                            >
                              Move All
                            </Button>
                          </TableCell>
                        </TableRow>
                        {group.locations.map((loc: any) => (
                          <TableRow key={loc.id} className="hover:bg-slate-50/30 transition-colors border-l-4 border-l-primary/10">
                            <TableCell className="pl-10">
                              <div className="flex items-center gap-2">
                                <Warehouse className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs font-bold text-slate-700">{loc.warehouseName}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-[9px] bg-slate-50 text-slate-600 px-1.5 h-4">
                                {loc.batchNumber}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className={cn("text-[11px] font-bold", getExpiryStatus(loc.expiryDate).color)}>
                                {getExpiryStatus(loc.expiryDate).label}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-baseline justify-end gap-1">
                                <span className="text-xs font-black text-slate-800">{loc.quantity}</span>
                                <span className="text-[9px] text-muted-foreground font-bold">{group.item.unit?.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 rounded-md"
                                onClick={() => handleOpenTransactionDialog(loc.fullItem)}
                                disabled={!activeWarehouseData?.warehouse.is_main}
                              >
                                <ArrowRightLeft className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="cursor-pointer"
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="cursor-pointer"
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </TabsContent>

          <TabsContent value="matrix">
            <div className="bg-white border rounded-xl shadow-sm overflow-hidden mb-6">
              <div className="w-full overflow-x-auto custom-scrollbar">
                <Table className="border-separate border-spacing-0 w-full table-fixed">
                  <TableHeader className="bg-slate-50 sticky top-0 z-30">
                    <TableRow>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-500 w-[240px] sticky left-0 bg-slate-50 z-40 border-b border-r border-slate-100 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                        Item Details / Warehouses
                      </TableHead>
                      {accessibleWarehouses.map(wh => (
                        <TableHead key={wh.id} className="font-black text-[10px] uppercase tracking-widest text-center whitespace-nowrap min-w-[140px] border-b border-l border-slate-100 px-4">
                          <Warehouse className="h-3 w-3 inline-block mr-1 opacity-50" />
                          {wh.name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedMatrixItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={accessibleWarehouses.length + 1} className="h-32 text-center text-muted-foreground italic">
                          No stock data available.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedMatrixItems.map((item: any) => (
                        <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                          <TableCell className="sticky left-0 bg-white z-10 border-b border-r border-slate-100 shadow-[2px_0_5px_rgba(0,0,0,0.05)] py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 bg-slate-50 rounded-lg flex items-center justify-center shrink-0 border border-slate-100 group-hover:bg-primary/5">
                                <span className="text-[10px] font-bold text-slate-400">{item.name.substring(0, 2).toUpperCase()}</span>
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-black text-slate-800 text-sm truncate uppercase tracking-tight">{item.name}</span>
                                <span className="text-[10px] text-muted-foreground font-bold">{item.code}</span>
                              </div>
                            </div>
                          </TableCell>
                          {accessibleWarehouses.map(wh => {
                            const stockObj = item.warehouse_stock?.find((ws: any) => ws.id === wh.id);
                            const qty = stockObj ? stockObj.total_stock : 0;
                            return (
                              <TableCell key={wh.id} className="text-center border-b border-l border-slate-50 min-w-[140px] px-4 group">
                                <div className="flex flex-col items-center">
                                  <span className={cn(
                                    "text-base font-black leading-none transition-all",
                                    qty > 0 ? "text-slate-900" : "text-slate-200"
                                  )}>
                                    {qty}
                                  </span>
                                  {qty > 0 && (
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase mt-1">
                                      {item.unit?.name || 'units'}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="mt-8">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="cursor-pointer"
                      />
                    </PaginationItem>
                    
                    {[...Array(totalPages)].map((_, i) => (
                      <PaginationItem key={i} className="hidden sm:block">
                        <PaginationLink 
                          isActive={currentPage === i + 1}
                          onClick={() => setCurrentPage(i + 1)}
                          className="cursor-pointer"
                        >
                          {i + 1}
                        </PaginationLink>
                      </PaginationItem>
                    ))}

                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="cursor-pointer"
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Quick Stock Transfer</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <InventoryTransactionForm
              item={editingItem as any}
              departments={warehouses as any}
              onSuccess={() => {
                setIsTransactionDialogOpen(false);
                fetchData();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function InventoryStockOverviewPage() {
  return (
    <Suspense fallback={
      <div className="h-64 flex flex-col items-center justify-center text-muted-foreground gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="font-medium">Loading stock overview...</p>
      </div>
    }>
      <StockOverviewContent />
    </Suspense>
  );
}

// Utility function for conditional classes
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
