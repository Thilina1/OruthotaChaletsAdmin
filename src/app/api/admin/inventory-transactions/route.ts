import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth-utils';

export async function GET(req: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const itemId = searchParams.get('itemId');
    const limit = parseInt(searchParams.get('limit') || '50');

    try {
        let query = supabase
            .from('inventory_transactions')
            .select(`
                *,
                item:hotel_inventory_items(name, unit, category),
                user:users(id, name)
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (type) {
            const types = type.split(',');
            query = query.in('transaction_type', types);
        }

        if (itemId) {
            query = query.eq('item_id', itemId);
        }

        const { data, error } = await query;

        if (error) throw error;

        return NextResponse.json({ transactions: data });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
