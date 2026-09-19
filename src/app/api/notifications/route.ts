import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!
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

        const fields = 'id, title, message, href, type, read_at, created_at, inventory_request_id';
        const [other, rejections] = await Promise.all([
            supabase.from('notifications').select(fields).eq('user_id', userId)
                .or('type.neq.mrn_result,title.neq.MRN Rejected').order('created_at', { ascending: false }).limit(30),
            supabase.from('notifications').select(fields, { count: 'exact' }).eq('user_id', userId)
                .eq('type', 'mrn_result').eq('title', 'MRN Rejected').is('read_at', null)
                .order('created_at', { ascending: false }).limit(1),
        ]);
        const error = other.error || rejections.error;
        if (error) throw error;
        const notifications: any[] = (other.data || []).filter(item =>
            !(item.type === 'inventory_cash_request' && item.read_at)
        );
        const latest = rejections.data?.[0];
        if (latest) {
            const count = rejections.count || 1;
            notifications.push({
                ...latest,
                id: 'mrn-rejections',
                inventory_request_id: null,
                rejection_through: latest.created_at,
                title: 'MRN Rejections',
                message: `${count} MRN request${count === 1 ? ' has' : 's have'} been rejected. Click to view the details.`,
                read_at: null,
            });
        }
        notifications.sort((a, b) => b.created_at.localeCompare(a.created_at));
        return NextResponse.json({ notifications, unread_count: notifications.filter(item => !item.read_at).length });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id, mark_all, rejection_through } = await request.json();
        let query = supabase
            .from('notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('user_id', userId)
            .is('read_at', null);

        if (!mark_all) {
            if (!id) return NextResponse.json({ error: 'Notification id is required.' }, { status: 400 });
            if (id === 'mrn-rejections') {
                if (typeof rejection_through !== 'string' || !Number.isFinite(Date.parse(rejection_through))) {
                    return NextResponse.json({ error: 'A valid notification timestamp is required.' }, { status: 400 });
                }
                query = query.eq('type', 'mrn_result').eq('title', 'MRN Rejected')
                    .lte('created_at', rejection_through);
            } else {
                query = query.eq('id', id);
            }
        }

        // Approval notifications stay unread until the related PO is approved
        // or rejected. The PO update endpoint resolves them for all recipients.
        query = query
            .neq('type', 'purchase_order_approval')
            .neq('type', 'chalet_booking')
            .neq('type', 'buffet_booking')
            .neq('type', 'experience_inquiry')
            .neq('type', 'general_inquiry')
            .neq('type', 'inventory_cash_issuance')
            .neq('type', 'leave_approval')
            .neq('type', 'kitchen_order')
            .neq('type', 'restaurant_billing')
            .neq('type', 'confirmed_restaurant_bill');
        query = query.neq('type', 'mrn_approval');

        const { error } = await query;
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
