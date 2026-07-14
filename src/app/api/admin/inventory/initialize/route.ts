import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// DELETE ?item_id=<uuid>&warehouse_id=<uuid>
// Removes the warehouse initialization for an item only if its total stock is 0.
export async function DELETE(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const payload = await verifyToken(token) as any;
        if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const item_id = searchParams.get('item_id');
        const warehouse_id = searchParams.get('warehouse_id');

        if (!item_id || !warehouse_id) {
            return NextResponse.json({ error: 'item_id and warehouse_id are required' }, { status: 400 });
        }

        // Safety check — only allow removal when all stock rows for this item+warehouse are 0
        const { data: stockRows, error: checkErr } = await supabase
            .from('inventory_stock')
            .select('id, quantity')
            .eq('item_id', item_id)
            .eq('warehouse_id', warehouse_id);

        if (checkErr) throw checkErr;

        if (!stockRows || stockRows.length === 0) {
            return NextResponse.json({ error: 'No initialization found for this item in this warehouse' }, { status: 404 });
        }

        const totalQty = stockRows.reduce((sum, r) => sum + Number(r.quantity), 0);
        if (totalQty > 0) {
            return NextResponse.json(
                { error: `Cannot remove — this item still has ${totalQty} units in stock. Consume or transfer the stock first.` },
                { status: 409 }
            );
        }

        // Delete all stock rows for this item+warehouse (all quantities are 0)
        const { error: deleteErr } = await supabase
            .from('inventory_stock')
            .delete()
            .eq('item_id', item_id)
            .eq('warehouse_id', warehouse_id);

        if (deleteErr) throw deleteErr;

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
