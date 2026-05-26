import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

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
        const { customer_id, payment_method } = body;

        if (!customer_id || !payment_method) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // We will update everything for this customer to "paid" / "completed"

        // 1. Update Reservations
        const { error: resError } = await supabase
            .from('reservations')
            .update({ 
                status: 'completed',
                check_out_time: new Date().toISOString()
            })
            .eq('customer_id', customer_id)
            .in('status', ['checked-in', 'confirmed']);
        if (resError) throw resError;

        // 2. Update Orders
        const { error: ordError } = await supabase
            .from('orders')
            .update({ status: 'paid' })
            .eq('customer_id', customer_id)
            .in('status', ['open', 'billed']);
        if (ordError) throw ordError;

        // 3. Update Service Incomes
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
