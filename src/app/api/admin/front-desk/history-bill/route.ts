import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function GET(request: Request) {
  try {
    const token = (await cookies()).get('auth_token')?.value;
    if (!token || !(await verifyToken(token))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const params = new URL(request.url).searchParams;
    const type = params.get('type');
    const recordId = params.get('record_id');
    if (!recordId || !['reservation', 'chalet'].includes(type || '')) {
      return NextResponse.json({ error: 'A valid history record is required.' }, { status: 400 });
    }

    let stay: any;
    let customer: any = null;
    let stayItem: any;
    if (type === 'reservation') {
      const { data, error } = await supabase.from('reservations').select('*,room:rooms(title,room_number)').eq('id', recordId).single();
      if (error) throw error;
      stay = data;
      if (stay.customer_id) {
        const result = await supabase.from('customers').select('*').eq('id', stay.customer_id).single();
        customer = result.data;
      }
      stayItem = { description: `Room: ${stay.room?.title || stay.room?.room_number || 'Room'}`, amount: Number(stay.total_cost || 0), category: 'Room' };
    } else {
      const { data, error } = await supabase.from('chalet_bookings').select('*,chalet_rooms(name,room_number),chalet_packages(name)').eq('id', recordId).single();
      if (error) throw error;
      stay = data;
      const result = await supabase.from('customers').select('*').ilike('name', stay.customer_name.trim()).limit(1).maybeSingle();
      customer = result.data;
      stayItem = { description: `Chalet ${stay.chalet_rooms?.room_number || ''}: ${stay.chalet_packages?.name || stay.chalet_rooms?.name || 'Stay'}`, amount: Number(stay.grand_total || 0), category: 'Chalet' };
    }

    const from = `${stay.check_in_date}T00:00:00`;
    const to = `${stay.check_out_date}T23:59:59`;
    if (customer?.id) {
      const snapshotResult = await supabase
        .from('guest_bill_history')
        .select('*')
        .eq('customer_id', customer.id)
        .gte('paid_at', from)
        .lte('paid_at', to)
        .order('paid_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!snapshotResult.error && snapshotResult.data) {
        return NextResponse.json({ bill: {
          number: snapshotResult.data.bill_number,
          customer,
          check_in_date: stay.check_in_date,
          check_out_date: stay.check_out_date,
          payment_status: 'paid',
          payment_method: snapshotResult.data.payment_method,
          paid_at: snapshotResult.data.paid_at,
          items: snapshotResult.data.items || [],
          total: Number(snapshotResult.data.total || 0),
        } });
      }
    }
    let orders: any[] = [];
    let services: any[] = [];
    if (customer?.id) {
      const [orderResult, serviceResult] = await Promise.all([
        supabase.from('orders').select('*').eq('customer_id', customer.id).eq('status', 'paid').gte('created_at', from).lte('created_at', to),
        supabase.from('service_incomes').select('*').eq('customer_id', customer.id).eq('payment_status', 'paid').gte('date', stay.check_in_date).lte('date', stay.check_out_date),
      ]);
      if (orderResult.error) throw orderResult.error;
      if (serviceResult.error) throw serviceResult.error;
      orders = orderResult.data || [];
      services = serviceResult.data || [];
    }

    const items = [
      stayItem,
      ...orders.map((order) => ({ description: `Restaurant Order #${order.id.slice(0, 8).toUpperCase()}`, amount: Number(order.total_price || 0), category: 'Restaurant' })),
      ...services.map((service) => ({ description: `${service.service_type}: ${service.description}`, amount: Number(service.amount || 0), category: service.service_type, line_items: service.line_items || [] })),
    ];
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    const paymentMethod = services.find((service) => service.payment_method)?.payment_method || stay.payment_method || null;

    return NextResponse.json({ bill: {
      number: `${type === 'reservation' ? 'RES' : 'CH'}-${recordId.slice(0, 8).toUpperCase()}`,
      customer: customer || { name: stay.guest_name || stay.customer_name },
      check_in_date: stay.check_in_date,
      check_out_date: stay.check_out_date,
      payment_status: stay.payment_status || 'paid',
      payment_method: paymentMethod,
      items,
      total,
    } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load past bill.' }, { status: 500 });
  }
}
