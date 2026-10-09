import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!);

function applyRateDiscount(amount: number, percent?: number | null, fixedValue?: number | null) {
    const fixed = Math.max(0, Number(fixedValue || 0));
    const discount = fixed > 0 ? fixed : amount * Math.min(100, Math.max(0, Number(percent || 0))) / 100;
    return Math.max(0, amount - discount);
}

function getLkrRateForNationality(rateData: { rate_per_night: number; usd_rate_per_night?: number | null; usd_to_lkr_rate?: number | null; discount_percent?: number | null; lkr_discount_value?: number | null; lkr_discount_fixed_value?: number | null; usd_discount_value?: number | null; usd_discount_fixed_value?: number | null }, nationality?: string) {
    if (nationality !== 'Non Sri Lankan') {
        return applyRateDiscount(Number(rateData.rate_per_night), rateData.lkr_discount_value ?? rateData.discount_percent ?? 0, rateData.lkr_discount_fixed_value);
    }
    const usdRate = Number(rateData.usd_rate_per_night || 0);
    const exchangeRate = Number(rateData.usd_to_lkr_rate || 0);
    if (usdRate > 0 && exchangeRate > 0) {
        return applyRateDiscount(usdRate, rateData.usd_discount_value ?? rateData.discount_percent ?? 0, rateData.usd_discount_fixed_value) * exchangeRate;
    }
    return applyRateDiscount(Number(rateData.rate_per_night), rateData.lkr_discount_value ?? rateData.discount_percent ?? 0, rateData.lkr_discount_fixed_value);
}

function calcNights(checkIn: string, checkOut: string) {
    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}

function getCustomerBillCurrency(nationality?: string | null): 'LKR' | 'USD' {
    return nationality === 'Non Sri Lankan' ? 'USD' : 'LKR';
}

function normalizeIdentity(value?: string | null) {
    return (value || '').trim().replace(/\s+/g, '').toUpperCase();
}

async function syncCustomerByIdentity(args: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    idNumber?: string | null;
}) {
    const idNumber = normalizeIdentity(args.idNumber);
    const name = (args.name || '').trim();
    if (!idNumber || !name) return;

    const customerData = {
        name,
        phone: args.phone?.trim() || null,
        email: args.email?.trim() || null,
        id_number: idNumber,
        updated_at: new Date().toISOString(),
    };

    const { data: existingCustomer, error: lookupError } = await supabase
        .from('customers')
        .select('id')
        .eq('id_number', idNumber)
        .maybeSingle();
    if (lookupError) throw lookupError;

    const result = existingCustomer?.id
        ? await supabase.from('customers').update(customerData).eq('id', existingCustomer.id)
        : await supabase.from('customers').insert([{ ...customerData, created_at: new Date().toISOString() }]);
    if (result.error) throw result.error;
}

function getAllocationValue(allocation: Record<string, any>, camelKey: string, snakeKey: string) {
    return allocation?.[camelKey] ?? allocation?.[snakeKey] ?? null;
}

function normalizeRoomAllocations(roomAllocations: unknown) {
    return Array.isArray(roomAllocations)
        ? roomAllocations.map((allocation: any) => ({
            roomId: getAllocationValue(allocation, 'roomId', 'room_id'),
            roomCategoryId: getAllocationValue(allocation, 'roomCategoryId', 'room_category_id'),
            packageId: getAllocationValue(allocation, 'packageId', 'package_id'),
            adults: Number(allocation?.adults ?? 1),
            children: Number(allocation?.children ?? 0),
            // Room's nightly price locked when the booking was priced, in the
            // booking currency (null when not known).
            ratePerNight: Number.isFinite(Number(getAllocationValue(allocation, 'ratePerNight', 'rate_per_night'))) && getAllocationValue(allocation, 'ratePerNight', 'rate_per_night') !== null
                ? Number(getAllocationValue(allocation, 'ratePerNight', 'rate_per_night'))
                : null,
        }))
        : [];
}

