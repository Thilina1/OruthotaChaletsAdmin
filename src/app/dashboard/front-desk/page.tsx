'use client';

import { useState, useEffect } from 'react';
import { PaginatedTableBody } from '@/components/ui/paginated-table-body';
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
import { Printer, CheckCircle2, Search, ScanLine, ChefHat, Plus, Minus, Trash2, MoreHorizontal, Eye } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { BarcodeScanner } from '@/components/dashboard/inventory-management/barcode-scanner';
import type { Reservation, ConsolidatedBill, ChaletBooking, ChaletPackage, ChaletRate, ChaletRoom, ChaletRoomCategory, Customer } from '@/lib/types';
import { chaletBillLinesForDisplay, chaletPaidLkr, chaletTotalLkr } from '@/lib/chalet-billing';
import { GuestInvoice, type GuestInvoiceProps, type InvoiceLine, type InvoicePayment } from '@/components/dashboard/front-desk/guest-invoice';

type ChaletCheckInPass = {
  booking_ref: string;
  guest_name: string;
  email: string | null;
  email_recipients?: string[];
  room_number: string;
  qr_code: string;
  email_sent: boolean;
  email_reason?: string;
};

type AdditionalGuestForm = {
  id: string;
  name: string;
  email: string;
  id_number: string;
  address: string;
};

