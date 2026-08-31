import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET ?warehouse_id=<uuid>             → items with available stock in that warehouse
// GET ?warehouse_id=<uuid>&history=1   → damage/expired transaction history
// GET ?warehouse_id=<uuid>&usage_history=1 → section-based Kitchen usage report
export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const warehouse_id = searchParams.get('warehouse_id');
        const history = searchParams.get('history') === '1';
        const usageHistory = searchParams.get('usage_history') === '1';

        if (!warehouse_id) return NextResponse.json({ error: 'warehouse_id is required' }, { status: 400 });

        if (history) {
            const { data, error } = await supabase
                .from('inventory_transactions')
                .select(`
                    id, transaction_type, quantity, remarks, created_at, created_by,
                    item:inventory_items(id, name, category:inventory_categories(name), unit:inventory_units(name)),
                    batch:inventory_batches(id, batch_number, expiry_date)
                `)
                .eq('department_id', warehouse_id)
                .in('transaction_type', ['damage', 'expired'])
                .order('created_at', { ascending: false })
                .limit(200);
            if (error) throw error;

            // Resolve user names separately to avoid multi-FK ambiguity after migration adds action_by
            const userIds = [...new Set((data ?? []).map((r: any) => r.created_by).filter(Boolean))];
            let userMap: Record<string, string> = {};
            if (userIds.length > 0) {
                const { data: users } = await supabase.from('users').select('id, name').in('id', userIds);
                for (const u of users ?? []) userMap[u.id] = u.name;
            }
            const enriched = (data ?? []).map((r: any) => ({
                ...r,
                user: r.created_by ? { id: r.created_by, name: userMap[r.created_by] ?? '—' } : null,
            }));
            return NextResponse.json({ transactions: enriched });
        }

        if (usageHistory) {
            const { data, error } = await supabase
                .from('inventory_transactions')
                .select(`
                    id, transaction_type, quantity, remarks, created_at, created_by,
                    item:inventory_items(id, name, category:inventory_categories(name), unit:inventory_units(name)),
                    batch:inventory_batches(id, batch_number, expiry_date)
                `)
                .eq('department_id', warehouse_id)
                .eq('transaction_type', 'issue')
                .order('created_at', { ascending: false })
                .limit(500);
            if (error) throw error;

            const userIds = [...new Set((data ?? []).map((row: any) => row.created_by).filter(Boolean))];
            const userMap: Record<string, string> = {};
            if (userIds.length > 0) {
                const { data: users } = await supabase.from('users').select('id, name').in('id', userIds);
                for (const user of users ?? []) userMap[user.id] = user.name;
            }
            const sectionPrefixes = ['Staff', 'Function', 'A la carte', 'Room guest'];
            const transactions = (data ?? []).map((row: any) => {
                const usageSection = sectionPrefixes.find(section =>
                    row.remarks?.toLowerCase().startsWith(`${section.toLowerCase()} usage`)
                ) || null;
                return {
                    ...row,
                    usage_section: usageSection,
                    user: row.created_by ? { id: row.created_by, name: userMap[row.created_by] ?? '—' } : null,
                };
            }).filter((row: any) => row.usage_section);

            return NextResponse.json({ transactions });
        }

        // Fetch stock with item + batch details
        const { data: stockRows, error } = await supabase
            .from('inventory_stock')
            .select(`
                id, quantity,
                item_id, batch_id,
                item:inventory_items(id, name, category:inventory_categories(id, name), unit:inventory_units(id, name)),
                batch:inventory_batches(id, batch_number, expiry_date, buying_price, status)
            `)
            .eq('warehouse_id', warehouse_id)
            .gt('quantity', 0)
            .order('item_id');
        if (error) throw error;

        // Group batches under each item
        const itemMap: Record<string, any> = {};
        for (const row of stockRows ?? []) {
            const item = row.item as any;
            if (!item) continue;
            if (!itemMap[item.id]) {
                itemMap[item.id] = {
                    id: item.id,
                    name: item.name,
                    category: item.category,
                    unit: item.unit,
                    total_quantity: 0,
                    batches: [],
                };
            }
            itemMap[item.id].total_quantity += Number(row.quantity);
            itemMap[item.id].batches.push({
                stock_id: row.id,
                batch_id: row.batch_id,
                batch_number: (row.batch as any)?.batch_number ?? null,
                expiry_date: (row.batch as any)?.expiry_date ?? null,
                buying_price: (row.batch as any)?.buying_price ?? null,
                quantity: Number(row.quantity),
            });
        }
        return NextResponse.json({ items: Object.values(itemMap) });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST — record usage, damage, or expired; reduces inventory_stock
