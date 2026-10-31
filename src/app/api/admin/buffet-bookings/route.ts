import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';
import { isValidEmail } from '@/lib/mailer';
import { sendBuffetBookingEmail } from '@/lib/buffet-booking-email';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use service role to bypass RLS
const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!);

// Columns the dashboard may write; anything else in the request body is ignored.
const WRITABLE_COLUMNS = [
    'name', 'email', 'phone', 'date', 'meal_type', 'guests', 'comments', 'status',
    'package_id', 'price_per_guest', 'service_charge_amount', 'other_charge_amount',
    'vat_amount', 'total_amount',
];

function pickWritable(body: Record<string, any>) {
    return Object.fromEntries(Object.entries(body).filter(([key]) => WRITABLE_COLUMNS.includes(key)));
}

async function isAuthorized() {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    return !!token && !!(await verifyToken(token));
}

export async function GET() {
    try {
        if (!(await isAuthorized())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data, error } = await supabase
            .from('table_bookings')
            .select('*, buffet_packages ( name )')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Buffets added on a chalet booking carry a room-bill charge; show it.
        const ids = (data || []).map((booking: any) => booking.id);
        const { data: charges, error: chargesError } = ids.length
            ? await supabase.from('service_incomes').select('id,table_booking_id,payment_status,invoice_number,room_number').in('table_booking_id', ids)
            : { data: [] as any[], error: null };
        // Before the booking-extras migration no buffet has a room-bill charge.
        const byBooking = new Map((chargesError ? [] : charges || []).map((charge: any) => [charge.table_booking_id, charge]));
        const bookings = (data || []).map((booking: any) => {
            const charge = byBooking.get(booking.id);
            return charge
                ? { ...booking, room_bill: { payment_status: charge.payment_status, invoice_number: charge.invoice_number || null, room_number: charge.room_number || null } }
                : booking;
        });

        return NextResponse.json({ bookings }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        if (!(await isAuthorized())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const booking = pickWritable(await request.json());
        if (!booking.name || !booking.email || !booking.date) {
            return NextResponse.json({ error: 'Name, email, and date are required.' }, { status: 400 });
        }
        if (!isValidEmail(booking.email)) {
            return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
        }
        booking.email = booking.email.trim();

        const { data, error } = await supabase
            .from('table_bookings')
            .insert(booking)
            .select('*, buffet_packages ( name )')
            .single();

        if (error) throw error;

        const email = await sendBuffetBookingEmail(data);

        return NextResponse.json({ booking: data, email }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        if (!(await isAuthorized())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id, ...body } = await request.json();
        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        const update = pickWritable(body);
        if (Object.keys(update).length === 0) {
            return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('table_bookings')
            .update(update)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ booking: data }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
