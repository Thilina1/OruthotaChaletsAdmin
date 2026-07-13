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
        .from('expense_categories')
        .select('*')
        .order('group_name')
        .order('name');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ categories: data });
}

export async function POST(request: Request) {
    if (!(await auth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { name, group_name } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    const { data, error } = await supabase
        .from('expense_categories')
        .insert({ name: name.trim(), group_name: group_name?.trim() || 'Custom' })
        .select()
        .single();
    if (error) {
        if (error.code === '23505') return NextResponse.json({ error: 'Category already exists' }, { status: 409 });
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ category: data }, { status: 201 });
}

export async function DELETE(request: Request) {
    if (!(await auth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    // Prevent deleting system categories
    const { data: cat } = await supabase.from('expense_categories').select('is_system').eq('id', id).single();
    if (cat?.is_system) return NextResponse.json({ error: 'Cannot delete system categories' }, { status: 403 });

    const { error } = await supabase.from('expense_categories').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
