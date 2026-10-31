import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';
import { sendBuffetBookingEmail } from '@/lib/buffet-booking-email';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use service role to bypass RLS
const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!);

// Re-sends the invoice email for an existing buffet booking.
export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token || !(await verifyToken(token))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id } = await request.json();
        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        const { data, error } = await supabase
            .from('table_bookings')
            .select('*, buffet_packages ( name )')
            .eq('id', id)
            .single();

        if (error) throw error;

        const email = await sendBuffetBookingEmail(data);
        if (!email.sent) return NextResponse.json({ error: email.reason }, { status: 400 });

        return NextResponse.json({ email }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
