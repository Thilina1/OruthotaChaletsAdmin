import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    const supabase = await createClient();
    try {
        const { data: schemes, error } = await supabase
            .from('leave_schemes')
            .select('*, leave_scheme_types(*)')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return NextResponse.json({ schemes });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const supabase = await createClient();
    try {
        const body = await request.json();
        const { name, description } = body;
        const { data: scheme, error } = await supabase
            .from('leave_schemes')
            .insert([{ name, description, is_active: true }])
            .select()
            .single();
        if (error) throw error;
        return NextResponse.json({ scheme });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const supabase = await createClient();
    try {
        const body = await request.json();
        const { id, ...updates } = body;
        const { data: scheme, error } = await supabase
            .from('leave_schemes')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return NextResponse.json({ scheme });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const supabase = await createClient();
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
        const { error } = await supabase.from('leave_schemes').delete().eq('id', id);
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
