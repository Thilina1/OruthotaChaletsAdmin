import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function GET(request: Request, { params }: { params: { id: string } }) {
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
            .eq('id', params.id)
            .single();

        if (error) throw error;
        return NextResponse.json({ purchase_order: data }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const body = await request.json();
        const { status, supplier_name, notes, item_prices } = body;

        // Update PO header
        const updatePayload: any = { updated_at: new Date().toISOString() };
        if (status) updatePayload.status = status;
        if (supplier_name !== undefined) updatePayload.supplier_name = supplier_name;
        if (notes !== undefined) updatePayload.notes = notes;

        const { data: po, error: poError } = await supabase
            .from('purchase_orders')
            .update(updatePayload)
            .eq('id', params.id)
            .select()
            .single();

        if (poError) throw poError;

        // Update item prices if provided (when receiving goods)
        if (item_prices && Array.isArray(item_prices)) {
            for (const item of item_prices) {
                const total = item.unit_price && item.quantity
                    ? Number(item.unit_price) * Number(item.quantity)
                    : null;
                await supabase
                    .from('purchase_order_items')
                    .update({ unit_price: item.unit_price || null, total_price: total })
                    .eq('id', item.id);
            }
        }

        return NextResponse.json({ purchase_order: po }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { error } = await supabase
            .from('purchase_orders')
            .delete()
            .eq('id', params.id);

        if (error) throw error;
        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
