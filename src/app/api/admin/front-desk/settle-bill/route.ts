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

        // Capture the complete bill before changing any live record statuses.
        const [reservationsDue, chaletsDue, ordersDue, servicesDue] = await Promise.all([
            supabase.from('reservations').select('*,room:rooms(title,room_number)').eq('customer_id', customer_id).in('status', ['checked-in', 'confirmed']),
            customer?.name
                ? supabase.from('chalet_bookings').select('*,chalet_rooms(name,room_number),chalet_packages(name)').ilike('customer_name', customer.name.trim()).in('status', ['checked_in', 'confirmed'])
                : Promise.resolve({ data: [], error: null } as any),
            supabase.from('orders').select('*').eq('customer_id', customer_id).in('status', ['open', 'billed']),
            supabase.from('service_incomes').select('*').eq('customer_id', customer_id).eq('payment_status', 'add_to_bill'),
        ]);
        const snapshotItems = [
            ...(reservationsDue.data || []).filter((item: any) => item.payment_status !== 'paid').map((item: any) => ({ category: 'Room', description: `Room: ${item.room?.title || item.room?.room_number || 'Room'}`, amount: Number(item.total_cost || 0), source_id: item.id })),
            ...(chaletsDue.data || []).filter((item: any) => item.payment_status !== 'paid').map((item: any) => ({ category: 'Chalet', description: `Chalet ${item.chalet_rooms?.room_number || ''}: ${item.chalet_packages?.name || item.chalet_rooms?.name || 'Stay'}`, amount: Number(item.grand_total || 0), source_id: item.id })),
            ...(ordersDue.data || []).map((item: any) => ({ category: 'Restaurant', description: `Restaurant Order #${item.id.slice(0, 8).toUpperCase()}`, amount: Number(item.total_price || 0), source_id: item.id, breakdown: item.bill_breakdown || null })),
            ...(servicesDue.data || []).map((item: any) => ({ category: item.service_type, description: `${item.service_type}: ${item.description}`, amount: Number(item.amount || 0), source_id: item.id, line_items: item.line_items || [] })),
        ];
        const snapshotTotal = snapshotItems.reduce((sum: number, item: any) => sum + item.amount, 0);
        if (snapshotItems.length > 0) {
            const billNumber = `GB-${Date.now()}-${customer_id.slice(0, 6).toUpperCase()}`;
            const { error: historyError } = await supabase.from('guest_bill_history').insert({
                bill_number: billNumber,
                customer_id,
                total: snapshotTotal,
                payment_method,
                items: snapshotItems,
            });
            // Keep payments working before this migration is deployed; all
            // other history errors are real and should stop settlement.
            if (historyError && !/guest_bill_history.*schema cache|relation.*does not exist/i.test(historyError.message || '')) throw historyError;
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
