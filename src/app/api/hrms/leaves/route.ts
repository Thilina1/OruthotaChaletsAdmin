import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    try {
        let query = supabase
            .from('leaves')
            .select(`
        *,
        users!user_id (
          name,
          email
        )
      `)
            .order('created_at', { ascending: false });

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data: leaves, error } = await query;

        if (error) throw error;

        return NextResponse.json({ leaves });
    } catch (error) {
        console.error('Error fetching leaves:', error);
        return NextResponse.json({ error: (error as Error).message || 'Error fetching leaves' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const supabase = await createClient();

    try {
        const body = await request.json();
        const { user_id, type, start_date, end_date, reason } = body;

        const { data: leave, error } = await supabase
            .from('leaves')
            .insert([
                { user_id, type, start_date, end_date, reason, status: 'pending' }
            ])
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ leave });
    } catch (error) {
        console.error('Error creating leave request:', error);
        return NextResponse.json({ error: (error as Error).message || 'Error creating leave request' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const supabase = await createClient();

    try {
        const body = await request.json();
        const { id, status, approved_by } = body;

        const { data: leave, error } = await supabase
            .from('leaves')
            .update({ status, approved_by, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ leave });
    } catch (error) {
        console.error('Error updating leave request:', error);
        return NextResponse.json({ error: (error as Error).message || 'Error updating leave request' }, { status: 500 });
    }
}
