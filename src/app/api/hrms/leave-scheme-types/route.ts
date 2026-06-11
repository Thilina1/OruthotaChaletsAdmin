import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const supabase = await createClient();
    try {
        const body = await request.json();
        const { scheme_id, name, days_count, reset_period, carry_forward, carry_forward_max } = body;
        const { data: type, error } = await supabase
            .from('leave_scheme_types')
            .insert([{ scheme_id, name, days_count, reset_period, carry_forward, carry_forward_max: carry_forward ? carry_forward_max : null }])
            .select()
            .single();
        if (error) throw error;
        return NextResponse.json({ type });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const supabase = await createClient();
    try {
        const body = await request.json();
        const { id, carry_forward, carry_forward_max, ...rest } = body;
        const { data: type, error } = await supabase
            .from('leave_scheme_types')
            .update({ ...rest, carry_forward, carry_forward_max: carry_forward ? carry_forward_max : null, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return NextResponse.json({ type });
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
        const { error } = await supabase.from('leave_scheme_types').delete().eq('id', id);
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
