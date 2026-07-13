import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
    const [itemsRes, sectionsRes] = await Promise.all([
        supabase
            .from('menu_items')
            .select('*')
            .order('name'),
        supabase
            .from('menu_sections')
            .select('*')
            .order('name'),
    ]);

    if (itemsRes.error) {
        return NextResponse.json({ error: itemsRes.error.message }, { status: 500 });
    }

    return NextResponse.json({
        menuItems: itemsRes.data ?? [],
        menuSections: sectionsRes.data ?? [],
    });
}

export async function POST(request: Request) {
    const body = await request.json();
    const { data, error } = await supabase
        .from('menu_items')
        .insert([{ ...body, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }])
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data });
}

export async function PATCH(request: Request) {
    const body = await request.json();
    const { id, ...rest } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { data, error } = await supabase
        .from('menu_items')
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data });
}
