'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { Progress } from '@/components/ui/progress';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import { usePagination } from '@/hooks/use-pagination';
import { useToast } from '@/hooks/use-toast';
import { Calendar } from '@/components/ui/calendar';
import type { ChaletBooking, ChaletPackage, ChaletRoom, ChaletRate, ChaletBookingStatus, ChaletRoomCategory, ChaletCoupon } from '@/lib/types';
import { Plus, Pencil, Trash2, BedDouble, CheckCircle, Clock, LogIn, AlertCircle, Search, ClipboardList, CalendarDays, UserRound, CreditCard, ArrowLeft, ArrowRight, History } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { chaletBillLines, chaletPaidLkr, type ChaletPaymentHistoryItem } from '@/lib/chalet-billing';
import { parseBookingPaymentOption, parseRoomTextDetails, roomTextDetailsAt } from '@/lib/chalet-room-details';

const statusColors: Record<ChaletBookingStatus, string> = {
    pending: 'bg-orange-100 text-orange-800 border-orange-200',
    confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
    checked_in: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    checked_out: 'bg-green-100 text-green-800 border-green-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200',
};

const statusLabels: Record<ChaletBookingStatus, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    checked_in: 'Checked In',
    checked_out: 'Checked Out',
    cancelled: 'Cancelled',
};

const emptyForm = {
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    customer_nic: '',
    nationality: '',
    check_in_date: '',
    check_out_date: '',
    package_id: '',
    room_category_id: '',
    adults: 1,
    children: 0,
    room_id: '',
    room_ids: [] as string[],
    room_packages: {} as Record<string, string>,
    room_guests: {} as Record<string, { adults: number; children: number }>,
    room_selections: [] as {
        id: string;
        room_category_id: string;
        package_id: string;
        room_id: string;
        adults: number;
        children: number;
    }[],
    rate_per_night: 0,
    currency: 'LKR' as 'LKR' | 'USD',
    coupon_id: '',
    coupon_code_input: '',
    service_charge_pct: 10,
    service_charge_currency: 'both' as 'LKR' | 'USD' | 'both',
    vat_pct: 18,
    vat_currency: 'both' as 'LKR' | 'USD' | 'both',
    sscl_pct: 2.5,
    sscl_currency: 'both' as 'LKR' | 'USD' | 'both',
    status: 'pending' as ChaletBookingStatus,
    payment_option: 'none' as 'none' | 'half' | 'full' | 'custom',
    payment_amount: '',
    payment_method: 'cash' as 'cash' | 'card' | 'online',
    payment_notes: '',
    // Payment already recorded on the booking (LKR). Read-only in the form;
    // the payment selector only adds a new payment on top of it.
    already_paid: 0,
    existing_payment_method: null as string | null,
    // Price lock for an existing booking (LKR): prices it was made with.
    // A room keeps its locked rate while its room type and package are unchanged.
    locked_usd_to_lkr_rate: 0,
    locked_room_rates: {} as Record<string, { rateLkr: number; package_id: string; room_category_id: string }>,
    locked_coupon: null as null | { coupon_id: string; amountLkr: number; subtotalLkr: number },
    existing_payment_option: 'none' as 'none' | 'half' | 'full' | 'custom',
    special_requests: '',
    notes: '',
};

const defaultBillSettings = {
    service_charge_pct: 10,
    service_charge_currency: 'both' as 'LKR' | 'USD' | 'both',
    vat_pct: 18,
    vat_currency: 'both' as 'LKR' | 'USD' | 'both',
    sscl_pct: 2.5,
    sscl_currency: 'both' as 'LKR' | 'USD' | 'both',
};

function formatCurrency(n: number) {
    return n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatBillAmount(amountLkr: number, currency: 'LKR' | 'USD', usdToLkrRate: number) {
    if (currency === 'USD' && amountLkr === 0) {
        return 'USD 0.00';
    }
    if (currency === 'USD' && usdToLkrRate > 0) {
        return `USD ${formatCurrency(amountLkr / usdToLkrRate)}`;
    }
    return `LKR ${formatCurrency(amountLkr)}`;
}

function chargeApplies(chargeCurrency: 'LKR' | 'USD' | 'both', billCurrency: 'LKR' | 'USD') {
    return chargeCurrency === 'both' || chargeCurrency === billCurrency;
}

function appliesLabel(chargeCurrency: 'LKR' | 'USD' | 'both') {
    return chargeCurrency === 'both' ? 'Both' : chargeCurrency;
}

function customerBillCurrency(nationality?: string | null): 'LKR' | 'USD' {
    return nationality === 'Non Sri Lankan' ? 'USD' : 'LKR';
}

function applyRateDiscount(amount: number, percent?: number | null, fixedValue?: number | null) {
    const fixed = Math.max(0, Number(fixedValue || 0));
    const discount = fixed > 0 ? fixed : amount * Math.min(100, Math.max(0, Number(percent || 0))) / 100;
    return Math.max(0, amount - discount);
}

function getLkrRateForNationality(rate: ChaletRate, nationality: string) {
    if (nationality !== 'Non Sri Lankan') {
        return applyRateDiscount(Number(rate.rate_per_night), rate.lkr_discount_value ?? rate.discount_percent ?? 0, rate.lkr_discount_fixed_value);
    }
    const usdRate = Number(rate.usd_rate_per_night || 0);
    const exchangeRate = Number(rate.usd_to_lkr_rate || 0);
    if (usdRate > 0 && exchangeRate > 0) {
        return applyRateDiscount(usdRate, rate.usd_discount_value ?? rate.discount_percent ?? 0, rate.usd_discount_fixed_value) * exchangeRate;
    }
    return applyRateDiscount(Number(rate.rate_per_night), rate.lkr_discount_value ?? rate.discount_percent ?? 0, rate.lkr_discount_fixed_value);
}

function rateForPackageAndCategory(rates: ChaletRate[], packageId: string, roomCategoryId: string | undefined, nationality: string) {
    if (!packageId) return 0;
    const rate = findRateForPackageAndCategory(rates, packageId, roomCategoryId);
    return rate ? getLkrRateForNationality(rate, nationality) : 0;
}

function findRateForPackageAndCategory(rates: ChaletRate[], packageId: string, roomCategoryId?: string) {
    if (!packageId) return undefined;
    return rates.find(r =>
        r.package_id === packageId &&
        !r.occupancy_type_id &&
        (r.room_category_id || '') === (roomCategoryId || '')
    ) || rates.find(r =>
        r.package_id === packageId &&
        !r.occupancy_type_id &&
        !r.room_category_id
    );
}

function parseLocalDate(value: string) {
    if (!value) return undefined;
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return undefined;
    return new Date(year, month - 1, day);
}

function normalizeDateRange(from: Date, to: Date): DateRange {
    return from <= to ? { from, to } : { from: to, to: from };
}

function createBlankRoomSelection() {
    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        room_category_id: '',
        package_id: '',
        room_id: '',
        adults: 1,
        children: 0,
    };
}

function allocationValue(allocation: NonNullable<ChaletBooking['room_allocations']>[number] | Record<string, any>, camelKey: string, snakeKey: string) {
    const values = allocation as Record<string, any>;
    return values?.[camelKey] ?? values?.[snakeKey] ?? '';
}

