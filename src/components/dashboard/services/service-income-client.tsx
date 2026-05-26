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
import { PlusCircle, Pencil, Trash2, Printer, CheckCircle2 } from 'lucide-react';
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
import type { ServiceIncome, Customer } from '@/lib/types';
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

interface ServiceIncomeClientProps {
  title: string;
  descriptionText: string;
  serviceType: string;
}

export default function ServiceIncomeClient({ title, descriptionText, serviceType }: ServiceIncomeClientProps) {
  const { toast } = useToast();
  const [incomes, setIncomes] = useState<ServiceIncome[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<ServiceIncome | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<ServiceIncome | null>(null);

  // Form states
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'add_to_bill'>('paid');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [lineItems, setLineItems] = useState<{description: string, amount: string}[]>([{ description: '', amount: '' }]);

  const totalAmount = lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/service-incomes?service_type=${encodeURIComponent(serviceType)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setIncomes(data.incomes || []);
    } catch (error) {
      console.error("Error fetching incomes:", error);
      toast({ variant: 'destructive', title: "Error", description: `Failed to fetch ${title.toLowerCase()}.` });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [serviceType]);

  useEffect(() => {
    if (!customerSearchQuery) {
      setCustomerSearchResults([]);
      setShowCustomerDropdown(false);
      return;
    }

    const search = async () => {
      setIsSearchingCustomers(true);
      try {
        const url = new URL('/api/admin/customers', window.location.origin);
        url.searchParams.append('search', customerSearchQuery);
        const res = await fetch(url.toString());
        const data = await res.json();
        if (data.customers) {
          setCustomerSearchResults(data.customers);
          setShowCustomerDropdown(true);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearchingCustomers(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      search();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [customerSearchQuery]);

  useEffect(() => {
    if (!customerName.trim() && paymentStatus === 'add_to_bill') {
      setPaymentStatus('paid');
    }
  }, [customerName, paymentStatus]);

  const {
    currentPage,
    totalPages,
    totalItems,
    paginatedItems,
    itemsPerPage,
    setCurrentPage,
  } = usePagination(incomes, 20);

  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setCustomerName('');
    setRoomNumber('');
    setPaymentStatus('paid');
    setPaymentMethod('cash');
    setLineItems([{ description: '', amount: '' }]);
    setEditingIncome(null);
  };

  const handleOpenDialog = (income?: ServiceIncome) => {
    if (income) {
      setEditingIncome(income);
      setDate(income.date);
      setCustomerName(income.customer_name || '');
      setRoomNumber(income.room_number || '');
      setPaymentStatus(income.payment_status || 'paid');
      setPaymentMethod(income.payment_method || 'cash');
      
      if (income.line_items && income.line_items.length > 0) {
        setLineItems(income.line_items.map(i => ({ description: i.description, amount: i.amount.toString() })));
      } else {
        setLineItems([{ description: income.description, amount: income.amount.toString() }]);
      }
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as any).submitter as HTMLButtonElement;
    const action = (submitter?.value as 'paid' | 'add_to_bill') || paymentStatus;
    
    setPaymentStatus(action);
    
    try {
      const url = '/api/admin/service-incomes';
      const method = editingIncome ? 'PUT' : 'POST';
      const body = {
        id: editingIncome?.id,
        description: lineItems.map(i => i.description).join(', '),
        amount: totalAmount,
        service_type: serviceType,
        date,
        customer_name: customerName || null,
        room_number: roomNumber || null,
        payment_status: action,
        payment_method: action === 'paid' ? paymentMethod : null,
        line_items: lineItems.map(i => ({ description: i.description, amount: parseFloat(i.amount) || 0 }))
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      toast({
        title: editingIncome ? "Record Updated" : "Record Added",
        description: editingIncome ? "The record has been updated successfully." : "New income has been recorded.",
      });

      if (!editingIncome && action === 'paid' && data.income) {
          handlePrint(data.income);
      }

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error saving income:", error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to save record." });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/admin/service-incomes?id=${deleteId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      toast({ title: "Record Deleted", description: "The record has been removed." });
      setIncomes(incomes.filter(i => i.id !== deleteId));
    } catch (error) {
      console.error("Error deleting income:", error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to delete record." });
    } finally {
      setDeleteId(null);
    }
  };

  const handlePrint = (income: ServiceIncome) => {
    setSelectedInvoice(income);
    // Allow state to set before calling print
    setTimeout(() => {
      window.print();
    }, 300);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-3xl font-headline font-bold">{title}</h1>
          <p className="text-muted-foreground">{descriptionText}</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Record
        </Button>
      </div>

      <div className="rounded-md border print:hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount (LKR)</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10">Loading...</TableCell>
              </TableRow>
            ) : (!paginatedItems || paginatedItems.length === 0) ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No records found.</TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((income) => (
                <TableRow key={income.id}>
                  <TableCell>{new Date(income.date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {income.customer_name ? (
                      <div>
                        <span className="font-medium">{income.customer_name}</span>
                        {income.room_number && <span className="text-xs text-muted-foreground ml-2">(Room: {income.room_number})</span>}
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">Walk-in / N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{income.description}</TableCell>
                  <TableCell className="text-right">LKR {income.amount.toFixed(2)}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => handlePrint(income)}>
                      <Printer className="h-3 w-3" /> Print
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleOpenDialog(income)}
                      disabled={income.payment_status === 'paid'}
                      title={income.payment_status === 'paid' ? 'Paid records cannot be edited' : 'Edit record'}
                    >
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>{editingIncome ? 'Edit Record' : 'Add New Record'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
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

              <div>
                <Label className="mb-2 block">Line Items</Label>
                <div className="space-y-3">
                  {lineItems.map((item, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <div className="flex-1">
                        <Input
                          placeholder="Description (e.g. Laundry)"
                          value={item.description}
                          onChange={(e) => {
                            const newItems = [...lineItems];
                            newItems[index].description = e.target.value;
                            setLineItems(newItems);
                          }}
                          required
                        />
                      </div>
                      <div className="w-32">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Amount"
                          value={item.amount}
                          onChange={(e) => {
                            const newItems = [...lineItems];
                            newItems[index].amount = e.target.value;
                            setLineItems(newItems);
                          }}
                          required
                        />
                      </div>
                      {lineItems.length > 1 && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive hover:text-destructive"
                          onClick={() => setLineItems(lineItems.filter((_, i) => i !== index))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => setLineItems([...lineItems, { description: '', amount: '' }])}
                  >
                    <PlusCircle className="h-4 w-4" /> Add Item
                  </Button>
                  <div className="font-bold">
                    Total: LKR {totalAmount.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="pt-2 border-t mt-4">
              <h4 className="text-sm font-medium mb-3 text-muted-foreground">Customer Details (Optional for Invoice)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 relative">
                  <Label htmlFor="customerName">Customer (Search by Name, Phone, ID)</Label>
                  <Input
                    id="customerName"
                    placeholder="Search existing or enter new..."
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      setCustomerSearchQuery(e.target.value);
                    }}
                    onFocus={() => {
                        if (customerSearchResults.length > 0) setShowCustomerDropdown(true);
                    }}
                    onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                  />
                  {showCustomerDropdown && (
                    <div className="absolute z-10 w-full bg-white border rounded-md shadow-lg top-[60px] max-h-48 overflow-y-auto">
                      {isSearchingCustomers ? (
                        <div className="p-2 text-sm text-center text-muted-foreground">Searching...</div>
                      ) : customerSearchResults.length > 0 ? (
                        customerSearchResults.map(c => (
                          <div 
                            key={c.id} 
                            className="p-2 hover:bg-muted cursor-pointer text-sm border-b last:border-0"
                            onClick={() => {
                                setCustomerName(c.name);
                                setCustomerSearchQuery('');
                                setShowCustomerDropdown(false);
                            }}
                          >
                            <div className="font-medium">{c.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {c.phone && <span>{c.phone}</span>}
                              {c.id_number && <span className="ml-2">ID: {c.id_number}</span>}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-2 text-sm text-center text-muted-foreground">No matches. Will save as new.</div>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="roomNumber">Room Number</Label>
                  <Input
                    id="roomNumber"
                    placeholder="e.g. 101"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Label className="mb-2 block">Payment Method (If Paying Now)</Label>
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cash"
                    checked={paymentMethod === 'cash'}
                    onChange={() => setPaymentMethod('cash')}
                    className="w-4 h-4 text-primary"
                  />
                  <span>Cash</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="card"
                    checked={paymentMethod === 'card'}
                    onChange={() => setPaymentMethod('card')}
                    className="w-4 h-4 text-primary"
                  />
                  <span>Credit/Debit Card</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-4 gap-2">
              <Button 
                type="submit" 
                name="action" 
                value="add_to_bill" 
                variant="outline" 
                className="flex-1" 
                disabled={!customerName.trim()}
              >
                {editingIncome ? 'Update (Add to Bill)' : 'Save (Add to Bill)'}
              </Button>
              <Button 
                type="submit" 
                name="action" 
                value="paid" 
                className="flex-1"
              >
                {editingIncome ? 'Update (Paid)' : 'Save as Paid & Print'}
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

      {/* Hidden Print Area */}
      {selectedInvoice && (
        <div id="print-area" className="hidden print:block font-sans text-black bg-white p-8">
          <div className="flex justify-between items-start border-b pb-6 mb-6">
            <div>
              <h1 className="text-3xl font-bold uppercase tracking-wider text-gray-900">INVOICE</h1>
              <p className="text-sm text-gray-500 mt-1">Invoice #: INV-{selectedInvoice.id.substring(0, 8).toUpperCase()}</p>
              <p className="text-sm text-gray-500">Date: {new Date().toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold text-gray-900">Oruthota Chalets</h2>
              <p className="text-sm text-gray-500 mt-1">Digana, Kandy</p>
              <p className="text-sm text-gray-500">Sri Lanka</p>
              <p className="text-sm text-gray-500">+94 77 123 4567</p>
            </div>
          </div>

          <div className="flex justify-between mb-8">
            <div className="bg-gray-50 p-4 rounded-lg w-1/2 mr-4 border border-gray-100">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Billed To</h3>
              <p className="font-medium text-lg text-gray-900">{selectedInvoice.customer_name || 'Walk-in Customer'}</p>
              {selectedInvoice.room_number && (
                <p className="text-gray-600 mt-1">Room: {selectedInvoice.room_number}</p>
              )}
            </div>
            <div className="bg-gray-50 p-4 rounded-lg w-1/3 border border-gray-100 text-right">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Service Type</h3>
              <p className="font-medium text-lg text-gray-900">{selectedInvoice.service_type}</p>
              <p className="text-gray-600 mt-1">Service Date: {new Date(selectedInvoice.date).toLocaleDateString()}</p>
            </div>
          </div>

          <table className="w-full mb-8 text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="py-3 px-2 font-bold text-gray-700 uppercase text-xs tracking-wider">Description</th>
                <th className="py-3 px-2 font-bold text-gray-700 uppercase text-xs tracking-wider text-right w-32">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(selectedInvoice.line_items && selectedInvoice.line_items.length > 0) ? (
                selectedInvoice.line_items.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="py-4 px-2 text-gray-800">{item.description}</td>
                    <td className="py-4 px-2 text-gray-800 text-right font-medium">LKR {Number(item.amount).toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr className="border-b border-gray-100">
                  <td className="py-4 px-2 text-gray-800">{selectedInvoice.description}</td>
                  <td className="py-4 px-2 text-gray-800 text-right font-medium">LKR {selectedInvoice.amount.toFixed(2)}</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex justify-end mb-12">
            <div className="w-1/3">
              <div className="flex justify-between py-2 border-t-2 border-gray-900 font-bold text-lg">
                <span>Total</span>
                <span>LKR {selectedInvoice.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 text-sm text-gray-500">
                <span>Status</span>
                <span className="flex items-center text-green-600 font-medium"><CheckCircle2 className="w-4 h-4 mr-1"/> Paid / Settled</span>
              </div>
              <div className="flex justify-between py-2 text-sm text-gray-500">
                <span>Method</span>
                <span className="capitalize font-medium">{selectedInvoice.payment_method || 'Cash'}</span>
              </div>
            </div>
          </div>

          <div className="text-center text-gray-500 text-sm mt-16 pt-8 border-t border-gray-200">
            <p>Thank you for your business!</p>
            <p className="mt-1">For any inquiries, please contact info@oruthotachalets.com</p>
          </div>
        </div>
      )}
    </div>
  );
}
