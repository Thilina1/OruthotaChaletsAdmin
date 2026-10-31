'use client';

import { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Search, Mail, User, Calendar, MessageSquare, Phone, Utensils, Users as UsersIcon, Plus, Printer, Share2, Send } from 'lucide-react';
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { Badge } from '@/components/ui/badge';
import type { TableBooking, TableBookingStatus, BuffetPackage } from '@/lib/types';
import { PROPERTY_INFO } from '@/lib/property-info';
import { buffetInvoiceLines, buffetInvoiceNumber, calcPackageCharges, formatBookingDate, formatLkr } from '@/lib/buffet-invoice';

const statusColors: Record<TableBookingStatus, string> = {
  'pending': 'bg-yellow-500 text-white',
  'confirmed': 'bg-green-500 text-white',
  'cancelled': 'bg-red-500 text-white',
};

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

function formatCurrency(n: number) {
  return n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Reads and writes go through the admin API: the browser's public key has no
// access to table_bookings.
async function bookingsApi(method: 'GET' | 'POST' | 'PUT', body?: Record<string, any>) {
  const res = await fetch('/api/admin/buffet-bookings', {
    method,
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Request failed');
  return data;
}

const emptyBookingForm = {
  name: '',
  email: '',
  phone: '',
  date: '',
  meal_type: 'dinner',
  guests: 2,
  package_id: '',
  comments: '',
};

export default function BuffetBookingsPage() {
  const { toast } = useToast();

  const [bookings, setBookings] = useState<TableBooking[]>([]);
  const [packages, setPackages] = useState<BuffetPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<TableBooking | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [printBooking, setPrintBooking] = useState<TableBooking | null>(null);

  // Create booking dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [bookingForm, setBookingForm] = useState({ ...emptyBookingForm });
  const [isCreating, setIsCreating] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      const data = await bookingsApi('GET');
      setBookings(data.bookings || []);
    } catch (error) {
      console.error('Error fetching buffet bookings:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load buffet bookings.' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPackages = async () => {
    try {
      const res = await fetch('/api/buffet/packages');
      const data = await res.json();
      const list: BuffetPackage[] = data.packages || [];
      setPackages(list.filter(p => p.is_active));
    } catch (error) {
      console.error('Error fetching buffet packages:', error);
    }
  };

  useEffect(() => {
    fetchBookings();
    fetchPackages();
  }, []);

  const handleStatusUpdate = async (id: string, newStatus: TableBookingStatus) => {
    setIsUpdating(true);
    try {
      await bookingsApi('PUT', { id, status: newStatus });

      toast({ title: 'Success', description: `Booking status updated to ${newStatus}.` });
      window.dispatchEvent(new Event('notifications-changed'));

      // Update local state
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));
      if (selectedBooking?.id === id) {
        setSelectedBooking(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update status.' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePackageChange = async (id: string, packageId: string) => {
    const booking = bookings.find(b => b.id === id);
    if (!booking) return;
    setIsUpdating(true);
    try {
      const pkg = packages.find(p => p.id === packageId);
      const charges = pkg ? calcPackageCharges(pkg, booking.guests) : null;
      const updatePayload = pkg && charges
        ? {
            package_id: pkg.id,
            price_per_guest: charges.perGuest,
            service_charge_amount: charges.serviceChargeAmount,
            other_charge_amount: charges.otherChargeAmount,
            vat_amount: charges.vatAmount,
            total_amount: charges.total,
          }
        : {
            package_id: null,
            price_per_guest: 0,
            service_charge_amount: 0,
            other_charge_amount: 0,
            vat_amount: 0,
            total_amount: 0,
          };

      await bookingsApi('PUT', { id, ...updatePayload });

      const updated: TableBooking = {
        ...booking,
        ...updatePayload,
        package_id: updatePayload.package_id ?? undefined,
        buffet_packages: pkg ? { name: pkg.name } : undefined,
      };
      setBookings(prev => prev.map(b => b.id === id ? updated : b));
      if (selectedBooking?.id === id) setSelectedBooking(updated);
      toast({ title: 'Success', description: 'Package updated for this booking.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to update package.' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleGuestsChange = async (id: string, newGuests: number) => {
    const booking = bookings.find(b => b.id === id);
    if (!booking || newGuests < 1 || newGuests === booking.guests) return;
    setIsUpdating(true);
    try {
      const pkg = packages.find(p => p.id === booking.package_id);
      const charges = pkg ? calcPackageCharges(pkg, newGuests) : null;
      const updatePayload = charges
        ? {
            guests: newGuests,
            price_per_guest: charges.perGuest,
            service_charge_amount: charges.serviceChargeAmount,
            other_charge_amount: charges.otherChargeAmount,
            vat_amount: charges.vatAmount,
            total_amount: charges.total,
          }
        : { guests: newGuests };

      await bookingsApi('PUT', { id, ...updatePayload });

      const updated: TableBooking = { ...booking, ...updatePayload };
      setBookings(prev => prev.map(b => b.id === id ? updated : b));
      if (selectedBooking?.id === id) setSelectedBooking(updated);
      toast({ title: 'Success', description: 'Guest count updated.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to update guest count.' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePrint = (booking: TableBooking) => {
    // Commit the print-area's data to the DOM synchronously before printing —
    // a plain setState + setTimeout can race with window.print() and produce
    // a blank/empty printout since the print snapshot is taken too early.
    flushSync(() => setPrintBooking(booking));
    requestAnimationFrame(() => {
      window.print();
    });
  };

  const handleSendEmail = async (booking: TableBooking) => {
    setIsSendingEmail(true);
    try {
      const res = await fetch('/api/admin/buffet-bookings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: booking.id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Request failed');
      toast({ title: 'Email sent', description: `Invoice emailed to ${booking.email}.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Email not sent', description: error.message || 'Failed to send email.' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const bookingSummaryText = (booking: TableBooking) => {
    const lines = [
      'Oruthota Chalets - Buffet Booking',
      `Customer: ${booking.name}`,
      `Date: ${new Date(booking.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      `Meal Type: ${booking.meal_type}`,
      `Guests: ${booking.guests}`,
      `Package: ${booking.buffet_packages?.name || 'None'}`,
      `Status: ${booking.status}`,
    ];
    if ((booking.total_amount ?? 0) > 0) {
      lines.push(`Total: LKR ${formatCurrency(Number(booking.total_amount))}`);
    }
    return lines.join('\n');
  };

  const handleShare = async (booking: TableBooking) => {
    const text = bookingSummaryText(booking);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Buffet Booking', text });
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to share booking.' });
        }
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied', description: 'Booking details copied to clipboard.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Sharing is not supported on this device.' });
    }
  };

  const openCreateDialog = () => {
    setBookingForm({ ...emptyBookingForm });
    setCreateDialogOpen(true);
  };

  const handleCreateBooking = async () => {
    if (!bookingForm.name || !bookingForm.email || !bookingForm.date) {
      toast({ variant: 'destructive', title: 'Validation', description: 'Name, email, and date are required.' });
      return;
    }
    if (!isValidEmail(bookingForm.email)) {
      toast({ variant: 'destructive', title: 'Validation', description: 'Enter a valid email address.' });
      return;
    }
    setIsCreating(true);
    try {
      const pkg = packages.find(p => p.id === bookingForm.package_id);
      const charges = pkg ? calcPackageCharges(pkg, bookingForm.guests) : null;

      const result = await bookingsApi('POST', {
        name: bookingForm.name,
        email: bookingForm.email,
        phone: bookingForm.phone || null,
        date: bookingForm.date,
        meal_type: bookingForm.meal_type,
        guests: bookingForm.guests,
        comments: bookingForm.comments || null,
        status: 'pending',
        package_id: pkg?.id || null,
        price_per_guest: charges?.perGuest ?? 0,
        service_charge_amount: charges?.serviceChargeAmount ?? 0,
        other_charge_amount: charges?.otherChargeAmount ?? 0,
        vat_amount: charges?.vatAmount ?? 0,
        total_amount: charges?.total ?? 0,
      });

      toast(result.email?.sent
        ? { title: 'Success', description: `Buffet booking created. Invoice emailed to ${bookingForm.email.trim()}.` }
        : { title: 'Booking created', description: `The invoice email was not sent: ${result.email?.reason || 'unknown error'}.` });
      window.dispatchEvent(new Event('notifications-changed'));
      setCreateDialogOpen(false);
      fetchBookings();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to create booking.' });
    } finally {
      setIsCreating(false);
    }
  };

  const selectedFormPackage = packages.find(p => p.id === bookingForm.package_id);
  const formCharges = selectedFormPackage ? calcPackageCharges(selectedFormPackage, bookingForm.guests) : null;

  const filtered = bookings.filter((booking) => {
    const q = searchQuery.toLowerCase();
    return (
      booking.name?.toLowerCase().includes(q) ||
      booking.email?.toLowerCase().includes(q) ||
      booking.phone?.toLowerCase().includes(q) ||
      booking.meal_type?.toLowerCase().includes(q)
    );
  });

  const {
    currentPage,
    totalPages,
    totalItems,
    paginatedItems,
    itemsPerPage,
    setCurrentPage,
  } = usePagination(filtered, 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold">Buffet Bookings</h1>
          <p className="text-muted-foreground">Manage table reservations for buffets.</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          New Booking
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>All Bookings</CardTitle>
              <CardDescription>
                {isLoading
                  ? 'Loading…'
                  : `${totalItems} booking${totalItems !== 1 ? 's' : ''} found · ${filtered.reduce((sum, b) => sum + (b.guests || 0), 0)} guests`}
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Booking Details</TableHead>
                <TableHead>Guests</TableHead>
                <TableHead>Meal Type</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-14 text-muted-foreground">
                    <Utensils className="mx-auto h-8 w-8 mb-2 opacity-30" />
                    {searchQuery ? 'No bookings match your search.' : 'No buffet bookings yet.'}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{booking.name}</span>
                        <span className="text-xs text-muted-foreground">{booking.email}</span>
                        {booking.phone && <span className="text-xs text-muted-foreground">{booking.phone}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {new Date(booking.date).toLocaleDateString('en-US', {
                          year: 'numeric', month: 'short', day: 'numeric',
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center gap-1">
                            <UsersIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            {booking.guests}
                        </div>
                    </TableCell>
                    <TableCell>
                        <Badge variant="outline" className="capitalize">
                            {booking.meal_type}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {booking.buffet_packages?.name || <span className="text-muted-foreground italic">None</span>}
                    </TableCell>
                    <TableCell>
                      <Badge className={`capitalize ${statusColors[booking.status]}`}>
                        {booking.status}
                      </Badge>
                      {booking.room_bill && (
                        <div className="mt-1">
                          <Badge variant="outline" className={booking.room_bill.payment_status === 'paid' ? 'border-green-600 text-green-700' : 'border-primary text-primary'}>
                            {booking.room_bill.payment_status === 'paid' ? 'Paid on room bill' : 'Added to room bill'}
                          </Badge>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedBooking(booking);
                            setIsDialogOpen(true);
                          }}
                        >
                          View
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" title="Print" onClick={() => handlePrint(booking)}>
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" title="Share" onClick={() => handleShare(booking)}>
                          <Share2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {!isLoading && filtered.length > 0 && (
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          )}
        </CardContent>
      </Card>

      {/* New Booking Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>New Buffet Booking</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-2 max-h-[75vh] overflow-y-auto md:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Customer Name *</Label>
                <Input value={bookingForm.name} onChange={e => setBookingForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={bookingForm.phone} onChange={e => setBookingForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input type="email" value={bookingForm.email} onChange={e => setBookingForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Date *</Label>
                <Input type="date" value={bookingForm.date} onChange={e => setBookingForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Guests</Label>
                <Input
                  type="number"
                  min={1}
                  value={bookingForm.guests}
                  onChange={e => setBookingForm(p => ({ ...p, guests: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Meal Type</Label>
                <Select value={bookingForm.meal_type} onValueChange={(val) => setBookingForm(p => ({ ...p, meal_type: val }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="breakfast">Breakfast</SelectItem>
                    <SelectItem value="lunch">Lunch</SelectItem>
                    <SelectItem value="dinner">Dinner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Buffet Package</Label>
                <Select
                  value={bookingForm.package_id || 'none'}
                  onValueChange={(val) => setBookingForm(p => ({ ...p, package_id: val === 'none' ? '' : val }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select package" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No package</SelectItem>
                    {packages.map(pkg => (
                      <SelectItem key={pkg.id} value={pkg.id}>{pkg.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Comments</Label>
              <Textarea rows={3} value={bookingForm.comments} onChange={e => setBookingForm(p => ({ ...p, comments: e.target.value }))} />
            </div>
          </div>

          <div className="rounded-md border bg-muted/40 p-4 text-sm md:sticky md:top-0 md:self-start">
            <h4 className="font-semibold mb-3">Charge Summary</h4>
            {selectedFormPackage && formCharges ? (
              <div className="space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Price per Guest</span><span>LKR {formatCurrency(formCharges.perGuest)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal ({bookingForm.guests} guests)</span><span>LKR {formatCurrency(formCharges.perGuest * bookingForm.guests)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Service Charge ({Number(selectedFormPackage.service_charge_rate).toFixed(2)}%)</span><span>LKR {formatCurrency(formCharges.serviceChargeAmount)}</span></div>
                {formCharges.otherChargeBreakdown.map(c => (
                  <div key={c.id} className="flex justify-between">
                    <span className="text-muted-foreground">{c.name} ({c.type === 'percentage' ? `${Number(c.value).toFixed(2)}%` : 'fixed'})</span>
                    <span>LKR {formatCurrency(c.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between"><span className="text-muted-foreground">VAT ({Number(selectedFormPackage.vat_rate).toFixed(2)}%)</span><span>LKR {formatCurrency(formCharges.vatAmount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total (per set)</span><span>LKR {formatCurrency(formCharges.total / bookingForm.guests)}</span></div>
                <div className="flex justify-between font-semibold pt-1 border-t"><span>Estimated Total</span><span>LKR {formatCurrency(formCharges.total)}</span></div>
              </div>
            ) : (
              <p className="text-muted-foreground">Select a buffet package to see the estimated charges.</p>
            )}
          </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateBooking} disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Booking'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Booking Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 pr-6">
              <DialogTitle>Booking Details</DialogTitle>
              {selectedBooking && (
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" title="Print" onClick={() => handlePrint(selectedBooking)}>
                    <Printer className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" title="Share" onClick={() => handleShare(selectedBooking)}>
                    <Share2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" title="Email invoice to customer" disabled={isSendingEmail} onClick={() => handleSendEmail(selectedBooking)}>
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer Name</p>
                  <p className="font-medium flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {selectedBooking.name}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Booking Date</p>
                  <p className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {new Date(selectedBooking.date).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'long', day: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</p>
                    <p className="text-sm flex items-center gap-2 truncate">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${selectedBooking.email}`} className="text-primary hover:underline">
                        {selectedBooking.email}
                    </a>
                    </p>
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Phone</p>
                    <p className="text-sm flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {selectedBooking.phone || '—'}
                    </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Meal Type</p>
                    <p className="font-medium capitalize">{selectedBooking.meal_type}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Guests</p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        disabled={isUpdating}
                        className="h-8 w-20"
                        defaultValue={selectedBooking.guests}
                        key={selectedBooking.id + selectedBooking.guests}
                        onBlur={(e) => handleGuestsChange(selectedBooking.id, parseInt(e.target.value) || selectedBooking.guests)}
                      />
                      <span className="text-sm text-muted-foreground">People</span>
                    </div>
                </div>
              </div>

              <div className="space-y-1">
                {selectedBooking.room_bill && (
                  <div className="mb-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                    <p className="font-medium">{selectedBooking.room_bill.payment_status === 'paid' ? 'Paid on the room bill' : 'Added to the room bill'}{selectedBooking.room_bill.room_number ? ` · ${selectedBooking.room_bill.room_number}` : ''}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedBooking.room_bill.invoice_number ? `${selectedBooking.room_bill.invoice_number} · ` : ''}Charged to the guest's chalet stay and paid at check-out. Changing the package or guests here does not change that charge.
                    </p>
                  </div>
                )}
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Buffet Package</p>
                <Select
                  disabled={isUpdating}
                  value={selectedBooking.package_id || 'none'}
                  onValueChange={(val) => handlePackageChange(selectedBooking.id, val === 'none' ? '' : val)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select package" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No package</SelectItem>
                    {packages.map(pkg => (
                      <SelectItem key={pkg.id} value={pkg.id}>{pkg.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedBooking.package_id && (selectedBooking.total_amount ?? 0) > 0 && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Price per Guest</span><span>LKR {formatCurrency(Number(selectedBooking.price_per_guest || 0))}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Service Charge</span><span>LKR {formatCurrency(Number(selectedBooking.service_charge_amount || 0))}</span></div>
                  {(selectedBooking.other_charge_amount ?? 0) > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Other Charge</span><span>LKR {formatCurrency(Number(selectedBooking.other_charge_amount || 0))}</span></div>
                  )}
                  <div className="flex justify-between"><span className="text-muted-foreground">VAT</span><span>LKR {formatCurrency(Number(selectedBooking.vat_amount || 0))}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total (per set)</span><span>LKR {formatCurrency(Number(selectedBooking.total_amount || 0) / Math.max(1, selectedBooking.guests || 1))}</span></div>
                  <div className="flex justify-between font-semibold pt-1 border-t"><span>Total</span><span>LKR {formatCurrency(Number(selectedBooking.total_amount || 0))}</span></div>
                </div>
              )}

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
                <Select
                  disabled={isUpdating}
                  value={selectedBooking.status}
                  onValueChange={(val) => handleStatusUpdate(selectedBooking.id, val as TableBookingStatus)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Update status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Comments</p>
                <div className="rounded-md border bg-muted/30 p-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {selectedBooking.comments || 'No comments provided.'}
                </div>
              </div>

              <div className="pt-4 border-t text-[10px] text-muted-foreground flex justify-between">
                  <span>ID: {selectedBooking.id}</span>
                  <span>Created: {new Date(selectedBooking.created_at || '').toLocaleString()}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hidden Booking Print Area */}
      {printBooking && (
        <div id="print-area" className="hidden print:block">
          <BuffetInvoicePrint booking={printBooking} />
        </div>
      )}
    </div>
  );
}

// Printable A4 buffet invoice, styled like the Front Desk guest invoice.
function BuffetInvoicePrint({ booking }: { booking: TableBooking }) {
  const { lines, guests, meal, total } = buffetInvoiceLines(booking);
  const statusStyle = {
    confirmed: 'border-green-700 text-green-700',
    pending: 'border-amber-600 text-amber-600',
    cancelled: 'border-red-700 text-red-700',
  }[booking.status];

  return (
    <div className="mx-auto max-w-[800px] bg-white p-8 text-[12px] leading-snug text-gray-900">
      {/* Header */}
      <div className="flex items-start justify-between border-b-4 border-green-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-wide text-green-900">{PROPERTY_INFO.name}</h1>
          <p className="mt-1 text-gray-600">{PROPERTY_INFO.address}</p>
          <p className="text-gray-600">Tel: {PROPERTY_INFO.phones.join(' / ')}</p>
          <p className="text-gray-600">{PROPERTY_INFO.email} · {PROPERTY_INFO.website}</p>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold uppercase tracking-widest">Buffet Invoice</h2>
          <p className="mt-1"><span className="text-gray-500">No:</span> <span className="font-mono font-semibold">{buffetInvoiceNumber(booking)}</span></p>
          <p><span className="text-gray-500">Issued:</span> {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
          <p className={`mt-2 inline-block rounded border-2 px-3 py-0.5 text-sm font-bold uppercase tracking-widest ${statusStyle}`}>
            {booking.status}
          </p>
        </div>
      </div>

      {/* Customer and booking */}
      <div className="mt-5 grid grid-cols-2 gap-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Bill To</p>
          <p className="mt-1 text-sm font-semibold">{booking.name}</p>
          {booking.phone && <p className="text-gray-600">{booking.phone}</p>}
          <p className="text-gray-600">{booking.email}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Booking</p>
          <p className="mt-1 text-sm font-semibold">{formatBookingDate(booking.date)}</p>
          <p className="text-gray-600">{meal} · {guests} guest{guests === 1 ? '' : 's'}</p>
          <p className="text-gray-600">{booking.buffet_packages?.name || 'Package to be confirmed'}</p>
        </div>
      </div>

      {/* Charges */}
      <table className="mt-6 w-full border-collapse">
        <thead>
          <tr className="border-y-2 border-gray-800 text-left text-[10px] uppercase tracking-wider">
            <th className="py-2 pr-2">Description</th>
            <th className="w-16 py-2 text-right">Qty</th>
            <th className="w-32 py-2 text-right">Rate</th>
            <th className="w-36 py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={index} className="border-b border-gray-200 align-top">
              <td className="py-2 pr-2">
                <p className="font-medium">{line.description}</p>
                {line.detail && <p className="text-[11px] text-gray-500">{line.detail}</p>}
              </td>
              <td className="py-2 text-right">{line.quantity ?? ''}</td>
              <td className="py-2 text-right whitespace-nowrap">{line.rate != null ? formatLkr(line.rate) : ''}</td>
              <td className="py-2 text-right font-medium whitespace-nowrap">{formatLkr(line.amount)}</td>
            </tr>
          ))}
          {lines.length === 0 && (
            <tr><td colSpan={4} className="py-4 text-center text-gray-500">No package selected yet. Charges will be confirmed by our team.</td></tr>
          )}
        </tbody>
      </table>

      {/* Totals */}
      {lines.length > 0 && (
        <div className="mt-4 flex justify-end">
          <div className="w-80">
            <div className="flex justify-between gap-3 py-0.5 text-gray-700">
              <span>Per guest (incl. charges)</span>
              <span className="whitespace-nowrap">{formatLkr(total / guests)}</span>
            </div>
            <div className="mt-2 flex justify-between border-y-2 border-gray-800 py-2 text-base font-bold text-green-800">
              <span>Total</span>
              <span>{formatLkr(total)}</span>
            </div>
          </div>
        </div>
      )}

      {booking.comments && (
        <div className="mt-6">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-gray-700">{booking.comments}</p>
        </div>
      )}

      {/* Signatures */}
      <div className="mt-14 grid grid-cols-2 gap-16 text-center text-[11px] text-gray-600">
        <div className="border-t border-gray-400 pt-1">Customer Signature</div>
        <div className="border-t border-gray-400 pt-1">Authorised By</div>
      </div>

      <div className="mt-10 border-t pt-3 text-center text-[11px] text-gray-500">
        <p className="font-semibold text-gray-700">Thank you for dining with us at {PROPERTY_INFO.name}.</p>
        <p>{PROPERTY_INFO.address} · {PROPERTY_INFO.phones[0]} · {PROPERTY_INFO.email}</p>
      </div>
    </div>
  );
}
