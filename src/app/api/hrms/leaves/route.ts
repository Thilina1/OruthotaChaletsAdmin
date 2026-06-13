import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    const supabase = await createClient();
    try {
        const { data: requests, error } = await supabase
            .from('leave_requests')
            .select(`
                *,
                leave_type:leave_scheme_types!leave_type_id(id, name, days_count),
                employee:users!user_id(id, name, email),
                approver:users!approved_by(id, name)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return NextResponse.json({ leaves: requests });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const supabase = await createClient();
    try {
        const body = await request.json();
        const { user_id, leave_type_id, start_date, end_date, days_count, half_day_type, reason, status, approved_by } = body;

        const { data: leave, error } = await supabase
            .from('leave_requests')
            .insert([{ user_id, leave_type_id, start_date, end_date, days_count, half_day_type: half_day_type || null, reason, status: status ?? 'pending', approved_by: approved_by ?? null }])
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ leave });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const supabase = await createClient();
    try {
        const body = await request.json();
        const { id, status, approved_by } = body;

        const { data: leave, error } = await supabase
            .from('leave_requests')
            .update({ status, approved_by, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ leave });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
