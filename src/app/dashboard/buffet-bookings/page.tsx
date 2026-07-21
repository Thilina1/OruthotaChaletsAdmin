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
import { Search, Mail, User, Calendar, MessageSquare, Phone, Utensils, Users as UsersIcon, Plus, Printer, Share2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { usePagination } from '@/hooks/use-pagination';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { Badge } from '@/components/ui/badge';
import type { TableBooking, TableBookingStatus, BuffetPackage } from '@/lib/types';

const statusColors: Record<TableBookingStatus, string> = {
  'pending': 'bg-yellow-500 text-white',
  'confirmed': 'bg-green-500 text-white',
  'cancelled': 'bg-red-500 text-white',
};

function formatCurrency(n: number) {
  return n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Same calc order as the Buffet Packages preview: service charge and each
// named "other charge" apply to the subtotal, then VAT applies on top of all of it.
function calcPackageCharges(pkg: BuffetPackage, guests: number) {
  const perGuest = (pkg.buffet_menu_items || []).filter(i => i.is_active).reduce((sum, i) => sum + Number(i.price || 0), 0);
  const subtotal = perGuest * guests;
  const serviceChargeAmount = subtotal * (Number(pkg.service_charge_rate) / 100);
  const otherChargeBreakdown = (pkg.other_charges || []).filter(c => c.name.trim()).map(c => ({
    ...c,
    amount: c.type === 'percentage' ? subtotal * (Number(c.value) / 100) : Number(c.value),
  }));
  const otherChargeAmount = otherChargeBreakdown.reduce((sum, c) => sum + c.amount, 0);
  const vatBase = subtotal + serviceChargeAmount + otherChargeAmount;
  const vatAmount = vatBase * (Number(pkg.vat_rate) / 100);
  const total = vatBase + vatAmount;
  return { perGuest, subtotal, serviceChargeAmount, otherChargeBreakdown, otherChargeAmount, vatAmount, total };
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
  const supabase = createClient();

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

  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('table_bookings')
        .select('*, buffet_packages ( name )')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
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
      const { error } = await supabase
        .from('table_bookings')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Success', description: `Booking status updated to ${newStatus}.` });

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

      const { error } = await supabase.from('table_bookings').update(updatePayload).eq('id', id);
      if (error) throw error;

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

      const { error } = await supabase.from('table_bookings').update(updatePayload).eq('id', id);
      if (error) throw error;

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
    setIsCreating(true);
    try {
      const pkg = packages.find(p => p.id === bookingForm.package_id);
      const charges = pkg ? calcPackageCharges(pkg, bookingForm.guests) : null;

      const { error } = await supabase.from('table_bookings').insert({
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

      if (error) throw error;
      toast({ title: 'Success', description: 'Buffet booking created.' });
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Buffet Booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto">
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
              <Textarea rows={2} value={bookingForm.comments} onChange={e => setBookingForm(p => ({ ...p, comments: e.target.value }))} />
            </div>

            {selectedFormPackage && formCharges && (
              <div className="border-t pt-3 space-y-1 text-sm">
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
            )}
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
          <div className="p-10 bg-white text-black min-h-screen font-sans">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-4xl font-extrabold tracking-tight">Oruthota Chalets</h1>
                <p className="text-sm text-gray-500 mt-1">Buffet Reservation</p>
              </div>
              <div className="text-right">
                <h2 className="text-2xl font-bold text-gray-700 uppercase tracking-widest">Booking</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Date: {new Date(printBooking.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>

            <hr className="border-t-2 border-black mb-8" />

            <div className="grid grid-cols-2 gap-6 mb-8 text-sm">
              <div>
                <p className="font-bold uppercase tracking-wider text-gray-500 mb-1 text-xs">Customer</p>
                <p className="font-semibold">{printBooking.name}</p>
                <p className="text-gray-600">{printBooking.email}</p>
                {printBooking.phone && <p className="text-gray-600">{printBooking.phone}</p>}
              </div>
              <div>
                <p className="font-bold uppercase tracking-wider text-gray-500 mb-1 text-xs">Booking Info</p>
                <p className="text-gray-700 capitalize">Meal Type: {printBooking.meal_type}</p>
                <p className="text-gray-700">Guests: {printBooking.guests}</p>
                <p className="text-gray-700 capitalize">Status: {printBooking.status}</p>
              </div>
              <div>
                <p className="font-bold uppercase tracking-wider text-gray-500 mb-1 text-xs">Package</p>
                <p className="font-semibold">{printBooking.buffet_packages?.name || 'None'}</p>
              </div>
            </div>

            {(printBooking.total_amount ?? 0) > 0 && (
              <table className="w-full text-left border-collapse text-sm mb-8">
                <tbody>
                  <tr>
                    <td className="py-2 px-3 border border-gray-300">Price per Guest</td>
                    <td className="py-2 px-3 border border-gray-300 text-right">LKR {formatCurrency(Number(printBooking.price_per_guest || 0))}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 border border-gray-300">Service Charge</td>
                    <td className="py-2 px-3 border border-gray-300 text-right">LKR {formatCurrency(Number(printBooking.service_charge_amount || 0))}</td>
                  </tr>
                  {(printBooking.other_charge_amount ?? 0) > 0 && (
                    <tr>
                      <td className="py-2 px-3 border border-gray-300">Other Charge</td>
                      <td className="py-2 px-3 border border-gray-300 text-right">LKR {formatCurrency(Number(printBooking.other_charge_amount || 0))}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-2 px-3 border border-gray-300">VAT</td>
                    <td className="py-2 px-3 border border-gray-300 text-right">LKR {formatCurrency(Number(printBooking.vat_amount || 0))}</td>
                  </tr>
                  <tr className="bg-gray-100">
                    <td className="py-2 px-3 border border-gray-300 font-bold">TOTAL</td>
                    <td className="py-2 px-3 border border-gray-300 text-right font-bold">LKR {formatCurrency(Number(printBooking.total_amount || 0))}</td>
                  </tr>
                </tbody>
              </table>
            )}

            {printBooking.comments && (
              <div className="mb-8 text-sm">
                <p className="font-bold uppercase tracking-wider text-gray-500 mb-1 text-xs">Comments</p>
                <p className="text-gray-700 whitespace-pre-wrap">{printBooking.comments}</p>
              </div>
            )}

            <p className="text-xs text-gray-400 mt-12">Booking ID: {printBooking.id}</p>
          </div>
        </div>
      )}
    </div>
  );
}
