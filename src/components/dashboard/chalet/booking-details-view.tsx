'use client';

import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import type { ChaletBooking, ChaletRate } from '@/lib/types';
import {
    chaletBillBreakdown,
    chaletBillCurrency,
    chaletBillLinesForDisplay,
    chaletExchangeRate,
    chaletOutstandingLkr,
    chaletPaidLkr,
    chaletTotalLkr,
} from '@/lib/chalet-billing';
import { formatClock } from '@/lib/chalet-stay';
import { BookOpen, Receipt, UtensilsCrossed } from 'lucide-react';

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
};

type Customer = { id: string; name?: string; phone?: string; email?: string; id_number?: string; address?: string; created_at?: string };

const money = (currency: 'LKR' | 'USD', value: number) =>
    `${currency} ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateOnly = (value?: string | null) => (value ? format(parseISO(`${value.slice(0, 10)}T00:00:00`), 'EEE, d MMM yyyy') : '');
const dateTime = (value?: string | null) => (value ? format(new Date(value), 'd MMM yyyy, h:mm a') : '');
const titleCase = (value?: string | null) => (value ? value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()) : '');

export function BookingDetailsView({ booking, rooms, rates, stayTimes, statusLabel, statusClassName, accountBalances = [], accountLoading = false, onOpenAccount }: Props) {
    const [customer, setCustomer] = useState<Customer | null>(null);

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
                    <Panel title="Guest">
                        <Row label="Guest Name" value={booking.customer_name} highlight />
                        <Row label="Email" value={booking.customer_email} />
                        <Row label="Mobile" value={booking.customer_phone} />
                        <Row label="NIC / Passport" value={booking.customer_nic || customer?.id_number} />
                        <Row label="Nationality" value={booking.nationality} />
                        <Row label="Address" value={customer?.address} />
                        <Row label="Customer Since" value={customer?.created_at ? dateOnly(customer.created_at) : ''} />
                        <Row label="Special Requests" value={booking.special_requests} multiline />
                    </Panel>

                    <Panel title="Reservation">
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
