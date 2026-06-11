import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ balance: [], hasScheme: false });
    }

    try {
        const { data: userRecord, error: userError } = await supabase
            .from('users')
            .select('leave_scheme_id')
            .eq('id', userId)
            .single();

        if (userError) throw userError;

        if (!userRecord?.leave_scheme_id) {
            return NextResponse.json({ balance: [], hasScheme: false });
        }

        const { data: schemeTypes, error: stError } = await supabase
            .from('leave_scheme_types')
            .select('*')
            .eq('scheme_id', userRecord.leave_scheme_id);

        if (stError) throw stError;

        const yearStart = `${new Date().getFullYear()}-01-01`;
        const { data: requests } = await supabase
            .from('leave_requests')
            .select('leave_type_id, days_count, status')
            .eq('user_id', userId)
            .gte('start_date', yearStart)
            .in('status', ['approved', 'pending']);

        const balance = (schemeTypes ?? []).map(type => {
            const approved = (requests ?? [])
                .filter(r => r.leave_type_id === type.id && r.status === 'approved')
                .reduce((sum, r) => sum + Number(r.days_count), 0);
            const pending = (requests ?? [])
                .filter(r => r.leave_type_id === type.id && r.status === 'pending')
                .reduce((sum, r) => sum + Number(r.days_count), 0);
            return {
                ...type,
                used_days: approved,
                pending_days: pending,
                available_days: Math.max(0, type.days_count - approved),
            };
        });

        return NextResponse.json({ balance, hasScheme: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