export default function FrontDeskPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('check-in');
  
  // Check-In State
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [checkedInReservations, setCheckedInReservations] = useState<Reservation[]>([]);
  const [chaletArrivals, setChaletArrivals] = useState<ChaletBooking[]>([]);
  const [chaletInHouse, setChaletInHouse] = useState<ChaletBooking[]>([]);
  const [chaletRooms, setChaletRooms] = useState<ChaletRoom[]>([]);
  const [chaletPackages, setChaletPackages] = useState<ChaletPackage[]>([]);
  const [chaletRoomCategories, setChaletRoomCategories] = useState<ChaletRoomCategory[]>([]);
  const [chaletRates, setChaletRates] = useState<ChaletRate[]>([]);
  const [historyReservations, setHistoryReservations] = useState<Reservation[]>([]);
  const [historyChalet, setHistoryChalet] = useState<ChaletBooking[]>([]);
  const [resolvableCustomerNames, setResolvableCustomerNames] = useState<Set<string>>(new Set());
  const [isLoadingReservations, setIsLoadingReservations] = useState(true);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [selectedChaletBooking, setSelectedChaletBooking] = useState<ChaletBooking | null>(null);
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);

  // Arrivals search & filter
  const [arrivalFrom, setArrivalFrom] = useState('');
  const [arrivalTo, setArrivalTo] = useState('');
  const [inHouseFrom, setInHouseFrom] = useState('');
  const [inHouseTo, setInHouseTo] = useState('');
  const [billingFrom, setBillingFrom] = useState('');
  const [billingTo, setBillingTo] = useState('');
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
  // Every payment related to the viewed stay (LKR), from guest-payments API.
  const [viewGuestPayments, setViewGuestPayments] = useState<{
    payments: { id: string; paid_at: string | null; source: string; reference: string | null; payment_method: string | null; amount: number; account_name: string | null; recorded_by: string | null; note: string | null }[];
    total: number;
    balance?: { stay: number; restaurant: number; services: number; total: number };
  } | null>(null);
  const [isLoadingGuestPayments, setIsLoadingGuestPayments] = useState(false);
  const [isLoadingGuestDetail, setIsLoadingGuestDetail] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [address, setAddress] = useState('');
  const [additionalGuests, setAdditionalGuests] = useState<AdditionalGuestForm[]>([]);
  const [showCheckInBillPreview, setShowCheckInBillPreview] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkInPass, setCheckInPass] = useState<ChaletCheckInPass | null>(null);
  const [isCheckInPassOpen, setIsCheckInPassOpen] = useState(false);

  // Billing State
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerForBill, setSelectedCustomerForBill] = useState<any | null>(null);
  const [billData, setBillData] = useState<ConsolidatedBill | null>(null);
  const [isLoadingBill, setIsLoadingBill] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'online'>('cash');
  const [isSettling, setIsSettling] = useState(false);
  const [isCheckingOutBill, setIsCheckingOutBill] = useState(false);
  const [cashReceived, setCashReceived] = useState('');
  // Payment just taken for the open bill, printed on the receipt.
  const [lastSettlement, setLastSettlement] = useState<{ billNumber: string | null; method: string; amount: number; cashReceived: number | null; paidAt: string } | null>(null);

  // Add Other Charge to bill
  const [otherChargeDesc, setOtherChargeDesc] = useState('');
  const [otherChargeAmount, setOtherChargeAmount] = useState('');
  const [isAddingCharge, setIsAddingCharge] = useState(false);
  const [discountDesc, setDiscountDesc] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [isAddingDiscount, setIsAddingDiscount] = useState(false);

  // Quick check-out from the Checked-In Guests list
  const [checkoutRow, setCheckoutRow] = useState<ArrivalRow | null>(null);
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
  const [checkoutPreview, setCheckoutPreview] = useState<ConsolidatedBill | null>(null);
  const [isLoadingCheckoutPreview, setIsLoadingCheckoutPreview] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [roomAssignmentBooking, setRoomAssignmentBooking] = useState<ChaletBooking | null>(null);
  const [roomAssignmentOpen, setRoomAssignmentOpen] = useState(false);
  const [assignableRooms, setAssignableRooms] = useState<any[]>([]);
  const [assignedRoomIds, setAssignedRoomIds] = useState<string[]>([]);
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
      const [resData, chaletData, customersData, roomsData, packagesData, categoriesData, ratesData] = await Promise.all([
        fetch('/api/admin/reservations?status=confirmed,pending,checked-in').then(r => r.json()),
        fetch('/api/chalet/bookings').then(r => r.json()),
        fetch('/api/admin/customers').then(r => r.json()),
        fetch('/api/chalet/rooms').then(r => r.json()),
        fetch('/api/chalet/packages').then(r => r.json()),
        fetch('/api/chalet/room-categories').then(r => r.json()),
        fetch('/api/chalet/rates').then(r => r.json()),
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
      setChaletRooms(roomsData.rooms || []);
      setChaletPackages(packagesData.packages || []);
      setChaletRoomCategories(categoriesData.categories || []);
      setChaletRates(ratesData.rates || []);
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

  const applyCustomerDetails = (customer: Partial<Customer> | null | undefined) => {
    if (!customer) return;
    setCustomerName(current => current || customer.name || '');
    setPhone(current => current || customer.phone || '');
    setEmail(current => current || customer.email || '');
    setIdNumber(current => current || customer.id_number || '');
    setAddress(current => current || customer.address || '');
  };

  const fetchCustomerDetails = async (customerId?: string) => {
    if (!customerId) return;
    try {
      const response = await fetch(`/api/admin/customers?id=${encodeURIComponent(customerId)}`);
      const data = await response.json();
      applyCustomerDetails(data.customers?.[0]);
    } catch (error) {
      console.error(error);
    }
  };

  const resetAdditionalGuests = () => setAdditionalGuests([]);

  const addAdditionalGuest = () => {
    setAdditionalGuests(current => [
      ...current,
      { id: crypto.randomUUID(), name: '', email: '', id_number: '', address: '' },
    ]);
  };

  const updateAdditionalGuest = (id: string, field: keyof Omit<AdditionalGuestForm, 'id'>, value: string) => {
    setAdditionalGuests(current => current.map(guest => (
      guest.id === id ? { ...guest, [field]: value } : guest
    )));
  };

  const removeAdditionalGuest = (id: string) => {
    setAdditionalGuests(current => current.filter(guest => guest.id !== id));
  };

  const getFilledAdditionalGuests = () => additionalGuests
    .map(({ name, email, id_number, address }) => ({
      name: name.trim(),
      email: email.trim(),
      id_number: id_number.trim(),
      address: address.trim(),
    }))
    .filter(guest => guest.name || guest.email || guest.id_number || guest.address);

  const handleOpenCheckIn = (res: Reservation) => {
    const reservationDetails = res as Reservation & {
      guest_phone?: string;
      id_card_number?: string;
      guest_address?: string;
      customer?: Partial<Customer>;
    };
    setSelectedReservation(res);
    setSelectedChaletBooking(null);
    setCustomerName(reservationDetails.customer?.name || res.guest_name || '');
    setPhone(reservationDetails.customer?.phone || reservationDetails.guest_phone || '');
    setEmail(reservationDetails.customer?.email || res.guest_email || '');
    setIdNumber(reservationDetails.customer?.id_number || reservationDetails.id_card_number || '');
    setAddress(reservationDetails.customer?.address || reservationDetails.guest_address || '');
    resetAdditionalGuests();
    setShowCheckInBillPreview(false);
    setIsCheckInModalOpen(true);
    fetchCustomerDetails(res.customer_id);
  };

  const handleOpenChaletCheckIn = (booking: ChaletBooking) => {
    const bookingDetails = booking as ChaletBooking & {
      customer_address?: string;
      address?: string;
      customer?: Partial<Customer>;
    };
    setSelectedChaletBooking(booking);
    setSelectedReservation(null);
    setCustomerName(bookingDetails.customer?.name || booking.customer_name || '');
    setEmail(bookingDetails.customer?.email || booking.customer_email || '');
    setPhone(bookingDetails.customer?.phone || booking.customer_phone || '');
    setIdNumber(bookingDetails.customer?.id_number || booking.customer_nic || '');
    setAddress(bookingDetails.customer?.address || bookingDetails.customer_address || bookingDetails.address || '');
    resetAdditionalGuests();
    setShowCheckInBillPreview(false);
    setIsCheckInModalOpen(true);
    // The list may have been loaded before the latest payment; reload this
    // booking so the bill preview shows its current paid amount.
    fetch(`/api/chalet/bookings?id=${encodeURIComponent(booking.id)}`, { cache: 'no-store' })
      .then(response => response.json())
      .then(data => {
        const fresh: ChaletBooking | undefined = data.bookings?.[0];
        if (fresh) setSelectedChaletBooking(current => current?.id === fresh.id ? fresh : current);
      })
      .catch(() => {});
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
            additional_guests: getFilledAdditionalGuests(),
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Check-in failed');

        setCheckInPass({ ...result.chalet_check_in, email_sent: result.email?.sent === true, email_reason: result.email?.reason });
        setIsCheckInPassOpen(true);
        toast({
          title: 'Checked In',
          description: result.email?.sent
            ? `${customerName} was checked in and QR email was sent to ${result.email.sent_count || 1} recipient${(result.email.sent_count || 1) === 1 ? '' : 's'}.`
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
            additional_guests: getFilledAdditionalGuests(),
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
      setLastSettlement(null);
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

  const handleAddDiscount = async () => {
    if (!billData || !discountDesc.trim() || !discountAmount) return;
    const value = parseFloat(discountAmount);
    if (!Number.isFinite(value) || value <= 0) {
      toast({ variant: 'destructive', title: 'Invalid Discount', description: 'Enter a discount amount greater than zero.' });
      return;
    }

    const resolvedAmount = discountType === 'percentage'
      ? billData.totalOutstanding * value / 100
      : value;

    if (discountType === 'percentage' && value > 100) {
      toast({ variant: 'destructive', title: 'Invalid Discount', description: 'Percentage discount cannot be more than 100%.' });
      return;
    }

    if (resolvedAmount > billData.totalOutstanding) {
      toast({ variant: 'destructive', title: 'Invalid Discount', description: 'Discount cannot be greater than the current outstanding bill.' });
      return;
    }

    setIsAddingDiscount(true);
    try {
      const res = await fetch('/api/admin/service-incomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: discountType === 'percentage'
            ? `${discountDesc.trim()} (${value}% discount)`
            : discountDesc.trim(),
          amount: -Math.abs(resolvedAmount),
          service_type: 'Discount',
          date: new Date().toISOString().split('T')[0],
          customer_id: billData.customer.id,
          customer_name: billData.customer.name,
          payment_status: 'add_to_bill',
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      toast({ title: 'Discount Added', description: `${discountDesc.trim()} applied to the bill.` });
      setDiscountDesc('');
      setDiscountAmount('');
      setDiscountType('fixed');
      handleSelectCustomerForBill(billData.customer);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsAddingDiscount(false);
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
    setAssignedRoomIds(getBookingRoomSlots(booking).map(slot => slot.roomId || ''));
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
    if (!roomAssignmentBooking) return;
    const slots = getBookingRoomSlots(roomAssignmentBooking);
    const selectedRoomIds = assignedRoomIds.filter(Boolean);
    if (selectedRoomIds.length !== slots.length) {
      toast({ variant: 'destructive', title: 'Room Required', description: 'Please assign a room for each requested room.' });
      return;
    }
    if (new Set(selectedRoomIds).size !== selectedRoomIds.length) {
      toast({ variant: 'destructive', title: 'Duplicate Room', description: 'Each requested room must use a different chalet.' });
      return;
    }
    for (const [index, roomId] of selectedRoomIds.entries()) {
      const slot = slots[index];
      const room = assignableRooms.find(item => item.id === roomId);
      if (slot.categoryId && room?.category_id !== slot.categoryId) {
        toast({ variant: 'destructive', title: 'Room Type Mismatch', description: 'Please choose a chalet from the requested room type.' });
        return;
      }
      if (!isRoomAssignable(roomId, roomAssignmentBooking, slot)) {
        toast({ variant: 'destructive', title: 'Room Unavailable', description: 'Please choose available chalet rooms for this booking date range.' });
        return;
      }
    }
    const roomAllocations = slots.map((slot, index) => ({
      roomId: selectedRoomIds[index],
      roomCategoryId: slot.categoryId || null,
      packageId: slot.packageId || null,
      adults: slot.adults,
      children: slot.children,
    }));
    setIsAssigningRoom(true);
    try {
      const res = await fetch('/api/chalet/bookings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: roomAssignmentBooking.id,
          room_id: selectedRoomIds[0],
          room_ids: selectedRoomIds,
          room_allocations: roomAllocations,
          room_packages: Object.fromEntries(roomAllocations.map(allocation => [allocation.roomId, allocation.packageId])),
          room_guests: Object.fromEntries(roomAllocations.map(allocation => [allocation.roomId, { adults: allocation.adults, children: allocation.children }])),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign room');
      toast({ title: 'Room Assigned', description: `${selectedRoomIds.length} room${selectedRoomIds.length === 1 ? '' : 's'} assigned to ${roomAssignmentBooking.customer_name}.` });
      setRoomAssignmentOpen(false);
      setRoomAssignmentBooking(null);
      setAssignedRoomIds([]);
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
      setLastSettlement({
        billNumber: data.bill_number || null,
        method: paymentMethod,
        amount: billData.totalOutstanding,
        cashReceived: paymentMethod === 'cash' ? (parseFloat(cashReceived) || null) : null,
        paidAt: data.paid_at || new Date().toISOString(),
      });

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
      setCustomers(current => current.map(customer =>
        customer.id === billData.customer.id
          ? { ...customer, outstanding_total: 0 }
          : customer
      ));
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

  const loadGuestPayments = async (row: ArrivalRow) => {
    setViewGuestPayments(null);
    setIsLoadingGuestPayments(true);
    try {
      const res = await fetch(`/api/admin/front-desk/guest-payments?type=${row.type}&record_id=${encodeURIComponent(row.item.id)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setViewGuestPayments(data);
    } catch (error) {
      console.error(error);
      setViewGuestPayments({ payments: [], total: 0 });
    } finally {
      setIsLoadingGuestPayments(false);
    }
  };

  const handleViewGuest = async (row: ArrivalRow) => {
    setViewGuestRow(row);
    setViewGuestCustomer(null);
    setIsGuestDetailOpen(true);
    void loadGuestPayments(row);

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
      row.item.chalet_rooms?.room_number?.toLowerCase().includes(q) ||
      getChaletBookingRoomText(row.item)?.toLowerCase().includes(q)
    );
  };

  const getChaletBookingRoomIds = (booking: ChaletBooking) => {
    if (Array.isArray(booking.room_ids) && booking.room_ids.length > 0) return booking.room_ids.filter(Boolean);
    const allocationIds = Array.isArray(booking.room_allocations)
      ? booking.room_allocations.map(allocation => allocation.roomId || (allocation as any).room_id).filter(Boolean)
      : [];
    return allocationIds.length ? allocationIds : booking.room_id ? [booking.room_id] : [];
  };

  const allocationValue = (allocation: Record<string, any>, camelKey: string, snakeKey: string) => allocation?.[camelKey] ?? allocation?.[snakeKey] ?? null;

  const getBookingRoomSlots = (booking: ChaletBooking) => {
    if (Array.isArray(booking.room_allocations) && booking.room_allocations.length > 0) {
      return booking.room_allocations.map((allocation, index) => {
        const roomId = allocationValue(allocation as Record<string, any>, 'roomId', 'room_id') || getChaletBookingRoomIds(booking)[index] || '';
        const room = chaletRooms.find(item => item.id === roomId);
        return {
          key: `${booking.id}-allocation-${index}`,
          roomId,
          room,
          categoryId: room?.category_id || allocationValue(allocation as Record<string, any>, 'roomCategoryId', 'room_category_id') || booking.room_category_id || '',
          packageId: allocationValue(allocation as Record<string, any>, 'packageId', 'package_id') || booking.room_packages?.[roomId] || booking.package_id || '',
          adults: Number(allocation.adults ?? (index === 0 ? booking.adults : 1) ?? 1),
          children: Number(allocation.children ?? (index === 0 ? booking.children : 0) ?? 0),
        };
      });
    }

    const roomIds = getChaletBookingRoomIds(booking);
    const roomCount = Math.max(1, roomIds.length);
    return Array.from({ length: roomCount }, (_, index) => {
      const roomId = roomIds[index] || '';
      const room = chaletRooms.find(item => item.id === roomId);
      return {
        key: `${booking.id}-room-${index}`,
        roomId,
        room,
        categoryId: room?.category_id || booking.room_category_id || '',
        packageId: booking.room_packages?.[roomId] || booking.package_id || '',
        adults: index === 0 ? booking.adults ?? 1 : booking.room_guests?.[roomId]?.adults ?? 1,
        children: index === 0 ? booking.children ?? 0 : booking.room_guests?.[roomId]?.children ?? 0,
      };
    });
  };

  const getSlotCategoryName = (slot: ReturnType<typeof getBookingRoomSlots>[number], booking: ChaletBooking) => (
    chaletRoomCategories.find(category => category.id === slot.categoryId)?.name ||
    slot.room?.chalet_room_categories?.name ||
    booking.chalet_room_categories?.name ||
    'Room type'
  );

  const getSlotPackageName = (slot: ReturnType<typeof getBookingRoomSlots>[number], booking: ChaletBooking) => (
    chaletPackages.find(pkg => pkg.id === slot.packageId)?.name ||
    booking.chalet_packages?.name ||
    'Package'
  );

  const renderChaletRoomAllocation = (booking: ChaletBooking, compact = false) => {
    const slots = getBookingRoomSlots(booking);
    if (slots.length === 0 || (slots.length === 1 && !slots[0].roomId)) {
      return <span className="text-muted-foreground italic">Unassigned</span>;
    }

    return (
      <div className="space-y-1">
        {slots.map((slot, index) => (
          <div key={slot.key} className="text-sm">
            <div className="font-medium">
              {slot.room ? `Chalet ${slot.room.room_number} — ${slot.room.name}` : getChaletRoomLabel(slot.roomId)}
            </div>
            <div className="text-xs text-muted-foreground">
              {getSlotCategoryName(slot, booking)} · {getSlotPackageName(slot, booking)}
              {!compact && ` · ${slot.adults} adult${slot.adults === 1 ? '' : 's'} · ${slot.children} child${slot.children === 1 ? '' : 'ren'}`}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // In-House table: rooms grouped by room type + package, one line each,
  // e.g. "Chalet 01, Chalet 02" / "Superior Duplex King · Room Only · 2 adults".
  const renderChaletRoomsCompact = (booking: ChaletBooking) => {
    const groups = new Map<string, { rooms: string[]; detail: string; guests: number }>();
    getBookingRoomSlots(booking).forEach(slot => {
      const key = `${slot.categoryId}|${slot.packageId}`;
      const group = groups.get(key) || { rooms: [], detail: `${getSlotCategoryName(slot, booking)} · ${getSlotPackageName(slot, booking)}`, guests: 0 };
      group.rooms.push(slot.room ? `Chalet ${slot.room.room_number}` : slot.roomId ? getChaletRoomShortLabel(slot.roomId) : 'Unassigned');
      group.guests += Number(slot.adults || 0) + Number(slot.children || 0);
      groups.set(key, group);
    });
    return (
      <div className="space-y-1.5">
        {Array.from(groups.values()).map(group => (
          <div key={group.detail} className="leading-tight">
            <div className="font-medium">{group.rooms.join(', ')}</div>
            <div className="text-xs text-muted-foreground">{group.detail} · {group.guests} guest{group.guests === 1 ? '' : 's'}</div>
          </div>
        ))}
      </div>
    );
  };

  const formatStayDate = (value: string) => new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });

  const renderStay = (checkIn: string, checkOut: string, checkInTime?: string | null) => {
    const nights = Math.max(0, Math.round((new Date(checkOut.slice(0, 10)).getTime() - new Date(checkIn.slice(0, 10)).getTime()) / 86400000));
    return (
      <div className="whitespace-nowrap leading-tight">
        <div className="font-medium">{formatStayDate(checkIn)} → {formatStayDate(checkOut)}</div>
        <div className="text-xs text-muted-foreground">
          {nights} night{nights === 1 ? '' : 's'}
          {checkInTime ? ` · in ${new Date(checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
        </div>
      </div>
    );
  };

  // Total with what is paid and still owed, in the booking currency.
  const renderChaletBillStatus = (booking: ChaletBooking) => {
    const total = getChaletBillTotal(booking);
    const exchangeRate = getChaletExchangeRate(booking);
    const paidLkr = chaletPaidLkr(booking, chaletRates);
    const paid = getChaletBillCurrency(booking) === 'USD' && exchangeRate > 0 ? paidLkr / exchangeRate : paidLkr;
    const balance = booking.payment_status === 'paid' ? 0 : Math.max(0, total - paid);
    return (
      <div className="space-y-0.5 text-right leading-tight">
        <div className="font-semibold">{renderChaletMoney(booking, total)}</div>
        {balance <= 0.009 ? (
          <Badge className="bg-green-100 text-green-800 border-green-200">Paid in full</Badge>
        ) : (
          <>
            {paid > 0 && <div className="text-xs text-green-700">Paid {formatMoney(paid, getChaletBillCurrency(booking))}</div>}
            <div className="text-xs font-medium text-amber-700">Due {formatMoney(balance, getChaletBillCurrency(booking))}</div>
          </>
        )}
      </div>
    );
  };

  const getChaletAllocationPrintLines = (booking: ChaletBooking) => getBookingRoomSlots(booking)
    .filter(slot => slot.roomId)
    .map(slot => {
      const room = slot.room ? `Chalet ${slot.room.room_number}` : getChaletRoomShortLabel(slot.roomId);
      return `${room} - ${getSlotCategoryName(slot, booking)} - ${getSlotPackageName(slot, booking)}`;
    });

  const isRoomAssignable = (roomId: string, booking: ChaletBooking, slot?: ReturnType<typeof getBookingRoomSlots>[number]) => {
    const room = assignableRooms.find(item => item.id === roomId);
    if (!room || room.status === 'maintenance') return false;
    if (slot?.categoryId && room.category_id !== slot.categoryId) return false;
    const adults = Number(slot?.adults ?? 1);
    const children = Number(slot?.children ?? 0);
    const category = room.chalet_room_categories;
    const maxAdults = room.max_adults ?? category?.max_adults;
    const maxChildren = room.max_children ?? category?.max_children;
    const maxGuests = room.max_guests ?? category?.max_guests;
    if (maxAdults != null && adults > maxAdults) return false;
    if (maxChildren != null && children > maxChildren) return false;
    if (maxGuests != null && adults + children > maxGuests) return false;
    return ![...chaletArrivals, ...chaletInHouse, ...historyChalet].some(other => {
      if (other.id === booking.id || other.status === 'cancelled') return false;
      const overlaps = other.check_in_date < booking.check_out_date && other.check_out_date > booking.check_in_date;
      return overlaps && getChaletBookingRoomIds(other).includes(roomId);
    });
  };

  const getAssignableRoomLabel = (roomId: string, booking: ChaletBooking, slot: ReturnType<typeof getBookingRoomSlots>[number], selectedInOtherRows: Set<string>, assignedRoomId?: string) => {
    if (assignedRoomId === roomId) return 'Assigned';
    if (selectedInOtherRows.has(roomId)) return 'Already selected in this booking';
    return isRoomAssignable(roomId, booking, slot) ? 'Available' : 'Unavailable';
  };

  const getChaletRoomLabel = (roomId: string) => {
    const room = assignableRooms.find(item => item.id === roomId) || chaletRooms.find(item => item.id === roomId);
    if (!room) return 'Chalet';
    return `Chalet ${room.room_number} — ${room.name}`;
  };

  const getChaletRoomShortLabel = (roomId: string) => {
    const room = assignableRooms.find(item => item.id === roomId) || chaletRooms.find(item => item.id === roomId);
    if (!room) return 'Chalet';
    return `Chalet ${room.room_number}`;
  };

  const getChaletBookingRoomText = (booking: ChaletBooking) => {
    const roomIds = getChaletBookingRoomIds(booking);
    if (roomIds.length === 0) return null;
    if (booking.chalet_rooms && roomIds.length === 1) {
      return `Chalet ${booking.chalet_rooms.room_number} — ${booking.chalet_rooms.name}`;
    }
    if (booking.chalet_rooms && booking.room_id && roomIds.includes(booking.room_id)) {
      const others = roomIds.length - 1;
      return `Chalet ${booking.chalet_rooms.room_number} — ${booking.chalet_rooms.name}${others > 0 ? ` + ${others} more` : ''}`;
    }
    const labels = roomIds.map(getChaletRoomLabel);
    return labels.every(label => label !== 'Chalet') ? labels.join(', ') : `${roomIds.length} room${roomIds.length === 1 ? '' : 's'} assigned`;
  };

  const getChaletBookingRoomShortText = (booking: ChaletBooking) => {
    const roomIds = getChaletBookingRoomIds(booking);
    if (roomIds.length === 0) return null;
    if (booking.chalet_rooms && roomIds.length === 1) return `Chalet ${booking.chalet_rooms.room_number}`;
    const labels = roomIds.map(id => {
      if (booking.room_id === id && booking.chalet_rooms?.room_number) return `Chalet ${booking.chalet_rooms.room_number}`;
      return getChaletRoomShortLabel(id);
    });
    return labels.join(', ');
  };

  const arrivalRows: ArrivalRow[] = [
    ...reservations.map((item): ArrivalRow => ({ type: 'reservation', item })),
    ...chaletArrivals.map((item): ArrivalRow => ({ type: 'chalet', item })),
  ]
    .sort((a, b) => new Date(a.item.check_in_date).getTime() - new Date(b.item.check_in_date).getTime())
    .filter((row) => matchesRow(row, arrivalSearch, arrivalTypeFilter))
    .filter(row => matchesDateRange(row.item.check_in_date, arrivalFrom, arrivalTo));

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
    .filter((row) => matchesRow(row, inHouseSearch, inHouseTypeFilter))
    .filter(row => (!inHouseFrom || row.item.check_out_date.slice(0, 10) >= inHouseFrom)
      && (!inHouseTo || row.item.check_in_date.slice(0, 10) <= inHouseTo));

  const billingCustomers = customers.filter(customer => (!billingFrom && !billingTo)
    || (customer.checkout_dates || []).some((date: string) => matchesDateRange(date, billingFrom, billingTo)));

  const formatMoney = (amount: number, currency: 'LKR' | 'USD' = 'LKR') => `${currency} ${Number(amount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const customerBillCurrency = (nationality?: string | null): 'LKR' | 'USD' => (
    nationality === 'Non Sri Lankan' ? 'USD' : 'LKR'
  );

  const appliesLabel = (chargeCurrency: 'LKR' | 'USD' | 'both' | undefined) => (
    (chargeCurrency || 'both') === 'both' ? 'Both' : chargeCurrency
  );

  const findChaletRate = (booking: ChaletBooking) => {
    const allocation = Array.isArray(booking.room_allocations) ? booking.room_allocations[0] as any : null;
    const packageId = booking.package_id || allocation?.packageId || allocation?.package_id || '';
    const categoryId = booking.room_category_id || allocation?.roomCategoryId || allocation?.room_category_id || '';
    return chaletRates.find(rate =>
      rate.package_id === packageId &&
      !rate.occupancy_type_id &&
      (rate.room_category_id || '') === (categoryId || '')
    ) || chaletRates.find(rate =>
      rate.package_id === packageId &&
      !rate.occupancy_type_id &&
      !rate.room_category_id
    );
  };

  const convertedPreviewAmount = (amount: number, currency: 'LKR' | 'USD', exchangeRate: number) => (
    currency === 'USD' && exchangeRate > 0 ? amount * exchangeRate : amount
  );

  const formatPreviewAmount = (amount: number, currency: 'LKR' | 'USD', exchangeRate: number) => {
    if (currency === 'USD' && exchangeRate > 0) {
      return `${formatMoney(amount, 'USD')} (${formatMoney(convertedPreviewAmount(amount, currency, exchangeRate), 'LKR')})`;
    }
    return formatMoney(amount, 'LKR');
  };

  const getChaletBillCurrency = (booking: ChaletBooking): 'LKR' | 'USD' => (
    booking.currency || customerBillCurrency(booking.nationality)
  );

  // The rate locked on the booking when it was made, else the current rate.
  const getChaletExchangeRate = (booking: ChaletBooking) => (
    Number((booking as ChaletBooking & { usd_to_lkr_rate?: number | null }).usd_to_lkr_rate || 0) ||
    Number(findChaletRate(booking)?.usd_to_lkr_rate || 0)
  );

  const renderChaletMoney = (booking: ChaletBooking, amount: number, className = '') => {
    const currency = getChaletBillCurrency(booking);
    const exchangeRate = getChaletExchangeRate(booking);
    if (currency !== 'USD') {
      return <span className={className}>{formatMoney(amount, 'LKR')}</span>;
    }

    const lkrAmount = exchangeRate > 0 ? amount * exchangeRate : amount;
    return (
      <span className={className}>
        <span className="block">{formatMoney(amount, 'USD')}</span>
        <span className="block text-xs text-muted-foreground">{formatMoney(lkrAmount, 'LKR')}</span>
      </span>
    );
  };

  // The chalet bill in the booking's own currency: the booking form's saved
  // LKR total when present, otherwise calculated from the booking's prices and
  // charge settings (coupon, service charge, VAT, SSCL). The database's
  // grand_total only adds the service charge, so it is not used.
  const getChaletBillLines = (booking: ChaletBooking) => chaletBillLinesForDisplay(booking, chaletRates);
  const getChaletBillTotal = (booking: ChaletBooking) => getChaletBillLines(booking).total;

  // Amounts from the bill API are already in LKR; USD bookings also show USD.
  const renderChaletLkrMoney = (booking: ChaletBooking, amountLkr: number, className = '') => {
    const exchangeRate = getChaletExchangeRate(booking);
    if (getChaletBillCurrency(booking) !== 'USD' || exchangeRate <= 0) {
      return <span className={className}>{formatMoney(amountLkr, 'LKR')}</span>;
    }
    return (
      <span className={className}>
        <span className="block">{formatMoney(amountLkr / exchangeRate, 'USD')}</span>
        <span className="block text-xs text-muted-foreground">{formatMoney(amountLkr, 'LKR')}</span>
      </span>
    );
  };

  const chaletBillAmounts = (booking: ChaletBooking) => {
    const values = booking as ChaletBooking & { bill_total_lkr_resolved?: number; paid_lkr?: number; outstanding_lkr?: number };
    return {
      total: Number(values.bill_total_lkr_resolved ?? chaletTotalLkr(booking, chaletRates)),
      paid: Number(values.paid_lkr || 0),
      outstanding: Number(values.outstanding_lkr ?? 0),
    };
  };

  type ChaletBillDetails = {
    bill_breakdown?: {
      nights: number;
      rate_per_night: number;
      subtotal: number;
      coupon_code: string | null;
      coupon_discount: number;
      charges: { label: string; pct: number; amount: number }[];
      total: number;
    } | null;
    payments?: { id: string; paid_at: string | null; payment_method: string | null; amount: number; account_name: string | null; label: string }[];
  };

  const chaletBillDetails = (booking: ChaletBooking) => booking as ChaletBooking & ChaletBillDetails;

  const paymentMethodLabel = (method: string | null) => (
    method ? method.replace('_', ' ').replace(/^\w/, letter => letter.toUpperCase()) : 'Payment'
  );

  // Full chalet bill (charges per the booking's settings) and every payment
  // already made on it, so the front desk sees how the balance was reached.
  const renderChaletBillDetails = (booking: ChaletBooking) => {
    const { bill_breakdown: breakdown, payments = [] } = chaletBillDetails(booking);
    return (
      <div className="mt-2 space-y-2 text-xs">
        {breakdown ? (
          <div className="space-y-0.5 rounded-md bg-muted/40 p-2">
            <div className="flex justify-between gap-4 text-muted-foreground">
              <span>Rooms {renderChaletLkrMoney(booking, breakdown.rate_per_night)} / night × {breakdown.nights} night{breakdown.nights !== 1 ? 's' : ''}</span>
              {renderChaletLkrMoney(booking, breakdown.subtotal, 'text-right')}
            </div>
            {breakdown.coupon_discount > 0 && (
              <div className="flex justify-between gap-4 text-muted-foreground">
                <span>Coupon{breakdown.coupon_code ? ` (${breakdown.coupon_code})` : ''}</span>
                <span className="text-right">-{renderChaletLkrMoney(booking, breakdown.coupon_discount)}</span>
              </div>
            )}
            {breakdown.charges.map(charge => (
              <div key={charge.label} className="flex justify-between gap-4 text-muted-foreground">
                <span>{charge.label} ({charge.pct}%)</span>
                {renderChaletLkrMoney(booking, charge.amount, 'text-right')}
              </div>
            ))}
            <div className="flex justify-between gap-4 border-t pt-1 font-semibold">
              <span>Chalet Bill Total</span>
              {renderChaletLkrMoney(booking, breakdown.total, 'text-right')}
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground">
            Package price: {renderChaletMoney(booking, Number(booking.rate_per_night || 0))} / night × {booking.nights} night{booking.nights !== 1 ? 's' : ''} + {booking.service_charge_pct}% service charge
          </div>
        )}
        {payments.length > 0 && (
          <div className="space-y-0.5 rounded-md border border-green-200 bg-green-50 p-2 text-green-800">
            <div className="font-semibold">Payments received</div>
            {payments.map(payment => (
              <div key={payment.id} className="flex justify-between gap-4">
                <span>
                  {payment.paid_at ? new Date(payment.paid_at).toLocaleDateString() : payment.label} · {paymentMethodLabel(payment.payment_method)}
                  {payment.account_name ? ` → ${payment.account_name}` : payment.payment_method === 'cash' ? ' → Front Desk cash' : ''}
                </span>
                {renderChaletLkrMoney(booking, payment.amount, 'text-right')}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── Printed guest documents (A4) ─────────────────────────────────────────
  const invoiceDate = (value?: string | null) => value ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '';

  // Guest folio for the open bill, or the receipt once it has been settled.
  const buildFolioInvoice = (): GuestInvoiceProps | null => {
    if (!billData) return null;
    const lines: InvoiceLine[] = [];
    const payments: InvoicePayment[] = [];
    let hasUsdChalet = false;

    billData.reservations.forEach(res => {
      const title = res.room?.title || 'Room';
      lines.push({
        category: 'Accommodation',
        description: `Room — ${title}`,
        detail: `${invoiceDate(res.check_in_date)} – ${invoiceDate(res.check_out_date)}`,
        amount: Number(res.total_cost || 0),
      });
      if (res.payment_status === 'paid') payments.push({ label: `Room ${title}`, amount: Number(res.total_cost || 0) });
    });

    billData.chaletBookings.forEach(cb => {
      const amounts = chaletBillAmounts(cb);
      const { bill_breakdown: breakdown, payments: chaletPayments = [] } = chaletBillDetails(cb);
      const exchangeRate = getChaletExchangeRate(cb);
      const isUsd = getChaletBillCurrency(cb) === 'USD' && exchangeRate > 0;
      if (isUsd) hasUsdChalet = true;
      lines.push({
        category: 'Accommodation',
        description: `Chalet — ${getChaletAllocationPrintLines(cb).join('; ') || getChaletBookingRoomShortText(cb) || 'Chalet stay'}`,
        detail: [
          cb.booking_ref,
          `${invoiceDate(cb.check_in_date)} – ${invoiceDate(cb.check_out_date)}`,
          isUsd ? `USD ${(amounts.total / exchangeRate).toFixed(2)} at 1 USD = LKR ${exchangeRate.toFixed(2)}` : '',
        ].filter(Boolean).join(' · '),
        subLines: breakdown ? [
          { label: `Room rate × ${breakdown.nights} night${breakdown.nights === 1 ? '' : 's'}`, amount: breakdown.subtotal },
          ...(breakdown.coupon_discount > 0 ? [{ label: `Coupon${breakdown.coupon_code ? ` (${breakdown.coupon_code})` : ''}`, amount: -breakdown.coupon_discount }] : []),
          ...breakdown.charges.map(charge => ({ label: `${charge.label} (${charge.pct}%)`, amount: charge.amount })),
        ] : undefined,
        amount: amounts.total,
      });
      chaletPayments.forEach(payment => payments.push({
        date: payment.paid_at,
        label: `${cb.booking_ref} ${payment.label === 'Booking payment' ? 'deposit' : payment.label.toLowerCase()}`,
        method: payment.payment_method,
        amount: payment.amount,
      }));
    });

    billData.orders.forEach(ord => {
      const breakdown = (ord as any).bill_breakdown as Record<string, number> | null | undefined;
      const subLines = breakdown ? [
        { label: 'Food & beverage', amount: Number(breakdown.subtotal || 0) },
        ...(Number(breakdown.discount_total || 0) > 0 ? [{ label: 'Discount', amount: -Number(breakdown.discount_total) }] : []),
        ...(Number(breakdown.service_charge_total || 0) > 0 ? [{ label: 'Service charge', amount: Number(breakdown.service_charge_total) }] : []),
        ...(Number(breakdown.other_charge_total || 0) > 0 ? [{ label: 'Other charges', amount: Number(breakdown.other_charge_total) }] : []),
        ...(Number(breakdown.vat_amount || 0) > 0 ? [{ label: `VAT${breakdown.vat_rate ? ` (${breakdown.vat_rate}%)` : ''}`, amount: Number(breakdown.vat_amount) }] : []),
      ] : undefined;
      lines.push({
        category: 'Restaurant',
        description: `Restaurant bill ${(ord as any).bill_number || `#${ord.id.substring(0, 8).toUpperCase()}`}`,
        detail: invoiceDate(ord.created_at),
        subLines,
        amount: Number(ord.confirmed_total ?? ord.total_price ?? 0),
      });
    });

    billData.serviceIncomes.forEach(svc => {
      lines.push({
        category: 'Services',
        description: `${svc.service_type}: ${svc.description}`,
        detail: invoiceDate((svc as any).date),
        subLines: svc.line_items?.length ? svc.line_items.map(item => ({ label: item.description, amount: Number(item.amount || 0) })) : undefined,
        amount: Number(svc.amount || 0),
      });
    });

    const totalCharges = lines.reduce((sum, line) => sum + line.amount, 0);
    const settled = billData.totalOutstanding <= 0.009 && lastSettlement ? lastSettlement : null;
    const amountDueBefore = settled ? settled.amount : billData.totalOutstanding;
    // Anything paid that isn't listed (older payments, adjustments).
    const paidBefore = Math.max(0, totalCharges - amountDueBefore);
    const listed = payments.reduce((sum, payment) => sum + payment.amount, 0);
    if (paidBefore - listed > 0.01) payments.push({ label: 'Other payments / adjustments', amount: paidBefore - listed });

    const stayDates = [
      ...billData.reservations.map(res => [res.check_in_date, res.check_out_date]),
      ...billData.chaletBookings.map(cb => [cb.check_in_date, cb.check_out_date]),
    ].filter(([checkIn, checkOut]) => checkIn && checkOut);
    const rooms = [
      ...billData.reservations.map(res => res.room?.title).filter(Boolean),
      ...billData.chaletBookings.map(cb => getChaletBookingRoomShortText(cb)).filter(Boolean),
    ].join(', ');
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    return {
      title: billData.totalOutstanding > 0.009 ? 'Guest Folio' : 'Receipt',
      status: billData.totalOutstanding > 0.009 ? 'BALANCE DUE' : 'PAID',
      documentNumber: settled?.billNumber || `FOLIO-${today}-${billData.customer.id.slice(0, 6).toUpperCase()}`,
      issuedAt: settled?.paidAt || new Date().toISOString(),
      guest: {
        name: billData.customer.name,
        phone: billData.customer.phone,
        email: billData.customer.email,
        idNumber: (billData.customer as any).id_number,
        address: billData.customer.address,
      },
      stay: stayDates.length ? {
        checkIn: stayDates.map(([checkIn]) => checkIn).sort()[0],
        checkOut: stayDates.map(([, checkOut]) => checkOut).sort().slice(-1)[0],
        rooms,
      } : { rooms },
      lines,
      payments,
      totalCharges,
      settlement: settled ? {
        method: settled.method,
        amount: settled.amount,
        cashReceived: settled.cashReceived,
        change: settled.cashReceived != null ? Math.max(0, settled.cashReceived - settled.amount) : null,
      } : null,
      balanceDue: billData.totalOutstanding,
      notes: hasUsdChalet ? ['USD chalet charges are shown in LKR at the exchange rate locked on the booking.'] : [],
    };
  };

  // Receipt for a past (settled) bill.
  const buildHistoryInvoice = (): GuestInvoiceProps | null => {
    if (!historyBill) return null;
    const categoryOf = (category?: string) => category === 'Room' || category === 'Chalet' ? 'Accommodation' : category === 'Restaurant' ? 'Restaurant' : 'Services';
    const lines: InvoiceLine[] = (historyBill.items || []).map((item: any) => ({
      category: categoryOf(item.category),
      description: item.description,
      subLines: item.line_items?.length ? item.line_items.map((line: any) => ({ label: line.description, amount: Number(line.amount || 0) })) : undefined,
      amount: Number(item.amount || 0),
    }));
    const total = Number(historyBill.total || 0);
    return {
      title: 'Receipt',
      status: 'PAID',
      documentNumber: historyBill.number,
      issuedAt: historyBill.paid_at || historyBill.check_out_date || new Date().toISOString(),
      guest: {
        name: historyBill.customer?.name || 'Guest',
        phone: historyBill.customer?.phone,
        email: historyBill.customer?.email,
        idNumber: historyBill.customer?.id_number,
        address: historyBill.customer?.address,
      },
      stay: { checkIn: historyBill.check_in_date, checkOut: historyBill.check_out_date },
      lines,
      payments: [],
      totalCharges: lines.reduce((sum, line) => sum + line.amount, 0),
      settlement: { method: historyBill.payment_method || 'payment', amount: total },
      balanceDue: 0,
    };
  };

  const getCheckInBillPreview = () => {
    if (selectedReservation) {
      const total = Number(selectedReservation.total_cost || 0);
      const paid = selectedReservation.payment_status === 'paid' ? total : 0;
      return {
        title: selectedReservation.room?.title || selectedReservation.room_title || 'Room charge',
        subtitle: `${new Date(selectedReservation.check_in_date).toLocaleDateString()} to ${new Date(selectedReservation.check_out_date).toLocaleDateString()}`,
        lines: [
          { label: 'Room total', value: total },
        ],
        currency: 'LKR' as const,
        exchangeRate: 0,
        total,
        totalLkr: total,
        paid,
        paidLkr: paid,
        balance: Math.max(0, total - paid),
        balanceLkr: Math.max(0, total - paid),
        paymentStatus: selectedReservation.payment_status || 'unpaid',
      };
    }

    if (selectedChaletBooking) {
      const booking = selectedChaletBooking as ChaletBooking & { total_amount?: number };
      const currency = getChaletBillCurrency(booking);
      const exchangeRate = getChaletExchangeRate(booking);
      const nights = Number(booking.nights || booking.total_nights || 0);
      const billLines = getChaletBillLines(booking);
      const subtotal = billLines.subtotal;
      const coupon = billLines.couponDiscount;
      const total = getChaletBillTotal(booking);
      // Paid amount is kept in LKR; show it in the booking currency.
      const paidInLkr = chaletPaidLkr(booking, chaletRates);
      const paid = currency === 'USD' && exchangeRate > 0 ? paidInLkr / exchangeRate : paidInLkr;
      const totalLkr = convertedPreviewAmount(total, currency, exchangeRate);
      const paidLkr = convertedPreviewAmount(paid, currency, exchangeRate);
      const balance = Math.max(0, total - paid);
      return {
        title: getChaletBookingRoomShortText(booking) || 'Chalet charge',
        subtitle: `${booking.booking_ref} · ${new Date(booking.check_in_date).toLocaleDateString()} to ${new Date(booking.check_out_date).toLocaleDateString()}`,
        lines: [
          { label: `Rate per night x ${nights}`, value: subtotal },
          ...(coupon > 0 ? [{ label: `Coupon discount${booking.coupon_code ? ` (${booking.coupon_code})` : ''}`, value: -coupon }] : []),
          // Percent and "applies to" come from the bill lines (Chalet Bill Settings).
          ...billLines.charges.map(charge => ({
            label: `${charge.label === 'Service Charge' ? 'Service charge' : charge.label} (${charge.pct}% · ${appliesLabel(charge.appliesTo as 'LKR' | 'USD' | 'both')})`,
            value: charge.amount,
          })),
        ],
        currency,
        exchangeRate,
        total,
        totalLkr,
        paid,
        paidLkr,
        balance,
        balanceLkr: convertedPreviewAmount(balance, currency, exchangeRate),
        paymentStatus: booking.payment_status || (paid >= total && total > 0 ? 'paid' : 'unpaid'),
      };
    }

    return null;
  };

  const rowPrice = (row: ArrivalRow) => row.type === 'reservation'
    ? Number(row.item.total_cost || 0)
    : chaletTotalLkr(row.item, chaletRates);

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
            <DateRangeFilter label="Arrival date" from={arrivalFrom} to={arrivalTo} onFromChange={setArrivalFrom} onToChange={setArrivalTo} />
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
                      <TableHead>Package / Room Type</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead>Check-out</TableHead>
                      <TableHead className="text-right">Bill</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <PaginatedTableBody showSinglePage key={JSON.stringify([arrivalSearch, arrivalTypeFilter, arrivalFrom, arrivalTo])}>
                    {arrivalRows.map((row) => row.type === 'reservation' ? (
                      <TableRow key={`res-${row.item.id}`}>
                        <TableCell><Badge variant="outline">Reservation</Badge></TableCell>
                        <TableCell className="font-medium">{row.item.guest_name}</TableCell>
                        <TableCell>{row.item.room?.title || 'Unassigned'}</TableCell>
                        <TableCell className="text-muted-foreground">—</TableCell>
                        <TableCell>{new Date(row.item.check_in_date).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(row.item.check_out_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right font-medium">{formatMoney(Number(row.item.total_cost || 0), 'LKR')}</TableCell>
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
                          {renderChaletRoomAllocation(row.item)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {getBookingRoomSlots(row.item).map(slot => (
                            <div key={slot.key} className="mb-1 last:mb-0">
                              <div className="font-medium">{getSlotPackageName(slot, row.item)}</div>
                              <div className="text-xs text-muted-foreground">{getSlotCategoryName(slot, row.item)}</div>
                            </div>
                          ))}
                        </TableCell>
                        <TableCell>{new Date(row.item.check_in_date).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(row.item.check_out_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right font-medium">{renderChaletMoney(row.item, getChaletBillTotal(row.item))}</TableCell>
                        <TableCell className="text-right">
                          {getChaletBookingRoomIds(row.item).length > 0 ? (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline" onClick={() => openRoomAssignment(row.item)}>Rooms</Button>
                              <Button size="sm" onClick={() => handleOpenChaletCheckIn(row.item)}>Check In</Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => openRoomAssignment(row.item)}>Assign Room</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </PaginatedTableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          <TabsContent value="in-house">
            <DateRangeFilter label="Stay overlaps dates" from={inHouseFrom} to={inHouseTo} onFromChange={setInHouseFrom} onToChange={setInHouseTo} />
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
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guest</TableHead>
                      <TableHead>Rooms</TableHead>
                      <TableHead>Stay</TableHead>
                      <TableHead>QR</TableHead>
                      <TableHead className="text-right">Bill</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <PaginatedTableBody showSinglePage key={JSON.stringify([inHouseSearch, inHouseTypeFilter, inHouseFrom, inHouseTo])}>
                    {inHouseRows.map((row) => {
                      const isChalet = row.type === 'chalet';
                      const qrCode = isChalet ? row.item.booking_ref : `RES:${row.item.id}`;
                      const guestName = isChalet ? row.item.customer_name : row.item.guest_name;
                      const roomText = isChalet ? (getChaletBookingRoomShortText(row.item) || 'Unassigned') : (row.item.room?.title || 'Unassigned');
                      const checkoutBlocked = isChalet
                        ? getChaletBillTotal(row.item) > 0 && row.item.payment_status !== 'paid'
                        : Number(row.item.total_cost) > 0 && row.item.payment_status !== 'paid';
                      return (
                        <TableRow key={`${row.type}-${row.item.id}`} className="align-top">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{guestName}</span>
                              {isChalet
                                ? <Badge className="bg-amber-100 text-amber-800 border-amber-200">Chalet</Badge>
                                : <Badge variant="outline">Reservation</Badge>}
                            </div>
                            {isChalet && <div className="font-mono text-xs text-muted-foreground">{row.item.booking_ref}</div>}
                          </TableCell>
                          <TableCell className="text-sm">
                            {isChalet ? renderChaletRoomsCompact(row.item) : <span className="font-medium">{roomText}</span>}
                          </TableCell>
                          <TableCell className="text-sm">
                            {renderStay(row.item.check_in_date, row.item.check_out_date, isChalet ? null : row.item.check_in_time)}
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              className="rounded focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                              onClick={() => setLargeGuestQr({ code: qrCode, guest: guestName, room: roomText })}
                              title="Click to enlarge QR"
                            >
                              <img
                                src={`/api/admin/front-desk/guest-pass?format=png&code=${encodeURIComponent(qrCode)}`}
                                alt={`QR pass for ${guestName}`}
                                className="h-12 w-12 rounded border bg-white p-0.5"
                              />
                            </button>
                          </TableCell>
                          <TableCell className="text-sm">
                            {isChalet ? renderChaletBillStatus(row.item) : (
                              <div className="space-y-0.5 text-right leading-tight">
                                <div className="font-semibold">{formatMoney(Number(row.item.total_cost || 0), 'LKR')}</div>
                                {row.item.payment_status === 'paid'
                                  ? <Badge className="bg-green-100 text-green-800 border-green-200">Paid in full</Badge>
                                  : <div className="text-xs font-medium text-amber-700">Due {formatMoney(Number(row.item.total_cost || 0), 'LKR')}</div>}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2 whitespace-nowrap">
                              <Button size="sm" variant="outline" onClick={() => handleMoveToBill(row)}>
                                Move to Bill
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => openCheckoutConfirm(row)}
                                disabled={checkoutBlocked}
                                title={checkoutBlocked ? 'Pay the bill before checking out' : undefined}
                              >
                                Check Out
                              </Button>
                              {/* modal={false}: a modal menu that opens a dialog leaves the page
                                  unclickable (pointer-events: none) after that dialog closes. */}
                              <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                  <Button size="sm" variant="ghost" className="px-2" aria-label="More actions">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleViewGuest(row)}>
                                    <Eye className="mr-2 h-4 w-4" /> View details
                                  </DropdownMenuItem>
                                  {isChalet && (
                                    <DropdownMenuItem onClick={() => openPackageMeals(row.item)}>
                                      <ChefHat className="mr-2 h-4 w-4" /> Package meals
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </PaginatedTableBody>
                </Table>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="check-out">
            <DateRangeFilter label="Scheduled checkout date" from={billingFrom} to={billingTo} onFromChange={setBillingFrom} onToChange={setBillingTo} />
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
                  {billingCustomers.map(c => (
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
                  {billingCustomers.length === 0 && (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      {customerSearch || billingFrom || billingTo ? 'No customer bills match your search or checkout dates.' : 'No outstanding customer bills.'}
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
                            <PaginatedTableBody showSinglePage>
                              {billData.reservations.map(res => (
                                <TableRow key={res.id}>
                                  <TableCell>{res.room?.title || 'Room'} ({new Date(res.check_in_date).toLocaleDateString()} to {new Date(res.check_out_date).toLocaleDateString()})</TableCell>
                                  <TableCell className="text-right">LKR {Number(res.total_cost || 0).toFixed(2)}</TableCell>
                                </TableRow>
                              ))}
                            </PaginatedTableBody>
                          </Table>
                        </div>
                      )}

                      {billData.chaletBookings.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-lg border-b pb-2 mb-3">Chalet Charges</h3>
                          <Table>
                            <PaginatedTableBody showSinglePage>
                              {billData.chaletBookings.map(cb => (
                                <TableRow key={cb.id}>
                                  <TableCell>
	                                    <div>{renderChaletRoomAllocation(cb, true)}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {new Date(cb.check_in_date).toLocaleDateString()} to {new Date(cb.check_out_date).toLocaleDateString()}
                                      </div>
                                    {renderChaletBillDetails(cb)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {chaletBillAmounts(cb).paid > 0 ? (
                                      <div className="space-y-1">
                                        <div className="text-xs text-muted-foreground">Total {renderChaletLkrMoney(cb, chaletBillAmounts(cb).total)}</div>
                                        <div className="text-xs text-green-700">Paid -{renderChaletLkrMoney(cb, chaletBillAmounts(cb).paid)}</div>
                                        <div className="font-semibold">Balance {renderChaletLkrMoney(cb, chaletBillAmounts(cb).outstanding)}</div>
                                      </div>
                                    ) : renderChaletLkrMoney(cb, chaletBillAmounts(cb).total)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </PaginatedTableBody>
                          </Table>
                        </div>
                      )}

                      {billData.orders.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-lg border-b pb-2 mb-3">Restaurant Orders</h3>
                          <Table>
                            <PaginatedTableBody showSinglePage>
                              {billData.orders.map(ord => (
                                <TableRow key={ord.id}>
                                  <TableCell>Order #{ord.id.substring(0,8).toUpperCase()} ({new Date(ord.created_at || '').toLocaleDateString()})</TableCell>
                                  <TableCell className="text-right">LKR {Number(ord.confirmed_total ?? ord.total_price ?? 0).toFixed(2)}</TableCell>
                                </TableRow>
                              ))}
                            </PaginatedTableBody>
                          </Table>
                        </div>
                      )}

                      {billData.serviceIncomes.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-lg border-b pb-2 mb-3">Extra Services</h3>
                          <Table>
                            <PaginatedTableBody showSinglePage>
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
                            </PaginatedTableBody>
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

                      <div className="pt-6 border-t print:hidden">
                        <h3 className="font-semibold text-lg mb-3">Add Discount</h3>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                          <Input
                            placeholder="Discount name (e.g. Loyalty Discount)"
                            value={discountDesc}
                            onChange={(e) => setDiscountDesc(e.target.value)}
                            className="sm:col-span-5"
                          />
                          <Select value={discountType} onValueChange={(value) => setDiscountType(value as 'fixed' | 'percentage')}>
                            <SelectTrigger className="sm:col-span-3">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fixed">Fixed (LKR)</SelectItem>
                              <SelectItem value="percentage">Percentage</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            min={0}
                            max={discountType === 'percentage' ? 100 : undefined}
                            step="0.01"
                            placeholder={discountType === 'percentage' ? '%' : 'Amount'}
                            value={discountAmount}
                            onChange={(e) => setDiscountAmount(e.target.value)}
                            className="sm:col-span-2"
                          />
                          <Button
                            variant="outline"
                            onClick={handleAddDiscount}
                            disabled={isAddingDiscount || !discountDesc.trim() || !discountAmount || billData.totalOutstanding <= 0}
                            className="sm:col-span-2"
                          >
                            {isAddingDiscount ? 'Adding...' : 'Add Discount'}
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
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input type="radio" checked={paymentMethod === 'online'} onChange={() => setPaymentMethod('online')} className="w-4 h-4 text-primary" />
                              <span>Online</span>
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
                  <PaginatedTableBody showSinglePage key={JSON.stringify([historySearch, historyTypeFilter, historyFrom, historyTo])}>
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
                          {renderChaletRoomAllocation(row.item)}
                        </TableCell>
                        <TableCell>{new Date(row.item.check_in_date).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(row.item.check_out_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right font-medium">{renderChaletMoney(row.item, getChaletBillTotal(row.item))}</TableCell>
                        <TableCell>
                          <Badge className={row.item.status === 'cancelled' ? 'bg-red-100 text-red-800 border-red-200' : 'bg-green-100 text-green-800 border-green-200'}>
                            {row.item.status === 'cancelled' ? 'Cancelled' : 'Checked Out'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => handleViewHistoryBill(row)} disabled={row.item.status === 'cancelled'}>View Bill</Button></TableCell>
                      </TableRow>
                    ))}
                  </PaginatedTableBody>
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
                <p className="font-semibold">{mealBooking.customer_name} · {getChaletBookingRoomShortText(mealBooking) || 'Unassigned'}</p>
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
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
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
            {(() => {
              const preview = getCheckInBillPreview();
              if (!preview) return null;
              return (
                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => setShowCheckInBillPreview(current => !current)}
                  >
                    <span>{showCheckInBillPreview ? 'Hide Bill Preview' : 'View Bill Preview'}</span>
                    <span className="font-semibold">{formatMoney(preview.balanceLkr, 'LKR')}</span>
                  </Button>
                  {showCheckInBillPreview && (
                    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <Label>Bill Preview</Label>
                          <p className="text-sm font-medium">{preview.title}</p>
                          <p className="text-xs text-muted-foreground">{preview.subtitle}</p>
                          <p className="text-xs text-muted-foreground">
                            Currency: {preview.currency}
                            {preview.currency === 'USD' && preview.exchangeRate > 0 ? ` · 1 USD = ${formatMoney(preview.exchangeRate, 'LKR')}` : ''}
                          </p>
                        </div>
                        <Badge variant={preview.balance > 0 ? 'outline' : 'default'}>
                          {preview.balance > 0 ? 'Outstanding' : 'Paid'}
                        </Badge>
                      </div>
                      <div className="space-y-2 text-sm">
                        {preview.lines.map((line, index) => (
                          <div key={`${line.label}-${index}`} className="flex justify-between gap-4">
                            <span className="text-muted-foreground">{line.label}</span>
                            <span className="text-right font-medium">{formatPreviewAmount(line.value, preview.currency, preview.exchangeRate)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between gap-4 border-t pt-2 font-semibold">
                          <span>Total Bill</span>
                          <span className="text-right">{formatPreviewAmount(preview.total, preview.currency, preview.exchangeRate)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Paid</span>
                          <span className="text-right font-medium">{formatPreviewAmount(preview.paid, preview.currency, preview.exchangeRate)}</span>
                        </div>
                        <div className="flex justify-between gap-4 text-base font-bold">
                          <span>Balance</span>
                          <span className="text-right">{formatPreviewAmount(preview.balance, preview.currency, preview.exchangeRate)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label>Other Guests</Label>
                  <p className="text-xs text-muted-foreground">Name, email, ID / Passport Number, and Address are optional.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addAdditionalGuest}>
                  <Plus className="mr-1 h-4 w-4" />
                  Add Guest
                </Button>
              </div>
              {additionalGuests.length > 0 && (
                <div className="space-y-3">
                  {additionalGuests.map((guest, index) => (
                    <div key={guest.id} className="grid gap-2 rounded-md bg-muted/40 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_36px]">
                      <div className="space-y-1">
                        <Label className="text-xs">Guest {index + 1} Name</Label>
                        <Input value={guest.name} onChange={e => updateAdditionalGuest(guest.id, 'name', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Email</Label>
                        <Input type="email" value={guest.email} onChange={e => updateAdditionalGuest(guest.id, 'email', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">ID / Passport Number</Label>
                        <Input value={guest.id_number} onChange={e => updateAdditionalGuest(guest.id, 'id_number', e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Address</Label>
                        <Input value={guest.address} onChange={e => updateAdditionalGuest(guest.id, 'address', e.target.value)} />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="self-end text-destructive lg:col-auto"
                        onClick={() => removeAdditionalGuest(guest.id)}
                        title="Remove guest"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
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
                  <p className="text-green-700">Confirmation sent to {(checkInPass.email_recipients?.length ? checkInPass.email_recipients : [checkInPass.email]).filter(Boolean).join(', ')}.</p>
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
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-3xl overflow-y-auto">
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
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rooms, Types & Packages</p>
                <div className="rounded-md border p-3">
                  {renderChaletRoomAllocation(viewGuestRow.item)}
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
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Rate per Night</span>{renderChaletMoney(viewGuestRow.item, Number(viewGuestRow.item.rate_per_night || 0), 'text-right')}</div>
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Subtotal</span>{renderChaletMoney(viewGuestRow.item, getChaletBillLines(viewGuestRow.item).subtotal, 'text-right')}</div>
                {getChaletBillLines(viewGuestRow.item).couponDiscount > 0 && (
                  <div className="flex justify-between gap-4"><span className="text-muted-foreground">Coupon{viewGuestRow.item.coupon_code ? ` (${viewGuestRow.item.coupon_code})` : ''}</span><span className="text-right">-{renderChaletMoney(viewGuestRow.item, getChaletBillLines(viewGuestRow.item).couponDiscount)}</span></div>
                )}
                {getChaletBillLines(viewGuestRow.item).charges.map(charge => (
                  <div key={charge.label} className="flex justify-between gap-4"><span className="text-muted-foreground">{charge.label} ({charge.pct}%)</span>{renderChaletMoney(viewGuestRow.item, charge.amount, 'text-right')}</div>
                ))}
                <div className="flex justify-between gap-4 font-semibold pt-1 border-t"><span>Grand Total</span>{renderChaletMoney(viewGuestRow.item, getChaletBillTotal(viewGuestRow.item), 'text-right')}</div>
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
          {viewGuestRow && viewGuestPayments?.balance && (
            <div className={`rounded-md border p-3 ${viewGuestPayments.balance.total > 0 ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Balance to Pay</p>
                <p className={`text-xl font-bold ${viewGuestPayments.balance.total > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                  {viewGuestPayments.balance.total > 0 ? formatMoney(viewGuestPayments.balance.total, 'LKR') : 'Nothing to pay'}
                </p>
              </div>
              {viewGuestPayments.balance.total > 0 && (
                <div className="mt-2 space-y-0.5 text-sm">
                  {[
                    { label: viewGuestRow.type === 'chalet' ? 'Chalet stay' : 'Room stay', value: viewGuestPayments.balance.stay },
                    { label: 'Restaurant (charged to room)', value: viewGuestPayments.balance.restaurant },
                    { label: 'Services (added to bill)', value: viewGuestPayments.balance.services },
                  ].filter(line => line.value > 0).map(line => (
                    <div key={line.label} className="flex justify-between gap-4">
                      <span className="text-muted-foreground">{line.label}</span>
                      <span className="font-medium">{formatMoney(line.value, 'LKR')}</span>
                    </div>
                  ))}
                  {viewGuestRow.type === 'chalet' && getChaletBillCurrency(viewGuestRow.item) === 'USD' && getChaletExchangeRate(viewGuestRow.item) > 0 && viewGuestPayments.balance.stay > 0 && (
                    <p className="text-right text-xs text-muted-foreground">Chalet stay ≈ {formatMoney(viewGuestPayments.balance.stay / getChaletExchangeRate(viewGuestRow.item), 'USD')}</p>
                  )}
                </div>
              )}
            </div>
          )}
          {viewGuestRow && (
            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payments</p>
                {viewGuestPayments && viewGuestPayments.payments.length > 0 && (
                  <p className="text-sm font-semibold text-green-700">Total received {formatMoney(viewGuestPayments.total, 'LKR')}</p>
                )}
              </div>
              {isLoadingGuestPayments || !viewGuestPayments ? (
                <p className="text-sm text-muted-foreground">Loading payments...</p>
              ) : viewGuestPayments.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments recorded for this stay yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date &amp; Time</TableHead>
                        <TableHead>For</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Received Into</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewGuestPayments.payments.map(payment => (
                        <TableRow key={payment.id}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {payment.paid_at ? (
                              <>
                                <div>{new Date(payment.paid_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                <div className="text-xs text-muted-foreground">{new Date(payment.paid_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                              </>
                            ) : (
                              <span className="text-muted-foreground">Date not recorded</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="font-medium">{payment.source}</div>
                            <div className="text-xs text-muted-foreground">
                              {[payment.reference, payment.note, payment.recorded_by ? `by ${payment.recorded_by}` : null].filter(Boolean).join(' · ')}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm capitalize">{payment.payment_method ? payment.payment_method.replace('_', ' ') : '—'}</TableCell>
                          <TableCell className="text-sm">{payment.account_name || '—'}</TableCell>
                          <TableCell className="whitespace-nowrap text-right text-sm font-medium text-green-700">{formatMoney(payment.amount, 'LKR')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Check Out Confirmation Modal */}
      <Dialog open={roomAssignmentOpen} onOpenChange={setRoomAssignmentOpen}>
        <DialogContent className="max-w-2xl">
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
            <div className="space-y-3">
              <Label>Requested Rooms</Label>
              {isLoadingAssignableRooms ? (
                <p className="rounded-md border p-3 text-sm text-muted-foreground">Loading rooms...</p>
              ) : roomAssignmentBooking ? (
                getBookingRoomSlots(roomAssignmentBooking).map((slot, index) => {
                  const selectedInOtherRows = new Set(assignedRoomIds.filter((_, roomIndex) => roomIndex !== index).filter(Boolean));
                  const availableRooms = assignableRooms
                    .filter(room => !slot.categoryId || room.category_id === slot.categoryId)
                    .map(room => ({
                      room,
                      label: getAssignableRoomLabel(room.id, roomAssignmentBooking, slot, selectedInOtherRows, assignedRoomIds[index]),
                    }));
                  const availableCount = availableRooms.filter(item => item.label === 'Available' || item.label === 'Assigned').length;
                  const assignedRoom = assignedRoomIds[index]
                    ? assignableRooms.find(room => room.id === assignedRoomIds[index]) || chaletRooms.find(room => room.id === assignedRoomIds[index])
                    : null;
                  return (
                    <div key={slot.key} className="rounded-lg border p-3">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">Room {index + 1}</p>
                          <p className="text-xs text-muted-foreground">
                            {getSlotCategoryName(slot, roomAssignmentBooking)} · {getSlotPackageName(slot, roomAssignmentBooking)} · {slot.adults} adult{slot.adults === 1 ? '' : 's'} · {slot.children} child{slot.children === 1 ? '' : 'ren'}
                          </p>
                        </div>
                        <Badge variant="outline">{availableCount} available</Badge>
                      </div>
                      {assignedRoom && (
                        <div className="mb-2 rounded-md bg-muted px-3 py-2 text-sm">
                          <span className="text-muted-foreground">Assigned: </span>
                          <span className="font-medium">Chalet {assignedRoom.room_number} — {assignedRoom.name}</span>
                        </div>
                      )}
                      <Select
                        value={assignedRoomIds[index] || undefined}
                        onValueChange={value => setAssignedRoomIds(current => {
                          const next = [...current];
                          next[index] = value;
                          return next;
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a chalet" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableRooms.map(({ room, label }) => (
                            <SelectItem key={room.id} value={room.id} disabled={label !== 'Available' && label !== 'Assigned'}>
                              Chalet {room.room_number} — {room.name} ({label})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {availableRooms.length === 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">No chalets match this requested room type.</p>
                      )}
                    </div>
                  );
                })
              ) : null}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRoomAssignmentOpen(false)}>Cancel</Button>
              <Button onClick={handleAssignRoom} disabled={!roomAssignmentBooking || assignedRoomIds.filter(Boolean).length !== getBookingRoomSlots(roomAssignmentBooking).length || isAssigningRoom}>
                {isAssigningRoom ? 'Assigning...' : 'Assign Rooms'}
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
                    ? getChaletBookingRoomShortText(checkoutRow.item) || 'Unassigned'
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

      {/* Printed guest document: the past bill while its window is open,
          otherwise the open bill (folio, or receipt once settled). */}
      {(() => {
        const invoice = isHistoryBillOpen && historyBill ? buildHistoryInvoice() : buildFolioInvoice();
        return invoice ? (
          <div id="print-area" className="hidden print:block bg-white text-black">
            <GuestInvoice {...invoice} />
          </div>
        ) : null;
      })()}
    </div>
  );
}

function matchesDateRange(date: string, from: string, to: string) {
  const day = date?.slice(0, 10);
  return (!from && !to) || (!!day && (!from || day >= from) && (!to || day <= to));
}

function DateRangeFilter({ label, from, to, onFromChange, onToChange }: {
  label: string; from: string; to: string;
  onFromChange: (value: string) => void; onToChange: (value: string) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3">
      <div className="space-y-1">
        <Label className="block text-xs">{label} — From
          <Input aria-label={`${label} from`} type="date" className="mt-1 w-44" value={from} max={to || undefined} onChange={event => onFromChange(event.target.value)} />
        </Label>
      </div>
      <div className="space-y-1">
        <Label className="block text-xs">To
          <Input aria-label={`${label} to`} type="date" className="mt-1 w-44" value={to} min={from || undefined} onChange={event => onToChange(event.target.value)} />
        </Label>
      </div>
      <Button type="button" variant="outline" disabled={!from && !to} onClick={() => { onFromChange(''); onToChange(''); }}>Clear Dates</Button>
    </div>
  );
}
