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
import { PlusCircle, Pencil, Trash2, Link2, ExternalLink, X, Plus, Settings, Lock, Search, HandCoins } from 'lucide-react';
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
import type { Expense } from '@/lib/types';
import { EXPENSE_CATEGORY_GROUPS } from '@/lib/expense-categories';
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent } from '@/components/ui/card';

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
  const today = new Date().toISOString().slice(0, 10);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [fundingByExpenseId, setFundingByExpenseId] = useState<Map<string, { status: string; issued_amount: number; requested_amount: number; item_amount: number }>>(new Map());
  const [requestingExpenseId, setRequestingExpenseId] = useState<string | null>(null);
  const [payingExpenseId, setPayingExpenseId] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<'all' | 'date' | 'month' | 'year'>('month');
  const [filterDate, setFilterDate] = useState(today);
  const [filterMonth, setFilterMonth] = useState(today.slice(0, 7));
  const [filterYear, setFilterYear] = useState(today.slice(0, 4));

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
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [supportLinks, setSupportLinks] = useState<string[]>([]);

  const categoryGroups = useMemo(() => buildGroups(dbCategories), [dbCategories]);

  // Fallback to hardcoded COA list when DB hasn't been migrated yet
  const hasCategoriesFromDb = dbCategories.length > 0;
  const availableCategoryGroups = useMemo(() => hasCategoriesFromDb
    ? categoryGroups
    : EXPENSE_CATEGORY_GROUPS.map(group => ({
        group: group.group,
        categories: group.categories.map(name => ({ id: name, name, group_name: group.group, is_system: true })),
      })), [categoryGroups, hasCategoriesFromDb]);
  const searchedCategoryGroups = useMemo(() => {
    const term = categorySearch.trim().toLowerCase();
    if (!term) return availableCategoryGroups;
    return availableCategoryGroups
      .map(group => ({ ...group, categories: group.categories.filter(cat => cat.name.toLowerCase().includes(term)) }))
      .filter(group => group.categories.length > 0);
  }, [availableCategoryGroups, categorySearch]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [expRes, catRes, fundingRes] = await Promise.all([
        fetch('/api/admin/expenses'),
        fetch('/api/admin/expense-categories'),
        fetch('/api/admin/expense-funding-requests'),
      ]);
      const expData = await expRes.json();
      const catData = await catRes.json();
      const fundingData = await fundingRes.json();
      if (expData.error) throw new Error(expData.error);
      setExpenses(expData.expenses || []);
      if (!catData.error) setDbCategories(catData.categories || []);
      if (!fundingData.error) {
        const entries = (fundingData.requests || []).flatMap((requestItem: { expense_id?: string; status: string; issued_amount: number; requested_amount: number; items?: Array<{ expense_id: string; amount: number }> }) => {
          const items = requestItem.items?.length
            ? requestItem.items
            : requestItem.expense_id ? [{ expense_id: requestItem.expense_id, amount: requestItem.requested_amount }] : [];
          return items.map(item => [item.expense_id, { ...requestItem, item_amount: Number(item.amount || 0) }] as const);
        });
        setFundingByExpenseId(new Map(entries));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to fetch expenses." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredExpenses = useMemo(() => expenses.filter(expense => {
    if (periodFilter === 'date') return expense.date.slice(0, 10) === filterDate;
    if (periodFilter === 'month') return expense.date.slice(0, 7) === filterMonth;
    if (periodFilter === 'year') return expense.date.slice(0, 4) === filterYear;
    return true;
  }), [expenses, filterDate, filterMonth, filterYear, periodFilter]);
  const expensesToRequest = filteredExpenses.filter(expense => !expense.is_paid && !fundingByExpenseId.has(expense.id));
  const amountToRequest = expensesToRequest.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const expenseFundingSummary = filteredExpenses.reduce((totals, expense) => {
    const funding = fundingByExpenseId.get(expense.id);
    const itemAmount = Number(funding?.item_amount || 0);
    const issuedRatio = funding?.requested_amount ? Math.min(1, Number(funding.issued_amount || 0) / Number(funding.requested_amount)) : 0;
    return {
      requested: totals.requested + itemAmount,
      issued: totals.issued + itemAmount * issuedRatio,
      paid: totals.paid + (expense.is_paid ? Number(expense.amount || 0) : 0),
    };
  }, { requested: 0, issued: 0, paid: 0 });

  const expenseYears = useMemo(() => Array.from(new Set([
    today.slice(0, 4),
    ...expenses.map(expense => expense.date.slice(0, 4)),
  ])).sort((a, b) => b.localeCompare(a)), [expenses, today]);

  const { currentPage, totalPages, totalItems, paginatedItems, itemsPerPage, setCurrentPage } =
    usePagination(filteredExpenses, 20);

  useEffect(() => { setCurrentPage(1); }, [filterDate, filterMonth, filterYear, periodFilter, setCurrentPage]);

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setCategory('');
    setCategorySearch('');
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
      setCategorySearch(expense.category);
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
    if (!category) {
      toast({ variant: 'destructive', title: "Category required", description: "Please select an expense category." });
      return;
    }
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
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to save expense.');
      toast({ title: editingExpense ? "Expense Updated" : "Expense Added" });
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast({ variant: 'destructive', title: "Error", description: (error as Error).message });
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

  const requestExpenseFunds = async () => {
    if (!expensesToRequest.length) return;
    setRequestingExpenseId('batch');
    try {
      const response = await fetch('/api/admin/expense-funding-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expense_ids: expensesToRequest.map(expense => expense.id) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to request funds.');
      setFundingByExpenseId(previous => {
        const next = new Map(previous);
        for (const item of payload.request.items || []) {
          next.set(item.expense_id, { ...payload.request, item_amount: Number(item.amount || 0) });
        }
        return next;
      });
      toast({ title: 'Funds requested', description: `${expensesToRequest.length} expense(s) were submitted as one Finance Request.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Request failed', description: (error as Error).message });
    } finally {
      setRequestingExpenseId(null);
    }
  };

  const markExpensePaid = async (expense: Expense) => {
    setPayingExpenseId(expense.id);
    try {
      const response = await fetch('/api/admin/expenses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: expense.id, is_paid: true }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to mark expense paid.');
      setExpenses(previous => previous.map(item => item.id === expense.id ? payload.expense : item));
      toast({ title: 'Expense settled', description: `${expense.description} was marked as settled.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Payment failed', description: (error as Error).message });
    } finally {
      setPayingExpenseId(null);
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
          <h1 className="text-3xl font-headline font-bold">Other Expenses</h1>
          <p className="text-muted-foreground">Track and manage your other expenses.</p>
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

      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-3">
        <Label className="mr-1">Filter period</Label>
        <Select value={periodFilter} onValueChange={value => setPeriodFilter(value as 'all' | 'date' | 'month' | 'year')}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="date">Date-wise</SelectItem>
            <SelectItem value="month">Month-wise</SelectItem>
            <SelectItem value="year">Year-wise</SelectItem>
          </SelectContent>
        </Select>
        {periodFilter === 'date' && <Input type="date" value={filterDate} onChange={event => setFilterDate(event.target.value)} className="w-auto" />}
        {periodFilter === 'month' && <Input type="month" value={filterMonth} onChange={event => setFilterMonth(event.target.value)} className="w-auto" />}
        {periodFilter === 'year' && <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{expenseYears.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}</SelectContent>
        </Select>}
        <span className="ml-auto text-sm text-muted-foreground">{filteredExpenses.length} expense(s)</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Requested</p><p className="mt-1 text-lg font-bold">LKR {expenseFundingSummary.requested.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Issued by Finance</p><p className="mt-1 text-lg font-bold">LKR {expenseFundingSummary.issued.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Settled</p><p className="mt-1 text-lg font-bold">LKR {expenseFundingSummary.paid.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">To Settle</p><p className="mt-1 text-lg font-bold">LKR {Math.max(0, expenseFundingSummary.issued - expenseFundingSummary.paid).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</p></CardContent></Card>
      </div>

      <Card><CardContent className="flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-56 flex-1">
          <Label>Amount to Request</Label>
          <Input value={amountToRequest.toFixed(2)} readOnly className="mt-1 bg-muted/40 font-semibold" />
          <p className="mt-1 text-xs text-muted-foreground">{expensesToRequest.length} unrequested expense(s) in the selected period</p>
        </div>
        <Button onClick={requestExpenseFunds} disabled={!expensesToRequest.length || requestingExpenseId === 'batch'}>
          <HandCoins className="mr-2 h-4 w-4" />{requestingExpenseId === 'batch' ? 'Requesting…' : 'Request Money'}
        </Button>
      </CardContent></Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount (LKR)</TableHead>
              <TableHead>Links</TableHead>
              <TableHead>Settlement</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10">Loading...</TableCell></TableRow>
            ) : (!paginatedItems || paginatedItems.length === 0) ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No expenses recorded.</TableCell></TableRow>
            ) : (
              paginatedItems.map((expense) => {
                const funding = fundingByExpenseId.get(expense.id);
                const fullyFunded = Number(funding?.issued_amount || 0) >= Number(expense.amount || 0);
                return (
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
                  <TableCell>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${expense.is_paid ? 'bg-emerald-100 text-emerald-700' : fullyFunded ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'}`}>
                      {expense.is_paid ? 'Settled' : fullyFunded ? 'Issued by Finance' : funding ? 'Awaiting Finance' : 'Not Requested'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {!expense.is_paid && <Button size="sm" disabled={!fullyFunded || payingExpenseId === expense.id} onClick={() => markExpensePaid(expense)}>
                      {payingExpenseId === expense.id ? 'Settling…' : 'Mark Settled'}
                    </Button>}
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={Number(funding?.issued_amount || 0) > 0}
                      title={Number(funding?.issued_amount || 0) > 0 ? 'Cannot edit after Finance has issued funds' : 'Edit expense'}
                      onClick={() => handleOpenDialog(expense)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(expense.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );})
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
              <Popover modal open={categoryOpen} onOpenChange={setCategoryOpen}>
                <PopoverTrigger asChild>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={categorySearch}
                      onFocus={() => setCategoryOpen(true)}
                      onChange={event => {
                        setCategorySearch(event.target.value);
                        setCategory('');
                        setCategoryOpen(true);
                      }}
                      placeholder="Search and select category…"
                      className="pl-9"
                      autoComplete="off"
                    />
                  </div>
                </PopoverTrigger>
                <PopoverContent
                  className="max-h-72 w-[var(--radix-popover-trigger-width)] overflow-y-auto p-1"
                  align="start"
                  onOpenAutoFocus={event => event.preventDefault()}
                >
                  {searchedCategoryGroups.length ? searchedCategoryGroups.map(group => <div key={group.group} className="py-1">
                    <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">{group.group}</p>
                    {group.categories.map(cat => <button
                      key={cat.id}
                      type="button"
                      className="w-full rounded-sm px-2 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                      onClick={() => {
                        setCategory(cat.name);
                        setCategorySearch(cat.name);
                        setCategoryOpen(false);
                      }}
                    >{cat.name}</button>)}
                  </div>) : <div className="px-3 py-6 text-center text-sm text-muted-foreground">No category found.</div>}
                </PopoverContent>
              </Popover>
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
