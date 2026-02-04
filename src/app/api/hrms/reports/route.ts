import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const date = searchParams.get('date');

    try {
        let query = supabase
            .from('daily_reports')
            .select(`
        *,
        users (
          name,
          email
        )
      `)
            .order('date', { ascending: false });

        if (userId) {
            query = query.eq('user_id', userId);
        }

        if (date) {
            query = query.eq('date', date);
        }

        const { data: reports, error } = await query;

        if (error) throw error;

        return NextResponse.json({ reports });
    } catch (error) {
        console.error('Error fetching daily reports:', error);
        return NextResponse.json({ error: 'Error fetching daily reports' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const supabase = await createClient();

    try {
        const body = await request.json();
        const { user_id, date, tasks_completed, issues_faced, next_day_plan } = body;

        const { data: report, error } = await supabase
            .from('daily_reports')
            .insert([
                { user_id, date, tasks_completed, issues_faced, next_day_plan }
            ])
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ report });
    } catch (error) {
        console.error('Error submitting daily report:', error);
        return NextResponse.json({ error: 'Error submitting daily report' }, { status: 500 });
    }
}
