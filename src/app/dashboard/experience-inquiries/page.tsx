'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calendar, Mail, MessageSquare, Phone, Plus, Printer, ScanLine, Search, Sparkles, Trash2, User } from 'lucide-react';
import { BarcodeScanner } from '@/components/dashboard/inventory-management/barcode-scanner';
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
import { useRouter } from 'next/navigation';
import type { ServiceLineItemMaster } from '@/lib/types';
import { serviceInvoiceNumber } from '@/lib/utils';

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
  guest_count?: number | null;
  experiences?: { name: string; people: number; rate?: number | null }[] | null;
  pricing?: { service_charge_rate: number; tax_rate: number; other_charges: { name: string; amount: number }[] } | null;
};

type OtherCharge = { name: string; amount: string };
// One experience on the bill; master_id is 'custom' for a one-off experience not in the list.
type InquiryExperienceRow = { name: string; people: string; rate: string };
const emptyExperienceRow: InquiryExperienceRow = { name: '', people: '1', rate: '' };
type ExperienceLine = { master_id: string; name: string; people: string; rate: string };
type CustomerOption = { id: string; name: string; email?: string | null; phone?: string | null; id_number?: string | null };
type InHouseGuest = {
  key: string;
  room: string;
  guest_name: string;
  phone: string | null;
  customer: { id: string; name: string; phone?: string | null; current_room: string } | null;
};
type InquiryPayment = { inquiry_id: string; income_id: string; amount: number; payment_status: 'add_to_bill' | 'paid'; payment_method: 'cash' | 'card' | null };
type ExperienceBill = {
  id: string;
  invoice_number?: string | null;
  description: string;
  amount: number;
  date: string;
  customer_name: string;
  customer_id: string;
  room_number?: string | null;
  payment_status: 'add_to_bill' | 'paid';
  payment_method: 'cash' | 'card' | null;
  line_items: { description: string; amount: number }[];
};

const statuses: InquiryStatus[] = ['pending', 'contacted', 'confirmed', 'cancelled', 'completed'];

const formatLabel = (value: string | null) =>
  value ? value.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : 'Not specified';

