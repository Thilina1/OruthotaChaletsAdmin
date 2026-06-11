import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    const supabase = await createClient();
    try {
        const { data, error } = await supabase
            .from('working_calendars')
            .select('*')
            .order('year', { ascending: false })
            .order('name');
        if (error) throw error;
        return NextResponse.json({ calendars: data });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const supabase = await createClient();
    try {
        const { name, description, year } = await request.json();
        const { data, error } = await supabase
            .from('working_calendars')
            .insert([{ name, description: description || null, year, is_active: true }])
            .select()
            .single();
        if (error) throw error;
        return NextResponse.json({ calendar: data });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const supabase = await createClient();
    try {
        const { id, name, description, year, is_active } = await request.json();
        const { data, error } = await supabase
            .from('working_calendars')
            .update({ name, description: description || null, year, is_active, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return NextResponse.json({ calendar: data });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const supabase = await createClient();
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
        const { error } = await supabase.from('working_calendars').delete().eq('id', id);
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
