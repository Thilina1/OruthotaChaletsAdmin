'use client';

import { useEffect, useState } from 'react';
import { Calendar, Mail, MessageSquare, Phone, Plus, Printer, Search, Sparkles, Trash2, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePagination } from '@/hooks/use-pagination';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

type InquiryStatus = 'pending' | 'contacted' | 'confirmed' | 'cancelled' | 'completed';

type ExperienceInquiry = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  subject: string | null;
  message: string | null;
  experience_type: string | null;
  status: InquiryStatus;
  created_at: string;
  customer_id?: string | null;
};

type OtherCharge = { name: string; amount: string };
type CustomerOption = { id: string; name: string; email?: string | null; phone?: string | null; id_number?: string | null };
type InquiryPayment = { inquiry_id: string; income_id: string; amount: number; payment_status: 'add_to_bill' | 'paid'; payment_method: 'cash' | 'card' | null };
type ExperienceBill = {
  id: string;
  description: string;
  amount: number;
  date: string;
  customer_name: string;
  customer_id: string;
  payment_status: 'add_to_bill' | 'paid';
  payment_method: 'cash' | 'card' | null;
  line_items: { description: string; amount: number }[];
};

const statuses: InquiryStatus[] = ['pending', 'contacted', 'confirmed', 'cancelled', 'completed'];

const formatLabel = (value: string | null) =>
  value ? value.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : 'Not specified';

const statusVariant = (status: InquiryStatus) => {
  if (status === 'confirmed' || status === 'completed') return 'default' as const;
  if (status === 'cancelled') return 'destructive' as const;
  return 'secondary' as const;
};

