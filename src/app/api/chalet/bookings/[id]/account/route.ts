import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';
import { chaletBillBreakdown, chaletPaymentHistory } from '@/lib/chalet-billing';
import { serviceInvoiceNumber } from '@/lib/utils';

// Reservation account (ledger) for one chalet booking: accommodation charges
// and payments, the guest's restaurant orders and extra services during the
// stay, and the Front Desk bills that settled them. All amounts in LKR.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!);

type LedgerRow = {
    date: string | null;
    invNo: string | null;
    // Title of the invoice the row belongs to (rows sharing an invoice number
    // are shown as one line, with the full bill on request).
    group?: string;
    description: string;
    details?: string[];
    tax: number | null;
    debit: number;
    credit: number;
};

const round2 = (value: number) => Math.round(value * 100) / 100;
const addDays = (date: string, days: number) => {
    const value = new Date(`${date.slice(0, 10)}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
};
const methodLabel = (method?: string | null) => (method ? method.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()) : '');

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const token = (await cookies()).get('auth_token')?.value;
        if (!token || !(await verifyToken(token))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { id } = await params;

        const { data: booking, error: bookingError } = await supabase
            .from('chalet_bookings')
            .select('*, chalet_rooms ( name, room_number )')
            .eq('id', id)
            .maybeSingle();
        if (bookingError) throw bookingError;
        if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

        const [{ data: rates }, { data: paymentRows, error: paymentsError }] = await Promise.all([
            supabase.from('chalet_rates').select('package_id,room_category_id,occupancy_type_id,usd_to_lkr_rate'),
            supabase.from('chalet_booking_payments').select('id,amount,payment_method,paid_at,account:accounts(name)').eq('booking_id', id).order('paid_at', { ascending: true }),
        ]);

        // ── Accommodation ──────────────────────────────────────────────────
        const accommodation: LedgerRow[] = [];
        const breakdown = chaletBillBreakdown(booking, rates || []);
        if (breakdown) {
            const nights = Math.max(1, breakdown.nights || 1);
            const group = `Accommodation — ${nights} night${nights === 1 ? '' : 's'}`;
            const perNight = round2(breakdown.subtotal / nights);
            for (let night = 0; night < nights; night += 1) {
                // The last night takes any rounding difference.
                const amount = night === nights - 1 ? round2(breakdown.subtotal - perNight * (nights - 1)) : perNight;
                accommodation.push({
                    date: addDays(booking.check_in_date, night),
                    invNo: booking.booking_ref,
                    group,
                    description: `Room charge — night ${night + 1} of ${nights}`,
                    tax: null,
                    debit: amount,
                    credit: 0,
                });
            }
            if (breakdown.coupon_discount > 0) {
                accommodation.push({
                    date: booking.check_in_date,
                    invNo: booking.booking_ref,
                    group,
                    description: `Coupon discount${breakdown.coupon_code ? ` (${breakdown.coupon_code})` : ''}`,
                    tax: null,
                    debit: 0,
                    credit: breakdown.coupon_discount,
                });
            }
            breakdown.charges.forEach(charge => accommodation.push({
                date: booking.check_in_date,
                invNo: booking.booking_ref,
                group,
                description: `${charge.label} (${charge.pct}%)`,
                tax: charge.amount,
                debit: charge.amount,
                credit: 0,
            }));
        }
        chaletPaymentHistory(booking, paymentsError ? [] : paymentRows || [], rates || []).forEach(payment => accommodation.push({
            date: payment.paid_at,
            invNo: null,
            description: `${payment.label}${payment.payment_method ? ` — ${methodLabel(payment.payment_method)}` : ''}`,
            details: payment.account_name ? [`Account: ${payment.account_name}`] : undefined,
            tax: null,
            debit: 0,
            credit: payment.amount,
        }));

        // ── Guest's customer records (orders and services are linked to them) ──
        // Chalet bookings store the guest's details, not a customer id. The
        // guest can have more than one customer record (same ID number or
        // same name), and charges can sit on any of them, as on the Front
        // Desk bill.
        const nic = String(booking.customer_nic || '').trim();
        const guestName = String(booking.customer_name || '').trim();
        const [{ data: byNic }, { data: byName }] = await Promise.all([
            nic ? supabase.from('customers').select('id,name,created_at').eq('id_number', nic) : Promise.resolve({ data: [] as any[] }),
            guestName ? supabase.from('customers').select('id,name,created_at').ilike('name', guestName) : Promise.resolve({ data: [] as any[] }),
        ]);
        const guestRecords = [...(byNic || []), ...(byName || [])]
            .filter((record: any, index, all) => all.findIndex((other: any) => other.id === record.id) === index)
            .sort((a: any, b: any) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
        const customer = guestRecords[0] ? { id: guestRecords[0].id, name: guestRecords[0].name } : null;
        const customerIds = guestRecords.map((record: any) => record.id);

        const restaurant: LedgerRow[] = [];
        const services: LedgerRow[] = [];
        let receipts: { bill_number: string; date: string; payment_method: string | null; total: number }[] = [];

        if (customer) {
            // During the stay: from the arrival day to the day after departure,
            // or up to today while the guest is still in house (a stay can run
            // past its booked departure, and its charges are still billed).
            const active = ['checked_in', 'confirmed'].includes(booking.status);
            const today = new Date().toISOString().slice(0, 10);
            const lastDay = active && today > booking.check_out_date.slice(0, 10) ? today : booking.check_out_date.slice(0, 10);
            const from = `${booking.check_in_date}T00:00:00`;
            const to = `${addDays(lastDay, 1)}T00:00:00`;
            const [ordersRes, servicesRes, billsRes] = await Promise.all([
                supabase.from('orders').select('*').in('customer_id', customerIds).gte('created_at', from).lt('created_at', to).order('created_at', { ascending: true }),
                supabase.from('service_incomes').select('*').in('customer_id', customerIds).gte('date', booking.check_in_date).lte('date', addDays(lastDay, 1)).order('date', { ascending: true }),
                supabase.from('guest_bill_history').select('bill_number,total,payment_method,paid_at').in('customer_id', customerIds).gte('paid_at', from).order('paid_at', { ascending: true }),
            ]);

            const orders = (ordersRes.data || []).filter((order: any) => order.status !== 'cancelled' && !String(order.waiter_name || '').startsWith('Package Meal|'));
            const orderIds = orders.map((order: any) => order.id);
            const { data: items } = orderIds.length
                ? await supabase.from('order_items').select('order_id,name,price,quantity').in('order_id', orderIds)
                : { data: [] as any[] };
            orders.forEach((order: any) => {
                const total = Number(order.confirmed_total ?? order.total_price ?? 0);
                const breakdownRow = order.bill_breakdown || {};
                const orderNo = order.bill_number || `#${String(order.id).slice(0, 8).toUpperCase()}`;
                const orderItems = (items || []).filter((item: any) => item.order_id === order.id);
                const group = `Restaurant bill${order.table_number ? ` — Table ${order.table_number}` : ''}`;
                restaurant.push({
                    date: order.created_at,
                    invNo: orderNo,
                    group,
                    description: `Food & beverage${orderItems.length ? ` (${orderItems.length} item${orderItems.length === 1 ? '' : 's'})` : ''}`,
                    details: [
                        ...orderItems.map((item: any) => `${item.quantity} × ${item.name} @ ${Number(item.price || 0).toFixed(2)}`),
                        ...(Number(breakdownRow.service_charge_total || 0) > 0 ? [`Service charge ${Number(breakdownRow.service_charge_total).toFixed(2)}`] : []),
                        ...(Number(breakdownRow.discount_total || 0) > 0 ? [`Discount −${Number(breakdownRow.discount_total).toFixed(2)}`] : []),
                    ],
                    tax: Number(breakdownRow.vat_amount || 0) || null,
                    debit: total,
                    credit: 0,
                });
                // Paid at the restaurant (closed) or settled at the Front Desk (paid).
                if (order.status === 'paid' || order.status === 'closed') {
                    restaurant.push({
                        date: order.updated_at || order.created_at,
                        invNo: orderNo,
                        group,
                        description: order.status === 'paid' ? 'Paid — Front Desk settlement' : 'Paid at restaurant',
                        tax: null,
                        debit: 0,
                        credit: total,
                    });
                }
            });

            (servicesRes.data || []).forEach((service: any) => {
                // Buffets sit with the restaurant, and other charges and
                // discounts on the stay with the accommodation.
                const target = service.service_type === 'Buffet'
                    ? restaurant
                    : service.service_type === 'Other' || service.service_type === 'Discount' ? accommodation : services;
                const amount = Number(service.amount || 0);
                const invNo = serviceInvoiceNumber(service);
                const group = `${service.service_type}${service.description ? `: ${service.description}` : ''}`;
                target.push({
                    date: service.date || service.created_at,
                    invNo,
                    group,
                    description: `${service.service_type}${service.description ? `: ${service.description}` : ''}`,
                    details: Array.isArray(service.line_items) ? service.line_items.map((line: any) => `${line.description}: ${Number(line.amount || 0).toFixed(2)}`) : undefined,
                    tax: null,
                    debit: amount > 0 ? amount : 0,
                    credit: amount < 0 ? Math.abs(amount) : 0,
                });
                if (service.payment_status === 'paid' && amount > 0) {
                    target.push({
                        date: service.updated_at || service.date || service.created_at,
                        invNo,
                        group,
                        description: `Paid${service.payment_method ? ` — ${methodLabel(service.payment_method)}` : ''}`,
                        tax: null,
                        debit: 0,
                        credit: amount,
                    });
                }
            });

            if (!billsRes.error) {
                receipts = (billsRes.data || []).map((bill: any) => ({
                    bill_number: bill.bill_number,
                    date: bill.paid_at,
                    payment_method: bill.payment_method || null,
                    total: Number(bill.total || 0),
                }));
            }
        }

        const byDate = (a: LedgerRow, b: LedgerRow) => String(a.date || '').localeCompare(String(b.date || ''));
        return NextResponse.json({
            customer,
            tabs: [
                { key: 'accommodation', label: 'Accommodation', rows: accommodation },
                { key: 'restaurant', label: 'Restaurant', rows: restaurant.sort(byDate) },
                { key: 'services', label: 'Services', rows: services.sort(byDate) },
            ],
            receipts,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
