'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isSameDay,
    isSameMonth,
    isWithinInterval,
    parseISO,
    startOfMonth,
    startOfWeek,
    subMonths,
} from 'date-fns';
import { ArrowLeft, ArrowRight, BedDouble, CalendarDays, Eye, Loader2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { ChaletBooking, ChaletBookingStatus, ChaletPackage, ChaletRate, ChaletRoom, ChaletRoomCategory } from '@/lib/types';
import { parseRoomTextDetails } from '@/lib/chalet-room-details';
import { chaletTotalLkr } from '@/lib/chalet-billing';

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

function formatCurrency(amount: number) {
    return amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseDate(value: string) {
    return parseISO(`${value}T00:00:00`);
}

function bookingRoomIds(booking: ChaletBooking) {
    return booking.room_ids?.length ? booking.room_ids : booking.room_id ? [booking.room_id] : [];
}

// Full bill in LKR from the prices locked on the booking (same as Bookings
// and Front Desk). The database's grand_total columns are not used.
function bookingTotal(booking: ChaletBooking, rates: ChaletRate[]) {
    return chaletTotalLkr(booking, rates);
}

function bookingOverlapsDate(booking: ChaletBooking, date: Date) {
    const checkIn = parseDate(booking.check_in_date);
    const checkOut = parseDate(booking.check_out_date);
    return isWithinInterval(date, { start: checkIn, end: checkOut }) && !isSameDay(date, checkOut);
}

export default function ChaletBookingCalendarPage() {
    const { toast } = useToast();
    const [bookings, setBookings] = useState<ChaletBooking[]>([]);
    const [rooms, setRooms] = useState<ChaletRoom[]>([]);
    const [packages, setPackages] = useState<ChaletPackage[]>([]);
    const [roomCategories, setRoomCategories] = useState<ChaletRoomCategory[]>([]);
    const [rates, setRates] = useState<ChaletRate[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(() => new Date());
    const [selectedDate, setSelectedDate] = useState(() => new Date());
    const [statusFilter, setStatusFilter] = useState<'active' | ChaletBookingStatus | 'all'>('active');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [bookingsRes, roomsRes, packagesRes, categoriesRes] = await Promise.all([
                fetch('/api/chalet/bookings'),
                fetch('/api/chalet/rooms'),
                fetch('/api/chalet/packages'),
                fetch('/api/chalet/room-categories'),
            ]);
            const [bookingsData, roomsData, packagesData, categoriesData] = await Promise.all([
                bookingsRes.json(),
                roomsRes.json(),
                packagesRes.json(),
                categoriesRes.json(),
            ]);
            if (!bookingsRes.ok) throw new Error(bookingsData.error || 'Failed to load bookings');
            if (!roomsRes.ok) throw new Error(roomsData.error || 'Failed to load rooms');
            if (!packagesRes.ok) throw new Error(packagesData.error || 'Failed to load packages');
            if (!categoriesRes.ok) throw new Error(categoriesData.error || 'Failed to load room categories');
            setBookings(bookingsData.bookings || []);
            setRooms(roomsData.rooms || []);
            setPackages(packagesData.packages || []);
            setRoomCategories(categoriesData.categories || []);
            // Rates are only a fallback for bookings without a locked exchange rate.
            fetch('/api/chalet/rates')
                .then(response => response.json())
                .then(data => setRates(data.rates || []))
                .catch(() => setRates([]));
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to load calendar data', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const visibleBookings = useMemo(() => {
        return bookings.filter(booking => {
            if (statusFilter === 'all') return true;
            if (statusFilter === 'active') return booking.status !== 'cancelled' && booking.status !== 'checked_out';
            return booking.status === statusFilter;
        });
    }, [bookings, statusFilter]);

    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        return eachDayOfInterval({
            start: startOfWeek(monthStart),
            end: endOfWeek(monthEnd),
        });
    }, [currentMonth]);

    const bookingsForDate = useCallback((date: Date) => {
        return visibleBookings.filter(booking => bookingOverlapsDate(booking, date));
    }, [visibleBookings]);

    const selectedBookings = bookingsForDate(selectedDate);
    const selectedRoomCount = selectedBookings.reduce((total, booking) => total + Math.max(1, bookingRoomIds(booking).length), 0);
    const selectedGuestCount = selectedBookings.reduce((total, booking) => total + Number(booking.guest_count || booking.adults + booking.children || 0), 0);
    const selectedTotal = selectedBookings.reduce((total, booking) => total + bookingTotal(booking, rates), 0);
    const roomMap = useMemo(() => new Map(rooms.map(room => [room.id, room])), [rooms]);
    const packageMap = useMemo(() => new Map(packages.map(pkg => [pkg.id, pkg])), [packages]);
    const categoryMap = useMemo(() => new Map(roomCategories.map(category => [category.id, category])), [roomCategories]);
    const totalRooms = rooms.length;

    const roomLabel = (booking: ChaletBooking) => {
        const labels = bookingRoomIds(booking).map(id => {
            const room = roomMap.get(id);
            return room ? `Chalet ${room.room_number}` : 'Unassigned';
        });
        return labels.length > 0 ? labels.join(', ') : 'Unassigned';
    };

    const bookingRoomDetails = (booking: ChaletBooking) => {
        if (Array.isArray(booking.room_allocations) && booking.room_allocations.length > 0) {
            return booking.room_allocations.map((allocation, index) => {
                const roomId = allocation.roomId || (allocation as any).room_id || bookingRoomIds(booking)[index] || '';
                const room = roomId ? roomMap.get(roomId) : undefined;
                const categoryId = allocation.roomCategoryId || (allocation as any).room_category_id || room?.category_id || booking.room_category_id || '';
                const packageId = allocation.packageId || (allocation as any).package_id || booking.room_packages?.[roomId] || booking.package_id || '';
                const category = categoryId ? categoryMap.get(categoryId) : undefined;
                return {
                    key: `${booking.id}-${index}-${roomId || 'unassigned'}`,
                    room,
                    categoryName: category?.name || booking.chalet_room_categories?.name || 'Room type not set',
                    packageName: packageId ? packageMap.get(packageId)?.name || booking.chalet_packages?.name || 'Package not set' : 'Package not set',
                    bedding: room?.bed_type || category?.bed_configurations?.[0] || booking.chalet_room_categories?.bed_configurations?.[0] || 'Bedding not set',
                    adults: Number(allocation.adults ?? booking.room_guests?.[roomId]?.adults ?? (index === 0 ? booking.adults : 1) ?? 1),
                    children: Number(allocation.children ?? booking.room_guests?.[roomId]?.children ?? (index === 0 ? booking.children : 0) ?? 0),
                };
            });
        }

        const ids = bookingRoomIds(booking);
        const fallbackCount = Math.max(1, ids.length);
        return Array.from({ length: fallbackCount }, (_, index) => {
            const roomId = ids[index] || '';
            const room = roomId ? roomMap.get(roomId) : undefined;
            const category = room?.category_id ? categoryMap.get(room.category_id) : undefined;
            const packageId = roomId ? booking.room_packages?.[roomId] || booking.package_id || '' : booking.package_id || '';
            const guests = roomId ? booking.room_guests?.[roomId] : undefined;
            return {
                key: `${booking.id}-${index}-${roomId || 'unassigned'}`,
                room,
                categoryName: category?.name || booking.chalet_room_categories?.name || 'Room type not set',
                packageName: packageId ? packageMap.get(packageId)?.name || booking.chalet_packages?.name || 'Package not set' : 'Package not set',
                bedding: room?.bed_type || category?.bed_configurations?.[0] || booking.chalet_room_categories?.bed_configurations?.[0] || 'Bedding not set',
                adults: Number(guests?.adults ?? (index === 0 ? booking.adults : 1) ?? 1),
                children: Number(guests?.children ?? (index === 0 ? booking.children : 0) ?? 0),
            };
        });
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Booking Calendar</h1>
                    <p className="text-muted-foreground">View chalet room bookings by stay date, room, guest, status, and bill total.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">Active bookings</SelectItem>
                            <SelectItem value="all">All bookings</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="checked_in">Checked In</SelectItem>
                            <SelectItem value="checked_out">Checked Out</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" asChild>
                        <Link href="/dashboard/chalet/bookings">
                            <BedDouble className="mr-2 h-4 w-4" />
                            Bookings
                        </Link>
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Selected Date Bookings</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold">{selectedBookings.length}</p>}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Rooms Occupied</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-bold">{selectedRoomCount}{totalRooms > 0 ? ` / ${totalRooms}` : ''}</p>}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Guests / Booking Total</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-36" /> : <p className="text-2xl font-bold">{selectedGuestCount} / LKR {formatCurrency(selectedTotal)}</p>}
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
                <Card>
                    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <CalendarDays className="h-5 w-5" />
                            {format(currentMonth, 'MMMM yyyy')}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" title="Previous month" onClick={() => setCurrentMonth(month => subMonths(month, 1))}>
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" onClick={() => {
                                const today = new Date();
                                setCurrentMonth(today);
                                setSelectedDate(today);
                            }}>Today</Button>
                            <Button variant="outline" size="icon" title="Next month" onClick={() => setCurrentMonth(month => addMonths(month, 1))}>
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-7 border-l border-t text-xs font-medium text-muted-foreground">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <div key={day} className="border-b border-r px-2 py-2 text-center">{day}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 border-l">
                            {calendarDays.map(day => {
                                const dayBookings = bookingsForDate(day);
                                const occupiedRooms = dayBookings.reduce((total, booking) => total + Math.max(1, bookingRoomIds(booking).length), 0);
                                const occupancyPct = totalRooms > 0 ? Math.min(100, Math.round((occupiedRooms / totalRooms) * 100)) : 0;
                                const selected = isSameDay(day, selectedDate);
                                return (
                                    <button
                                        key={day.toISOString()}
                                        type="button"
                                        onClick={() => setSelectedDate(day)}
                                        className={`min-h-[132px] border-b border-r p-2 text-left transition hover:bg-muted/60 ${!isSameMonth(day, currentMonth) ? 'bg-muted/30 text-muted-foreground' : 'bg-background'} ${selected ? 'ring-2 ring-primary ring-inset' : ''}`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-semibold">{format(day, 'd')}</span>
                                            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : dayBookings.length > 0 && (
                                                <Badge variant="secondary" className="text-[10px]">{dayBookings.length}</Badge>
                                            )}
                                        </div>
                                        <div className="mt-2 space-y-1">
                                            {dayBookings.slice(0, 3).map(booking => (
                                                <div key={booking.id} className={`truncate rounded-sm border px-1.5 py-1 text-[11px] ${statusColors[booking.status]}`}>
                                                    {booking.customer_name} · {roomLabel(booking)}
                                                </div>
                                            ))}
                                            {dayBookings.length > 3 && <div className="text-[11px] text-muted-foreground">+{dayBookings.length - 3} more</div>}
                                        </div>
                                        {dayBookings.length > 0 && (
                                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                                                <div className="h-full bg-primary" style={{ width: `${occupancyPct}%` }} />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{format(selectedDate, 'dd MMMM yyyy')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {loading ? (
                            Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 w-full" />)
                        ) : selectedBookings.length === 0 ? (
                            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                                No room bookings for this date.
                            </div>
                        ) : selectedBookings.map(booking => {
                            const parsedRoomDetails = parseRoomTextDetails(`${booking.special_requests || ''} ${booking.notes || ''}`);
                            const roomDetails = bookingRoomDetails(booking).map((detail, index) => {
                                const parsedDetail = parsedRoomDetails[index] || (parsedRoomDetails[0]?.useForAllRooms ? parsedRoomDetails[0] : undefined);
                                return { ...detail, parsedDetail };
                            });
                            return (
                                <div key={booking.id} className="rounded-md border p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-semibold">{booking.customer_name}</p>
                                            <p className="text-xs text-muted-foreground">{booking.booking_ref}</p>
                                        </div>
                                        <Badge variant="outline" className={statusColors[booking.status]}>{statusLabels[booking.status]}</Badge>
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Stay</p>
                                            <p>{booking.check_in_date} to {booking.check_out_date}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Total</p>
                                            <p>LKR {formatCurrency(bookingTotal(booking, rates))}</p>
                                        </div>
                                    </div>

                                    <div className="mt-4 space-y-3">
                                        {roomDetails.map((detail, index) => (
                                            <div key={detail.key} className="rounded-md bg-muted/40 p-3 text-sm">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <p className="font-semibold">Room {index + 1}: {detail.parsedDetail?.roomType || detail.categoryName} / {detail.parsedDetail?.packageName || detail.packageName}</p>
                                                    <Badge variant="outline">{detail.room ? `Chalet ${detail.room.room_number}` : 'Unassigned'}</Badge>
                                                </div>
                                                <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                                                    <p><span className="font-medium text-foreground">Package:</span> {detail.parsedDetail?.packageName || detail.packageName}</p>
                                                    <p><span className="font-medium text-foreground">Room type:</span> {detail.parsedDetail?.roomType || detail.categoryName}</p>
                                                    <p><span className="font-medium text-foreground">Bedding:</span> {detail.parsedDetail?.bedding || detail.bedding}</p>
                                                    <p><span className="font-medium text-foreground">Adults:</span> {detail.parsedDetail?.adults || detail.adults}</p>
                                                    <p><span className="font-medium text-foreground">Children:</span> {detail.parsedDetail?.children || detail.children}</p>
                                                    {(detail.parsedDetail?.childAges || detail.parsedDetail?.arrivalTime) && (
                                                        <>
                                                            {detail.parsedDetail.childAges && <p><span className="font-medium text-foreground">Child ages:</span> {detail.parsedDetail.childAges}</p>}
                                                            {detail.parsedDetail.arrivalTime && <p><span className="font-medium text-foreground">Arrival:</span> {detail.parsedDetail.arrivalTime}</p>}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Total Guests</p>
                                            <p className="flex items-center gap-1"><Users className="h-3 w-3" />{booking.guest_count || Number(booking.adults || 0) + Number(booking.children || 0)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Rooms Booked</p>
                                            <p>{roomDetails.length}</p>
                                        </div>
                                    </div>

                                    {(booking.customer_phone || booking.customer_email || booking.special_requests || booking.notes) && (
                                        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                                            {booking.customer_phone && <p>{booking.customer_phone}</p>}
                                            {booking.customer_email && <p>{booking.customer_email}</p>}
                                            {booking.special_requests && <p><span className="font-medium text-foreground">Special requests:</span> {booking.special_requests}</p>}
                                            {booking.notes && <p><span className="font-medium text-foreground">Notes:</span> {booking.notes}</p>}
                                        </div>
                                    )}
                                    <Button variant="outline" size="sm" className="mt-3" asChild>
                                        <Link href="/dashboard/chalet/bookings">
                                            <Eye className="mr-2 h-4 w-4" />
                                            Open bookings
                                        </Link>
                                    </Button>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
