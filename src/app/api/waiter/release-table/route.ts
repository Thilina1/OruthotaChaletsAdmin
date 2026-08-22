import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : (await cookies()).get('auth_token')?.value;
  const user = token ? await verifyToken(token) : null;

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { table_id } = await request.json();
  if (!table_id) return NextResponse.json({ error: 'Table ID is required' }, { status: 400 });

  const { data: activeOrder, error: findError } = await supabase
    .from('orders')
    .select('id, waiter_id')
    .eq('table_id', table_id)
    .in('status', ['open', 'billed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });
  if (!activeOrder) return NextResponse.json({ error: 'No active order for this table' }, { status: 404 });
  if (activeOrder.waiter_id !== user.userId) {
    return NextResponse.json({ error: 'Only the assigned waiter can release this table' }, { status: 403 });
  }

  const { data: releasedOrder, error: updateError } = await supabase
    .from('orders')
    .update({ waiter_id: null, waiter_name: null, updated_at: new Date().toISOString() })
    .eq('id', activeOrder.id)
    .eq('waiter_id', user.userId)
    .select('id')
    .maybeSingle();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (!releasedOrder) return NextResponse.json({ error: 'Table ownership has already changed' }, { status: 409 });

  return NextResponse.json({ success: true });
}
