'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { PlusCircle, Pencil, Trash2, Link2, ExternalLink, X, Plus, Settings, Lock } from 'lucide-react';
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Expense } from '@/lib/types';
import { EXPENSE_CATEGORY_GROUPS } from '@/lib/expense-categories';
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

interface DbCategory {
  id: string;
  name: string;
  group_name: string;
  is_system: boolean;
}

type CategoryGroup = { group: string; categories: DbCategory[] };

function buildGroups(dbCats: DbCategory[]): CategoryGroup[] {
  const map = new Map<string, DbCategory[]>();
  for (const c of dbCats) {
    if (!map.has(c.group_name)) map.set(c.group_name, []);
    map.get(c.group_name)!.push(c);
  }
  // Preserve COA group ordering; append any extra groups at end
  const coaOrder = EXPENSE_CATEGORY_GROUPS.map(g => g.group);
  const ordered: CategoryGroup[] = [];
  for (const g of coaOrder) {
    if (map.has(g)) ordered.push({ group: g, categories: map.get(g)! });
  }
  for (const [g, cats] of map) {
    if (!coaOrder.includes(g)) ordered.push({ group: g, categories: cats });
  }
  return ordered;
}

export default function ExpensesPage() {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Category management
  const [dbCategories, setDbCategories] = useState<DbCategory[]>([]);
  const [isCatDialogOpen, setIsCatDialogOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatGroup, setNewCatGroup] = useState('');
  const [customGroupName, setCustomGroupName] = useState('');
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);
  const [isSavingCat, setIsSavingCat] = useState(false);

  // Form states
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [supportLinks, setSupportLinks] = useState<string[]>([]);

  const categoryGroups = useMemo(() => buildGroups(dbCategories), [dbCategories]);

  // Fallback to hardcoded COA list when DB hasn't been migrated yet
  const hasCategoriesFromDb = dbCategories.length > 0;

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [expRes, catRes] = await Promise.all([
        fetch('/api/admin/expenses'),
        fetch('/api/admin/expense-categories'),
      ]);
      const expData = await expRes.json();
      const catData = await catRes.json();
      if (expData.error) throw new Error(expData.error);
      setExpenses(expData.expenses || []);
      if (!catData.error) setDbCategories(catData.categories || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to fetch expenses." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const { currentPage, totalPages, totalItems, paginatedItems, itemsPerPage, setCurrentPage } =
    usePagination(expenses, 20);

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setCategory('');
    setDate(new Date().toISOString().split('T')[0]);
    setSupportLinks([]);
    setEditingExpense(null);
  };

  const handleOpenDialog = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense);
      setDescription(expense.description);
      setAmount(expense.amount.toString());
      setCategory(expense.category);
      setDate(expense.date);
      setSupportLinks(expense.support_links ?? []);
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
      const method = editingExpense ? 'PUT' : 'POST';
      const body = {
        id: editingExpense?.id,
        description,
        amount: parseFloat(amount),
        category,
        date,
        support_links: supportLinks.filter(l => l.trim() !== ''),
      };
      const res = await fetch('/api/admin/expenses', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast({ title: editingExpense ? "Expense Updated" : "Expense Added" });
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast({ variant: 'destructive', title: "Error", description: "Failed to save expense." });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/admin/expenses?id=${deleteId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast({ title: "Expense Deleted" });
      setExpenses(expenses.filter(e => e.id !== deleteId));
    } catch {
      toast({ variant: 'destructive', title: "Error", description: "Failed to delete expense." });
    } finally {
      setDeleteId(null);
    }
  };

  // --- Category management ---
  const existingGroups = useMemo(() => {
    const set = new Set(dbCategories.map(c => c.group_name));
    EXPENSE_CATEGORY_GROUPS.forEach(g => set.add(g.group));
    return Array.from(set);
  }, [dbCategories]);

  const resolvedGroupName = newCatGroup === '__custom__' ? customGroupName.trim() : newCatGroup;

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim() || !resolvedGroupName) return;
    setIsSavingCat(true);
    try {
      const res = await fetch('/api/admin/expense-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim(), group_name: resolvedGroupName }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDbCategories(prev => [...prev, data.category]);
      setNewCatName('');
      setNewCatGroup('');
      setCustomGroupName('');
      toast({ title: "Category Added", description: `"${data.category.name}" added.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: "Error", description: err.message });
    } finally {
      setIsSavingCat(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCatId) return;
    try {
      const res = await fetch(`/api/admin/expense-categories?id=${deleteCatId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDbCategories(prev => prev.filter(c => c.id !== deleteCatId));
      toast({ title: "Category Deleted" });
    } catch (err: any) {
      toast({ variant: 'destructive', title: "Error", description: err.message });
    } finally {
      setDeleteCatId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-headline font-bold">Expenses</h1>
          <p className="text-muted-foreground">Track and manage your expenses.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsCatDialogOpen(true)}>
            <Settings className="mr-2 h-4 w-4" /> Manage Categories
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Expense
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount (LKR)</TableHead>
              <TableHead>Links</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10">Loading...</TableCell></TableRow>
            ) : (!paginatedItems || paginatedItems.length === 0) ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No expenses recorded.</TableCell></TableRow>
            ) : (
              paginatedItems.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>{new Date(expense.date).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{expense.description}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                      {expense.category}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">LKR {expense.amount.toFixed(2)}</TableCell>
                  <TableCell>
                    {(expense.support_links ?? []).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {(expense.support_links ?? []).map((link, i) => (
                          <a key={i} href={link} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline" title={link}>
                            <ExternalLink className="h-3 w-3" /> Link {i + 1}
                          </a>
                        ))}
                      </div>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(expense)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(expense.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {!isLoading && (
          <DataTablePagination currentPage={currentPage} totalPages={totalPages}
            totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
        )}
      </div>

      {/* Add / Edit Expense Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingExpense ? 'Edit Expense' : 'Add New Expense'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" placeholder="e.g. Monthly Electricity Bill"
                value={description} onChange={(e) => setDescription(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="category">Category</Label>
                <button type="button" className="text-xs text-muted-foreground underline hover:text-foreground"
                  onClick={() => { setIsDialogOpen(false); setIsCatDialogOpen(true); }}>
                  + Add new category
                </button>
              </div>
              <Select value={category} onValueChange={setCategory} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {(hasCategoriesFromDb ? categoryGroups : EXPENSE_CATEGORY_GROUPS.map(g => ({
                    group: g.group,
                    categories: g.categories.map(name => ({ id: name, name, group_name: g.group, is_system: true }))
                  }))).map((group) => (
                    <SelectGroup key={group.group}>
                      <SelectLabel>{group.group}</SelectLabel>
                      {group.categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (LKR)</Label>
              <Input id="amount" type="number" step="0.01" placeholder="0.00"
                value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5"><Link2 className="h-4 w-4" /> Supporting Links</Label>
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
                    <Input type="url" placeholder="https://..." value={link}
                      onChange={(e) => updateLink(i, e.target.value)} className="flex-1" />
                    <Button type="button" variant="ghost" size="icon"
                      onClick={() => removeLink(i)} className="text-destructive hover:text-destructive shrink-0">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" className="w-full">
                {editingExpense ? 'Update Expense' : 'Save Expense'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage Categories Dialog */}
      <Dialog open={isCatDialogOpen} onOpenChange={setIsCatDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Expense Categories</DialogTitle>
          </DialogHeader>

          {/* Add new category form */}
          <form onSubmit={handleAddCategory} className="space-y-3 border rounded-lg p-4 bg-muted/30">
            <p className="text-sm font-medium">Add New Category</p>
            <div className="space-y-1">
              <Label className="text-xs">Category Name</Label>
              <Input placeholder="e.g. Pool Maintenance" value={newCatName}
                onChange={e => setNewCatName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Group</Label>
              <Select value={newCatGroup} onValueChange={setNewCatGroup} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  {existingGroups.map(g => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                  <SelectItem value="__custom__">+ Create new group…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newCatGroup === '__custom__' && (
              <div className="space-y-1">
                <Label className="text-xs">New Group Name</Label>
                <Input placeholder="e.g. Property" value={customGroupName}
                  onChange={e => setCustomGroupName(e.target.value)} required />
              </div>
            )}
            <Button type="submit" size="sm" disabled={isSavingCat} className="w-full">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Category
            </Button>
          </form>

          {/* Category list */}
          <div className="space-y-4 mt-2">
            {(hasCategoriesFromDb ? categoryGroups : EXPENSE_CATEGORY_GROUPS.map(g => ({
              group: g.group,
              categories: g.categories.map(name => ({ id: name, name, group_name: g.group, is_system: true }))
            }))).map((group) => (
              <div key={group.group}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  {group.group}
                </p>
                <div className="space-y-1">
                  {group.categories.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between px-3 py-1.5 rounded-md border bg-background text-sm">
                      <span>{cat.name}</span>
                      {cat.is_system ? (
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => setDeleteCatId(cat.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete expense confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete category confirmation */}
      <AlertDialog open={!!deleteCatId} onOpenChange={(open) => !open && setDeleteCatId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the category. Existing expenses using it will keep their value but you won't be able to select it for new expenses.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
