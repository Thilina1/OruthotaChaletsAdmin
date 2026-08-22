import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'A valid date is required.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('casual_worker_assignments')
    .select('worker_id')
    .eq('work_date', date);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ worker_ids: (data || []).map(item => item.worker_id) });
}

export async function PUT(request: Request) {
  const { date, worker_ids } = await request.json();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(worker_ids)) {
    return NextResponse.json({ error: 'A valid date and worker list are required.' }, { status: 400 });
  }

  const uniqueWorkerIds = Array.from(new Set(worker_ids.filter(id => typeof id === 'string')));
  const supabase = await createClient();
  const { error: deleteError } = await supabase
    .from('casual_worker_assignments')
    .delete()
    .eq('work_date', date);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  if (uniqueWorkerIds.length) {
    const { error: insertError } = await supabase
      .from('casual_worker_assignments')
      .insert(uniqueWorkerIds.map(workerId => ({ worker_id: workerId, work_date: date })));
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, worker_ids: uniqueWorkerIds });
}
