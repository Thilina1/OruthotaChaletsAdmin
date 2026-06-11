import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month'); // 1-12

    try {
        let query = supabase
            .from('working_calendar')
            .select('*')
            .order('date', { ascending: true });

        if (year && month) {
            const from = `${year}-${String(month).padStart(2, '0')}-01`;
            const lastDay = new Date(Number(year), Number(month), 0).getDate();
            const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
            query = query.gte('date', from).lte('date', to);
        }

        const { data: entries, error } = await query;
        if (error) throw error;
        return NextResponse.json({ entries });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const supabase = await createClient();
    try {
        const body = await request.json();
        const { date, title, day_type } = body;
        const { data: entry, error } = await supabase
            .from('working_calendar')
            .upsert([{ date, title, day_type }], { onConflict: 'date' })
            .select()
            .single();
        if (error) throw error;
        return NextResponse.json({ entry });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const supabase = await createClient();
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');
        if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });
        const { error } = await supabase.from('working_calendar').delete().eq('date', date);
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
