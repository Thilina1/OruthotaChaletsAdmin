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

export async function GET() {
    if (!(await auth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ accounts: data });
}

export async function POST(request: Request) {
    if (!(await auth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { name, type, account_number, opening_balance = 0, description } = await request.json();
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    const balance = Number(opening_balance);
    const { data, error } = await supabase
        .from('accounts')
        .insert({ name, type: type || 'bank', account_number, opening_balance: balance, current_balance: balance, description })
        .select()
        .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ account: data }, { status: 201 });
}

export async function PUT(request: Request) {
    if (!(await auth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id, name, type, account_number, description, is_active } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    const { data, error } = await supabase
        .from('accounts')
        .update({ name, type, account_number, description, is_active, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ account: data });
}

export async function DELETE(request: Request) {
    if (!(await auth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    const { error } = await supabase.from('accounts').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
