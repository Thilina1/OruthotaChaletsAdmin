import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function adminAuth() {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'admin') return null;
    return payload;
}

// GET — returns all users with their limits
export async function GET() {
    if (!(await adminAuth())) return NextResponse.json({ error: 'Admins only' }, { status: 403 });

    const [usersRes, limitsRes] = await Promise.all([
        supabase.from('users').select('id, name, job_title, department').eq('is_active', true).order('name'),
        supabase.from('ot_user_limits').select('*'),
    ]);

    const limitMap = new Map((limitsRes.data ?? []).map(l => [l.user_id, l]));
    const result = (usersRes.data ?? []).map(u => ({
        ...u,
        limit_id: limitMap.get(u.id)?.id ?? null,
        max_ot_hours_per_month: limitMap.get(u.id)?.max_ot_hours_per_month ?? 0,
    }));

    return NextResponse.json({ users: result });
}

// POST — upsert limit for a user
export async function POST(request: Request) {
    if (!(await adminAuth())) return NextResponse.json({ error: 'Admins only' }, { status: 403 });

    const { user_id, max_ot_hours_per_month } = await request.json();
    if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

    const { data, error } = await supabase
        .from('ot_user_limits')
        .upsert({ user_id, max_ot_hours_per_month: Number(max_ot_hours_per_month) ?? 0, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ limit: data });
}