const money = (value: number) => `LKR ${value.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Same order as the experience bill: service charge on the experiences, tax on
// experiences + service charge, then other charges added on top.
function calcCharges(lines: { people: number; rate: number }[], serviceChargeRate: number, taxRate: number, otherCharges: { amount: number }[]) {
  const base = lines.reduce((sum, line) => sum + line.people * line.rate, 0);
  const serviceCharge = base * serviceChargeRate / 100;
  const tax = (base + serviceCharge) * taxRate / 100;
  const other = otherCharges.reduce((sum, charge) => sum + charge.amount, 0);
  return { base, serviceCharge, tax, other, total: base + serviceCharge + tax + other };
}

// Unsaved bill shown before confirming, laid out the same way the server saves it.
function buildDraftBill(draft: {
  customerName: string;
  customerId?: string | null;
  room?: string | null;
  lines: { name: string; people: number; rate: number }[];
  serviceChargeRate: number;
  taxRate: number;
  otherCharges: { name: string; amount: number }[];
}): ExperienceBill {
  const round = (value: number) => Math.round(value * 100) / 100;
  const lines = draft.lines.filter((line) => line.name);
  const others = draft.otherCharges.filter((charge) => charge.name.trim());
  const charges = calcCharges(lines, draft.serviceChargeRate, draft.taxRate, others);
  return {
    id: 'draft',
    description: lines.map((line) => line.name).join(', ') || 'Experience',
    amount: round(charges.total),
    date: new Date().toISOString().slice(0, 10),
    customer_name: draft.customerName,
    customer_id: draft.customerId || '',
    room_number: draft.room || null,
    payment_status: 'add_to_bill',
    payment_method: null,
    line_items: [
      ...lines.map((line) => ({
        description: `${line.name} — ${line.people} ${line.people === 1 ? 'person' : 'people'} × LKR ${line.rate.toFixed(2)}`,
        amount: round(line.people * line.rate),
      })),
      ...(draft.serviceChargeRate > 0 ? [{ description: `Service charge (${draft.serviceChargeRate}%)`, amount: round(charges.serviceCharge) }] : []),
      ...(draft.taxRate > 0 ? [{ description: `Tax (${draft.taxRate}%)`, amount: round(charges.tax) }] : []),
      ...others.map((charge) => ({ description: charge.name.trim(), amount: round(charge.amount) })),
    ],
  };
}

const statusVariant = (status: InquiryStatus) => {
  if (status === 'confirmed' || status === 'completed') return 'default' as const;
  if (status === 'cancelled') return 'destructive' as const;
  return 'secondary' as const;
};

export default function ExperienceInquiriesPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [inquiries, setInquiries] = useState<ExperienceInquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedInquiry, setSelectedInquiry] = useState<ExperienceInquiry | null>(null);
  const [confirmingInquiry, setConfirmingInquiry] = useState<ExperienceInquiry | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [experienceLines, setExperienceLines] = useState<ExperienceLine[]>([]);
  const [serviceChargeRate, setServiceChargeRate] = useState('10');
  const [taxRate, setTaxRate] = useState('0');
  const [otherCharges, setOtherCharges] = useState<OtherCharge[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<'add_to_bill' | 'paid'>('add_to_bill');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [isLoadingBilling, setIsLoadingBilling] = useState(false);
  const [billView, setBillView] = useState(false);
  const [billIncome, setBillIncome] = useState<ExperienceBill | null>(null);
  // Set while the bill view shows an unsaved draft: from the inquiry, or from the Confirm screen.
  const [draftBillFrom, setDraftBillFrom] = useState<'inquiry' | 'billing' | null>(null);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('new');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newInquiry, setNewInquiry] = useState({ customer_id: 'new', name: '', email: '', phone: '', subject: '', message: '' });
  const [createCustomerSearch, setCreateCustomerSearch] = useState('');
  const [billingCustomerSearch, setBillingCustomerSearch] = useState('');
  const [payments, setPayments] = useState<Record<string, InquiryPayment>>({});
  // Experiences and their rates per person, kept under Service Line Items (service type 'Experience').
  const [experienceMasters, setExperienceMasters] = useState<ServiceLineItemMaster[]>([]);
  const [newInquiryExperiences, setNewInquiryExperiences] = useState<InquiryExperienceRow[]>([{ ...emptyExperienceRow }]);
  // Pricing entered on the inquiry; saved with it and used as the starting point for the bill.
  const [inquiryServiceCharge, setInquiryServiceCharge] = useState('10');
  const [inquiryTax, setInquiryTax] = useState('0');
  const [inquiryOtherCharges, setInquiryOtherCharges] = useState<OtherCharge[]>([]);
  // Set while the inquiry form is editing an existing inquiry instead of creating one.
  const [editingInquiryId, setEditingInquiryId] = useState<string | null>(null);
  // Last saved service charge, tax and other charges; new inquiries and bills start from these.
  const [pricingDefaults, setPricingDefaults] = useState<NonNullable<ExperienceInquiry['pricing']>>({ service_charge_rate: 10, tax_rate: 0, other_charges: [] });
  // Where a newly added experience goes: a row on the new-inquiry form or a line on the bill.
  const [newExperience, setNewExperience] = useState<{ name: string; rate: string; target: { form: 'create' | 'billing'; index: number } } | null>(null);
  const [isSavingExperience, setIsSavingExperience] = useState(false);
  // Checked-in guests by room (hotel rooms and chalets), for attaching an in-house guest.
  const [inHouseGuests, setInHouseGuests] = useState<InHouseGuest[]>([]);
  const [isLoadingInHouseGuests, setIsLoadingInHouseGuests] = useState(false);
  const [newInquiryRoom, setNewInquiryRoom] = useState('');
  const [billingRoom, setBillingRoom] = useState('');
  // Every room the selected in-house customer has right now (a guest can hold several).
  const [newInquiryRooms, setNewInquiryRooms] = useState<string[]>([]);
  const [billingRooms, setBillingRooms] = useState<string[]>([]);
  // True when the billed customer is checked in: the cost then defaults to their room bill.
  const [billingInHouse, setBillingInHouse] = useState(false);

  // Current room of a checked-in customer, or null when they are not checked in.
  const lookupCurrentRoom = async (customerId: string): Promise<string | null> => {
    try {
      const response = await fetch(`/api/admin/front-desk/guest-pass?customer_id=${encodeURIComponent(customerId)}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data?.customer?.current_room || null;
    } catch {
      return null;
    }
  };

  // Checked-in guests default to their room bill; everyone else pays now.
  const setBillingGuestRoom = (room: string | null) => {
    setBillingRoom(room || '');
    setBillingInHouse(Boolean(room));
    setPaymentStatus(room ? 'add_to_bill' : 'paid');
  };

  const loadInHouseGuests = async (): Promise<InHouseGuest[]> => {
    setIsLoadingInHouseGuests(true);
    try {
      const response = await fetch('/api/admin/front-desk/guest-pass?in_house=1');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load checked-in guests');
      setInHouseGuests(data.guests || []);
      return data.guests || [];
    } catch (error) {
      console.error(error);
      return inHouseGuests;
    } finally {
      setIsLoadingInHouseGuests(false);
    }
  };

  const roomsOf = (guests: InHouseGuest[], customerId: string) =>
    Array.from(new Set(guests.filter((guest) => guest.customer?.id === customerId).map((guest) => guest.room)));

  // All rooms a customer is checked in to right now; empty when not in house.
  const lookupCustomerRooms = async (customerId: string): Promise<string[]> => {
    const rooms = roomsOf(await loadInHouseGuests(), customerId);
    if (rooms.length > 0) return rooms;
    // Chalet guests are matched to customers by name on the server.
    const room = await lookupCurrentRoom(customerId);
    return room ? [room] : [];
  };

  // Loads the customer's rooms into the inquiry form or the bill, keeping
  // `keep` selected when the customer still has that room.
  const applyCustomerRooms = async (customerId: string, target: 'billing' | 'create', keep?: string | null) => {
    const rooms = await lookupCustomerRooms(customerId);
    const room = keep && rooms.includes(keep) ? keep : rooms[0] || null;
    if (target === 'billing') {
      setBillingRooms(rooms);
      setBillingGuestRoom(room);
    } else {
      setNewInquiryRooms(rooms);
      setNewInquiryRoom(room || '');
    }
    return rooms;
  };

  // Picking a checked-in guest by room fills in the customer and the room.
  const pickInHouseGuest = (guest: InHouseGuest, target: 'billing' | 'create') => {
    const customer = guest.customer;
    const rooms = customer ? roomsOf(inHouseGuests, customer.id) : [guest.room];
    if (target === 'billing') {
      setBillingRooms(rooms);
      setBillingGuestRoom(guest.room);
      setSelectedCustomerId(customer?.id || 'new');
      setCustomerName(customer?.name || guest.guest_name);
    } else {
      setNewInquiryRooms(rooms);
      setNewInquiryRoom(guest.room);
      setNewInquiry((current) => ({
        ...current,
        customer_id: customer?.id || 'new',
        name: customer?.name || guest.guest_name,
        phone: customer?.phone || guest.phone || '',
        email: customers.find((item) => item.id === customer?.id)?.email || (customer ? '' : current.email),
      }));
    }
  };

  const findMaster = (experience: string | null) => {
    if (!experience) return undefined;
    const key = formatLabel(experience).toLowerCase();
    return experienceMasters.find((master) => master.name.toLowerCase() === key || master.name.toLowerCase() === experience.toLowerCase());
  };

  const lineFromMaster = (master: ServiceLineItemMaster | undefined, fallbackName: string, people = '1'): ExperienceLine => master
    ? { master_id: master.id, name: master.name, people, rate: String(Number(master.default_amount || 0)) }
    : { master_id: 'custom', name: fallbackName, people, rate: '' };

  const updateLine = (index: number, patch: Partial<ExperienceLine>) =>
    setExperienceLines((lines) => lines.map((line, i) => i === index ? { ...line, ...patch } : line));

  const pickLineExperience = (index: number, masterId: string) => {
    if (masterId === 'add_new') {
      setNewExperience({ name: '', rate: '', target: { form: 'billing', index } });
      return;
    }
    const master = experienceMasters.find((item) => item.id === masterId);
    updateLine(index, master
      ? { master_id: master.id, name: master.name, rate: String(Number(master.default_amount || 0)) }
      : { master_id: 'custom', name: '', rate: '' });
  };

  const fetchExperienceMasters = () =>
    fetch('/api/admin/service-line-items?service_type=Experience&active=true')
      .then((response) => response.json())
      .then((data) => setExperienceMasters(data.items || []))
      .catch(() => undefined);

  const saveNewExperience = async () => {
    if (!newExperience) return;
    const name = newExperience.name.trim();
    const rate = Number(newExperience.rate);
    if (!name || newExperience.rate === '' || rate < 0) {
      toast({ variant: 'destructive', title: 'Missing details', description: 'Enter the experience name and a valid rate per person.' });
      return;
    }
    setIsSavingExperience(true);
    try {
      const response = await fetch('/api/admin/service-line-items', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_type: 'Experience', name, default_amount: rate, is_active: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to add experience.');
      const master = result.item as ServiceLineItemMaster;
      setExperienceMasters((current) => [...current, master].sort((a, b) => a.name.localeCompare(b.name)));
      const { form, index } = newExperience.target;
      if (form === 'create') {
        setNewInquiryExperiences((rows) => rows.map((row, i) => i === index ? { ...row, name: master.name, rate: String(Number(master.default_amount || 0)) } : row));
      } else {
        updateLine(index, { master_id: master.id, name: master.name, rate: String(Number(master.default_amount || 0)) });
      }
      setNewExperience(null);
      toast({ title: 'Experience added', description: `${master.name} at ${money(Number(master.default_amount || 0))} per person.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Could not add experience', description: error.message });
    } finally {
      setIsSavingExperience(false);
    }
  };

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
        // Via the admin API: the browser's public key has no access to contact_messages.
        fetch('/api/admin/inquiries?type=experience').then((response) => response.json()),
        fetch('/api/admin/experience-inquiries').then((response) => response.json()),
      ]);

      if (inquiryResult.error) throw new Error(inquiryResult.error);
      setInquiries((inquiryResult.inquiries || []) as ExperienceInquiry[]);
      setPayments(Object.fromEntries((paymentResponse.payments || []).map((payment: InquiryPayment) => [payment.inquiry_id, payment])));
      if (paymentResponse.pricing_defaults) setPricingDefaults(paymentResponse.pricing_defaults);
    } catch (error) {
      console.error('Error fetching experience inquiries:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load experience inquiries.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
    fetchExperienceMasters();
    fetch('/api/admin/customers').then((response) => response.json()).then((data) => setCustomers(data.customers || [])).catch(() => undefined);
  }, []);

  // Scanning a checked-in guest's QR pass attaches that guest and their room.
  const handleGuestQrScan = async (code: string, target: 'billing' | 'create'): Promise<boolean> => {
    try {
      const response = await fetch(`/api/admin/front-desk/guest-pass?code=${encodeURIComponent(code)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Guest QR pass was not recognized');
      const customer = data.customer as CustomerOption & { current_room?: string | null };
      // Make sure the customer list has this guest so the customer select can show them.
      setCustomers((current) => current.some((item) => item.id === customer.id) ? current : [...current, customer]);
      if (target === 'billing') {
        setSelectedCustomerId(customer.id);
        setCustomerName(customer.name);
        setBillingGuestRoom(customer.current_room || null);
        applyCustomerRooms(customer.id, 'billing', customer.current_room);
      } else {
        setNewInquiryRoom(customer.current_room || '');
        applyCustomerRooms(customer.id, 'create', customer.current_room);
        setNewInquiry((current) => ({
          ...current,
          customer_id: customer.id,
          name: customer.name,
          email: customer.email || '',
          phone: customer.phone || '',
        }));
      }
      toast({ title: 'Guest Identified', description: `${customer.name}${customer.current_room ? ` — ${customer.current_room}` : ''}` });
      return Boolean(customer.current_room);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Guest Not Found', description: error.message });
      return false;
    }
  };

  const selectCustomer = (customerId: string, target: 'billing' | 'create') => {
    const customer = customers.find((item) => item.id === customerId);
    if (target === 'billing') {
      setSelectedCustomerId(customerId);
      if (customer) setCustomerName(customer.name);
      if (customerId === 'new') { setBillingRooms([]); setBillingGuestRoom(null); }
      else applyCustomerRooms(customerId, 'billing');
    } else {
      setNewInquiryRoom('');
      setNewInquiryRooms([]);
      if (customerId !== 'new') applyCustomerRooms(customerId, 'create');
      setNewInquiry((current) => ({
        ...current,
        customer_id: customerId,
        name: customer?.name || '',
        email: customer?.email || '',
        phone: customer?.phone || '',
      }));
    }
  };

  const openInquiryForm = (inquiry?: ExperienceInquiry) => {
    setEditingInquiryId(inquiry?.id || null);
    setNewInquiryRoom('');
    setNewInquiryRooms([]);
    // An in-house customer's current rooms load with the inquiry.
    if (inquiry?.customer_id) applyCustomerRooms(inquiry.customer_id, 'create');
    setNewInquiry({
      customer_id: inquiry?.customer_id || 'new',
      name: inquiry?.name || '',
      email: inquiry?.email || '',
      phone: inquiry?.phone || '',
      subject: inquiry?.subject || '',
      message: inquiry?.message || '',
    });
    const saved = inquiry?.experiences && inquiry.experiences.length > 0
      ? inquiry.experiences
      : inquiry?.experience_type ? [{ name: findMaster(inquiry.experience_type)?.name || formatLabel(inquiry.experience_type), people: inquiry.guest_count || 1, rate: null }] : [];
    setNewInquiryExperiences(saved.length > 0
      ? saved.map((item) => {
          const rate = item.rate ?? findMaster(item.name)?.default_amount;
          return { name: item.name, people: String(item.people || 1), rate: rate === null || rate === undefined ? '' : String(Number(rate)) };
        })
      : [{ ...emptyExperienceRow }]);
    const pricing = inquiry?.pricing || pricingDefaults;
    setInquiryServiceCharge(String(pricing.service_charge_rate ?? 10));
    setInquiryTax(String(pricing.tax_rate ?? 0));
    setInquiryOtherCharges((pricing.other_charges || []).map((item) => ({ name: item.name, amount: String(item.amount) })));
    setIsCreateOpen(true);
  };

  const createInquiry = async () => {
    if (!newInquiry.name.trim()) {
      toast({ variant: 'destructive', title: 'Customer required', description: 'Select a customer or enter a new customer name.' });
      return;
    }
    const chosenExperiences = newInquiryExperiences.filter((row) => row.name);
    if (chosenExperiences.some((row) => !Number.isInteger(Number(row.people)) || Number(row.people) < 1)) {
      toast({ variant: 'destructive', title: 'Number of people', description: 'Enter at least 1 person for each experience.' });
      return;
    }
    if (chosenExperiences.some((row) => row.rate !== '' && Number(row.rate) < 0) || Number(inquiryServiceCharge) < 0 || Number(inquiryTax) < 0) {
      toast({ variant: 'destructive', title: 'Pricing', description: 'Rates, service charge and tax cannot be negative.' });
      return;
    }
    const inquiryPricing = {
      service_charge_rate: Number(inquiryServiceCharge) || 0,
      tax_rate: Number(inquiryTax) || 0,
      other_charges: inquiryOtherCharges
        .filter((charge) => charge.name.trim())
        .map((charge) => ({ name: charge.name.trim(), amount: Number(charge.amount) || 0 })),
    };
    setIsCreating(true);
    try {
      const response = await fetch('/api/admin/experience-inquiries', {
        method: editingInquiryId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newInquiry,
          id: editingInquiryId,
          experiences: chosenExperiences.map((row) => ({ name: row.name, people: Number(row.people), rate: row.rate === '' ? null : Number(row.rate) })),
          pricing: inquiryPricing,
          customer_id: newInquiry.customer_id === 'new' ? null : newInquiry.customer_id,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to save inquiry.');
      if (editingInquiryId) {
        setInquiries((current) => current.map((item) => item.id === editingInquiryId ? { ...item, ...result.inquiry } : item));
        setSelectedInquiry((current) => current?.id === editingInquiryId ? { ...current, ...result.inquiry } : current);
      } else {
        setInquiries((current) => [result.inquiry, ...current]);
      }
      setPricingDefaults(inquiryPricing);
      setIsCreateOpen(false);
      toast(editingInquiryId
        ? { title: 'Inquiry updated', description: 'The experience inquiry changes were saved.' }
        : { title: 'Inquiry created', description: 'The experience inquiry was added successfully.' });
      setEditingInquiryId(null);
    } catch (error: any) {
      toast({ variant: 'destructive', title: editingInquiryId ? 'Could not update inquiry' : 'Could not create inquiry', description: error.message });
    } finally {
      setIsCreating(false);
    }
  };

  const openBilling = async (inquiry: ExperienceInquiry) => {
    setSelectedInquiry(inquiry);
    setCustomerName(inquiry.name || '');
    setSelectedCustomerId(inquiry.customer_id || 'new');
    setBillingRoom('');
    setBillingRooms([]);
    setBillingInHouse(false);
    setExperienceLines(inquiry.experiences && inquiry.experiences.length > 0
      // One bill line per requested experience, at its listed rate.
      ? inquiry.experiences.map((item) => {
          const line = lineFromMaster(findMaster(item.name), item.name, String(item.people || 1));
          return item.rate === null || item.rate === undefined ? line : { ...line, rate: String(item.rate) };
        })
      : [lineFromMaster(findMaster(inquiry.experience_type), inquiry.experience_type ? formatLabel(inquiry.experience_type) : (inquiry.subject || ''), String(inquiry.guest_count || 1))]);
    const startPricing = inquiry.pricing || pricingDefaults;
    setServiceChargeRate(String(startPricing.service_charge_rate ?? 10));
    setTaxRate(String(startPricing.tax_rate ?? 0));
    setOtherCharges((startPricing.other_charges || []).map((item) => ({ name: item.name, amount: String(item.amount) })));
    setPaymentStatus('paid');
    setPaymentMethod('cash');
    setConfirmingInquiry(inquiry);
    setBillView(false);
    if (inquiry.status !== 'confirmed' && inquiry.status !== 'completed' && inquiry.customer_id) {
      // Fill in the room if this customer is checked in right now.
      applyCustomerRooms(inquiry.customer_id, 'billing');
    }
    if (inquiry.status === 'confirmed' || inquiry.status === 'completed') {
      setIsLoadingBilling(true);
      try {
        const response = await fetch(`/api/admin/experience-inquiries/confirm?inquiry_id=${encodeURIComponent(inquiry.id)}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to load saved billing.');
        const income = result.income;
        const pricing = income?.pricing_breakdown;
        if (pricing) {
          const savedLines: ExperienceLine[] = Array.isArray(pricing.experiences) && pricing.experiences.length > 0
            ? pricing.experiences.map((item: { name: string; people: number; rate: number }) => ({
                master_id: findMaster(item.name)?.id || 'custom', name: item.name, people: String(item.people), rate: String(item.rate),
              }))
            // Bills saved before multiple experiences: one experience at the saved price per person.
            : [{
                ...lineFromMaster(findMaster(inquiry.experience_type), income.description || formatLabel(inquiry.experience_type)),
                people: String(pricing.people || 1),
                rate: pricing.price_per_person === null || pricing.price_per_person === undefined ? '' : String(pricing.price_per_person),
              }];
          setExperienceLines(savedLines);
          setServiceChargeRate(String(pricing.service_charge_rate || 0));
          setTaxRate(String(pricing.tax_rate || 0));
          setOtherCharges((pricing.other_charges || []).map((item: { name: string; amount: number }) => ({ name: item.name, amount: String(item.amount) })));
        }
        if (income) setPaymentStatus(income.payment_status === 'paid' ? 'paid' : 'add_to_bill');
        if (income?.payment_method === 'card') setPaymentMethod('card');
        if (income?.customer_id) setSelectedCustomerId(income.customer_id);
        if (income?.room_number) setBillingRoom(income.room_number);
        setBillingInHouse(Boolean(income?.room_number) || income?.payment_status === 'add_to_bill');
        // The guest may have moved rooms since the bill was saved: keep the saved
        // room if they still have it, otherwise show their current room.
        const billedCustomerId = income?.customer_id || inquiry.customer_id;
        if (billedCustomerId && income?.payment_status !== 'paid') {
          const rooms = await lookupCustomerRooms(billedCustomerId);
          setBillingRooms(rooms);
          if (rooms.length > 0) {
            setBillingRoom(income?.room_number && rooms.includes(income.room_number) ? income.room_number : rooms[0]);
            setBillingInHouse(true);
          }
        }
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Could not load billing', description: error.message });
      } finally {
        setIsLoadingBilling(false);
      }
    }
  };

  // Draft bill from the inquiry's saved experiences and charges, before it is confirmed.
  const previewInquiryBill = (inquiry: ExperienceInquiry) => {
    const saved = inquiry.experiences && inquiry.experiences.length > 0
      ? inquiry.experiences
      : [{ name: inquiry.experience_type ? (findMaster(inquiry.experience_type)?.name || formatLabel(inquiry.experience_type)) : (inquiry.subject || 'Experience'), people: inquiry.guest_count || 1, rate: null }];
    const pricing = inquiry.pricing || pricingDefaults;
    setBillIncome(buildDraftBill({
      customerName: inquiry.name || 'Guest',
      customerId: inquiry.customer_id,
      lines: saved.map((item) => ({ name: item.name, people: Number(item.people) || 1, rate: Number(item.rate ?? findMaster(item.name)?.default_amount ?? 0) })),
      serviceChargeRate: Number(pricing.service_charge_rate) || 0,
      taxRate: Number(pricing.tax_rate) || 0,
      otherCharges: pricing.other_charges || [],
    }));
    setSelectedInquiry(inquiry);
    setConfirmingInquiry(null);
    setDraftBillFrom('inquiry');
    setBillView(true);
  };

  // Draft bill from what is entered on the Confirm screen, before saving it.
  const previewBillingDraft = () => {
    setBillIncome(buildDraftBill({
      customerName: customerName.trim() || 'Guest',
      customerId: selectedCustomerId === 'new' ? null : selectedCustomerId,
      room: billingRoom.trim() || null,
      lines: experienceLines.map((line) => ({ name: line.name.trim(), people: Number(line.people) || 0, rate: Number(line.rate) || 0 })),
      serviceChargeRate: Number(serviceChargeRate) || 0,
      taxRate: Number(taxRate) || 0,
      otherCharges: otherCharges.map((charge) => ({ name: charge.name, amount: Number(charge.amount) || 0 })),
    }));
    setDraftBillFrom('billing');
    setBillView(true);
  };

  const openBill = async (inquiry: ExperienceInquiry) => {
    setSelectedInquiry(inquiry);
    setConfirmingInquiry(null);
    setDraftBillFrom(null);
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
    doc.title = draftBillFrom ? 'Draft Experience Bill' : `Experience Bill ${serviceInvoiceNumber({ ...billIncome, service_type: 'Experience' })}`;
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
    addText('p', draftBillFrom ? 'Draft Experience Bill — not yet confirmed' : 'Experience Bill', 'muted');
    if (!draftBillFrom) addText('p', `Bill No: ${serviceInvoiceNumber({ ...billIncome, service_type: 'Experience' })}`);
    addText('p', `Date: ${new Date(billIncome.date).toLocaleDateString()}`);
    addText('p', `Customer: ${billIncome.customer_name || selectedInquiry.name || 'Guest'}`);
    if (billIncome.room_number) addText('p', `Room: ${billIncome.room_number}`);
    addText('h3', billIncome.description || formatLabel(selectedInquiry.experience_type));
    (billIncome.line_items || []).forEach((item) => {
      const row = doc.createElement('div');
      row.className = 'row';
      const description = doc.createElement('span'); description.textContent = item.description;
      const amount = doc.createElement('span'); amount.textContent = `LKR ${Number(item.amount || 0).toFixed(2)}`;
      row.append(description, amount); container.appendChild(row);
    });
    addText('p', `Total: LKR ${Number(billIncome.amount || 0).toFixed(2)}`, 'total');
    addText('p', draftBillFrom ? 'Estimate only — the final bill is issued on confirmation.' : billIncome.payment_status === 'paid' ? `Paid by ${billIncome.payment_method || 'N/A'}` : 'Payment due — added to guest bill', 'status');
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

    const ok = await fetch('/api/admin/inquiries', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: inquiry.id, status, type: 'experience' }),
    }).then((response) => response.ok).catch(() => false);

    if (!ok) {
      setInquiries((current) => current.map((item) => item.id === inquiry.id ? { ...item, status: previousStatus } : item));
      setSelectedInquiry((current) => current?.id === inquiry.id ? { ...current, status: previousStatus } : current);
      toast({ variant: 'destructive', title: 'Update failed', description: 'The inquiry status could not be saved.' });
    } else {
      toast({ title: 'Status updated', description: `Inquiry marked as ${formatLabel(status)}.` });
    }
    setUpdatingId(null);
  };

  const lineAmount = (line: ExperienceLine) => (Number(line.people) || 0) * (Number(line.rate) || 0);
  const { serviceCharge, tax, total: billTotal } = calcCharges(
    experienceLines.map((line) => ({ people: Number(line.people) || 0, rate: Number(line.rate) || 0 })),
    Number(serviceChargeRate) || 0,
    Number(taxRate) || 0,
    otherCharges.map((charge) => ({ amount: Number(charge.amount) || 0 })),
  );
  const inquiryCharges = calcCharges(
    newInquiryExperiences.filter((row) => row.name).map((row) => ({ people: Number(row.people) || 0, rate: Number(row.rate) || 0 })),
    Number(inquiryServiceCharge) || 0,
    Number(inquiryTax) || 0,
    inquiryOtherCharges.map((charge) => ({ amount: Number(charge.amount) || 0 })),
  );

  const confirmAndAddToBill = async () => {
    const invalidLine = experienceLines.length === 0 || experienceLines.some((line) =>
      !line.name.trim() || !Number.isInteger(Number(line.people)) || Number(line.people) < 1 || Number(line.rate) < 0);
    if (!confirmingInquiry || !customerName.trim() || invalidLine) {
      toast({ variant: 'destructive', title: 'Missing details', description: 'Enter a customer, and for each experience a name, the number of people and a valid rate.' });
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
          room_number: billingRoom.trim() || null,
          experiences: experienceLines.map((line) => ({ name: line.name.trim(), people: Number(line.people), rate: Number(line.rate) || 0 })),
          service_charge_rate: Number(serviceChargeRate) || 0,
          tax_rate: Number(taxRate) || 0,
          other_charges: otherCharges,
          payment_status: paymentStatus,
          payment_method: paymentStatus === 'paid' ? paymentMethod : null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to add experience to bill.');
      // The server also saved the bill's experiences and charges onto the inquiry.
      const synced = { status: 'confirmed' as const, ...(result.inquiry || {}) };
      setInquiries((current) => current.map((item) => item.id === confirmingInquiry.id ? { ...item, ...synced } : item));
      setSelectedInquiry((current) => current?.id === confirmingInquiry.id ? { ...current, ...synced } : current);
      setConfirmingInquiry(null);
      setPricingDefaults({
        service_charge_rate: Number(serviceChargeRate) || 0,
        tax_rate: Number(taxRate) || 0,
        other_charges: otherCharges.filter((charge) => charge.name.trim()).map((charge) => ({ name: charge.name.trim(), amount: Number(charge.amount) || 0 })),
      });
      setBillIncome(result.income as ExperienceBill);
      setDraftBillFrom(null);
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
        <Button onClick={() => openInquiryForm()}><Plus className="mr-2 h-4 w-4" />Add Experience Inquiry</Button>
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
                  <TableCell>
                    {inquiry.experiences && inquiry.experiences.length > 0 ? (
                      <div className="flex flex-col items-start gap-1">
                        {inquiry.experiences.map((item, index) => (
                          <Badge key={index} variant="outline"><Sparkles className="mr-1 h-3 w-3" />{item.name} · {item.people}</Badge>
                        ))}
                      </div>
                    ) : (
                      <>
                        <Badge variant="outline"><Sparkles className="mr-1 h-3 w-3" />{formatLabel(inquiry.experience_type)}</Badge>
                        {inquiry.guest_count ? <div className="mt-1 text-xs text-muted-foreground">{inquiry.guest_count} {inquiry.guest_count === 1 ? 'person' : 'people'}</div> : null}
                      </>
                    )}
                  </TableCell>
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
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setBillView(false); setSelectedInquiry(inquiry); }}>View</Button>
                      <Button variant="secondary" size="sm" disabled={isLoadingBilling} onClick={() => payments[inquiry.id] ? openBill(inquiry) : previewInquiryBill(inquiry)}>
                        <Printer className="mr-1 h-3.5 w-3.5" />{payments[inquiry.id] ? 'View Bill' : 'Preview Bill'}
                      </Button>
                    </div>
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

      <Dialog open={isCreateOpen} onOpenChange={(open) => { if (!isCreating) { setIsCreateOpen(open); if (!open) setEditingInquiryId(null); } }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editingInquiryId ? 'Edit Experience Inquiry' : 'Add Experience Inquiry'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <RoomGuestPicker
              id="inquiry-room"
              value={newInquiryRoom}
              onChange={setNewInquiryRoom}
              guests={inHouseGuests}
              isLoading={isLoadingInHouseGuests}
              onOpen={loadInHouseGuests}
              onPick={(guest) => pickInHouseGuest(guest, 'create')}
              onScan={(code) => handleGuestQrScan(code, 'create')}
              customerRooms={newInquiryRooms}
              onSelectRoom={setNewInquiryRoom}
            />
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Experiences</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => setNewInquiryExperiences((rows) => [...rows, { ...emptyExperienceRow, people: rows[rows.length - 1]?.people || '1' }])}>
                  <Plus className="mr-1 h-4 w-4" />Add experience
                </Button>
              </div>
              <div className="hidden grid-cols-[1fr_80px_120px_110px_36px] gap-2 px-1 text-xs font-medium uppercase text-muted-foreground sm:grid">
                <span>Experience</span><span>People</span><span>Rate (LKR)</span><span className="text-right">Amount</span><span />
              </div>
              {newInquiryExperiences.map((row, index) => (
                <div key={index} className="grid grid-cols-[1fr_36px] items-center gap-2 rounded-md border p-2 sm:grid-cols-[1fr_80px_120px_110px_36px] sm:border-0 sm:p-0">
                  <Select
                    value={row.name || undefined}
                    onValueChange={(value) => {
                      if (value === 'add_new') {
                        setNewExperience({ name: '', rate: '', target: { form: 'create', index } });
                        return;
                      }
                      const master = experienceMasters.find((item) => item.name === value);
                      setNewInquiryExperiences((rows) => rows.map((item, i) => i === index ? { ...item, name: value, rate: master ? String(Number(master.default_amount || 0)) : item.rate } : item));
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select experience" /></SelectTrigger>
                    <SelectContent>
                      {experienceMasters.map((item) => (
                        <SelectItem key={item.id} value={item.name}>{item.name} — {money(Number(item.default_amount || 0))} / person</SelectItem>
                      ))}
                      {/* A saved experience that is no longer in the list stays selectable. */}
                      {row.name && !experienceMasters.some((item) => item.name === row.name) && <SelectItem value={row.name}>{row.name}</SelectItem>}
                      {experienceMasters.length === 0 && <div className="px-2 py-3 text-center text-sm text-muted-foreground">No experiences yet</div>}
                      <SelectItem value="add_new" className="text-primary"><Plus className="mr-1 inline h-3 w-3" />Add new experience…</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" size="icon" variant="ghost" aria-label="Remove experience" className="sm:order-last" disabled={newInquiryExperiences.length === 1} onClick={() => setNewInquiryExperiences((rows) => rows.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
                  <div className="col-span-2 grid grid-cols-[80px_1fr_auto] items-center gap-2 sm:col-span-3 sm:grid-cols-[80px_120px_110px]">
                    <Input type="number" min="1" step="1" aria-label="Number of people" value={row.people} onChange={(e) => setNewInquiryExperiences((rows) => rows.map((item, i) => i === index ? { ...item, people: e.target.value } : item))} />
                    <Input type="number" min="0" step="0.01" aria-label="Rate per person" placeholder="Rate" value={row.rate} onChange={(e) => setNewInquiryExperiences((rows) => rows.map((item, i) => i === index ? { ...item, rate: e.target.value } : item))} />
                    <span className="whitespace-nowrap text-right text-sm font-medium">{money((Number(row.people) || 0) * (Number(row.rate) || 0))}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="inquiry-service">Service charge (%)</Label>
                <Input id="inquiry-service" type="number" min="0" step="0.01" value={inquiryServiceCharge} onChange={(e) => setInquiryServiceCharge(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inquiry-tax">Tax (%)</Label>
                <Input id="inquiry-tax" type="number" min="0" step="0.01" value={inquiryTax} onChange={(e) => setInquiryTax(e.target.value)} />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Other charges</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => setInquiryOtherCharges((items) => [...items, { name: '', amount: '' }])}>
                  <Plus className="mr-1 h-4 w-4" />Add charge
                </Button>
              </div>
              {inquiryOtherCharges.map((charge, index) => (
                <div key={index} className="flex gap-2">
                  <Input placeholder="Charge name (e.g. Transport)" value={charge.name} onChange={(e) => setInquiryOtherCharges((items) => items.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} />
                  <Input className="w-36" type="number" min="0" step="0.01" placeholder="Amount" value={charge.amount} onChange={(e) => setInquiryOtherCharges((items) => items.map((item, i) => i === index ? { ...item, amount: e.target.value } : item))} />
                  <Button type="button" size="icon" variant="ghost" aria-label="Remove charge" onClick={() => setInquiryOtherCharges((items) => items.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
            <div className="space-y-1 rounded-md border bg-muted/30 p-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Experiences</span><span>{money(inquiryCharges.base)}</span></div>
              {inquiryCharges.serviceCharge > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Service charge ({Number(inquiryServiceCharge) || 0}%)</span><span>{money(inquiryCharges.serviceCharge)}</span></div>}
              {inquiryCharges.tax > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tax ({Number(inquiryTax) || 0}%)</span><span>{money(inquiryCharges.tax)}</span></div>}
              {inquiryOtherCharges.map((charge, index) => charge.name && <div key={index} className="flex justify-between"><span className="text-muted-foreground">{charge.name}</span><span>{money(Number(charge.amount) || 0)}</span></div>)}
              <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Estimated total</span><span>{money(inquiryCharges.total)}</span></div>
            </div>
            <div className="space-y-2"><Label>Subject</Label><Input value={newInquiry.subject} onChange={(e) => setNewInquiry((current) => ({ ...current, subject: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Message / request details</Label><Textarea value={newInquiry.message} onChange={(e) => setNewInquiry((current) => ({ ...current, message: e.target.value }))} /></div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>Cancel</Button>
              <Button onClick={createInquiry} disabled={isCreating}>{isCreating ? 'Saving…' : editingInquiryId ? 'Save Changes' : 'Create Inquiry'}</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedInquiry)} onOpenChange={(open) => {
        if (!open && !isConfirming) {
          setSelectedInquiry(null);
          setConfirmingInquiry(null);
          setBillView(false);
          setDraftBillFrom(null);
        }
      }}>
        <DialogContent className={`max-h-[90vh] overflow-y-auto ${confirmingInquiry ? 'max-w-3xl' : 'max-w-xl'}`}>
          <DialogHeader><DialogTitle>{billView ? (draftBillFrom ? 'Draft Bill' : 'Experience Bill') : confirmingInquiry ? 'Confirm Experience & Add to Bill' : 'Experience Inquiry Details'}</DialogTitle></DialogHeader>
          {selectedInquiry && !confirmingInquiry && !billView && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {selectedInquiry.experiences && selectedInquiry.experiences.length > 0
                  ? selectedInquiry.experiences.map((item, index) => (
                      <Badge key={index} variant="outline"><Sparkles className="mr-1 h-3 w-3" />{item.name} · {item.people} {item.people === 1 ? 'person' : 'people'}</Badge>
                    ))
                  : <Badge variant="outline"><Sparkles className="mr-1 h-3 w-3" />{formatLabel(selectedInquiry.experience_type)}</Badge>}
                {!selectedInquiry.experiences?.length && selectedInquiry.guest_count ? <Badge variant="outline"><User className="mr-1 h-3 w-3" />{selectedInquiry.guest_count} {selectedInquiry.guest_count === 1 ? 'person' : 'people'}</Badge> : null}
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
                <Button variant="outline" onClick={() => { const inquiry = selectedInquiry; setSelectedInquiry(null); openInquiryForm(inquiry); }}>Edit Inquiry</Button>
                <Button onClick={() => openBilling(selectedInquiry)}><Sparkles className="mr-2 h-4 w-4" />{selectedInquiry.status === 'confirmed' ? 'Update Bill' : 'Confirm & Add to Bill'}</Button>
                {payments[selectedInquiry.id] || selectedInquiry.status === 'confirmed' || selectedInquiry.status === 'completed'
                  ? <Button variant="secondary" onClick={() => openBill(selectedInquiry)}>View Bill</Button>
                  : <Button variant="secondary" onClick={() => previewInquiryBill(selectedInquiry)}>Preview Bill</Button>}
              </div>
            </div>
          )}
          {selectedInquiry && billView && billIncome && (
            <div className="space-y-5">
              <div className="flex items-start justify-between border-b pb-4">
                <div>
                  <h2 className="text-2xl font-bold">Oruthota Chalets</h2>
                  <p className="text-sm text-muted-foreground">{draftBillFrom ? 'Draft Experience Bill · not yet confirmed' : `Experience Bill · ${serviceInvoiceNumber({ ...billIncome, service_type: 'Experience' })}`}</p>
                </div>
                {draftBillFrom
                  ? <Badge variant="outline" className="border-amber-500 text-amber-600">Draft</Badge>
                  : <Badge variant={billIncome.payment_status === 'paid' ? 'default' : 'secondary'}>{billIncome.payment_status === 'paid' ? 'Paid' : 'Payment Due'}</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-xs uppercase text-muted-foreground">Billed to</p><p className="font-medium">{billIncome.customer_name || selectedInquiry.name || 'Guest'}</p>{billIncome.room_number && <p className="text-muted-foreground">Room {billIncome.room_number}</p>}</div>
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
              <p className="text-sm text-muted-foreground">
                {draftBillFrom
                  ? 'Estimate only. Nothing is billed until the experience is confirmed.'
                  : billIncome.payment_status === 'paid' ? `Payment method: ${formatLabel(billIncome.payment_method)}` : 'Added to the guest consolidated bill for later payment.'}
              </p>
              {draftBillFrom ? (
                <DialogFooter>
                  {draftBillFrom === 'billing' ? (
                    <>
                      <Button variant="outline" onClick={() => setBillView(false)}>Back to Edit</Button>
                      <Button variant="secondary" onClick={printBill}><Printer className="mr-2 h-4 w-4" />Print Draft</Button>
                      <Button onClick={() => { setBillView(false); confirmAndAddToBill(); }} disabled={isConfirming || isLoadingBilling}>
                        {paymentStatus === 'paid' ? 'Save Payment' : 'Save to Bill'}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => { setBillView(false); setDraftBillFrom(null); }}>Back to Inquiry</Button>
                      <Button variant="secondary" onClick={printBill}><Printer className="mr-2 h-4 w-4" />Print Draft</Button>
                      <Button onClick={() => { setDraftBillFrom(null); openBilling(selectedInquiry); }}><Sparkles className="mr-2 h-4 w-4" />Confirm & Add to Bill</Button>
                    </>
                  )}
                </DialogFooter>
              ) : (
              <DialogFooter>
                <Button variant="outline" onClick={() => setBillView(false)}>Back to Inquiry</Button>
                <Button variant="secondary" onClick={() => openBilling(selectedInquiry)}>Update Bill</Button>
                {billIncome.payment_status === 'add_to_bill' && billIncome.customer_id && (
                  <Button variant="secondary" onClick={() => router.push(`/dashboard/front-desk?tab=check-out&customer_id=${encodeURIComponent(billIncome.customer_id)}`)}>Open Billing & Check-Out</Button>
                )}
                <Button onClick={printBill}><Printer className="mr-2 h-4 w-4" />Print Bill</Button>
              </DialogFooter>
              )}
            </div>
          )}
          {confirmingInquiry && !billView && (
            <div className="space-y-5">
              {isLoadingBilling && <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">Loading saved pricing and payment details…</div>}
              <p className="text-sm text-muted-foreground">The confirmed amount will appear under Experience in the guest's consolidated bill.</p>
              <RoomGuestPicker
                id="billing-room"
                value={billingRoom}
                onChange={(value) => { setBillingRoom(value); setBillingInHouse(false); }}
                guests={inHouseGuests}
                isLoading={isLoadingInHouseGuests}
                onOpen={loadInHouseGuests}
                onPick={(guest) => pickInHouseGuest(guest, 'billing')}
                onScan={(code) => handleGuestQrScan(code, 'billing')}
                customerRooms={billingRooms}
                onSelectRoom={(room) => { setBillingRoom(room); setBillingInHouse(true); }}
              />
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
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Experiences</Label>
                  <Button type="button" size="sm" variant="outline" onClick={() => setExperienceLines((lines) => [...lines, { master_id: 'custom', name: '', people: lines[0]?.people || '1', rate: '' }])}>
                    <Plus className="mr-1 h-4 w-4" />Add experience
                  </Button>
                </div>
                <div className="hidden grid-cols-[1fr_80px_120px_110px_36px] gap-2 px-1 text-xs font-medium uppercase text-muted-foreground sm:grid">
                  <span>Experience</span><span>People</span><span>Rate (LKR)</span><span className="text-right">Amount</span><span />
                </div>
                {experienceLines.map((line, index) => (
                  <div key={index} className="space-y-2 rounded-md border p-2 sm:border-0 sm:p-0">
                    <div className="grid grid-cols-[1fr_36px] gap-2 sm:grid-cols-[1fr_80px_120px_110px_36px] sm:items-center">
                      <Select value={line.master_id} onValueChange={(value) => pickLineExperience(index, value)}>
                        <SelectTrigger><SelectValue placeholder="Select experience" /></SelectTrigger>
                        <SelectContent>
                          {experienceMasters.map((master) => (
                            <SelectItem key={master.id} value={master.id}>{master.name} — {money(Number(master.default_amount || 0))}</SelectItem>
                          ))}
                          <SelectItem value="custom">Other (type name and rate)</SelectItem>
                          <SelectItem value="add_new" className="text-primary"><Plus className="mr-1 inline h-3 w-3" />Add new experience…</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button type="button" size="icon" variant="ghost" aria-label="Remove experience" className="sm:order-last" disabled={experienceLines.length === 1} onClick={() => setExperienceLines((lines) => lines.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
                      <div className="col-span-2 grid grid-cols-[80px_1fr_auto] items-center gap-2 sm:col-span-3 sm:grid-cols-[80px_120px_110px]">
                        <Input type="number" min="1" step="1" aria-label="People" value={line.people} onChange={(e) => updateLine(index, { people: e.target.value })} />
                        <Input type="number" min="0" step="0.01" aria-label="Rate per person" placeholder="Rate" value={line.rate} onChange={(e) => updateLine(index, { rate: e.target.value })} />
                        <span className="whitespace-nowrap text-right text-sm font-medium">{money(lineAmount(line))}</span>
                      </div>
                    </div>
                    {line.master_id === 'custom' && (
                      <Input placeholder="Experience name" value={line.name} onChange={(e) => updateLine(index, { name: e.target.value })} />
                    )}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                {experienceLines.map((line, index) => line.name && <div key={index} className="flex justify-between gap-4"><span>{line.name} ({Number(line.people) || 0} × {money(Number(line.rate) || 0)})</span><span className="whitespace-nowrap">LKR {lineAmount(line).toFixed(2)}</span></div>)}
                {serviceCharge > 0 && <div className="flex justify-between"><span>Service charge ({Number(serviceChargeRate) || 0}%)</span><span>LKR {serviceCharge.toFixed(2)}</span></div>}
                {tax > 0 && <div className="flex justify-between"><span>Tax ({Number(taxRate) || 0}%)</span><span>LKR {tax.toFixed(2)}</span></div>}
                {otherCharges.map((charge, index) => charge.name && <div key={index} className="flex justify-between"><span>{charge.name}</span><span>LKR {(Number(charge.amount) || 0).toFixed(2)}</span></div>)}
                <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span>LKR {billTotal.toFixed(2)}</span></div>
                {paymentStatus === 'add_to_bill' && (
                  <p className="text-xs text-muted-foreground">
                    {billingInHouse && billingRoom
                      ? `This cost will be added to the ${billingRoom} bill and paid at check-out.`
                      : `This cost will be added to ${customerName.trim() || 'the customer'}'s bill to pay later.`}
                  </p>
                )}
              </div>
              <div className="space-y-3 rounded-md border p-4">
                <Label>Payment</Label>
                <Select value={paymentStatus} onValueChange={(value) => setPaymentStatus(value as 'add_to_bill' | 'paid')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add_to_bill">{billingInHouse ? 'Add to room bill — pay at check-out' : 'Add to customer bill — pay later'}</SelectItem>
                    <SelectItem value="paid">Pay now</SelectItem>
                  </SelectContent>
                </Select>
                {!billingInHouse && (
                  <p className="text-xs text-muted-foreground">This customer is not checked in. Take payment now, or add it to their customer bill to pay later at the Front Desk. To put it on a room bill, select the checked-in guest by room number or QR.</p>
                )}
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
                <Button variant="secondary" onClick={previewBillingDraft} disabled={isConfirming || isLoadingBilling}>Preview Bill</Button>
                <Button onClick={confirmAndAddToBill} disabled={isConfirming || isLoadingBilling}>{isConfirming ? 'Saving…' : paymentStatus === 'paid' ? 'Save Payment' : 'Save to Bill'}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(newExperience)} onOpenChange={(open) => { if (!open && !isSavingExperience) setNewExperience(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add New Experience</DialogTitle></DialogHeader>
          {newExperience && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-experience-name">Experience name</Label>
                <Input id="new-experience-name" placeholder="e.g. Tea Plantation Tour" value={newExperience.name} onChange={(e) => setNewExperience((current) => current && { ...current, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-experience-rate">Rate per person (LKR)</Label>
                <Input id="new-experience-rate" type="number" min="0" step="0.01" value={newExperience.rate} onChange={(e) => setNewExperience((current) => current && { ...current, rate: e.target.value })} />
              </div>
              <p className="text-xs text-muted-foreground">Saved to the experience list. Change rates later in Services → Service Line Items.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewExperience(null)} disabled={isSavingExperience}>Cancel</Button>
                <Button onClick={saveNewExperience} disabled={isSavingExperience}>{isSavingExperience ? 'Saving…' : 'Add Experience'}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Room number search over checked-in guests, or a scan of the guest's QR pass;
// either one attaches that guest.
function RoomGuestPicker({ id, value, onChange, guests, isLoading, onOpen, onPick, onScan, customerRooms = [], onSelectRoom }: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  guests: InHouseGuest[];
  isLoading: boolean;
  onOpen: () => void;
  onPick: (guest: InHouseGuest) => void;
  onScan: (code: string) => Promise<boolean>;
  // The selected customer's current rooms; shown as choices when there are several.
  customerRooms?: string[];
  onSelectRoom?: (room: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [picked, setPicked] = useState(false);

  // Matches room number ("01", "Chalet 01"), guest name or mobile number.
  const filtered = useMemo(() => {
    const terms = value.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return guests;
    return guests.filter((guest) => {
      const haystack = `${guest.room} ${guest.guest_name} ${guest.phone || ''}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [guests, value]);

  const pick = (guest: InHouseGuest) => {
    onPick(guest);
    setPicked(true);
    setIsOpen(false);
  };

  return (
    <div className="relative space-y-2">
      <Label htmlFor={id}>Room number or guest QR (checked-in guest)</Label>
      <div className="flex gap-2">
      <Input
        id={id}
        placeholder="Type room number or guest name…"
        autoComplete="off"
        value={value}
        onChange={(event) => { onChange(event.target.value); setPicked(false); setIsOpen(true); }}
        onFocus={() => { setIsOpen(true); onOpen(); }}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && isOpen) { event.stopPropagation(); setIsOpen(false); }
          if (event.key === 'Enter' && isOpen && filtered.length > 0) { event.preventDefault(); pick(filtered[0]); }
        }}
      />
      <BarcodeScanner
        onScan={(code) => { setIsOpen(false); onScan(code).then(setPicked); }}
        title="Scan Guest QR Pass"
        description="Point the camera at the checked-in guest's QR pass."
        successTitle="Guest QR Captured"
        trigger={<Button type="button" variant="outline" className="shrink-0"><ScanLine className="mr-2 h-4 w-4" />Scan QR</Button>}
      />
      </div>
      {isOpen && (
        <div className="absolute top-[60px] z-20 max-h-48 w-full overflow-y-auto rounded-md border bg-popover shadow-lg">
          {filtered.length === 0 ? (
            <div className="p-2 text-center text-sm text-muted-foreground">{isLoading ? 'Loading checked-in guests…' : 'No checked-in guest found.'}</div>
          ) : filtered.map((guest) => (
            <div
              key={guest.key}
              className="cursor-pointer border-b p-2 text-sm last:border-0 hover:bg-muted"
              // mousedown keeps the click from being lost when the input blurs.
              onMouseDown={(event) => { event.preventDefault(); pick(guest); }}
            >
              <div className="font-medium">{guest.room} — {guest.customer?.name || guest.guest_name}</div>
              {guest.phone && <div className="text-xs text-muted-foreground">{guest.phone}</div>}
            </div>
          ))}
        </div>
      )}
      {customerRooms.length > 1 && onSelectRoom && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">This guest has {customerRooms.length} rooms. Choose the room to bill:</p>
          <div className="flex flex-wrap gap-2">
            {customerRooms.map((room) => (
              <Button key={room} type="button" size="sm" variant={value === room ? 'default' : 'outline'} onClick={() => { onSelectRoom(room); setPicked(true); }}>
                {room}
              </Button>
            ))}
          </div>
        </div>
      )}
      {(picked || (customerRooms.length > 0 && customerRooms.includes(value))) && <p className="text-xs text-green-600">Matched to the guest's current check-in</p>}
    </div>
  );
}
