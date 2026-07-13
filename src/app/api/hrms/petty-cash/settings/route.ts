import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

export async function GET() {
    const supabase = await createClient();
    try {
        const { data, error } = await supabase
            .from('petty_cash_settings')
            .select('*')
            .single();
        if (error) throw error;
        return NextResponse.json({ settings: data });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const supabase = await createClient();
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const user = token ? await verifyToken(token) : null;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { daily_total_limit, small_request_threshold, small_pool_limit, large_pool_limit } = body;

        // Validate pools add up sanely
        if (small_pool_limit + large_pool_limit > daily_total_limit) {
            return NextResponse.json(
                { error: 'Small pool + Large pool cannot exceed Daily Total limit' },
                { status: 422 }
            );
        }

        // Upsert the single settings row
        const { data: existing } = await supabase.from('petty_cash_settings').select('id').single();

        let result;
        if (existing?.id) {
            const { data, error } = await supabase
                .from('petty_cash_settings')
                .update({ daily_total_limit, small_request_threshold, small_pool_limit, large_pool_limit, updated_at: new Date().toISOString(), updated_by: user.userId })
                .eq('id', existing.id)
                .select()
                .single();
            if (error) throw error;
            result = data;
        } else {
            const { data, error } = await supabase
                .from('petty_cash_settings')
                .insert([{ daily_total_limit, small_request_threshold, small_pool_limit, large_pool_limit, updated_by: user.userId }])
                .select()
                .single();
            if (error) throw error;
            result = data;
        }

        return NextResponse.json({ settings: result });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
