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
import { Printer, CheckCircle2, Search, ScanLine, ChefHat, Plus, Minus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BarcodeScanner } from '@/components/dashboard/inventory-management/barcode-scanner';
import type { Reservation, ConsolidatedBill, ChaletBooking } from '@/lib/types';

type ChaletCheckInPass = {
  booking_ref: string;
  guest_name: string;
  email: string | null;
  room_number: string;
  qr_code: string;
  email_sent: boolean;
  email_reason?: string;
};

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
  const [checkInPass, setCheckInPass] = useState<ChaletCheckInPass | null>(null);
  const [isCheckInPassOpen, setIsCheckInPassOpen] = useState(false);

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
  const [roomAssignmentBooking, setRoomAssignmentBooking] = useState<ChaletBooking | null>(null);
  const [roomAssignmentOpen, setRoomAssignmentOpen] = useState(false);
  const [assignableRooms, setAssignableRooms] = useState<any[]>([]);
  const [assignedRoomId, setAssignedRoomId] = useState('');
  const [isLoadingAssignableRooms, setIsLoadingAssignableRooms] = useState(false);
  const [isAssigningRoom, setIsAssigningRoom] = useState(false);
  const [largeGuestQr, setLargeGuestQr] = useState<{ code: string; guest: string; room: string } | null>(null);
  const [mealBooking, setMealBooking] = useState<ChaletBooking | null>(null);
  const [mealDialogOpen, setMealDialogOpen] = useState(false);
  const [mealPackage, setMealPackage] = useState<any | null>(null);
  const [mealMenuItems, setMealMenuItems] = useState<any[]>([]);
  const [mealRequests, setMealRequests] = useState<{ orders: any[]; items: any[] }>({ orders: [], items: [] });
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner'>('breakfast');
  const [mealDate, setMealDate] = useState('');
  const [mealQuantitiesByType, setMealQuantitiesByType] = useState<Record<'breakfast' | 'lunch' | 'dinner', Record<string, number>>>({ breakfast: {}, lunch: {}, dinner: {} });
  const [mealExtrasByType, setMealExtrasByType] = useState<Record<'breakfast' | 'lunch' | 'dinner', { id: string; menu_item_id?: string; name: string; quantity: number; unit_price: number }[]>>({ breakfast: [], lunch: [], dinner: [] });
  const mealQuantities = mealQuantitiesByType[mealType];
  const mealExtras = mealExtrasByType[mealType];
  const setMealQuantities = (next: Record<string, number> | ((current: Record<string, number>) => Record<string, number>)) => {
    setMealQuantitiesByType(current => ({
      ...current,
      [mealType]: typeof next === 'function' ? next(current[mealType]) : next,
    }));
  };
  const setMealExtras = (next: typeof mealExtras | ((current: typeof mealExtras) => typeof mealExtras)) => setMealExtrasByType(current => ({ ...current, [mealType]: typeof next === 'function' ? next(current[mealType]) : next }));
  const [mealMenuSearch, setMealMenuSearch] = useState('');
  const [mealMenuCategory, setMealMenuCategory] = useState('all');
  const [showSelectedMealItems, setShowSelectedMealItems] = useState(false);
  const [isLoadingMeals, setIsLoadingMeals] = useState(false);
  const [isSavingMeal, setIsSavingMeal] = useState(false);
  const [historyBill, setHistoryBill] = useState<any | null>(null);
  const [isHistoryBillOpen, setIsHistoryBillOpen] = useState(false);
  const [isLoadingHistoryBill, setIsLoadingHistoryBill] = useState(false);

  useEffect(() => {
    if (activeTab === 'check-in' || activeTab === 'in-house' || activeTab === 'history') {
      fetchReservations();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'check-out') {
      const delayDebounceFn = setTimeout(() => {
        searchCustomers();
      }, customerSearch ? 300 : 0);
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
      const searchParam = customerSearch.trim() ? `&search=${encodeURIComponent(customerSearch.trim())}` : '';
      const res = await fetch(`/api/admin/front-desk/billing?outstanding=true${searchParam}`);
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
        const response = await fetch('/api/admin/front-desk/check-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chalet_booking_id: selectedChaletBooking.id,
            customer_name: customerName,
            phone,
            email,
            id_number: idNumber,
            address,
            is_loyalty: isLoyalty,
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Check-in failed');

        setCheckInPass({ ...result.chalet_check_in, email_sent: result.email?.sent === true, email_reason: result.email?.reason });
        setIsCheckInPassOpen(true);
        toast({
          title: 'Checked In',
          description: result.email?.sent
            ? `${customerName} was checked in and the confirmation email was sent.`
            : `${customerName} was checked in. ${result.email?.reason || 'Email was not sent.'}`
        });
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

  const handleCheckoutQrScan = async (code: string) => {
    try {
      const res = await fetch(`/api/admin/front-desk/guest-pass?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Guest QR pass was not recognized');
      const customer = data.customer;
      setCustomerSearch(customer.name);
      setCustomers([customer]);
      await handleSelectCustomerForBill(customer);
      toast({
        title: 'Guest Identified',
        description: `${customer.name}${customer.current_room ? ` — ${customer.current_room}` : ''}`,
      });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Guest Not Found', description: error.message });
    }
  };

  const loadMealRequests = async (bookingId: string) => {
    const res = await fetch(`/api/chalet/package-meals?booking_id=${encodeURIComponent(bookingId)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load package meals');
    setMealRequests(data);
  };

  const openPackageMeals = async (booking: ChaletBooking) => {
    setMealBooking(booking);
    setMealDialogOpen(true);
    setMealQuantitiesByType({ breakfast: {}, lunch: {}, dinner: {} });
    setMealExtrasByType({ breakfast: [], lunch: [], dinner: [] });
    setMealMenuSearch('');
    setMealMenuCategory('all');
    setShowSelectedMealItems(false);
    setIsLoadingMeals(true);
    try {
      const [packageRes, menuRes] = await Promise.all([fetch('/api/chalet/packages'), fetch('/api/admin/menu-items')]);
      const packageData = await packageRes.json();
      const menuData = await menuRes.json();
      const pkg = (packageData.packages || []).find((item: any) => item.id === booking.package_id) || null;
      setMealPackage(pkg);
      setMealMenuItems((menuData.menuItems || []).filter((item: any) => item.availability !== false));
      const today = new Date().toISOString().slice(0, 10);
      setMealDate(today < booking.check_in_date ? booking.check_in_date : today >= booking.check_out_date ? booking.check_in_date : today);
      setMealType(pkg?.includes_breakfast ? 'breakfast' : pkg?.includes_lunch ? 'lunch' : 'dinner');
      await loadMealRequests(booking.id);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Could Not Load Meals', description: error.message });
    } finally {
      setIsLoadingMeals(false);
    }
  };

  const confirmPackageMeal = async () => {
    if (!mealBooking) return;
    const items = Object.entries(mealQuantities).filter(([, quantity]) => quantity > 0).map(([menu_item_id, quantity]) => ({ menu_item_id, quantity }));
    const extras = mealExtras.filter(item => item.name.trim() && item.quantity > 0 && item.unit_price >= 0).map(({ menu_item_id, name, quantity, unit_price }) => ({ menu_item_id, name, quantity, unit_price }));
    if (!items.length && !extras.length) return toast({ variant: 'destructive', title: 'Select Food', description: 'Select included food or add a chargeable extra before confirming.' });
    setIsSavingMeal(true);
    try {
      const res = await fetch('/api/chalet/package-meals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ booking_id: mealBooking.id, meal_type: mealType, service_date: mealDate, items, extras }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to confirm meal');
      setMealQuantities({});
      setMealExtras([]);
      await loadMealRequests(mealBooking.id);
      toast({ title: 'Sent to Kitchen', description: `${mealType} for ${mealBooking.customer_name} was confirmed and sent to Kitchen.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Meal Not Confirmed', description: error.message });
    } finally {
      setIsSavingMeal(false);
    }
  };

  const markMealDelivered = async (orderIds: string[]) => {
    try {
      const res = await fetch('/api/chalet/package-meals', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_ids: orderIds }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not mark delivered');
      if (mealBooking) await loadMealRequests(mealBooking.id);
      toast({ title: 'Delivered to Room', description: 'The package meal was marked as presented to the room.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Not Ready for Delivery', description: error.message });
    }
  };

  const removeConfirmedMealItem = async (itemId: string, itemName: string) => {
    if (!window.confirm(`Remove ${itemName} from this meal request?`)) return;
    try {
      const res = await fetch(`/api/chalet/package-meals?item_id=${encodeURIComponent(itemId)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not remove food item');
      if (mealBooking) await loadMealRequests(mealBooking.id);
      toast({ title: 'Food Removed', description: `${itemName} was removed from Kitchen and its extra charge was recalculated.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Food Not Removed', description: error.message });
    }
  };

  const handleViewHistoryBill = async (row: ArrivalRow) => {
    setIsHistoryBillOpen(true);
    setIsLoadingHistoryBill(true);
    setHistoryBill(null);
    try {
      const response = await fetch(`/api/admin/front-desk/history-bill?type=${row.type}&record_id=${encodeURIComponent(row.item.id)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load past bill.');
      setHistoryBill(data.bill);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Could not load bill', description: error.message });
      setIsHistoryBillOpen(false);
    } finally {
      setIsLoadingHistoryBill(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') !== 'check-out') return;
    setActiveTab('check-out');
    const customerId = params.get('customer_id');
    if (!customerId) return;
    fetch(`/api/admin/customers?id=${encodeURIComponent(customerId)}`)
      .then((response) => response.json())
      .then((data) => {
        const customer = data.customers?.[0];
        if (customer) {
          setCustomerSearch(customer.id_number || customer.name || '');
          setCustomers([customer]);
          handleSelectCustomerForBill(customer);
        }
      })
      .catch((error) => toast({ variant: 'destructive', title: 'Error', description: error.message }));
  }, []);

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

  const openRoomAssignment = async (booking: ChaletBooking) => {
    setRoomAssignmentBooking(booking);
    setAssignedRoomId(booking.room_id || '');
    setRoomAssignmentOpen(true);
    setIsLoadingAssignableRooms(true);
    try {
      const res = await fetch('/api/chalet/rooms');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load rooms');
      setAssignableRooms((data.rooms || []).filter((room: any) => room.status !== 'maintenance'));
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      setRoomAssignmentOpen(false);
    } finally {
      setIsLoadingAssignableRooms(false);
    }
  };

  const handleAssignRoom = async () => {
    if (!roomAssignmentBooking || !assignedRoomId) return;
    setIsAssigningRoom(true);
    try {
      const res = await fetch('/api/chalet/bookings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: roomAssignmentBooking.id, room_id: assignedRoomId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign room');
      toast({ title: 'Room Assigned', description: `Room assigned to ${roomAssignmentBooking.customer_name}.` });
      setRoomAssignmentOpen(false);
      setRoomAssignmentBooking(null);
      setAssignedRoomId('');
      fetchReservations();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Room Not Assigned', description: error.message });
    } finally {
      setIsAssigningRoom(false);
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
      // Keep the bill snapshot in memory for the checkout invoice. Refetching
      // here removes restaurant orders and services after they are marked paid,
      // which leaves the document without the bill that was just settled.
      setBillData(current => current ? {
        ...current,
        totalPaid: current.totalPaid + current.totalOutstanding,
        totalOutstanding: 0,
      } : current);
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

  const printCheckInPass = () => {
    if (!checkInPass) return;
    const popup = window.open('', '_blank', 'width=700,height=850');
    if (!popup) {
      toast({ variant: 'destructive', title: 'Unable to Print', description: 'Allow pop-ups to print the QR pass.' });
      return;
    }

    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Guest Check-In Pass</title>
      <style>
        @page { size: A4 portrait; margin: 18mm; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #111827; font-family: Arial, sans-serif; }
        .pass { width: 100%; max-width: 560px; margin: 0 auto; border: 2px solid #111827; border-radius: 16px; padding: 36px; text-align: center; page-break-inside: avoid; }
        h1 { margin: 0; font-size: 28px; }
        .subtitle { margin: 7px 0 24px; color: #6b7280; font-size: 15px; }
        img { display: block; width: 260px; height: 260px; margin: 0 auto 20px; object-fit: contain; }
        .reference { margin: 0; font-family: monospace; font-size: 24px; font-weight: 700; letter-spacing: 2px; }
        .details { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 28px; border-top: 1px solid #d1d5db; padding-top: 22px; text-align: left; }
        .label { display: block; margin-bottom: 5px; color: #6b7280; font-size: 12px; text-transform: uppercase; }
        .value { font-size: 17px; font-weight: 700; overflow-wrap: anywhere; }
      </style></head><body><main class="pass"><h1>Oruthota Chalets</h1><p class="subtitle">Guest Check-In Pass</p><img id="qr" alt="Guest check-in QR code"><p id="reference" class="reference"></p><section class="details"><div><span class="label">Guest</span><span id="guest" class="value"></span></div><div><span class="label">Assigned Room</span><span id="room" class="value"></span></div></section></main></body></html>`);
    popup.document.close();
    popup.document.getElementById('reference')!.textContent = checkInPass.booking_ref;
    popup.document.getElementById('guest')!.textContent = checkInPass.guest_name;
    popup.document.getElementById('room')!.textContent = `Chalet ${checkInPass.room_number}`;
    const qrImage = popup.document.getElementById('qr') as HTMLImageElement;
    let printStarted = false;
    const printWhenReady = () => {
      if (printStarted) return;
      printStarted = true;
      popup.focus();
      popup.print();
    };
    qrImage.onload = printWhenReady;
    qrImage.src = checkInPass.qr_code;
    if (qrImage.complete) printWhenReady();
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
  const mealMenuCategories = Array.from(new Set(mealMenuItems.map(item => String(item.category || 'Other')))).sort();
  const selectedMealItemCount = Object.values(mealQuantities).filter(quantity => quantity > 0).length;
  const filteredMealMenuItems = mealMenuItems.filter(item => {
    const query = mealMenuSearch.trim().toLowerCase();
    if (query && ![item.name, item.description, item.category].some(value => String(value || '').toLowerCase().includes(query))) return false;
    if (mealMenuCategory !== 'all' && String(item.category || 'Other') !== mealMenuCategory) return false;
    if (showSelectedMealItems && !(mealQuantities[item.id] > 0)) return false;
    return true;
  });
  type MealRequestGroup = { key: string; date: string; type: string; room: string; orders: any[]; items: any[] };
  const mealRequestGroups = mealRequests.orders.reduce<Map<string, MealRequestGroup>>((groups, order: any) => {
    const parts = String(order.waiter_name || '').split('|');
    const key = parts.slice(0, 5).join('|');
    const existing = groups.get(key) || { key, date: parts[2], type: parts[3], room: parts[4], orders: [], items: [] };
    existing.orders.push(order);
    existing.items.push(...mealRequests.items.filter(item => item.order_id === order.id));
    groups.set(key, existing);
    return groups;
  }, new Map<string, MealRequestGroup>());
  const groupedMealRequests: MealRequestGroup[] = Array.from(mealRequestGroups.values());

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
                          {row.item.chalet_rooms ? (
                            <Button size="sm" onClick={() => handleOpenChaletCheckIn(row.item)}>Check In</Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => openRoomAssignment(row.item)}>Assign Room</Button>
                          )}
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
                      <TableHead>Guest QR</TableHead>
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
                          <button
                            type="button"
                            className="rounded focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                            onClick={() => setLargeGuestQr({
                              code: `RES:${row.item.id}`,
                              guest: row.item.guest_name,
                              room: row.item.room?.title || 'Unassigned',
                            })}
                            title="Click to enlarge QR"
                          >
                            <img
                              src={`/api/admin/front-desk/guest-pass?format=png&code=${encodeURIComponent(`RES:${row.item.id}`)}`}
                              alt={`QR pass for ${row.item.guest_name}`}
                              className="h-16 w-16 rounded border bg-white p-1"
                            />
                          </button>
                        </TableCell>
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
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="rounded focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                              onClick={() => setLargeGuestQr({
                                code: row.item.booking_ref,
                                guest: row.item.customer_name,
                                room: row.item.chalet_rooms ? `Chalet ${row.item.chalet_rooms.room_number}` : 'Unassigned',
                              })}
                              title="Click to enlarge QR"
                            >
                              <img
                                src={`/api/admin/front-desk/guest-pass?format=png&code=${encodeURIComponent(row.item.booking_ref)}`}
                                alt={`QR pass for ${row.item.customer_name}`}
                                className="h-16 w-16 rounded border bg-white p-1"
                              />
                            </button>
                            <span className="font-mono text-xs">{row.item.booking_ref}</span>
                          </div>
                        </TableCell>
                        <TableCell>{new Date(row.item.check_in_date).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(row.item.check_out_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end items-center gap-2">
                            <Badge className="bg-green-100 text-green-800 border-green-200">In House</Badge>
                            <Button size="sm" variant="outline" onClick={() => handleViewGuest(row)}>
                              View
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openPackageMeals(row.item)}>
                              <ChefHat className="mr-1 h-4 w-4" /> Meals
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
                <h2 className="text-lg font-semibold mb-4">Find Customer Bill</h2>
                <div className="mb-4 space-y-2">
                  <Input
                    placeholder="Search by name, ID, or phone..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                  />
                  <BarcodeScanner
                    onScan={handleCheckoutQrScan}
                    title="Scan Guest QR Pass"
                    description="Point the camera at the checked-in guest's QR pass to load their bill."
                    successTitle="Guest QR Captured"
                    trigger={(
                      <Button type="button" variant="outline" className="w-full">
                        <ScanLine className="mr-2 h-4 w-4" /> Scan Guest QR
                      </Button>
                    )}
                  />
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {customers.map(c => (
                    <div 
                      key={c.id} 
                      className={`p-3 border rounded-md cursor-pointer hover:bg-muted ${selectedCustomerForBill?.id === c.id ? 'bg-muted border-primary' : ''}`}
                      onClick={() => handleSelectCustomerForBill(c)}
                    >
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.id_number ? `ID: ${c.id_number}` : c.phone || c.email || 'No contact info'}
                      </div>
                      <div className="mt-2 font-semibold text-primary">LKR {Number(c.outstanding_total || 0).toFixed(2)} due</div>
                    </div>
                  ))}
                  {customers.length === 0 && (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      {customerSearch ? 'No outstanding customer bills match your search.' : 'No outstanding customer bills.'}
                    </div>
                  )}
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
                        <Button variant="outline" className="mt-3" onClick={() => window.print()}>
                          <Printer className="mr-2 h-4 w-4" />
                          Print Bill
                        </Button>
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
                                  <TableCell className="text-right">LKR {Number(ord.confirmed_total ?? ord.total_price ?? 0).toFixed(2)}</TableCell>
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
                                  <TableCell>
                                    <div>{svc.service_type}: {svc.description} ({new Date(svc.date).toLocaleDateString()})</div>
                                    {svc.line_items && svc.line_items.length > 0 && (
                                      <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                                        {svc.line_items.map((item, index) => (
                                          <div key={index}>{item.description}: LKR {Number(item.amount || 0).toFixed(2)}</div>
                                        ))}
                                      </div>
                                    )}
                                  </TableCell>
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
                      <TableHead className="text-right">Bill</TableHead>
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
                        <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => handleViewHistoryBill(row)} disabled={row.item.status === 'cancelled'}>View Bill</Button></TableCell>
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
                        <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => handleViewHistoryBill(row)} disabled={row.item.status === 'cancelled'}>View Bill</Button></TableCell>
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

      <Dialog open={isHistoryBillOpen} onOpenChange={setIsHistoryBillOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Past Bill Details</DialogTitle></DialogHeader>
          {isLoadingHistoryBill ? (
            <p className="py-10 text-center text-muted-foreground">Loading past bill…</p>
          ) : historyBill && (
            <div className="space-y-5">
              <div className="flex items-start justify-between border-b pb-4">
                <div>
                  <h2 className="text-2xl font-bold">Oruthota Chalets</h2>
                  <p className="text-sm text-muted-foreground">Bill {historyBill.number}</p>
                </div>
                <Badge className="bg-green-100 text-green-800 border-green-200">Paid</Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-xs uppercase text-muted-foreground">Guest</p><p className="font-medium">{historyBill.customer?.name || 'Guest'}</p><p className="text-muted-foreground">{historyBill.customer?.id_number || historyBill.customer?.phone || ''}</p></div>
                <div className="text-right"><p className="text-xs uppercase text-muted-foreground">Stay</p><p>{new Date(historyBill.check_in_date).toLocaleDateString()} – {new Date(historyBill.check_out_date).toLocaleDateString()}</p></div>
              </div>
              <div className="divide-y rounded-md border">
                {historyBill.items.map((item: any, index: number) => (
                  <div key={index} className="p-3">
                    <div className="flex justify-between gap-4 text-sm"><span><Badge variant="outline" className="mr-2">{item.category}</Badge>{item.description}</span><span className="whitespace-nowrap font-medium">LKR {Number(item.amount || 0).toFixed(2)}</span></div>
                    {item.line_items?.length > 0 && <div className="ml-2 mt-2 space-y-1 text-xs text-muted-foreground">{item.line_items.map((line: any, lineIndex: number) => <div key={lineIndex} className="flex justify-between"><span>{line.description}</span><span>LKR {Number(line.amount || 0).toFixed(2)}</span></div>)}</div>}
                  </div>
                ))}
              </div>
              <div className="flex justify-between border-t-2 pt-3 text-xl font-bold"><span>Total Paid</span><span>LKR {Number(historyBill.total || 0).toFixed(2)}</span></div>
              <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Payment method: {historyBill.payment_method ? String(historyBill.payment_method).replace('_', ' ') : 'Not recorded'}</span><Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print Bill</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!largeGuestQr} onOpenChange={(open) => !open && setLargeGuestQr(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Guest QR Pass</DialogTitle>
          </DialogHeader>
          {largeGuestQr && (
            <div className="flex flex-col items-center text-center">
              <img
                src={`/api/admin/front-desk/guest-pass?format=png&code=${encodeURIComponent(largeGuestQr.code)}`}
                alt={`QR pass for ${largeGuestQr.guest}`}
                className="h-80 w-80 max-w-full bg-white p-3"
              />
              <p className="mt-3 text-xl font-semibold">{largeGuestQr.guest}</p>
              <p className="text-muted-foreground">{largeGuestQr.room}</p>
              <p className="mt-2 break-all font-mono text-sm text-muted-foreground">{largeGuestQr.code}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={mealDialogOpen} onOpenChange={setMealDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Package Meals & Room Delivery</DialogTitle></DialogHeader>
          {isLoadingMeals ? (
            <p className="py-10 text-center text-muted-foreground">Loading package and meal requests…</p>
          ) : mealBooking && (
            <div className="space-y-6">
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="font-semibold">{mealBooking.customer_name} · {mealBooking.chalet_rooms ? `Chalet ${mealBooking.chalet_rooms.room_number}` : 'Unassigned'}</p>
                <p className="text-muted-foreground">{mealPackage?.name || 'No package'} · {mealBooking.adults} adults, {mealBooking.children} children</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {mealPackage?.includes_breakfast && <Badge variant="outline">Breakfast included</Badge>}
                  {mealPackage?.includes_lunch && <Badge variant="outline">Lunch included</Badge>}
                  {mealPackage?.includes_dinner && <Badge variant="outline">Dinner included</Badge>}
                </div>
              </div>

              {(mealPackage?.includes_breakfast || mealPackage?.includes_lunch || mealPackage?.includes_dinner) ? (
                <div className="space-y-4 rounded-lg border p-4">
                  <div><h3 className="font-semibold">Confirm Food Requirements</h3><p className="text-xs text-muted-foreground">Choose each included meal separately. Your selections are preserved when switching meals.</p></div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1"><Label>Meal date</Label><Input type="date" min={mealBooking.check_in_date} max={new Date(new Date(mealBooking.check_out_date).getTime() - 86400000).toISOString().slice(0, 10)} value={mealDate} onChange={event => setMealDate(event.target.value)} /></div>
                    <div className="space-y-1"><Label>Included meal</Label><Select value={mealType} onValueChange={(value: any) => setMealType(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{mealPackage?.includes_breakfast && <SelectItem value="breakfast">Breakfast</SelectItem>}{mealPackage?.includes_lunch && <SelectItem value="lunch">Lunch</SelectItem>}{mealPackage?.includes_dinner && <SelectItem value="dinner">Dinner</SelectItem>}</SelectContent></Select></div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {mealPackage?.includes_breakfast && <Badge variant={Object.values(mealQuantitiesByType.breakfast).some(quantity => quantity > 0) ? 'default' : 'outline'}>Breakfast: {Object.values(mealQuantitiesByType.breakfast).filter(quantity => quantity > 0).length} selected</Badge>}
                    {mealPackage?.includes_lunch && <Badge variant={Object.values(mealQuantitiesByType.lunch).some(quantity => quantity > 0) ? 'default' : 'outline'}>Lunch: {Object.values(mealQuantitiesByType.lunch).filter(quantity => quantity > 0).length} selected</Badge>}
                    {mealPackage?.includes_dinner && <Badge variant={Object.values(mealQuantitiesByType.dinner).some(quantity => quantity > 0) ? 'default' : 'outline'}>Dinner: {Object.values(mealQuantitiesByType.dinner).filter(quantity => quantity > 0).length} selected</Badge>}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input className="pl-9" placeholder="Search food by name or description…" value={mealMenuSearch} onChange={event => setMealMenuSearch(event.target.value)} />
                    </div>
                    <Select value={mealMenuCategory} onValueChange={setMealMenuCategory}>
                      <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
                      <SelectContent><SelectItem value="all">All categories</SelectItem>{mealMenuCategories.map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <label className="flex cursor-pointer items-center gap-2"><Checkbox checked={showSelectedMealItems} onCheckedChange={checked => setShowSelectedMealItems(checked === true)} />Show selected only</label>
                    <Badge variant={selectedMealItemCount > 0 ? 'default' : 'outline'}>{selectedMealItemCount} item{selectedMealItemCount === 1 ? '' : 's'} selected</Badge>
                  </div>
                  {selectedMealItemCount > 0 && !showSelectedMealItems && (
                    <div className="flex flex-wrap gap-1.5 rounded-md bg-muted/50 p-2">
                      {mealMenuItems.filter(item => mealQuantities[item.id] > 0).map(item => <button type="button" key={item.id} className="rounded-full border bg-background px-2.5 py-1 text-xs hover:bg-muted" onClick={() => { setMealMenuSearch(item.name); setMealMenuCategory('all'); }}>{item.name} × {mealQuantities[item.id]}</button>)}
                    </div>
                  )}
                  <div className="max-h-72 divide-y overflow-y-auto rounded-md border">
                    {filteredMealMenuItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between gap-3 p-3">
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.name}</p><p className="truncate text-xs text-muted-foreground">{item.category || 'Menu item'}{item.description ? ` · ${item.description}` : ''} · Extra price LKR {Number(item.price || 0).toFixed(2)}</p></div>
                        <Button type="button" size="sm" variant="secondary" className="shrink-0" onClick={() => setMealExtras(current => { const existing = current.find(extra => extra.menu_item_id === item.id); return existing ? current.map(extra => extra.id === existing.id ? { ...extra, quantity: extra.quantity + 1 } : extra) : [...current, { id: crypto.randomUUID(), menu_item_id: item.id, name: item.name, quantity: 1, unit_price: Number(item.price || 0) }]; })}>Extra +</Button>
                        <div className="flex shrink-0 items-center gap-1" title="Included quantity">
                          <Button type="button" size="icon" variant="outline" className="h-8 w-8" disabled={!(mealQuantities[item.id] > 0)} onClick={() => setMealQuantities(current => ({ ...current, [item.id]: Math.max(0, (current[item.id] || 0) - 1) }))}><Minus className="h-3.5 w-3.5" /></Button>
                          <Input className="h-8 w-14 px-1 text-center" type="number" min={0} value={mealQuantities[item.id] || ''} placeholder="0" onChange={event => setMealQuantities(current => ({ ...current, [item.id]: Math.max(0, Number(event.target.value) || 0) }))} />
                          <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => setMealQuantities(current => ({ ...current, [item.id]: (current[item.id] || 0) + 1 }))}><Plus className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    ))}
                    {filteredMealMenuItems.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No food items match this search and filter.</div>}
                  </div>
                  <div className="space-y-3 rounded-lg border border-orange-200 bg-orange-50/50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="font-semibold text-orange-900">Chargeable Extras</h4><p className="text-xs text-orange-800">These foods are sent to Kitchen and added to the guest's master bill.</p></div><Button type="button" size="sm" variant="outline" onClick={() => setMealExtras(current => [...current, { id: crypto.randomUUID(), name: '', quantity: 1, unit_price: 0 }])}><Plus className="mr-1 h-4 w-4" />Custom Food</Button></div>
                    {mealExtras.length === 0 ? <p className="text-sm text-muted-foreground">No chargeable extras added.</p> : mealExtras.map((extra, index) => (
                      <div key={extra.id} className="grid gap-2 rounded-md border bg-white p-2 sm:grid-cols-[1fr_90px_130px_36px]">
                        <Input placeholder="Food name" value={extra.name} readOnly={!!extra.menu_item_id} onChange={event => setMealExtras(current => current.map(item => item.id === extra.id ? { ...item, name: event.target.value } : item))} />
                        <Input type="number" min={1} placeholder="Qty" value={extra.quantity} onChange={event => setMealExtras(current => current.map(item => item.id === extra.id ? { ...item, quantity: Math.max(1, Number(event.target.value) || 1) } : item))} />
                        <Input type="number" min={0} step="0.01" placeholder="Unit price" value={extra.unit_price} readOnly={!!extra.menu_item_id} onChange={event => setMealExtras(current => current.map(item => item.id === extra.id ? { ...item, unit_price: Math.max(0, Number(event.target.value) || 0) } : item))} />
                        <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => setMealExtras(current => current.filter(item => item.id !== extra.id))}><Trash2 className="h-4 w-4" /></Button>
                        <p className="text-xs font-medium text-orange-800 sm:col-span-4">Line total: LKR {(extra.quantity * extra.unit_price).toFixed(2)}</p>
                      </div>
                    ))}
                    {mealExtras.length > 0 && <div className="text-right font-bold text-orange-900">Extras total: LKR {mealExtras.reduce((sum, item) => sum + item.quantity * item.unit_price, 0).toFixed(2)}</div>}
                  </div>
                  <Button className="w-full" onClick={confirmPackageMeal} disabled={isSavingMeal}>{isSavingMeal ? 'Sending to Kitchen…' : 'Confirm & Send to Kitchen'}</Button>
                </div>
              ) : <p className="rounded-md border p-4 text-sm text-muted-foreground">This package does not include meals.</p>}

              <div className="space-y-3">
                <h3 className="font-semibold">Confirmed Meals</h3>
                {groupedMealRequests.length === 0 ? <p className="text-sm text-muted-foreground">No package meals confirmed yet.</p> : groupedMealRequests.map(group => {
                  const ready = group.items.length > 0 && group.items.every(item => ['ready', 'done'].includes(item.kitchen_status));
                  const delivered = group.orders.every(order => order.status === 'closed') && group.items.every(item => item.served_quantity >= item.quantity);
                  const extrasTotal = group.items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
                  return <div key={group.key} className="rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="font-semibold capitalize">{group.type} · {group.date} · Room {group.room}</p><div className="mt-2 divide-y rounded-md border">{group.items.map(item => { const isExtra = Number(item.price || 0) > 0 || String(item.name).includes('(Extra)'); const lineTotal = Number(item.price || 0) * Number(item.quantity || 0); const itemCanRemove = item.kitchen_status === 'pending' && Number(item.prepared_quantity || 0) === 0 && group.orders.find(order => order.id === item.order_id)?.status === 'open'; return <div key={item.id} className="flex justify-between gap-3 px-3 py-2 text-sm"><div><span>{item.name}</span>{isExtra && <p className="text-xs text-orange-700">LKR {Number(item.price || 0).toFixed(2)} each</p>}</div><div className="flex items-center gap-2 text-right"><div><span className="font-semibold">× {item.quantity}</span>{isExtra && <p className="text-xs font-semibold text-orange-700">LKR {lineTotal.toFixed(2)}</p>}</div>{itemCanRemove && <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeConfirmedMealItem(item.id, item.name)} title="Remove this food"><Trash2 className="h-4 w-4" /></Button>}</div></div>; })}</div>{extrasTotal > 0 && <div className="mt-2 flex justify-between rounded-md bg-orange-50 px-3 py-2 text-sm font-bold text-orange-900"><span>Chargeable extras added to bill</span><span>LKR {extrasTotal.toFixed(2)}</span></div>}</div><div className="flex flex-wrap items-center justify-end gap-2"><Badge className={delivered ? 'bg-green-600' : ready ? 'bg-blue-600' : 'bg-amber-500'}>{delivered ? 'Delivered' : ready ? 'Ready' : 'In Kitchen'}</Badge>{!delivered && <Button size="sm" onClick={() => markMealDelivered(group.orders.map(order => order.id))} disabled={!ready}>Mark Meal Delivered</Button>}</div></div></div>;
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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

      <Dialog open={isCheckInPassOpen} onOpenChange={setIsCheckInPassOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Check-In QR Pass</DialogTitle>
          </DialogHeader>
          {checkInPass && (
            <>
              <div className="rounded-lg border bg-white p-6 text-center text-black">
                <h2 className="text-2xl font-bold">Oruthota Chalets</h2>
                <p className="mt-1 text-sm text-gray-500">Guest Check-In Pass</p>
                <img src={checkInPass.qr_code} alt={`QR code for ${checkInPass.booking_ref}`} className="mx-auto my-5 h-56 w-56" />
                <p className="font-mono text-xl font-bold tracking-wide">{checkInPass.booking_ref}</p>
                <div className="mt-5 grid grid-cols-2 gap-3 border-t pt-4 text-left text-sm">
                  <div><span className="text-gray-500">Guest</span><p className="font-semibold">{checkInPass.guest_name}</p></div>
                  <div><span className="text-gray-500">Assigned Room</span><p className="font-semibold">Chalet {checkInPass.room_number}</p></div>
                </div>
              </div>
              <div className="text-sm">
                {checkInPass.email_sent ? (
                  <p className="text-green-700">Confirmation sent to {checkInPass.email}.</p>
                ) : (
                  <p className="text-amber-700">Email not sent: {checkInPass.email_reason || 'Email delivery is not configured.'}</p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCheckInPassOpen(false)}>Close</Button>
                <Button onClick={printCheckInPass}><Printer className="mr-2 h-4 w-4" />Print QR Pass</Button>
              </div>
            </>
          )}
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
      <Dialog open={roomAssignmentOpen} onOpenChange={setRoomAssignmentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Room</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium">{roomAssignmentBooking?.customer_name}</p>
              <p className="text-muted-foreground">
                {roomAssignmentBooking && `${new Date(roomAssignmentBooking.check_in_date).toLocaleDateString()} to ${new Date(roomAssignmentBooking.check_out_date).toLocaleDateString()}`}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Room / Chalet</Label>
              <Select value={assignedRoomId} onValueChange={setAssignedRoomId} disabled={isLoadingAssignableRooms}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingAssignableRooms ? 'Loading rooms...' : 'Select a room'} />
                </SelectTrigger>
                <SelectContent>
                  {assignableRooms.map(room => (
                    <SelectItem key={room.id} value={room.id}>
                      Chalet {room.room_number} — {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isLoadingAssignableRooms && assignableRooms.length === 0 && (
                <p className="text-sm text-muted-foreground">No assignable rooms are available.</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRoomAssignmentOpen(false)}>Cancel</Button>
              <Button onClick={handleAssignRoom} disabled={!assignedRoomId || isAssigningRoom}>
                {isAssigningRoom ? 'Assigning...' : 'Assign Room'}
              </Button>
            </div>
          </div>
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
        <div id="print-area" className="hidden print:block font-sans text-black bg-white">
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
                  <td className="py-4 px-2 text-gray-800 text-right font-medium">LKR {Number(ord.confirmed_total ?? ord.total_price ?? 0).toFixed(2)}</td>
                </tr>
              ))}
              {billData.serviceIncomes.map(svc => (
                <tr key={svc.id} className="border-b border-gray-100">
                  <td className="py-4 px-2 text-gray-800">
                    <div>{svc.service_type}: {svc.description}</div>
                    {svc.line_items && svc.line_items.length > 0 && (
                      <div className="mt-1 text-xs text-gray-500">
                        {svc.line_items.map((item, index) => <div key={index}>{item.description} — LKR {Number(item.amount || 0).toFixed(2)}</div>)}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-2 text-gray-800 text-right font-medium">LKR {Number(svc.amount || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end mb-12">
            <div className="w-1/3">
              <div className="flex justify-between py-2 border-t-2 border-gray-900 font-bold text-lg">
                <span>{billData.totalOutstanding > 0 ? 'Total Due' : 'Total Settled'}</span>
                <span>LKR {(billData.totalOutstanding > 0 ? billData.totalOutstanding : billData.totalPaid).toFixed(2)}</span>
              </div>
              {billData.totalOutstanding === 0 && (
                <div className="flex justify-between py-2 text-sm text-gray-500">
                  <span>Payment Method</span>
                  <span className="capitalize">{paymentMethod}</span>
                </div>
              )}
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
