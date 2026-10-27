'use client';

import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import type { ChaletBooking, ChaletRate } from '@/lib/types';
import {
    chaletBillBreakdown,
    chaletBillLines,
    chaletBillCurrency,
    chaletBillLinesForDisplay,
    chaletExchangeRate,
    chaletOutstandingLkr,
    chaletPaidLkr,
    chaletTotalLkr,
} from '@/lib/chalet-billing';
import { formatClock } from '@/lib/chalet-stay';
import { BookOpen, Loader2, Pencil, Receipt, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

// Guest / Reservation / Account panels for one chalet booking (its own page,
// opened from a booking tile on the calendar). Shows only what the booking
// and the guest's customer record already hold.

export type BookingRoomLine = {
    roomLabel: string;
    categoryName: string;
    packageName: string;
    bedding?: string;
    adults: number;
    children: number;
};

type Props = {
    booking: ChaletBooking;
    rooms: BookingRoomLine[];
    rates: ChaletRate[];
    stayTimes: { check_in: string; check_out: string };
    statusLabel: string;
    statusClassName: string;
    // Balance of each Reservation Account tab (LKR); clicking one opens the
    // account at that tab.
    accountBalances?: { key: string; label: string; balance: number }[];
    accountLoading?: boolean;
    onOpenAccount?: (tab: string) => void;
    // Called after the guest details are edited and saved.
    onGuestSaved?: () => void;
};

type Customer = { id: string; name?: string; phone?: string; email?: string; id_number?: string; address?: string; created_at?: string };

const money = (currency: 'LKR' | 'USD', value: number) =>
    `${currency} ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateOnly = (value?: string | null) => (value ? format(parseISO(`${value.slice(0, 10)}T00:00:00`), 'EEE, d MMM yyyy') : '');
const dateTime = (value?: string | null) => (value ? format(new Date(value), 'd MMM yyyy, h:mm a') : '');
const titleCase = (value?: string | null) => (value ? value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()) : '');

export function BookingDetailsView({ booking, rooms, rates, stayTimes, statusLabel, statusClassName, accountBalances = [], accountLoading = false, onOpenAccount, onGuestSaved }: Props) {
    const { toast } = useToast();
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [guestForm, setGuestForm] = useState<{ name: string; email: string; phone: string; nic: string; address: string; specialRequests: string } | null>(null);
    const [savingGuest, setSavingGuest] = useState(false);
    const [resForm, setResForm] = useState<{ checkIn: string; checkOut: string; adults: number; children: number; status: string; notes: string } | null>(null);
    const [savingRes, setSavingRes] = useState(false);
    // What can be changed depends on where the stay is.
    const resStatus = booking.status;
    const canEditCheckIn = resStatus === 'pending' || resStatus === 'confirmed';
    const canEditCheckOut = canEditCheckIn || resStatus === 'checked_in';
    const canEditGuests = canEditCheckOut && rooms.length <= 1;
    const canEditStatus = resStatus === 'pending' || resStatus === 'confirmed' || resStatus === 'cancelled';

    const openReservationEditor = () => setResForm({
        checkIn: booking.check_in_date.slice(0, 10),
        checkOut: booking.check_out_date.slice(0, 10),
        adults: rooms[0]?.adults ?? booking.adults ?? 1,
        children: rooms[0]?.children ?? booking.children ?? 0,
        status: booking.status,
        notes: booking.notes || '',
    });

    // Bill at the new dates, at the booking's locked nightly rate.
    const nightsBetween = (checkIn: string, checkOut: string) => Math.round((new Date(`${checkOut}T00:00:00`).getTime() - new Date(`${checkIn}T00:00:00`).getTime()) / 86400000);
    const repricedTotalLkr = (checkIn: string, checkOut: string) => {
        const nights = nightsBetween(checkIn, checkOut);
        const oldLines = chaletBillLines(booking);
        const moved = { ...booking, check_in_date: checkIn, check_out_date: checkOut, nights, total_nights: nights, subtotal: Number(booking.rate_per_night || 0) * nights };
        const newLines = chaletBillLines(moved);
        const savedLkr = Number((booking as any).bill_total_lkr || 0);
        // Keep the booking's own LKR scale when its total was saved.
        if (savedLkr > 0 && oldLines.total > 0) return Math.round(newLines.total * (savedLkr / oldLines.total) * 100) / 100;
        return chaletTotalLkr(moved, rates);
    };

    const saveReservation = async () => {
        if (!resForm) return;
        const nights = nightsBetween(resForm.checkIn, resForm.checkOut);
        if (!(nights > 0)) {
            toast({ title: 'Check-out must be after check-in', variant: 'destructive' });
            return;
        }
        if (resForm.adults < 1 || resForm.children < 0) {
            toast({ title: 'At least 1 adult is needed', variant: 'destructive' });
            return;
        }
        const datesChanged = resForm.checkIn !== booking.check_in_date.slice(0, 10) || resForm.checkOut !== booking.check_out_date.slice(0, 10);
        const nightsChanged = nights !== (booking.total_nights || booking.nights || nightsBetween(booking.check_in_date.slice(0, 10), booking.check_out_date.slice(0, 10)));
        const guestsChanged = resForm.adults !== (rooms[0]?.adults ?? booking.adults) || resForm.children !== (rooms[0]?.children ?? booking.children);
        const body: Record<string, unknown> = { id: booking.id, notes: resForm.notes.trim() || null };
        if (datesChanged) {
            body.check_in_date = resForm.checkIn;
            body.check_out_date = resForm.checkOut;
        }
        if (nightsChanged) {
            const newTotal = repricedTotalLkr(resForm.checkIn, resForm.checkOut);
            if ((booking as any).bill_total_lkr) body.bill_total_lkr = newTotal;
            // A paid booking that now costs more has a balance to collect.
            if (booking.payment_status === 'paid' && newTotal > paidLkr + 0.01) body.payment_status = 'unpaid';
        }
        if (guestsChanged && canEditGuests) {
            body.adults = resForm.adults;
            body.children = resForm.children;
            body.guest_count = resForm.adults + resForm.children;
            const roomId = booking.room_ids?.[0] || booking.room_id;
            if (roomId) body.room_guests = { [roomId]: { adults: resForm.adults, children: resForm.children } };
            if (Array.isArray(booking.room_allocations) && booking.room_allocations.length === 1) {
                body.room_allocations = [{ ...booking.room_allocations[0], adults: resForm.adults, children: resForm.children }];
            }
        }
        if (canEditStatus && resForm.status !== booking.status) body.status = resForm.status;
        setSavingRes(true);
        try {
            const res = await fetch('/api/chalet/bookings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not save the reservation');
            toast({ title: 'Reservation saved' });
            setResForm(null);
            onGuestSaved?.();
        } catch (error: any) {
            toast({ title: 'Not saved', description: error.message, variant: 'destructive' });
        } finally {
            setSavingRes(false);
        }
    };

    const openGuestEditor = () => setGuestForm({
        name: booking.customer_name || '',
        email: booking.customer_email || '',
        phone: booking.customer_phone || '',
        nic: booking.customer_nic || customer?.id_number || '',
        address: customer?.address || '',
        specialRequests: booking.special_requests || '',
    });

    // Saves the guest details on the booking (which also updates the guest's
    // customer record), then the address on that customer record.
    const saveGuest = async () => {
        if (!guestForm) return;
        if (!guestForm.name.trim()) {
            toast({ title: 'Guest name is required', variant: 'destructive' });
            return;
        }
        setSavingGuest(true);
        try {
            const res = await fetch('/api/chalet/bookings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: booking.id,
                    customer_name: guestForm.name.trim(),
                    customer_email: guestForm.email.trim() || null,
                    customer_phone: guestForm.phone.trim() || null,
                    customer_nic: guestForm.nic.trim() || null,
                    special_requests: guestForm.specialRequests.trim() || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not save the guest details');
            if (customer && guestForm.address.trim() !== (customer.address || '')) {
                const customerRes = await fetch('/api/admin/customers', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: customer.id,
                        name: guestForm.name.trim(),
                        phone: guestForm.phone.trim() || null,
                        email: guestForm.email.trim() || null,
                        id_number: guestForm.nic.trim() || null,
                        address: guestForm.address.trim() || null,
                    }),
                });
                const customerData = await customerRes.json();
                if (!customerRes.ok) throw new Error(customerData.error || 'Saved the booking, but not the address');
            }
            toast({ title: 'Guest details saved' });
            setGuestForm(null);
            onGuestSaved?.();
        } catch (error: any) {
            toast({ title: 'Not saved', description: error.message, variant: 'destructive' });
        } finally {
            setSavingGuest(false);
        }
    };

    // The guest's customer record (address, ID) when one exists.
    useEffect(() => {
        setCustomer(null);
        const term = (booking.customer_nic || booking.customer_phone || booking.customer_name || '').trim();
        if (!term) return;
        let cancelled = false;
        fetch(`/api/admin/customers?search=${encodeURIComponent(term)}`)
            .then(response => response.json())
            .then(data => {
                if (cancelled) return;
                const list: Customer[] = data.customers || [];
                const nic = booking.customer_nic?.trim().toLowerCase();
                const name = booking.customer_name?.trim().toLowerCase();
                setCustomer(
                    list.find(item => nic && item.id_number?.trim().toLowerCase() === nic)
                    || list.find(item => name && item.name?.trim().toLowerCase() === name)
                    || null,
                );
            })
            .catch(() => undefined);
        return () => { cancelled = true; };
    }, [booking]);

    const currency = chaletBillCurrency(booking);
    const exchangeRate = chaletExchangeRate(booking, rates);
    const lines = chaletBillLinesForDisplay(booking, rates);
    const breakdown = chaletBillBreakdown(booking, rates);
    const totalLkr = chaletTotalLkr(booking, rates);
    const paidLkr = chaletPaidLkr(booking, rates);
    const balanceLkr = chaletOutstandingLkr(booking, rates);
    // Booking-currency amount, with LKR alongside for USD bills.
    const amount = (bookingCurrencyValue: number, lkrValue?: number) => (
        currency === 'USD' && exchangeRate > 0
            ? `${money('USD', bookingCurrencyValue)} (${money('LKR', lkrValue ?? bookingCurrencyValue * exchangeRate)})`
            : money('LKR', lkrValue ?? bookingCurrencyValue)
    );
    const toBookingCurrency = (lkr: number) => (currency === 'USD' && exchangeRate > 0 ? lkr / exchangeRate : lkr);
    // Placeholders such as "Bedding not set" are left out (shown as a dash).
    const unique = (values: string[]) => Array.from(new Set(values.filter(value => value && !/not set$/i.test(value)))).join(', ');
    const adults = rooms.length ? rooms.reduce((sum, room) => sum + room.adults, 0) : booking.adults;
    const children = rooms.length ? rooms.reduce((sum, room) => sum + room.children, 0) : booking.children;
    const nights = lines.nights || booking.total_nights || booking.nights;

    return (
        <div className="grid grid-cols-1 content-start gap-4 lg:grid-cols-3">
                    <Panel
                        title="Guest"
                        actions={onGuestSaved ? (
                            <IconButton title="Edit guest details" onClick={openGuestEditor}><Pencil className="h-4 w-4" /></IconButton>
                        ) : undefined}
                    >
                        <Row label="Guest Name" value={booking.customer_name} highlight />
                        <Row label="Email" value={booking.customer_email} />
                        <Row label="Mobile" value={booking.customer_phone} />
                        <Row label="NIC / Passport" value={booking.customer_nic || customer?.id_number} />
                        <Row label="Nationality" value={booking.nationality} />
                        <Row label="Address" value={customer?.address} />
                        <Row label="Customer Since" value={customer?.created_at ? dateOnly(customer.created_at) : ''} />
                        <Row label="Special Requests" value={booking.special_requests} multiline />
                    </Panel>

                    <Panel
                        title="Reservation"
                        actions={onGuestSaved ? (
                            <IconButton title="Edit reservation" onClick={openReservationEditor}><Pencil className="h-4 w-4" /></IconButton>
                        ) : undefined}
                    >
                        <Row label="Res No" value={booking.booking_ref} highlight />
                        <Row label="Status" value={statusLabel} valueClassName={statusClassName} />
                        <Row label="Arrive" value={`${dateOnly(booking.check_in_date)} · ${formatClock(stayTimes.check_in)}`} />
                        <Row label="Depart" value={`${dateOnly(booking.check_out_date)} · ${formatClock(stayTimes.check_out)}`} />
                        <Row label="Nights" value={String(nights || '')} />
                        <Row label="Guests" value={`${adults} adult${adults === 1 ? '' : 's'}${children ? `, ${children} child${children === 1 ? '' : 'ren'}` : ''}`} />
                        <Row label="Room Type" value={unique(rooms.map(room => room.categoryName)) || booking.chalet_room_categories?.name} highlight />
                        <Row label="Room" value={unique(rooms.map(room => room.roomLabel)) || 'Unassigned'} highlight />
                        <Row label="Package" value={unique(rooms.map(room => room.packageName)) || booking.chalet_packages?.name} />
                        <Row label="Bed Config" value={unique(rooms.map(room => room.bedding || ''))} />
                        <Row label="Occupancy" value={booking.chalet_occupancy_types?.name} />
                        {rooms.length > 1 && (
                            <Row
                                label="Rooms Detail"
                                multiline
                                value={rooms.map(room => `${room.roomLabel}: ${room.categoryName} · ${room.packageName} · ${room.adults}A${room.children ? ` ${room.children}C` : ''}`).join('\n')}
                            />
                        )}
                        <Row label="Notes" value={booking.notes} multiline />
                        <Row label="Booked On" value={dateTime(booking.created_at)} />
                        <Row label="Last Updated" value={dateTime(booking.updated_at)} />
                    </Panel>

                    <Panel
                        title="Account"
                        actions={onOpenAccount ? (
                            <>
                                <IconButton title="Reservation account (all charges and payments)" onClick={() => onOpenAccount('all')}><BookOpen className="h-4 w-4" /></IconButton>
                                <IconButton title="Accommodation account" onClick={() => onOpenAccount('accommodation')}><Receipt className="h-4 w-4" /></IconButton>
                                <IconButton title="Restaurant account" onClick={() => onOpenAccount('restaurant')}><UtensilsCrossed className="h-4 w-4" /></IconButton>
                            </>
                        ) : undefined}
                    >
                        <Row label="Bill Currency" value={currency} />
                        {currency === 'USD' && <Row label="Exchange Rate" value={exchangeRate > 0 ? `1 USD = LKR ${exchangeRate.toFixed(2)}` : 'Not set'} />}
                        <Row label="Rate / Night" value={lines.ratePerNight > 0 ? amount(lines.ratePerNight, breakdown?.rate_per_night) : ''} highlight />
                        <Row label="Room Charges" value={lines.subtotal > 0 ? `${amount(lines.subtotal, breakdown?.subtotal)}${nights ? ` · ${nights} night${nights === 1 ? '' : 's'}` : ''}` : ''} />
                        {lines.couponDiscount > 0 && (
                            <Row label="Coupon" value={`${booking.coupon_code || 'Discount'} − ${amount(lines.couponDiscount, breakdown?.coupon_discount)}`} />
                        )}
                        {lines.charges.map((charge, index) => (
                            <Row key={charge.label} label={`${charge.label} (${charge.pct}%)`} value={amount(charge.amount, breakdown?.charges[index]?.amount)} />
                        ))}
                        <Row label="Total" value={amount(toBookingCurrency(totalLkr), totalLkr)} highlight strong />
                        <Row label="Paid" value={amount(toBookingCurrency(paidLkr), paidLkr)} />
                        <Row
                            label="Balance"
                            value={amount(toBookingCurrency(balanceLkr), balanceLkr)}
                            valueClassName={balanceLkr > 0 ? 'bg-red-50 text-red-700 font-semibold' : 'bg-green-50 text-green-700 font-semibold'}
                        />
                        <Row label="Payment Status" value={balanceLkr > 0 ? (paidLkr > 0 ? 'Part paid' : 'Unpaid') : 'Paid'} />
                        <Row label="Payment Method" value={titleCase(booking.payment_method)} />
                        <Row label="Payment Notes" value={booking.payment_notes} multiline />
                        {onOpenAccount && (
                            <>
                                {accountBalances.map(item => (
                                    <LinkRow
                                        key={item.key}
                                        label={item.label}
                                        value={accountLoading ? '…' : money('LKR', item.balance)}
                                        onClick={() => onOpenAccount(item.key)}
                                    />
                                ))}
                                <LinkRow
                                    label="Account Balance"
                                    value={accountLoading ? '…' : money('LKR', accountBalances.reduce((sum, item) => sum + item.balance, 0))}
                                    onClick={() => onOpenAccount('all')}
                                    strong
                                />
                            </>
                        )}
                    </Panel>

            <Dialog open={!!resForm} onOpenChange={open => { if (!open && !savingRes) setResForm(null); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit reservation</DialogTitle>
                        <DialogDescription>{booking.booking_ref} · {statusLabel}</DialogDescription>
                    </DialogHeader>
                    {resForm && (() => {
                        const nights = nightsBetween(resForm.checkIn, resForm.checkOut);
                        const oldNights = nightsBetween(booking.check_in_date.slice(0, 10), booking.check_out_date.slice(0, 10));
                        const newTotal = nights > 0 && nights !== oldNights ? repricedTotalLkr(resForm.checkIn, resForm.checkOut) : null;
                        return (
                            <div className="grid gap-3">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="res-in">Check-in ({formatClock(stayTimes.check_in)})</Label>
                                        <Input id="res-in" type="date" value={resForm.checkIn} disabled={!canEditCheckIn} onChange={event => setResForm({ ...resForm, checkIn: event.target.value })} />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="res-out">Check-out ({formatClock(stayTimes.check_out)})</Label>
                                        <Input id="res-out" type="date" value={resForm.checkOut} min={resForm.checkIn} disabled={!canEditCheckOut} onChange={event => setResForm({ ...resForm, checkOut: event.target.value })} />
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {nights > 0 ? `${nights} night${nights === 1 ? '' : 's'}` : 'Check-out must be after check-in'}
                                    {newTotal !== null && ` · bill changes from ${money('LKR', totalLkr)} to ${money('LKR', newTotal)} (locked rate × nights)`}
                                </p>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="res-adults">Adults</Label>
                                        <Input id="res-adults" type="number" min={1} value={resForm.adults} disabled={!canEditGuests} onChange={event => setResForm({ ...resForm, adults: Math.max(0, Number(event.target.value) || 0) })} />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="res-children">Children</Label>
                                        <Input id="res-children" type="number" min={0} value={resForm.children} disabled={!canEditGuests} onChange={event => setResForm({ ...resForm, children: Math.max(0, Number(event.target.value) || 0) })} />
                                    </div>
                                </div>
                                {rooms.length > 1 && <p className="text-xs text-muted-foreground">This booking has several chalets: change guests per chalet on the Bookings page.</p>}
                                <div className="grid gap-1.5">
                                    <Label htmlFor="res-status">Status</Label>
                                    <select
                                        id="res-status"
                                        value={resForm.status}
                                        disabled={!canEditStatus}
                                        onChange={event => setResForm({ ...resForm, status: event.target.value })}
                                        className="h-10 rounded-md border bg-background px-3 text-sm disabled:opacity-60"
                                    >
                                        {canEditStatus ? (
                                            <>
                                                <option value="pending">Pending</option>
                                                <option value="confirmed">Confirmed</option>
                                                <option value="cancelled">Cancelled</option>
                                            </>
                                        ) : (
                                            <option value={resForm.status}>{statusLabel} (check-in / check-out at the Front Desk)</option>
                                        )}
                                    </select>
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="res-notes">Notes</Label>
                                    <Textarea id="res-notes" rows={3} value={resForm.notes} onChange={event => setResForm({ ...resForm, notes: event.target.value })} />
                                </div>
                                <p className="text-xs text-muted-foreground">To change the chalet, drag the booking on the calendar. Package and room type are changed on the Bookings page.</p>
                            </div>
                        );
                    })()}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setResForm(null)} disabled={savingRes}>Cancel</Button>
                        <Button onClick={() => void saveReservation()} disabled={savingRes}>
                            {savingRes && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!guestForm} onOpenChange={open => { if (!open && !savingGuest) setGuestForm(null); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit guest details</DialogTitle>
                        <DialogDescription>{booking.booking_ref} · changes are saved on this booking and the guest&apos;s customer record.</DialogDescription>
                    </DialogHeader>
                    {guestForm && (
                        <div className="grid gap-3">
                            <div className="grid gap-1.5">
                                <Label htmlFor="guest-name">Guest name *</Label>
                                <Input id="guest-name" value={guestForm.name} onChange={event => setGuestForm({ ...guestForm, name: event.target.value })} />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="grid gap-1.5">
                                    <Label htmlFor="guest-email">Email</Label>
                                    <Input id="guest-email" type="email" value={guestForm.email} onChange={event => setGuestForm({ ...guestForm, email: event.target.value })} />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="guest-phone">Mobile</Label>
                                    <Input id="guest-phone" value={guestForm.phone} onChange={event => setGuestForm({ ...guestForm, phone: event.target.value })} />
                                </div>
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="guest-nic">NIC / Passport</Label>
                                <Input id="guest-nic" value={guestForm.nic} onChange={event => setGuestForm({ ...guestForm, nic: event.target.value })} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="guest-address">Address</Label>
                                <Input
                                    id="guest-address"
                                    value={guestForm.address}
                                    disabled={!customer}
                                    placeholder={customer ? '' : 'Saved once the guest has a customer record (add an NIC / Passport and save first)'}
                                    onChange={event => setGuestForm({ ...guestForm, address: event.target.value })}
                                />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="guest-requests">Special requests</Label>
                                <Textarea id="guest-requests" rows={3} value={guestForm.specialRequests} onChange={event => setGuestForm({ ...guestForm, specialRequests: event.target.value })} />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Nationality ({booking.nationality || 'not set'}) can&apos;t be changed here: it sets the bill currency, and the price is locked on the booking.
                            </p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setGuestForm(null)} disabled={savingGuest}>Cancel</Button>
                        <Button onClick={() => void saveGuest()} disabled={savingGuest}>
                            {savingGuest && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function Panel({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className="overflow-hidden rounded-lg border bg-background">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
                <h3 className="text-lg font-semibold">{title}</h3>
                {actions && <div className="flex items-center gap-1">{actions}</div>}
            </div>
            <div className="divide-y">{children}</div>
        </section>
    );
}

function Row({ label, value, highlight = false, strong = false, multiline = false, valueClassName = '' }: {
    label: string;
    value?: string | null;
    highlight?: boolean;
    strong?: boolean;
    multiline?: boolean;
    valueClassName?: string;
}) {
    return (
        <div className="grid grid-cols-[130px_minmax(0,1fr)] text-sm">
            <div className="px-4 py-2 text-muted-foreground">{label}</div>
            <div
                className={`px-3 py-2 ${multiline ? 'whitespace-pre-line break-words' : 'truncate'} ${highlight ? 'bg-amber-50' : ''} ${strong ? 'font-semibold' : ''} ${valueClassName}`}
                title={multiline ? undefined : value || undefined}
            >
                {value || <span className="text-muted-foreground/60">—</span>}
            </div>
        </div>
    );
}

function IconButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
    return (
        <button type="button" title={title} aria-label={title} onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
            {children}
        </button>
    );
}

// An account balance that opens the Reservation Account at that tab.
function LinkRow({ label, value, onClick, strong = false }: { label: string; value: string; onClick: () => void; strong?: boolean }) {
    return (
        <div className="grid grid-cols-[130px_minmax(0,1fr)] text-sm">
            <button type="button" onClick={onClick} className="px-4 py-2 text-left underline underline-offset-2 hover:text-primary">{label}</button>
            <button type="button" onClick={onClick} className={`bg-amber-50 px-3 py-2 text-left tabular-nums hover:bg-amber-100 ${strong ? 'font-semibold' : ''}`}>{value}</button>
        </div>
    );
}