// Room assignment saves allocations without prices; keep each room's locked
// price from the booking as it was (matched by position).
function keepLockedRoomRates(incoming: ReturnType<typeof normalizeRoomAllocations>, current: unknown) {
    const currentAllocations = normalizeRoomAllocations(current);
    return incoming.map((allocation, index) => (
        allocation.ratePerNight === null && currentAllocations[index]?.ratePerNight != null
            ? { ...allocation, ratePerNight: currentAllocations[index].ratePerNight }
            : allocation
    ));
}

// A room is double-booked if another (non-cancelled) booking's stay overlaps
// this one. Back-to-back stays (one checks out the day the next checks in)
// are allowed, so the comparison is strict on both ends.
async function findRoomConflict(roomId: string, checkIn: string, checkOut: string, excludeId?: string) {
    let query = supabase
        .from('chalet_bookings')
        .select('id, booking_ref, customer_name, check_in_date, check_out_date, room_id, room_ids, room_allocations')
        .neq('status', 'cancelled')
        .lt('check_in_date', checkOut)
        .gt('check_out_date', checkIn);
    if (excludeId) query = query.neq('id', excludeId);
    const { data, error } = await query;
    if (error) throw error;
    const conflict = (data || []).find((booking: any) => {
        const roomIds = Array.isArray(booking.room_ids) ? booking.room_ids : [];
        const allocationRoomIds = normalizeRoomAllocations(booking.room_allocations)
            .map(allocation => allocation.roomId)
            .filter(Boolean);
        return booking.room_id === roomId || roomIds.includes(roomId) || allocationRoomIds.includes(roomId);
    });
    return conflict || null;
}

async function validateGuestLimits(args: {
    roomId?: string | null;
    categoryId?: string | null;
    adults: number;
    children: number;
}) {
    let limits: { max_adults?: number | null; max_children?: number | null; max_guests?: number | null } | null = null;

    if (args.roomId) {
        const { data: room, error } = await supabase
            .from('chalet_rooms')
            .select('max_adults, max_children, max_guests, category_id, chalet_room_categories ( max_adults, max_children, max_guests )')
            .eq('id', args.roomId)
            .single();
        if (error) throw error;
        const category = Array.isArray(room.chalet_room_categories) ? room.chalet_room_categories[0] : room.chalet_room_categories;
        limits = {
            max_adults: room.max_adults ?? category?.max_adults ?? null,
            max_children: room.max_children ?? category?.max_children ?? null,
            max_guests: room.max_guests ?? category?.max_guests ?? null,
        };
    } else if (args.categoryId) {
        const { data: category, error } = await supabase
            .from('chalet_room_categories')
            .select('max_adults, max_children, max_guests')
            .eq('id', args.categoryId)
            .single();
        if (error) throw error;
        limits = category;
    }

    if (!limits) return null;
    if (limits.max_adults != null && args.adults > limits.max_adults) return `Adults cannot exceed ${limits.max_adults}.`;
    if (limits.max_children != null && args.children > limits.max_children) return `Children cannot exceed ${limits.max_children}.`;
    if (limits.max_guests != null && args.adults + args.children > limits.max_guests) return `Total guests cannot exceed ${limits.max_guests}.`;
    return null;
}

async function validateRoomGuests(roomIds: string[], roomGuests: Record<string, { adults?: number; children?: number }>) {
    for (const roomId of roomIds) {
        const guests = roomGuests[roomId] || { adults: 1, children: 0 };
        const error = await validateGuestLimits({
            roomId,
            adults: Number(guests.adults ?? 1),
            children: Number(guests.children ?? 0),
        });
        if (error) return error;
    }
    return null;
}

