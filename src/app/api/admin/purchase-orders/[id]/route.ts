import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken, decodeToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
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
            .eq('id', id)
            .single();

        if (error) throw error;
        return NextResponse.json({ purchase_order: data }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
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
            .eq('id', id)
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
            .eq('id', id)
            .select()
            .single();

        if (poError) throw poError;

        // --- NEW: General Sync for Line Items ---
        if (items && Array.isArray(items)) {
            // Get existing items to know what to delete
            const { data: existingItems } = await supabase
                .from('purchase_order_items')
                .select('id')
                .eq('po_id', id);
            
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
                    po_id: id,
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

        // 🚀 Modern Stock Update Logic
        if (status === 'received' && currentPO.status !== 'received') {
            // 1. Find Main Warehouse
            const { data: mainWarehouse } = await supabase
                .from('inventory_warehouses')
                .select('id')
                .eq('is_main', true)
                .maybeSingle();
            
            const warehouse_id = mainWarehouse?.id;
            if (!warehouse_id) throw new Error('Main warehouse not found. Please ensure a warehouse is marked as "Main Store".');

            // 2. Handle Extra Items: Add them to the PO record first so they exist in purchase_order_items
            const extraItems = item_prices?.filter((ip: any) => ip.is_extra) || [];
            if (extraItems.length > 0) {
                const extraItemRows = extraItems.map((item: any) => ({
                    po_id: id,
                    item_id: item.item_id,
                    item_name: item.item_name,
                    unit: item.unit || 'units',
                    quantity: 0, // Original quantity was 0
                    received_quantity: Number(item.received_quantity || 0),
                    unit_price: Number(item.unit_price || 0),
                    batch_number: item.batch_number || '',
                    expiry_date: item.expiry_date || null,
                    brand: item.brand || '',
                    item_size: item.item_size || '',
                    supplier_name: item.supplier_name || po.supplier_name || '',
                    status: 'received' // Mark as received immediately
                }));

                const { error: extrasError } = await supabase
                    .from('purchase_order_items')
                    .insert(extraItemRows);
                
                if (extrasError) console.error("Error adding extra items to PO:", extrasError);
            }

            // 3. Fetch all items (Original + just added Extras) to process stock
            const { data: allItemsToProcess, error: fetchError } = await supabase
                .from('purchase_order_items')
                .select('*')
                .eq('po_id', id);
            
            if (fetchError) throw fetchError;

            // 4. Process each item for inventory
            for (const item of allItemsToProcess) {
                // Find matching metadata from frontend submission
                // For original items, id is the DB id. For extras, we use item_id as a fallback for matching if needed, 
                // but since we just inserted them, it's safer to just process all items that have received_quantity > 0.
                
                const requestItemData = item_prices?.find((ip: any) => 
                    ip.is_extra ? (ip.item_id === item.item_id && ip.item_name === item.item_name) : (ip.id === item.id)
                );

                const quantityToAdd = Number(item.received_quantity || 0);
                if (quantityToAdd <= 0) continue;

                const batchNum = item.batch_number || `B-PO-${po.po_number}`;
                const unitPrice = Number(item.unit_price || 0);
                const item_id = item.item_id;

                if (!item_id) continue;

                // 4a. Resolve/Create Batch
                const { data: targetBatch } = await supabase
                    .from('inventory_batches')
                    .select('*')
                    .eq('item_id', item_id)
                    .eq('batch_number', batchNum)
                    .eq('buying_price', unitPrice)
                    .maybeSingle();

                let batch_id: string;
                if (targetBatch) {
                    batch_id = targetBatch.id;
                } else {
                    const { data: newBatch, error: batchError } = await supabase
                        .from('inventory_batches')
                        .insert([{
                            item_id,
                            batch_number: batchNum,
                            supplier: item.supplier_name || po.supplier_name || '',
                            buying_price: unitPrice,
                            expiry_date: item.expiry_date,
                            status: 'active'
                        }])
                        .select()
                        .single();
                    if (batchError) throw batchError;
                    batch_id = newBatch.id;
                }

                // 4b. Update/Create Stock Entry
                const { data: existingStock } = await supabase
                    .from('inventory_stock')
                    .select('*')
                    .eq('warehouse_id', warehouse_id)
                    .eq('item_id', item_id)
                    .eq('batch_id', batch_id)
                    .maybeSingle();

                let finalQuantity: number;
                if (existingStock) {
                    finalQuantity = Number(existingStock.quantity) + quantityToAdd;
                    await supabase
                        .from('inventory_stock')
                        .update({ quantity: finalQuantity, last_updated: new Date().toISOString() })
                        .eq('id', existingStock.id);
                } else {
                    finalQuantity = quantityToAdd;
                    await supabase
                        .from('inventory_stock')
                        .insert([{
                            warehouse_id,
                            item_id,
                            batch_id,
                            quantity: finalQuantity
                        }]);
                }

                // 4c. Record Transaction in the modern system (ONLY use existing columns)
                await supabase.from('inventory_transactions').insert([{
                    item_id,
                    batch_id,
                    transaction_type: 'receive',
                    quantity: quantityToAdd,
                    new_stock: finalQuantity,
                    department_id: warehouse_id, 
                    remarks: `PO Received: ${po.po_number}${item.quantity === 0 ? ' (Extra Item)' : ''}`,
                    created_by: userId
                }]);
            }

            // Sync inventory requests
            await supabase.from('inventory_requests')
                .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
                .eq('purchase_order_id', id)
                .neq('status', 'COMPLETED');
        }

        return NextResponse.json({ purchase_order: po }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { error } = await supabase
            .from('purchase_orders')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
