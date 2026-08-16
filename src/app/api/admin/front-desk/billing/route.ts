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
        const outstanding = searchParams.get('outstanding') === 'true';

        if (outstanding) {
            const search = (searchParams.get('search') || '').trim().toLowerCase();
            const [customersResult, reservationsResult, chaletResult, ordersResult, servicesResult] = await Promise.all([
                supabase.from('customers').select('*'),
                supabase.from('reservations').select('customer_id,total_cost,payment_status').in('status', ['checked-in', 'confirmed']),
                supabase.from('chalet_bookings').select('customer_name,grand_total,payment_status').in('status', ['checked_in', 'confirmed']),
                supabase.from('orders').select('customer_id,total_price').in('status', ['open', 'billed']),
                supabase.from('service_incomes').select('customer_id,amount').eq('payment_status', 'add_to_bill'),
            ]);
            const firstError = [customersResult.error, reservationsResult.error, chaletResult.error, ordersResult.error, servicesResult.error].find(Boolean);
            if (firstError) throw firstError;

            const totals = new Map<string, number>();
            const add = (id: string | null, amount: unknown) => {
                if (id) totals.set(id, (totals.get(id) || 0) + Number(amount || 0));
            };
            reservationsResult.data?.forEach((item: any) => {
                if (item.payment_status !== 'paid') add(item.customer_id, item.total_cost);
            });
            ordersResult.data?.forEach((item: any) => add(item.customer_id, item.total_price));
            servicesResult.data?.forEach((item: any) => add(item.customer_id, item.amount));

            const customersByName = new Map((customersResult.data || []).map((customer: any) => [customer.name?.trim().toLowerCase(), customer.id]));
            chaletResult.data?.forEach((item: any) => {
                if (item.payment_status !== 'paid') add(customersByName.get(item.customer_name?.trim().toLowerCase()) || null, item.grand_total);
            });

            const customers = (customersResult.data || [])
                .filter((customer: any) => (totals.get(customer.id) || 0) > 0)
                .filter((customer: any) => !search || [customer.name, customer.id_number, customer.phone, customer.email]
                    .some((value) => String(value || '').toLowerCase().includes(search)))
                .map((customer: any) => ({ ...customer, outstanding_total: totals.get(customer.id) || 0 }))
                .sort((a: any, b: any) => b.outstanding_total - a.outstanding_total);

            return NextResponse.json({ customers });
        }

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

        // 2b. Get Chalet Bookings for this customer. Chalet bookings aren't
        // linked by customer_id (they store the guest's details directly), so
        // match by name instead.
        const { data: chaletBookings } = await supabase
            .from('chalet_bookings')
            .select(`
                *,
                chalet_packages ( name ),
                chalet_occupancy_types ( name ),
                chalet_rooms ( name, room_number )
            `)
            .ilike('customer_name', customer.name.trim())
            .in('status', ['checked_in', 'confirmed']);

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

        // Calculate totals. Room/chalet charges only count as outstanding
        // until they're marked paid — Check Out is a separate step from
        // paying, so an already-paid stay shouldn't re-appear as owed.
        let totalOutstanding = 0;

        reservations?.forEach(res => {
            if (res.total_cost && res.payment_status !== 'paid') totalOutstanding += Number(res.total_cost);
        });

        chaletBookings?.forEach(cb => {
            if (cb.grand_total && cb.payment_status !== 'paid') totalOutstanding += Number(cb.grand_total);
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
                chaletBookings: chaletBookings || [],
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
