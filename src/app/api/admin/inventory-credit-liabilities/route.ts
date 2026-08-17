import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function PATCH(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const payload = await verifyToken(token) as any;
        if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { source, source_id, settled = true } = await request.json();
        if (!['po', 'grn'].includes(source) || !source_id) {
            return NextResponse.json({ error: 'A valid liability source and reference are required.' }, { status: 400 });
        }

        const userId = payload.userId || payload.id || payload.sub;
        const settlement = settled
            ? { liability_settled_at: new Date().toISOString(), liability_settled_by: userId }
            : { liability_settled_at: null, liability_settled_by: null };

        const query = source === 'po'
            ? supabase.from('purchase_orders').update(settlement).eq('id', source_id).eq('payment_type', 'credit')
            : supabase.from('inventory_transactions').update(settlement).eq('grn_number', source_id).eq('payment_type', 'credit').is('purchase_order_id', null);

        const { error } = await query;
        if (error) throw error;

        return NextResponse.json({ success: true, settled });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
