import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getUserId() {
    const token = (await cookies()).get('auth_token')?.value;
    if (!token) return null;
    const payload = await verifyToken(token);
    return payload?.userId as string | undefined;
}

export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data, error } = await supabase
            .from('notifications')
            .select('id, title, message, href, type, read_at, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(30);

        if (error) throw error;
        return NextResponse.json({
            notifications: data ?? [],
            unread_count: (data ?? []).filter(notification => !notification.read_at).length,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id, mark_all } = await request.json();
        let query = supabase
            .from('notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('user_id', userId)
            .is('read_at', null);

        if (!mark_all) {
            if (!id) return NextResponse.json({ error: 'Notification id is required.' }, { status: 400 });
            query = query.eq('id', id);
        }

        // Approval notifications stay unread until the related PO is approved
        // or rejected. The PO update endpoint resolves them for all recipients.
        query = query
            .neq('type', 'purchase_order_approval')
            .neq('type', 'chalet_booking')
            .neq('type', 'buffet_booking')
            .neq('type', 'general_inquiry')
            .neq('type', 'inventory_cash_issuance')
            .neq('type', 'leave_approval')
            .neq('type', 'kitchen_order')
            .neq('type', 'restaurant_billing')
            .neq('type', 'confirmed_restaurant_bill');

        const { error } = await query;
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
