import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const verifiedUser = token ? await verifyToken(token) : null;
    if (!verifiedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
        .from('apit_tax_bands')
        .select('*')
        .order('sort_order');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ bands: data });
}

export async function POST(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const verifiedUser = token ? await verifyToken(token) : null;
    if (!verifiedUser || verifiedUser.role !== 'admin')
        return NextResponse.json({ error: 'Admins only' }, { status: 403 });

    const body = await request.json();
    const { id, band_label, min_income, max_income, rate, deduction, sort_order, effective_from } = body;

    const payload = {
        band_label,
        min_income: Number(min_income),
        max_income: max_income !== '' && max_income !== null ? Number(max_income) : null,
        rate: Number(rate),
        deduction: Number(deduction),
        sort_order: Number(sort_order ?? 0),
        effective_from: effective_from ?? '2025-04-01',
        updated_at: new Date().toISOString(),
    };

    const { data, error } = id
        ? await supabase.from('apit_tax_bands').update(payload).eq('id', id).select().single()
        : await supabase.from('apit_tax_bands').insert({ ...payload }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ band: data });
}

export async function DELETE(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const verifiedUser = token ? await verifyToken(token) : null;
    if (!verifiedUser || verifiedUser.role !== 'admin')
        return NextResponse.json({ error: 'Admins only' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { error } = await supabase.from('apit_tax_bands').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
