'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    addDays,
    addMonths,
    differenceInCalendarDays,
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
import { ArrowLeft, ArrowRight, BedDouble, CalendarDays, ChevronLeft, ChevronRight, Clock, Eye, GanttChartSquare, GripVertical, Loader2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { ChaletBooking, ChaletBookingStatus, ChaletPackage, ChaletRate, ChaletRoom, ChaletRoomCategory } from '@/lib/types';
import { parseRoomTextDetails } from '@/lib/chalet-room-details';
import { chaletTotalLkr } from '@/lib/chalet-billing';
import { blockOverlapsStay, describeBlock, hhmm } from '@/lib/chalet-stay';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { chaletLabel } from '@/components/dashboard/chalet/maintenance-dialog';

const statusColors: Record<ChaletBookingStatus, string> = {
    pending: 'bg-orange-100 text-orange-800 border-orange-200',
    confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
    checked_in: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    checked_out: 'bg-green-100 text-green-800 border-green-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200',
};

// Solid bar colours for the Timeline view.
const statusBarColors: Record<ChaletBookingStatus, string> = {
    pending: 'bg-orange-400 hover:bg-orange-500 text-white',
    confirmed: 'bg-blue-500 hover:bg-blue-600 text-white',
    checked_in: 'bg-yellow-400 hover:bg-yellow-500 text-yellow-950',
    checked_out: 'bg-green-500 hover:bg-green-600 text-white',
    cancelled: 'bg-red-300 hover:bg-red-400 text-red-950 line-through',
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

// Standard check-in / check-out times ("HH:mm"), from app settings.
type StayTimes = { check_in: string; check_out: string };
const DEFAULT_STAY_TIMES: StayTimes = { check_in: '14:00', check_out: '11:00' };

// "14:30" → 14.5 (hours)
function timeToHours(value: string) {
    const [hours, minutes] = String(value || '').split(':').map(Number);
    if (!Number.isFinite(hours)) return 0;
    return Math.min(24, Math.max(0, hours + (Number.isFinite(minutes) ? minutes : 0) / 60));
}

// "14:00" → "2:00 PM"
function formatTime(value: string) {
    const hours = timeToHours(value);
    const whole = Math.floor(hours);
    const minutes = Math.round((hours - whole) * 60);
    const suffix = whole >= 12 ? 'PM' : 'AM';
    return `${whole % 12 === 0 ? 12 : whole % 12}:${String(minutes).padStart(2, '0')} ${suffix}`;
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
    // Maintenance blocks (days include both ends), shown on the Timeline.
    const [roomBlocks, setRoomBlocks] = useState<{ id: string; room_id: string; start_date: string; end_date: string; start_time?: string | null; end_time?: string | null; reason: string | null }[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(() => new Date());
    const [selectedDate, setSelectedDate] = useState(() => new Date());
    const [statusFilter, setStatusFilter] = useState<'active' | ChaletBookingStatus | 'all'>('active');
    // Timeline (Gantt resource view: chalets × days) or the month grid.
    const [view, setView] = useState<'timeline' | 'month'>('timeline');
    const [timelineStart, setTimelineStart] = useState(() => addDays(new Date(new Date().setHours(0, 0, 0, 0)), -2));
    const [timelineDays, setTimelineDays] = useState(30);
    const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
    // Clicking a booking or a day scrolls down to its details (after they render).
    const detailsRef = useRef<HTMLDivElement>(null);
    const [detailsScrollRequest, setDetailsScrollRequest] = useState(0);
    const showDetails = () => setDetailsScrollRequest(request => request + 1);
    useEffect(() => {
        if (detailsScrollRequest > 0) detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [detailsScrollRequest]);
    const [stayTimes, setStayTimes] = useState<StayTimes>(DEFAULT_STAY_TIMES);
    // Drag & drop room changes (7-day timeline, Edit mode).
    // grabOffset: days between the check-in point and where the bar was grabbed.
    const [dragging, setDragging] = useState<{ booking: ChaletBooking; detail: any; grabOffset: number } | null>(null);
    const [dragOverRow, setDragOverRow] = useState<string | null>(null);
    // Days the booking would move by (left/right while dragging).
    const [dragShift, setDragShift] = useState(0);
    // toRoom null = keep the chalet (dates change only).
    const [pendingMove, setPendingMove] = useState<{ booking: ChaletBooking; detail: any; toRoom: ChaletRoom | null; shift: number } | null>(null);
    const [savingMove, setSavingMove] = useState(false);
    const router = useRouter();
    // A booking's own page (Guest / Reservation / Account).
    const openBookingPage = (bookingId: string) => router.push(`/dashboard/chalet/calendar/${bookingId}`);
    const [editingTimes, setEditingTimes] = useState<StayTimes | null>(null);
    const [savingTimes, setSavingTimes] = useState(false);

    useEffect(() => {
        fetch('/api/admin/app-settings?key=chalet_stay_times')
            .then(response => response.json())
            .then(data => {
                const value = data?.value;
                if (value && typeof value === 'object') setStayTimes({ ...DEFAULT_STAY_TIMES, ...value });
            })
            .catch(() => {});
    }, []);

    const saveStayTimes = async () => {
        if (!editingTimes) return;
        setSavingTimes(true);
        try {
            const res = await fetch('/api/admin/app-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'chalet_stay_times', value: editingTimes }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not save times');
            setStayTimes(editingTimes);
            setEditingTimes(null);
            toast({ title: 'Times saved', description: `Check-in ${formatTime(editingTimes.check_in)} · Check-out ${formatTime(editingTimes.check_out)}` });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setSavingTimes(false);
        }
    };

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
            fetch('/api/chalet/room-blocks', { cache: 'no-store' })
                .then(response => response.json())
                .then(data => setRoomBlocks(data.blocks || []))
                .catch(() => setRoomBlocks([]));
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

    const dateBookings = bookingsForDate(selectedDate);
    // Clicking a bar on the Timeline shows that booking; otherwise the date's bookings.
    const selectedBookings = selectedBookingId
        ? visibleBookings.filter(booking => booking.id === selectedBookingId)
        : dateBookings;
    const selectedRoomCount = dateBookings.reduce((total, booking) => total + Math.max(1, bookingRoomIds(booking).length), 0);
    const selectedGuestCount = dateBookings.reduce((total, booking) => total + Number(booking.guest_count || booking.adults + booking.children || 0), 0);
    const selectedTotal = dateBookings.reduce((total, booking) => total + bookingTotal(booking, rates), 0);
    const roomMap = useMemo(() => new Map(rooms.map(room => [room.id, room])), [rooms]);
    const packageMap = useMemo(() => new Map(packages.map(pkg => [pkg.id, pkg])), [packages]);
    const categoryMap = useMemo(() => new Map(roomCategories.map(category => [category.id, category])), [roomCategories]);
    // Inactive chalets are not offered for bookings, so they don't count towards occupancy.
    const totalRooms = rooms.filter(room => room.status !== 'inactive').length;

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
                    slotIndex: index,
                    roomId,
                    categoryId,
                    packageId,
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
                slotIndex: index,
                roomId,
                categoryId: room?.category_id || booking.room_category_id || '',
                packageId,
                categoryName: category?.name || booking.chalet_room_categories?.name || 'Room type not set',
                packageName: packageId ? packageMap.get(packageId)?.name || booking.chalet_packages?.name || 'Package not set' : 'Package not set',
                bedding: room?.bed_type || category?.bed_configurations?.[0] || booking.chalet_room_categories?.bed_configurations?.[0] || 'Bedding not set',
                adults: Number(guests?.adults ?? (index === 0 ? booking.adults : 1) ?? 1),
                children: Number(guests?.children ?? (index === 0 ? booking.children : 0) ?? 0),
            };
        });
    };


    // ── Timeline (Gantt resource view) ───────────────────────────────────────
    // Rows: chalets grouped by room type (+ Unassigned). Columns: days. Each
    // booked room is a bar from check-in up to (not including) check-out.
    const timelineDates = useMemo(
        () => Array.from({ length: timelineDays }, (_, index) => addDays(timelineStart, index)),
        [timelineStart, timelineDays],
    );
    // Positions are in days from the first visible day, including the time of
    // day: check-in 2 PM on day 3 = 3.583, check-out 11 AM on day 4 = 4.458.
    // nightStart/nightEnd are whole nights, used for occupancy.
    const timelineSegments = useMemo(() => {
        const checkInHours = timeToHours(stayTimes.check_in) / 24;
        const checkOutHours = timeToHours(stayTimes.check_out) / 24;
        const segments: { key: string; rowKey: string; booking: ChaletBooking; start: number; end: number; nightStart: number; nightEnd: number; clippedStart: boolean; clippedEnd: boolean; detail: ReturnType<typeof bookingRoomDetails>[number] }[] = [];
        visibleBookings.forEach(booking => {
            const checkInDay = differenceInCalendarDays(parseDate(booking.check_in_date), timelineStart);
            const checkOutDay = differenceInCalendarDays(parseDate(booking.check_out_date), timelineStart);
            const rawStart = checkInDay + checkInHours;
            let rawEnd = checkOutDay + checkOutHours;
            if (rawEnd <= rawStart) rawEnd = rawStart + 0.25;
            if (rawEnd <= 0 || rawStart >= timelineDays) return;
            bookingRoomDetails(booking).forEach(detail => {
                segments.push({
                    key: detail.key,
                    rowKey: detail.room?.id || 'unassigned',
                    booking,
                    start: Math.max(0, rawStart),
                    end: Math.min(timelineDays, rawEnd),
                    nightStart: checkInDay,
                    nightEnd: Math.max(checkInDay + 1, checkOutDay),
                    clippedStart: rawStart < 0,
                    clippedEnd: rawEnd > timelineDays,
                    detail,
                });
            });
        });
        return segments;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visibleBookings, timelineStart, timelineDays, rooms, packages, roomCategories, stayTimes]);

    // Stack overlapping bars in a row into lanes.
    const laneSegments = (rowKey: string) => {
        const rowSegments = timelineSegments.filter(segment => segment.rowKey === rowKey).sort((a, b) => a.start - b.start || a.end - b.end);
        const laneEnds: number[] = [];
        const placed = rowSegments.map(segment => {
            let lane = laneEnds.findIndex(laneEnd => laneEnd <= segment.start);
            if (lane === -1) { lane = laneEnds.length; laneEnds.push(segment.end); } else { laneEnds[lane] = segment.end; }
            return { ...segment, lane };
        });
        return { placed, lanes: Math.max(1, laneEnds.length) };
    };

    const timelineGroups = useMemo(() => {
        // Inactive chalets are hidden unless they still have bookings in the visible dates.
        const bookedRowKeys = new Set(timelineSegments.map(segment => segment.rowKey));
        const shownRooms = rooms.filter(room => room.status !== 'inactive' || bookedRowKeys.has(room.id));
        const sortRooms = (list: ChaletRoom[]) => [...list].sort((a, b) => String(a.room_number).localeCompare(String(b.room_number), undefined, { numeric: true }));
        const groups = roomCategories
            .map(category => ({ key: category.id, name: category.name, rooms: sortRooms(shownRooms.filter(room => room.category_id === category.id)) }))
            .filter(group => group.rooms.length > 0);
        const uncategorised = sortRooms(shownRooms.filter(room => !room.category_id || !categoryMap.has(room.category_id)));
        if (uncategorised.length > 0) groups.push({ key: 'other', name: 'Other', rooms: uncategorised });
        return groups;
    }, [rooms, roomCategories, categoryMap, timelineSegments]);

    const timelineOccupancy = timelineDates.map((_, index) => {
        const occupied = new Set(timelineSegments.filter(segment => segment.rowKey !== 'unassigned' && segment.nightStart <= index && segment.nightEnd > index).map(segment => segment.rowKey));
        const unassigned = timelineSegments.filter(segment => segment.rowKey === 'unassigned' && segment.nightStart <= index && segment.nightEnd > index).length;
        return { occupied: occupied.size, unassigned };
    });

    // Wider days for short ranges so a week fills the screen.
    const timelineColumnWidth = timelineDays > 45 ? 30 : timelineDays > 20 ? 40 : timelineDays > 7 ? 56 : 120;
    const timelineGrid = `180px repeat(${timelineDays}, minmax(${timelineColumnWidth}px, 1fr))`;
    const today = new Date(new Date().setHours(0, 0, 0, 0));

    const LANE_HEIGHT = 34;

    // ── Moving a booking to another chalet (same dates) ─────────────────────

    // Only bookings not yet checked in can change chalet here.
    const isMovable = (booking: ChaletBooking) => booking.status === 'pending' || booking.status === 'confirmed';

    const roomGuestLimits = (room: ChaletRoom) => {
        const category = room.category_id ? categoryMap.get(room.category_id) : undefined;
        return {
            minAdults: Math.max(1, room.min_adults ?? 1),
            maxAdults: room.max_adults ?? category?.max_adults ?? 99,
            maxChildren: room.max_children ?? category?.max_children ?? 99,
            maxGuests: room.max_guests ?? category?.max_guests ?? 99,
        };
    };

    const bookingUsesRoom = (booking: ChaletBooking, roomId: string) => (
        booking.room_id === roomId
        || (Array.isArray(booking.room_ids) && booking.room_ids.includes(roomId))
        || (Array.isArray(booking.room_allocations) && booking.room_allocations.some(allocation => (allocation.roomId || (allocation as any).room_id) === roomId))
    );

    const shiftDate = (value: string, days: number) => format(addDays(parseDate(value), days), 'yyyy-MM-dd');

    // Is a chalet free (no other booking, no maintenance) for these dates?
    const roomBusyReason = (booking: ChaletBooking, roomId: string, checkIn: string, checkOut: string): string | null => {
        if (roomBlocks.some(item => item.room_id === roomId && blockOverlapsStay(item, checkIn, checkOut, stayTimes))) return 'Maintenance';
        const clash = bookings.some(other =>
            other.id !== booking.id
            && other.status !== 'cancelled'
            && other.check_in_date < checkOut
            && other.check_out_date > checkIn
            && bookingUsesRoom(other, roomId));
        return clash ? 'Booked' : null;
    };

    // Why this chalet can't take the dragged room at these dates (null = it
    // can). Same checks as Assign Room: room type, guest limits, free.
    const moveBlockReason = (booking: ChaletBooking, detail: any, room: ChaletRoom, checkIn: string, checkOut: string, shift: number): string | null => {
        const sameRoom = room.id === detail.roomId;
        if (sameRoom && shift === 0) return 'Current chalet';
        if (room.status === 'inactive') return 'Inactive';
        if (!sameRoom) {
            if (bookingUsesRoom(booking, room.id)) return 'Already in this booking';
            if (detail.categoryId && room.category_id !== detail.categoryId) return 'Different room type';
            const limits = roomGuestLimits(room);
            const adults = Number(detail.adults || 0);
            const children = Number(detail.children || 0);
            if (adults < limits.minAdults) return `Needs ${limits.minAdults}+ adults`;
            if (adults > limits.maxAdults) return `Max ${limits.maxAdults} adults`;
            if (children > limits.maxChildren) return `Max ${limits.maxChildren} children`;
            if (adults + children > limits.maxGuests) return `Max ${limits.maxGuests} guests`;
        }
        return roomBusyReason(booking, room.id, checkIn, checkOut);
    };

    // New dates apply to the whole booking (past dates allowed), so its other
    // chalets must be free then too.
    const dateMoveReason = (booking: ChaletBooking, detail: any, checkIn: string, checkOut: string, shift: number): string | null => {
        if (shift === 0) return null;
        for (const other of bookingRoomDetails(booking)) {
            if (other.slotIndex === detail.slotIndex || !other.roomId) continue;
            const busy = roomBusyReason(booking, other.roomId, checkIn, checkOut);
            if (busy) return `${other.room ? chaletLabel(other.room.room_number) : 'Other chalet'} ${busy.toLowerCase()} then`;
        }
        return null;
    };

    // Reason per row ('unassigned' included) for the current drag position.
    const moveReasons = useMemo(() => {
        if (!dragging) return new Map<string, string | null>();
        const { booking, detail } = dragging;
        const checkIn = shiftDate(booking.check_in_date, dragShift);
        const checkOut = shiftDate(booking.check_out_date, dragShift);
        const bookingWide = dateMoveReason(booking, detail, checkIn, checkOut, dragShift);
        const reasons = new Map<string, string | null>(rooms.map(room => [room.id, bookingWide || moveBlockReason(booking, detail, room, checkIn, checkOut, dragShift)]));
        // The Unassigned row only takes an unassigned room moving to other dates.
        reasons.set('unassigned', detail.roomId ? 'Unassigned' : dragShift === 0 ? 'Current dates' : bookingWide);
        return reasons;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dragging, dragShift, rooms, bookings, roomBlocks, stayTimes]);

    const confirmMove = async () => {
        if (!pendingMove) return;
        const { booking, detail, shift } = pendingMove;
        const toRoom = pendingMove.toRoom && pendingMove.toRoom.id !== detail.roomId ? pendingMove.toRoom : null;
        const datesBody = shift !== 0 ? {
            check_in_date: shiftDate(booking.check_in_date, shift),
            check_out_date: shiftDate(booking.check_out_date, shift),
        } : {};
        if (!toRoom) {
            // Dates only: the chalets, guests and locked price stay as they are.
            setSavingMove(true);
            try {
                const res = await fetch('/api/chalet/bookings', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: booking.id, ...datesBody }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Could not move the booking');
                toast({ title: 'Dates changed', description: `${booking.customer_name} (${booking.booking_ref}) now ${format(parseDate(datesBody.check_in_date!), 'dd MMM')} → ${format(parseDate(datesBody.check_out_date!), 'dd MMM yyyy')}.` });
                setPendingMove(null);
                await fetchData();
            } catch (error: any) {
                toast({ title: 'Not moved', description: error.message, variant: 'destructive' });
            } finally {
                setSavingMove(false);
            }
            return;
        }
        const details = bookingRoomDetails(booking);
        const newIds = details.map(item => item.slotIndex === detail.slotIndex ? toRoom.id : item.roomId).filter(Boolean) as string[];
        const roomGuests = Object.fromEntries(details.map(item => [
            item.slotIndex === detail.slotIndex ? toRoom.id : item.roomId,
            { adults: item.adults, children: item.children },
        ]).filter(([roomId]) => roomId));
        const roomPackages = Object.fromEntries(details.map(item => [
            item.slotIndex === detail.slotIndex ? toRoom.id : item.roomId,
            item.packageId,
        ]).filter(([roomId, packageId]) => roomId && packageId));
        const body: Record<string, unknown> = {
            id: booking.id,
            ...datesBody,
            room_id: newIds[0] || null,
            room_ids: newIds,
            room_guests: roomGuests,
            room_packages: roomPackages,
        };
        // Keep each allocation as it is (locked price, package, guests); only the chalet changes.
        if (Array.isArray(booking.room_allocations) && booking.room_allocations.length > 0) {
            body.room_allocations = booking.room_allocations.map((allocation, index) => {
                if (index !== detail.slotIndex) return allocation;
                const { room_id: _oldRoomId, ...rest } = allocation as any;
                return { ...rest, roomId: toRoom.id };
            });
        }
        setSavingMove(true);
        try {
            const res = await fetch('/api/chalet/bookings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not move the booking');
            toast({ title: shift !== 0 ? 'Chalet and dates changed' : 'Chalet changed', description: `${booking.customer_name} (${booking.booking_ref}) moved to ${chaletLabel(toRoom.room_number)}${shift !== 0 ? `, ${format(parseDate(datesBody.check_in_date!), 'dd MMM')} → ${format(parseDate(datesBody.check_out_date!), 'dd MMM yyyy')}` : ''}.` });
            setPendingMove(null);
            await fetchData();
        } catch (error: any) {
            toast({ title: 'Not moved', description: error.message, variant: 'destructive' });
        } finally {
            setSavingMove(false);
        }
    };
    const renderTimelineRow = (rowKey: string, label: React.ReactNode, sublabel?: string) => {
        const { placed, lanes } = laneSegments(rowKey);
        // While dragging: green = can take the booking, otherwise dimmed with the reason.
        const dropRoom = dragging && rowKey !== 'unassigned' ? roomMap.get(rowKey) : undefined;
        const dropReason = dragging ? moveReasons.get(rowKey) ?? null : null;
        const canDrop = !!dragging && (!!dropRoom || rowKey === 'unassigned') && dropReason === null;
        const isSource = !!dragging && (dragging.detail.roomId || 'unassigned') === rowKey;
        // Days moved for the pointer's position over this row's timeline.
        const shiftAt = (event: React.DragEvent<HTMLDivElement>) => {
            if (!dragging) return 0;
            const area = event.currentTarget.querySelector('[data-timeline-area]') as HTMLElement | null;
            if (!area) return dragShift;
            const rect = area.getBoundingClientRect();
            const pointerDay = ((event.clientX - rect.left) / rect.width) * timelineDays;
            const checkInFraction = timeToHours(stayTimes.check_in) / 24;
            const originalDay = differenceInCalendarDays(parseDate(dragging.booking.check_in_date), timelineStart);
            return Math.round(pointerDay - dragging.grabOffset - checkInFraction) - originalDay;
        };
        const rowState = !dragging ? '' : canDrop ? (dragOverRow === rowKey ? 'bg-green-200/70' : 'bg-green-50') : isSource ? '' : 'opacity-50';
        return (
            <div
                key={rowKey}
                className={`grid border-b transition-colors ${rowState}`}
                style={{ gridTemplateColumns: `180px minmax(${timelineDays * timelineColumnWidth}px, 1fr)` }}
                onDragOver={event => {
                    if (!dragging) return;
                    const shift = shiftAt(event);
                    if (shift !== dragShift) setDragShift(shift);
                    if (dragOverRow !== rowKey) setDragOverRow(rowKey);
                    if (!canDrop) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                }}
                onDragLeave={() => { if (dragOverRow === rowKey) setDragOverRow(null); }}
                onDrop={event => {
                    event.preventDefault();
                    if (!dragging || !canDrop) return;
                    setPendingMove({ booking: dragging.booking, detail: dragging.detail, toRoom: dropRoom || null, shift: dragShift });
                    setDragging(null);
                    setDragOverRow(null);
                    setDragShift(0);
                }}
            >
                <div className={`sticky left-0 z-10 flex flex-col justify-center border-r px-3 ${canDrop ? 'bg-green-50' : 'bg-background'}`} style={{ height: lanes * LANE_HEIGHT }}>
                    <span className="truncate text-sm font-medium">{label}</span>
                    {dragging && dropReason && !(isSource && dragShift === 0) ? (
                        <span className="truncate text-[11px] text-red-600">{dropReason}</span>
                    ) : dragging && canDrop ? (
                        <span className="truncate text-[11px] font-medium text-green-700">Drop here</span>
                    ) : sublabel ? (
                        <span className="truncate text-[11px] text-muted-foreground">{sublabel}</span>
                    ) : null}
                </div>
                <div className="relative" data-timeline-area style={{ height: lanes * LANE_HEIGHT }}>
                    {/* Where the dragged booking would land (green = allowed). */}
                    {dragging && dragOverRow === rowKey && (() => {
                        const checkInFraction = timeToHours(stayTimes.check_in) / 24;
                        const checkOutFraction = timeToHours(stayTimes.check_out) / 24;
                        const start = differenceInCalendarDays(parseDate(dragging.booking.check_in_date), timelineStart) + dragShift + checkInFraction;
                        const end = differenceInCalendarDays(parseDate(dragging.booking.check_out_date), timelineStart) + dragShift + checkOutFraction;
                        const left = Math.max(0, start);
                        const right = Math.min(timelineDays, end);
                        if (right <= 0 || left >= timelineDays) return null;
                        return (
                            <div
                                className={`pointer-events-none absolute z-[6] flex items-center justify-center rounded-md border-2 border-dashed text-[11px] font-semibold ${canDrop ? 'border-green-600 bg-green-400/20 text-green-800' : 'border-red-500 bg-red-400/15 text-red-700'}`}
                                style={{ left: `${(left / timelineDays) * 100}%`, width: `${((right - left) / timelineDays) * 100}%`, top: 3, height: LANE_HEIGHT - 6 }}
                            >
                                <span className="truncate px-1">
                                    {format(addDays(parseDate(dragging.booking.check_in_date), dragShift), 'dd MMM')} → {format(addDays(parseDate(dragging.booking.check_out_date), dragShift), 'dd MMM')}
                                    {!canDrop && dropReason ? ` · ${dropReason}` : ''}
                                </span>
                            </div>
                        );
                    })()}
                    {/* Day cells, with faint check-out / check-in time markers */}
                    <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${timelineDays}, minmax(0, 1fr))` }}>
                        {timelineDates.map((day, index) => {
                            const weekend = day.getDay() === 0 || day.getDay() === 6;
                            return (
                                <div key={index} className={`relative border-r ${isSameDay(day, today) ? 'bg-primary/10' : weekend ? 'bg-muted/40' : ''}`}>
                                    <div className="absolute inset-y-0 border-l border-dashed border-muted-foreground/15" style={{ left: `${(timeToHours(stayTimes.check_out) / 24) * 100}%` }} />
                                    <div className="absolute inset-y-0 border-l border-dashed border-muted-foreground/15" style={{ left: `${(timeToHours(stayTimes.check_in) / 24) * 100}%` }} />
                                </div>
                            );
                        })}
                    </div>
                    {/* Maintenance: whole days closed, behind any bookings */}
                    {roomBlocks.filter(block => block.room_id === rowKey).map(block => {
                        // Positioned by its start and end times (whole days run 00:00–23:59).
                        const start = differenceInCalendarDays(parseDate(block.start_date), timelineStart) + timeToHours(hhmm(block.start_time, '00:00')) / 24;
                        const end = differenceInCalendarDays(parseDate(block.end_date), timelineStart) + Math.max(timeToHours(hhmm(block.end_time, '23:59')), 0.01) / 24;
                        if (end <= 0 || start >= timelineDays) return null;
                        const left = Math.max(0, start);
                        const right = Math.min(timelineDays, end);
                        return (
                            <div
                                key={block.id}
                                title={`Maintenance: ${describeBlock(block, date => format(parseDate(date), 'dd MMM yyyy'))}${block.reason ? `\n${block.reason}` : ''}`}
                                className="absolute inset-y-0 z-[2] flex items-center justify-center overflow-hidden border-x border-slate-400 bg-slate-300/70 text-[11px] font-semibold text-slate-700"
                                style={{
                                    left: `${(left / timelineDays) * 100}%`,
                                    width: `${((right - left) / timelineDays) * 100}%`,
                                    backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.45) 0 6px, transparent 6px 12px)',
                                }}
                            >
                                <span className="truncate px-1">🔧 Maintenance{block.reason ? ` · ${block.reason}` : ''}</span>
                            </div>
                        );
                    })}
                    {placed.map(segment => {
                        // Pending/confirmed bookings (assigned or not) can be dragged to a chalet.
                        const unassigned = !segment.detail.roomId;
                        const draggable = isMovable(segment.booking);
                        return (
                        // A div (not a button) so dragging works in every browser.
                        <div
                            key={segment.key}
                            role="button"
                            tabIndex={0}
                            draggable={draggable}
                            onDragStart={event => {
                                if (!draggable) return;
                                event.dataTransfer.effectAllowed = 'move';
                                event.dataTransfer.setData('text/plain', segment.booking.id);
                                const area = (event.currentTarget.parentElement as HTMLElement | null)?.getBoundingClientRect();
                                const pointerDay = area ? ((event.clientX - area.left) / area.width) * timelineDays : 0;
                                const checkInPoint = differenceInCalendarDays(parseDate(segment.booking.check_in_date), timelineStart) + timeToHours(stayTimes.check_in) / 24;
                                setDragShift(0);
                                setDragging({ booking: segment.booking, detail: segment.detail, grabOffset: area ? pointerDay - checkInPoint : 0 });
                            }}
                            onDragEnd={() => { setDragging(null); setDragOverRow(null); setDragShift(0); }}
                            onClick={() => { setSelectedBookingId(segment.booking.id); setSelectedDate(parseDate(segment.booking.check_in_date)); openBookingPage(segment.booking.id); }}
                            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedBookingId(segment.booking.id); setSelectedDate(parseDate(segment.booking.check_in_date)); openBookingPage(segment.booking.id); } }}
                            title={`${draggable ? (unassigned ? 'Drag onto a chalet to assign it, or left/right to change dates\n' : 'Drag to another chalet, or left/right to change dates\n') : ''}${segment.booking.customer_name} · ${segment.booking.booking_ref}\nIn: ${format(parseDate(segment.booking.check_in_date), 'dd MMM')} ${formatTime(stayTimes.check_in)} → Out: ${format(parseDate(segment.booking.check_out_date), 'dd MMM')} ${formatTime(stayTimes.check_out)} · ${statusLabels[segment.booking.status]}\n${segment.detail.categoryName} · ${segment.detail.packageName} · ${segment.detail.adults} adult(s), ${segment.detail.children} child(ren)`}
                            className={`absolute z-[5] flex items-center gap-1 overflow-hidden px-2 text-left text-[11px] font-medium shadow-sm transition cursor-pointer select-none ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${statusBarColors[segment.booking.status]} ${segment.clippedStart ? 'rounded-l-none' : 'rounded-l-md'} ${segment.clippedEnd ? 'rounded-r-none' : 'rounded-r-md'} ${selectedBookingId === segment.booking.id ? 'ring-2 ring-offset-1 ring-gray-900' : ''}`}
                            style={{
                                left: `${(segment.start / timelineDays) * 100}%`,
                                width: `calc(${((segment.end - segment.start) / timelineDays) * 100}% - 2px)`,
                                top: segment.lane * LANE_HEIGHT + 4,
                                height: LANE_HEIGHT - 8,
                            }}
                        >
                            {segment.clippedStart && <ChevronLeft className="h-3 w-3 shrink-0" />}
                            {draggable && <GripVertical className="h-3 w-3 shrink-0 opacity-70" />}
                            <span className="truncate">{segment.booking.customer_name}</span>
                            {segment.end - segment.start >= 2.5 && <span className="truncate opacity-80">· {segment.booking.booking_ref}</span>}
                            {segment.clippedEnd && <ChevronRight className="ml-auto h-3 w-3 shrink-0" />}
                        </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Booking Calendar</h1>
                    <p className="text-muted-foreground">View chalet room bookings by stay date, room, guest, status, and bill total.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex rounded-md border p-0.5">
                        <Button size="sm" variant={view === 'timeline' ? 'default' : 'ghost'} onClick={() => setView('timeline')}>
                            <GanttChartSquare className="mr-1 h-4 w-4" /> Timeline
                        </Button>
                        <Button size="sm" variant={view === 'month' ? 'default' : 'ghost'} onClick={() => { setView('month'); setSelectedBookingId(null); }}>
                            <CalendarDays className="mr-1 h-4 w-4" /> Month
                        </Button>
                    </div>
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
                        {loading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold">{dateBookings.length}</p>}
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

            <div className={view === 'timeline' ? 'grid grid-cols-1 gap-6' : 'grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]'}>
                {view === 'timeline' ? (
                <Card className="min-w-0">
                    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <GanttChartSquare className="h-5 w-5" />
                            {format(timelineStart, 'dd MMM')} – {format(addDays(timelineStart, timelineDays - 1), 'dd MMM yyyy')}
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-2">
                            {editingTimes ? (
                                <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-2 py-1">
                                    <span className="text-xs font-medium">Check-in</span>
                                    <Input type="time" className="h-8 w-[110px]" value={editingTimes.check_in} onChange={e => setEditingTimes(t => t && { ...t, check_in: e.target.value })} />
                                    <span className="text-xs font-medium">Check-out</span>
                                    <Input type="time" className="h-8 w-[110px]" value={editingTimes.check_out} onChange={e => setEditingTimes(t => t && { ...t, check_out: e.target.value })} />
                                    <Button size="sm" onClick={() => void saveStayTimes()} disabled={savingTimes || !editingTimes.check_in || !editingTimes.check_out}>
                                        {savingTimes ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setEditingTimes(null)}>Cancel</Button>
                                </div>
                            ) : (
                                <Button variant="outline" size="sm" onClick={() => setEditingTimes(stayTimes)} title="Change standard check-in / check-out times">
                                    <Clock className="mr-1 h-4 w-4" />
                                    In {formatTime(stayTimes.check_in)} · Out {formatTime(stayTimes.check_out)}
                                </Button>
                            )}
                            <Select value={String(timelineDays)} onValueChange={value => setTimelineDays(Number(value))}>
                                <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="7">7 days</SelectItem>
                                    <SelectItem value="14">14 days</SelectItem>
                                    <SelectItem value="30">30 days</SelectItem>
                                    <SelectItem value="60">60 days</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="outline" size="icon" title="Earlier" onClick={() => setTimelineStart(start => addDays(start, -Math.max(7, Math.floor(timelineDays / 2))))}>
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" onClick={() => { setTimelineStart(addDays(new Date(new Date().setHours(0, 0, 0, 0)), -2)); setSelectedDate(new Date()); setSelectedBookingId(null); }}>Today</Button>
                            <Button variant="outline" size="icon" title="Later" onClick={() => setTimelineStart(start => addDays(start, Math.max(7, Math.floor(timelineDays / 2))))}>
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="mb-3 text-xs text-muted-foreground">Tip: drag a pending or confirmed booking up/down to another chalet, or left/right to other days (same number of nights). The outline turns green where it can go.</p>
                        {loading ? (
                            <Skeleton className="h-72 w-full" />
                        ) : (
                            <div className="overflow-x-auto rounded-md border">
                                <div className="min-w-max">
                                    {/* Day header */}
                                    <div className="sticky top-0 z-20 grid border-b bg-muted/60" style={{ gridTemplateColumns: timelineGrid }}>
                                        <div className="sticky left-0 z-10 border-r bg-muted px-3 py-2 text-xs font-semibold">Chalet</div>
                                        {timelineDates.map((day, index) => (
                                            <button
                                                key={index}
                                                type="button"
                                                onClick={() => { setSelectedDate(day); setSelectedBookingId(null); showDetails(); }}
                                                className={`border-r px-0.5 py-1 text-center leading-tight hover:bg-muted ${isSameDay(day, today) ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''} ${isSameDay(day, selectedDate) && !selectedBookingId ? 'ring-2 ring-inset ring-primary' : ''}`}
                                            >
                                                <div className="text-[10px] uppercase opacity-70">{format(day, timelineColumnWidth < 40 ? 'EEEEE' : 'EEE')}</div>
                                                <div className="text-xs font-semibold">{format(day, 'd')}</div>
                                                {(index === 0 || day.getDate() === 1) && <div className="text-[9px] font-medium">{format(day, 'MMM')}</div>}
                                            </button>
                                        ))}
                                    </div>

                                    {timelineGroups.map(group => (
                                        <div key={group.key}>
                                            <div className="sticky left-0 border-b bg-muted/30 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.name}</div>
                                            {group.rooms.map(room => {
                                                const name = room.name !== chaletLabel(room.room_number) ? room.name : undefined;
                                                const sublabel = room.status === 'inactive' ? [name, 'Inactive'].filter(Boolean).join(' · ') : name;
                                                return renderTimelineRow(room.id, chaletLabel(room.room_number), sublabel);
                                            })}
                                        </div>
                                    ))}

                                    {timelineSegments.some(segment => segment.rowKey === 'unassigned') && (
                                        <div>
                                            <div className="sticky left-0 border-b bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-700">Unassigned (no chalet yet)</div>
                                            {renderTimelineRow('unassigned', 'Unassigned', 'Assign a chalet in Bookings')}
                                        </div>
                                    )}

                                    {/* Occupancy */}
                                    <div className="grid bg-muted/30" style={{ gridTemplateColumns: timelineGrid }}>
                                        <div className="sticky left-0 z-10 border-r bg-muted px-3 py-2 text-xs font-semibold">Occupied {totalRooms > 0 ? `/ ${totalRooms}` : ''}</div>
                                        {timelineOccupancy.map((day, index) => {
                                            const pct = totalRooms > 0 ? day.occupied / totalRooms : 0;
                                            return (
                                                <div key={index} className={`border-r py-1.5 text-center text-xs font-semibold ${pct >= 1 ? 'bg-red-100 text-red-800' : pct >= 0.5 ? 'bg-amber-50 text-amber-800' : ''}`} title={day.unassigned ? `${day.unassigned} unassigned room(s) too` : undefined}>
                                                    {day.occupied}{day.unassigned ? <span className="text-red-600">+{day.unassigned}</span> : null}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                            {(Object.keys(statusLabels) as ChaletBookingStatus[]).map(status => (
                                <span key={status} className="flex items-center gap-1"><span className={`inline-block h-3 w-3 rounded-sm ${statusBarColors[status].split(' ')[0]}`} />{statusLabels[status]}</span>
                            ))}
                            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-slate-300" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.6) 0 2px, transparent 2px 4px)' }} />Maintenance</span>
                            <span className="flex items-center gap-1"><ChevronRight className="h-3 w-3" />continues past the visible dates</span>
                        </div>
                    </CardContent>
                </Card>
                ) : (
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
                                        onClick={() => { setSelectedDate(day); setSelectedBookingId(null); showDetails(); }}
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
                )}

                <div ref={detailsRef} className="scroll-mt-24">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                        <CardTitle>{selectedBookingId ? 'Booking details' : format(selectedDate, 'dd MMMM yyyy')}</CardTitle>
                        {selectedBookingId && (
                            <Button variant="outline" size="sm" onClick={() => setSelectedBookingId(null)}>
                                Show all on {format(selectedDate, 'dd MMM')}
                            </Button>
                        )}
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
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className={statusColors[booking.status]}>{statusLabels[booking.status]}</Badge>
                                            <Button size="sm" variant="outline" className="h-7" onClick={() => openBookingPage(booking.id)}>
                                                <Eye className="mr-1 h-3.5 w-3.5" /> View
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Stay</p>
                                            <p>In: {format(parseDate(booking.check_in_date), 'dd MMM yyyy')} · {formatTime(stayTimes.check_in)}</p>
                                            <p>Out: {format(parseDate(booking.check_out_date), 'dd MMM yyyy')} · {formatTime(stayTimes.check_out)}</p>
                                            {parsedRoomDetails.find(detail => detail.arrivalTime)?.arrivalTime && (
                                                <p className="text-xs text-muted-foreground">Guest&apos;s estimated arrival: {parsedRoomDetails.find(detail => detail.arrivalTime)!.arrivalTime}</p>
                                            )}
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
            <AlertDialog open={!!pendingMove} onOpenChange={open => { if (!open && !savingMove) setPendingMove(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {!pendingMove ? 'Move booking?' : pendingMove.shift !== 0 && pendingMove.toRoom && pendingMove.toRoom.id !== pendingMove.detail.roomId ? 'Change chalet and dates?' : pendingMove.shift !== 0 ? 'Change dates?' : 'Change chalet?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            {pendingMove ? (() => {
                                const roomChanges = !!pendingMove.toRoom && pendingMove.toRoom.id !== pendingMove.detail.roomId;
                                const fromRoom = pendingMove.detail.room ? chaletLabel(pendingMove.detail.room.room_number) : 'Unassigned';
                                const stay = (shift: number) => `${format(addDays(parseDate(pendingMove.booking.check_in_date), shift), 'dd MMM yyyy')} ${formatTime(stayTimes.check_in)} → ${format(addDays(parseDate(pendingMove.booking.check_out_date), shift), 'dd MMM yyyy')} ${formatTime(stayTimes.check_out)}`;
                                return (
                                    <div className="space-y-1 text-sm">
                                        <p><span className="font-medium text-foreground">{pendingMove.booking.customer_name}</span> · {pendingMove.booking.booking_ref}</p>
                                        <p>
                                            Chalet: {roomChanges ? <>{fromRoom} → <span className="font-medium text-foreground">{chaletLabel(pendingMove.toRoom!.room_number)}</span></> : <>{fromRoom} (unchanged)</>}
                                        </p>
                                        {pendingMove.shift !== 0 ? (
                                            <>
                                                <p>From: {stay(0)}</p>
                                                <p>To: <span className="font-medium text-foreground">{stay(pendingMove.shift)}</span></p>
                                            </>
                                        ) : (
                                            <p>{stay(0)} (dates unchanged)</p>
                                        )}
                                        <p>{pendingMove.detail.categoryName} · {pendingMove.detail.packageName} · {pendingMove.detail.adults} adult(s), {pendingMove.detail.children} child(ren). The same nights and price are kept{pendingMove.shift !== 0 && bookingRoomDetails(pendingMove.booking).length > 1 ? '; the new dates apply to every chalet on this booking' : ''}.</p>
                                    </div>
                                );
                            })() : <span />}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={savingMove}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={event => { event.preventDefault(); void confirmMove(); }} disabled={savingMove}>
                            {savingMove ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Move booking
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
