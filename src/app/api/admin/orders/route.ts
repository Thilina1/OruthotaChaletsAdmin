import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!);

// GET /api/admin/orders?id=<order_id>  → returns { items: OrderItem[] }
export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const orderId = searchParams.get('id');

        if (!orderId) return NextResponse.json({ error: 'Missing order id' }, { status: 400 });

        const { data, error } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', orderId);

        if (error) throw error;

        return NextResponse.json({ items: data ?? [] });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const user = await verifyToken(token);
        if (!user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { order_id, item_id, price, quantity } = await request.json();
        const nextPrice = Number(price);
        const nextQuantity = Number(quantity);

        if (!order_id || !item_id) {
            return NextResponse.json({ error: 'order_id and item_id are required' }, { status: 400 });
        }
        if (!Number.isFinite(nextPrice) || nextPrice < 0 || !Number.isFinite(nextQuantity) || nextQuantity < 1) {
            return NextResponse.json({ error: 'Enter a valid price and quantity.' }, { status: 400 });
        }

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('id,status')
            .eq('id', order_id)
            .in('status', ['open', 'billed'])
            .maybeSingle();

        if (orderError) throw orderError;
        if (!order) return NextResponse.json({ error: 'Order is not editable.' }, { status: 409 });

        const { data: item, error: itemError } = await supabase
            .from('order_items')
            .select('*')
            .eq('id', item_id)
            .eq('order_id', order_id)
            .maybeSingle();

        if (itemError) throw itemError;
        if (!item) return NextResponse.json({ error: 'Order item not found.' }, { status: 404 });

        const quantityDelta = nextQuantity - Number(item.quantity || 0);

        if (quantityDelta !== 0 && item.menu_item_id) {
            const { data: menuItem, error: menuItemError } = await supabase
                .from('menu_items')
                .select('id,stock,stock_type,linked_inventory_item_id')
                .eq('id', item.menu_item_id)
                .maybeSingle();

            if (menuItemError) throw menuItemError;

            if (menuItem?.stock_type === 'Inventoried') {
                if (menuItem.linked_inventory_item_id && item.batch_id) {
                    const { data: warehouse } = await supabase
                        .from('inventory_warehouses')
                        .select('id')
                        .eq('name', 'Restaurant')
                        .maybeSingle();

                    if (!warehouse?.id) {
                        return NextResponse.json({ error: 'Restaurant warehouse was not found.' }, { status: 400 });
                    }

                    const { data: stockRow, error: stockError } = await supabase
                        .from('inventory_stock')
                        .select('id,quantity')
                        .eq('warehouse_id', warehouse.id)
                        .eq('batch_id', item.batch_id)
                        .maybeSingle();

                    if (stockError) throw stockError;
                    if (!stockRow) return NextResponse.json({ error: 'Warehouse stock row was not found for this item batch.' }, { status: 404 });
                    if (quantityDelta > 0 && Number(stockRow.quantity || 0) < quantityDelta) {
                        return NextResponse.json({ error: `Insufficient warehouse stock. Available: ${stockRow.quantity}` }, { status: 400 });
                    }

                    const newStock = Number(stockRow.quantity || 0) - quantityDelta;
                    const { error: stockUpdateError } = await supabase
                        .from('inventory_stock')
                        .update({ quantity: newStock, last_updated: new Date().toISOString() })
                        .eq('id', stockRow.id);
                    if (stockUpdateError) throw stockUpdateError;

                    await supabase.from('inventory_transactions').insert({
                        item_id: menuItem.linked_inventory_item_id,
                        batch_id: item.batch_id,
                        transaction_type: quantityDelta > 0 ? 'issue' : 'return',
                        quantity: Math.abs(quantityDelta),
                        previous_stock: Number(stockRow.quantity || 0),
                        new_stock: newStock,
                        reason: quantityDelta > 0 ? 'Bill edit quantity increase' : 'Bill edit quantity reduction',
                        reference_department: warehouse.id,
                        created_by: user.userId,
                    });
                } else if (!menuItem.linked_inventory_item_id) {
                    const currentStock = Number(menuItem.stock || 0);
                    if (quantityDelta > 0 && currentStock < quantityDelta) {
                        return NextResponse.json({ error: `Insufficient menu stock. Available: ${currentStock}` }, { status: 400 });
                    }
                    const { error: menuStockError } = await supabase
                        .from('menu_items')
                        .update({ stock: currentStock - quantityDelta })
                        .eq('id', menuItem.id);
                    if (menuStockError) throw menuStockError;
                }
            }
        }

        const { error: updateItemError } = await supabase
            .from('order_items')
            .update({ price: nextPrice, quantity: nextQuantity })
            .eq('id', item_id);
        if (updateItemError) throw updateItemError;

        const { data: allItems, error: allItemsError } = await supabase
            .from('order_items')
            .select('price,quantity')
            .eq('order_id', order_id);
        if (allItemsError) throw allItemsError;

        const total = (allItems ?? []).reduce((sum: number, row: any) => sum + Number(row.price || 0) * Number(row.quantity || 0), 0);
        const { error: updateOrderError } = await supabase
            .from('orders')
            .update({
                total_price: total,
                confirmed_total: null,
                bill_breakdown: null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', order_id);
        if (updateOrderError) throw updateOrderError;

        return NextResponse.json({ item: { ...item, price: nextPrice, quantity: nextQuantity }, total_price: total });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Failed to update order item.' }, { status: 500 });
    }
}
