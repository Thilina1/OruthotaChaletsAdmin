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
import { ArrowUpCircle, ArrowDownCircle, AlertCircle, History } from 'lucide-react';
import type { InventoryTransaction } from '@/lib/types';

interface TransactionHistoryTableProps {
  type?: 'receive' | 'issue' | 'damage' | 'audit_adjustment' | 'initial_stock' | string;
  itemId?: string;
  title?: string;
  refreshKey?: number;
}

export function TransactionHistoryTable({ type, itemId, title, refreshKey }: TransactionHistoryTableProps) {
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      
      <div className="rounded-md border bg-white overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[180px]">Date & Time</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-center">Old Stock</TableHead>
              <TableHead className="text-center">Change</TableHead>
              <TableHead className="text-center font-bold">New Stock</TableHead>
              <TableHead>Reference/Metadata</TableHead>
              <TableHead>User</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">Loading history...</TableCell>
              </TableRow>
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No transaction history found.</TableCell>
              </TableRow>
            ) : (
              transactions.map((tx) => (
                <TableRow key={tx.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {tx.created_at ? format(new Date(tx.created_at), "yyyy-MM-dd HH:mm") : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{(tx.item as any)?.name}</div>
                    <div className="text-[10px] text-muted-foreground">{(tx.item as any)?.category}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTypeIcon(tx.transaction_type)}
                      {getTypeBadge(tx.transaction_type)}
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-mono text-muted-foreground">
                    {tx.previous_stock ?? '-'}
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
                    <div className="flex flex-col gap-1 max-w-[250px]">
                      {tx.supplier && <span className="text-[10px] bg-slate-100 px-1 py-0.5 rounded border">Supplier: {tx.supplier}</span>}
                      {tx.batch_number && <span className="text-[10px] bg-slate-100 px-1 py-0.5 rounded border">Batch: {tx.batch_number}</span>}
                      {tx.expiry_date && <span className="text-[10px] bg-amber-50 px-1 py-0.5 rounded border border-amber-200">Exp: {tx.expiry_date}</span>}
                      {tx.remarks && <span className="text-xs italic text-muted-foreground truncate" title={tx.remarks}>{tx.remarks}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {(tx.user as any)?.name || 'System'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
