import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET  — all damage/expired transactions (with optional ?from=&to=&warehouse_id=&status= filters)
// PATCH — value a record (unit_value, action_taken, action_notes) and optionally return stock
export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const warehouseId = searchParams.get('warehouse_id');
        const status = searchParams.get('status');

        // Base select — no user joins to avoid multiple-FK ambiguity when migration has run.
        // We resolve reporter/actioner names via a separate users lookup below.
        let query = supabase
            .from('inventory_transactions')
            .select(`
                id, transaction_type, quantity, remarks, created_at,
                created_by, department_id,
                item:inventory_items(id, name,
                    category:inventory_categories(id, name),
                    unit:inventory_units(id, name)
                ),
                batch:inventory_batches(id, batch_number, expiry_date, buying_price)
            `)
            .in('transaction_type', ['damage', 'expired'])
            .order('created_at', { ascending: false })
            .limit(500);

        if (from) query = query.gte('created_at', from);
        if (to)   query = query.lte('created_at', to + 'T23:59:59');
        if (warehouseId) query = query.eq('department_id', warehouseId);

        const { data: baseData, error: baseErr } = await query;
        if (baseErr) throw baseErr;

        // Try to also fetch valuation columns (added by migration 20260714000002).
        // Fall back gracefully if migration hasn't been run yet.
        let valuationMap: Record<string, {
            unit_value: number | null;
            total_loss_value: number | null;
            action_taken: string | null;
            action_notes: string | null;
            action_at: string | null;
            action_by: string | null;
        }> = {};

        try {
            const ids = (baseData || []).map((r: any) => r.id);
            if (ids.length > 0) {
                const { data: valData } = await supabase
                    .from('inventory_transactions')
                    .select('id, unit_value, total_loss_value, action_taken, action_notes, action_at, action_by')
                    .in('id', ids);
                for (const v of valData ?? []) {
                    valuationMap[v.id] = v as any;
                }
            }
        } catch (_) {
            // Valuation columns not yet migrated — all records will appear as pending
        }

        // Apply status filter after fetching (since action_taken may not exist in DB yet)
        let rows = (baseData || []).map((r: any) => ({
            ...r,
            ...(valuationMap[r.id] ?? {
                unit_value: null, total_loss_value: null,
                action_taken: null, action_notes: null, action_at: null, action_by: null,
            }),
        }));

        if (status === 'pending')     rows = rows.filter((r: any) => r.action_taken === null);
        if (status === 'written_off') rows = rows.filter((r: any) => r.action_taken === 'written_off');
        if (status === 'returned')    rows = rows.filter((r: any) => r.action_taken === 'returned');

        // Resolve warehouse info (department_id = warehouse_id in inventory_transactions)
        const whIds = [...new Set(rows.map((r: any) => r.department_id).filter(Boolean))];
        let warehouseMap: Record<string, any> = {};
        if (whIds.length > 0) {
            const { data: whs } = await supabase
                .from('inventory_warehouses')
                .select('id, name, department:inventory_departments(name)')
                .in('id', whIds);
            for (const wh of whs ?? []) warehouseMap[wh.id] = wh;
        }

        // Resolve user names in a single query — avoids multi-FK ambiguity
        const userIds = [...new Set([
            ...rows.map((r: any) => r.created_by),
            ...rows.map((r: any) => r.action_by),
        ].filter(Boolean))];
        let userMap: Record<string, string> = {};
        if (userIds.length > 0) {
            const { data: users } = await supabase
                .from('users')
                .select('id, name')
                .in('id', userIds);
            for (const u of users ?? []) userMap[u.id] = u.name;
        }

        const enriched = rows.map((r: any) => ({
            ...r,
            warehouse: warehouseMap[r.department_id] ?? null,
            reporter: r.created_by ? { id: r.created_by, name: userMap[r.created_by] ?? '—' } : null,
            actioner: r.action_by  ? { id: r.action_by,  name: userMap[r.action_by]  ?? '—' } : null,
        }));

        return NextResponse.json({ records: enriched });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const payload = await verifyToken(token) as any;
        if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { id, unit_value, action_taken, action_notes, return_to_stock } = await request.json();

        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
        if (!action_taken || !['written_off', 'returned'].includes(action_taken)) {
            return NextResponse.json({ error: 'action_taken must be written_off or returned' }, { status: 400 });
        }
        if (unit_value !== undefined && (isNaN(Number(unit_value)) || Number(unit_value) < 0)) {
            return NextResponse.json({ error: 'unit_value must be a non-negative number' }, { status: 400 });
        }

        // Fetch the original transaction
        const { data: tx, error: txErr } = await supabase
            .from('inventory_transactions')
            .select('id, transaction_type, quantity, item_id, batch_id, department_id')
            .eq('id', id)
            .single();

        if (txErr || !tx) return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        if (!['damage', 'expired'].includes(tx.transaction_type)) {
            return NextResponse.json({ error: 'Can only process damage or expired transactions' }, { status: 400 });
        }

        // Check current action_taken (may not exist if migration not run — treat as null)
        let alreadyProcessed = false;
        try {
            const { data: check } = await supabase
                .from('inventory_transactions')
                .select('action_taken')
                .eq('id', id)
                .single();
            alreadyProcessed = (check as any)?.action_taken !== null && (check as any)?.action_taken !== undefined;
        } catch (_) { /* column not yet added */ }

        if (alreadyProcessed) {
            return NextResponse.json({ error: 'This record has already been processed' }, { status: 409 });
        }

        const uv = unit_value !== undefined ? Number(unit_value) : null;
        const totalLoss = uv !== null ? uv * Number(tx.quantity) : null;

        const { error: updateErr } = await supabase
            .from('inventory_transactions')
            .update({
                unit_value: uv,
                total_loss_value: totalLoss,
                action_taken,
                action_notes: action_notes?.trim() || null,
                action_at: new Date().toISOString(),
                action_by: payload.userId,
            })
            .eq('id', id);
        if (updateErr) throw updateErr;

        // Restore stock if requested
        if (return_to_stock && action_taken === 'returned') {
            const warehouseId = tx.department_id;

            const { data: existing } = await supabase
                .from('inventory_stock')
                .select('id, quantity')
                .eq('warehouse_id', warehouseId)
                .eq('item_id', tx.item_id)
                .eq('batch_id', tx.batch_id)
                .maybeSingle();

            if (existing) {
                await supabase
                    .from('inventory_stock')
                    .update({
                        quantity: Number(existing.quantity) + Number(tx.quantity),
                        last_updated: new Date().toISOString(),
                    })
                    .eq('id', existing.id);
            } else {
                await supabase.from('inventory_stock').insert({
                    warehouse_id: warehouseId,
                    item_id: tx.item_id,
                    batch_id: tx.batch_id,
                    quantity: Number(tx.quantity),
                    last_updated: new Date().toISOString(),
                });
            }

            await supabase
                .from('inventory_batches')
                .update({ status: 'active' })
                .eq('id', tx.batch_id)
                .eq('status', 'depleted');

            await supabase.from('inventory_transactions').insert({
                item_id: tx.item_id,
                batch_id: tx.batch_id,
                transaction_type: 'receive',
                quantity: Number(tx.quantity),
                department_id: warehouseId,
                remarks: `Returned to stock (reversal of ${tx.transaction_type} — tx ${id})`,
                created_by: payload.userId,
            });
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
