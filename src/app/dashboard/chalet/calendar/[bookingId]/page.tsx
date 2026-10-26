'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { ChaletBooking, ChaletBookingStatus, ChaletPackage, ChaletRate, ChaletRoom, ChaletRoomCategory } from '@/lib/types';
import { DEFAULT_STAY_TIMES, type StayTimes } from '@/lib/chalet-stay';
import { chaletLabel } from '@/components/dashboard/chalet/maintenance-dialog';
import { BookingDetailsView, type BookingRoomLine } from '@/components/dashboard/chalet/booking-details-view';
import { ReservationAccount, tabBalance, useReservationAccount } from '@/components/dashboard/chalet/reservation-account';

// One chalet booking as its own page (Guest / Reservation / Account), opened
// from a booking tile on the Booking Calendar.

const statusLabels: Record<ChaletBookingStatus, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    checked_in: 'Checked In',
    checked_out: 'Checked Out',
    cancelled: 'Cancelled',
};

const statusColors: Record<ChaletBookingStatus, string> = {
    pending: 'bg-orange-100 text-orange-800 border-orange-200',
    confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
    checked_in: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    checked_out: 'bg-green-100 text-green-800 border-green-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200',
};

// Each room on the booking with its chalet, room type, package and guests.
function bookingRooms(booking: ChaletBooking, rooms: ChaletRoom[], categories: ChaletRoomCategory[], packages: ChaletPackage[]): BookingRoomLine[] {
    const roomById = new Map(rooms.map(room => [room.id, room]));
    const categoryById = new Map(categories.map(category => [category.id, category]));
    const packageById = new Map(packages.map(pkg => [pkg.id, pkg]));
    const roomIds = booking.room_ids?.length ? booking.room_ids : booking.room_id ? [booking.room_id] : [];
    const allocations = Array.isArray(booking.room_allocations) && booking.room_allocations.length > 0
        ? booking.room_allocations
        : Array.from({ length: Math.max(1, roomIds.length) }, () => ({} as NonNullable<ChaletBooking['room_allocations']>[number]));
    return allocations.map((allocation, index) => {
        const roomId = allocation.roomId || (allocation as any).room_id || roomIds[index] || '';
        const room = roomId ? roomById.get(roomId) : undefined;
        const categoryId = allocation.roomCategoryId || (allocation as any).room_category_id || room?.category_id || booking.room_category_id || '';
        const packageId = allocation.packageId || (allocation as any).package_id || (roomId ? booking.room_packages?.[roomId] : '') || booking.package_id || '';
        const category = categoryId ? categoryById.get(categoryId) : undefined;
        const guests = roomId ? booking.room_guests?.[roomId] : undefined;
        return {
            roomLabel: room ? chaletLabel(room.room_number) : 'Unassigned',
            categoryName: category?.name || booking.chalet_room_categories?.name || '',
            packageName: (packageId ? packageById.get(packageId)?.name : '') || booking.chalet_packages?.name || '',
            bedding: room?.bed_type || category?.bed_configurations?.[0] || '',
            adults: Number(allocation.adults ?? guests?.adults ?? (index === 0 ? booking.adults : 1) ?? 1),
            children: Number(allocation.children ?? guests?.children ?? (index === 0 ? booking.children : 0) ?? 0),
        };
    });
}

