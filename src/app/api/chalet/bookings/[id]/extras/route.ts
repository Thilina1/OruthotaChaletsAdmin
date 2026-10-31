import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';
import { calcPackageCharges } from '@/lib/buffet-invoice';
import { getExperiencePricingDefaults } from '@/lib/experience-pricing';

// Extras on a chalet booking: experiences, services (laundry, transport,
// spa/pool) and buffet bookings added while booking or at check-in. Each is
// charged to the guest's room bill (service_incomes 'add_to_bill'), so it
// shows on the Front Desk bill and the booking Account, and also appears in
// its own section: Experience Inquiries, the Services pages, Buffet Bookings.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!);

const money = (value: number) => Math.round(value * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);
const SERVICE_TYPES = ['Laundry', 'Transport & Excursion', 'Spa/Pool'];

async function isAuthorized() {
    const token = (await cookies()).get('auth_token')?.value;
    return !!token && !!(await verifyToken(token));
}

// Columns from the booking-extras migration; inserts retry without them
// until it is applied, so extras still reach the room bill.
const LINK_COLUMNS = ['chalet_booking_id', 'table_booking_id'];
const missingLinkColumn = (error: any) => error && LINK_COLUMNS.some(column => String(error.message || '').includes(column));

async function insertRow(table: string, row: Record<string, any>) {
    let result = await supabase.from(table).insert(row).select().single();
    if (missingLinkColumn(result.error)) {
        const fallback = Object.fromEntries(Object.entries(row).filter(([key]) => !LINK_COLUMNS.includes(key)));
        result = await supabase.from(table).insert(fallback).select().single();
    }
    if (result.error) throw result.error;
    return result.data;
}

async function loadBooking(id: string) {
    const { data, error } = await supabase.from('chalet_bookings').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
}

// "Chalet 01" for the booking's first room, as on the Front Desk.
async function bookingRoomLabel(booking: any) {
    const ids = Array.from(new Set([
        ...(Array.isArray(booking.room_allocations) ? booking.room_allocations.map((a: any) => a?.roomId ?? a?.room_id) : []),
        ...(Array.isArray(booking.room_ids) ? booking.room_ids : []),
        booking.room_id,
    ].filter(Boolean)));
    if (ids.length === 0) return null;
    const { data } = await supabase.from('chalet_rooms').select('id,room_number').in('id', ids);
    const number = (data || []).find((room: any) => room.id === ids[0])?.room_number || data?.[0]?.room_number;
    return number ? `Chalet ${number}` : null;
}

