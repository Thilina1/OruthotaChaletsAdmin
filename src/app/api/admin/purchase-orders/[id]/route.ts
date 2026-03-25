import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken, decodeToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { data, error } = await supabase
            .from('purchase_orders')
            .select(`
                *,
                created_by_user:users!purchase_orders_created_by_fkey (name, email),
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

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const decoded = await decodeToken(token);
        const userId = decoded?.userId || decoded?.id || decoded?.sub;

        const body = await request.json();
        const { status, supplier_name, notes, item_prices } = body;

        // Get current PO state to check if we are transitioning to 'received'
        const { data: currentPO, error: fetchError } = await supabase
            .from('purchase_orders')
            .select('status')
            .eq('id', params.id)
            .single();
        
        if (fetchError) throw fetchError;

        // Update PO header
        const updatePayload: any = { updated_at: new Date().toISOString() };
        if (status) updatePayload.status = status;
        if (supplier_name !== undefined) updatePayload.supplier_name = supplier_name;
        if (notes !== undefined) updatePayload.notes = notes;

        const { data: po, error: poError } = await supabase
            .from('purchase_orders')
            .update(updatePayload)
            .eq('id', params.id)
            .select()
            .single();

        if (poError) throw poError;

        // Update item prices if provided (when receiving goods)
        if (item_prices && Array.isArray(item_prices)) {
            for (const item of item_prices) {
                try {
                    const total = item.unit_price && item.quantity
                        ? Number(item.unit_price) * Number(item.quantity)
                        : null;
                    
                    const itemUpdate: any = { 
                        unit_price: item.unit_price || null, 
                        total_price: total 
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

        // 🚀 Stock Update Logic: Only if PO status is changing TO 'received'
        if (status === 'received' && currentPO.status !== 'received') {
            // 1. Find the "Store" ID (Primary Store)
            const { data: warehouseDept, error: deptError } = await supabase
                .from('inventory_departments')
                .select('id')
                .eq('name', 'Store')
                .single();

            if (deptError) {
                console.error("Store department not found, defaulting to linked item's department.");
            }

            // Fetch all items in this PO
            const { data: items, error: itemsError } = await supabase
                .from('purchase_order_items')
                .select('*')
                .eq('po_id', params.id);
            
            if (itemsError) throw itemsError;

            for (const item of items) {
                // Determine target item: Force to Store version if possible, otherwise use linked item_id
                let targetItemId = item.item_id;
                let targetItemName = item.item_name;

                // Find the matching item data from the request body (item_prices) to get the latest quantities
                const requestItemData = item_prices?.find((ip: any) => ip.id === item.id);
                const quantityToAdd = Number(requestItemData?.received_quantity || item.received_quantity || item.quantity);

                // 1. If we have a warehouse dept, try to find the Store version regardless of current link
                if (warehouseDept) {
                    let searchName = item.item_name;
                    let searchCategory: string | null = null;

                    if (item.item_id) {
                        // Get details from linked item
                        const { data: originalItem } = await supabase
                            .from('hotel_inventory_items')
                            .select('name, category')
                            .eq('id', item.item_id)
                            .single();
                        
                        if (originalItem) {
                            searchName = originalItem.name;
                            searchCategory = originalItem.category;
                        }
                    }

                    // SEARCH in Store for this name
                    let storeQuery = supabase
                        .from('hotel_inventory_items')
                        .select('id')
                        .eq('name', searchName)
                        .eq('department_id', warehouseDept.id)
                        .is('deleted_at', null);
                    
                    if (searchCategory) {
                        storeQuery = storeQuery.eq('category', searchCategory);
                    }

                    const { data: storeItem } = await storeQuery.maybeSingle();
                    
                    if (storeItem) {
                        targetItemId = storeItem.id;
                    }
                }

                // 2. If we still don't have a targetItemId, but we have a name, try searching everywhere
                if (!targetItemId && item.item_name) {
                    const { data: fallbackItem } = await supabase
                        .from('hotel_inventory_items')
                        .select('id')
                        .eq('name', item.item_name)
                        .is('deleted_at', null)
                        .limit(1)
                        .maybeSingle();
                    
                    if (fallbackItem) {
                        targetItemId = fallbackItem.id;
                    }
                }

                if (targetItemId) {
                    // 1. Get current stock for the target item
                    const { data: invItem, error: invError } = await supabase
                        .from('hotel_inventory_items')
                        .select('current_stock, name')
                        .eq('id', targetItemId)
                        .single();
                    
                    if (invError) {
                        console.error(`Error fetching inventory item ${targetItemId}:`, invError);
                        continue;
                    }

                    const previousStock = Number(invItem.current_stock);
                    const newStock = previousStock + quantityToAdd;

                    // 2. Update stock levels and buying price
                    const updateData: any = { 
                        current_stock: newStock,
                        updated_at: new Date().toISOString()
                    };
                    
                    const actualUnitPrice = requestItemData?.unit_price || item.unit_price;
                    if (actualUnitPrice) {
                        updateData.buying_price = Number(actualUnitPrice);
                    }

                    const { error: stockUpdateError } = await supabase
                        .from('hotel_inventory_items')
                        .update(updateData)
                        .eq('id', targetItemId);
                    
                    if (stockUpdateError) {
                        console.error(`Error updating stock for ${invItem.name}:`, stockUpdateError);
                        continue;
                    }

                    // 3. Record transaction
                    await supabase.from('inventory_transactions').insert({
                        item_id: targetItemId,
                        transaction_type: 'receive',
                        quantity: quantityToAdd,
                        previous_stock: previousStock,
                        new_stock: newStock,
                        remarks: `Received via Purchase Order ${po.po_number}${targetItemId !== item.item_id ? ` (Matched to ${invItem.name})` : ''}`,
                        created_by: userId
                    });
                } else {
                    console.warn(`No inventory item found for PO item: ${item.item_name}. Stock not updated.`);
                }
            }
        }

        return NextResponse.json({ purchase_order: po }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
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
