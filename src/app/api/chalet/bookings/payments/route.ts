import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';
import { chaletOutstandingLkr, chaletPaidLkr, chaletPaymentHistory, chaletTotalLkr } from '@/lib/chalet-billing';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!);

// Payment history of one chalet booking, in LKR.
export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const bookingId = new URL(request.url).searchParams.get('booking_id');
        if (!bookingId) return NextResponse.json({ error: 'booking_id is required' }, { status: 400 });

        const [bookingResult, ratesResult, paymentsResult] = await Promise.all([
            supabase.from('chalet_bookings').select('*').eq('id', bookingId).single(),
            supabase.from('chalet_rates').select('package_id,room_category_id,occupancy_type_id,usd_to_lkr_rate'),
            supabase
                .from('chalet_booking_payments')
                .select('id,amount,payment_method,paid_at,account:accounts(name),user:users(name)')
                .eq('booking_id', bookingId)
                .order('paid_at', { ascending: true }),
        ]);
        if (bookingResult.error) throw bookingResult.error;
        if (ratesResult.error) throw ratesResult.error;

        const booking = bookingResult.data;
        const rates = ratesResult.data || [];
        // Tolerates the payments table not existing before its migration.
        const paymentRows = paymentsResult.error ? [] : paymentsResult.data || [];

        return NextResponse.json({
            payments: chaletPaymentHistory(booking, paymentRows, rates),
            total_lkr: chaletTotalLkr(booking, rates),
            paid_lkr: chaletPaidLkr(booking, rates),
            balance_lkr: chaletOutstandingLkr(booking, rates),
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
