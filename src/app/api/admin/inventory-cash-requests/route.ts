import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';
import { format } from 'date-fns';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getUser(userId: string) {
    const { data } = await supabase.from('users').select('id, role, restrict_admin_permissions, inventory_admin').eq('id', userId).single();
    return data;
}

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const payload = await verifyToken(token) as any;
        if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const statusFilter = searchParams.get('status');

        const dbUser = await getUser(payload.userId);
        const isAdmin = dbUser?.role === 'admin' && !dbUser?.restrict_admin_permissions;
        const isInventoryAdmin = dbUser?.inventory_admin === true;
        const isPayment = dbUser?.role === 'payment';

        let query = supabase
            .from('inventory_cash_requests')
            .select(`
                *,
                requested_by_user:users!inventory_cash_requests_requested_by_fkey(id, name, email, department),
                approved_by_user:users!inventory_cash_requests_approved_by_fkey(id, name, email),
                issued_by_user:users!inventory_cash_requests_issued_by_fkey(id, name, email),
                purchase_order:purchase_orders(id, po_number, supplier_name)
            `)
            .order('created_at', { ascending: false });

        // ?view=all — return all requests; any authenticated user may request this.
        // Page-level access control (route-config / section-groups) decides who can
        // reach the pages that pass this flag. Without it, scope to the logged-in user.
        const viewAll = searchParams.get('view') === 'all';
        if (!viewAll) {
            query = query.eq('requested_by', payload.userId);
        }

        if (statusFilter) {
            query = query.eq('status', statusFilter);
        }

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json({ requests: data ?? [] });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const payload = await verifyToken(token) as any;
        if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const body = await request.json();
        const { purchase_order_id, purpose, requested_amount, notes } = body;

        if (!purpose?.trim()) {
            return NextResponse.json({ error: 'Purpose is required' }, { status: 400 });
        }
        if (!requested_amount || Number(requested_amount) <= 0) {
            return NextResponse.json({ error: 'Requested amount must be greater than 0' }, { status: 400 });
        }

        const dateStr = format(new Date(), 'yyyyMMdd');
        const { count } = await supabase
            .from('inventory_cash_requests')
            .select('*', { count: 'exact', head: true })
            .like('request_number', `CR-${dateStr}%`);
        const seq = String((count ?? 0) + 1).padStart(3, '0');
        const request_number = `CR-${dateStr}-${seq}`;

        const { data, error } = await supabase
            .from('inventory_cash_requests')
            .insert({
                request_number,
                purchase_order_id: purchase_order_id || null,
                purpose: purpose.trim(),
                requested_amount: Number(requested_amount),
                notes: notes?.trim() || null,
                status: 'PENDING',
                requested_by: payload.userId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ request: data }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
