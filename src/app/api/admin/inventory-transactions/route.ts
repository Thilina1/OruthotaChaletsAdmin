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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '500');

    try {
        let query = supabase
            .from('inventory_transactions')
            .select(`
                *,
                item:inventory_items(
                    id, 
                    name, 
                    description,
                    category:inventory_categories(id, name),
                    unit:inventory_units(id, name)
                ),
                batch:inventory_batches(
                    id,
                    batch_number,
                    expiry_date,
                    supplier,
                    buying_price
                ),
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

        if (startDate) {
            // Ensure full day coverage if it's just a date string
            const startStr = startDate.includes('T') ? startDate : `${startDate}T00:00:00.000Z`;
            query = query.gte('created_at', startStr);
        }

        if (endDate) {
            // Ensure full day coverage
            const endStr = endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`;
            query = query.lte('created_at', endStr);
        }

        const { data, error } = await query;

        if (error) throw error;

        return NextResponse.json({ transactions: data });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
