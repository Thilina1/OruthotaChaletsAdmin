import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET → { titles: { [department]: string[] } }
//   ?withIds=1 → { rows: { id, department, title }[] }
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const withIds = searchParams.get('withIds') === '1';

    const { data, error } = await supabase
        .from('job_titles')
        .select('id, department, title')
        .order('department')
        .order('sort_order')
        .order('title');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (withIds) {
        return NextResponse.json({ rows: data ?? [] });
    }

    const map: Record<string, string[]> = {};
    for (const row of data ?? []) {
        if (!map[row.department]) map[row.department] = [];
        map[row.department].push(row.title);
    }

    return NextResponse.json({ titles: map });
}

// POST { department, title } → add a title
export async function POST(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const user = token ? await verifyToken(token) : null;
    if (!user || user.role !== 'admin') {
        return NextResponse.json({ error: 'Admins only' }, { status: 403 });
    }

    const { department, title } = await request.json();
    if (!department?.trim() || !title?.trim()) {
        return NextResponse.json({ error: 'department and title are required' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('job_titles')
        .insert([{ department: department.trim(), title: title.trim() }])
        .select()
        .single();

    if (error) {
        if (error.code === '23505') {
            return NextResponse.json({ error: 'This title already exists for that department' }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ jobTitle: data }, { status: 201 });
}

// PATCH { id, title } → rename a title
//      { department, newDepartment } → rename a whole department
export async function PATCH(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const user = token ? await verifyToken(token) : null;
    if (!user || user.role !== 'admin') {
        return NextResponse.json({ error: 'Admins only' }, { status: 403 });
    }

    const body = await request.json();

    // Rename a single title
    if (body.id && body.title) {
        const { data, error } = await supabase
            .from('job_titles')
            .update({ title: body.title.trim() })
            .eq('id', body.id)
            .select()
            .single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ jobTitle: data });
    }

    // Rename a whole department
    if (body.department && body.newDepartment) {
        const { error } = await supabase
            .from('job_titles')
            .update({ department: body.newDepartment.trim() })
            .eq('department', body.department);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
}

// DELETE { id } → remove a title
export async function DELETE(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const user = token ? await verifyToken(token) : null;
    if (!user || user.role !== 'admin') {
        return NextResponse.json({ error: 'Admins only' }, { status: 403 });
    }

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { error } = await supabase.from('job_titles').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
}
