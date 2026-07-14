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
        // Note: do NOT embed users via join — inventory_transactions has multiple FKs to users
        // (created_by and action_by), which causes Supabase to throw an ambiguity error.
        // Resolve user names with a separate query instead.
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
                )
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (type) {
            query = query.in('transaction_type', type.split(','));
        }
        if (itemId) {
            query = query.eq('item_id', itemId);
        }
        if (startDate) {
            const startStr = startDate.includes('T') ? startDate : `${startDate}T00:00:00.000Z`;
            query = query.gte('created_at', startStr);
        }
        if (endDate) {
            const endStr = endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`;
            query = query.lte('created_at', endStr);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Resolve user names in one batched lookup
        const userIds = [...new Set((data ?? []).map((r: any) => r.created_by).filter(Boolean))];
        let userMap: Record<string, string> = {};
        if (userIds.length > 0) {
            const { data: users } = await supabase
                .from('users')
                .select('id, name')
                .in('id', userIds);
            for (const u of users ?? []) userMap[u.id] = u.name;
        }

        // Resolve warehouse names for department_id and reference_department
        const whIds = [...new Set([
            ...(data ?? []).map((r: any) => r.department_id),
            ...(data ?? []).map((r: any) => r.reference_department),
        ].filter(Boolean))];
        let whMap: Record<string, string> = {};
        if (whIds.length > 0) {
            const { data: whs } = await supabase
                .from('inventory_warehouses')
                .select('id, name')
                .in('id', whIds);
            for (const w of whs ?? []) whMap[w.id] = w.name;
        }

        const transactions = (data ?? []).map((r: any) => {
            const isHIM = typeof r.remarks === 'string' && r.remarks.startsWith('[HIM]');
            return {
                ...r,
                remarks: isHIM ? r.remarks.replace(/^\[HIM\]\s*/, '') : r.remarks,
                from_him: isHIM,
                user: r.created_by ? { id: r.created_by, name: userMap[r.created_by] ?? '—' } : null,
                warehouse_name: r.department_id ? (whMap[r.department_id] ?? null) : null,
                reference_warehouse_name: r.reference_department ? (whMap[r.reference_department] ?? null) : null,
            };
        });

        return NextResponse.json({ transactions });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
