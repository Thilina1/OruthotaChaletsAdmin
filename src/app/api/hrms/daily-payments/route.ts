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
            .select('*, system_user:users!user_id(email)')
            .eq('is_active', true)
            .order('name');

        if (error) throw error;
        let scheduledWorkers = workers || [];
        if (date && scheduledWorkers.length) {
            const { data: assignments, error: assignmentError } = await supabase
                .from('casual_worker_assignments')
                .select('worker_id')
                .eq('work_date', date);
            if (assignmentError) throw assignmentError;
            const assignedIds = new Set((assignments || []).map(item => item.worker_id));
            scheduledWorkers = scheduledWorkers.filter(worker => assignedIds.has(worker.id));
        }
        if (scheduledWorkers.length === 0) return NextResponse.json({ workers: [] });

        let payments: any[] = [];
        if (date) {
            const { data: p } = await supabase
                .from('daily_payments')
                .select('*')
                .eq('date', date)
                .in('worker_id', scheduledWorkers.map(w => w.id));
            payments = p || [];
        }

        const merged = scheduledWorkers.map(w => ({
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

        if (is_paid && amount > 0) {
            const [cashRequestsResult, paidPaymentsResult] = await Promise.all([
                supabase
                    .from('daily_worker_cash_requests')
                    .select('issued_amount')
                    .eq('work_date', date),
                supabase
                    .from('daily_payments')
                    .select('amount')
                    .eq('date', date)
                    .eq('is_paid', true)
                    .neq('worker_id', worker_id),
            ]);

            if (cashRequestsResult.error) throw cashRequestsResult.error;
            if (paidPaymentsResult.error) throw paidPaymentsResult.error;

            const issued = (cashRequestsResult.data || [])
                .reduce((sum, item) => sum + Number(item.issued_amount || 0), 0);
            const alreadyPaid = (paidPaymentsResult.data || [])
                .reduce((sum, item) => sum + Number(item.amount || 0), 0);
            const available = issued - alreadyPaid;

            if (amount > available) {
                return NextResponse.json({
                    error: `Insufficient issued funds. Available: LKR ${available.toLocaleString('en-LK', { minimumFractionDigits: 2 })}; required: LKR ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}.`,
                }, { status: 422 });
            }
        }

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
