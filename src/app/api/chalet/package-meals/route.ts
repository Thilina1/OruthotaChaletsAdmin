import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const prefix = (bookingId: string) => `Package Meal|${bookingId}|`;

async function authenticate() {
  const token = (await cookies()).get('auth_token')?.value;
  return !!token && !!(await verifyToken(token));
}

export async function GET(request: Request) {
  try {
    if (!(await authenticate())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const bookingId = new URL(request.url).searchParams.get('booking_id');
    if (!bookingId) return NextResponse.json({ error: 'booking_id is required' }, { status: 400 });
    const { data: orders, error } = await supabase.from('orders').select('*').like('waiter_name', `${prefix(bookingId)}%`).order('created_at');
    if (error) throw error;
    const ids = (orders || []).map(order => order.id);
    const { data: items, error: itemError } = ids.length
      ? await supabase.from('order_items').select('*').in('order_id', ids).order('created_at')
      : { data: [], error: null };
    if (itemError) throw itemError;
    return NextResponse.json({ orders: orders || [], items: items || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!(await authenticate())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { booking_id, meal_type, service_date, items = [], extras = [] } = await request.json();
    if (!booking_id || !['breakfast', 'lunch', 'dinner'].includes(meal_type) || !service_date || (!Array.isArray(items) && !Array.isArray(extras))) {
      return NextResponse.json({ error: 'Booking, included meal, date, and food items are required' }, { status: 400 });
    }
    const { data: booking, error: bookingError } = await supabase.from('chalet_bookings')
      .select('*,chalet_packages(includes_breakfast,includes_lunch,includes_dinner),chalet_rooms(room_number)')
      .eq('id', booking_id).eq('status', 'checked_in').single();
    if (bookingError || !booking) return NextResponse.json({ error: 'The guest is not currently checked in' }, { status: 409 });
    if (service_date < booking.check_in_date || service_date >= booking.check_out_date) {
      return NextResponse.json({ error: 'Meal date must be within the checked-in stay' }, { status: 400 });
    }
    const pkg = Array.isArray(booking.chalet_packages) ? booking.chalet_packages[0] : booking.chalet_packages;
    if (!pkg?.[`includes_${meal_type}`]) return NextResponse.json({ error: `${meal_type} is not included in this package` }, { status: 400 });
    const room = Array.isArray(booking.chalet_rooms) ? booking.chalet_rooms[0] : booking.chalet_rooms;
    const menuIds = [...items, ...extras].map((item: any) => item.menu_item_id).filter(Boolean);
    const { data: menu } = menuIds.length ? await supabase.from('menu_items').select('id,name,price').in('id', menuIds) : { data: [] };
    const menuMap = new Map((menu || []).map(item => [item.id, item]));
    const validItems = items.map((item: any) => ({ menu_item_id: item.menu_item_id, name: menuMap.get(item.menu_item_id), quantity: Math.max(0, Number(item.quantity) || 0) })).filter((item: any) => item.name && item.quantity > 0);
    validItems.forEach((item: any) => { item.name = item.name.name; });
    const validExtras = extras.map((item: any, index: number) => {
      const menuItem: any = item.menu_item_id ? menuMap.get(item.menu_item_id) : null;
      return { key: item.menu_item_id || `custom-${String(item.name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}-${index}`, name: menuItem?.name || String(item.name || '').trim(), quantity: Math.max(0, Number(item.quantity) || 0), unit_price: menuItem ? Number(menuItem.price || 0) : Math.max(0, Number(item.unit_price) || 0) };
    }).filter((item: any) => item.name && item.quantity > 0 && item.unit_price >= 0);
    if (!validItems.length && !validExtras.length) return NextResponse.json({ error: 'Select included food or add at least one chargeable extra' }, { status: 400 });
    const { data: customer } = await supabase.from('customers').select('id').ilike('name', booking.customer_name.trim()).limit(1).maybeSingle();
    if (validExtras.length && !customer) return NextResponse.json({ error: 'A checked-in customer record is required for chargeable extras' }, { status: 409 });
    const ticketItems = [...validItems.map((item: any) => ({ ...item, extra: false, key: item.menu_item_id })), ...validExtras.map((item: any) => ({ ...item, extra: true }))];
    const identity = `${prefix(booking_id)}${service_date}|${meal_type}|${room?.room_number || 'Unassigned'}`;
    const { data: duplicate } = await supabase.from('orders').select('id').eq('waiter_name', identity).maybeSingle();
    if (duplicate) return NextResponse.json({ error: `This ${meal_type} request has already been confirmed for the selected date` }, { status: 409 });

    const createdOrderIds: string[] = [];
    try {
      const { data: order, error } = await supabase.from('orders').insert({ status: 'open', total_price: 0, table_number: null, waiter_name: identity, customer_id: customer?.id || null }).select().single();
      if (error) throw error;
      createdOrderIds.push(order.id);
      // One KOT per meal, containing all included and extra food lines.
      const { error: itemError } = await supabase.from('order_items').insert(ticketItems.map((item: any) => ({ order_id: order.id, menu_item_id: null, name: item.extra ? `${item.name} (Extra)` : item.name, price: item.extra ? item.unit_price : 0, quantity: item.quantity, kitchen_status: 'pending' })));
      if (itemError) throw itemError;
      if (validExtras.length) {
        const extraTotal = validExtras.reduce((sum: number, item: any) => sum + item.quantity * item.unit_price, 0);
        const { error: chargeError } = await supabase.from('service_incomes').insert({ description: `${meal_type} chargeable food extras [PackageMeal:${order.id}]`, amount: extraTotal, service_type: 'Package Meal Extra', date: service_date, customer_name: booking.customer_name, customer_id: customer!.id, room_number: room?.room_number ? `Chalet ${room.room_number}` : null, payment_status: 'add_to_bill', payment_method: null, line_items: validExtras.map((item: any) => ({ description: `${item.name} × ${item.quantity} @ LKR ${item.unit_price.toFixed(2)}`, amount: item.quantity * item.unit_price })) });
        if (chargeError) throw chargeError;
      }
      return NextResponse.json({ order_id: order.id }, { status: 201 });
    } catch (error) {
      if (createdOrderIds.length) await supabase.from('orders').delete().in('id', createdOrderIds);
      throw error;
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!(await authenticate())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    const orderIds = Array.isArray(body.order_ids) ? body.order_ids.filter(Boolean) : body.order_id ? [body.order_id] : [];
    if (!orderIds.length) return NextResponse.json({ error: 'Package meal request is required' }, { status: 400 });
    const { data: orders } = await supabase.from('orders').select('id,waiter_name').in('id', orderIds).like('waiter_name', 'Package Meal|%');
    if (!orders || orders.length !== orderIds.length) return NextResponse.json({ error: 'One or more package meal requests were not found' }, { status: 404 });
    const groupKeys = new Set(orders.map(order => order.waiter_name.split('|').slice(0, 5).join('|')));
    if (groupKeys.size !== 1) return NextResponse.json({ error: 'Only one meal group can be delivered at a time' }, { status: 400 });
    const { data: items, error } = await supabase.from('order_items').select('id,order_id,quantity,kitchen_status').in('order_id', orderIds);
    if (error) throw error;
    if (!items?.length || items.some(item => !['ready', 'done'].includes(item.kitchen_status))) return NextResponse.json({ error: 'Kitchen must mark every item ready before room delivery' }, { status: 409 });
    for (const item of items) await supabase.from('order_items').update({ served_quantity: item.quantity, kitchen_status: 'done' }).eq('id', item.id);
    await supabase.from('orders').update({ status: 'closed', updated_at: new Date().toISOString() }).in('id', orderIds);
    return NextResponse.json({ delivered: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!(await authenticate())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const searchParams = new URL(request.url).searchParams;
    const itemId = searchParams.get('item_id');
    if (itemId) {
      const { data: item } = await supabase.from('order_items').select('id,order_id,name,price,quantity,kitchen_status,prepared_quantity,order:orders(id,waiter_name,status)').eq('id', itemId).maybeSingle();
      const itemOrder: any = Array.isArray((item as any)?.order) ? (item as any).order[0] : (item as any)?.order;
      if (!item || !itemOrder?.waiter_name?.startsWith('Package Meal|')) return NextResponse.json({ error: 'Package meal item was not found' }, { status: 404 });
      if (itemOrder.status !== 'open' || item.kitchen_status !== 'pending' || Number(item.prepared_quantity || 0) > 0) {
        return NextResponse.json({ error: 'This food cannot be removed because Kitchen has already started preparing it' }, { status: 409 });
      }
      const groupKey = itemOrder.waiter_name.split('|').slice(0, 5).join('|');
      const [, bookingId, serviceDate, mealType] = groupKey.split('|');
      const { data: groupOrders } = await supabase.from('orders').select('id').like('waiter_name', `${groupKey}%`);
      const groupOrderIds = (groupOrders || []).map(order => order.id);
      const { error: deleteError } = await supabase.from('order_items').delete().eq('id', itemId);
      if (deleteError) throw deleteError;
      const { count } = await supabase.from('order_items').select('id', { count: 'exact', head: true }).eq('order_id', item.order_id);
      if (!count) await supabase.from('orders').delete().eq('id', item.order_id);

      const { data: remaining } = groupOrderIds.length
        ? await supabase.from('order_items').select('name,price,quantity').in('order_id', groupOrderIds)
        : { data: [] };
      const remainingExtras = (remaining || []).filter(row => Number(row.price || 0) > 0 || String(row.name).includes('(Extra)'));
      const { data: booking } = await supabase.from('chalet_bookings').select('customer_name').eq('id', bookingId).maybeSingle();
      if (booking?.customer_name) {
        const { data: customer } = await supabase.from('customers').select('id').ilike('name', booking.customer_name.trim()).limit(1).maybeSingle();
        if (customer) {
          let chargeQuery = supabase.from('service_incomes').delete().eq('customer_id', customer.id).eq('date', serviceDate).eq('service_type', 'Package Meal Extra').eq('payment_status', 'add_to_bill').ilike('description', `${mealType} chargeable food extras%`);
          if (remainingExtras.length) {
            const amount = remainingExtras.reduce((sum, row) => sum + Number(row.price || 0) * Number(row.quantity || 0), 0);
            const line_items = remainingExtras.map(row => ({ description: `${String(row.name).replace(/\s*\(Extra\)$/, '')} × ${row.quantity} @ LKR ${Number(row.price || 0).toFixed(2)}`, amount: Number(row.price || 0) * Number(row.quantity || 0) }));
            const { error } = await supabase.from('service_incomes').update({ amount, line_items, updated_at: new Date().toISOString() }).eq('customer_id', customer.id).eq('date', serviceDate).eq('service_type', 'Package Meal Extra').eq('payment_status', 'add_to_bill').ilike('description', `${mealType} chargeable food extras%`);
            if (error) throw error;
          } else {
            const { error } = await chargeQuery;
            if (error) throw error;
          }
        }
      }
      return NextResponse.json({ removed: true });
    }

    const orderIds = (searchParams.get('order_ids') || '').split(',').filter(Boolean);
    if (!orderIds.length) return NextResponse.json({ error: 'Package meal request is required' }, { status: 400 });
    const { data: orders } = await supabase.from('orders').select('id,waiter_name,status').in('id', orderIds).like('waiter_name', 'Package Meal|%');
    if (!orders || orders.length !== orderIds.length) return NextResponse.json({ error: 'One or more package meal requests were not found' }, { status: 404 });
    const groupKeys = new Set(orders.map(order => order.waiter_name.split('|').slice(0, 5).join('|')));
    if (groupKeys.size !== 1) return NextResponse.json({ error: 'Only one meal group can be removed at a time' }, { status: 400 });
    const { data: items, error: itemError } = await supabase.from('order_items').select('kitchen_status,prepared_quantity').in('order_id', orderIds);
    if (itemError) throw itemError;
    if (orders.some(order => order.status !== 'open') || items?.some(item => item.kitchen_status !== 'pending' || Number(item.prepared_quantity || 0) > 0)) {
      return NextResponse.json({ error: 'This meal cannot be removed because Kitchen has already started preparing it' }, { status: 409 });
    }

    const [firstKey] = Array.from(groupKeys);
    const [, bookingId, serviceDate, mealType] = firstKey.split('|');
    const { data: booking } = await supabase.from('chalet_bookings').select('customer_name').eq('id', bookingId).maybeSingle();
    if (booking?.customer_name) {
      const { data: customer } = await supabase.from('customers').select('id').ilike('name', booking.customer_name.trim()).limit(1).maybeSingle();
      if (customer) {
        const { error: chargeError } = await supabase.from('service_incomes').delete()
          .eq('customer_id', customer.id).eq('date', serviceDate).eq('service_type', 'Package Meal Extra')
          .eq('payment_status', 'add_to_bill').ilike('description', `${mealType} chargeable food extras%`);
        if (chargeError) throw chargeError;
      }
    }
    const { error } = await supabase.from('orders').delete().in('id', orderIds);
    if (error) throw error;
    return NextResponse.json({ removed: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
