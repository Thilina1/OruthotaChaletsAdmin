import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function auth() {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return false;
    return !!(await verifyToken(token));
}

// GET /api/admin/app-settings?key=restaurant_warehouse_ids
export async function GET(request: Request) {
    if (!(await auth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 });

    const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', key)
        .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ value: data?.value ?? null }, { status: 200 });
}

// PUT /api/admin/app-settings  body: { key, value }
export async function PUT(request: Request) {
    if (!(await auth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { key, value } = await request.json();
    if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 });

    const { error } = await supabase
        .from('app_settings')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true }, { status: 200 });
}
