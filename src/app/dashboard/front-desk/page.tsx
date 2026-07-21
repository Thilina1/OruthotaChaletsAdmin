'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Printer, CheckCircle2, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Reservation, ConsolidatedBill, ChaletBooking } from '@/lib/types';

export default function FrontDeskPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('check-in');
  
  // Check-In State
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [checkedInReservations, setCheckedInReservations] = useState<Reservation[]>([]);
  const [chaletArrivals, setChaletArrivals] = useState<ChaletBooking[]>([]);
  const [chaletInHouse, setChaletInHouse] = useState<ChaletBooking[]>([]);
  const [historyReservations, setHistoryReservations] = useState<Reservation[]>([]);
  const [historyChalet, setHistoryChalet] = useState<ChaletBooking[]>([]);
  const [resolvableCustomerNames, setResolvableCustomerNames] = useState<Set<string>>(new Set());
  const [isLoadingReservations, setIsLoadingReservations] = useState(true);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [selectedChaletBooking, setSelectedChaletBooking] = useState<ChaletBooking | null>(null);
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);

  // Arrivals search & filter
  const [arrivalSearch, setArrivalSearch] = useState('');
  const [arrivalTypeFilter, setArrivalTypeFilter] = useState<'all' | 'reservation' | 'chalet'>('all');

  // In-house search & filter
  const [inHouseSearch, setInHouseSearch] = useState('');
  const [inHouseTypeFilter, setInHouseTypeFilter] = useState<'all' | 'reservation' | 'chalet'>('all');

  // History search, date range & filter
  const [historySearch, setHistorySearch] = useState('');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | 'reservation' | 'chalet'>('all');

  // Guest details view
  const [viewGuestRow, setViewGuestRow] = useState<ArrivalRow | null>(null);
  const [isGuestDetailOpen, setIsGuestDetailOpen] = useState(false);
  const [viewGuestCustomer, setViewGuestCustomer] = useState<any | null>(null);
  const [isLoadingGuestDetail, setIsLoadingGuestDetail] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [address, setAddress] = useState('');
  const [isLoyalty, setIsLoyalty] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  // Billing State
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerForBill, setSelectedCustomerForBill] = useState<any | null>(null);
  const [billData, setBillData] = useState<ConsolidatedBill | null>(null);
  const [isLoadingBill, setIsLoadingBill] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [isSettling, setIsSettling] = useState(false);
  const [isCheckingOutBill, setIsCheckingOutBill] = useState(false);
  const [cashReceived, setCashReceived] = useState('');

  // Add Other Charge to bill
  const [otherChargeDesc, setOtherChargeDesc] = useState('');
  const [otherChargeAmount, setOtherChargeAmount] = useState('');
  const [isAddingCharge, setIsAddingCharge] = useState(false);

  // Quick check-out from the Checked-In Guests list
  const [checkoutRow, setCheckoutRow] = useState<ArrivalRow | null>(null);
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
  const [checkoutPreview, setCheckoutPreview] = useState<ConsolidatedBill | null>(null);
  const [isLoadingCheckoutPreview, setIsLoadingCheckoutPreview] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  useEffect(() => {
    if (activeTab === 'check-in' || activeTab === 'in-house' || activeTab === 'history') {
      fetchReservations();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'check-out' && customerSearch.length > 1) {
      const delayDebounceFn = setTimeout(() => {
        searchCustomers();
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [customerSearch, activeTab]);

  const fetchReservations = async () => {
    setIsLoadingReservations(true);
    try {
      const [resData, chaletData, customersData] = await Promise.all([
        fetch('/api/admin/reservations?status=confirmed,pending,checked-in').then(r => r.json()),
        fetch('/api/chalet/bookings').then(r => r.json()),
        fetch('/api/admin/customers').then(r => r.json()),
      ]);

      const allRes: Reservation[] = resData.reservations || [];
      setReservations(allRes.filter(r => r.status === 'confirmed' || r.status === 'pending' || r.status === 'booked'));
      setCheckedInReservations(allRes.filter(r => r.status === 'checked-in'));

      const allChalet: ChaletBooking[] = chaletData.bookings || [];
      setChaletArrivals(allChalet.filter(b => b.status === 'pending' || b.status === 'confirmed'));
      setChaletInHouse(allChalet.filter(b => b.status === 'checked_in'));

      setHistoryReservations(allRes.filter(r => r.status === 'completed' || r.status === 'checked-out' || r.status === 'cancelled'));
      setHistoryChalet(allChalet.filter(b => b.status === 'checked_out' || b.status === 'cancelled'));

      const names: string[] = (customersData.customers || []).map((c: any) => c.name?.trim().toLowerCase()).filter(Boolean);
      setResolvableCustomerNames(new Set(names));
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingReservations(false);
    }
  };

  const searchCustomers = async () => {
    try {
      const res = await fetch(`/api/admin/customers?search=${encodeURIComponent(customerSearch)}`);
      const data = await res.json();
      setCustomers(data.customers || []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleOpenCheckIn = (res: Reservation) => {
    setSelectedReservation(res);
    setSelectedChaletBooking(null);
    setCustomerName(res.guest_name || '');
    setEmail(res.guest_email || '');
    setPhone('');
    setIdNumber('');
    setAddress('');
    setIsLoyalty(false);
    setIsCheckInModalOpen(true);
  };

  const handleOpenChaletCheckIn = (booking: ChaletBooking) => {
    setSelectedChaletBooking(booking);
    setSelectedReservation(null);
    setCustomerName(booking.customer_name || '');
    setEmail(booking.customer_email || '');
    setPhone(booking.customer_phone || '');
    setIdNumber('');
    setAddress('');
    setIsLoyalty(false);
    setIsCheckInModalOpen(true);
  };

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCheckingIn(true);
    try {
      if (selectedChaletBooking) {
        // Chalet booking check-in — update status to checked_in, and register
        // the guest in the customers table (and loyalty list, if requested).
        const [statusRes, registerRes] = await Promise.all([
          fetch('/api/chalet/bookings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: selectedChaletBooking.id, status: 'checked_in' }),
          }).then(r => r.json()),
          fetch('/api/admin/front-desk/check-in', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customer_name: customerName,
              phone,
              email,
              id_number: idNumber,
              address,
              is_loyalty: isLoyalty,
            }),
          }).then(r => r.json()),
        ]);
        if (statusRes.error) throw new Error(statusRes.error);
        if (registerRes.error) throw new Error(registerRes.error);
        toast({ title: 'Checked In', description: `${customerName} has been checked in to Chalet ${selectedChaletBooking.chalet_rooms?.room_number ?? ''}.` });
      } else if (selectedReservation) {
        const res = await fetch('/api/admin/front-desk/check-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservation_id: selectedReservation.id,
            customer_name: customerName,
            phone,
            email,
            id_number: idNumber,
            address,
            is_loyalty: isLoyalty,
          }),
        });
        if (!res.ok) throw new Error('Check-in failed');
        toast({ title: 'Checked In', description: 'Guest has been successfully checked in and registered.' });
      }
      setIsCheckInModalOpen(false);
      fetchReservations();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleSelectCustomerForBill = async (customer: any) => {
    setSelectedCustomerForBill(customer);
    setCashReceived('');
    setIsLoadingBill(true);
    try {
      const res = await fetch(`/api/admin/front-desk/billing?customer_id=${customer.id}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setBillData(data.bill);
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Error", description: error.message });
    } finally {
      setIsLoadingBill(false);
    }
  };

  const handleAddOtherCharge = async () => {
    if (!billData || !otherChargeDesc.trim() || !otherChargeAmount) return;
    setIsAddingCharge(true);
    try {
      const res = await fetch('/api/admin/service-incomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: otherChargeDesc.trim(),
          amount: parseFloat(otherChargeAmount) || 0,
          service_type: 'Other',
          date: new Date().toISOString().split('T')[0],
          customer_name: billData.customer.name,
          payment_status: 'add_to_bill',
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      toast({ title: 'Charge Added', description: `${otherChargeDesc.trim()} added to the bill.` });
      setOtherChargeDesc('');
      setOtherChargeAmount('');
      handleSelectCustomerForBill(billData.customer);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsAddingCharge(false);
    }
  };

  // Resolves the customers-table record behind an in-house row. Reservations
  // carry customer_id directly; chalet bookings don't, so fall back to a name
  // lookup (set during check-in registration).
  const resolveCustomerForRow = async (row: ArrivalRow): Promise<{ id: string; name: string } | null> => {
    if (row.type === 'reservation') {
      return row.item.customer_id ? { id: row.item.customer_id, name: row.item.guest_name } : null;
    }
    try {
      const res = await fetch(`/api/admin/customers?search=${encodeURIComponent(row.item.customer_name)}`);
      const data = await res.json();
      const match = (data.customers || []).find(
        (c: any) => c.name?.trim().toLowerCase() === row.item.customer_name.trim().toLowerCase()
      );
      return match ? { id: match.id, name: match.name } : null;
    } catch {
      return null;
    }
  };

  // Jumps straight from a Checked-In Guests row to their consolidated bill on
  // the Billing & Check-Out tab, loading it immediately instead of leaving
  // staff to search/click the customer manually.
  const handleMoveToBill = async (row: ArrivalRow) => {
    setActiveTab('check-out');
    const customer = await resolveCustomerForRow(row);
    if (customer) {
      handleSelectCustomerForBill(customer);
    } else {
      setCustomerSearch(row.type === 'reservation' ? row.item.guest_name : row.item.customer_name);
    }
  };

  const openCheckoutConfirm = async (row: ArrivalRow) => {
    setCheckoutRow(row);
    setCheckoutDialogOpen(true);
    setCheckoutPreview(null);
    setIsLoadingCheckoutPreview(true);
    try {
      const customer = await resolveCustomerForRow(row);
      if (!customer) {
        // No customers-table record to check a bill against — quietly fall
        // back to Move to Bill instead of surfacing an alarming error toast.
        setCheckoutDialogOpen(false);
        handleMoveToBill(row);
        return;
      }
      const res = await fetch(`/api/admin/front-desk/billing?customer_id=${customer.id}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCheckoutPreview(data.bill);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to load guest bill.' });
      setCheckoutDialogOpen(false);
    } finally {
      setIsLoadingCheckoutPreview(false);
    }
  };

  const handleConfirmCheckout = async () => {
    if (!checkoutPreview) return;
    setIsCheckingOut(true);
    try {
      const res = await fetch('/api/admin/front-desk/settle-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: checkoutPreview.customer.id, mode: 'checkout' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to check out guest');

      toast({ title: 'Checked Out', description: `${checkoutPreview.customer.name} has been checked out.` });
      setCheckoutDialogOpen(false);
      setCheckoutRow(null);
      setCheckoutPreview(null);
      fetchReservations();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Paying settles every outstanding charge but keeps the guest checked in —
  // Check Out is a deliberate separate step, only enabled once nothing is
  // left owing.
  const handlePayBill = async () => {
    if (!billData) return;
    setIsSettling(true);
    try {
      const res = await fetch('/api/admin/front-desk/settle-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: billData.customer.id,
          payment_method: paymentMethod,
          mode: 'pay',
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to settle bill');

      toast({ title: "Bill Paid", description: "All outstanding balances have been marked as paid. You can now check out the guest." });
      setCashReceived('');
      handleSelectCustomerForBill(billData.customer);
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Error", description: error.message });
    } finally {
      setIsSettling(false);
    }
  };

  const handleCheckOutFromBill = async () => {
    if (!billData) return;
    setIsCheckingOutBill(true);
    try {
      const res = await fetch('/api/admin/front-desk/settle-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: billData.customer.id,
          mode: 'checkout',
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to check out guest');

      // Print before clearing
      window.print();

      toast({ title: "Checked Out", description: `${billData.customer.name} has been checked out.` });
      setBillData(null);
      setSelectedCustomerForBill(null);
      setCashReceived('');
      fetchReservations();
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Error", description: error.message });
    } finally {
      setIsCheckingOutBill(false);
    }
  };

  const handleViewGuest = async (row: ArrivalRow) => {
    setViewGuestRow(row);
    setViewGuestCustomer(null);
    setIsGuestDetailOpen(true);

    if (row.type === 'reservation' && row.item.customer_id) {
      setIsLoadingGuestDetail(true);
      try {
        const res = await fetch(`/api/admin/customers?id=${row.item.customer_id}`);
        const data = await res.json();
        setViewGuestCustomer(data.customers?.[0] || null);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoadingGuestDetail(false);
      }
    }
  };

  type ArrivalRow =
    | { type: 'reservation'; item: Reservation }
    | { type: 'chalet'; item: ChaletBooking };

  const matchesRow = (row: ArrivalRow, search: string, typeFilter: 'all' | 'reservation' | 'chalet') => {
    if (typeFilter !== 'all' && row.type !== typeFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    if (row.type === 'reservation') {
      return (
        row.item.guest_name?.toLowerCase().includes(q) ||
        row.item.room?.title?.toLowerCase().includes(q)
      );
    }
    return (
      row.item.customer_name?.toLowerCase().includes(q) ||
      row.item.booking_ref?.toLowerCase().includes(q) ||
      row.item.chalet_rooms?.name?.toLowerCase().includes(q) ||
      row.item.chalet_rooms?.room_number?.toLowerCase().includes(q)
    );
  };

  const arrivalRows: ArrivalRow[] = [
    ...reservations.map((item): ArrivalRow => ({ type: 'reservation', item })),
    ...chaletArrivals.map((item): ArrivalRow => ({ type: 'chalet', item })),
  ]
    .sort((a, b) => new Date(a.item.check_in_date).getTime() - new Date(b.item.check_in_date).getTime())
    .filter((row) => matchesRow(row, arrivalSearch, arrivalTypeFilter));

  // Only show guests we can actually check out / bill — i.e. ones with a
  // resolvable customers-table record (reservations always get one during
  // check-in; chalet bookings only do if they were checked in through the
  // front-desk flow rather than have their status edited directly).
  const inHouseRows: ArrivalRow[] = [
    ...checkedInReservations.filter(r => !!r.customer_id).map((item): ArrivalRow => ({ type: 'reservation', item })),
    ...chaletInHouse
      .filter(b => resolvableCustomerNames.has(b.customer_name?.trim().toLowerCase()))
      .map((item): ArrivalRow => ({ type: 'chalet', item })),
  ]
    .sort((a, b) => new Date(a.item.check_in_date).getTime() - new Date(b.item.check_in_date).getTime())
    .filter((row) => matchesRow(row, inHouseSearch, inHouseTypeFilter));

  const rowPrice = (row: ArrivalRow) => row.type === 'reservation' ? Number(row.item.total_cost || 0) : Number(row.item.grand_total || 0);

  const historyRows: ArrivalRow[] = [
    ...historyReservations.map((item): ArrivalRow => ({ type: 'reservation', item })),
    ...historyChalet.map((item): ArrivalRow => ({ type: 'chalet', item })),
  ]
    .sort((a, b) => new Date(b.item.check_out_date).getTime() - new Date(a.item.check_out_date).getTime())
    .filter((row) => matchesRow(row, historySearch, historyTypeFilter))
    .filter((row) => !historyFrom || row.item.check_out_date >= historyFrom)
    .filter((row) => !historyTo || row.item.check_out_date <= historyTo);

  const historyTotal = historyRows.reduce((sum, row) => sum + rowPrice(row), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto print:p-0 print:max-w-none">
      <div className="flex justify-between items-center mb-6 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Front Desk</h1>
          <p className="text-gray-500 mt-1">Manage check-ins, check-outs, and consolidated billing.</p>
        </div>
      </div>

      <div className="print:hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="check-in">Arrivals & Check-In</TabsTrigger>
            <TabsTrigger value="in-house">In-House Guests</TabsTrigger>
            <TabsTrigger value="check-out">Billing & Check-Out</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="check-in">
            <div className="bg-white rounded-lg shadow border p-4">
              <h2 className="text-lg font-semibold mb-4">
                Pending Arrivals
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({arrivalRows.length} total)
                </span>
              </h2>
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by guest name, room, or chalet..."
                    value={arrivalSearch}
                    onChange={(e) => setArrivalSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={arrivalTypeFilter} onValueChange={(val: any) => setArrivalTypeFilter(val)}>
                  <SelectTrigger className="sm:w-48">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="reservation">Reservation</SelectItem>
                    <SelectItem value="chalet">Chalet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isLoadingReservations ? (
                <p className="text-muted-foreground py-8 text-center">Loading reservations...</p>
              ) : reservations.length === 0 && chaletArrivals.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">No pending arrivals.</p>
              ) : arrivalRows.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">No arrivals match your search/filter.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Guest Name</TableHead>
                      <TableHead>Room / Chalet</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead>Check-out</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {arrivalRows.map((row) => row.type === 'reservation' ? (
                      <TableRow key={`res-${row.item.id}`}>
                        <TableCell><Badge variant="outline">Reservation</Badge></TableCell>
                        <TableCell className="font-medium">{row.item.guest_name}</TableCell>
                        <TableCell>{row.item.room?.title || 'Unassigned'}</TableCell>
                        <TableCell className="text-muted-foreground">—</TableCell>
                        <TableCell>{new Date(row.item.check_in_date).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(row.item.check_out_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => handleOpenCheckIn(row.item)}
                            disabled={!row.item.room}
                            title={!row.item.room ? 'Assign a room before checking in' : undefined}
                          >
                            Check In
                          </Button>
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow key={`chalet-${row.item.id}`}>
                        <TableCell><Badge className="bg-amber-100 text-amber-800 border-amber-200">Chalet</Badge></TableCell>
                        <TableCell className="font-medium">
                          {row.item.customer_name}
                          <div className="text-xs text-muted-foreground">{row.item.booking_ref}</div>
                        </TableCell>
                        <TableCell>
                          {row.item.chalet_rooms
                            ? `Chalet ${row.item.chalet_rooms.room_number} — ${row.item.chalet_rooms.name}`
                            : <span className="text-muted-foreground italic">Unassigned</span>}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.item.chalet_packages?.name || '—'}
                          {row.item.chalet_occupancy_types && (
                            <div className="text-xs text-muted-foreground">{row.item.chalet_occupancy_types.name}</div>
                          )}
                        </TableCell>
                        <TableCell>{new Date(row.item.check_in_date).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(row.item.check_out_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => handleOpenChaletCheckIn(row.item)}
                            disabled={!row.item.chalet_rooms}
                            title={!row.item.chalet_rooms ? 'Assign a chalet before checking in' : undefined}
                          >
                            Check In
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          <TabsContent value="in-house">
            <div className="bg-white rounded-lg shadow border p-4">
              <h2 className="text-lg font-semibold mb-4">
                Checked-In Guests
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({inHouseRows.length} total)
                </span>
              </h2>
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by guest name, room, or chalet..."
                    value={inHouseSearch}
                    onChange={(e) => setInHouseSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={inHouseTypeFilter} onValueChange={(val: any) => setInHouseTypeFilter(val)}>
                  <SelectTrigger className="sm:w-48">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="reservation">Reservation</SelectItem>
                    <SelectItem value="chalet">Chalet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isLoadingReservations ? (
                <p className="text-muted-foreground py-8 text-center">Loading guests...</p>
              ) : checkedInReservations.length === 0 && chaletInHouse.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">No guests are currently checked in.</p>
              ) : inHouseRows.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">No guests match your search/filter.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Guest Name</TableHead>
                      <TableHead>Room / Chalet</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead>Check-out</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inHouseRows.map((row) => row.type === 'reservation' ? (
                      <TableRow key={`res-${row.item.id}`}>
                        <TableCell><Badge variant="outline">Reservation</Badge></TableCell>
                        <TableCell className="font-medium">{row.item.guest_name}</TableCell>
                        <TableCell>{row.item.room?.title || 'Unassigned'}</TableCell>
                        <TableCell>
                          <div>{new Date(row.item.check_in_date).toLocaleDateString()}</div>
                          {row.item.check_in_time && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {new Date(row.item.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{new Date(row.item.check_out_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleViewGuest(row)}>
                              View
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleMoveToBill(row)}>
                              Move to Bill
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => openCheckoutConfirm(row)}
                              disabled={Number(row.item.total_cost) > 0 && row.item.payment_status !== 'paid'}
                              title={Number(row.item.total_cost) > 0 && row.item.payment_status !== 'paid' ? 'Pay the bill before checking out' : undefined}
                            >
                              Check Out
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow key={`chalet-${row.item.id}`}>
                        <TableCell><Badge className="bg-amber-100 text-amber-800 border-amber-200">Chalet</Badge></TableCell>
                        <TableCell className="font-medium">
                          {row.item.customer_name}
                          <div className="text-xs text-muted-foreground">{row.item.booking_ref}</div>
                        </TableCell>
                        <TableCell>
                          {row.item.chalet_rooms
                            ? `Chalet ${row.item.chalet_rooms.room_number}`
                            : <span className="text-muted-foreground italic">Unassigned</span>}
                        </TableCell>
                        <TableCell>{new Date(row.item.check_in_date).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(row.item.check_out_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end items-center gap-2">
                            <Badge className="bg-green-100 text-green-800 border-green-200">In House</Badge>
                            <Button size="sm" variant="outline" onClick={() => handleViewGuest(row)}>
                              View
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleMoveToBill(row)}>
                              Move to Bill
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => openCheckoutConfirm(row)}
                              disabled={Number(row.item.grand_total) > 0 && row.item.payment_status !== 'paid'}
                              title={Number(row.item.grand_total) > 0 && row.item.payment_status !== 'paid' ? 'Pay the bill before checking out' : undefined}
                            >
                              Check Out
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          <TabsContent value="check-out">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="col-span-1 bg-white rounded-lg shadow border p-4">
                <h2 className="text-lg font-semibold mb-4">Find Checked-In Guest</h2>
                <Input 
                  placeholder="Search by name, ID, or phone..." 
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="mb-4"
                />
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {customers.map(c => (
                    <div 
                      key={c.id} 
                      className={`p-3 border rounded-md cursor-pointer hover:bg-muted ${selectedCustomerForBill?.id === c.id ? 'bg-muted border-primary' : ''}`}
                      onClick={() => handleSelectCustomerForBill(c)}
                    >
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.phone || c.id_number || 'No contact info'}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="col-span-1 md:col-span-2">
                {isLoadingBill ? (
                  <div className="bg-white rounded-lg shadow border p-8 text-center text-muted-foreground">
                    Calculating consolidated bill...
                  </div>
                ) : billData ? (
                  <div className="bg-white rounded-lg shadow border p-6">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h2 className="text-2xl font-bold">Consolidated Bill</h2>
                        <p className="text-muted-foreground">Customer: {billData.customer.name}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-primary">LKR {billData.totalOutstanding.toFixed(2)}</div>
                        <p className="text-sm text-muted-foreground">Total Outstanding</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {billData.reservations.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-lg border-b pb-2 mb-3">Room Charges</h3>
                          <Table>
                            <TableBody>
                              {billData.reservations.map(res => (
                                <TableRow key={res.id}>
                                  <TableCell>{res.room?.title || 'Room'} ({new Date(res.check_in_date).toLocaleDateString()} to {new Date(res.check_out_date).toLocaleDateString()})</TableCell>
                                  <TableCell className="text-right">LKR {Number(res.total_cost || 0).toFixed(2)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      {billData.chaletBookings.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-lg border-b pb-2 mb-3">Chalet Charges</h3>
                          <Table>
                            <TableBody>
                              {billData.chaletBookings.map(cb => (
                                <TableRow key={cb.id}>
                                  <TableCell>
                                    <div>
                                      {cb.chalet_rooms ? `Chalet ${cb.chalet_rooms.room_number}` : 'Chalet'} — {cb.chalet_packages?.name || 'No package'}
                                      {' '}({new Date(cb.check_in_date).toLocaleDateString()} to {new Date(cb.check_out_date).toLocaleDateString()})
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      Package price: LKR {Number(cb.rate_per_night || 0).toFixed(2)} / night × {cb.nights} night{cb.nights !== 1 ? 's' : ''} + {cb.service_charge_pct}% service charge
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">LKR {Number(cb.grand_total || 0).toFixed(2)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      {billData.orders.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-lg border-b pb-2 mb-3">Restaurant Orders</h3>
                          <Table>
                            <TableBody>
                              {billData.orders.map(ord => (
                                <TableRow key={ord.id}>
                                  <TableCell>Order #{ord.id.substring(0,8).toUpperCase()} ({new Date(ord.created_at || '').toLocaleDateString()})</TableCell>
                                  <TableCell className="text-right">LKR {Number(ord.total_price || 0).toFixed(2)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      {billData.serviceIncomes.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-lg border-b pb-2 mb-3">Extra Services</h3>
                          <Table>
                            <TableBody>
                              {billData.serviceIncomes.map(svc => (
                                <TableRow key={svc.id}>
                                  <TableCell>{svc.service_type}: {svc.description} ({new Date(svc.date).toLocaleDateString()})</TableCell>
                                  <TableCell className="text-right">LKR {Number(svc.amount || 0).toFixed(2)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      <div className="pt-6 border-t print:hidden">
                        <h3 className="font-semibold text-lg mb-3">Add Other Charge</h3>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Input
                            placeholder="Description (e.g. Minibar, Damage fee)"
                            value={otherChargeDesc}
                            onChange={(e) => setOtherChargeDesc(e.target.value)}
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="Amount"
                            value={otherChargeAmount}
                            onChange={(e) => setOtherChargeAmount(e.target.value)}
                            className="sm:w-40"
                          />
                          <Button
                            variant="outline"
                            onClick={handleAddOtherCharge}
                            disabled={isAddingCharge || !otherChargeDesc.trim() || !otherChargeAmount}
                          >
                            {isAddingCharge ? 'Adding...' : 'Add to Bill'}
                          </Button>
                        </div>
                      </div>

                      {billData.totalOutstanding === 0 ? (
                        <div className="pt-6 border-t space-y-4">
                          <div className="text-center py-2 text-green-600 font-medium">
                            <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
                            Bill is fully paid.
                          </div>
                          <Button onClick={handleCheckOutFromBill} disabled={isCheckingOutBill} className="w-full text-lg h-12">
                            <Printer className="mr-2 h-5 w-5" />
                            {isCheckingOutBill ? 'Checking Out...' : 'Check Out Guest & Print Invoice'}
                          </Button>
                        </div>
                      ) : (
                        <div className="pt-6 border-t">
                          <Label className="mb-2 block">Payment Method for Settlement</Label>
                          <div className="flex items-center space-x-4 mb-4">
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input type="radio" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} className="w-4 h-4 text-primary" />
                              <span>Cash</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input type="radio" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} className="w-4 h-4 text-primary" />
                              <span>Credit/Debit Card</span>
                            </label>
                          </div>

                          {paymentMethod === 'cash' && (
                            <div className="bg-muted/50 rounded-lg p-4 mb-6 space-y-2">
                              <div className="flex items-center gap-3">
                                <Label htmlFor="cashReceived" className="whitespace-nowrap">Cash Received</Label>
                                <Input
                                  id="cashReceived"
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  placeholder="0.00"
                                  value={cashReceived}
                                  onChange={(e) => setCashReceived(e.target.value)}
                                  className="w-40"
                                />
                              </div>
                              {cashReceived !== '' && (
                                (() => {
                                  const balance = (parseFloat(cashReceived) || 0) - billData.totalOutstanding;
                                  return balance >= 0 ? (
                                    <p className="text-green-600 font-medium">Balance to Return: LKR {balance.toFixed(2)}</p>
                                  ) : (
                                    <p className="text-red-600 font-medium">Amount Short: LKR {Math.abs(balance).toFixed(2)}</p>
                                  );
                                })()
                              )}
                            </div>
                          )}

                          <Button onClick={handlePayBill} disabled={isSettling} className="w-full text-lg h-12">
                            {isSettling ? 'Processing...' : 'Pay Bill'}
                          </Button>
                          <p className="text-xs text-muted-foreground text-center mt-2">Check Out unlocks once the bill is fully paid.</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow border p-8 text-center text-muted-foreground">
                    Select a customer to view their bill.
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="bg-white rounded-lg shadow border p-4">
              <h2 className="text-lg font-semibold mb-4">
                Check-Out History
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({historyRows.length} record{historyRows.length !== 1 ? 's' : ''} · LKR {historyTotal.toFixed(2)} total)
                </span>
              </h2>
              <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by guest name, room, or chalet..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
                  <Input type="date" className="w-40" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
                  <Input type="date" className="w-40" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} />
                </div>
                {(historyFrom || historyTo) && (
                  <Button variant="outline" size="sm" onClick={() => { setHistoryFrom(''); setHistoryTo(''); }}>
                    Clear Dates
                  </Button>
                )}
                <Select value={historyTypeFilter} onValueChange={(val: any) => setHistoryTypeFilter(val)}>
                  <SelectTrigger className="sm:w-48">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="reservation">Reservation</SelectItem>
                    <SelectItem value="chalet">Chalet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isLoadingReservations ? (
                <p className="text-muted-foreground py-8 text-center">Loading history...</p>
              ) : historyRows.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">No check-out history matches your search/filter.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Guest Name</TableHead>
                      <TableHead>Room / Chalet</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead>Check-out</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyRows.map((row) => row.type === 'reservation' ? (
                      <TableRow key={`res-${row.item.id}`}>
                        <TableCell><Badge variant="outline">Reservation</Badge></TableCell>
                        <TableCell className="font-medium">{row.item.guest_name}</TableCell>
                        <TableCell>{row.item.room?.title || 'Unassigned'}</TableCell>
                        <TableCell>{new Date(row.item.check_in_date).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(row.item.check_out_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right font-medium">LKR {Number(row.item.total_cost || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge className={row.item.status === 'cancelled' ? 'bg-red-100 text-red-800 border-red-200' : 'bg-green-100 text-green-800 border-green-200'}>
                            {row.item.status === 'cancelled' ? 'Cancelled' : 'Checked Out'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow key={`chalet-${row.item.id}`}>
                        <TableCell><Badge className="bg-amber-100 text-amber-800 border-amber-200">Chalet</Badge></TableCell>
                        <TableCell className="font-medium">
                          {row.item.customer_name}
                          <div className="text-xs text-muted-foreground">{row.item.booking_ref}</div>
                        </TableCell>
                        <TableCell>
                          {row.item.chalet_rooms
                            ? `Chalet ${row.item.chalet_rooms.room_number}`
                            : <span className="text-muted-foreground italic">Unassigned</span>}
                        </TableCell>
                        <TableCell>{new Date(row.item.check_in_date).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(row.item.check_out_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right font-medium">LKR {Number(row.item.grand_total || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge className={row.item.status === 'cancelled' ? 'bg-red-100 text-red-800 border-red-200' : 'bg-green-100 text-green-800 border-green-200'}>
                            {row.item.status === 'cancelled' ? 'Cancelled' : 'Checked Out'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Check-In Modal */}
      <Dialog open={isCheckInModalOpen} onOpenChange={setIsCheckInModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Formalize Check-in & Register Guest</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCheckInSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Guest Name</Label>
              <Input required value={customerName} onChange={e => setCustomerName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>ID / Passport Number</Label>
              <Input value={idNumber} onChange={e => setIdNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={address} onChange={e => setAddress(e.target.value)} />
            </div>
            <div className="flex items-center space-x-2 pt-2 border-t mt-4">
              <Checkbox 
                id="loyalty" 
                checked={isLoyalty} 
                onCheckedChange={(checked) => setIsLoyalty(checked as boolean)}
              />
              <Label htmlFor="loyalty" className="font-medium">Register as Loyalty Customer</Label>
            </div>
            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isCheckingIn}>
                {isCheckingIn ? 'Processing...' : 'Complete Check-In'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Guest Detail Modal */}
      <Dialog open={isGuestDetailOpen} onOpenChange={setIsGuestDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Guest Details</DialogTitle>
          </DialogHeader>
          {viewGuestRow && viewGuestRow.type === 'reservation' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Guest Name</p>
                  <p className="font-medium">{viewGuestRow.item.guest_name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
                  <p className="font-medium capitalize">{viewGuestRow.item.status}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</p>
                  <p className="font-medium">{viewGuestCustomer?.email || viewGuestRow.item.guest_email || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Phone</p>
                  <p className="font-medium">{isLoadingGuestDetail ? 'Loading…' : (viewGuestCustomer?.phone || '—')}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">ID / Passport Number</p>
                  <p className="font-medium">{isLoadingGuestDetail ? 'Loading…' : (viewGuestCustomer?.id_number || '—')}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Address</p>
                  <p className="font-medium">{isLoadingGuestDetail ? 'Loading…' : (viewGuestCustomer?.address || '—')}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Room</p>
                  <p className="font-medium">{viewGuestRow.item.room?.title || 'Unassigned'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Cost</p>
                  <p className="font-medium">LKR {Number(viewGuestRow.item.total_cost || 0).toFixed(2)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Check-in</p>
                  <p className="font-medium">
                    {new Date(viewGuestRow.item.check_in_date).toLocaleDateString()}
                    {viewGuestRow.item.check_in_time && ` at ${new Date(viewGuestRow.item.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Check-out</p>
                  <p className="font-medium">{new Date(viewGuestRow.item.check_out_date).toLocaleDateString()}</p>
                </div>
              </div>
              {!isLoadingGuestDetail && !viewGuestCustomer && (
                <p className="text-xs text-muted-foreground italic">No additional customer profile on file for this guest.</p>
              )}
            </div>
          )}

          {viewGuestRow && viewGuestRow.type === 'chalet' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Guest Name</p>
                  <p className="font-medium">{viewGuestRow.item.customer_name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Booking Ref</p>
                  <p className="font-medium">{viewGuestRow.item.booking_ref}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</p>
                  <p className="font-medium">{viewGuestRow.item.customer_email || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Phone</p>
                  <p className="font-medium">{viewGuestRow.item.customer_phone || '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">NIC / Passport</p>
                  <p className="font-medium">{viewGuestRow.item.customer_nic || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nationality</p>
                  <p className="font-medium">{viewGuestRow.item.nationality || '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Chalet</p>
                  <p className="font-medium">
                    {viewGuestRow.item.chalet_rooms
                      ? `${viewGuestRow.item.chalet_rooms.name} (${viewGuestRow.item.chalet_rooms.room_number})`
                      : 'Unassigned'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Package</p>
                  <p className="font-medium">{viewGuestRow.item.chalet_packages?.name || '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Occupancy</p>
                  <p className="font-medium">{viewGuestRow.item.chalet_occupancy_types?.name || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Guests</p>
                  <p className="font-medium">{viewGuestRow.item.adults} Adults, {viewGuestRow.item.children} Children</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Check-in</p>
                  <p className="font-medium">{new Date(viewGuestRow.item.check_in_date).toLocaleDateString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Check-out</p>
                  <p className="font-medium">{new Date(viewGuestRow.item.check_out_date).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="rounded-md border bg-muted/30 p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Rate per Night</span><span>LKR {Number(viewGuestRow.item.rate_per_night || 0).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>LKR {Number(viewGuestRow.item.subtotal || 0).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Service Charge</span><span>LKR {Number(viewGuestRow.item.service_charge_amount || 0).toFixed(2)}</span></div>
                <div className="flex justify-between font-semibold pt-1 border-t"><span>Grand Total</span><span>LKR {Number(viewGuestRow.item.grand_total || 0).toFixed(2)}</span></div>
              </div>
              {(viewGuestRow.item.special_requests || viewGuestRow.item.notes) && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Requests / Notes</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {[viewGuestRow.item.special_requests, viewGuestRow.item.notes].filter(Boolean).join('\n')}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Check Out Confirmation Modal */}
      <Dialog open={checkoutDialogOpen} onOpenChange={setCheckoutDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Check Out Guest</DialogTitle>
          </DialogHeader>
          {isLoadingCheckoutPreview ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading guest bill...</p>
          ) : checkoutPreview ? (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-3 text-sm">
                <p className="font-medium">{checkoutPreview.customer.name}</p>
                <p className="text-muted-foreground">
                  {checkoutRow?.type === 'chalet'
                    ? `Chalet ${checkoutRow.item.chalet_rooms?.room_number ?? ''}`
                    : checkoutRow?.type === 'reservation' ? (checkoutRow.item.room?.title || 'Room') : ''}
                </p>
              </div>

              {checkoutPreview.totalOutstanding > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-red-600">
                    This guest has an outstanding balance of <span className="font-semibold">LKR {checkoutPreview.totalOutstanding.toFixed(2)}</span>. Settle the bill before checking out.
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => {
                      setCheckoutDialogOpen(false);
                      if (checkoutRow) handleMoveToBill(checkoutRow);
                    }}
                  >
                    Go to Bill
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-green-600 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> No outstanding balance.
                  </p>
                  <Button className="w-full" onClick={handleConfirmCheckout} disabled={isCheckingOut}>
                    {isCheckingOut ? 'Checking Out...' : 'Confirm Check-Out'}
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Printable Master Invoice */}
      {billData && (
        <div className="hidden print:block font-sans text-black bg-white">
          <div className="flex justify-between items-start border-b pb-6 mb-6">
            <div>
              <h1 className="text-3xl font-bold uppercase tracking-wider text-gray-900">MASTER FOLIO</h1>
              <p className="text-sm text-gray-500 mt-1">Date: {new Date().toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold text-gray-900">Oruthota Chalets</h2>
              <p className="text-sm text-gray-500 mt-1">Digana, Kandy</p>
              <p className="text-sm text-gray-500">Sri Lanka</p>
              <p className="text-sm text-gray-500">+94 77 123 4567</p>
            </div>
          </div>
          
          <div className="mb-8">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Billed To</h3>
            <p className="font-medium text-lg text-gray-900">{billData.customer.name}</p>
            <p className="text-gray-600 mt-1">{billData.customer.phone || billData.customer.email}</p>
            {billData.customer.address && <p className="text-gray-600 mt-1">{billData.customer.address}</p>}
          </div>

          <table className="w-full mb-8 text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="py-3 px-2 font-bold text-gray-700 uppercase text-xs tracking-wider">Item Description</th>
                <th className="py-3 px-2 font-bold text-gray-700 uppercase text-xs tracking-wider text-right w-32">Amount</th>
              </tr>
            </thead>
            <tbody>
              {billData.reservations.map(res => (
                <tr key={res.id} className="border-b border-gray-100">
                  <td className="py-4 px-2 text-gray-800">Room Charge: {res.room?.title || 'Room'}</td>
                  <td className="py-4 px-2 text-gray-800 text-right font-medium">LKR {Number(res.total_cost || 0).toFixed(2)}</td>
                </tr>
              ))}
              {billData.chaletBookings.map(cb => (
                <tr key={cb.id} className="border-b border-gray-100">
                  <td className="py-4 px-2 text-gray-800">
                    Chalet Charge: {cb.chalet_rooms ? `Chalet ${cb.chalet_rooms.room_number}` : 'Chalet'} — {cb.chalet_packages?.name || 'No package'} (LKR {Number(cb.rate_per_night || 0).toFixed(2)}/night × {cb.nights})
                  </td>
                  <td className="py-4 px-2 text-gray-800 text-right font-medium">LKR {Number(cb.grand_total || 0).toFixed(2)}</td>
                </tr>
              ))}
              {billData.orders.map(ord => (
                <tr key={ord.id} className="border-b border-gray-100">
                  <td className="py-4 px-2 text-gray-800">Restaurant Order #{ord.id.substring(0,8).toUpperCase()}</td>
                  <td className="py-4 px-2 text-gray-800 text-right font-medium">LKR {Number(ord.total_price || 0).toFixed(2)}</td>
                </tr>
              ))}
              {billData.serviceIncomes.map(svc => (
                <tr key={svc.id} className="border-b border-gray-100">
                  <td className="py-4 px-2 text-gray-800">{svc.service_type}: {svc.description}</td>
                  <td className="py-4 px-2 text-gray-800 text-right font-medium">LKR {Number(svc.amount || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end mb-12">
            <div className="w-1/3">
              <div className="flex justify-between py-2 border-t-2 border-gray-900 font-bold text-lg">
                <span>Total Settled</span>
                <span>LKR {billData.totalOutstanding.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 text-sm text-gray-500">
                <span>Payment Method</span>
                <span className="capitalize">{paymentMethod}</span>
              </div>
            </div>
          </div>
          
          <div className="text-center text-gray-500 text-sm mt-16 pt-8 border-t border-gray-200">
            <p>Thank you for staying with us!</p>
          </div>
        </div>
      )}
    </div>
  );
}
