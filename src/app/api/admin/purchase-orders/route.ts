import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';
import { format } from 'date-fns';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { data, error } = await supabase
            .from('purchase_orders')
            .select(`
                *,
                created_by_user:users!purchase_orders_created_by_fkey (name, email),
                purchase_order_items (*)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return NextResponse.json({ purchase_orders: data }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const payload = await verifyToken(token);
        if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const body = await request.json();
        const { supplier_name, notes, items, request_ids } = body;

        if (!items || items.length === 0) {
            return NextResponse.json({ error: 'At least one item is required.' }, { status: 400 });
        }

        // Generate PO number: PO-YYYYMMDD-XXX
        const dateStr = format(new Date(), 'yyyyMMdd');
        const { count } = await supabase
            .from('purchase_orders')
            .select('*', { count: 'exact', head: true })
            .like('po_number', `PO-${dateStr}%`);
        const seq = String((count ?? 0) + 1).padStart(3, '0');
        const po_number = `PO-${dateStr}-${seq}`;

        // Create the PO
        const { data: po, error: poError } = await supabase
            .from('purchase_orders')
            .insert({
                po_number,
                supplier_name: supplier_name || null,
                notes: notes || null,
                status: 'draft',
                created_by: (payload as any).userId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (poError) throw poError;

        // Insert items
        const itemRows = items.map((item: any) => ({
            po_id: po.id,
            item_id: item.item_id || null,
            item_name: item.item_name,
            unit: item.unit || 'units',
            quantity: Number(item.quantity),
            unit_price: null,
            total_price: null,
        }));

        const { error: itemsError } = await supabase
            .from('purchase_order_items')
            .insert(itemRows);

        if (itemsError) throw itemsError;

        // Stamp originating inventory requests with this PO id so they cannot be reused
        if (request_ids && Array.isArray(request_ids) && request_ids.length > 0) {
            await supabase
                .from('inventory_requests')
                .update({ purchase_order_id: po.id })
                .in('id', request_ids);
        }

        return NextResponse.json({ purchase_order: po }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
