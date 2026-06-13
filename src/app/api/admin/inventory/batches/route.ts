import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET /api/admin/inventory/batches?item_id=<uuid>&menu_item_id=<uuid>
// Returns all active batches for an inventory item, with per-batch stock and
// any existing selling price linked to the given menu_item_id.
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const item_id = searchParams.get('item_id');
    const menu_item_id = searchParams.get('menu_item_id');

    if (!item_id) {
        return NextResponse.json({ error: 'item_id is required' }, { status: 400 });
    }

    try {
        // Fetch all non-depleted batches for this inventory item
        const { data: batches, error: batchError } = await supabase
            .from('inventory_batches')
            .select('id, batch_number, buying_price, expiry_date, supplier, status, created_at')
            .eq('item_id', item_id)
            .neq('status', 'depleted')
            .order('created_at', { ascending: false });

        if (batchError) throw batchError;

        const batchIds = (batches ?? []).map((b: any) => b.id);

        // Fetch stock quantities per batch across warehouses
        let stockByBatch: Record<string, { total: number; warehouses: { name: string; quantity: number }[] }> = {};
        if (batchIds.length > 0) {
            const { data: stockData, error: stockError } = await supabase
                .from('inventory_stock')
                .select('batch_id, quantity, warehouse:inventory_warehouses(id, name)')
                .in('batch_id', batchIds);

            if (stockError) throw stockError;

            (stockData ?? []).forEach((s: any) => {
                if (!stockByBatch[s.batch_id]) {
                    stockByBatch[s.batch_id] = { total: 0, warehouses: [] };
                }
                stockByBatch[s.batch_id].total += s.quantity;
                if (s.warehouse) {
                    stockByBatch[s.batch_id].warehouses.push({
                        name: s.warehouse.name,
                        quantity: s.quantity,
                    });
                }
            });
        }

        // Fetch existing selling prices for this menu item + these batches
        let pricingByBatch: Record<string, { pricing_id: string; selling_price: number }> = {};
        if (menu_item_id && batchIds.length > 0) {
            const { data: pricingData, error: pricingError } = await supabase
                .from('menu_item_batch_pricing')
                .select('id, batch_id, selling_price')
                .eq('menu_item_id', menu_item_id)
                .in('batch_id', batchIds);

            if (pricingError) throw pricingError;

            (pricingData ?? []).forEach((p: any) => {
                pricingByBatch[p.batch_id] = { pricing_id: p.id, selling_price: p.selling_price };
            });
        }

        const result = (batches ?? []).map((b: any) => ({
            ...b,
            total_stock: stockByBatch[b.id]?.total ?? 0,
            warehouse_stock: stockByBatch[b.id]?.warehouses ?? [],
            pricing_id: pricingByBatch[b.id]?.pricing_id ?? null,
            selling_price: pricingByBatch[b.id]?.selling_price ?? null,
        }));

        return NextResponse.json({ batches: result });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST /api/admin/inventory/batches
// Body: { menu_item_id, batch_id, selling_price }
// Upserts a selling price record linking a menu item to an inventory batch.
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { menu_item_id, batch_id, selling_price } = body;

        if (!menu_item_id || !batch_id || selling_price == null) {
            return NextResponse.json({ error: 'menu_item_id, batch_id, and selling_price are required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('menu_item_batch_pricing')
            .upsert(
                { menu_item_id, batch_id, selling_price, updated_at: new Date().toISOString() },
                { onConflict: 'menu_item_id,batch_id' }
            )
            .select('id, menu_item_id, batch_id, selling_price')
            .single();

        if (error) throw error;

        return NextResponse.json({ pricing: data });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// DELETE /api/admin/inventory/batches
// Body: { pricing_id }
// Removes the selling price link between a menu item and a batch.
export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const { pricing_id } = body;

        if (!pricing_id) {
            return NextResponse.json({ error: 'pricing_id is required' }, { status: 400 });
        }

        const { error } = await supabase
            .from('menu_item_batch_pricing')
            .delete()
            .eq('id', pricing_id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