async function syncChaletBookingNotifications() {
    const bookingPath = '/dashboard/chalet/bookings';
    const [usersResult, pendingResult] = await Promise.all([
        supabase.from('users').select('id, permissions'),
        supabase.from('chalet_bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);

    if (usersResult.error || pendingResult.error) {
        console.error('Failed to synchronize chalet booking notifications:', usersResult.error?.message || pendingResult.error?.message);
        return;
    }

    const recipients = (usersResult.data ?? []).filter(user =>
        Array.isArray(user.permissions) && user.permissions.includes(bookingPath)
    );
    const pendingCount = pendingResult.count ?? 0;

    const { error: clearError } = await supabase
        .from('notifications')
        .delete()
        .eq('type', 'chalet_booking');

    if (clearError) {
        console.error('Failed to clear chalet booking notifications:', clearError.message);
        return;
    }

    if (recipients.length > 0 && pendingCount > 0) {
        const { error } = await supabase.from('notifications').insert(recipients.map(user => ({
            user_id: user.id,
            type: 'chalet_booking',
            title: 'Chalet Bookings Awaiting Action',
            message: `${pendingCount} chalet booking${pendingCount === 1 ? '' : 's'} awaiting your action.`,
            href: bookingPath,
        })));
        if (error) console.error('Failed to create chalet booking notifications:', error.message);
    }
}

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const tokenPayload = await verifyToken(token);
        if (!tokenPayload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        // Optional ?id= returns just that booking (still as a list).
        const bookingId = new URL(request.url).searchParams.get('id');
        let query = supabase
            .from('chalet_bookings')
            .select(`
                *,
                chalet_packages ( name ),
                chalet_occupancy_types ( name ),
                chalet_room_categories ( name, max_adults, max_children, max_guests, bed_configurations ),
                chalet_rooms ( name, room_number )
            `)
            .order('created_at', { ascending: false });
        if (bookingId) query = query.eq('id', bookingId);
        const { data, error } = await query;

        if (error) throw error;
        return NextResponse.json({ bookings: data }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// A new payment taken in the booking form. Card and online payments post to
// the Front Desk Card / Online Payment Accounts; cash stays in Front Desk cash.
function parseNewPayment(amount: unknown, method: unknown) {
    const value = Math.round(Number(amount || 0) * 100) / 100;
    if (!Number.isFinite(value) || value <= 0) return null;
    return { amount: value, method: String(method || '') };
}

async function newPaymentSetupError(method: string) {
    if (!['cash', 'card', 'online'].includes(method)) return 'Payment method must be cash, card or online.';
    if (method === 'cash') return null;
    const { data: settings, error } = await supabase
        .from('front_desk_account_settings')
        .select('card_account_id,online_account_id')
        .eq('singleton', true)
        .maybeSingle();
    if (error) throw error;
    const accountId = method === 'card' ? settings?.card_account_id : settings?.online_account_id;
    const label = method === 'card' ? 'Card' : 'Online';
    if (!accountId) return `Set the Front Desk ${label} Payment Account (Front Desk Account page) before accepting ${method} payments.`;
    const { data: account } = await supabase.from('accounts').select('id').eq('id', accountId).eq('is_active', true).maybeSingle();
    if (!account) return `The configured Front Desk ${label} Payment Account is inactive or unavailable.`;
    return null;
}

async function recordNewPayment(bookingId: string, payment: { amount: number; method: string }, userId: string | null, markPaid: boolean) {
    const { error } = await supabase.rpc('record_chalet_booking_payment', {
        p_booking_id: bookingId,
        p_amount: payment.amount,
        p_method: payment.method,
        p_user_id: userId,
        p_mark_paid: markPaid,
    });
    return error ? error.message : null;
}

// Saves the booking form's full LKR bill (charges applied per the booking's settings),
// which Front Desk settlement uses. Skipped quietly until the column exists.
async function saveBillTotalLkr(id: string, billTotalLkr: unknown) {
    const value = Math.round(Number(billTotalLkr) * 100) / 100;
    if (billTotalLkr === undefined || billTotalLkr === null || !Number.isFinite(value) || value < 0) return;
    const { error } = await supabase.from('chalet_bookings').update({ bill_total_lkr: value }).eq('id', id);
    if (error && !/bill_total_lkr/i.test(error.message || '')) throw error;
}

// Saves the USD to LKR rate locked on the booking. Skipped quietly until the
// column exists (the database also fills it for new bookings).
async function saveLockedUsdRate(id: string, rate: unknown) {
    const value = Number(rate);
    if (rate === undefined || rate === null || !Number.isFinite(value) || value <= 0) return;
    const { error } = await supabase.from('chalet_bookings').update({ usd_to_lkr_rate: value }).eq('id', id);
    if (error && !/usd_to_lkr_rate/i.test(error.message || '')) throw error;
}

async function fetchBookingWithRelations(id: string) {
    const { data } = await supabase
        .from('chalet_bookings')
        .select(`
                *,
                chalet_packages ( name ),
                chalet_occupancy_types ( name ),
                chalet_room_categories ( name, max_adults, max_children, max_guests, bed_configurations ),
                chalet_rooms ( name, room_number )
            `)
        .eq('id', id)
        .single();
    return data;
}

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const tokenPayload = await verifyToken(token);
        if (!tokenPayload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const body = await request.json();
        const {
            customer_name,
            customer_email,
            customer_phone,
            customer_nic,
            nationality,
            check_in_date,
            check_out_date,
            package_id,
            occupancy_type_id,
            room_category_id,
            guest_count,
            adults,
            children,
            room_id,
            room_ids,
            room_allocations,
            room_packages,
            room_guests,
            rate_per_night,
            service_charge_pct,
            service_charge_currency,
            vat_pct,
            vat_currency,
            sscl_pct,
            sscl_currency,
            amount_paid,
            payment_option,
            payment_method,
            payment_notes,
            payment_status,
            coupon_id,
            coupon_code,
            coupon_discount_amount,
            status,
            special_requests,
            notes,
            new_payment_amount,
            new_payment_method,
            bill_total_lkr,
            usd_to_lkr_rate,
        } = body;

        if (!customer_name || !check_in_date || !check_out_date) {
            return NextResponse.json({ error: 'Customer name, check-in date, and check-out date are required' }, { status: 400 });
        }

        if (new Date(check_out_date) <= new Date(check_in_date)) {
            return NextResponse.json({ error: 'Check-out date must be after check-in date' }, { status: 400 });
        }

        const newPayment = parseNewPayment(new_payment_amount, new_payment_method);
        if (newPayment) {
            const setupError = await newPaymentSetupError(newPayment.method);
            if (setupError) return NextResponse.json({ error: setupError }, { status: 400 });
        }

        // If rate not provided but package given, look it up by room category.
        let finalRate = rate_per_night ?? 0;
        const finalCurrency = getCustomerBillCurrency(nationality);
        if (!rate_per_night && package_id) {
            let rateQuery = supabase
                .from('chalet_rates')
                .select('rate_per_night, usd_rate_per_night, usd_to_lkr_rate, discount_percent, lkr_discount_value, lkr_discount_fixed_value, usd_discount_value, usd_discount_fixed_value')
                .eq('package_id', package_id)
                .is('occupancy_type_id', null);
            rateQuery = room_category_id ? rateQuery.eq('room_category_id', room_category_id) : rateQuery.is('room_category_id', null);
            let { data: rateData } = await rateQuery.maybeSingle();
            if (!rateData && room_category_id) {
                const fallback = await supabase
                    .from('chalet_rates')
                    .select('rate_per_night, usd_rate_per_night, usd_to_lkr_rate, discount_percent, lkr_discount_value, lkr_discount_fixed_value, usd_discount_value, usd_discount_fixed_value')
                    .eq('package_id', package_id)
                    .is('occupancy_type_id', null)
                    .is('room_category_id', null)
                    .maybeSingle();
                rateData = fallback.data;
            }
            if (rateData) finalRate = getLkrRateForNationality(rateData, nationality);
        }

        const normalizedAllocations = normalizeRoomAllocations(room_allocations);
        const allocationRoomIds = normalizedAllocations.map(allocation => allocation.roomId).filter(Boolean);
        const finalRoomIds = Array.isArray(room_ids) ? room_ids.filter(Boolean) : allocationRoomIds.length ? allocationRoomIds : room_id ? [room_id] : [];
        const allocationRoomGuests = Object.fromEntries(normalizedAllocations.filter(allocation => allocation.roomId).map(allocation => [allocation.roomId, { adults: allocation.adults, children: allocation.children }]));
        const finalRoomGuests = room_guests && typeof room_guests === 'object' ? room_guests : allocationRoomGuests;
        const allocationRoomPackages = Object.fromEntries(normalizedAllocations.filter(allocation => allocation.roomId).map(allocation => [allocation.roomId, allocation.packageId || package_id || null]));
        const finalAdults = adults ?? (Object.values(finalRoomGuests).reduce((sum: number, guest: any) => sum + Number(guest?.adults ?? 0), 0) || 1);
        const finalChildren = children ?? (Object.values(finalRoomGuests).reduce((sum: number, guest: any) => sum + Number(guest?.children ?? 0), 0) || 0);
        const limitError = finalRoomIds.length > 0
            ? await validateRoomGuests(finalRoomIds, finalRoomGuests)
            : await validateGuestLimits({
                roomId: room_id || null,
                categoryId: room_category_id || null,
                adults: finalAdults,
                children: finalChildren,
            });
        if (limitError) {
            return NextResponse.json({ error: limitError }, { status: 400 });
        }

        if (finalRoomIds.length > 0) {
            for (const finalRoomId of finalRoomIds) {
            const conflict = await findRoomConflict(finalRoomId, check_in_date, check_out_date);
            if (conflict) {
                return NextResponse.json({
                    error: `This chalet is already booked ${conflict.check_in_date} to ${conflict.check_out_date} for ${conflict.customer_name} (${conflict.booking_ref})`,
                }, { status: 409 });
            }
            }
        }

        await syncCustomerByIdentity({
            name: customer_name,
            phone: customer_phone,
            email: customer_email,
            idNumber: customer_nic,
        });
        const normalizedCustomerNic = normalizeIdentity(customer_nic) || customer_nic;

        const { data, error } = await supabase
            .from('chalet_bookings')
            .insert({
                customer_name,
                customer_email,
                customer_phone,
                customer_nic: normalizedCustomerNic,
                nationality,
                check_in_date,
                check_out_date,
                package_id: package_id || null,
                occupancy_type_id: occupancy_type_id || null,
                room_category_id: room_category_id || null,
                guest_count: guest_count ?? (finalAdults + finalChildren),
                adults: finalAdults,
                children: finalChildren,
                room_id: finalRoomIds[0] || null,
                room_ids: finalRoomIds,
                room_allocations: normalizedAllocations,
                room_packages: room_packages && typeof room_packages === 'object' ? room_packages : allocationRoomPackages,
                room_guests: finalRoomGuests,
                rate_per_night: finalRate,
                currency: finalCurrency,
                service_charge_pct: service_charge_pct ?? 10,
                service_charge_currency: ['LKR', 'USD', 'both'].includes(service_charge_currency) ? service_charge_currency : 'both',
                vat_pct: vat_pct ?? 18,
                vat_currency: ['LKR', 'USD', 'both'].includes(vat_currency) ? vat_currency : 'both',
                sscl_pct: sscl_pct ?? 2.5,
                sscl_currency: ['LKR', 'USD', 'both'].includes(sscl_currency) ? sscl_currency : 'both',
                // A new payment is added by record_chalet_booking_payment below,
                // together with its account posting.
                amount_paid: Math.max(0, Number(amount_paid || 0) - (newPayment?.amount || 0)),
                payment_option: ['none', 'half', 'full', 'custom'].includes(payment_option) ? payment_option : 'none',
                payment_method: newPayment ? null : ['cash', 'card', 'bank_transfer', 'online'].includes(payment_method) ? payment_method : null,
                payment_notes: payment_notes || null,
                payment_status: !newPayment && payment_status === 'paid' ? 'paid' : 'unpaid',
                coupon_id: coupon_id || null,
                coupon_code: coupon_code || null,
                coupon_discount_amount: Math.max(0, Number(coupon_discount_amount || 0)),
                total_nights: calcNights(check_in_date, check_out_date),
                status: status || 'pending',
                special_requests,
                notes,
            })
            .select(`
                *,
                chalet_packages ( name ),
                chalet_occupancy_types ( name ),
                chalet_room_categories ( name, max_adults, max_children, max_guests, bed_configurations ),
                chalet_rooms ( name, room_number )
            `)
            .single();

        if (error) throw error;
        await saveBillTotalLkr(data.id, bill_total_lkr);
        await saveLockedUsdRate(data.id, usd_to_lkr_rate);
        if (data.status === 'pending') await syncChaletBookingNotifications();
        if (newPayment) {
            const paymentError = await recordNewPayment(data.id, newPayment, tokenPayload.userId || null, payment_status === 'paid');
            if (paymentError) return NextResponse.json({ booking: data, payment_error: paymentError }, { status: 201 });
            return NextResponse.json({ booking: (await fetchBookingWithRelations(data.id)) || data }, { status: 201 });
        }
        return NextResponse.json({ booking: data }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const tokenPayload = await verifyToken(token);
        if (!tokenPayload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const body = await request.json();
        const {
            id,
            customer_name,
            customer_email,
            customer_phone,
            customer_nic,
            nationality,
            check_in_date,
            check_out_date,
            package_id,
            occupancy_type_id,
            room_category_id,
            guest_count,
            adults,
            children,
            room_id,
            room_ids,
            room_allocations,
            room_packages,
            room_guests,
            rate_per_night,
            service_charge_pct,
            service_charge_currency,
            vat_pct,
            vat_currency,
            sscl_pct,
            sscl_currency,
            amount_paid,
            payment_option,
            payment_method,
            payment_notes,
            payment_status,
            coupon_id,
            coupon_code,
            coupon_discount_amount,
            status,
            special_requests,
            notes,
            assign_only,
            new_payment_amount,
            new_payment_method,
            bill_total_lkr,
            usd_to_lkr_rate,
        } = body;

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        const newPayment = parseNewPayment(new_payment_amount, new_payment_method);
        if (newPayment) {
            const setupError = await newPaymentSetupError(newPayment.method);
            if (setupError) return NextResponse.json({ error: setupError }, { status: 400 });
        }

        const { data: currentBooking, error: currentBookingError } = await supabase
            .from('chalet_bookings')
            .select('status, room_id, room_ids, room_allocations, room_packages, room_guests, room_category_id, package_id, adults, children, customer_name, customer_phone, customer_email, customer_nic')
            .eq('id', id)
            .single();
        if (currentBookingError) throw currentBookingError;

        if (check_in_date && check_out_date && new Date(check_out_date) <= new Date(check_in_date)) {
            return NextResponse.json({ error: 'Check-out date must be after check-in date' }, { status: 400 });
        }

        // Resolve the effective room/dates for this booking so a partial update
        // (e.g. the "assign room" dialog, which only sends { id, room_id }) is
        // still checked for conflicts against its actual stay dates.
        if (room_id || room_ids !== undefined || room_allocations !== undefined || check_in_date !== undefined || check_out_date !== undefined) {
            const { data: existing } = await supabase
                .from('chalet_bookings')
                .select('room_id, room_ids, check_in_date, check_out_date')
                .eq('id', id)
                .single();

            const allocationRoomIdsForConflict = normalizeRoomAllocations(room_allocations)
                .map(allocation => allocation.roomId)
                .filter(Boolean);
            const effectiveRoomIds = room_ids !== undefined
                ? (Array.isArray(room_ids) ? room_ids.filter(Boolean) : [])
                : room_allocations !== undefined && allocationRoomIdsForConflict.length > 0
                    ? allocationRoomIdsForConflict
                : room_id !== undefined
                    ? (room_id ? [room_id] : [])
                    : (Array.isArray(existing?.room_ids) && existing.room_ids.length > 0 ? existing.room_ids : existing?.room_id ? [existing.room_id] : []);
            const effectiveCheckIn = check_in_date !== undefined ? check_in_date : existing?.check_in_date;
            const effectiveCheckOut = check_out_date !== undefined ? check_out_date : existing?.check_out_date;

            if (effectiveRoomIds.length > 0 && effectiveCheckIn && effectiveCheckOut) {
                for (const effectiveRoomId of effectiveRoomIds) {
                const conflict = await findRoomConflict(effectiveRoomId, effectiveCheckIn, effectiveCheckOut, id);
                if (conflict) {
                    return NextResponse.json({
                        error: `This chalet is already booked ${conflict.check_in_date} to ${conflict.check_out_date} for ${conflict.customer_name} (${conflict.booking_ref})`,
                    }, { status: 409 });
                }
                }
            }
        }

        const effectiveAdults = adults !== undefined ? adults : currentBooking.adults ?? 1;
        const effectiveChildren = children !== undefined ? children : currentBooking.children ?? 0;
        const normalizedAllocations = normalizeRoomAllocations(room_allocations);
        const allocationRoomIds = normalizedAllocations.map(allocation => allocation.roomId).filter(Boolean);
        const updateRoomIds = room_ids !== undefined
            ? (Array.isArray(room_ids) ? room_ids.filter(Boolean) : [])
            : room_allocations !== undefined && allocationRoomIds.length > 0
                ? allocationRoomIds
            : room_id !== undefined
                ? (room_id ? [room_id] : [])
                : (Array.isArray(currentBooking.room_ids) && currentBooking.room_ids.length > 0 ? currentBooking.room_ids : currentBooking.room_id ? [currentBooking.room_id] : []);
        const allocationRoomGuests = Object.fromEntries(normalizedAllocations.filter(allocation => allocation.roomId).map(allocation => [allocation.roomId, { adults: allocation.adults, children: allocation.children }]));
        const effectiveRoomGuests = room_guests !== undefined && room_guests && typeof room_guests === 'object'
            ? room_guests
            : room_allocations !== undefined && Object.keys(allocationRoomGuests).length > 0
                ? allocationRoomGuests
            : currentBooking.room_guests || {};
        const effectiveRoomIdForLimits = updateRoomIds[0] || null;
        const effectiveCategoryIdForLimits = room_category_id !== undefined ? room_category_id : currentBooking.room_category_id;
        // The Assign Chalet Room dialog only checks whether a chalet is already
        // booked for the stay dates, so guest limits are not enforced there.
        const limitError = assign_only === true
            ? null
            : updateRoomIds.length > 0
            ? await validateRoomGuests(updateRoomIds, effectiveRoomGuests)
            : await validateGuestLimits({
                roomId: effectiveRoomIdForLimits || null,
                categoryId: effectiveCategoryIdForLimits || null,
                adults: effectiveAdults,
                children: effectiveChildren,
            });
        if (limitError) {
            return NextResponse.json({ error: limitError }, { status: 400 });
        }

        const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
        if (customer_name !== undefined) updatePayload.customer_name = customer_name;
        if (customer_email !== undefined) updatePayload.customer_email = customer_email;
        if (customer_phone !== undefined) updatePayload.customer_phone = customer_phone;
        if (customer_nic !== undefined) updatePayload.customer_nic = customer_nic;
        if (nationality !== undefined) {
            updatePayload.nationality = nationality;
            updatePayload.currency = getCustomerBillCurrency(nationality);
        }
        if (check_in_date !== undefined) updatePayload.check_in_date = check_in_date;
        if (check_out_date !== undefined) updatePayload.check_out_date = check_out_date;
        if (package_id !== undefined) updatePayload.package_id = package_id || null;
        if (occupancy_type_id !== undefined) updatePayload.occupancy_type_id = occupancy_type_id || null;
        if (room_category_id !== undefined) updatePayload.room_category_id = room_category_id || null;
        if (guest_count !== undefined) updatePayload.guest_count = guest_count;
        if (adults !== undefined) updatePayload.adults = adults;
        if (children !== undefined) updatePayload.children = children;
        if (room_id !== undefined || room_ids !== undefined || room_allocations !== undefined) {
            updatePayload.room_ids = updateRoomIds;
            updatePayload.room_id = updateRoomIds[0] || null;
        }
        if (room_allocations !== undefined && Array.isArray(room_allocations)) updatePayload.room_allocations = keepLockedRoomRates(normalizedAllocations, currentBooking.room_allocations);
        if (room_packages !== undefined && room_packages && typeof room_packages === 'object') updatePayload.room_packages = room_packages;
        if (room_guests !== undefined && room_guests && typeof room_guests === 'object') updatePayload.room_guests = room_guests;
        if (rate_per_night !== undefined) updatePayload.rate_per_night = rate_per_night;
        if (service_charge_pct !== undefined) updatePayload.service_charge_pct = service_charge_pct;
        if (service_charge_currency !== undefined && ['LKR', 'USD', 'both'].includes(service_charge_currency)) updatePayload.service_charge_currency = service_charge_currency;
        if (vat_pct !== undefined) updatePayload.vat_pct = vat_pct;
        if (vat_currency !== undefined && ['LKR', 'USD', 'both'].includes(vat_currency)) updatePayload.vat_currency = vat_currency;
        if (sscl_pct !== undefined) updatePayload.sscl_pct = sscl_pct;
        if (sscl_currency !== undefined && ['LKR', 'USD', 'both'].includes(sscl_currency)) updatePayload.sscl_currency = sscl_currency;
        // With a new payment, the amount, method and paid status are applied by
        // record_chalet_booking_payment after this update, with the account posting.
        if (amount_paid !== undefined) updatePayload.amount_paid = Math.max(0, Number(amount_paid || 0) - (newPayment?.amount || 0));
        if (payment_option !== undefined && ['none', 'half', 'full', 'custom'].includes(payment_option)) updatePayload.payment_option = payment_option;
        if (payment_method !== undefined && !newPayment) updatePayload.payment_method = ['cash', 'card', 'bank_transfer', 'online'].includes(payment_method) ? payment_method : null;
        if (payment_notes !== undefined) updatePayload.payment_notes = payment_notes || null;
        if (payment_status !== undefined && ['unpaid', 'paid'].includes(payment_status) && !(newPayment && payment_status === 'paid')) updatePayload.payment_status = payment_status;
        if (coupon_id !== undefined) updatePayload.coupon_id = coupon_id || null;
        if (coupon_code !== undefined) updatePayload.coupon_code = coupon_code || null;
        if (coupon_discount_amount !== undefined) updatePayload.coupon_discount_amount = Math.max(0, Number(coupon_discount_amount || 0));
        if (status !== undefined) updatePayload.status = status;
        if (special_requests !== undefined) updatePayload.special_requests = special_requests;
        if (notes !== undefined) updatePayload.notes = notes;
        if (check_in_date !== undefined && check_out_date !== undefined) {
            updatePayload.total_nights = calcNights(check_in_date, check_out_date);
        }
        if (customer_name !== undefined || customer_phone !== undefined || customer_email !== undefined || customer_nic !== undefined) {
            await syncCustomerByIdentity({
                name: customer_name ?? currentBooking.customer_name,
                phone: customer_phone ?? currentBooking.customer_phone,
                email: customer_email ?? currentBooking.customer_email,
                idNumber: customer_nic ?? currentBooking.customer_nic,
            });
            if (customer_nic !== undefined) updatePayload.customer_nic = normalizeIdentity(customer_nic) || customer_nic;
        }

        const { data, error } = await supabase
            .from('chalet_bookings')
            .update(updatePayload)
            .eq('id', id)
            .select(`
                *,
                chalet_packages ( name ),
                chalet_occupancy_types ( name ),
                chalet_room_categories ( name, max_adults, max_children, max_guests, bed_configurations ),
                chalet_rooms ( name, room_number )
            `)
            .single();

        if (error) throw error;
        await saveBillTotalLkr(id, bill_total_lkr);
        await saveLockedUsdRate(id, usd_to_lkr_rate);
        if (currentBooking.status !== data.status && (currentBooking.status === 'pending' || data.status === 'pending')) {
            await syncChaletBookingNotifications();
        }
        if (newPayment) {
            const paymentError = await recordNewPayment(id, newPayment, tokenPayload.userId || null, payment_status === 'paid');
            if (paymentError) return NextResponse.json({ booking: data, payment_error: paymentError }, { status: 200 });
            return NextResponse.json({ booking: (await fetchBookingWithRelations(id)) || data }, { status: 200 });
        }
        return NextResponse.json({ booking: data }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const tokenPayload = await verifyToken(token);
        if (!tokenPayload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        const { data: booking, error: bookingError } = await supabase
            .from('chalet_bookings')
            .select('status')
            .eq('id', id)
            .single();
        if (bookingError) throw bookingError;

        if (booking.status === 'checked_in' || booking.status === 'checked_out') {
            return NextResponse.json({ error: 'Checked-in and checked-out bookings cannot be deleted.' }, { status: 409 });
        }

        // Check status again in the delete itself in case check-in happened after the read.
        const { data: deleted, error } = await supabase.from('chalet_bookings')
            .delete().eq('id', id).not('status', 'in', '(checked_in,checked_out)').select('id');
        if (error) throw error;
        if (!deleted?.length) {
            return NextResponse.json({ error: 'This booking could not be deleted. Refresh the bookings to see its current status.' }, { status: 409 });
        }
        if (booking.status === 'pending') await syncChaletBookingNotifications();
        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