export default function ExperienceInquiriesPage() {
  const { toast } = useToast();
  const router = useRouter();
  const supabase = createClient();
  const [inquiries, setInquiries] = useState<ExperienceInquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedInquiry, setSelectedInquiry] = useState<ExperienceInquiry | null>(null);
  const [confirmingInquiry, setConfirmingInquiry] = useState<ExperienceInquiry | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [people, setPeople] = useState('1');
  const [pricePerPerson, setPricePerPerson] = useState('');
  const [serviceChargeRate, setServiceChargeRate] = useState('10');
  const [taxRate, setTaxRate] = useState('0');
  const [otherCharges, setOtherCharges] = useState<OtherCharge[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<'add_to_bill' | 'paid'>('add_to_bill');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [isLoadingBilling, setIsLoadingBilling] = useState(false);
  const [billView, setBillView] = useState(false);
  const [billIncome, setBillIncome] = useState<ExperienceBill | null>(null);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('new');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newInquiry, setNewInquiry] = useState({ customer_id: 'new', name: '', email: '', phone: '', subject: '', message: '', experience_type: 'culinary_tourism' });
  const [createCustomerSearch, setCreateCustomerSearch] = useState('');
  const [billingCustomerSearch, setBillingCustomerSearch] = useState('');
  const [payments, setPayments] = useState<Record<string, InquiryPayment>>({});

  const filterCustomers = (search: string) => {
    const query = search.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((customer) => [customer.name, customer.id_number, customer.phone, customer.email]
      .some((value) => value?.toLowerCase().includes(query)));
  };

  const fetchInquiries = async () => {
    setIsLoading(true);
    try {
      const [inquiryResult, paymentResponse] = await Promise.all([
        supabase.from('contact_messages').select('*').eq('inquiry_type', 'experience').order('created_at', { ascending: false }),
        fetch('/api/admin/experience-inquiries').then((response) => response.json()),
      ]);

      if (inquiryResult.error) throw inquiryResult.error;
      setInquiries((inquiryResult.data || []) as ExperienceInquiry[]);
      setPayments(Object.fromEntries((paymentResponse.payments || []).map((payment: InquiryPayment) => [payment.inquiry_id, payment])));
    } catch (error) {
      console.error('Error fetching experience inquiries:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load experience inquiries.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
    fetch('/api/admin/customers').then((response) => response.json()).then((data) => setCustomers(data.customers || [])).catch(() => undefined);
  }, []);

  const selectCustomer = (customerId: string, target: 'billing' | 'create') => {
    const customer = customers.find((item) => item.id === customerId);
    if (target === 'billing') {
      setSelectedCustomerId(customerId);
      if (customer) setCustomerName(customer.name);
    } else {
      setNewInquiry((current) => ({
        ...current,
        customer_id: customerId,
        name: customer?.name || '',
        email: customer?.email || '',
        phone: customer?.phone || '',
      }));
    }
  };

  const createInquiry = async () => {
    if (!newInquiry.name.trim()) {
      toast({ variant: 'destructive', title: 'Customer required', description: 'Select a customer or enter a new customer name.' });
      return;
    }
    setIsCreating(true);
    try {
      const response = await fetch('/api/admin/experience-inquiries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newInquiry, customer_id: newInquiry.customer_id === 'new' ? null : newInquiry.customer_id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create inquiry.');
      setInquiries((current) => [result.inquiry, ...current]);
      setIsCreateOpen(false);
      setNewInquiry({ customer_id: 'new', name: '', email: '', phone: '', subject: '', message: '', experience_type: 'culinary_tourism' });
      toast({ title: 'Inquiry created', description: 'The experience inquiry was added successfully.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Could not create inquiry', description: error.message });
    } finally {
      setIsCreating(false);
    }
  };

  const openBilling = async (inquiry: ExperienceInquiry) => {
    setSelectedInquiry(inquiry);
    setCustomerName(inquiry.name || '');
    setSelectedCustomerId(inquiry.customer_id || 'new');
    setPeople('1');
    setPricePerPerson('');
    setServiceChargeRate('10');
    setTaxRate('0');
    setOtherCharges([]);
    setPaymentStatus('add_to_bill');
    setPaymentMethod('cash');
    setConfirmingInquiry(inquiry);
    setBillView(false);
    if (inquiry.status === 'confirmed' || inquiry.status === 'completed') {
      setIsLoadingBilling(true);
      try {
        const response = await fetch(`/api/admin/experience-inquiries/confirm?inquiry_id=${encodeURIComponent(inquiry.id)}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to load saved billing.');
        const income = result.income;
        const pricing = income?.pricing_breakdown;
        if (pricing) {
          setPeople(String(pricing.people || 1));
          setPricePerPerson(pricing.price_per_person === null || pricing.price_per_person === undefined ? '' : String(pricing.price_per_person));
          setServiceChargeRate(String(pricing.service_charge_rate || 0));
          setTaxRate(String(pricing.tax_rate || 0));
          setOtherCharges((pricing.other_charges || []).map((item: { name: string; amount: number }) => ({ name: item.name, amount: String(item.amount) })));
        }
        if (income?.payment_status === 'paid') setPaymentStatus('paid');
        if (income?.payment_method === 'card') setPaymentMethod('card');
        if (income?.customer_id) setSelectedCustomerId(income.customer_id);
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Could not load billing', description: error.message });
      } finally {
        setIsLoadingBilling(false);
      }
    }
  };

  const openBill = async (inquiry: ExperienceInquiry) => {
    setSelectedInquiry(inquiry);
    setConfirmingInquiry(null);
    setIsLoadingBilling(true);
    try {
      const response = await fetch(`/api/admin/experience-inquiries/confirm?inquiry_id=${encodeURIComponent(inquiry.id)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to load bill.');
      if (!result.income) throw new Error('No bill has been created for this inquiry yet.');
      setBillIncome(result.income as ExperienceBill);
      setPayments((current) => ({ ...current, [inquiry.id]: {
        inquiry_id: inquiry.id,
        income_id: result.income.id,
        amount: Number(result.income.amount || 0),
        payment_status: result.income.payment_status,
        payment_method: result.income.payment_method,
      } }));
      setBillView(true);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Could not load bill', description: error.message });
    } finally {
      setIsLoadingBilling(false);
    }
  };

  const printBill = () => {
    if (!billIncome || !selectedInquiry) return;
    const printWindow = window.open('', '_blank', 'width=760,height=900');
    if (!printWindow) {
      toast({ variant: 'destructive', title: 'Print blocked', description: 'Allow pop-ups to print this bill.' });
      return;
    }
    const doc = printWindow.document;
    doc.title = `Experience Bill ${billIncome.id.slice(0, 8).toUpperCase()}`;
    const style = doc.createElement('style');
    style.textContent = 'body{font-family:Arial,sans-serif;color:#111;padding:40px;max-width:760px;margin:auto}h1{margin:0}.muted{color:#666}.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #ddd}.total{font-size:20px;font-weight:bold;border-top:2px solid #111;margin-top:16px;padding-top:12px}.status{text-transform:capitalize}';
    doc.head.appendChild(style);
    const container = doc.createElement('div');
    const addText = (tag: string, text: string, className?: string) => {
      const element = doc.createElement(tag);
      element.textContent = text;
      if (className) element.className = className;
      container.appendChild(element);
    };
    addText('h1', 'Oruthota Chalets');
    addText('p', 'Experience Bill', 'muted');
    addText('p', `Bill No: EXP-${billIncome.id.slice(0, 8).toUpperCase()}`);
    addText('p', `Date: ${new Date(billIncome.date).toLocaleDateString()}`);
    addText('p', `Customer: ${billIncome.customer_name || selectedInquiry.name || 'Guest'}`);
    addText('h3', billIncome.description || formatLabel(selectedInquiry.experience_type));
    (billIncome.line_items || []).forEach((item) => {
      const row = doc.createElement('div');
      row.className = 'row';
      const description = doc.createElement('span'); description.textContent = item.description;
      const amount = doc.createElement('span'); amount.textContent = `LKR ${Number(item.amount || 0).toFixed(2)}`;
      row.append(description, amount); container.appendChild(row);
    });
    addText('p', `Total: LKR ${Number(billIncome.amount || 0).toFixed(2)}`, 'total');
    addText('p', billIncome.payment_status === 'paid' ? `Paid by ${billIncome.payment_method || 'N/A'}` : 'Payment due — added to guest bill', 'status');
    doc.body.appendChild(container);
    printWindow.focus();
    printWindow.print();
  };

  const updateStatus = async (inquiry: ExperienceInquiry, status: InquiryStatus) => {
    if (status === 'confirmed') {
      openBilling(inquiry);
      return;
    }
    setUpdatingId(inquiry.id);
    const previousStatus = inquiry.status;
    setInquiries((current) => current.map((item) => item.id === inquiry.id ? { ...item, status } : item));
    setSelectedInquiry((current) => current?.id === inquiry.id ? { ...current, status } : current);

    const { error } = await supabase
      .from('contact_messages')
      .update({ status })
      .eq('id', inquiry.id)
      .eq('inquiry_type', 'experience');

    if (error) {
      setInquiries((current) => current.map((item) => item.id === inquiry.id ? { ...item, status: previousStatus } : item));
      setSelectedInquiry((current) => current?.id === inquiry.id ? { ...current, status: previousStatus } : current);
      toast({ variant: 'destructive', title: 'Update failed', description: 'The inquiry status could not be saved.' });
    } else {
      toast({ title: 'Status updated', description: `Inquiry marked as ${formatLabel(status)}.` });
    }
    setUpdatingId(null);
  };

  const baseAmount = (Number(people) || 0) * (Number(pricePerPerson) || 0);
  const serviceCharge = baseAmount * (Number(serviceChargeRate) || 0) / 100;
  const tax = (baseAmount + serviceCharge) * (Number(taxRate) || 0) / 100;
  const otherChargeTotal = otherCharges.reduce((sum, charge) => sum + (Number(charge.amount) || 0), 0);
  const billTotal = baseAmount + serviceCharge + tax + otherChargeTotal;

  const confirmAndAddToBill = async () => {
    if (!confirmingInquiry || !customerName.trim() || Number(people) < 1 || (pricePerPerson !== '' && Number(pricePerPerson) < 0)) {
      toast({ variant: 'destructive', title: 'Missing details', description: 'Enter a customer and a valid number of people.' });
      return;
    }
    setIsConfirming(true);
    try {
      const response = await fetch('/api/admin/experience-inquiries/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inquiry_id: confirmingInquiry.id,
          customer_name: customerName.trim(),
          customer_id: selectedCustomerId === 'new' ? null : selectedCustomerId,
          experience_name: confirmingInquiry.experience_type ? formatLabel(confirmingInquiry.experience_type) : (confirmingInquiry.subject || 'Experience'),
          people: Number(people),
          price_per_person: pricePerPerson === '' ? null : Number(pricePerPerson),
          service_charge_rate: Number(serviceChargeRate) || 0,
          tax_rate: Number(taxRate) || 0,
          other_charges: otherCharges,
          payment_status: paymentStatus,
          payment_method: paymentStatus === 'paid' ? paymentMethod : null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to add experience to bill.');
      setInquiries((current) => current.map((item) => item.id === confirmingInquiry.id ? { ...item, status: 'confirmed' } : item));
      setSelectedInquiry((current) => current?.id === confirmingInquiry.id ? { ...current, status: 'confirmed' } : current);
      setConfirmingInquiry(null);
      setBillIncome(result.income as ExperienceBill);
      setPayments((current) => ({ ...current, [confirmingInquiry.id]: {
        inquiry_id: confirmingInquiry.id,
        income_id: result.income.id,
        amount: Number(result.income.amount || 0),
        payment_status: result.income.payment_status,
        payment_method: result.income.payment_method,
      } }));
      setBillView(true);
      toast({
        title: paymentStatus === 'paid' ? 'Payment saved' : 'Experience added to bill',
        description: paymentStatus === 'paid'
          ? `LKR ${billTotal.toFixed(2)} was recorded as paid by ${paymentMethod}.`
          : `LKR ${billTotal.toFixed(2)} was added to ${customerName.trim()}'s bill.`,
      });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Confirmation failed', description: error.message });
    } finally {
      setIsConfirming(false);
    }
  };

  const query = searchQuery.trim().toLowerCase();
  const filtered = inquiries.filter((inquiry) => {
    const matchesStatus = statusFilter === 'all' || inquiry.status === statusFilter;
    const matchesSearch = !query || [inquiry.name, inquiry.email, inquiry.phone, inquiry.subject, inquiry.message, inquiry.experience_type]
      .some((value) => value?.toLowerCase().includes(query));
    return matchesStatus && matchesSearch;
  });

  const pagination = usePagination(filtered, 20);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Experience Inquiries</h1>
          <p className="text-muted-foreground">Manage guest inquiries and booking requests for experiences.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Add Experience Inquiry</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Experience Booking Inquiries</CardTitle>
              <CardDescription>
                {isLoading ? 'Loading…' : `${pagination.totalItems} ${pagination.totalItems === 1 ? 'inquiry' : 'inquiries'} found`}
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Filter status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {statuses.map((status) => <SelectItem key={status} value={status}>{formatLabel(status)}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search name, email, phone…"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guest</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? [...Array(6)].map((_, index) => (
                <TableRow key={index}><TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
              )) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-14 text-center text-muted-foreground">
                    <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-30" />
                    {searchQuery || statusFilter !== 'all' ? 'No experience inquiries match your filters.' : 'No experience inquiries yet.'}
                  </TableCell>
                </TableRow>
              ) : pagination.paginatedItems.map((inquiry) => (
                <TableRow key={inquiry.id}>
                  <TableCell>
                    <div className="font-medium">{inquiry.name || '—'}</div>
                    <div className="text-xs text-muted-foreground">{inquiry.email || '—'}</div>
                  </TableCell>
                  <TableCell>
                    {inquiry.phone ? (
                      <a href={`tel:${inquiry.phone}`} className="flex items-center gap-2 whitespace-nowrap text-sm text-primary hover:underline">
                        <Phone className="h-4 w-4" />{inquiry.phone}
                      </a>
                    ) : '—'}
                  </TableCell>
                  <TableCell><Badge variant="outline"><Sparkles className="mr-1 h-3 w-3" />{formatLabel(inquiry.experience_type)}</Badge></TableCell>
                  <TableCell className="max-w-64 truncate text-sm">{inquiry.subject || '—'}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(inquiry.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={inquiry.status}
                      disabled={updatingId === inquiry.id}
                      onValueChange={(value) => updateStatus(inquiry, value as InquiryStatus)}
                    >
                      <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {statuses.map((status) => <SelectItem key={status} value={status}>{formatLabel(status)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {payments[inquiry.id] ? (
                      <div>
                        <Badge variant={payments[inquiry.id].payment_status === 'paid' ? 'default' : 'secondary'}>
                          {payments[inquiry.id].payment_status === 'paid' ? 'Paid' : 'Payment Due'}
                        </Badge>
                        <div className="mt-1 text-xs text-muted-foreground">LKR {payments[inquiry.id].amount.toFixed(2)}{payments[inquiry.id].payment_method ? ` · ${formatLabel(payments[inquiry.id].payment_method)}` : ''}</div>
                      </div>
                    ) : <span className="text-sm text-muted-foreground">Not billed</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setSelectedInquiry(inquiry)}>View</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!isLoading && filtered.length > 0 && (
            <DataTablePagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              itemsPerPage={pagination.itemsPerPage}
              onPageChange={pagination.setCurrentPage}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>Add Experience Inquiry</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Customer</Label>
              <Select value={newInquiry.customer_id} onValueChange={(value) => selectCustomer(value, 'create')}>
                <SelectTrigger><SelectValue placeholder="Select current customer or create new" /></SelectTrigger>
                <SelectContent>
                  <div className="sticky top-0 z-10 bg-popover p-2" onKeyDown={(event) => event.stopPropagation()}>
                    <Input placeholder="Search name, ID, phone, or email…" value={createCustomerSearch} onChange={(event) => setCreateCustomerSearch(event.target.value)} />
                  </div>
                  <SelectItem value="new">New customer</SelectItem>
                  {filterCustomers(createCustomerSearch).map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.name}{customer.id_number ? ` — ${customer.id_number}` : customer.phone ? ` — ${customer.phone}` : ''}</SelectItem>)}
                  {filterCustomers(createCustomerSearch).length === 0 && <div className="px-2 py-3 text-center text-sm text-muted-foreground">No customers found</div>}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Name</Label><Input value={newInquiry.name} disabled={newInquiry.customer_id !== 'new'} onChange={(e) => setNewInquiry((current) => ({ ...current, name: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={newInquiry.phone} disabled={newInquiry.customer_id !== 'new'} onChange={(e) => setNewInquiry((current) => ({ ...current, phone: e.target.value }))} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Email</Label><Input type="email" value={newInquiry.email} disabled={newInquiry.customer_id !== 'new'} onChange={(e) => setNewInquiry((current) => ({ ...current, email: e.target.value }))} /></div>
            </div>
            <div className="space-y-2"><Label>Experience</Label><Input value={newInquiry.experience_type === 'culinary_tourism' ? 'Culinary Tourism' : newInquiry.experience_type} onChange={(e) => setNewInquiry((current) => ({ ...current, experience_type: e.target.value }))} disabled /></div>
            <div className="space-y-2"><Label>Subject</Label><Input value={newInquiry.subject} onChange={(e) => setNewInquiry((current) => ({ ...current, subject: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Message / request details</Label><Textarea value={newInquiry.message} onChange={(e) => setNewInquiry((current) => ({ ...current, message: e.target.value }))} /></div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>Cancel</Button>
              <Button onClick={createInquiry} disabled={isCreating}>{isCreating ? 'Creating…' : 'Create Inquiry'}</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedInquiry)} onOpenChange={(open) => {
        if (!open && !isConfirming) {
          setSelectedInquiry(null);
          setConfirmingInquiry(null);
        }
      }}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>{billView ? 'Experience Bill' : confirmingInquiry ? 'Confirm Experience & Add to Bill' : 'Experience Inquiry Details'}</DialogTitle></DialogHeader>
          {selectedInquiry && !confirmingInquiry && !billView && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline"><Sparkles className="mr-1 h-3 w-3" />{formatLabel(selectedInquiry.experience_type)}</Badge>
                <Badge variant={statusVariant(selectedInquiry.status)}>{formatLabel(selectedInquiry.status)}</Badge>
                {payments[selectedInquiry.id] && <Badge variant={payments[selectedInquiry.id].payment_status === 'paid' ? 'default' : 'secondary'}>{payments[selectedInquiry.id].payment_status === 'paid' ? 'Paid' : 'Payment Due'}</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs font-medium uppercase text-muted-foreground">Name</p><p className="flex items-center gap-2 font-medium"><User className="h-4 w-4" />{selectedInquiry.name || '—'}</p></div>
                <div><p className="text-xs font-medium uppercase text-muted-foreground">Date</p><p className="flex items-center gap-2 text-sm"><Calendar className="h-4 w-4" />{new Date(selectedInquiry.created_at).toLocaleString()}</p></div>
              </div>
              <div><p className="text-xs font-medium uppercase text-muted-foreground">Email</p><p className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4" />{selectedInquiry.email ? <a className="text-primary hover:underline" href={`mailto:${selectedInquiry.email}`}>{selectedInquiry.email}</a> : '—'}</p></div>
              <div><p className="text-xs font-medium uppercase text-muted-foreground">Phone</p><p className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4" />{selectedInquiry.phone ? <a className="text-primary hover:underline" href={`tel:${selectedInquiry.phone}`}>{selectedInquiry.phone}</a> : '—'}</p></div>
              <div><p className="text-xs font-medium uppercase text-muted-foreground">Subject</p><p className="font-medium">{selectedInquiry.subject || '—'}</p></div>
              <div><p className="text-xs font-medium uppercase text-muted-foreground">Message</p><div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">{selectedInquiry.message || '—'}</div></div>
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                {selectedInquiry.email && (
                  <Button variant="outline" asChild><a href={`mailto:${selectedInquiry.email}?subject=Re: ${encodeURIComponent(selectedInquiry.subject || 'Your Experience Inquiry')}`}><Mail className="mr-2 h-4 w-4" />Reply via Email</a></Button>
                )}
                <Button onClick={() => openBilling(selectedInquiry)}><Sparkles className="mr-2 h-4 w-4" />{selectedInquiry.status === 'confirmed' ? 'Update Bill' : 'Confirm & Add to Bill'}</Button>
                {(selectedInquiry.status === 'confirmed' || selectedInquiry.status === 'completed') && (
                  <Button variant="secondary" onClick={() => openBill(selectedInquiry)}>View Bill</Button>
                )}
              </div>
            </div>
          )}
          {selectedInquiry && billView && billIncome && (
            <div className="space-y-5">
              <div className="flex items-start justify-between border-b pb-4">
                <div>
                  <h2 className="text-2xl font-bold">Oruthota Chalets</h2>
                  <p className="text-sm text-muted-foreground">Experience Bill · EXP-{billIncome.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <Badge variant={billIncome.payment_status === 'paid' ? 'default' : 'secondary'}>
                  {billIncome.payment_status === 'paid' ? 'Paid' : 'Payment Due'}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-xs uppercase text-muted-foreground">Billed to</p><p className="font-medium">{billIncome.customer_name || selectedInquiry.name || 'Guest'}</p></div>
                <div className="text-right"><p className="text-xs uppercase text-muted-foreground">Date</p><p>{new Date(billIncome.date).toLocaleDateString()}</p></div>
              </div>
              <div>
                <p className="mb-2 font-semibold">{billIncome.description}</p>
                <div className="divide-y rounded-md border">
                  {(billIncome.line_items || []).map((item, index) => (
                    <div key={index} className="flex justify-between gap-4 p-3 text-sm"><span>{item.description}</span><span className="whitespace-nowrap">LKR {Number(item.amount || 0).toFixed(2)}</span></div>
                  ))}
                </div>
                <div className="mt-3 flex justify-between border-t-2 pt-3 text-lg font-bold"><span>Total</span><span>LKR {Number(billIncome.amount || 0).toFixed(2)}</span></div>
              </div>
              <p className="text-sm text-muted-foreground">{billIncome.payment_status === 'paid' ? `Payment method: ${formatLabel(billIncome.payment_method)}` : 'Added to the guest consolidated bill for later payment.'}</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBillView(false)}>Back to Inquiry</Button>
                <Button variant="secondary" onClick={() => openBilling(selectedInquiry)}>Update Bill</Button>
                {billIncome.payment_status === 'add_to_bill' && billIncome.customer_id && (
                  <Button variant="secondary" onClick={() => router.push(`/dashboard/front-desk?tab=check-out&customer_id=${encodeURIComponent(billIncome.customer_id)}`)}>Open Billing & Check-Out</Button>
                )}
                <Button onClick={printBill}><Printer className="mr-2 h-4 w-4" />Print Bill</Button>
              </DialogFooter>
            </div>
          )}
          {confirmingInquiry && (
            <div className="space-y-5">
              {isLoadingBilling && <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">Loading saved pricing and payment details…</div>}
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="font-medium">{formatLabel(confirmingInquiry.experience_type)}</p>
                <p className="text-sm text-muted-foreground">The confirmed amount will appear under Experience in the guest's consolidated bill.</p>
              </div>
              <div className="space-y-2">
                <Label>Current customer</Label>
                <Select value={selectedCustomerId} onValueChange={(value) => selectCustomer(value, 'billing')}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    <div className="sticky top-0 z-10 bg-popover p-2" onKeyDown={(event) => event.stopPropagation()}>
                      <Input placeholder="Search name, ID, phone, or email…" value={billingCustomerSearch} onChange={(event) => setBillingCustomerSearch(event.target.value)} />
                    </div>
                    <SelectItem value="new">Create/match customer from inquiry details</SelectItem>
                    {filterCustomers(billingCustomerSearch).map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.name}{customer.id_number ? ` — ${customer.id_number}` : customer.phone ? ` — ${customer.phone}` : ''}</SelectItem>)}
                    {filterCustomers(billingCustomerSearch).length === 0 && <div className="px-2 py-3 text-center text-sm text-muted-foreground">No customers found</div>}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="experience-customer">Customer name</Label>
                <Input id="experience-customer" value={customerName} disabled={selectedCustomerId !== 'new'} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="experience-people">Number of people</Label>
                  <Input id="experience-people" type="number" min="1" step="1" value={people} onChange={(e) => setPeople(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="experience-price">Price per person (LKR)</Label>
                  <Input id="experience-price" type="number" min="0" step="0.01" value={pricePerPerson} onChange={(e) => setPricePerPerson(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="experience-service">Service charge (%)</Label>
                  <Input id="experience-service" type="number" min="0" step="0.01" value={serviceChargeRate} onChange={(e) => setServiceChargeRate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="experience-tax">Tax (%)</Label>
                  <Input id="experience-tax" type="number" min="0" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Other charges</Label>
                  <Button type="button" size="sm" variant="outline" onClick={() => setOtherCharges((items) => [...items, { name: '', amount: '' }])}>
                    <Plus className="mr-1 h-4 w-4" />Add charge
                  </Button>
                </div>
                {otherCharges.map((charge, index) => (
                  <div key={index} className="flex gap-2">
                    <Input placeholder="Charge name" value={charge.name} onChange={(e) => setOtherCharges((items) => items.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} />
                    <Input className="w-36" type="number" min="0" step="0.01" placeholder="Amount" value={charge.amount} onChange={(e) => setOtherCharges((items) => items.map((item, i) => i === index ? { ...item, amount: e.target.value } : item))} />
                    <Button type="button" size="icon" variant="ghost" aria-label="Remove charge" onClick={() => setOtherCharges((items) => items.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
              <div className="space-y-2 rounded-md border p-4 text-sm">
                {pricePerPerson !== '' && <div className="flex justify-between"><span>Base ({Number(people) || 0} × LKR {(Number(pricePerPerson) || 0).toFixed(2)})</span><span>LKR {baseAmount.toFixed(2)}</span></div>}
                {serviceCharge > 0 && <div className="flex justify-between"><span>Service charge ({Number(serviceChargeRate) || 0}%)</span><span>LKR {serviceCharge.toFixed(2)}</span></div>}
                {tax > 0 && <div className="flex justify-between"><span>Tax ({Number(taxRate) || 0}%)</span><span>LKR {tax.toFixed(2)}</span></div>}
                {otherCharges.map((charge, index) => charge.name && <div key={index} className="flex justify-between"><span>{charge.name}</span><span>LKR {(Number(charge.amount) || 0).toFixed(2)}</span></div>)}
                <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span>LKR {billTotal.toFixed(2)}</span></div>
              </div>
              <div className="space-y-3 rounded-md border p-4">
                <Label>Payment</Label>
                <Select value={paymentStatus} onValueChange={(value) => setPaymentStatus(value as 'add_to_bill' | 'paid')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add_to_bill">Add to guest bill — pay later</SelectItem>
                    <SelectItem value="paid">Pay now</SelectItem>
                  </SelectContent>
                </Select>
                {paymentStatus === 'paid' && (
                  <div className="space-y-2">
                    <Label>Payment method</Label>
                    <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as 'cash' | 'card')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmingInquiry(null)} disabled={isConfirming}>Back to Inquiry</Button>
                <Button onClick={confirmAndAddToBill} disabled={isConfirming || isLoadingBilling}>{isConfirming ? 'Saving…' : paymentStatus === 'paid' ? 'Save Payment' : 'Save to Bill'}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
