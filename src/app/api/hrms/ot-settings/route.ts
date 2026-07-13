import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function auth() {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    return verifyToken(token);
}

const DEFAULT_SETTINGS = {
    calculation_method: 'multiplier',
    ot_multiplier: 1.5,
    flat_rate_per_hour: 0,
    standard_hours_per_day: 8,
    requires_manager_approval: true,
};

export async function GET() {
    if (!(await auth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data, error } = await supabase
        .from('ot_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ settings: data ?? DEFAULT_SETTINGS });
}

export async function POST(request: Request) {
    const user = await auth();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 });

    const body = await request.json();
    const { calculation_method, ot_multiplier, flat_rate_per_hour, standard_hours_per_day, requires_manager_approval, max_ot_hours_per_month } = body;

    // Upsert the single settings row
    const { data: existing } = await supabase.from('ot_settings').select('id').limit(1).maybeSingle();
    const payload = {
        calculation_method,
        ot_multiplier: Number(ot_multiplier),
        flat_rate_per_hour: Number(flat_rate_per_hour),
        standard_hours_per_day: Number(standard_hours_per_day),
        requires_manager_approval: Boolean(requires_manager_approval),
        max_ot_hours_per_month: Number(max_ot_hours_per_month ?? 0),
        updated_at: new Date().toISOString(),
    };

    let result;
    if (existing?.id) {
        result = await supabase.from('ot_settings').update(payload).eq('id', existing.id).select().single();
    } else {
        result = await supabase.from('ot_settings').insert(payload).select().single();
    }
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    return NextResponse.json({ settings: result.data });
}
