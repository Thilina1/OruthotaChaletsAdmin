import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    if (!userId) return NextResponse.json({ overrides: [] });
    try {
        const { data, error } = await supabase
            .from('user_calendar_overrides')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: true });
        if (error) throw error;
        return NextResponse.json({ overrides: data ?? [] });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const supabase = await createClient();
    try {
        const { user_id, date, title, day_type, action } = await request.json();
        const { data, error } = await supabase
            .from('user_calendar_overrides')
            .upsert([{ user_id, date, title, day_type, action }], { onConflict: 'user_id,date' })
            .select()
            .single();
        if (error) throw error;
        return NextResponse.json({ override: data });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const supabase = await createClient();
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const date = searchParams.get('date');
        if (!userId || !date) return NextResponse.json({ error: 'userId and date required' }, { status: 400 });
        const { error } = await supabase
            .from('user_calendar_overrides')
            .delete()
            .eq('user_id', userId)
            .eq('date', date);
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
