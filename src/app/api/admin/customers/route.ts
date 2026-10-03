import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use service role to bypass RLS
const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!);

function normalizeIdentity(value?: string | null) {
    return (value || '').trim().replace(/\s+/g, '').toUpperCase();
}

export async function GET(request: Request) {
    try {
        const token = (await cookies()).get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search');
        const id = searchParams.get('id');

        let query = supabase
            .from('customers')
            .select('*')
            .order('created_at', { ascending: false });

        if (id) {
            query = query.eq('id', id);
        } else if (search) {
            query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,id_number.ilike.%${search}%`);
        }

        const { data, error } = await query;
        if (error) throw error;

        // When looking up a single customer, also resolve the room they're
        // currently checked into (regular reservation or chalet booking), so
        // callers like the service-income form can auto-fill Room Number.
        if (id && data && data.length > 0) {
            const customer = data[0];
            let currentRoom: string | null = null;
            const identity = normalizeIdentity(customer.id_number);

            const { data: reservation } = await supabase
                .from('reservations')
                .select('room:rooms(room_number)')
                .eq('customer_id', id)
                .eq('status', 'checked-in')
                .limit(1)
                .maybeSingle();
            const reservationRoom = (reservation as any)?.room?.room_number;
            if (reservationRoom) currentRoom = reservationRoom;

            if (!currentRoom && (identity || customer.name)) {
                const { data: chaletBooking } = await supabase
                    .from('chalet_bookings')
                    .select('chalet_rooms(room_number)')
                    .or(identity ? `customer_nic.eq.${identity}` : `customer_name.ilike.${customer.name.trim()}`)
                    .eq('status', 'checked_in')
                    .limit(1)
                    .maybeSingle();
                const chaletRoomNumber = (chaletBooking as any)?.chalet_rooms?.room_number;
                if (chaletRoomNumber) currentRoom = `Chalet ${chaletRoomNumber}`;
            }

            const [reservationsRes, chaletBookingsRes] = await Promise.all([
                supabase
                    .from('reservations')
                    .select('id, room_title, guest_name, guest_email, guest_phone, id_card_number, check_in_date, check_out_date, number_of_guests, total_cost, status, special_requests, created_at')
                    .or(`customer_id.eq.${id},id_card_number.eq.${identity || '__none__'},guest_email.eq.${customer.email || '__none__'}`)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('chalet_bookings')
                    .select(`
                        id,
                        customer_name,
                        customer_email,
                        customer_phone,
                        customer_nic,
                        nationality,
                        check_in_date,
                        check_out_date,
                        adults,
                        children,
                        room_allocations,
                        room_ids,
                        rate_per_night,
                        currency,
                        coupon_code,
                        coupon_discount_amount,
                        bill_grand_total,
                        total_amount,
                        payment_status,
                        status,
                        special_requests,
                        created_at,
                        chalet_packages ( name ),
                        chalet_room_categories ( name ),
                        chalet_rooms ( name, room_number )
                    `)
                    .or(identity ? `customer_nic.eq.${identity}` : `customer_email.eq.${customer.email || '__none__'},customer_name.ilike.${customer.name.trim()}`)
                    .order('created_at', { ascending: false }),
            ]);

            if (reservationsRes.error) throw reservationsRes.error;
            if (chaletBookingsRes.error) throw chaletBookingsRes.error;

            return NextResponse.json({
                customers: [{
                    ...customer,
                    current_room: currentRoom,
                    history: {
                        reservations: reservationsRes.data || [],
                        chalet_bookings: chaletBookingsRes.data || [],
                    },
                }],
            });
        }

        return NextResponse.json({ customers: data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const token = (await cookies()).get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const body = await request.json();
        const { id, name, phone, email, id_number, address } = body;
        const normalizedIdNumber = normalizeIdentity(id_number);

        if (!id || !name) {
            return NextResponse.json({ error: 'ID and Name are required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('customers')
            .update({ 
                name, 
                phone, 
                email, 
                id_number: normalizedIdNumber || null,
                address,
                updated_at: new Date().toISOString() 
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ customer: data }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