export default function ChaletBookingsPage() {
    const { toast } = useToast();
    const [bookings, setBookings] = useState<ChaletBooking[]>([]);
    const [packages, setPackages] = useState<ChaletPackage[]>([]);
    const [rooms, setRooms] = useState<ChaletRoom[]>([]);
    const [roomCategories, setRoomCategories] = useState<ChaletRoomCategory[]>([]);
    const [rates, setRates] = useState<ChaletRate[]>([]);
    const [coupons, setCoupons] = useState<ChaletCoupon[]>([]);
    const [loading, setLoading] = useState(true);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ ...emptyForm });
    const [billDefaults, setBillDefaults] = useState({ ...defaultBillSettings });
    const [saving, setSaving] = useState(false);
    const [wizardStep, setWizardStep] = useState(0);
    const [dragStartDate, setDragStartDate] = useState<Date | null>(null);
    const [datePickerOpen, setDatePickerOpen] = useState(false);

    const [assignDialogOpen, setAssignDialogOpen] = useState(false);
    const [assigningBooking, setAssigningBooking] = useState<ChaletBooking | null>(null);
    const [assignRoomIds, setAssignRoomIds] = useState<string[]>([]);
    const [assigning, setAssigning] = useState(false);

    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Payment history of the booking being edited.
    const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(false);
    const [paymentHistoryLoading, setPaymentHistoryLoading] = useState(false);
    const [paymentHistory, setPaymentHistory] = useState<{ payments: ChaletPaymentHistoryItem[]; total_lkr: number; paid_lkr: number; balance_lkr: number } | null>(null);

    // Checked-In Guests tab
    const [checkedInSearch, setCheckedInSearch] = useState('');
    const [checkedInDate, setCheckedInDate] = useState('');

    // Facility activity tracker
    const [activityBooking, setActivityBooking] = useState<ChaletBooking | null>(null);
    const [activityDialogOpen, setActivityDialogOpen] = useState(false);
    const [activityUsage, setActivityUsage] = useState<Set<string>>(new Set());
    const [isLoadingActivity, setIsLoadingActivity] = useState(false);
    const [togglingActivityKey, setTogglingActivityKey] = useState<string | null>(null);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const loadJson = async (url: string, label: string) => {
                const response = await fetch(url);
                const text = await response.text();
                let data: any = {};
                try {
                    data = text ? JSON.parse(text) : {};
                } catch {
                    throw new Error(`${label} returned an invalid response.`);
                }
                if (!response.ok || data.error) {
                    throw new Error(data.error || `${label} failed to load.`);
                }
                return data;
            };
            const [bData, pData, rData, rateData, catData, couponData, settingsData] = await Promise.all([
                loadJson('/api/chalet/bookings', 'Bookings'),
                loadJson('/api/chalet/packages', 'Packages'),
                loadJson('/api/chalet/rooms', 'Rooms'),
                loadJson('/api/chalet/rates', 'Rates'),
                loadJson('/api/chalet/room-categories', 'Room categories'),
                loadJson('/api/chalet/coupons', 'Coupons'),
                loadJson('/api/admin/app-settings?key=chalet_bill_settings', 'Bill settings').catch(() => ({ value: null })),
            ]);
            setBookings(bData.bookings || []);
            setPackages(pData.packages || []);
            setRooms(rData.rooms || []);
            setRates(rateData.rates || []);
            setRoomCategories(catData.categories || []);
            setCoupons(couponData.coupons || []);
            if (settingsData.value) setBillDefaults({ ...defaultBillSettings, ...settingsData.value });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to load data', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    useEffect(() => {
        if (!dragStartDate) return;
        const stopDragging = () => setDragStartDate(null);
        document.addEventListener('mouseup', stopDragging);
        return () => document.removeEventListener('mouseup', stopDragging);
    }, [dragStartDate]);

    // Auto-lookup rate when package + room category + nationality selected
    useEffect(() => {
        if (form.package_id) {
            const rate = rates.find(r =>
                r.package_id === form.package_id &&
                !r.occupancy_type_id &&
                (r.room_category_id || '') === form.room_category_id
            ) || rates.find(r =>
                r.package_id === form.package_id &&
                !r.occupancy_type_id &&
                !r.room_category_id
            );
            if (rate) {
                const selectedRate = getLkrRateForNationality(rate, form.nationality);
                setForm(prev => ({ ...prev, currency: customerBillCurrency(prev.nationality), rate_per_night: selectedRate }));
            }
        }
    }, [form.package_id, form.room_category_id, form.nationality, rates]);

    const nights = (() => {
        if (!form.check_in_date || !form.check_out_date) return 0;
        const diff = new Date(form.check_out_date).getTime() - new Date(form.check_in_date).getTime();
        return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
    })();

    const roomSelections = form.room_selections;
    const roomTextDetails = parseRoomTextDetails(form.special_requests);
    const websitePaymentOption = parseBookingPaymentOption(form.special_requests);
    const selectedRoomIds = roomSelections.map(selection => selection.room_id).filter(Boolean);
    const selectedRooms = selectedRoomIds.map(id => rooms.find(room => room.id === id)).filter(Boolean) as ChaletRoom[];
    const selectedRoom = selectedRooms[0];
    // Price every room slot, including slots that have a category/package but
    // no chalet assigned yet, so multi-room bookings aren't under-counted.
    const pricedRoomSelections = roomSelections.filter(selection => selection.package_id);
    // Exchange rate locked on the booking (0 for a new booking: current rates).
    const lockedUsdRate = Number(form.locked_usd_to_lkr_rate || 0);
    // A room's current price in LKR; for USD bookings with a locked rate the
    // USD price is converted at that locked rate.
    const currentRoomRateLkr = (packageId: string, categoryId?: string) => {
        const rateRecord = findRateForPackageAndCategory(rates, packageId, categoryId);
        if (!rateRecord) return 0;
        const lkr = getLkrRateForNationality(rateRecord, form.nationality);
        const recordRate = Number(rateRecord.usd_to_lkr_rate || 0);
        return form.nationality === 'Non Sri Lankan' && lockedUsdRate > 0 && recordRate > 0 && Number(rateRecord.usd_rate_per_night || 0) > 0
            ? lkr / recordRate * lockedUsdRate
            : lkr;
    };
    const roomRateFor = (selection: typeof roomSelections[number]) => {
        const room = rooms.find(item => item.id === selection.room_id);
        const categoryId = room?.category_id || selection.room_category_id;
        const lock = form.locked_room_rates[selection.id];
        if (lock && lock.package_id === selection.package_id && lock.room_category_id === categoryId) return { rate: lock.rateLkr, locked: true };
        return { rate: currentRoomRateLkr(selection.package_id, categoryId), locked: false };
    };
    const pricesLocked = Object.keys(form.locked_room_rates).length > 0;
    const anyRoomRepriced = pricesLocked && pricedRoomSelections.some(selection => !roomRateFor(selection).locked);
    const selectedRoomNightlyTotal = pricedRoomSelections.length > 0
        ? pricedRoomSelections.reduce((sum, selection) => sum + roomRateFor(selection).rate, 0)
        : form.rate_per_night;
    const selectedRoomRateRows = roomSelections
        .map(selection => {
        const room = rooms.find(item => item.id === selection.room_id);
        if (!room) return null;
        const packageId = selection.package_id;
        const roomCategory = roomCategories.find(category => category.id === room.category_id);
        const rateRecord = findRateForPackageAndCategory(rates, packageId, room.category_id || selection.room_category_id);
        return {
            room,
            selection,
            categoryName: roomCategory?.name || 'No category',
            packageName: packages.find(pkg => pkg.id === packageId)?.name || '—',
            rate: rateRecord ? getLkrRateForNationality(rateRecord, form.nationality) : 0,
            usdToLkrRate: Number(rateRecord?.usd_to_lkr_rate || 0),
        };
    })
        .filter(Boolean) as { room: ChaletRoom; selection: typeof roomSelections[number]; categoryName: string; packageName: string; rate: number; usdToLkrRate: number }[];
    const breakdownRateRows = pricedRoomSelections.map(selection => {
        const room = rooms.find(item => item.id === selection.room_id);
        const categoryId = room?.category_id || selection.room_category_id;
        const rateRecord = findRateForPackageAndCategory(rates, selection.package_id, categoryId);
        return {
            key: selection.id,
            roomLabel: room ? `Chalet ${room.room_number}` : 'Unassigned room',
            categoryName: roomCategories.find(category => category.id === categoryId)?.name || 'No category',
            packageName: packages.find(pkg => pkg.id === selection.package_id)?.name || '—',
            rate: roomRateFor(selection).rate,
            locked: roomRateFor(selection).locked,
            usdToLkrRate: lockedUsdRate || Number(rateRecord?.usd_to_lkr_rate || 0),
        };
    });
    const subtotal = selectedRoomNightlyTotal * nights;
    const selectedRoomCategory = roomCategories.find(category => category.id === form.room_category_id);
    const selectedRate = findRateForPackageAndCategory(rates, form.package_id, form.room_category_id);
    const billUsdToLkrRate = lockedUsdRate || breakdownRateRows.find(row => row.usdToLkrRate > 0)?.usdToLkrRate || selectedRoomRateRows.find(row => row.usdToLkrRate > 0)?.usdToLkrRate || Number(selectedRate?.usd_to_lkr_rate || 0);
    const billCurrency = customerBillCurrency(form.nationality);
    const activeCoupons = coupons.filter(coupon => {
        const today = new Date().toISOString().slice(0, 10);
        const withinDates = (!coupon.valid_from || coupon.valid_from <= today) && (!coupon.valid_to || coupon.valid_to >= today);
        const withinUsage = !coupon.max_usage || Number(coupon.used_count || 0) < Number(coupon.max_usage);
        return coupon.is_active && withinDates && withinUsage;
    });
    const typedCouponCode = form.coupon_code_input.trim().toUpperCase();
    const typedCoupon = typedCouponCode ? activeCoupons.find(coupon => coupon.code.toUpperCase() === typedCouponCode) : undefined;
    const selectedCoupon = coupons.find(coupon => coupon.id === form.coupon_id) || typedCoupon;
    const couponWithinBillLimits = (coupon: ChaletCoupon) => (
        subtotal >= Number(coupon.min_bill_amount || 0) &&
        (!coupon.max_bill_amount || subtotal <= Number(coupon.max_bill_amount))
    );
    const couponEligible = !!selectedCoupon &&
        selectedCoupon.is_active &&
        couponWithinBillLimits(selectedCoupon) &&
        (!selectedCoupon.max_usage || Number(selectedCoupon.used_count || 0) < Number(selectedCoupon.max_usage));
    const rawCouponDiscount = selectedCoupon && couponEligible
        ? selectedCoupon.discount_type === 'percentage'
            ? subtotal * Number(selectedCoupon.discount_value || 0) / 100
            : Number(selectedCoupon.discount_value || 0)
        : 0;
    const calculatedCouponDiscount = Math.min(
        subtotal,
        selectedCoupon?.discount_type === 'percentage' && Number(selectedCoupon.max_discount_amount || 0) > 0
            ? Math.min(rawCouponDiscount, Number(selectedCoupon.max_discount_amount || 0))
            : rawCouponDiscount
    );
    // The coupon discount stays as booked while the coupon and room prices are unchanged.
    const couponDiscountAmount = form.locked_coupon
        && form.locked_coupon.coupon_id === (form.coupon_id || '')
        && Math.abs(subtotal - form.locked_coupon.subtotalLkr) < 0.01
        ? Math.min(subtotal, form.locked_coupon.amountLkr)
        : calculatedCouponDiscount;
    const discountedSubtotal = Math.max(0, subtotal - couponDiscountAmount);
    const scAmount = chargeApplies(form.service_charge_currency, billCurrency) ? discountedSubtotal * form.service_charge_pct / 100 : 0;
    const vatAmount = chargeApplies(form.vat_currency, billCurrency) ? discountedSubtotal * form.vat_pct / 100 : 0;
    const ssclAmount = chargeApplies(form.sscl_currency, billCurrency) ? discountedSubtotal * form.sscl_pct / 100 : 0;
    const grandTotal = discountedSubtotal + scAmount + vatAmount + ssclAmount;
    const alreadyPaidAmount = Math.max(0, Number(form.already_paid || 0));
    const balanceBeforePayment = Math.max(0, grandTotal - alreadyPaidAmount);
    // The payment amount is typed in the bill currency (USD for foreign guests)
    // and converted to LKR, which is what the booking stores.
    const paymentUsesUsd = billCurrency === 'USD' && billUsdToLkrRate > 0;
    // The form works in LKR; bookings store prices in their own currency.
    const toBookingCurrencyAmount = (amountLkr: number) => (
        paymentUsesUsd ? Math.round(amountLkr / billUsdToLkrRate * 100) / 100 : amountLkr
    );
    const toPaymentInputAmount = (amountLkr: number) => paymentUsesUsd ? amountLkr / billUsdToLkrRate : amountLkr;
    const paymentInputCurrency = paymentUsesUsd ? 'USD' : 'LKR';
    const balanceBeforePaymentInput = Math.round(toPaymentInputAmount(balanceBeforePayment) * 100) / 100;
    const enteredPaymentAmount = Math.max(0, Number(form.payment_amount || 0));
    // Entering the shown (rounded) balance settles it fully, without leaving
    // a few cents behind from currency rounding.
    const payNowAmount = enteredPaymentAmount <= 0
        ? 0
        : enteredPaymentAmount >= balanceBeforePaymentInput - 0.005
            ? balanceBeforePayment
            : paymentUsesUsd ? enteredPaymentAmount * billUsdToLkrRate : enteredPaymentAmount;
    // Total paid on the booking: the existing payment is never reduced here.
    const resolvedPaymentAmount = alreadyPaidAmount + payNowAmount;
    const paymentBalance = Math.max(0, grandTotal - resolvedPaymentAmount);
    const appliedChargeRows = [
        { label: 'Service Charge', pct: form.service_charge_pct, appliesTo: form.service_charge_currency, amount: scAmount },
        { label: 'VAT', pct: form.vat_pct, appliesTo: form.vat_currency, amount: vatAmount },
        { label: 'SSCL', pct: form.sscl_pct, appliesTo: form.sscl_currency, amount: ssclAmount },
    ].filter(charge => Number(charge.pct || 0) > 0 && chargeApplies(charge.appliesTo, billCurrency));
    const selectedDateRange: DateRange | undefined = form.check_in_date
        ? { from: parseLocalDate(form.check_in_date), to: parseLocalDate(form.check_out_date) }
        : undefined;
    const checkInDisplay = selectedDateRange?.from ? format(selectedDateRange.from, 'dd MMM yyyy').toUpperCase() : 'Select date';
    const checkOutDisplay = selectedDateRange?.to ? format(selectedDateRange.to, 'dd MMM yyyy').toUpperCase() : 'Select date';

    // Mirrors the overlap check in the API: back-to-back stays (one checks
    // out the day the next checks in) don't count as a conflict.
    const isRoomBooked = (roomId: string, checkIn: string, checkOut: string, excludeId?: string | null) => {
        if (!checkIn || !checkOut) return false;
        return bookings.some(b =>
            (b.room_id === roomId ||
                (Array.isArray(b.room_ids) && b.room_ids.includes(roomId)) ||
                (Array.isArray(b.room_allocations) && b.room_allocations.some(allocation => allocationValue(allocation as Record<string, any>, 'roomId', 'room_id') === roomId))) &&
            b.status !== 'cancelled' &&
            b.id !== excludeId &&
            b.check_in_date < checkOut &&
            b.check_out_date > checkIn
        );
    };

    // A chalet is selectable whenever no other booking holds it for the stay
    // dates. Room status is ignored, and guest limits are validated per room
    // separately (guestLimitErrors) using each room's own guest numbers.
    const getRoomDateAvailability = (room: ChaletRoom, checkIn: string, checkOut: string, excludeId?: string | null) => (
        isRoomBooked(room.id, checkIn, checkOut, excludeId)
            ? { available: false, label: 'Booked for selected dates' }
            : { available: true, label: 'Available for selected dates' }
    );

    const getRoomGuestLimits = (room: ChaletRoom) => {
        const roomCategory = roomCategories.find(category => category.id === room.category_id);
        return {
            maxAdults: room.max_adults ?? roomCategory?.max_adults ?? 99,
            maxChildren: room.max_children ?? roomCategory?.max_children ?? 99,
            maxGuests: room.max_guests ?? roomCategory?.max_guests ?? 99,
        };
    };
    const getRoomGuests = (roomId: string) => {
        const selection = roomSelections.find(item => item.room_id === roomId);
        return selection ? { adults: selection.adults, children: selection.children } : { adults: 1, children: 0 };
    };
    const roomGuestTotals = roomSelections.reduce((totals, selection) => {
        return { adults: totals.adults + selection.adults, children: totals.children + selection.children };
    }, { adults: 0, children: 0 });
    const guestLimitErrors = selectedRooms.flatMap(room => {
        const guests = getRoomGuests(room.id);
        const limits = getRoomGuestLimits(room);
        return [
            guests.adults > limits.maxAdults ? `Chalet ${room.room_number}: adults cannot exceed ${limits.maxAdults}.` : '',
            guests.children > limits.maxChildren ? `Chalet ${room.room_number}: children cannot exceed ${limits.maxChildren}.` : '',
            guests.adults + guests.children > limits.maxGuests ? `Chalet ${room.room_number}: total guests cannot exceed ${limits.maxGuests}.` : '',
        ].filter(Boolean);
    });
    const guestLimitsValid = guestLimitErrors.length === 0;
    const wizardSteps = [
        { label: 'Guest', icon: UserRound },
        { label: 'Stay & Rooms', icon: BedDouble },
        { label: 'Confirm', icon: CreditCard },
    ];
    const canContinueGuest = !!form.customer_name.trim();
    const canContinueStay = !!form.check_in_date && !!form.check_out_date && nights > 0 && guestLimitsValid;
    const canContinueRoom = roomSelections.length > 0 && roomSelections.every(selection => selection.room_category_id && selection.package_id && selection.room_id);
    const canContinueStep = wizardStep === 0 ? canContinueGuest : wizardStep === 1 ? canContinueStay && canContinueRoom : true;
    const stepProgress = ((wizardStep + 1) / wizardSteps.length) * 100;

    const goNextStep = () => {
        if (!guestLimitsValid) {
            toast({ title: 'Guest limit exceeded', description: guestLimitErrors[0], variant: 'destructive' });
            return;
        }
        if (!canContinueStep) {
            toast({
                title: 'Complete this step',
                description: wizardStep === 0
                    ? 'Enter the guest name before continuing.'
                    : wizardStep === 1
                        ? 'Select stay dates and complete at least one room row.'
                        : 'Review the booking before saving.',
                variant: 'destructive',
            });
            return;
        }
        setWizardStep(step => Math.min(step + 1, wizardSteps.length - 1));
    };

    const clampRoomGuests = (room: ChaletRoom, nextAdults: number, nextChildren: number) => {
        const { maxAdults, maxChildren, maxGuests } = getRoomGuestLimits(room);
        const adults = Math.min(Math.max(1, nextAdults), maxAdults);
        const children = Math.min(Math.max(0, nextChildren), maxChildren);
        if (adults + children <= maxGuests) return { adults, children };
        const over = adults + children - maxGuests;
        return { adults, children: Math.max(0, children - over) };
    };

    const applyRoomCategory = (categoryId: string) => {
        setForm(p => ({ ...p, room_category_id: categoryId, room_id: '', room_ids: [], room_packages: {}, room_guests: {}, room_selections: [createBlankRoomSelection()] }));
    };

    const addRoomSelection = () => {
        setForm(p => ({
            ...p,
            room_selections: [...p.room_selections, createBlankRoomSelection()],
        }));
    };

    const updateRoomSelection = (selectionId: string, patch: Partial<typeof emptyForm.room_selections[number]>) => {
        setForm(p => ({
            ...p,
            room_selections: p.room_selections.map(selection => selection.id === selectionId ? { ...selection, ...patch } : selection),
        }));
    };

    const removeRoomSelection = (selectionId: string) => {
        setForm(p => ({
            ...p,
            room_selections: p.room_selections.filter(selection => selection.id !== selectionId),
        }));
    };

    const availableRoomsForSelection = (selection: typeof emptyForm.room_selections[number]) => {
        const selectedInOtherRows = new Set(roomSelections.filter(item => item.id !== selection.id).map(item => item.room_id).filter(Boolean));
        return rooms
            .filter(room => !selection.room_category_id || room.category_id === selection.room_category_id)
            .map(room => ({
                room,
                availability: selectedInOtherRows.has(room.id)
                    ? { available: false, label: 'Already selected in this booking' }
                    : getRoomDateAvailability(room, form.check_in_date, form.check_out_date, editingId),
            }));
    };

    useEffect(() => {
        if (selectedRoomIds.length === 0 || !form.check_in_date || !form.check_out_date) return;
        const unavailableRoom = selectedRooms.find(room => !getRoomDateAvailability(room, form.check_in_date, form.check_out_date, editingId).available);
        if (unavailableRoom) {
            setForm(prev => {
                const room_selections = prev.room_selections.filter(selection => selection.room_id !== unavailableRoom.id);
                const room_ids = room_selections.map(selection => selection.room_id).filter(Boolean);
                const { [unavailableRoom.id]: _removed, ...room_packages } = prev.room_packages;
                const { [unavailableRoom.id]: _removedGuests, ...room_guests } = prev.room_guests;
                return { ...prev, room_selections, room_ids, room_id: room_ids[0] || '', room_packages, room_guests };
            });
            toast({
                title: 'Room unavailable',
                description: `Chalet ${unavailableRoom.room_number} is already booked by another guest for these dates. Please choose another room.`,
                variant: 'destructive',
            });
        }
    }, [form.check_in_date, form.check_out_date, form.room_selections, rooms, roomCategories, bookings, editingId, toast]);

    const openPaymentHistory = async () => {
        if (!editingId) return;
        setPaymentHistoryOpen(true);
        setPaymentHistoryLoading(true);
        setPaymentHistory(null);
        try {
            const res = await fetch(`/api/chalet/bookings/payments?booking_id=${encodeURIComponent(editingId)}`, { cache: 'no-store' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setPaymentHistory(data);
        } catch (e: any) {
            toast({ title: 'Payment history unavailable', description: e.message, variant: 'destructive' });
            setPaymentHistoryOpen(false);
        } finally {
            setPaymentHistoryLoading(false);
        }
    };

    const openNew = () => {
        setEditingId(null);
        setForm({ ...emptyForm, ...billDefaults, room_selections: [createBlankRoomSelection()] });
        setWizardStep(0);
        setDialogOpen(true);
    };

    const openEdit = (b: ChaletBooking) => {
        const allocationRows = Array.isArray(b.room_allocations) ? b.room_allocations : [];
        const allocationRoomIds = allocationRows
            .map(allocation => allocationValue(allocation as Record<string, any>, 'roomId', 'room_id'))
            .filter(Boolean);
        const editRoomIds = b.room_ids?.length ? b.room_ids : allocationRoomIds.length ? allocationRoomIds : b.room_id ? [b.room_id] : [];
        const editRoomCount = Math.max(1, allocationRows.length || editRoomIds.length);
        // An allocation without its own room may only take a room from room_ids
        // that no other allocation already holds, otherwise one chalet would be
        // loaded (and priced) twice.
        const claimedRoomIds = new Set<string>(allocationRoomIds);
        const spareRoomIds = editRoomIds.filter(roomId => !claimedRoomIds.has(roomId));
        const editRoomSelections = (allocationRows.length > 0 ? allocationRows : editRoomIds).map((row, index) => {
            const allocation = typeof row === 'string' ? null : row as Record<string, any>;
            const roomId = allocation
                ? allocationValue(allocation, 'roomId', 'room_id') || spareRoomIds.shift() || ''
                : row as string;
            const room = rooms.find(item => item.id === roomId);
            const guests = b.room_guests?.[roomId] || {
                adults: Number(allocation ? allocation.adults ?? 1 : index === 0 ? b.adults ?? 1 : 1),
                children: Number(allocation ? allocation.children ?? 0 : index === 0 ? b.children ?? 0 : 0),
            };
            return {
                id: `${roomId || 'allocation'}-${index}`,
                room_category_id: room?.category_id || (allocation ? allocationValue(allocation, 'roomCategoryId', 'room_category_id') : '') || b.room_category_id || '',
                package_id: (allocation ? allocationValue(allocation, 'packageId', 'package_id') : '') || (roomId ? b.room_packages?.[roomId] : '') || b.package_id || '',
                room_id: roomId,
                adults: guests.adults,
                children: guests.children,
            };
        });
        // Website (PayHere) payments are recorded in the booking currency, while
        // the form works in LKR. Convert them so an online payment shows as paid.
        const onlineBooking = b as ChaletBooking & { payhere_amount?: number | null; payhere_currency?: string | null };
        const onlinePaidAmount = Number(onlineBooking.payhere_amount || 0);
        const onlinePaidCurrency = String(onlineBooking.payhere_currency || b.currency || customerBillCurrency(b.nationality)).toUpperCase();
        const firstSelection = editRoomSelections[0];
        // The exchange rate locked on the booking, else today's rate.
        const lockedBookingRate = Number((b as ChaletBooking & { usd_to_lkr_rate?: number | null }).usd_to_lkr_rate || 0);
        const onlineExchangeRate = lockedBookingRate || Number(findRateForPackageAndCategory(rates, firstSelection?.package_id || b.package_id || '', firstSelection?.room_category_id || b.room_category_id || '')?.usd_to_lkr_rate || 0);
        const onlinePaidLkr = onlinePaidCurrency === 'USD' ? (onlineExchangeRate > 0 ? onlinePaidAmount * onlineExchangeRate : 0) : onlinePaidAmount;
        const editPaidAmount = Math.max(Number(b.amount_paid || 0), onlinePaidLkr);
        const savedPaymentOption = b.payment_option as 'none' | 'half' | 'full' | 'custom' | undefined;

        // Price lock: each room's nightly price as booked, in LKR. Uses the
        // per-room prices saved with the booking, else splits the booked
        // nightly total across the rooms in proportion to their rates.
        const bookingCurrency = b.currency || customerBillCurrency(b.nationality);
        const toLkrAtBookingRate = (value: number) => bookingCurrency === 'USD' && onlineExchangeRate > 0 ? value * onlineExchangeRate : value;
        const savedRoomRates = allocationRows.map(allocation => {
            const value = (allocation as Record<string, any>).ratePerNight ?? (allocation as Record<string, any>).rate_per_night;
            return value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
        });
        const bookedNightlyTotalLkr = toLkrAtBookingRate(Number(b.rate_per_night || 0));
        const rateWeights = editRoomSelections.map(selection => {
            const room = rooms.find(item => item.id === selection.room_id);
            return selection.package_id ? rateForPackageAndCategory(rates, selection.package_id, room?.category_id || selection.room_category_id, b.nationality || '') : 0;
        });
        const pricedCount = editRoomSelections.filter(selection => selection.package_id).length;
        const weightTotal = rateWeights.reduce((sum, weight) => sum + weight, 0);
        const lockedRoomRatesLkr = editRoomSelections.map((selection, index) => {
            if (savedRoomRates.length === editRoomSelections.length && savedRoomRates.every(value => value !== null)) return toLkrAtBookingRate(savedRoomRates[index] as number);
            if (!selection.package_id) return 0;
            return weightTotal > 0 ? bookedNightlyTotalLkr * rateWeights[index] / weightTotal : bookedNightlyTotalLkr / Math.max(1, pricedCount);
        });
        const hasBookedPrices = Number(b.rate_per_night || 0) > 0 || savedRoomRates.some(value => value !== null);
        const lockedRoomRates = hasBookedPrices
            ? Object.fromEntries(editRoomSelections
                .map((selection, index) => [selection, lockedRoomRatesLkr[index]] as const)
                .filter(([selection]) => selection.package_id)
                .map(([selection, rateLkr]) => [selection.id, { rateLkr, package_id: selection.package_id, room_category_id: selection.room_category_id }]))
            : {};
        const editNights = Math.max(0, Math.round((new Date(b.check_out_date).getTime() - new Date(b.check_in_date).getTime()) / 86400000));
        const lockedSubtotalLkr = editRoomSelections.reduce((sum, selection, index) => sum + (selection.package_id ? lockedRoomRatesLkr[index] : 0), 0) * editNights;
        setEditingId(b.id);
        setForm({
            customer_name: b.customer_name,
            customer_email: b.customer_email || '',
            customer_phone: b.customer_phone || '',
            customer_nic: b.customer_nic || '',
            nationality: b.nationality || '',
            check_in_date: b.check_in_date,
            check_out_date: b.check_out_date,
            package_id: b.package_id || '',
            room_category_id: b.room_category_id || '',
            adults: b.adults ?? 1,
            children: b.children ?? 0,
            room_id: b.room_id || '',
            room_ids: editRoomIds,
            room_packages: b.room_packages || Object.fromEntries(editRoomIds.map(roomId => [roomId, b.package_id || ''])),
            room_guests: b.room_guests || Object.fromEntries(editRoomIds.map((roomId, index) => [roomId, index === 0 ? { adults: b.adults ?? 1, children: b.children ?? 0 } : { adults: 1, children: 0 }])),
            room_selections: editRoomSelections.length > 0 ? editRoomSelections : [createBlankRoomSelection()],
            // Stored in the booking currency; the form works in LKR.
            rate_per_night: ((b.currency || customerBillCurrency(b.nationality)) === 'USD' && onlineExchangeRate > 0
                ? Number(b.rate_per_night || 0) * onlineExchangeRate
                : Number(b.rate_per_night || 0)) / editRoomCount,
            currency: b.currency || 'LKR',
            coupon_id: b.coupon_id || '',
            coupon_code_input: b.coupon_code || '',
            // Charges are locked as saved on the booking.
            service_charge_pct: b.service_charge_pct ?? billDefaults.service_charge_pct,
            service_charge_currency: b.service_charge_currency || 'both',
            vat_pct: b.vat_pct ?? billDefaults.vat_pct,
            vat_currency: b.vat_currency || 'both',
            sscl_pct: b.sscl_pct ?? billDefaults.sscl_pct,
            sscl_currency: b.sscl_currency || 'both',
            locked_usd_to_lkr_rate: onlineExchangeRate,
            locked_room_rates: lockedRoomRates,
            locked_coupon: hasBookedPrices
                ? { coupon_id: b.coupon_id || '', amountLkr: toLkrAtBookingRate(Number(b.coupon_discount_amount || 0)), subtotalLkr: lockedSubtotalLkr }
                : null,
            status: b.status,
            payment_option: 'none',
            payment_amount: '',
            already_paid: editPaidAmount,
            existing_payment_method: b.payment_method || (onlinePaidLkr > 0 ? 'online' : null),
            existing_payment_option: savedPaymentOption || 'none',
            payment_method: b.payment_method === 'card' || b.payment_method === 'online' ? b.payment_method : 'cash',
            payment_notes: b.payment_notes || '',
            special_requests: b.special_requests || '',
            notes: b.notes || '',
        });
        setWizardStep(0);
        setDialogOpen(true);
    };

    const handleSaveDateRange = (range: DateRange | undefined) => {
        if (!range?.from) {
            setForm(p => ({ ...p, check_in_date: '', check_out_date: '', room_id: '', room_ids: [], room_packages: {}, room_guests: {}, room_selections: [createBlankRoomSelection()] }));
            return;
        }
        setForm(p => ({
            ...p,
            check_in_date: format(range.from!, 'yyyy-MM-dd'),
            check_out_date: range.to ? format(range.to, 'yyyy-MM-dd') : '',
            room_id: '',
            room_ids: [],
            room_packages: {},
            room_guests: {},
            room_selections: [createBlankRoomSelection()],
        }));
    };

    const handleDateDragStart = (day: Date) => {
        setDragStartDate(day);
        handleSaveDateRange({ from: day, to: undefined });
    };

    const handleDateDragMove = (day: Date) => {
        if (!dragStartDate) return;
        handleSaveDateRange(normalizeDateRange(dragStartDate, day));
    };

    const handleDateDragEnd = (day: Date) => {
        if (!dragStartDate) return;
        handleSaveDateRange(normalizeDateRange(dragStartDate, day));
        setDragStartDate(null);
    };

    const handleSave = async () => {
        if (!form.customer_name || !form.check_in_date || !form.check_out_date) {
            toast({ title: 'Validation', description: 'Customer name, check-in and check-out are required', variant: 'destructive' });
            return;
        }
        if (!guestLimitsValid) {
            toast({ title: 'Guest limit exceeded', description: guestLimitErrors[0], variant: 'destructive' });
            return;
        }
        if (selectedRoomIds.length > 0) {
            for (const roomId of selectedRoomIds) {
                const room = rooms.find(item => item.id === roomId);
                const availability = room
                    ? getRoomDateAvailability(room, form.check_in_date, form.check_out_date, editingId)
                    : { available: false, label: 'not available' };
                if (!availability.available) {
                    toast({ title: 'Room unavailable', description: 'Please choose available chalet rooms for the selected dates.', variant: 'destructive' });
                    return;
                }
            }
        } else {
            toast({ title: 'Room required', description: 'Select at least one chalet room for this booking.', variant: 'destructive' });
                return;
        }
        setSaving(true);
        try {
            const payload = {
                ...form,
                currency: billCurrency,
                guest_count: roomGuestTotals.adults + roomGuestTotals.children,
                adults: roomGuestTotals.adults,
                children: roomGuestTotals.children,
                package_id: selectedRoomRateRows[0]?.selection.package_id || null,
                occupancy_type_id: null,
                room_category_id: selectedRoomRateRows[0]?.selection.room_category_id || selectedRoomRateRows[0]?.room.category_id || null,
                room_id: selectedRoomIds[0] || null,
                room_ids: selectedRoomIds,
                room_allocations: roomSelections.map(selection => ({
                    roomId: selection.room_id || null,
                    roomCategoryId: selection.room_category_id || null,
                    packageId: selection.package_id || null,
                    adults: selection.adults,
                    children: selection.children,
                    // Room's nightly price locked with the booking (booking currency).
                    ratePerNight: selection.package_id ? toBookingCurrencyAmount(roomRateFor(selection).rate) : null,
                })),
                // Exchange rate locked with the booking.
                usd_to_lkr_rate: billUsdToLkrRate > 0 ? billUsdToLkrRate : null,
                room_packages: Object.fromEntries(roomSelections.filter(selection => selection.room_id).map(selection => [selection.room_id, selection.package_id])),
                room_guests: Object.fromEntries(roomSelections.filter(selection => selection.room_id).map(selection => [selection.room_id, { adults: selection.adults, children: selection.children }])),
                // Stored in the booking's own currency (USD for foreign guests),
                // the same as website bookings; bill_total_lkr keeps the LKR bill.
                rate_per_night: toBookingCurrencyAmount(selectedRoomNightlyTotal),
                coupon_id: selectedCoupon?.id || null,
                coupon_code: selectedCoupon?.code || null,
                coupon_discount_amount: toBookingCurrencyAmount(couponDiscountAmount),
                amount_paid: resolvedPaymentAmount,
                payment_option: payNowAmount > 0
                    ? (alreadyPaidAmount <= 0 && payNowAmount >= grandTotal ? 'full' : 'custom')
                    : (alreadyPaidAmount > 0 ? (form.existing_payment_option !== 'none' ? form.existing_payment_option : 'custom') : 'none'),
                payment_method: payNowAmount > 0 ? form.payment_method : (alreadyPaidAmount > 0 ? form.existing_payment_method : null),
                payment_notes: form.payment_notes || null,
                payment_status: resolvedPaymentAmount >= grandTotal && grandTotal > 0 ? 'paid' : 'unpaid',
                // Posted by the server to the Front Desk Card / Online Payment
                // Account, or kept in Front Desk cash.
                new_payment_amount: Math.round(payNowAmount * 100) / 100,
                // Full bill in LKR, used by Front Desk settlement.
                bill_total_lkr: Math.round(grandTotal * 100) / 100,
                new_payment_method: form.payment_method,
                ...(editingId ? { id: editingId } : {}),
            };
            const res = await fetch('/api/chalet/bookings', {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            if (data.payment_error) {
                toast({ title: 'Payment not recorded', description: `The booking was saved, but the payment was not recorded: ${data.payment_error}`, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: editingId ? 'Booking updated' : 'Booking created' });
            }
            window.dispatchEvent(new Event('notifications-changed'));
            setDialogOpen(false);
            fetchAll();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const openAssign = (b: ChaletBooking) => {
        setAssigningBooking(b);
        setAssignRoomIds(bookingRoomSlots(b).map(slot => slot.roomId || ''));
        setAssignDialogOpen(true);
    };

    const handleAssignRoom = async () => {
        if (!assigningBooking) return;
        const slots = bookingRoomSlots(assigningBooking);
        const selectedIds = assignRoomIds.filter(Boolean);
        if (selectedIds.length !== slots.length) {
            toast({ title: 'Room required', description: 'Please assign a room for each requested room.', variant: 'destructive' });
            return;
        }
        if (new Set(selectedIds).size !== selectedIds.length) {
            toast({ title: 'Duplicate room', description: 'Each requested room must use a different chalet.', variant: 'destructive' });
            return;
        }
        for (const [index, roomId] of selectedIds.entries()) {
            const selectedRoom = rooms.find(room => room.id === roomId);
            const slot = slots[index];
            const availability = selectedRoom
                ? getRoomDateAvailability(selectedRoom, assigningBooking.check_in_date, assigningBooking.check_out_date, assigningBooking.id)
                : { available: false, label: 'not available' };
            if (!availability.available) {
                toast({ title: 'Room unavailable', description: 'Please choose available chalet rooms for this booking date range.', variant: 'destructive' });
                return;
            }
            if (slot.roomCategoryId && selectedRoom?.category_id !== slot.roomCategoryId) {
                toast({ title: 'Room type mismatch', description: 'Please choose a chalet from the requested room category.', variant: 'destructive' });
                return;
            }
        }
        setAssigning(true);
        try {
            const roomAllocations = slots.map((slot, index) => ({
                roomId: selectedIds[index],
                roomCategoryId: slot.roomCategoryId,
                packageId: slot.packageId,
                adults: slot.adults,
                children: slot.children,
            }));
            const res = await fetch('/api/chalet/bookings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: assigningBooking.id,
                    room_id: selectedIds[0] || null,
                    room_ids: selectedIds,
                    room_allocations: roomAllocations,
                    room_packages: Object.fromEntries(roomAllocations.map(allocation => [allocation.roomId, allocation.packageId])),
                    room_guests: Object.fromEntries(roomAllocations.map(allocation => [allocation.roomId, { adults: allocation.adults, children: allocation.children }])),
                    assign_only: true,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast({ title: 'Success', description: 'Room assigned' });
            setAssignDialogOpen(false);
            fetchAll();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally {
            setAssigning(false);
        }
    };

    const confirmDelete = (id: string) => {
        const booking = bookings.find(b => b.id === id);
        if (!booking || booking.status === 'checked_in' || booking.status === 'checked_out') return;
        setDeleteId(id);
        setDeleteDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/chalet/bookings?id=${deleteId}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete');
            }
            toast({ title: 'Deleted', description: 'Booking removed' });
            window.dispatchEvent(new Event('notifications-changed'));
            setDeleteDialogOpen(false);
            fetchAll();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally {
            setDeleting(false);
        }
    };

    const stats = {
        total: bookings.length,
        pending: bookings.filter(b => b.status === 'pending').length,
        confirmed: bookings.filter(b => b.status === 'confirmed').length,
        checked_in: bookings.filter(b => b.status === 'checked_in').length,
    };

    // Meal flags + custom facilities on a package, flattened into one
    // checklist of { key, name } entries the front desk can mark used.
    const packageFacilities = (pkg?: ChaletPackage): { key: string; name: string }[] => {
        if (!pkg) return [];
        const list: { key: string; name: string }[] = [];
        if (pkg.includes_breakfast) list.push({ key: 'breakfast', name: 'Breakfast' });
        if (pkg.includes_lunch) list.push({ key: 'lunch', name: 'Lunch' });
        if (pkg.includes_dinner) list.push({ key: 'dinner', name: 'Dinner' });
        (pkg.facilities || []).forEach(f => list.push({ key: f.id, name: f.name }));
        return list;
    };

    // One entry per night of the stay (checkout day itself isn't a night).
    const stayDates = (checkIn: string, checkOut: string): string[] => {
        const dates: string[] = [];
        const cur = new Date(checkIn);
        const end = new Date(checkOut);
        while (cur < end) {
            dates.push(cur.toISOString().slice(0, 10));
            cur.setDate(cur.getDate() + 1);
        }
        return dates;
    };

    const checkedInGuests = bookings
        .filter(b => b.status === 'checked_in')
        .filter(b => {
            const q = checkedInSearch.trim().toLowerCase();
            if (q && !b.customer_name?.toLowerCase().includes(q)) return false;
            if (checkedInDate && !(b.check_in_date <= checkedInDate && checkedInDate <= b.check_out_date)) return false;
            return true;
        });
    const allBookingsPagination = usePagination(bookings, 20);
    const checkedInPagination = usePagination(checkedInGuests, 20);

    // Bill in the booking currency, from the prices and charges locked on the booking.
    const bookingBillTotal = (booking: ChaletBooking) => chaletBillLines(booking).total;

    const bookingUsdToLkrRate = (booking: ChaletBooking) => {
        // The rate locked on the booking when it was made.
        const lockedRate = Number((booking as ChaletBooking & { usd_to_lkr_rate?: number | null }).usd_to_lkr_rate || 0);
        if (lockedRate > 0) return lockedRate;
        const roomCategoryId = booking.room_category_id || booking.room_allocations?.[0]?.roomCategoryId || (booking.room_allocations?.[0] as any)?.room_category_id || '';
        const packageId = booking.package_id || booking.room_allocations?.[0]?.packageId || (booking.room_allocations?.[0] as any)?.package_id || '';
        const matchingRate = rates.find(rate =>
            rate.package_id === packageId &&
            !rate.occupancy_type_id &&
            (rate.room_category_id || '') === (roomCategoryId || '')
        ) || rates.find(rate =>
            rate.package_id === packageId &&
            !rate.occupancy_type_id &&
            !rate.room_category_id
        );
        return Number(matchingRate?.usd_to_lkr_rate || 0);
    };

    const bookingBillTotalInLkr = (booking: ChaletBooking) => {
        const total = bookingBillTotal(booking);
        if ((booking.currency || customerBillCurrency(booking.nationality)) !== 'USD') return total;
        const exchangeRate = bookingUsdToLkrRate(booking);
        return exchangeRate > 0 ? total * exchangeRate : total;
    };

    const renderBookingBillAmount = (booking: ChaletBooking) => {
        const total = bookingBillTotal(booking);
        const currency = booking.currency || customerBillCurrency(booking.nationality);
        const exchangeRate = bookingUsdToLkrRate(booking);
        if (currency !== 'USD') {
            return <span>LKR {formatCurrency(total)}</span>;
        }

        const lkrTotal = exchangeRate > 0 ? total * exchangeRate : total;
        return (
            <div className="space-y-0.5">
                <div>USD {formatCurrency(total)}</div>
                <div className="text-xs text-muted-foreground">LKR {formatCurrency(lkrTotal)}</div>
            </div>
        );
    };

    // Amount already paid on the booking (booking form payments or a website
    // payment), shown in LKR and also in USD for foreign guests.
    const renderBookingPaidAmount = (booking: ChaletBooking) => {
        const paidLkr = chaletPaidLkr(booking, rates);
        if (paidLkr <= 0) return <span className="text-muted-foreground">—</span>;
        const currency = booking.currency || customerBillCurrency(booking.nationality);
        const exchangeRate = bookingUsdToLkrRate(booking);
        if (currency !== 'USD' || exchangeRate <= 0) return <span className="text-green-700">LKR {formatCurrency(paidLkr)}</span>;
        return (
            <div className="space-y-0.5 text-green-700">
                <div>USD {formatCurrency(paidLkr / exchangeRate)}</div>
                <div className="text-xs text-muted-foreground">LKR {formatCurrency(paidLkr)}</div>
            </div>
        );
    };

    const bookingRoomIds = (booking: ChaletBooking) => {
        if (booking.room_ids?.length) return booking.room_ids;
        const allocationIds = Array.isArray(booking.room_allocations)
            ? booking.room_allocations
                .map(allocation => allocationValue(allocation as Record<string, any>, 'roomId', 'room_id'))
                .filter(Boolean)
            : [];
        return allocationIds.length ? allocationIds : booking.room_id ? [booking.room_id] : [];
    };

    const bookingRoomSlots = (booking: ChaletBooking) => {
        if (Array.isArray(booking.room_allocations) && booking.room_allocations.length > 0) {
            return booking.room_allocations.map((allocation, index) => ({
                key: `${booking.id}-allocation-${index}`,
                roomCategoryId: allocation.roomCategoryId || (allocation as any).room_category_id || booking.room_category_id || '',
                packageId: allocation.packageId || (allocation as any).package_id || booking.package_id || '',
                roomId: allocation.roomId || (allocation as any).room_id || bookingRoomIds(booking)[index] || '',
                adults: Number(allocation.adults ?? (index === 0 ? booking.adults : 1) ?? 1),
                children: Number(allocation.children ?? (index === 0 ? booking.children : 0) ?? 0),
            }));
        }

        const ids = bookingRoomIds(booking);
        const roomCount = Math.max(1, ids.length);
        return Array.from({ length: roomCount }, (_, index) => {
            const room = ids[index] ? rooms.find(item => item.id === ids[index]) : undefined;
            return {
                key: `${booking.id}-room-${index}`,
                roomCategoryId: room?.category_id || booking.room_category_id || '',
                packageId: booking.room_packages?.[ids[index]] || booking.package_id || '',
                roomId: ids[index] || '',
                adults: index === 0 ? booking.adults ?? 1 : 1,
                children: index === 0 ? booking.children ?? 0 : 0,
            };
        });
    };

    const bookingRoomLabel = (booking: ChaletBooking) => {
        const ids = bookingRoomIds(booking);
        if (ids.length === 0) return '';
        const labels = ids.map(id => {
            const room = rooms.find(item => item.id === id);
            if (room) return `Chalet ${room.room_number}`;
            if (booking.room_id === id && booking.chalet_rooms?.room_number) return `Chalet ${booking.chalet_rooms.room_number}`;
            return 'Chalet';
        });
        return labels.join(', ');
    };

    const openActivities = async (booking: ChaletBooking) => {
        setActivityBooking(booking);
        setActivityDialogOpen(true);
        setIsLoadingActivity(true);
        try {
            const res = await fetch(`/api/chalet/facility-usage?booking_id=${booking.id}`);
            const data = await res.json();
            const usage: { facility_key: string; usage_date: string }[] = data.usage || [];
            setActivityUsage(new Set(usage.map(u => `${u.usage_date}|${u.facility_key}`)));
        } catch (e: any) {
            toast({ title: 'Error', description: 'Failed to load activity history', variant: 'destructive' });
        } finally {
            setIsLoadingActivity(false);
        }
    };

    const toggleActivity = async (date: string, facilityKey: string, facilityName: string) => {
        if (!activityBooking) return;
        const mapKey = `${date}|${facilityKey}`;
        setTogglingActivityKey(mapKey);
        const wasUsed = activityUsage.has(mapKey);

        // Optimistic toggle
        setActivityUsage(prev => {
            const next = new Set(prev);
            if (wasUsed) next.delete(mapKey); else next.add(mapKey);
            return next;
        });

        try {
            const res = await fetch('/api/chalet/facility-usage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    booking_id: activityBooking.id,
                    facility_key: facilityKey,
                    facility_name: facilityName,
                    usage_date: date,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
        } catch (e: any) {
            // Revert on failure
            setActivityUsage(prev => {
                const next = new Set(prev);
                if (wasUsed) next.add(mapKey); else next.delete(mapKey);
                return next;
            });
            toast({ title: 'Error', description: e.message || 'Failed to update activity', variant: 'destructive' });
        } finally {
            setTogglingActivityKey(null);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Chalet Bookings</h1>
                    <p className="text-muted-foreground">Manage all chalet reservations</p>
                </div>
                <Button onClick={openNew}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Booking
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Bookings</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold">{stats.total}</p>}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Pending</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><CheckCircle className="h-3 w-3" />Confirmed</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold text-blue-600">{stats.confirmed}</p>}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><LogIn className="h-3 w-3" />Checked In</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold text-yellow-600">{stats.checked_in}</p>}
                    </CardContent>
                </Card>
            </div>

            {/* Bookings / Checked-In Guests */}
            <Tabs defaultValue="all">
                <TabsList>
                    <TabsTrigger value="all">All Bookings</TabsTrigger>
                    <TabsTrigger value="checked-in">Checked-In Guests</TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="mt-4">
                    <Card>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Booking Ref</TableHead>
                                            <TableHead>Customer</TableHead>
                                            <TableHead>Room</TableHead>
                                            <TableHead>Package</TableHead>
                                            <TableHead>Room Type</TableHead>
                                            <TableHead>Check In</TableHead>
                                            <TableHead>Check Out</TableHead>
                                            <TableHead className="text-center">Nights</TableHead>
                                            <TableHead className="text-right">Grand Total</TableHead>
                                            <TableHead className="text-right">Already Paid</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            Array.from({ length: 5 }).map((_, i) => (
                                                <TableRow key={i}>
                                                    {Array.from({ length: 11 }).map((_, j) => (
                                                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                                                    ))}
                                                </TableRow>
                                            ))
                                        ) : bookings.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                                                    No bookings yet. Create your first booking.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            allBookingsPagination.paginatedItems.map(b => (
                                                <TableRow key={b.id}>
                                                    <TableCell className="font-mono text-xs font-medium">{b.booking_ref}</TableCell>
                                                    <TableCell>
                                                        <div className="font-medium">{b.customer_name}</div>
                                                        {b.customer_phone && <div className="text-xs text-muted-foreground">{b.customer_phone}</div>}
                                                    </TableCell>
                                                    <TableCell>
                                                        {bookingRoomIds(b).length > 0 ? (
                                                            <span className="font-medium">{bookingRoomLabel(b)}</span>
                                                        ) : (
                                                            <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">Unassigned</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-sm">{b.chalet_packages?.name || '—'}</TableCell>
                                                    <TableCell className="text-sm">{b.chalet_room_categories?.name || '—'}</TableCell>
                                                    <TableCell className="text-sm">{b.check_in_date}</TableCell>
                                                    <TableCell className="text-sm">{b.check_out_date}</TableCell>
                                                    <TableCell className="text-center">{b.nights}</TableCell>
                                                    <TableCell className="text-right font-medium">{renderBookingBillAmount(b)}</TableCell>
                                                    <TableCell className="text-right font-medium">{renderBookingPaidAmount(b)}</TableCell>
                                                    <TableCell>
                                                        <Badge className={`text-xs border ${statusColors[b.status]}`} variant="outline">
                                                            {statusLabels[b.status]}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button size="sm" variant="outline" onClick={() => openAssign(b)} title={bookingRoomIds(b).length > 0 ? 'Update Room Assignment' : 'Assign Room'}>
                                                                <BedDouble className="h-3 w-3" />
                                                            </Button>
                                                            <Button size="sm" variant="outline" onClick={() => openEdit(b)}>
                                                                <Pencil className="h-3 w-3" />
                                                            </Button>
                                                            {b.status !== 'checked_in' && b.status !== 'checked_out' && (
                                                            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => confirmDelete(b.id)}>
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            {!loading && bookings.length > 0 && (
                                <DataTablePagination
                                    currentPage={allBookingsPagination.currentPage}
                                    totalPages={allBookingsPagination.totalPages}
                                    totalItems={allBookingsPagination.totalItems}
                                    itemsPerPage={allBookingsPagination.itemsPerPage}
                                    onPageChange={allBookingsPagination.setCurrentPage}
                                />
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="checked-in" className="mt-4 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by customer name..."
                                value={checkedInSearch}
                                onChange={e => setCheckedInSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Label className="text-sm text-muted-foreground whitespace-nowrap">Filter date</Label>
                            <Input
                                type="date"
                                className="w-44"
                                value={checkedInDate}
                                onChange={e => setCheckedInDate(e.target.value)}
                            />
                            {checkedInDate && (
                                <Button type="button" variant="outline" size="sm" onClick={() => setCheckedInDate('')}>
                                    Clear
                                </Button>
                            )}
                        </div>
                    </div>
                    <Card>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Customer</TableHead>
                                            <TableHead>Room</TableHead>
                                            <TableHead>Package</TableHead>
                                            <TableHead>Check In</TableHead>
                                            <TableHead>Check Out</TableHead>
                                            <TableHead className="text-right">Bill</TableHead>
                                            <TableHead className="text-right">Already Paid</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            Array.from({ length: 3 }).map((_, i) => (
                                                <TableRow key={i}>
                                                    {Array.from({ length: 7 }).map((_, j) => (
                                                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                                                    ))}
                                                </TableRow>
                                            ))
                                        ) : checkedInGuests.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                                    No checked-in guests match your filters.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            checkedInPagination.paginatedItems.map(b => (
                                                <TableRow key={b.id}>
                                                    <TableCell>
                                                        <div className="font-medium">{b.customer_name}</div>
                                                        {b.customer_phone && <div className="text-xs text-muted-foreground">{b.customer_phone}</div>}
                                                    </TableCell>
                                                    <TableCell>
                                                        {bookingRoomIds(b).length > 0 ? (
                                                            <span className="font-medium">{bookingRoomLabel(b)}</span>
                                                        ) : (
                                                            <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">Unassigned</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-sm">{b.chalet_packages?.name || '—'}</TableCell>
                                                    <TableCell className="text-sm">{b.check_in_date}</TableCell>
                                                    <TableCell className="text-sm">{b.check_out_date}</TableCell>
                                                    <TableCell className="text-right font-medium">{renderBookingBillAmount(b)}</TableCell>
                                                    <TableCell className="text-right font-medium">{renderBookingPaidAmount(b)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button size="sm" variant="outline" onClick={() => openActivities(b)}>
                                                            <ClipboardList className="mr-1.5 h-3 w-3" />
                                                            Activities
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            {!loading && checkedInGuests.length > 0 && (
                                <DataTablePagination
                                    currentPage={checkedInPagination.currentPage}
                                    totalPages={checkedInPagination.totalPages}
                                    totalItems={checkedInPagination.totalItems}
                                    itemsPerPage={checkedInPagination.itemsPerPage}
                                    onPageChange={checkedInPagination.setCurrentPage}
                                />
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

            </Tabs>

            {/* Booking Form Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Edit Chalet Booking' : 'New Chalet Booking'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-5 py-2">
                        <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                                {wizardSteps.map((step, index) => {
                                    const Icon = step.icon;
                                    const active = wizardStep === index;
                                    const done = wizardStep > index;
                                    return (
                                        <button
                                            key={step.label}
                                            type="button"
                                            onClick={() => setWizardStep(index)}
                                            className={`flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium ${active ? 'border-primary bg-primary text-primary-foreground' : done ? 'border-green-200 bg-green-50 text-green-700' : 'bg-background text-muted-foreground'}`}
                                        >
                                            <Icon className="h-4 w-4" />
                                            {step.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <Progress value={stepProgress} className="h-2" />
                        </div>

                        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                            <div className="min-h-[430px] space-y-4">
                                {wizardStep === 0 && (
                                    <div className="space-y-4">
                                        <div className="rounded-lg border p-4">
                                            <h3 className="font-semibold">Guest Details</h3>
                                            <div className="mt-4 space-y-4">
                                                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                                    <div className="md:col-span-1 space-y-1">
                                                        <Label>Customer Name *</Label>
                                                        <Input value={form.customer_name} onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))} placeholder="Full name" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label>Email</Label>
                                                        <Input type="email" value={form.customer_email} onChange={e => setForm(p => ({ ...p, customer_email: e.target.value }))} placeholder="email@example.com" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label>Phone</Label>
                                                        <Input value={form.customer_phone} onChange={e => setForm(p => ({ ...p, customer_phone: e.target.value }))} placeholder="+94 77 000 0000" />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1">
                                                        <Label>NIC / Passport</Label>
                                                        <Input value={form.customer_nic} onChange={e => setForm(p => ({ ...p, customer_nic: e.target.value }))} placeholder="NIC or passport number" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label>Nationality</Label>
                                                        <Select value={form.nationality || undefined} onValueChange={value => setForm(p => ({
                                                            ...p,
                                                            nationality: value,
                                                            currency: customerBillCurrency(value),
                                                        }))}>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select nationality" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="Sri Lankan">Sri Lankan</SelectItem>
                                                                <SelectItem value="Non Sri Lankan">Non Sri Lankan</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label>Special Requests</Label>
                                                    <Textarea value={form.special_requests} onChange={e => setForm(p => ({ ...p, special_requests: e.target.value }))} placeholder="Any special requests from the guest..." rows={3} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label>Internal Notes</Label>
                                                    <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Internal notes..." rows={3} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {wizardStep === 1 && (
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <Label>Stay Dates *</Label>
                                            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen} modal>
                                                <PopoverTrigger asChild>
                                                    <div className="grid cursor-pointer gap-4 md:grid-cols-2" role="button" tabIndex={0}>
                                                        <div className="space-y-1">
                                                            <Label htmlFor="check-in-date" className="text-xs text-muted-foreground">Check In</Label>
                                                            <div className="relative">
                                                                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                                <Input
                                                                    id="check-in-date"
                                                                    readOnly
                                                                    value={form.check_in_date ? checkInDisplay : ''}
                                                                    placeholder="Select check-in"
                                                                    className="cursor-pointer pl-9"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label htmlFor="check-out-date" className="text-xs text-muted-foreground">Check Out</Label>
                                                            <div className="relative">
                                                                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                                <Input
                                                                    id="check-out-date"
                                                                    readOnly
                                                                    value={form.check_out_date ? checkOutDisplay : ''}
                                                                    placeholder="Select check-out"
                                                                    className="cursor-pointer pl-9"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar
                                                        mode="range"
                                                        selected={selectedDateRange}
                                                        onSelect={handleSaveDateRange}
                                                        {...({
                                                            onDayMouseDown: handleDateDragStart,
                                                            onDayMouseEnter: handleDateDragMove,
                                                            onDayMouseUp: handleDateDragEnd,
                                                        } as any)}
                                                        numberOfMonths={2}
                                                        pagedNavigation
                                                        initialFocus
                                                        className="select-none"
                                                        classNames={{
                                                            day_today: '',
                                                        }}
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            {form.check_in_date && form.check_out_date && (
                                                <p className="text-xs text-muted-foreground">
                                                    Check-in {form.check_in_date} · Check-out {form.check_out_date}
                                                </p>
                                            )}
                                        </div>

                                        {guestLimitErrors.length > 0 && (
                                            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                                {guestLimitErrors[0]}
                                            </div>
                                        )}

                                        <div className="space-y-3 rounded-lg border p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <h3 className="font-semibold">Rooms</h3>
                                                    <p className="text-sm text-muted-foreground">Add one row per chalet. Each row can use a different room type, package, and guest count.</p>
                                                    {websitePaymentOption && (
                                                        <p className="mt-1 text-xs text-blue-900"><span className="font-semibold">Payment option (all rooms):</span> {websitePaymentOption}</p>
                                                    )}
                                                </div>
                                                <Button type="button" size="sm" onClick={addRoomSelection}>
                                                    <Plus className="mr-2 h-4 w-4" />
                                                    Add Room
                                                </Button>
                                            </div>
                                            {roomSelections.length === 0 ? (
                                                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                                                    Add a room to choose its room type, package, available chalet, and guest count.
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {roomSelections.map((selection, index) => {
                                                        const availableRooms = availableRoomsForSelection(selection);
                                                        const selectedRoomForRow = rooms.find(room => room.id === selection.room_id);
                                                        const selectedRoomCategoryForRow = selectedRoomForRow ? roomCategories.find(category => category.id === selectedRoomForRow.category_id) : roomCategories.find(category => category.id === selection.room_category_id);
                                                        const limits = selectedRoomForRow ? getRoomGuestLimits(selectedRoomForRow) : {
                                                            maxAdults: selectedRoomCategoryForRow?.max_adults ?? 99,
                                                            maxChildren: selectedRoomCategoryForRow?.max_children ?? 99,
                                                            maxGuests: selectedRoomCategoryForRow?.max_guests ?? 99,
                                                        };
                                                        return (
                                                            <div key={selection.id} className="rounded-lg border bg-background p-3">
                                                                <div className="mb-3 flex items-center justify-between gap-3">
                                                                    <p className="font-medium">Room {index + 1}</p>
                                                                    <Button type="button" variant="outline" size="sm" onClick={() => removeRoomSelection(selection.id)}>
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                                <div className="grid gap-3 md:grid-cols-2">
                                                                    <div className="space-y-1">
                                                                        <Label>Room Type</Label>
                                                                        <Select
                                                                            value={selection.room_category_id || undefined}
                                                                            onValueChange={value => updateRoomSelection(selection.id, { room_category_id: value, room_id: '' })}
                                                                        >
                                                                            <SelectTrigger><SelectValue placeholder="Select room type" /></SelectTrigger>
                                                                            <SelectContent>
                                                                                {roomCategories.map(category => (
                                                                                    <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <Label>Package</Label>
                                                                        <Select value={selection.package_id || undefined} onValueChange={value => updateRoomSelection(selection.id, { package_id: value })}>
                                                                            <SelectTrigger><SelectValue placeholder="Select package" /></SelectTrigger>
                                                                            <SelectContent>
                                                                                {packages.map(pkg => (
                                                                                    <SelectItem key={pkg.id} value={pkg.id}>{pkg.name}</SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    <div className="space-y-1 md:col-span-2">
                                                                        <Label>Available Room</Label>
                                                                        <Select value={selection.room_id || undefined} onValueChange={value => {
                                                                            const room = rooms.find(item => item.id === value);
                                                                            // Keep the guest's entered adults/children; guest limits
                                                                            // for the chosen chalet are checked separately.
                                                                            updateRoomSelection(selection.id, { room_id: value, room_category_id: room?.category_id || selection.room_category_id });
                                                                        }}>
                                                                            <SelectTrigger><SelectValue placeholder="Select available room" /></SelectTrigger>
                                                                            <SelectContent>
                                                                                {availableRooms.map(({ room, availability }) => (
                                                                                    <SelectItem key={room.id} value={room.id} disabled={!availability.available}>
                                                                                        Chalet {room.room_number} - {room.name} ({availability.label})
                                                                                    </SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <Label>Adults</Label>
                                                                        <Input
                                                                            type="number"
                                                                            min={1}
                                                                            max={limits.maxAdults}
                                                                            value={selection.adults}
                                                                            onChange={e => {
                                                                                const room = selectedRoomForRow;
                                                                                if (room) updateRoomSelection(selection.id, clampRoomGuests(room, parseInt(e.target.value) || 1, selection.children));
                                                                                else updateRoomSelection(selection.id, { adults: Math.max(1, parseInt(e.target.value) || 1) });
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <Label>Children</Label>
                                                                        <Input
                                                                            type="number"
                                                                            min={0}
                                                                            max={limits.maxChildren}
                                                                            value={selection.children}
                                                                            onChange={e => {
                                                                                const room = selectedRoomForRow;
                                                                                if (room) updateRoomSelection(selection.id, clampRoomGuests(room, selection.adults, parseInt(e.target.value) || 0));
                                                                                else updateRoomSelection(selection.id, { children: Math.max(0, parseInt(e.target.value) || 0) });
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    {(() => {
                                                                        // Child ages / bedding the guest entered on the website
                                                                        // (kept in the booking's special requests).
                                                                        const guestDetails = roomTextDetailsAt(roomTextDetails, index);
                                                                        if (!guestDetails || (!guestDetails.childAges && !guestDetails.bedding && !guestDetails.arrivalTime)) return null;
                                                                        return (
                                                                            <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-900 md:col-span-2">
                                                                                {guestDetails.childAges && <span><span className="font-semibold">Child ages:</span> {guestDetails.childAges}</span>}
                                                                                {guestDetails.bedding && <span><span className="font-semibold">Bedding:</span> {guestDetails.bedding}</span>}
                                                                                {guestDetails.arrivalTime && <span><span className="font-semibold">Arrival:</span> {guestDetails.arrivalTime}</span>}
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                    <p className="text-xs text-muted-foreground md:col-span-2">
                                                                        {selection.room_id ? `Max ${limits.maxAdults} adult(s), ${limits.maxChildren} child(ren), ${limits.maxGuests} total guest(s).` : 'Select a room to apply its guest limits.'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                    </div>
                                )}

                                {wizardStep === 2 && (
                                    <div className="space-y-4">
                                        <div className="rounded-lg border p-4">
                                            <h3 className="font-semibold">Booking Summary</h3>
                                            <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                                                <div><p className="text-muted-foreground">Guest</p><p className="font-medium">{form.customer_name || '—'}</p></div>
                                                <div><p className="text-muted-foreground">Stay</p><p className="font-medium">{form.check_in_date || '—'} → {form.check_out_date || '—'}</p></div>
                                                <div><p className="text-muted-foreground">Chalet</p><p className="font-medium">{selectedRooms.length > 0 ? selectedRooms.map(room => `Chalet ${room.room_number}`).join(', ') : '—'}</p></div>
                                                <div><p className="text-muted-foreground">Room Categories</p><p className="font-medium">{selectedRoomRateRows.length > 0 ? selectedRoomRateRows.map(row => `${row.room.room_number}: ${row.categoryName}`).join(', ') : selectedRoomCategory?.name || '—'}</p></div>
                                                <div><p className="text-muted-foreground">Guests</p><p className="font-medium">{selectedRooms.length > 0 ? selectedRooms.map(room => {
                                                    const guests = getRoomGuests(room.id);
                                                    return `${room.room_number}: ${guests.adults} adult(s), ${guests.children} child(ren)`;
                                                }).join(', ') : `${roomGuestTotals.adults} adult(s), ${roomGuestTotals.children} child(ren)`}</p></div>
                                                <div><p className="text-muted-foreground">Packages</p><p className="font-medium">{selectedRoomRateRows.length > 0 ? selectedRoomRateRows.map(row => `${row.room.room_number}: ${row.packageName}`).join(', ') : '—'}</p></div>
                                            </div>
                                        </div>
                                        <div className="rounded-lg border p-4">
                                            <h3 className="font-semibold">Coupon</h3>
                                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                                                <div className="space-y-1">
                                                    <Label>Apply Coupon</Label>
                                                    <Select value={form.coupon_id || '__none__'} onValueChange={value => {
                                                        const coupon = coupons.find(item => item.id === value);
                                                        setForm(p => ({
                                                            ...p,
                                                            coupon_id: value === '__none__' ? '' : value,
                                                            coupon_code_input: value === '__none__' ? '' : coupon?.code || p.coupon_code_input,
                                                        }));
                                                    }}>
                                                        <SelectTrigger><SelectValue placeholder="Select coupon" /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="__none__">No coupon</SelectItem>
                                                            {activeCoupons.map(coupon => (
                                                                <SelectItem
                                                                    key={coupon.id}
                                                                    value={coupon.id}
                                                                    disabled={!couponWithinBillLimits(coupon)}
                                                                >
                                                                    {coupon.code} - {coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `LKR ${formatCurrency(Number(coupon.discount_value || 0))}`}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <Input
                                                        className="mt-2"
                                                        value={form.coupon_code_input}
                                                        onChange={e => {
                                                            const code = e.target.value.toUpperCase();
                                                            const coupon = activeCoupons.find(item => item.code.toUpperCase() === code.trim());
                                                            setForm(p => ({ ...p, coupon_code_input: code, coupon_id: coupon?.id || '' }));
                                                        }}
                                                        placeholder="Or type coupon code"
                                                    />
                                                    {activeCoupons.length === 0 && (
                                                        <p className="text-xs text-muted-foreground">No active coupons available.</p>
                                                    )}
                                                    {typedCouponCode && !typedCoupon && !form.coupon_id && (
                                                        <p className="text-xs text-destructive">Coupon code not found.</p>
                                                    )}
                                                    {selectedCoupon && !couponEligible && (
                                                        <p className="text-xs text-destructive">Coupon cannot be applied to this booking total.</p>
                                                    )}
                                                </div>
                                                <div className="rounded-md bg-muted/40 p-3 text-sm">
                                                    <p className="text-muted-foreground">Applied Discount</p>
                                                    <p className="mt-1 font-semibold">{selectedCoupon && couponDiscountAmount > 0 ? `-${formatBillAmount(couponDiscountAmount, billCurrency, billUsdToLkrRate)}` : formatBillAmount(0, billCurrency, billUsdToLkrRate)}</p>
                                                    {selectedCoupon && (
                                                        <p className="mt-1 text-xs text-muted-foreground">
                                                            {selectedCoupon.code} on subtotal {formatBillAmount(subtotal, billCurrency, billUsdToLkrRate)}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="rounded-lg border p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <h3 className="font-semibold">Payment</h3>
                                                {editingId && (
                                                    <Button type="button" variant="outline" size="sm" onClick={openPaymentHistory}>
                                                        <History className="mr-1 h-4 w-4" />
                                                        Payment History
                                                    </Button>
                                                )}
                                            </div>
                                            {alreadyPaidAmount > 0 && (
                                                <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                                                    <p className="font-semibold">Already Paid: {formatBillAmount(alreadyPaidAmount, billCurrency, billUsdToLkrRate)}{form.existing_payment_method ? ` · ${form.existing_payment_method.replace('_', ' ')}` : ''}</p>
                                                    <p className="text-xs">This payment is kept as is. Use the options below only to record an additional payment.</p>
                                                </div>
                                            )}
                                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                                                <div className="space-y-1">
                                                    <Label>{alreadyPaidAmount > 0 ? 'Additional Payment' : 'Payment Amount'}</Label>
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        max={balanceBeforePaymentInput}
                                                        step={0.01}
                                                        placeholder="0.00"
                                                        disabled={balanceBeforePayment <= 0}
                                                        value={form.payment_amount}
                                                        onChange={e => {
                                                            const value = e.target.value;
                                                            setForm(p => ({ ...p, payment_amount: Number(value) > balanceBeforePaymentInput ? String(balanceBeforePaymentInput) : value }));
                                                        }}
                                                    />
                                                    <p className="text-xs text-muted-foreground">
                                                        {balanceBeforePayment > 0
                                                            ? `Enter amount in ${paymentInputCurrency}. Balance: ${paymentInputCurrency} ${formatCurrency(balanceBeforePaymentInput)}`
                                                            : 'Booking is fully paid.'}
                                                    </p>
                                                </div>
                                                {payNowAmount > 0 && (
                                                    <div className="space-y-1">
                                                        <Label>Payment Method</Label>
                                                        <Select value={form.payment_method} onValueChange={value => setForm(p => ({ ...p, payment_method: value as 'cash' | 'card' | 'online' }))}>
                                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="cash">Cash</SelectItem>
                                                                <SelectItem value="card">Card</SelectItem>
                                                                <SelectItem value="online">Online</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}
                                                <div className="space-y-1">
                                                    <Label>Payment Notes</Label>
                                                    <Input value={form.payment_notes} onChange={e => setForm(p => ({ ...p, payment_notes: e.target.value }))} placeholder="Reference or notes" />
                                                </div>
                                            </div>
                                            <div className={`mt-4 grid gap-3 text-sm ${alreadyPaidAmount > 0 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
                                                {alreadyPaidAmount > 0 && (
                                                    <div><p className="text-muted-foreground">Already Paid</p><p className="font-semibold">{formatBillAmount(alreadyPaidAmount, billCurrency, billUsdToLkrRate)}</p></div>
                                                )}
                                                <div><p className="text-muted-foreground">Paid Now</p><p className="font-semibold">{formatBillAmount(payNowAmount, billCurrency, billUsdToLkrRate)}</p></div>
                                                <div><p className="text-muted-foreground">Balance</p><p className="font-semibold">{formatBillAmount(paymentBalance, billCurrency, billUsdToLkrRate)}</p></div>
                                                <div><p className="text-muted-foreground">Payment Status</p><p className="font-semibold">{paymentBalance <= 0 && grandTotal > 0 ? 'Paid' : resolvedPaymentAmount > 0 ? 'Partially Paid' : 'Unpaid'}</p></div>
                                            </div>
                                        </div>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="space-y-1">
                                                <Label>Status</Label>
                                                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as ChaletBookingStatus }))}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {(Object.keys(statusLabels) as ChaletBookingStatus[]).map(s => (
                                                            <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-lg border bg-muted/20 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h3 className="font-semibold">Price Breakdown</h3>
                                    {pricesLocked && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setForm(p => ({ ...p, locked_room_rates: {}, locked_coupon: null, locked_usd_to_lkr_rate: 0 }))}
                                        >
                                            Update to current rates
                                        </Button>
                                    )}
                                </div>
                                {pricesLocked && (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Prices are locked as booked{lockedUsdRate > 0 && billCurrency === 'USD' ? ` (1 USD = LKR ${formatCurrency(lockedUsdRate)})` : ''}.
                                        {anyRoomRepriced ? ' Rooms you changed use current rates.' : ' Changing a room\'s type or package reprices that room.'}
                                    </p>
                                )}
                                {!form.nationality ? (
                                    <p className="mt-4 text-sm text-muted-foreground">Select guest nationality to view the relevant currency, rates, and charges.</p>
                                ) : (
                                    <div className="mt-4 space-y-3 text-sm">
                                        <div className="flex justify-between"><span className="text-muted-foreground">Rooms</span><span className="font-medium">{breakdownRateRows.length || selectedRoomIds.length || '—'}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">Nights</span><span className="font-medium">{nights}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">Customer Currency</span><span className="font-medium">{billCurrency}</span></div>
                                        {breakdownRateRows.length > 0 ? (
                                            breakdownRateRows.map(row => (
                                                <div key={row.key} className="flex justify-between gap-3">
                                                    <span className="text-muted-foreground">
                                                        {row.roomLabel} · {row.categoryName} · {row.packageName}
                                                        {pricesLocked && !row.locked && <Badge variant="outline" className="ml-2 text-[10px]">current rate</Badge>}
                                                    </span>
                                                    <span className="font-medium">{formatBillAmount(row.rate, billCurrency, row.usdToLkrRate || billUsdToLkrRate)}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex justify-between"><span className="text-muted-foreground">Package</span><span className="font-medium text-right">—</span></div>
                                        )}
                                        <div className="flex justify-between"><span className="text-muted-foreground">Total / Night</span><span className="font-medium">{formatBillAmount(selectedRoomNightlyTotal, billCurrency, billUsdToLkrRate)}</span></div>
                                        <div className="border-t pt-3 flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{formatBillAmount(subtotal, billCurrency, billUsdToLkrRate)}</span></div>
                                        {selectedCoupon && couponDiscountAmount > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Coupon ({selectedCoupon.code})</span>
                                                <span className="font-medium">-{formatBillAmount(couponDiscountAmount, billCurrency, billUsdToLkrRate)}</span>
                                            </div>
                                        )}
                                        {appliedChargeRows.map(charge => (
                                            <div key={charge.label} className="flex justify-between">
                                                <span className="text-muted-foreground">{charge.label} ({charge.pct}% · {appliesLabel(charge.appliesTo)})</span>
                                                <span className="font-medium">{formatBillAmount(charge.amount, billCurrency, billUsdToLkrRate)}</span>
                                            </div>
                                        ))}
                                        <div className="border-t pt-3 flex justify-between text-lg font-bold"><span>Grand Total</span><span>{formatBillAmount(grandTotal, billCurrency, billUsdToLkrRate)}</span></div>
                                        {billCurrency === 'USD' && (
                                            <p className="text-right text-xs text-muted-foreground">System total: LKR {formatCurrency(grandTotal)}</p>
                                        )}
                                        {resolvedPaymentAmount > 0 && (
                                            <>
                                                {alreadyPaidAmount > 0 && (
                                                    <div className="flex justify-between text-green-700">
                                                        <span>Already Paid{form.existing_payment_method ? ` (${form.existing_payment_method.replace('_', ' ')})` : ''}</span>
                                                        <span className="font-medium">-{formatBillAmount(alreadyPaidAmount, billCurrency, billUsdToLkrRate)}</span>
                                                    </div>
                                                )}
                                                {payNowAmount > 0 && (
                                                    <div className="flex justify-between text-green-700">
                                                        <span>{alreadyPaidAmount > 0 ? 'Paid Now' : 'Amount Paid'} ({form.payment_method.replace('_', ' ')})</span>
                                                        <span className="font-medium">-{formatBillAmount(payNowAmount, billCurrency, billUsdToLkrRate)}</span>
                                                    </div>
                                                )}
                                                <div className="border-t pt-3 flex justify-between text-base font-bold">
                                                    <span>{paymentBalance > 0 ? 'Balance Due' : 'Fully Paid'}</span>
                                                    <span className={paymentBalance > 0 ? 'text-amber-600' : 'text-green-700'}>{formatBillAmount(paymentBalance, billCurrency, billUsdToLkrRate)}</span>
                                                </div>
                                                {billCurrency === 'USD' && paymentBalance > 0 && (
                                                    <p className="text-right text-xs text-muted-foreground">Balance in system: LKR {formatCurrency(paymentBalance)}</p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:justify-between">
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                            <Button variant="outline" disabled={wizardStep === 0} onClick={() => setWizardStep(step => Math.max(0, step - 1))}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Button>
                        </div>
                        {wizardStep < wizardSteps.length - 1 ? (
                            <Button onClick={goNextStep}>
                                Continue
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        ) : (
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : editingId ? 'Update Booking' : 'Create Booking'}
                        </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Assign Room Dialog */}
            <Dialog open={paymentHistoryOpen} onOpenChange={setPaymentHistoryOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Payment History</DialogTitle>
                    </DialogHeader>
                    {paymentHistoryLoading || !paymentHistory ? (
                        <div className="space-y-2 py-2">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid gap-3 text-sm sm:grid-cols-3">
                                <div className="rounded-md border p-3"><p className="text-muted-foreground">Bill Total</p><p className="font-semibold">{formatBillAmount(paymentHistory.total_lkr, billCurrency, billUsdToLkrRate)}</p></div>
                                <div className="rounded-md border p-3"><p className="text-muted-foreground">Paid</p><p className="font-semibold text-green-700">{formatBillAmount(paymentHistory.paid_lkr, billCurrency, billUsdToLkrRate)}</p></div>
                                <div className="rounded-md border p-3"><p className="text-muted-foreground">Balance</p><p className={`font-semibold ${paymentHistory.balance_lkr > 0 ? 'text-amber-600' : 'text-green-700'}`}>{formatBillAmount(paymentHistory.balance_lkr, billCurrency, billUsdToLkrRate)}</p></div>
                            </div>
                            <div className="overflow-x-auto rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Method</TableHead>
                                            <TableHead>Received Into</TableHead>
                                            <TableHead>Recorded By</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paymentHistory.payments.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No payments yet.</TableCell>
                                            </TableRow>
                                        ) : paymentHistory.payments.map(payment => (
                                            <TableRow key={payment.id}>
                                                <TableCell>
                                                    {payment.paid_at ? format(new Date(payment.paid_at), 'dd MMM yyyy HH:mm') : '—'}
                                                    {payment.label !== 'Booking payment' && <div className="text-xs text-muted-foreground">{payment.label}</div>}
                                                </TableCell>
                                                <TableCell className="capitalize">{payment.payment_method ? payment.payment_method.replace('_', ' ') : '—'}</TableCell>
                                                <TableCell>{payment.account_name || (payment.payment_method === 'cash' && payment.label === 'Booking payment' ? 'Front Desk cash' : '—')}</TableCell>
                                                <TableCell>{payment.recorded_by || '—'}</TableCell>
                                                <TableCell className="text-right font-medium text-green-700">{formatBillAmount(payment.amount, billCurrency, billUsdToLkrRate)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <p className="text-xs text-muted-foreground">Shows saved payments only. A payment entered in the form is added after you save the booking.</p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPaymentHistoryOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Assign Chalet Room</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {assigningBooking && (
                            <div className="bg-muted rounded-lg p-3 text-sm">
                                <p className="font-medium">{assigningBooking.customer_name}</p>
                                <p className="text-muted-foreground">{assigningBooking.booking_ref} · {assigningBooking.check_in_date} → {assigningBooking.check_out_date}</p>
                            </div>
                        )}
                        {assigningBooking ? (
                            <div className="space-y-3">
                                {bookingRoomSlots(assigningBooking).map((slot, index) => {
                                    const selectedInOtherRows = new Set(assignRoomIds.filter((_, roomIndex) => roomIndex !== index).filter(Boolean));
                                    const category = roomCategories.find(item => item.id === slot.roomCategoryId);
                                    const pkg = packages.find(item => item.id === slot.packageId);
                                    const availableRooms = rooms
                                        .filter(room => !slot.roomCategoryId || room.category_id === slot.roomCategoryId)
                                        .map(room => ({
                                            room,
                                            availability: selectedInOtherRows.has(room.id)
                                                ? { available: false, label: 'Already selected in this booking' }
                                                : getRoomDateAvailability(room, assigningBooking.check_in_date, assigningBooking.check_out_date, assigningBooking.id),
                                        }));
                                    return (
                                        <div key={slot.key} className="rounded-lg border p-3">
                                            <div className="mb-2 flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold">Requested Room {index + 1}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {category?.name || 'Requested room category'} · {pkg?.name || 'Package'} · {slot.adults} adult{slot.adults === 1 ? '' : 's'} · {slot.children} child{slot.children === 1 ? '' : 'ren'}
                                                    </p>
                                                </div>
                                                <Badge variant="outline">{availableRooms.filter(item => item.availability.available).length} available</Badge>
                                            </div>
                                            <Select
                                                value={assignRoomIds[index] || undefined}
                                                onValueChange={value => setAssignRoomIds(previous => {
                                                    const next = [...previous];
                                                    next[index] = value;
                                                    return next;
                                                })}
                                            >
                                                <SelectTrigger><SelectValue placeholder="Choose a chalet" /></SelectTrigger>
                                                <SelectContent>
                                                    {availableRooms.map(({ room, availability }) => (
                                                        <SelectItem key={room.id} value={room.id} disabled={!availability.available}>
                                                            Chalet {room.room_number} — {room.name}
                                                            <span className={`ml-2 text-xs ${availability.available ? 'text-green-600' : 'text-red-600'}`}>
                                                                ({availability.label})
                                                            </span>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : null}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleAssignRoom} disabled={assigning}>
                            {assigning ? 'Assigning...' : 'Assign Room'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirm Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertCircle className="h-5 w-5" />
                            Delete Booking
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">Are you sure you want to delete this booking? This action cannot be undone.</p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                            {deleting ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Facility Activities Dialog */}
            <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Package Activities</DialogTitle>
                    </DialogHeader>
                    {activityBooking && (() => {
                        const pkg = packages.find(p => p.id === activityBooking.package_id);
                        const facilities = packageFacilities(pkg);
                        const dates = stayDates(activityBooking.check_in_date, activityBooking.check_out_date);

                        return (
                            <div className="space-y-4">
                                <div className="bg-muted rounded-lg p-3 text-sm">
                                    <p className="font-medium">{activityBooking.customer_name}</p>
                                    <p className="text-muted-foreground">
                                        {activityBooking.booking_ref} · {pkg?.name || 'No package assigned'} · {activityBooking.check_in_date} → {activityBooking.check_out_date}
                                    </p>
                                </div>

                                {!pkg ? (
                                    <p className="text-sm text-muted-foreground italic">No package is assigned to this booking, so there are no facilities to track.</p>
                                ) : facilities.length === 0 ? (
                                    <p className="text-sm text-muted-foreground italic">This package has no meals or facilities configured. Add some under Chalet &gt; Rates &amp; Packages.</p>
                                ) : isLoadingActivity ? (
                                    <div className="space-y-2">
                                        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Day</TableHead>
                                                    {facilities.map(f => (
                                                        <TableHead key={f.key} className="text-center">{f.name}</TableHead>
                                                    ))}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {dates.map((date, idx) => (
                                                    <TableRow key={date}>
                                                        <TableCell className="text-sm font-medium whitespace-nowrap">
                                                            Day {idx + 1}
                                                            <div className="text-xs text-muted-foreground font-normal">{date}</div>
                                                        </TableCell>
                                                        {facilities.map(f => {
                                                            const mapKey = `${date}|${f.key}`;
                                                            return (
                                                                <TableCell key={f.key} className="text-center">
                                                                    <Checkbox
                                                                        checked={activityUsage.has(mapKey)}
                                                                        disabled={togglingActivityKey === mapKey}
                                                                        onCheckedChange={() => toggleActivity(date, f.key, f.name)}
                                                                    />
                                                                </TableCell>
                                                            );
                                                        })}
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>
        </div>
    );
}
