import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';
import { blockOverlapsStay, blockWindow, hhmm, loadStayTimes } from '@/lib/chalet-stay';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!);

async function authenticate() {
    const token = (await cookies()).get('auth_token')?.value;
    if (!token) return null;
    return verifyToken(token);
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
function bookingRoomIds(booking: any): string[] {
    const allocationIds = Array.isArray(booking.room_allocations)
        ? booking.room_allocations.map((allocation: any) => allocation?.roomId || allocation?.room_id).filter(Boolean)
        : [];
    return [booking.room_id, ...(Array.isArray(booking.room_ids) ? booking.room_ids : []), ...allocationIds].filter(Boolean);
}

// GET: maintenance blocks (optionally ?from=YYYY-MM-DD to only include those ending on/after it).
export async function GET(request: Request) {
    try {
        if (!(await authenticate())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const from = new URL(request.url).searchParams.get('from');
        let query = supabase
            .from('chalet_room_blocks')
            .select('*,room:chalet_rooms(name,room_number),user:users(name)')
            .order('start_date', { ascending: true });
        if (from && DATE.test(from)) query = query.gte('end_date', from);
        const { data, error } = await query;
        if (error) throw error;
        return NextResponse.json({ blocks: data || [] });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST { room_ids: string[], start_date, end_date, start_time?, end_time?, reason, force? }
// Blocks the chalets from start date/time to end date/time (whole days:
// 00:00 to 23:59). Refuses if a booking's stay hours overlap, unless force.
export async function POST(request: Request) {
    try {
        const payload = await authenticate();
        if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { room_ids, start_date, end_date, start_time, end_time, reason, force } = await request.json();
        const startTime = hhmm(start_time, '00:00');
        const endTime = hhmm(end_time, '23:59');
        const roomIds: string[] = Array.isArray(room_ids) ? room_ids.filter(Boolean) : [];
        if (roomIds.length === 0) return NextResponse.json({ error: 'Select at least one chalet.' }, { status: 400 });
        if (!DATE.test(start_date || '') || !DATE.test(end_date || '')) return NextResponse.json({ error: 'Select the maintenance dates.' }, { status: 400 });
        if (end_date < start_date) return NextResponse.json({ error: 'The end date must be on or after the start date.' }, { status: 400 });
        const window = blockWindow({ start_date, end_date, start_time: startTime, end_time: endTime });
        if (window.end <= window.start) return NextResponse.json({ error: 'The end time must be after the start time.' }, { status: 400 });

        // Bookings whose nights fall on the maintenance days.
        const { data: overlapping, error: bookingsError } = await supabase
            .from('chalet_bookings')
            .select('id,booking_ref,customer_name,check_in_date,check_out_date,room_id,room_ids,room_allocations')
            .neq('status', 'cancelled')
            .lte('check_in_date', end_date)
            .gte('check_out_date', start_date);
        if (bookingsError) throw bookingsError;
        const stayTimes = await loadStayTimes(supabase);
        const block = { start_date, end_date, start_time: startTime, end_time: endTime };
        const conflicts = (overlapping || []).filter(booking =>
            bookingRoomIds(booking).some(id => roomIds.includes(id))
            && blockOverlapsStay(block, booking.check_in_date, booking.check_out_date, stayTimes));
        if (conflicts.length > 0 && !force) {
            return NextResponse.json({
                error: `${conflicts.length} booking(s) already use these chalets on those days.`,
                conflicts: conflicts.map(booking => ({
                    booking_ref: booking.booking_ref,
                    customer_name: booking.customer_name,
                    check_in_date: booking.check_in_date,
                    check_out_date: booking.check_out_date,
                })),
            }, { status: 409 });
        }

        const { data, error } = await supabase
            .from('chalet_room_blocks')
            .insert(roomIds.map(roomId => ({
                room_id: roomId,
                start_date,
                end_date,
                start_time: startTime,
                end_time: endTime,
                reason: String(reason || '').trim() || null,
                created_by: payload.userId || null,
            })))
            .select();
        if (error) throw error;
        return NextResponse.json({ blocks: data, booked_overlaps: conflicts.length }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE ?id= — remove a maintenance block.
export async function DELETE(request: Request) {
    try {
        if (!(await authenticate())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const id = new URL(request.url).searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
        const { error } = await supabase.from('chalet_room_blocks').delete().eq('id', id);
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

