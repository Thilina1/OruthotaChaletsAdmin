import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    const supabase = await createClient();
    try {
        const { data, error } = await supabase
            .from('casual_workers')
            .select('*')
            .order('name');
        if (error) throw error;
        return NextResponse.json({ workers: data });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const supabase = await createClient();
    try {
        const body = await request.json();
        const { name, phone, nic, department, daily_rate, notes } = body;
        const { data, error } = await supabase
            .from('casual_workers')
            .insert([{ name, phone, nic, department, daily_rate: Number(daily_rate) || 0, notes }])
            .select()
            .single();
        if (error) throw error;
        return NextResponse.json({ worker: data }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const supabase = await createClient();
    try {
        const body = await request.json();
        const { id, name, phone, nic, department, daily_rate, is_active, notes } = body;
        const { data, error } = await supabase
            .from('casual_workers')
            .update({ name, phone, nic, department, daily_rate: Number(daily_rate) || 0, is_active, notes, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return NextResponse.json({ worker: data });
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
        const { error } = await supabase.from('casual_workers').delete().eq('id', id);
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
