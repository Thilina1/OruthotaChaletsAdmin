import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// Paying a bill and checking a guest out are separate steps: "pay" settles
// every outstanding charge without ending the stay, and "checkout" (only
// meaningful once nothing is outstanding) moves the stay to its final status.
export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const body = await request.json();
        const { customer_id, payment_method, mode } = body;

        if (!customer_id) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { data: customer } = await supabase
            .from('customers')
            .select('name')
            .eq('id', customer_id)
            .single();

        if (mode === 'checkout') {
            const { error: resError } = await supabase
                .from('reservations')
                .update({
                    status: 'completed',
                    check_out_time: new Date().toISOString()
                })
                .eq('customer_id', customer_id)
                .in('status', ['checked-in', 'confirmed']);
            if (resError) throw resError;

            if (customer?.name) {
                const { error: chaletError } = await supabase
                    .from('chalet_bookings')
                    .update({ status: 'checked_out' })
                    .ilike('customer_name', customer.name.trim())
                    .in('status', ['checked_in', 'confirmed']);
                if (chaletError) throw chaletError;
            }

            return NextResponse.json({ success: true });
        }

        // mode === 'pay' (default): settle every outstanding charge, but
        // leave the reservation/chalet booking status untouched so the guest
        // stays checked in until Check Out is explicitly used.
        if (!payment_method) {
            return NextResponse.json({ error: 'Payment method is required' }, { status: 400 });
        }

        const { error: resError } = await supabase
            .from('reservations')
            .update({ payment_status: 'paid' })
            .eq('customer_id', customer_id)
            .in('status', ['checked-in', 'confirmed']);
        if (resError) throw resError;

        if (customer?.name) {
            const { error: chaletError } = await supabase
                .from('chalet_bookings')
                .update({ payment_status: 'paid' })
                .ilike('customer_name', customer.name.trim())
                .in('status', ['checked_in', 'confirmed']);
            if (chaletError) throw chaletError;
        }

        const { error: ordError } = await supabase
            .from('orders')
            .update({ status: 'paid' })
            .eq('customer_id', customer_id)
            .in('status', ['open', 'billed']);
        if (ordError) throw ordError;

        const { error: svcError } = await supabase
            .from('service_incomes')
            .update({
                payment_status: 'paid',
                payment_method: payment_method
            })
            .eq('customer_id', customer_id)
            .eq('payment_status', 'add_to_bill');
        if (svcError) throw svcError;

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