export default function ChaletBookingDetailsPage() {
    const params = useParams<{ bookingId: string }>();
    const router = useRouter();
    const { toast } = useToast();
    const [booking, setBooking] = useState<ChaletBooking | null>(null);
    const [rooms, setRooms] = useState<ChaletRoom[]>([]);
    const [categories, setCategories] = useState<ChaletRoomCategory[]>([]);
    const [packages, setPackages] = useState<ChaletPackage[]>([]);
    const [rates, setRates] = useState<ChaletRate[]>([]);
    const [stayTimes, setStayTimes] = useState<StayTimes>(DEFAULT_STAY_TIMES);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const account = useReservationAccount(params?.bookingId);
    // Reservation Account window and the tab it opens at.
    const [accountTab, setAccountTab] = useState<string | null>(null);

    useEffect(() => {
        const bookingId = params?.bookingId;
        if (!bookingId) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const [bookingRes, roomsRes, categoriesRes, packagesRes] = await Promise.all([
                    fetch(`/api/chalet/bookings?id=${encodeURIComponent(bookingId)}`),
                    fetch('/api/chalet/rooms'),
                    fetch('/api/chalet/room-categories'),
                    fetch('/api/chalet/packages'),
                ]);
                const [bookingData, roomsData, categoriesData, packagesData] = await Promise.all([
                    bookingRes.json(), roomsRes.json(), categoriesRes.json(), packagesRes.json(),
                ]);
                if (!bookingRes.ok) throw new Error(bookingData.error || 'Failed to load the booking');
                if (cancelled) return;
                const found = (bookingData.bookings || [])[0] || null;
                setBooking(found);
                setNotFound(!found);
                setRooms(roomsData.rooms || []);
                setCategories(categoriesData.categories || []);
                setPackages(packagesData.packages || []);
                // Only needed for bookings without a locked exchange rate.
                fetch('/api/chalet/rates').then(response => response.json()).then(data => { if (!cancelled) setRates(data.rates || []); }).catch(() => undefined);
                fetch('/api/admin/app-settings?key=chalet_stay_times').then(response => response.json()).then(data => {
                    const value = data?.value ?? data?.setting?.value;
                    if (!cancelled && value && typeof value === 'object') setStayTimes({ ...DEFAULT_STAY_TIMES, ...value });
                }).catch(() => undefined);
            } catch (error: any) {
                if (!cancelled) toast({ title: 'Error', description: error.message, variant: 'destructive' });
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [params?.bookingId, toast]);

    const goBack = () => {
        if (window.history.length > 1) router.back();
        else router.push('/dashboard/chalet/calendar');
    };

    return (
        <div className="space-y-4 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <Button variant="outline" size="sm" onClick={goBack}>
                        <ArrowLeft className="mr-1 h-4 w-4" /> Back to calendar
                    </Button>
                    {booking && (
                        <div className="min-w-0">
                            <h1 className="truncate text-2xl font-bold">{booking.customer_name}</h1>
                            <p className="text-sm text-muted-foreground">
                                {booking.booking_ref} · {format(parseISO(`${booking.check_in_date}T00:00:00`), 'd MMM yyyy')} → {format(parseISO(`${booking.check_out_date}T00:00:00`), 'd MMM yyyy')}
                            </p>
                        </div>
                    )}
                </div>
                {booking && <Badge variant="outline" className={`text-sm ${statusColors[booking.status]}`}>{statusLabels[booking.status]}</Badge>}
            </div>

            {loading ? (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {[0, 1, 2].map(index => <Skeleton key={index} className="h-[480px] w-full" />)}
                </div>
            ) : notFound || !booking ? (
                <div className="rounded-lg border p-8 text-center text-muted-foreground">This booking was not found. It may have been deleted.</div>
            ) : (() => {
                const roomLines = bookingRooms(booking, rooms, categories, packages);
                return (
                    <>
                        <BookingDetailsView
                            booking={booking}
                            rooms={roomLines}
                            rates={rates}
                            stayTimes={stayTimes}
                            statusLabel={statusLabels[booking.status]}
                            statusClassName={statusColors[booking.status]}
                            accountBalances={account.tabs.map(tab => ({ key: tab.key, label: tab.label, balance: tabBalance(tab.rows) }))}
                            accountLoading={account.loading}
                            onOpenAccount={tab => setAccountTab(tab)}
                        />
                        <ReservationAccount
                            booking={booking}
                            roomLabel={Array.from(new Set(roomLines.map(line => line.roomLabel))).join(', ')}
                            account={account}
                            open={accountTab !== null}
                            initialTab={accountTab || 'all'}
                            onOpenChange={open => { if (!open) setAccountTab(null); }}
                        />
                    </>
                );
            })()}
        </div>
    );
}
