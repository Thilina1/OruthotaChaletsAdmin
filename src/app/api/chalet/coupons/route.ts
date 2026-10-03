import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!);

async function requireAuth() {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return false;
    return verifyToken(token);
}

function normalizeCouponPayload(body: any) {
    const discountType = body.discount_type === 'percentage' ? 'percentage' : 'fixed';
    return {
        code: String(body.code || '').trim().toUpperCase(),
        name: body.name || null,
        description: body.description || null,
        discount_type: discountType,
        discount_value: Math.max(0, Number(body.discount_value || 0)),
        max_discount_amount: discountType === 'percentage' && Number(body.max_discount_amount || 0) > 0 ? Number(body.max_discount_amount) : null,
        min_bill_amount: Math.max(0, Number(body.min_bill_amount || 0)),
        max_bill_amount: Number(body.max_bill_amount || 0) > 0 ? Number(body.max_bill_amount) : null,
        valid_from: body.valid_from || null,
        valid_to: body.valid_to || null,
        max_usage: Number(body.max_usage || 0) > 0 ? Number(body.max_usage) : null,
        is_active: body.is_active !== false,
    };
}

export async function GET() {
    try {
        if (!(await requireAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const [{ data: coupons, error }, { data: bookings, error: bookingError }] = await Promise.all([
            supabase.from('chalet_coupons').select('*').order('created_at', { ascending: false }),
            supabase.from('chalet_bookings').select('coupon_id, status').not('coupon_id', 'is', null),
        ]);
        if (error) throw error;
        if (bookingError) throw bookingError;

        const usage = new Map<string, number>();
        (bookings || []).forEach(booking => {
            if (!booking.coupon_id || booking.status === 'cancelled') return;
            usage.set(booking.coupon_id, (usage.get(booking.coupon_id) || 0) + 1);
        });

        return NextResponse.json({
            coupons: (coupons || []).map(coupon => ({ ...coupon, used_count: usage.get(coupon.id) || 0 })),
        }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        if (!(await requireAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const payload = normalizeCouponPayload(await request.json());
        if (!payload.code) return NextResponse.json({ error: 'Coupon code is required' }, { status: 400 });
        if (payload.discount_value <= 0) return NextResponse.json({ error: 'Discount value must be greater than zero' }, { status: 400 });

        const { data, error } = await supabase.from('chalet_coupons').insert(payload).select('*').single();
        if (error) throw error;
        return NextResponse.json({ coupon: data }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        if (!(await requireAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        if (!body.id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        const payload = { ...normalizeCouponPayload(body), updated_at: new Date().toISOString() };
        if (!payload.code) return NextResponse.json({ error: 'Coupon code is required' }, { status: 400 });
        if (payload.discount_value <= 0) return NextResponse.json({ error: 'Discount value must be greater than zero' }, { status: 400 });

        const { data, error } = await supabase.from('chalet_coupons').update(payload).eq('id', body.id).select('*').single();
        if (error) throw error;
        return NextResponse.json({ coupon: data }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        if (!(await requireAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        const { error } = await supabase.from('chalet_coupons').delete().eq('id', id);
        if (error) throw error;
        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
