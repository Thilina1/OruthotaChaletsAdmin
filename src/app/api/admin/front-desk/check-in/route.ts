import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';
import QRCode from 'qrcode';
import { sendCheckInEmail } from '@/lib/check-in-email';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!);

function allocationValue(allocation: Record<string, any>, camelKey: string, snakeKey: string) {
    return allocation?.[camelKey] ?? allocation?.[snakeKey] ?? null;
}

function bookingRoomIds(booking: any) {
    if (Array.isArray(booking.room_ids) && booking.room_ids.length > 0) return booking.room_ids.filter(Boolean);
    const allocationIds = Array.isArray(booking.room_allocations)
        ? booking.room_allocations
            .map((allocation: Record<string, any>) => allocationValue(allocation, 'roomId', 'room_id'))
            .filter(Boolean)
        : [];
    return allocationIds.length ? allocationIds : booking.room_id ? [booking.room_id] : [];
}

function normalizeIdentity(value?: string | null) {
    return (value || '').trim().replace(/\s+/g, '').toUpperCase();
}

function uniqueEmails(values: Array<string | null | undefined>) {
    const seen = new Set<string>();
    return values
        .map(value => value?.trim())
        .filter((value): value is string => Boolean(value))
        .filter(value => {
            const key = value.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

async function upsertCustomerRecord(customer: { name?: string; phone?: string; email?: string; id_number?: string; address?: string }) {
    const name = customer.name?.trim() || '';
    const idNumber = normalizeIdentity(customer.id_number);
    const phone = customer.phone?.trim() || '';
    const email = customer.email?.trim() || '';
    const address = customer.address?.trim() || '';

    if (!name && !idNumber && !address) return null;

    let existingCustomer = null;
    if (idNumber) {
        const { data } = await supabase
            .from('customers')
            .select('id')
            .eq('id_number', idNumber)
            .limit(1)
            .maybeSingle();
        existingCustomer = data;
    }

    if (!existingCustomer && name) {
        const { data } = await supabase
            .from('customers')
            .select('id')
            .ilike('name', name)
            .limit(1)
            .maybeSingle();
        existingCustomer = data;
    }

    const payload = {
        name: name || idNumber || 'Guest',
        phone: phone || null,
        email: email || null,
        id_number: idNumber || null,
        address: address || null,
    };

    if (existingCustomer) {
        const { error } = await supabase
            .from('customers')
            .update(payload)
            .eq('id', existingCustomer.id);
        if (error) throw error;
        return existingCustomer.id;
    }

    const { data: newCustomer, error } = await supabase
        .from('customers')
        .insert(payload)
        .select('id')
        .single();
    if (error) throw error;
    return newCustomer.id;
}

async function bookingRoomLabel(booking: any) {
    const roomIds = bookingRoomIds(booking);
    if (roomIds.length === 0) return '';

    const { data: rooms, error } = await supabase
        .from('chalet_rooms')
        .select('id, room_number')
        .in('id', roomIds);
    if (error) throw error;

    const roomNumberById = new Map((rooms || []).map(room => [room.id, room.room_number]));
    return roomIds
        .map((roomId: string) => roomNumberById.get(roomId))
        .filter(Boolean)
        .join(', ');
}

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const body = await request.json();
        const { reservation_id, chalet_booking_id, customer_name, phone, email, id_number, address, is_loyalty, additional_guests } = body;

        if (!customer_name) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Create or find customer
        const customer_id = await upsertCustomerRecord({
            name: customer_name,
            phone,
            email,
            id_number,
            address,
        });

        const additionalGuestIds = [];
        if (Array.isArray(additional_guests)) {
            for (const guest of additional_guests) {
                const additionalGuestId = await upsertCustomerRecord({
                    name: guest?.name,
                    email: guest?.email,
                    id_number: guest?.id_number,
                    address: guest?.address,
                });
                if (additionalGuestId) additionalGuestIds.push(additionalGuestId);
            }
        }

        // 2. Add to loyalty if checked
        if (is_loyalty && customer_id) {
            // Check if already in loyalty (by phone first, falling back to name)
            let existingLoyalty = null;
            if (phone) {
                const { data } = await supabase
                    .from('loyalty_customers')
                    .select('id')
                    .eq('mobile_number', phone)
                    .limit(1)
                    .single();
                existingLoyalty = data;
            }
            if (!existingLoyalty) {
                const { data } = await supabase
                    .from('loyalty_customers')
                    .select('id')
                    .ilike('name', customer_name.trim())
                    .limit(1)
                    .single();
                existingLoyalty = data;
            }

            if (!existingLoyalty) {
                const { error: loyaltyError } = await supabase.from('loyalty_customers').insert({
                    name: customer_name.trim(),
                    mobile_number: phone || '',
                });
                if (loyaltyError) throw loyaltyError;
            }
        }

        // 3. Update reservation status to checked-in and attach customer_id
        let updatedReservation = null;
        if (reservation_id) {
            const { data, error: updateError } = await supabase
                .from('reservations')
                .update({
                    status: 'checked-in',
                    customer_id: customer_id,
                    check_in_time: new Date().toISOString()
                })
                .eq('id', reservation_id)
                .select()
                .single();

            if (updateError) throw updateError;
            updatedReservation = data;
        }

        let chaletCheckIn = null;
        let emailResult = null;
        if (chalet_booking_id) {
            const { data: existingBooking, error: lookupError } = await supabase
                .from('chalet_bookings')
                .select('id, room_id, room_ids, room_allocations, chalet_rooms(name, room_number)')
                .eq('id', chalet_booking_id)
                .single();

            if (lookupError) throw lookupError;
            const assignedRoomNumbers = await bookingRoomLabel(existingBooking);
            const legacyAssignedRoom = Array.isArray(existingBooking.chalet_rooms)
                ? existingBooking.chalet_rooms[0]
                : existingBooking.chalet_rooms;
            const roomNumberText = assignedRoomNumbers || legacyAssignedRoom?.room_number || '';
            if (!roomNumberText) {
                return NextResponse.json({ error: 'Assign a room before checking in.' }, { status: 400 });
            }

            const { data: booking, error: bookingError } = await supabase
                .from('chalet_bookings')
                .update({
                    status: 'checked_in',
                    customer_name: customer_name.trim(),
                    customer_email: email || null,
                    customer_phone: phone || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', chalet_booking_id)
                .select('*, chalet_rooms(name, room_number)')
                .single();

            if (bookingError) throw bookingError;

            const qrCodeBuffer = await QRCode.toBuffer(booking.booking_ref, { width: 600, margin: 2 });
            const qrCodeDataUrl = `data:image/png;base64,${qrCodeBuffer.toString('base64')}`;

            const emailRecipients = uniqueEmails([
                email,
                ...(Array.isArray(additional_guests) ? additional_guests.map((guest: any) => guest?.email) : []),
            ]);

            if (emailRecipients.length > 0) {
                try {
                    const sendResults = await Promise.allSettled(emailRecipients.map(recipient => sendCheckInEmail({
                        to: recipient,
                        guestName: customer_name.trim(),
                        bookingRef: booking.booking_ref,
                        roomNumber: roomNumberText,
                        qrCode: qrCodeBuffer
                    })));
                    const failedRecipients = sendResults
                        .map((result, index) => ({ result, recipient: emailRecipients[index] }))
                        .filter(({ result }) => result.status === 'rejected' || (result.status === 'fulfilled' && result.value.sent === false));
                    failedRecipients.forEach(({ result, recipient }) => {
                        console.error(`Check-in email to ${recipient} failed:`, result.status === 'rejected' ? result.reason : result.value.reason);
                    });
                    // Short reason shown at the front desk (e.g. "Invalid login").
                    const firstFailure = failedRecipients[0]?.result;
                    const firstFailureReason = firstFailure
                        ? String(firstFailure.status === 'rejected' ? (firstFailure.reason?.message || firstFailure.reason || '') : (firstFailure.value.reason || '')).split('\n')[0].slice(0, 160)
                        : '';

                    emailResult = failedRecipients.length === 0
                        ? { sent: true, sent_count: emailRecipients.length, recipients: emailRecipients }
                        : {
                            sent: failedRecipients.length < emailRecipients.length,
                            sent_count: emailRecipients.length - failedRecipients.length,
                            recipients: emailRecipients.filter(recipient => !failedRecipients.some(failed => failed.recipient === recipient)),
                            failed_recipients: failedRecipients.map(({ recipient }) => recipient),
                            reason: `${failedRecipients.length === emailRecipients.length ? 'Email delivery failed' : 'Some emails failed to send'}${firstFailureReason ? `: ${firstFailureReason}` : ''}`
                        };
                } catch (emailError) {
                    console.error('Check-in email failed:', emailError);
                    emailResult = { sent: false, reason: 'Email delivery failed' };
                }
            } else {
                emailResult = { sent: false, reason: 'No guest email provided', recipients: [] };
            }

            chaletCheckIn = {
                booking_ref: booking.booking_ref,
                guest_name: customer_name.trim(),
                email: email || null,
                email_recipients: emailResult?.recipients || [],
                room_number: roomNumberText,
                qr_code: qrCodeDataUrl
            };
        }

        return NextResponse.json({ reservation: updatedReservation, customer_id, additional_guest_ids: additionalGuestIds, chalet_check_in: chaletCheckIn, email: emailResult }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