// The guest's customer record: the one given (from check-in), else the
// oldest record with the booking's ID number or name, else a new one.
async function resolveCustomerId(booking: any, providedId?: string | null) {
    if (providedId) return providedId;
    const nic = String(booking.customer_nic || '').trim();
    const name = String(booking.customer_name || '').trim();
    for (const [column, value, exact] of [['id_number', nic, true], ['name', name, false]] as const) {
        if (!value) continue;
        let query = supabase.from('customers').select('id').order('created_at', { ascending: true }).limit(1);
        query = exact ? query.eq(column, value) : query.ilike(column, value);
        const { data } = await query;
        if (data?.[0]?.id) return data[0].id as string;
    }
    const { data, error } = await supabase.from('customers').insert({
        name: name || 'Guest',
        email: booking.customer_email || null,
        phone: booking.customer_phone || null,
        id_number: nic || null,
    }).select('id').single();
    if (error) throw error;
    return data.id as string;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        if (!(await isAuthorized())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { id } = await params;

        const { data, error } = await supabase
            .from('service_incomes')
            .select('id,invoice_number,service_type,description,amount,date,payment_status,payment_method,line_items,room_number,table_booking_id')
            .eq('chalet_booking_id', id)
            .order('created_at', { ascending: true });
        // Before the migration there is nothing linked to list yet.
        if (error && !missingLinkColumn(error) && !String(error.message || '').includes('invoice_number')) throw error;
        return NextResponse.json({ extras: error ? [] : data || [] });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        if (!(await isAuthorized())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { id } = await params;
        const body = await request.json();

        const experiences = (Array.isArray(body.experiences) ? body.experiences : [])
            .map((item: any) => ({ name: String(item.name || '').trim(), people: Number(item.people), rate: money(Number(item.rate) || 0) }))
            .filter((item: any) => item.name);
        const services = (Array.isArray(body.services) ? body.services : [])
            .map((item: any) => ({ service_type: String(item.service_type || ''), description: String(item.description || '').trim(), amount: money(Number(item.amount) || 0), master_id: item.master_id || undefined }))
            .filter((item: any) => item.description);
        const buffets = (Array.isArray(body.buffets) ? body.buffets : [])
            .map((item: any) => ({ date: String(item.date || ''), meal_type: String(item.meal_type || 'dinner'), guests: Number(item.guests), package_id: item.package_id || null, comments: String(item.comments || '').trim() || null }));

        if (experiences.some((item: any) => !Number.isInteger(item.people) || item.people < 1 || item.rate < 0)) {
            return NextResponse.json({ error: 'Each experience needs at least 1 person and a valid rate.' }, { status: 400 });
        }
        if (services.some((item: any) => !SERVICE_TYPES.includes(item.service_type) || item.amount < 0)) {
            return NextResponse.json({ error: 'Each service needs a valid service type and amount.' }, { status: 400 });
        }
        if (buffets.some((item: any) => !/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !Number.isInteger(item.guests) || item.guests < 1 || !['breakfast', 'lunch', 'dinner'].includes(item.meal_type))) {
            return NextResponse.json({ error: 'Each buffet needs a date, meal type and at least 1 guest.' }, { status: 400 });
        }
        if (experiences.length + services.length + buffets.length === 0) return NextResponse.json({ created: [] });

        const booking = await loadBooking(id);
        if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        const customerId = await resolveCustomerId(booking, body.customer_id ? String(body.customer_id) : null);
        const room = await bookingRoomLabel(booking);
        const customerName = String(booking.customer_name || '').trim() || 'Guest';
        const base = { customer_id: customerId, customer_name: customerName, room_number: room, payment_status: 'add_to_bill', payment_method: null, chalet_booking_id: id };
        const created: any[] = [];

        // ── Experiences: one confirmed inquiry and one bill for all of them ──
        if (experiences.length > 0) {
            const defaults = await getExperiencePricingDefaults(supabase);
            const serviceChargeRate = Number(defaults.service_charge_rate) || 0;
            const taxRate = Number(defaults.tax_rate) || 0;
            const baseAmount = money(experiences.reduce((sum: number, item: any) => sum + item.people * item.rate, 0));
            const serviceCharge = money(baseAmount * serviceChargeRate / 100);
            const tax = money((baseAmount + serviceCharge) * taxRate / 100);
            const total = money(baseAmount + serviceCharge + tax);
            const names = experiences.map((item: any) => item.name).join(', ');
            const people = Math.max(...experiences.map((item: any) => item.people));

            const inquiryRow = {
                name: customerName,
                email: booking.customer_email || null,
                phone: booking.customer_phone || null,
                subject: `Added on chalet booking ${booking.booking_ref || ''}`.trim(),
                message: null,
                inquiry_type: 'experience',
                experience_type: names,
                status: 'confirmed',
            };
            let inquiry = await supabase.from('contact_messages').insert({
                ...inquiryRow,
                customer_id: customerId,
                guest_count: people,
                experiences,
                pricing: { service_charge_rate: serviceChargeRate, tax_rate: taxRate, other_charges: [] },
            }).select('id').single();
            // Before the inquiry migrations, keep the basic inquiry.
            if (inquiry.error) inquiry = await supabase.from('contact_messages').insert(inquiryRow).select('id').single();
            if (inquiry.error) throw inquiry.error;

            const lineItems: any[] = [
                ...experiences.map((item: any) => ({ description: `${item.name} — ${item.people} ${item.people === 1 ? 'person' : 'people'} × LKR ${item.rate.toFixed(2)}`, amount: money(item.people * item.rate) })),
                ...(serviceChargeRate > 0 ? [{ description: `Service charge (${serviceChargeRate}%)`, amount: serviceCharge }] : []),
                ...(taxRate > 0 ? [{ description: `Tax (${taxRate}%)`, amount: tax }] : []),
            ];
            // Same metadata the Experience Inquiries bill stores, so the
            // inquiry shows as billed ("Payment Due") there.
            lineItems[0] = {
                ...lineItems[0],
                experience_inquiry_id: inquiry.data.id,
                pricing_breakdown: { people, price_per_person: experiences.length === 1 ? experiences[0].rate : null, experiences, base_amount: baseAmount, service_charge_rate: serviceChargeRate, service_charge: serviceCharge, tax_rate: taxRate, tax, other_charges: [], total },
            };
            created.push(await insertRow('service_incomes', {
                ...base,
                description: names,
                amount: total,
                service_type: 'Experience',
                date: today(),
                line_items: lineItems,
            }));
        }

        // ── Services: one bill per service type ──
        for (const serviceType of SERVICE_TYPES) {
            const items = services.filter((item: any) => item.service_type === serviceType);
            if (items.length === 0) continue;
            created.push(await insertRow('service_incomes', {
                ...base,
                description: items.map((item: any) => item.description).join(', '),
                amount: money(items.reduce((sum: number, item: any) => sum + item.amount, 0)),
                service_type: serviceType,
                date: today(),
                line_items: items.map((item: any) => ({ description: item.description, amount: item.amount, ...(item.master_id ? { master_id: item.master_id } : {}) })),
            }));
        }

        // ── Buffets: a buffet booking, and its total on the room bill ──
        if (buffets.length > 0) {
            const packageIds = Array.from(new Set(buffets.map((item: any) => item.package_id).filter(Boolean)));
            const { data: packages } = packageIds.length
                ? await supabase.from('buffet_packages').select('*, buffet_menu_items ( id, name, price, is_active )').in('id', packageIds)
                : { data: [] as any[] };
            for (const buffet of buffets) {
                const pkg = (packages || []).find((item: any) => item.id === buffet.package_id);
                const charges = pkg ? calcPackageCharges(pkg, buffet.guests) : null;
                const tableBooking = await insertRow('table_bookings', {
                    name: customerName,
                    email: booking.customer_email || '',
                    phone: booking.customer_phone || null,
                    date: buffet.date,
                    meal_type: buffet.meal_type,
                    guests: buffet.guests,
                    comments: buffet.comments || `Chalet booking ${booking.booking_ref || ''}${room ? ` · ${room}` : ''}`.trim(),
                    status: 'confirmed',
                    package_id: pkg?.id || null,
                    price_per_guest: charges?.perGuest ?? 0,
                    service_charge_amount: charges?.serviceChargeAmount ?? 0,
                    other_charge_amount: charges?.otherChargeAmount ?? 0,
                    vat_amount: charges?.vatAmount ?? 0,
                    total_amount: charges?.total ?? 0,
                    chalet_booking_id: id,
                });
                // A buffet without a package has no price yet: booking only.
                if (!pkg || !charges || charges.total <= 0) {
                    created.push({ table_booking: tableBooking });
                    continue;
                }
                const meal = buffet.meal_type.charAt(0).toUpperCase() + buffet.meal_type.slice(1);
                created.push(await insertRow('service_incomes', {
                    ...base,
                    description: `${pkg.name} — ${meal} buffet (${buffet.date})`,
                    amount: money(charges.total),
                    service_type: 'Buffet',
                    date: buffet.date,
                    table_booking_id: tableBooking.id,
                    line_items: [
                        { description: `${pkg.name} — ${buffet.guests} ${buffet.guests === 1 ? 'guest' : 'guests'} × LKR ${charges.perGuest.toFixed(2)}`, amount: money(charges.subtotal) },
                        ...(charges.serviceChargeAmount > 0 ? [{ description: `Service charge (${Number(pkg.service_charge_rate)}%)`, amount: money(charges.serviceChargeAmount) }] : []),
                        ...charges.otherChargeBreakdown.map((charge: any) => ({ description: charge.name, amount: money(charge.amount) })),
                        ...(charges.vatAmount > 0 ? [{ description: `VAT (${Number(pkg.vat_rate)}%)`, amount: money(charges.vatAmount) }] : []),
                    ],
                }));
            }
        }

        return NextResponse.json({ created, customer_id: customerId }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Failed to add extras.' }, { status: 500 });
    }
}

// Removes an extra that is still on the room bill (not yet paid), with the
// buffet booking or experience inquiry it created.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        if (!(await isAuthorized())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { id } = await params;
        const incomeId = new URL(request.url).searchParams.get('income_id');
        if (!incomeId) return NextResponse.json({ error: 'income_id is required' }, { status: 400 });

        const { data: income, error } = await supabase
            .from('service_incomes')
            .select('id,payment_status,table_booking_id,line_items')
            .eq('id', incomeId)
            .eq('chalet_booking_id', id)
            .maybeSingle();
        if (error) throw error;
        if (!income) return NextResponse.json({ error: 'Extra not found on this booking.' }, { status: 404 });
        if (income.payment_status !== 'add_to_bill') return NextResponse.json({ error: 'This extra has already been paid.' }, { status: 409 });

        if (income.table_booking_id) {
            await supabase.from('table_bookings').update({ status: 'cancelled' }).eq('id', income.table_booking_id);
        }
        const inquiryId = Array.isArray(income.line_items) ? income.line_items.find((line: any) => line.experience_inquiry_id)?.experience_inquiry_id : null;
        if (inquiryId) await supabase.from('contact_messages').update({ status: 'cancelled' }).eq('id', inquiryId);

        const { error: deleteError } = await supabase.from('service_incomes').delete().eq('id', incomeId);
        if (deleteError) throw deleteError;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
