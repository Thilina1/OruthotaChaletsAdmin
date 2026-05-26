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
        const customer_id = searchParams.get('customer_id');

        if (!customer_id) {
            return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
        }

        // 1. Get Customer Info
        const { data: customer, error: customerError } = await supabase
            .from('customers')
            .select('*')
            .eq('id', customer_id)
            .single();

        if (customerError) throw customerError;

        // 2. Get Reservations for this customer that are not completed/cancelled
        const { data: reservations } = await supabase
            .from('reservations')
            .select(`
                *,
                room:rooms(title)
            `)
            .eq('customer_id', customer_id)
            .in('status', ['checked-in', 'confirmed']);

        // 3. Get unpaid Orders (status = billed or open)
        const { data: orders } = await supabase
            .from('orders')
            .select('*')
            .eq('customer_id', customer_id)
            .in('status', ['open', 'billed']);

        // 4. Get unpaid Service Incomes
        const { data: serviceIncomes } = await supabase
            .from('service_incomes')
            .select('*')
            .eq('customer_id', customer_id)
            .eq('payment_status', 'add_to_bill');

        // Calculate totals
        let totalOutstanding = 0;
        
        reservations?.forEach(res => {
            if (res.total_cost) totalOutstanding += Number(res.total_cost);
        });

        orders?.forEach(ord => {
            if (ord.total_price) totalOutstanding += Number(ord.total_price);
        });

        serviceIncomes?.forEach(inc => {
            if (inc.amount) totalOutstanding += Number(inc.amount);
        });

        return NextResponse.json({
            bill: {
                customer,
                reservations: reservations || [],
                orders: orders || [],
                serviceIncomes: serviceIncomes || [],
                totalOutstanding,
                totalPaid: 0 // We can calculate paid items in future if needed
            }
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