export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const payload = await verifyToken(token) as any;
        if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { warehouse_id, item_id, batch_id, stock_id, quantity, type, reason, section } = await request.json();

        if (!warehouse_id || !item_id || !batch_id || !stock_id || !quantity || !type) {
            return NextResponse.json({ error: 'warehouse_id, item_id, batch_id, stock_id, quantity, type are required' }, { status: 400 });
        }
        if (!['use', 'damage', 'expired'].includes(type)) {
            return NextResponse.json({ error: 'type must be use, damage, or expired' }, { status: 400 });
        }
        const kitchenSections = ['Staff', 'Function', 'A la carte', 'Room guest'];
        if (section && !kitchenSections.includes(section)) {
            return NextResponse.json({ error: 'Invalid Kitchen usage section' }, { status: 400 });
        }
        const qty = Number(quantity);
        if (isNaN(qty) || qty <= 0) {
            return NextResponse.json({ error: 'quantity must be a positive number' }, { status: 400 });
        }

        if (type === 'use' && section) {
            const { data: assignment, error: assignmentError } = await supabase
                .from('kitchen_section_items')
                .select('id')
                .eq('section', section)
                .eq('item_id', item_id)
                .maybeSingle();
            if (assignmentError) throw assignmentError;
            if (!assignment) {
                return NextResponse.json({ error: `${item_id} is not assigned to the ${section} Kitchen section.` }, { status: 400 });
            }
        }

        // Fetch the exact stock entry by its PK to avoid race conditions
        const { data: stockEntry, error: stockErr } = await supabase
            .from('inventory_stock')
            .select('id, quantity')
            .eq('id', stock_id)
            .eq('warehouse_id', warehouse_id)
            .eq('item_id', item_id)
            .eq('batch_id', batch_id)
            .single();
        if (stockErr || !stockEntry) {
            return NextResponse.json({ error: 'Stock entry not found' }, { status: 404 });
        }
        if (Number(stockEntry.quantity) < qty) {
            return NextResponse.json({ error: `Insufficient stock. Available: ${stockEntry.quantity}` }, { status: 400 });
        }

        const newQty = Number(stockEntry.quantity) - qty;

        // Reduce stock
        const { error: updateErr } = await supabase
            .from('inventory_stock')
            .update({ quantity: newQty, last_updated: new Date().toISOString() })
            .eq('id', stock_id);
        if (updateErr) throw updateErr;

        // Transaction type: 'issue' for usage, 'damage' for damage, 'expired' for expired
        const txType = type === 'use' ? 'issue' : type;
        const remarks = type === 'use'
            ? `${section ? `${section} usage` : 'Employee consumption'}${reason ? ': ' + reason : ''}`
            : `${type.toUpperCase()}${reason ? ': ' + reason : ''}`;

        const { data: tx, error: txErr } = await supabase
            .from('inventory_transactions')
            .insert({
                item_id,
                batch_id,
                transaction_type: txType,
                quantity: qty,
                department_id: warehouse_id,
                remarks,
                created_by: payload.userId,
            })
            .select()
            .single();
        if (txErr) throw txErr;

        // If batch is now fully depleted across all warehouses, mark it depleted
        if (newQty === 0) {
            const { count } = await supabase
                .from('inventory_stock')
                .select('*', { count: 'exact', head: true })
                .eq('batch_id', batch_id)
                .gt('quantity', 0);
            if (count === 0) {
                await supabase.from('inventory_batches').update({ status: 'depleted' }).eq('id', batch_id);
            }
        }

        return NextResponse.json({ transaction: tx }, { status: 201 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
