import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getUser(request: Request) {
  // Accept Bearer token (mobile) or cookie (web)
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : (await cookies()).get('auth_token')?.value;

  if (!token) return null;
  return verifyToken(token);
}

/*
  POST /api/waiter/add-to-order
  Body:
  {
    table_id: string,
    table_number: number,
    table_status: string,           // current table status ('available' | 'occupied')
    order_id: string | null,        // null = create new order
    customer_mobile: string | null,
    items: [
      {
        menu_item_id: string,
        batch_id: string | null,
        name: string,
        price: number,
        quantity: number,
        stock_type: string,                    // 'Inventoried' | 'Non-Inventoried'
        linked_inventory_item_id: string | null
      }
    ]
  }

  Response 200:
  {
    order_id: string,
    total_price: number
  }
*/
export async function POST(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const {
    table_id,
    table_number,
    table_status,
    order_id,
    customer_mobile,
    items,
  } = body;

  if (!table_id || !items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'table_id and items are required' }, { status: 400 });
  }

  try {
    // ── STEP 1: Ensure order exists ──────────────────────────────────────────
    let currentOrderId: string = order_id;

    // Always resolve ownership from the database instead of trusting the
    // order ID or table status supplied by the browser.
    const { data: activeOrder } = await supabase
      .from('orders')
      .select('id, waiter_id, waiter_name')
      .eq('table_id', table_id)
      .in('status', ['open', 'billed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeOrder?.waiter_id && activeOrder.waiter_id !== user.userId) {
      return NextResponse.json({
        error: `This table is currently handled by ${activeOrder.waiter_name || 'another waiter'}`,
      }, { status: 409 });
    }

    if (activeOrder) currentOrderId = activeOrder.id;

    if (!currentOrderId) {
      const { data: newOrder, error: createError } = await supabase
        .from('orders')
        .insert({
          table_id,
          table_number,
          status: 'open',
          total_price: 0,
          waiter_id: user.userId,
          waiter_name: user.name,
          ...(customer_mobile ? { customer_mobile } : {}),
        })
        .select('id')
        .single();

      if (createError) throw createError;
      currentOrderId = newOrder.id;
    }

    // ── STEP 2: Get Restaurant warehouse ID (needed for inventory deduction) ─
    const { data: wh } = await supabase
      .from('inventory_warehouses')
      .select('id')
      .eq('name', 'Restaurant')
      .maybeSingle();
    const warehouseId: string | null = wh?.id ?? null;

    // ── STEP 3: Process each item ────────────────────────────────────────────
    let orderTotalIncrease = 0;

    for (const item of items) {
      const {
        menu_item_id,
        batch_id,
        name,
        price,
        quantity,
        stock_type,
        linked_inventory_item_id,
      } = item;

      const lineTotal = price * quantity;
      orderTotalIncrease += lineTotal;

      // Check if same item+price already in order — increment if so
      const { data: existing } = await supabase
        .from('order_items')
        .select('id, quantity')
        .eq('order_id', currentOrderId)
        .eq('menu_item_id', menu_item_id)
        .eq('price', price)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('order_items')
          .update({ quantity: existing.quantity + quantity })
          .eq('id', existing.id);
      } else {
        const insertPayload: Record<string, any> = {
          order_id: currentOrderId,
          menu_item_id,
          name,
          price,
          quantity,
        };
        if (batch_id) insertPayload.batch_id = batch_id;

        const { error: itemError } = await supabase
          .from('order_items')
          .insert(insertPayload);

        if (itemError) throw itemError;
      }

      // ── Inventory deduction ──────────────────────────────────────────────
      if (stock_type === 'Inventoried' && linked_inventory_item_id && batch_id && warehouseId) {
        const { data: stockRow } = await supabase
          .from('inventory_stock')
          .select('id, quantity')
          .eq('warehouse_id', warehouseId)
          .eq('batch_id', batch_id)
          .maybeSingle();

        if (stockRow) {
          const newStock = (stockRow.quantity ?? 0) - quantity;
          await supabase
            .from('inventory_stock')
            .update({ quantity: newStock })
            .eq('id', stockRow.id);

          const txPayload: Record<string, any> = {
            item_id: linked_inventory_item_id,
            batch_id,
            transaction_type: 'issue',
            quantity,
            previous_stock: stockRow.quantity,
            new_stock: newStock,
            reason: 'Sold via POS',
            reference_department: warehouseId,
            created_by: user.userId,
          };

          await supabase.from('inventory_transactions').insert(txPayload);
        }
      } else if (stock_type === 'Inventoried' && !linked_inventory_item_id) {
        // Manual stock — try RPC, fall back to direct update
        const { error: rpcError } = await supabase.rpc('decrement_stock', {
          item_id: menu_item_id,
          quantity,
        });
        if (rpcError) {
          const { data: mi } = await supabase
            .from('menu_items')
            .select('stock')
            .eq('id', menu_item_id)
            .single();
          if (mi) {
            await supabase
              .from('menu_items')
              .update({ stock: (mi.stock ?? 0) - quantity })
              .eq('id', menu_item_id);
          }
        }
      }
    }

    // ── STEP 4: Update order total ───────────────────────────────────────────
    const { data: freshOrder } = await supabase
      .from('orders')
      .select('total_price')
      .eq('id', currentOrderId)
      .single();

    const newTotal = (freshOrder?.total_price ?? 0) + orderTotalIncrease;

    await supabase
      .from('orders')
      .update({
        total_price: newTotal,
        updated_at: new Date().toISOString(),
        waiter_id: user.userId,
        waiter_name: user.name,
        ...(customer_mobile ? { customer_mobile } : {}),
      })
      .eq('id', currentOrderId);

    // ── STEP 5: Mark table occupied if it was available ──────────────────────
    if (table_status === 'available') {
      await supabase
        .from('restaurant_tables')
        .update({ status: 'occupied' })
        .eq('id', table_id);
    }

    return NextResponse.json({ order_id: currentOrderId, total_price: newTotal });
  } catch (error: any) {
    console.error('add-to-order error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
