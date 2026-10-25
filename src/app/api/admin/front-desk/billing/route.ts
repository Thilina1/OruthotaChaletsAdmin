import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';
import { chaletBillBreakdown, chaletOutstandingLkr, chaletPaidLkr, chaletPaymentHistory, chaletTotalLkr } from '@/lib/chalet-billing';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!);

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
            const [customersResult, reservationsResult, chaletResult, ratesResult, ordersResult, servicesResult] = await Promise.all([
                supabase.from('customers').select('*'),
                supabase.from('reservations').select('customer_id,total_cost,payment_status,check_out_date,room:rooms(room_number,title)').in('status', ['checked-in', 'confirmed']),
                supabase.from('chalet_bookings').select('*').in('status', ['checked_in', 'confirmed']),
                supabase.from('chalet_rates').select('package_id,room_category_id,occupancy_type_id,usd_to_lkr_rate'),
                supabase.from('orders').select('customer_id,total_price,confirmed_total').in('status', ['open', 'billed', 'room_charge']).not('waiter_name', 'like', 'Package Meal|%'),
                supabase.from('service_incomes').select('customer_id,amount').eq('payment_status', 'add_to_bill'),
            ]);
            const firstError = [customersResult.error, reservationsResult.error, chaletResult.error, ratesResult.error, ordersResult.error, servicesResult.error].find(Boolean);
            if (firstError) throw firstError;

            const checkoutDates = new Map<string, string[]>();
            const addCheckoutDate = (id: string | null, date: string | null) => {
                if (id && date) checkoutDates.set(id, [...(checkoutDates.get(id) || []), date.slice(0, 10)]);
            };
            const totals = new Map<string, number>();
            // Rooms/chalets each customer is staying in, for the list and the search.
            const roomLabels = new Map<string, string[]>();
            const addRoom = (id: string | null, label: string | null | undefined) => {
                if (id && label && !(roomLabels.get(id) || []).includes(label)) roomLabels.set(id, [...(roomLabels.get(id) || []), label]);
            };
            // Keep checked-in guests available in Find Customer Bill even
            // after payment reduces their balance to zero. They still need
            // to remain selectable for printing and the separate checkout
            // step, and should disappear only once their stay is checked out.
            const activeStayCustomerIds = new Set<string>();
            const add = (id: string | null, amount: unknown) => {
                if (id) totals.set(id, (totals.get(id) || 0) + Number(amount || 0));
            };
            reservationsResult.data?.forEach((item: any) => {
                addCheckoutDate(item.customer_id, item.check_out_date);
                if (item.customer_id) activeStayCustomerIds.add(item.customer_id);
                const room = Array.isArray(item.room) ? item.room[0] : item.room;
                addRoom(item.customer_id, room?.room_number ? `Room ${room.room_number}` : room?.title);
                if (item.payment_status !== 'paid') add(item.customer_id, item.total_cost);
            });
            ordersResult.data?.forEach((item: any) => add(item.customer_id, item.confirmed_total ?? item.total_price));
            servicesResult.data?.forEach((item: any) => add(item.customer_id, item.amount));

            const customersByName = new Map((customersResult.data || []).map((customer: any) => [customer.name?.trim().toLowerCase(), customer.id]));
            const chaletRoomIds = (item: any): string[] => Array.from(new Set([
                ...(Array.isArray(item.room_allocations) ? item.room_allocations.map((a: any) => a?.roomId ?? a?.room_id) : []),
                ...(Array.isArray(item.room_ids) ? item.room_ids : []),
                item.room_id,
            ].filter(Boolean)));
            const allChaletRoomIds = Array.from(new Set((chaletResult.data || []).flatMap(chaletRoomIds)));
            const { data: chaletRooms } = allChaletRoomIds.length
                ? await supabase.from('chalet_rooms').select('id,room_number').in('id', allChaletRoomIds)
                : { data: [] as any[] };
            const chaletRoomNumber = new Map((chaletRooms || []).map((room: any) => [room.id, room.room_number]));
            chaletResult.data?.forEach((item: any) => {
                const customerId = customersByName.get(item.customer_name?.trim().toLowerCase()) || null;
                addCheckoutDate(customerId, item.check_out_date);
                if (customerId) activeStayCustomerIds.add(customerId);
                chaletRoomIds(item).forEach(roomId => {
                    const number = chaletRoomNumber.get(roomId);
                    if (number) addRoom(customerId, `Chalet ${number}`);
                });
                add(customerId, chaletOutstandingLkr(item, ratesResult.data || []));
            });

            const customers = (customersResult.data || [])
                .filter((customer: any) => (totals.get(customer.id) || 0) > 0 || activeStayCustomerIds.has(customer.id))
                // Search matches name, ID, phone, email or room ("01", "Chalet 01", "Room 12").
                .filter((customer: any) => !search || [customer.name, customer.id_number, customer.phone, customer.email, ...(roomLabels.get(customer.id) || [])]
                    .some((value) => String(value || '').toLowerCase().includes(search)))
                .map((customer: any) => ({ ...customer, rooms: roomLabels.get(customer.id) || [], checkout_dates: checkoutDates.get(customer.id) || [], outstanding_total: totals.get(customer.id) || 0 }))
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
        const [{ data: chaletBookings }, { data: chaletRates }] = await Promise.all([
            supabase
            .from('chalet_bookings')
            .select(`
                *,
                chalet_packages ( name ),
                chalet_occupancy_types ( name ),
                chalet_rooms ( name, room_number )
            `)
            .ilike('customer_name', customer.name.trim())
            .in('status', ['checked_in', 'confirmed']),
            supabase.from('chalet_rates').select('package_id,room_category_id,occupancy_type_id,usd_to_lkr_rate'),
        ]);

        // 3. Get unpaid Orders (status = billed or open)
        const { data: orderRows } = await supabase
            .from('orders')
            .select('*')
            .eq('customer_id', customer_id)
            .in('status', ['open', 'billed', 'room_charge'])
            .not('waiter_name', 'like', 'Package Meal|%');

        // Items on each order, shown on the bill and the printed order bill.
        const orderIds = (orderRows || []).map(ord => ord.id);
        const { data: orderItemRows } = orderIds.length > 0
            ? await supabase.from('order_items').select('id,order_id,name,price,quantity').in('order_id', orderIds)
            : { data: [] as any[] };
        const orders = (orderRows || []).map(ord => ({
            ...ord,
            items: (orderItemRows || []).filter((item: any) => item.order_id === ord.id),
        }));

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

        // Chalet charges are the bill minus anything already paid (deposits
        // taken in the booking form or online), all in LKR.
        // Payments taken against these bookings in the booking form (tolerates
        // the table not existing before its migration is applied).
        const chaletIds = (chaletBookings || []).map(cb => cb.id);
        const { data: chaletPaymentRows, error: chaletPaymentsError } = chaletIds.length > 0
            ? await supabase
                .from('chalet_booking_payments')
                .select('id,booking_id,amount,payment_method,paid_at,account:accounts(name)')
                .in('booking_id', chaletIds)
                .order('paid_at', { ascending: true })
            : { data: [], error: null };
        const paymentsByBooking = new Map<string, any[]>();
        (chaletPaymentsError ? [] : chaletPaymentRows || []).forEach((payment: any) => {
            paymentsByBooking.set(payment.booking_id, [...(paymentsByBooking.get(payment.booking_id) || []), payment]);
        });

        const chaletBookingsWithBalance = (chaletBookings || []).map(cb => {
            const paidLkr = chaletPaidLkr(cb, chaletRates || []);
            const payments = chaletPaymentHistory(cb, paymentsByBooking.get(cb.id) || [], chaletRates || []);
            return {
                ...cb,
                bill_total_lkr_resolved: chaletTotalLkr(cb, chaletRates || []),
                paid_lkr: paidLkr,
                outstanding_lkr: chaletOutstandingLkr(cb, chaletRates || []),
                bill_breakdown: chaletBillBreakdown(cb, chaletRates || []),
                payments,
            };
        });
        chaletBookingsWithBalance.forEach(cb => {
            totalOutstanding += cb.outstanding_lkr;
        });

        orders?.forEach(ord => {
            if (ord.confirmed_total ?? ord.total_price) totalOutstanding += Number(ord.confirmed_total ?? ord.total_price);
        });

        serviceIncomes?.forEach(inc => {
            if (inc.amount) totalOutstanding += Number(inc.amount);
        });

        return NextResponse.json({
            bill: {
                customer,
                reservations: reservations || [],
                chaletBookings: chaletBookingsWithBalance,
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
