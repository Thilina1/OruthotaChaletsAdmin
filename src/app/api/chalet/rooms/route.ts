import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!);

// Number of bookings (any status, past or current) that use each chalet,
// through room_id, room_ids or room_allocations.
async function bookingCountsByRoom() {
    const { data, error } = await supabase
        .from('chalet_bookings')
        .select('room_id, room_ids, room_allocations');
    if (error) throw error;
    const counts = new Map<string, number>();
    (data || []).forEach((booking: any) => {
        const allocationIds = Array.isArray(booking.room_allocations)
            ? booking.room_allocations.map((allocation: any) => allocation?.roomId || allocation?.room_id).filter(Boolean)
            : [];
        const roomIds = new Set<string>([booking.room_id, ...(Array.isArray(booking.room_ids) ? booking.room_ids : []), ...allocationIds].filter(Boolean));
        roomIds.forEach(roomId => counts.set(roomId, (counts.get(roomId) || 0) + 1));
    });
    return counts;
}

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { data, error } = await supabase
            .from('chalet_rooms')
            .select('*, chalet_room_categories (*)')
            .order('sort_order', { ascending: true });

        if (error) throw error;
        // booking_count: a chalet with any booking (past or current) can't be deleted.
        const counts = await bookingCountsByRoom();
        return NextResponse.json({ rooms: (data || []).map((room: any) => ({ ...room, booking_count: counts.get(room.id) || 0 })) }, { status: 200 });
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
        const { name, room_number, floor, description, category_id, min_adults, max_adults, max_children, max_guests, bed_type, status, notes, sort_order } = body;

        if (!name || !room_number) {
            return NextResponse.json({ error: 'Name and room number are required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('chalet_rooms')
            .insert({
                name,
                room_number,
                floor,
                description,
                category_id: category_id || null,
                min_adults: min_adults === '' || min_adults === undefined ? null : Number(min_adults),
                max_adults: max_adults === '' || max_adults === undefined ? null : Number(max_adults),
                max_children: max_children === '' || max_children === undefined ? null : Number(max_children),
                max_guests: max_guests === '' || max_guests === undefined ? null : Number(max_guests),
                bed_type: bed_type || null,
                status: status || 'available',
                notes,
                sort_order: sort_order || 0
            })
            .select('*, chalet_room_categories (*)')
            .single();

        if (error) throw error;
        return NextResponse.json({ room: data }, { status: 201 });
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
        const { id, name, room_number, floor, description, category_id, min_adults, max_adults, max_children, max_guests, bed_type, status, notes, sort_order } = body;

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        const { data, error } = await supabase
            .from('chalet_rooms')
            .update({
                ...(name !== undefined ? { name } : {}),
                ...(room_number !== undefined ? { room_number } : {}),
                ...(floor !== undefined ? { floor } : {}),
                ...(description !== undefined ? { description } : {}),
                ...(category_id !== undefined ? { category_id: category_id || null } : {}),
                ...(min_adults !== undefined ? { min_adults: min_adults === '' ? null : Number(min_adults) } : {}),
                ...(max_adults !== undefined ? { max_adults: max_adults === '' ? null : Number(max_adults) } : {}),
                ...(max_children !== undefined ? { max_children: max_children === '' ? null : Number(max_children) } : {}),
                ...(max_guests !== undefined ? { max_guests: max_guests === '' ? null : Number(max_guests) } : {}),
                ...(bed_type !== undefined ? { bed_type: bed_type || null } : {}),
                ...(status !== undefined ? { status } : {}),
                ...(notes !== undefined ? { notes } : {}),
                ...(sort_order !== undefined ? { sort_order } : {}),
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select('*, chalet_room_categories (*)')
            .single();

        if (error) throw error;
        return NextResponse.json({ room: data }, { status: 200 });
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

        // Only chalets never used by a booking (past, current or cancelled).
        const used = (await bookingCountsByRoom()).get(id) || 0;
        if (used > 0) {
            return NextResponse.json({ error: `This chalet is used in ${used} booking${used === 1 ? '' : 's'} and can't be deleted. Set its status to Inactive instead.` }, { status: 409 });
        }

        const { error } = await supabase.from('chalet_rooms').delete().eq('id', id);
        if (error) throw error;
        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
