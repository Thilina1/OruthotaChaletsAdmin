import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const bookingId = searchParams.get('booking_id');
        if (!bookingId) return NextResponse.json({ error: 'booking_id is required' }, { status: 400 });

        const { data, error } = await supabase
            .from('chalet_booking_facility_usage')
            .select('*')
            .eq('booking_id', bookingId);

        if (error) throw error;
        return NextResponse.json({ usage: data }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Toggles a single (booking, facility, date) usage mark: inserts it if
// missing, removes it if present. Returns the resulting used state.
export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const body = await request.json();
        const { booking_id, facility_key, facility_name, usage_date } = body;

        if (!booking_id || !facility_key || !facility_name || !usage_date) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { data: existing } = await supabase
            .from('chalet_booking_facility_usage')
            .select('id')
            .eq('booking_id', booking_id)
            .eq('facility_key', facility_key)
            .eq('usage_date', usage_date)
            .maybeSingle();

        if (existing) {
            const { error } = await supabase
                .from('chalet_booking_facility_usage')
                .delete()
                .eq('id', existing.id);
            if (error) throw error;
            return NextResponse.json({ used: false }, { status: 200 });
        }

        const { error } = await supabase.from('chalet_booking_facility_usage').insert({
            booking_id,
            facility_key,
            facility_name,
            usage_date,
        });
        if (error) throw error;
        return NextResponse.json({ used: true }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
