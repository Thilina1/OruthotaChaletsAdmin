'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Pencil, Trash2, Link2, ExternalLink, X, Plus } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OtherIncome } from '@/lib/types';
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

export default function OtherIncomesPage() {
  const { toast } = useToast();
  const [incomes, setIncomes] = useState<OtherIncome[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<OtherIncome | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form states
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [supportLinks, setSupportLinks] = useState<string[]>([]);

  const sources = ['Events', 'Catering', 'Rentals', 'Merchandise', 'Tips', 'Other'];

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/other-incomes');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setIncomes(data.incomes || []);
    } catch (error) {
      console.error("Error fetching incomes:", error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to fetch other incomes." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const {
    currentPage,
    totalPages,
    totalItems,
    paginatedItems,
    itemsPerPage,
    setCurrentPage,
  } = usePagination(incomes, 20);

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setSource('');
    setDate(new Date().toISOString().split('T')[0]);
    setSupportLinks([]);
    setEditingIncome(null);
  };

  const handleOpenDialog = (income?: OtherIncome) => {
    if (income) {
      setEditingIncome(income);
      setDescription(income.description);
      setAmount(income.amount.toString());
      setSource(income.source);
      setDate(income.date);
      setSupportLinks(income.support_links ?? []);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const addLink = () => setSupportLinks(prev => [...prev, '']);
  const removeLink = (i: number) => setSupportLinks(prev => prev.filter((_, idx) => idx !== i));
  const updateLink = (i: number, val: string) =>
    setSupportLinks(prev => prev.map((l, idx) => idx === i ? val : l));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingIncome ? 'PUT' : 'POST';
      const body = {
        id: editingIncome?.id,
        description,
        amount: parseFloat(amount),
        source,
        date,
        support_links: supportLinks.filter(l => l.trim() !== ''),
      };

      const res = await fetch('/api/admin/other-incomes', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      toast({
        title: editingIncome ? "Income Updated" : "Income Added",
        description: editingIncome ? "The record has been updated successfully." : "New income has been recorded.",
      });

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error saving income:", error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to save income." });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/admin/other-incomes?id=${deleteId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      toast({ title: "Income Deleted", description: "The record has been removed." });
      setIncomes(incomes.filter(i => i.id !== deleteId));
    } catch (error) {
      console.error("Error deleting income:", error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to delete income." });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-headline font-bold">Other Incomes</h1>
          <p className="text-muted-foreground">Track additional revenue streams.</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Income
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Amount (LKR)</TableHead>
              <TableHead>Links</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">Loading...</TableCell>
              </TableRow>
            ) : (!paginatedItems || paginatedItems.length === 0) ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No income records found.</TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((income) => (
                <TableRow key={income.id}>
                  <TableCell>{new Date(income.date).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{income.description}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                      {income.source}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">LKR {income.amount.toFixed(2)}</TableCell>
                  <TableCell>
                    {(income.support_links ?? []).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {(income.support_links ?? []).map((link, i) => (
                          <a
                            key={i}
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                            title={link}
                          >
                            <ExternalLink className="h-3 w-3" />
                            Link {i + 1}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(income)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(income.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {!isLoading && (
          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingIncome ? 'Edit Income' : 'Add New Income'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="e.g. Private Party Deposit"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Select value={source} onValueChange={setSource} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (LKR)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            {/* Supporting Links */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <Link2 className="h-4 w-4" /> Supporting Links
                </Label>
                <Button type="button" variant="outline" size="sm" onClick={addLink}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Link
                </Button>
              </div>
              {supportLinks.length === 0 && (
                <p className="text-xs text-muted-foreground">No links added. Click "Add Link" to attach document URLs.</p>
              )}
              <div className="space-y-2">
                {supportLinks.map((link, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      type="url"
                      placeholder="https://..."
                      value={link}
                      onChange={(e) => updateLink(i, e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLink(i)}
                      className="text-destructive hover:text-destructive shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" className="w-full">
                {editingIncome ? 'Update Income' : 'Save Income'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the record from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
