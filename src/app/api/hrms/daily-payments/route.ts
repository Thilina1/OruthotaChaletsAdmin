import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET ?date=YYYY-MM-DD  → all active casual workers + their record for that date
export async function GET(request: Request) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    try {
        const { data: workers, error } = await supabase
            .from('casual_workers')
            .select('*')
            .eq('is_active', true)
            .order('name');

        if (error) throw error;
        if (!workers || workers.length === 0) return NextResponse.json({ workers: [] });

        let payments: any[] = [];
        if (date) {
            const { data: p } = await supabase
                .from('daily_payments')
                .select('*')
                .eq('date', date)
                .in('worker_id', workers.map(w => w.id));
            payments = p || [];
        }

        const merged = workers.map(w => ({
            ...w,
            payment: payments.find(p => p.worker_id === w.id) || null,
        }));

        return NextResponse.json({ workers: merged });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

// POST  → upsert attendance/payment for one worker on one date
export async function POST(request: Request) {
    const supabase = await createClient();
    try {
        const body = await request.json();
        const { worker_id, date, daily_rate, day_type, is_paid, notes } = body;

        const amount =
            day_type === 'full'   ? Number(daily_rate)
          : day_type === 'half'   ? Number(daily_rate) / 2
          : 0;

        const { data, error } = await supabase
            .from('daily_payments')
            .upsert([{
                worker_id,
                date,
                daily_rate: Number(daily_rate),
                day_type,
                amount,
                is_paid: !!is_paid,
                paid_at: is_paid ? new Date().toISOString() : null,
                notes: notes || null,
                updated_at: new Date().toISOString(),
            }], { onConflict: 'worker_id,date' })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ payment: data });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
