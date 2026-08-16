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
    : createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const body = await request.json();
        const { reservation_id, chalet_booking_id, customer_name, phone, email, id_number, address, is_loyalty } = body;

        if (!customer_name) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Create or find customer
        let customer_id = null;
        
        // Try to find exact match
        const { data: existingCustomer } = await supabase
            .from('customers')
            .select('id')
            .ilike('name', customer_name.trim())
            .limit(1)
            .single();

        if (existingCustomer) {
            customer_id = existingCustomer.id;
            // Optionally update their details
            await supabase.from('customers').update({
                phone: phone || null,
                email: email || null,
                id_number: id_number || null,
                address: address || null
            }).eq('id', customer_id);
        } else {
            const { data: newCustomer, error: insertError } = await supabase
                .from('customers')
                .insert({ 
                    name: customer_name.trim(),
                    phone: phone || null,
                    email: email || null,
                    id_number: id_number || null,
                    address: address || null
                })
                .select('id')
                .single();
            if (insertError) throw insertError;
            customer_id = newCustomer.id;
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
                .select('id, chalet_rooms(name, room_number)')
                .eq('id', chalet_booking_id)
                .single();

            if (lookupError) throw lookupError;
            const assignedRoom = Array.isArray(existingBooking.chalet_rooms)
                ? existingBooking.chalet_rooms[0]
                : existingBooking.chalet_rooms;
            if (!assignedRoom?.room_number) {
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
            const room = Array.isArray(booking.chalet_rooms) ? booking.chalet_rooms[0] : booking.chalet_rooms;

            const qrCodeBuffer = await QRCode.toBuffer(booking.booking_ref, { width: 600, margin: 2 });
            const qrCodeDataUrl = `data:image/png;base64,${qrCodeBuffer.toString('base64')}`;

            if (email) {
                try {
                    emailResult = await sendCheckInEmail({
                        to: email,
                        guestName: customer_name.trim(),
                        bookingRef: booking.booking_ref,
                        roomNumber: room.room_number,
                        qrCode: qrCodeBuffer
                    });
                } catch (emailError) {
                    console.error('Check-in email failed:', emailError);
                    emailResult = { sent: false, reason: 'Email delivery failed' };
                }
            } else {
                emailResult = { sent: false, reason: 'No guest email provided' };
            }

            chaletCheckIn = {
                booking_ref: booking.booking_ref,
                guest_name: customer_name.trim(),
                email: email || null,
                room_number: room.room_number,
                qr_code: qrCodeDataUrl
            };
        }

        return NextResponse.json({ reservation: updatedReservation, customer_id, chalet_check_in: chaletCheckIn, email: emailResult }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
