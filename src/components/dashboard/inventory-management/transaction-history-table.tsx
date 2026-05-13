'use client';

import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ArrowUpCircle, ArrowDownCircle, AlertCircle, History, Eye, Calendar, Package, User, Hash, Info, Truck } from 'lucide-react';
import type { InventoryTransaction } from '@/lib/types';
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface TransactionHistoryTableProps {
  type?: 'receive' | 'issue' | 'damage' | 'audit_adjustment' | 'initial_stock' | string;
  itemId?: string;
  title?: string;
  refreshKey?: number;
}

export function TransactionHistoryTable({ type, itemId, title, refreshKey }: TransactionHistoryTableProps) {
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<InventoryTransaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      let url = `/api/admin/inventory-transactions?limit=100`;
      if (type) url += `&type=${type}`;
      if (itemId) url += `&itemId=${itemId}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [type, itemId, refreshKey]);

  const {
    currentPage,
    totalPages,
    totalItems,
    paginatedItems,
    itemsPerPage,
    setCurrentPage,
  } = usePagination(transactions, 20);

  const handleViewDetails = (tx: InventoryTransaction) => {
    setSelectedTransaction(tx);
    setIsModalOpen(true);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'receive':
      case 'initial_stock':
        return <ArrowUpCircle className="h-4 w-4 text-green-500" />;
      case 'issue':
        return <ArrowDownCircle className="h-4 w-4 text-blue-500" />;
      case 'damage':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <History className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'receive': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none">Stock In</Badge>;
      case 'issue': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-none">Issued</Badge>;
      case 'damage': return <Badge variant="destructive">Damaged</Badge>;
      case 'audit_adjustment': return <Badge variant="outline">Adjustment</Badge>;
      case 'initial_stock': return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 border-none">Initial</Badge>;
      default: return <Badge variant="secondary">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {title && <h2 className="text-xl font-semibold mb-4">{title}</h2>}
      
      <div className="rounded-md border bg-white overflow-x-auto">
        <Table className="min-w-[1100px]">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[180px]">Date & Time</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-center">UOM</TableHead>
              <TableHead className="text-center">Batch</TableHead>
              <TableHead className="text-center">Expiry</TableHead>
              <TableHead className="text-center">Change</TableHead>
              <TableHead className="text-center font-bold">New Stock</TableHead>
              <TableHead>Remarks</TableHead>
              <TableHead>User</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={11} className="h-24 text-center">Loading history...</TableCell>
              </TableRow>
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">No transaction history found.</TableCell>
              </TableRow>
            ) : (
                paginatedItems.map((tx) => (
                <TableRow key={tx.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {tx.created_at ? format(new Date(tx.created_at), "yyyy-MM-dd HH:mm") : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">
                      {(tx.item as any)?.name || (tx.remarks?.includes('PO Received') ? tx.remarks : (tx.remarks || 'Legacy / Unlinked Item'))}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {(tx.item as any)?.category?.name || (tx.item as any)?.category || (tx.remarks?.includes('Initial') ? 'Opening Stock' : 'Manual Entry')}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1 opacity-80">
                      {(tx.brand || (tx.item as any)?.product?.brand || (tx.item as any)?.brand) && (
                        <Badge variant="outline" className="text-[9px] px-1 h-4 bg-slate-50 border-slate-200 font-medium">
                          {tx.brand || (tx.item as any)?.product?.brand || (tx.item as any)?.brand}
                        </Badge>
                      )}
                      {(tx.item_size || (tx.item as any)?.item_size) && (
                        <Badge variant="outline" className="text-[9px] px-1 h-4 bg-blue-50/30 border-blue-100 font-medium">
                          {tx.item_size || (tx.item as any)?.item_size}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTypeIcon(tx.transaction_type)}
                      {getTypeBadge(tx.transaction_type)}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 uppercase">
                        {(tx.item as any)?.unit?.name || '-'}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                        {tx.transaction_type === 'initial_stock' || tx.batch?.batch_number === 'INITIAL' || tx.batch_number === 'INITIAL' 
                          ? '-' 
                          : (tx.batch?.batch_number || tx.batch_number || '-')}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="text-[11px] whitespace-nowrap">
                        {tx.batch?.expiry_date ? format(new Date(tx.batch.expiry_date), "yyyy-MM-dd") : (tx.expiry_date ? format(new Date(tx.expiry_date), "yyyy-MM-dd") : '-')}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`font-bold ${['receive', 'initial_stock'].includes(tx.transaction_type) ? 'text-green-600' : 'text-red-600'}`}>
                      {['receive', 'initial_stock'].includes(tx.transaction_type) ? '+' : '-'}{tx.quantity}
                    </span>
                  </TableCell>
                  <TableCell className="text-center font-bold font-mono bg-muted/20">
                    {tx.new_stock ?? '-'}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[200px]">
                      {tx.remarks && <span className="text-xs italic text-muted-foreground truncate block" title={tx.remarks}>{tx.remarks}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {(tx.user as any)?.name || 'System'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                      onClick={() => handleViewDetails(tx)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      {!isLoading && transactions.length > 0 && (
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      )}

      {/* Details Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <History className="h-5 w-5 text-primary" />
              Transaction Details
            </DialogTitle>
            <DialogDescription>
              Detailed information for the selected GRN / Stock intake transaction.
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/5 rounded-lg text-primary">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Item Information</div>
                      <div className="font-bold text-lg leading-tight">{(selectedTransaction.item as any)?.name}</div>
                      <div className="text-sm text-muted-foreground">{(selectedTransaction.item as any)?.category?.name || (selectedTransaction.item as any)?.category}</div>
                      <div className="flex gap-2 mt-2">
                        {selectedTransaction.brand && <Badge variant="outline" className="text-[10px]">{selectedTransaction.brand}</Badge>}
                        {selectedTransaction.item_size && <Badge variant="outline" className="text-[10px]">{selectedTransaction.item_size}</Badge>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/5 rounded-lg text-primary">
                      <Truck className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Supplier / Batch</div>
                      <div className="font-semibold">{selectedTransaction.supplier || selectedTransaction.batch?.supplier || 'N/A'}</div>
                      <div className="text-xs text-muted-foreground">Batch: <span className="font-mono">{(selectedTransaction.batch?.batch_number === 'INITIAL' || selectedTransaction.batch_number === 'INITIAL') ? '-' : (selectedTransaction.batch?.batch_number || selectedTransaction.batch_number || 'N/A')}</span></div>
                      {selectedTransaction.unit_price && <div className="text-xs font-bold text-blue-700 mt-1">LKR {selectedTransaction.unit_price} / unit</div>}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/5 rounded-lg text-primary">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Timing & Status</div>
                      <div className="font-semibold">{selectedTransaction.created_at ? format(new Date(selectedTransaction.created_at), "PPP p") : 'N/A'}</div>
                      <div className="mt-1">{getTypeBadge(selectedTransaction.transaction_type)}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/5 rounded-lg text-primary">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Processed By</div>
                      <div className="font-semibold">{(selectedTransaction.user as any)?.name || 'System'}</div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Previous Stock</div>
                    <div className="text-lg font-mono text-muted-foreground">{selectedTransaction.previous_stock ?? '0'}</div>
                  </div>
                  <div className="flex flex-col items-center justify-center">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Quantity Change</div>
                    <div className={`text-xl font-bold flex items-center gap-1 ${['receive', 'initial_stock'].includes(selectedTransaction.transaction_type) ? 'text-green-600' : 'text-red-600'}`}>
                      {['receive', 'initial_stock'].includes(selectedTransaction.transaction_type) ? '+' : '-'}{selectedTransaction.quantity}
                      <span className="text-[10px] font-normal uppercase text-muted-foreground">{(selectedTransaction.item as any)?.unit?.name}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">New Total Stock</div>
                    <div className="text-xl font-bold font-mono text-primary">{selectedTransaction.new_stock ?? '-'}</div>
                  </div>
                </div>
              </div>

              {selectedTransaction.remarks && (
                <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-100">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-amber-700 uppercase mb-1">
                    <Info className="h-3 w-3" />
                    Remarks / Notes
                  </div>
                  <p className="text-sm text-amber-800 italic">"{selectedTransaction.remarks}"</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>Close</Button>
                {selectedTransaction.batch?.expiry_date && (
                  <div className="flex items-center gap-2 text-xs font-medium text-destructive px-3 py-1 bg-destructive/5 rounded-full border border-destructive/10">
                    <AlertCircle className="h-3 w-3" />
                    Expires on: {format(new Date(selectedTransaction.batch.expiry_date), "PP")}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
