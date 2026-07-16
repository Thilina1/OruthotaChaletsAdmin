import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

function calcNights(checkIn: string, checkOut: string) {
    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}

// A room is double-booked if another (non-cancelled) booking's stay overlaps
// this one. Back-to-back stays (one checks out the day the next checks in)
// are allowed, so the comparison is strict on both ends.
async function findRoomConflict(roomId: string, checkIn: string, checkOut: string, excludeId?: string) {
    let query = supabase
        .from('chalet_bookings')
        .select('id, booking_ref, customer_name, check_in_date, check_out_date')
        .eq('room_id', roomId)
        .neq('status', 'cancelled')
        .lt('check_in_date', checkOut)
        .gt('check_out_date', checkIn);
    if (excludeId) query = query.neq('id', excludeId);
    const { data, error } = await query;
    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
}

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { data, error } = await supabase
            .from('chalet_bookings')
            .select(`
                *,
                chalet_packages ( name ),
                chalet_occupancy_types ( name ),
                chalet_rooms ( name, room_number )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return NextResponse.json({ bookings: data }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

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
            guest_count,
            adults,
            children,
            room_id,
            rate_per_night,
            service_charge_pct,
            status,
            special_requests,
            notes,
        } = body;

        if (!customer_name || !check_in_date || !check_out_date) {
            return NextResponse.json({ error: 'Customer name, check-in date, and check-out date are required' }, { status: 400 });
        }

        if (new Date(check_out_date) <= new Date(check_in_date)) {
            return NextResponse.json({ error: 'Check-out date must be after check-in date' }, { status: 400 });
        }

        // If rate not provided but package + occupancy given, look it up
        let finalRate = rate_per_night ?? 0;
        if (!rate_per_night && package_id && occupancy_type_id) {
            const { data: rateData } = await supabase
                .from('chalet_rates')
                .select('rate_per_night')
                .eq('package_id', package_id)
                .eq('occupancy_type_id', occupancy_type_id)
                .single();
            if (rateData) finalRate = rateData.rate_per_night;
        }

        const finalAdults = adults ?? 1;
        const finalChildren = children ?? 0;

        if (room_id) {
            const conflict = await findRoomConflict(room_id, check_in_date, check_out_date);
            if (conflict) {
                return NextResponse.json({
                    error: `This chalet is already booked ${conflict.check_in_date} to ${conflict.check_out_date} for ${conflict.customer_name} (${conflict.booking_ref})`,
                }, { status: 409 });
            }
        }

        const { data, error } = await supabase
            .from('chalet_bookings')
            .insert({
                customer_name,
                customer_email,
                customer_phone,
                customer_nic,
                nationality,
                check_in_date,
                check_out_date,
                package_id: package_id || null,
                occupancy_type_id: occupancy_type_id || null,
                guest_count: guest_count ?? (finalAdults + finalChildren),
                adults: finalAdults,
                children: finalChildren,
                room_id: room_id || null,
                rate_per_night: finalRate,
                service_charge_pct: service_charge_pct ?? 10,
                total_nights: calcNights(check_in_date, check_out_date),
                status: status || 'pending',
                special_requests,
                notes,
            })
            .select(`
                *,
                chalet_packages ( name ),
                chalet_occupancy_types ( name ),
                chalet_rooms ( name, room_number )
            `)
            .single();

        if (error) throw error;
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
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

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
            guest_count,
            adults,
            children,
            room_id,
            rate_per_night,
            service_charge_pct,
            status,
            special_requests,
            notes,
        } = body;

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        if (check_in_date && check_out_date && new Date(check_out_date) <= new Date(check_in_date)) {
            return NextResponse.json({ error: 'Check-out date must be after check-in date' }, { status: 400 });
        }

        // Resolve the effective room/dates for this booking so a partial update
        // (e.g. the "assign room" dialog, which only sends { id, room_id }) is
        // still checked for conflicts against its actual stay dates.
        if (room_id || check_in_date !== undefined || check_out_date !== undefined) {
            const { data: existing } = await supabase
                .from('chalet_bookings')
                .select('room_id, check_in_date, check_out_date')
                .eq('id', id)
                .single();

            const effectiveRoomId = room_id !== undefined ? room_id : existing?.room_id;
            const effectiveCheckIn = check_in_date !== undefined ? check_in_date : existing?.check_in_date;
            const effectiveCheckOut = check_out_date !== undefined ? check_out_date : existing?.check_out_date;

            if (effectiveRoomId && effectiveCheckIn && effectiveCheckOut) {
                const conflict = await findRoomConflict(effectiveRoomId, effectiveCheckIn, effectiveCheckOut, id);
                if (conflict) {
                    return NextResponse.json({
                        error: `This chalet is already booked ${conflict.check_in_date} to ${conflict.check_out_date} for ${conflict.customer_name} (${conflict.booking_ref})`,
                    }, { status: 409 });
                }
            }
        }

        const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
        if (customer_name !== undefined) updatePayload.customer_name = customer_name;
        if (customer_email !== undefined) updatePayload.customer_email = customer_email;
        if (customer_phone !== undefined) updatePayload.customer_phone = customer_phone;
        if (customer_nic !== undefined) updatePayload.customer_nic = customer_nic;
        if (nationality !== undefined) updatePayload.nationality = nationality;
        if (check_in_date !== undefined) updatePayload.check_in_date = check_in_date;
        if (check_out_date !== undefined) updatePayload.check_out_date = check_out_date;
        if (package_id !== undefined) updatePayload.package_id = package_id || null;
        if (occupancy_type_id !== undefined) updatePayload.occupancy_type_id = occupancy_type_id || null;
        if (guest_count !== undefined) updatePayload.guest_count = guest_count;
        if (adults !== undefined) updatePayload.adults = adults;
        if (children !== undefined) updatePayload.children = children;
        if (room_id !== undefined) updatePayload.room_id = room_id || null;
        if (rate_per_night !== undefined) updatePayload.rate_per_night = rate_per_night;
        if (service_charge_pct !== undefined) updatePayload.service_charge_pct = service_charge_pct;
        if (status !== undefined) updatePayload.status = status;
        if (special_requests !== undefined) updatePayload.special_requests = special_requests;
        if (notes !== undefined) updatePayload.notes = notes;
        if (check_in_date !== undefined && check_out_date !== undefined) {
            updatePayload.total_nights = calcNights(check_in_date, check_out_date);
        }

        const { data, error } = await supabase
            .from('chalet_bookings')
            .update(updatePayload)
            .eq('id', id)
            .select(`
                *,
                chalet_packages ( name ),
                chalet_occupancy_types ( name ),
                chalet_rooms ( name, room_number )
            `)
            .single();

        if (error) throw error;
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
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        const { error } = await supabase.from('chalet_bookings').delete().eq('id', id);
        if (error) throw error;
        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
