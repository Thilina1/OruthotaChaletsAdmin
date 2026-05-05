import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken, decodeToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function GET(request: Request, context: { params: { id: string } }) {
    try {
        const params = await context.params;
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { data, error } = await supabase
            .from('purchase_orders')
            .select(`
                *,
                created_by_user:users!purchase_orders_created_by_fkey (name, email),
                approved_by_user:users!purchase_orders_approved_by_fkey (name, email),
                purchase_order_items (*)
            `)
            .eq('id', params.id)
            .single();

        if (error) throw error;
        return NextResponse.json({ purchase_order: data }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request, context: { params: { id: string } }) {
    try {
        const params = await context.params;
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const decoded = await decodeToken(token);
        const userId = decoded?.userId || decoded?.id || decoded?.sub;

        const body = await request.json();
        const { status, supplier_name, notes, item_prices, items } = body;

        // Get current PO state to check if we are transitioning to 'received'
        const { data: currentPO, error: fetchError } = await supabase
            .from('purchase_orders')
            .select('status')
            .eq('id', params.id)
            .single();
        
        if (fetchError) throw fetchError;

        // Update PO header
        const updatePayload: any = { updated_at: new Date().toISOString() };
        if (status) {
            updatePayload.status = status;
            // Record approval details if transitioning to 'approved'
            if (status === 'approved') {
                updatePayload.approved_by = userId;
                updatePayload.approved_at = new Date().toISOString();
            }
        }
        if (supplier_name !== undefined) updatePayload.supplier_name = supplier_name;
        if (notes !== undefined) updatePayload.notes = notes;

        const { data: po, error: poError } = await supabase
            .from('purchase_orders')
            .update(updatePayload)
            .eq('id', params.id)
            .select()
            .single();

        if (poError) throw poError;

        // --- NEW: General Sync for Line Items ---
        if (items && Array.isArray(items)) {
            // Get existing items to know what to delete
            const { data: existingItems } = await supabase
                .from('purchase_order_items')
                .select('id')
                .eq('po_id', params.id);
            
            const existingIds = existingItems?.map(i => i.id) || [];
            const incomingIds = items.filter(i => i.id).map(i => i.id);
            const idsToDelete = existingIds.filter(id => !incomingIds.includes(id));

            // 1. Delete removed items
            if (idsToDelete.length > 0) {
                await supabase.from('purchase_order_items').delete().in('id', idsToDelete);
            }

            // 2. Insert or Update items
            for (const item of items) {
                const total = item.unit_price && item.quantity
                    ? Number(item.unit_price) * Number(item.quantity)
                    : null;

                const itemData: any = {
                    po_id: params.id,
                    item_id: item.item_id || null,
                    item_name: item.item_name,
                    unit: item.unit || 'units',
                    quantity: Number(item.quantity),
                    unit_price: item.unit_price ? Number(item.unit_price) : null,
                    total_price: total,
                    brand: item.brand || null,
                    item_size: item.item_size || null,
                    supplier_name: item.supplier_name || null
                };

                if (item.id) {
                    await supabase.from('purchase_order_items').update(itemData).eq('id', item.id);
                } else {
                    await supabase.from('purchase_order_items').insert(itemData);
                }
            }
        }

        // Update item prices if provided (when receiving goods - legacy flow)
        if (item_prices && Array.isArray(item_prices)) {
            for (const item of item_prices) {
                try {
                    const total = item.unit_price && item.quantity
                        ? Number(item.unit_price) * Number(item.quantity)
                        : null;
                    
                    const itemUpdate: any = { 
                        unit_price: item.unit_price || null, 
                        total_price: total,
                        brand: item.brand || undefined,
                        item_size: item.item_size || undefined,
                        supplier_name: item.supplier_name || undefined,
                        batch_number: item.batch_number || undefined,
                        expiry_date: item.expiry_date || undefined
                    };

                    // Only include received_quantity if provided
                    if (item.received_quantity !== undefined) {
                        itemUpdate.received_quantity = item.received_quantity;
                    }

                    const { error } = await supabase
                        .from('purchase_order_items')
                        .update(itemUpdate)
                        .eq('id', item.id);
                    
                    if (error) {
                        console.error(`Schema mismatch or error updating PO item ${item.id}:`, error.message);
                        // Fallback: try update without received_quantity
                        if (error.message.includes('column') && itemUpdate.received_quantity !== undefined) {
                            delete itemUpdate.received_quantity;
                            await supabase
                                .from('purchase_order_items')
                                .update(itemUpdate)
                                .eq('id', item.id);
                        }
                    }
                } catch (err: any) {
                    console.error(`Unexpected error updating PO item ${item.id}:`, err.message);
                }
            }
        }

        // 🚀 Stock Update Logic (unchanged from original except for param fixation)
        if (status === 'received' && currentPO.status !== 'received') {
            // ... [original stock logic] ...
            const { data: warehouseDept, error: deptError } = await supabase
                .from('inventory_departments')
                .select('id')
                .eq('name', 'Store')
                .single();

            const { data: itemsForStock, error: itemsError } = await supabase
                .from('purchase_order_items')
                .select('*')
                .eq('po_id', params.id);
            
            if (itemsError) throw itemsError;

            for (const item of itemsForStock) {
                const requestItemData = item_prices?.find((ip: any) => ip.id === item.id);
                const quantityToAdd = Number(requestItemData?.received_quantity || item.received_quantity || item.quantity);
                if (quantityToAdd <= 0) continue;

                const brand = requestItemData?.brand || item.brand || '';
                const supplier = requestItemData?.supplier_name || item.supplier_name || po.supplier_name || '';
                const size = requestItemData?.item_size || item.item_size || '';
                const batch = requestItemData?.batch_number || item.batch_number || '';
                const expiry = requestItemData?.expiry_date || item.expiry_date || null;

                let productId = null;
                if (item.item_id) {
                    const { data: invItem } = await supabase.from('hotel_inventory_items').select('product_id').eq('id', item.item_id).single();
                    productId = invItem?.product_id;
                }
                if (!productId) {
                    const { data: prod } = await supabase.from('hotel_inventory_products').select('id').eq('name', item.item_name).maybeSingle();
                    productId = prod?.id;
                }
                if (!productId) continue;

                const targetDeptId = warehouseDept?.id || (item as any).department_id;
                const { data: existingBatchItem } = await supabase
                    .from('hotel_inventory_items')
                    .select('*')
                    .eq('product_id', productId)
                    .eq('department_id', targetDeptId)
                    .eq('batch_number', batch)
                    .eq('item_size', size)
                    .eq('brand', brand)
                    .eq('supplier', supplier)
                    .is('deleted_at', null)
                    .maybeSingle();

                if (existingBatchItem) {
                    const prevStock = Number(existingBatchItem.current_stock);
                    const newStock = prevStock + quantityToAdd;
                    await supabase.from('hotel_inventory_items').update({
                        current_stock: newStock,
                        buying_price: Number(requestItemData?.unit_price || item.unit_price || existingBatchItem.buying_price),
                        expiry_date: expiry || existingBatchItem.expiry_date,
                        updated_at: new Date().toISOString()
                    }).eq('id', existingBatchItem.id);
                    await supabase.from('inventory_transactions').insert({
                        item_id: existingBatchItem.id, transaction_type: 'receive', quantity: quantityToAdd,
                        previous_stock: prevStock, new_stock: newStock, remarks: `PO Received: ${po.po_number}`, created_by: userId
                    });
                } else {
                    const { data: prodDetails } = await supabase.from('hotel_inventory_products').select('*').eq('id', productId).single();
                    const { data: newItem } = await supabase.from('hotel_inventory_items').insert({
                        product_id: productId, name: prodDetails?.name || item.item_name, category: prodDetails?.category || 'Food & Beverage',
                        unit: prodDetails?.unit || item.unit || 'units', department_id: targetDeptId, current_stock: quantityToAdd,
                        buying_price: Number(requestItemData?.unit_price || item.unit_price || 0), batch_number: batch,
                        expiry_date: expiry, brand: brand, item_size: size, supplier: supplier,
                    }).select().single();
                    await supabase.from('inventory_transactions').insert({
                        item_id: newItem.id, transaction_type: 'receive', quantity: quantityToAdd,
                        previous_stock: 0, new_stock: quantityToAdd, remarks: `PO Received (New Batch): ${po.po_number}`, created_by: userId
                    });
                }
            }

            await supabase.from('inventory_requests').update({ status: 'COMPLETED', updated_at: new Date().toISOString() }).eq('purchase_order_id', params.id).neq('status', 'COMPLETED');
        }

        return NextResponse.json({ purchase_order: po }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: { params: { id: string } }) {
    try {
        const params = await context.params;
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { error } = await supabase
            .from('purchase_orders')
            .delete()
            .eq('id', params.id);

        if (error) throw error;
        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
