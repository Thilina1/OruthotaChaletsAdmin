'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { PlusCircle, Truck, ChevronRight, Trash2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { StockIntakeForm } from '@/components/dashboard/inventory-management/stock-intake-form';
import { TransactionHistoryTable } from '@/components/dashboard/inventory-management/transaction-history-table';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, PackageCheck, Send, Clock, Loader2, ClipboardList, Eye } from 'lucide-react';
import { format } from 'date-fns';

export default function GRNPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [inventoryCategories, setInventoryCategories] = useState<any[]>([]);
  const [inventoryUnits, setInventoryUnits] = useState<any[]>([]);
  const [inventorySuppliers, setInventorySuppliers] = useState<any[]>([]);
  const [isGRNDialogOpen, setIsGRNDialogOpen] = useState(false);
  const [refreshHistory, setRefreshHistory] = useState(0);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [receivedPOs, setReceivedPOs] = useState<any[]>([]);
  const [isPOLoading, setIsPOLoading] = useState(false);
  const [viewingPO, setViewingPO] = useState<any | null>(null);

  const fetchData = async () => {
    try {
      const [itemsRes, warehousesRes, invCategoriesRes, unitsRes, suppliersRes] = await Promise.all([
        fetch('/api/admin/inventory/items'),
        fetch('/api/admin/inventory/warehouses'),
        fetch('/api/admin/inventory/categories'),
        fetch('/api/admin/inventory/units'),
        fetch('/api/admin/inventory/suppliers')
      ]);

      const dataItems = await itemsRes.json();
      const dataWarehouses = await warehousesRes.json();
      const dataInvCats = await invCategoriesRes.json();
      const dataUnits = await unitsRes.json();
      const dataSuppliers = await suppliersRes.json();

      setItems(dataItems.items || []);
      setWarehouses(dataWarehouses.warehouses || []);
      setInventoryCategories(dataInvCats.categories || []);
      setInventoryUnits(dataUnits.units || []);
      setInventorySuppliers(dataSuppliers.suppliers || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to fetch necessary data." });
    }
  };

  const fetchPurchaseOrders = async () => {
    setIsPOLoading(true);
    try {
      const res = await fetch('/api/admin/purchase-orders');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      const allPOs = data.purchase_orders ?? [];
      
      // Filter for approved or sent POs (Pending)
      const pending = allPOs.filter((po: any) => 
        po.status === 'approved' || po.status === 'sent'
      );
      setPurchaseOrders(pending);

      // Filter for received POs (Completed)
      const received = allPOs.filter((po: any) => po.status === 'received');
      setReceivedPOs(received);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsPOLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchPurchaseOrders();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
            <ChevronRight className="h-4 w-4" />
            <Link href="/dashboard/inventory-management" className="hover:text-foreground transition-colors">Inventory</Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">GRN</span>
          </div>
          <h1 className="text-3xl font-headline font-bold flex items-center gap-2 text-primary">
            <Truck className="h-8 w-8" />
            Goods Received Note (GRN)
          </h1>
          <p className="text-muted-foreground">Record and manage all incoming stock (Stock In).</p>
        </div>
        <Link href="/dashboard/inventory-management/grn/new">
          <Button size="lg" className="bg-primary hover:bg-primary/90 font-bold shadow-lg gap-2">
            <PlusCircle className="h-5 w-5" /> New Stock Intake (GRN)
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="history" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="history" className="gap-2">
            <Clock className="h-4 w-4" />
            Stock History
          </TabsTrigger>
          <TabsTrigger value="received" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Received POs
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            Pending Deliveries
            {purchaseOrders.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 min-w-[20px] bg-primary text-primary-foreground">
                {purchaseOrders.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
            <TransactionHistoryTable 
                type="receive,initial_stock" 
                title="Recent Stock Intake (All Additions)" 
                refreshKey={refreshHistory}
            />
          </div>
        </TabsContent>

        <TabsContent value="received">
          <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
            <div className="p-6 border-b bg-slate-50/50 flex justify-between items-center">
               <div className="space-y-1">
                 <h3 className="text-lg font-bold flex items-center gap-2 text-emerald-700">
                   <PackageCheck className="h-5 w-5" />
                   Completed Deliveries (Received POs)
                 </h3>
                 <p className="text-sm text-muted-foreground">Successfully processed and added to inventory.</p>
               </div>
               <Badge variant="outline" className="bg-white font-black text-[10px] tracking-widest text-slate-400">
                  {receivedPOs.length} TOTAL
               </Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider font-bold text-muted-foreground border-b">
                  <tr>
                    <th className="px-6 py-4">PO Number</th>
                    <th className="px-6 py-4">Received At</th>
                    <th className="px-6 py-4">Supplier</th>
                    <th className="px-6 py-4">Items</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isPOLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                      </td>
                    </tr>
                  ) : receivedPOs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground italic">
                        No received purchase orders yet.
                      </td>
                    </tr>
                  ) : (
                    receivedPOs.map((po) => (
                      <tr key={po.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-slate-700">{po.po_number}</td>
                        <td className="px-6 py-4">
                           <div className="font-medium text-slate-600">{format(new Date(po.updated_at), 'PPP')}</div>
                           <div className="text-[10px] text-muted-foreground">{format(new Date(po.updated_at), 'p')}</div>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-600">{po.supplier_name || '—'}</td>
                        <td className="px-6 py-4">
                           <Badge variant="outline" className="bg-white text-slate-500 border-slate-200">
                             {po.purchase_order_items.length} items
                           </Badge>
                        </td>
                        <td className="px-6 py-4">
                           <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 capitalize">
                             {po.status}
                           </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                           <Button 
                             size="sm" 
                             variant="ghost" 
                             className="gap-2 text-primary hover:bg-primary/5 font-bold"
                             onClick={() => setViewingPO(po)}
                           >
                             <Eye className="h-4 w-4" />
                             View Receipt
                           </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pending">
          <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
            <div className="p-6 border-b bg-slate-50/50">
               <h3 className="text-lg font-bold flex items-center gap-2">
                 <Clock className="h-5 w-5 text-amber-500" />
                 Awaiting Deliveries (Approved POs)
               </h3>
               <p className="text-sm text-muted-foreground mt-1">Purchase orders that are approved or sent and ready to be received into inventory.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider font-bold text-muted-foreground border-b">
                  <tr>
                    <th className="px-6 py-4">PO Number</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Supplier</th>
                    <th className="px-6 py-4">Items</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isPOLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                      </td>
                    </tr>
                  ) : purchaseOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                        <PackageCheck className="h-10 w-10 mx-auto mb-3 opacity-20" />
                        <p>No pending purchase orders to receive.</p>
                      </td>
                    </tr>
                  ) : (
                    purchaseOrders.map((po) => (
                      <tr key={po.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-mono font-semibold text-primary">{po.po_number}</td>
                        <td className="px-6 py-4">
                           <div className="font-medium">{format(new Date(po.created_at), 'PPP')}</div>
                           <div className="text-[10px] text-muted-foreground">{format(new Date(po.created_at), 'p')}</div>
                        </td>
                        <td className="px-6 py-4 font-medium">{po.supplier_name || '—'}</td>
                        <td className="px-6 py-4">
                           <Badge variant="outline" className="bg-slate-50">{po.purchase_order_items.length} items</Badge>
                        </td>
                        <td className="px-6 py-4">
                           <Badge variant="outline" className={cn(
                             "capitalize",
                             po.status === 'approved' ? "bg-green-50 text-green-700 border-green-200" : "bg-blue-50 text-blue-700 border-blue-200"
                           )}>
                             {po.status}
                           </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                           <Link href={`/dashboard/inventory-management/grn/receive/${po.id}`}>
                             <Button 
                               size="sm" 
                               variant="outline" 
                               className="gap-2 border-primary text-primary hover:bg-primary hover:text-white"
                             >
                               <PackageCheck className="h-4 w-4" />
                               Process Receipt
                             </Button>
                           </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* View Receipt Dialog */}
      <Dialog open={!!viewingPO} onOpenChange={(open) => !open && setViewingPO(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border-none shadow-2xl p-0">
            <div className="p-8 border-b bg-slate-50/50 flex justify-between items-start">
                <div className="space-y-1">
                    <DialogTitle className="text-2xl font-black flex items-center gap-2">
                        <ClipboardList className="h-6 w-6 text-emerald-600" />
                        Goods Received Note
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">Receipt details for <span className="font-bold text-slate-900">{viewingPO?.po_number}</span></p>
                </div>
                <Badge className="bg-emerald-600 text-white font-black px-3 py-1 rounded-full border-none">RECEIVED</Badge>
            </div>
            
            {viewingPO && (
                <div className="p-8 space-y-8">
                    {/* Summary Boxes */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Supplier</p>
                            <p className="font-bold text-slate-800">{viewingPO.supplier_name || 'Generic Supplier'}</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Date Received</p>
                            <p className="font-bold text-slate-800">{format(new Date(viewingPO.updated_at), 'PPP')}</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Items</p>
                            <p className="font-bold text-slate-800">{viewingPO.purchase_order_items.length} Distinct Products</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Received Item Breakdown</h3>
                        <div className="rounded-2xl border overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50/80 text-[10px] uppercase font-bold text-slate-400 border-b">
                                    <tr>
                                        <th className="px-6 py-4">Product Details</th>
                                        <th className="px-6 py-4 text-center">Qty Received</th>
                                        <th className="px-6 py-4 text-center">Batch #</th>
                                        <th className="px-6 py-4 text-center">Expiry</th>
                                        <th className="px-6 py-4 text-right">Unit Price</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {viewingPO.purchase_order_items.map((item: any) => (
                                        <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-800">{item.item_name}</div>
                                                <div className="flex gap-2 mt-1">
                                                    {item.brand && <Badge variant="outline" className="text-[9px] h-4 px-1 border-slate-200">{item.brand}</Badge>}
                                                    {item.item_size && <Badge variant="outline" className="text-[9px] h-4 px-1 border-slate-200">{item.item_size}</Badge>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center font-black text-emerald-600">
                                                {item.received_quantity || item.quantity}
                                                <span className="text-[10px] text-slate-400 ml-1 font-bold">{item.unit}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center font-mono text-xs text-slate-500">
                                                {item.batch_number || '—'}
                                            </td>
                                            <td className="px-6 py-4 text-center text-xs text-slate-500">
                                                {item.expiry_date ? format(new Date(item.expiry_date), 'PP') : '—'}
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-800">
                                                {item.unit_price ? `LKR ${item.unit_price.toLocaleString()}` : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {viewingPO.notes && (
                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">Receipt Notes</p>
                            <p className="text-sm text-amber-900 italic">"{viewingPO.notes}"</p>
                        </div>
                    )}
                </div>
            )}
            <div className="p-8 border-t bg-slate-50/50 flex justify-end gap-3">
                <Button variant="outline" className="rounded-xl px-8 font-bold" onClick={() => setViewingPO(null)}>Close</Button>
                <Button className="bg-slate-900 text-white rounded-xl px-8 font-black gap-2 shadow-xl">
                    <Truck className="h-4 w-4" />
                    Print GRN
                </Button>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
