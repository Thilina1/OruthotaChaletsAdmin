import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken, decodeToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const isValid = await verifyToken(token);
        if (!isValid) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const decoded = await decodeToken(token);
        if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const userRole = decoded.role;
        const userId = decoded.userId || decoded.id || decoded.sub;

        const { searchParams } = new URL(request.url);
        const statusStr = searchParams.get('status');

        let query = supabase
            .from('inventory_requests')
            .select(`
                *,
                item:hotel_inventory_items(
                    name, 
                    unit, 
                    category,
                    department:inventory_departments(name)
                ),
                requester:users!inventory_requests_requested_by_fkey(name, email, department),
                reviewer:users!inventory_requests_reviewed_by_fkey(name, email),
                purchase_order_id
            `)
            .order('created_at', { ascending: false });

        if (statusStr) {
            query = query.eq('status', statusStr);
        }

        // Admins see all requests.
        // Non-admins with explicit inventory-requests permission see all.
        // Everyone else only sees their own requests.
        if (userRole !== 'admin') {
            const { data: userData } = await supabase
                .from('users')
                .select('permissions')
                .eq('id', userId)
                .single();

            const hasInventoryRequestsPermission =
                Array.isArray(userData?.permissions) &&
                userData.permissions.includes('/dashboard/inventory-requests');

            if (!hasInventoryRequestsPermission) {
                query = query.eq('requested_by', userId);
            }
        }

        const { data, error } = await query;

        if (error) throw error;

        return NextResponse.json({ requests: data }, { status: 200 });
    } catch (error: any) {
        console.error("GET inventory-requests error", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const isValid = await verifyToken(token);
        if (!isValid) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const decoded = await decodeToken(token);
        console.log("DECODED TOKEN:", decoded);
        if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const body = await request.json();
        const { request_type, item_id, requested_quantity, estimated_cost, notes, action_metadata } = body;

        const dataToSave = {
            request_type,
            item_id: request_type === 'NEW_ITEM' ? null : item_id,
            requested_quantity,
            estimated_cost,
            notes,
            action_metadata,
            status: 'PENDING',
            requested_by: decoded.userId || decoded.id || decoded.sub,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('inventory_requests')
            .insert(dataToSave)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ request: data }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const isValid = await verifyToken(token);
        if (!isValid) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const decoded = await decodeToken(token);
        if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const userRole = decoded.role;
        const userId = decoded.userId || decoded.id || decoded.sub;

        // Admins can always manage requests.
        // Non-admins need explicit inventory-requests permission.
        if (userRole !== 'admin') {
            const { data: userData } = await supabase
                .from('users')
                .select('permissions')
                .eq('id', userId)
                .single();

            const hasPermission =
                Array.isArray(userData?.permissions) &&
                userData.permissions.includes('/dashboard/inventory-requests');

            if (!hasPermission) {
                return NextResponse.json({ error: 'Forbidden. You do not have permission to update inventory requests.' }, { status: 403 });
            }
        }

        const body = await request.json();
        const { id, status, requested_quantity, request_type, notes } = body;

        if (!id || !status) return NextResponse.json({ error: 'ID and status are required' }, { status: 400 });

        // First, get the request details
        const { data: requestData, error: fetchError } = await supabase
            .from('inventory_requests')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;
        if (!requestData) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

        // 1. Get Store Department ID
        const { data: storeDept, error: storeDeptError } = await supabase
            .from('inventory_departments')
            .select('id')
            .eq('name', 'Store')
            .single();
        if (storeDeptError) throw new Error("Warehouse 'Store' department not found.");

        const isExternalBuy = ['ADD_STOCK', 'NEW_ITEM'].includes(requestData.request_type) || 
                             (requestData.request_type === 'TRANSFER_REQUEST' && requestData.action_metadata?.needs_external_purchase);

        // Update Payload tweaks
        const updatePayload: any = {
            updated_at: new Date().toISOString()
        };

        if (status === 'APPROVED' || status === 'REJECTED' || status === 'PENDING') {
            updatePayload.status = status;
            updatePayload.reviewed_by = userId;
            if (requested_quantity !== undefined) updatePayload.requested_quantity = requested_quantity;
            if (request_type) updatePayload.request_type = request_type;
            if (notes !== undefined) updatePayload.notes = notes;
            if (body.action_metadata) {
                updatePayload.action_metadata = { ...(requestData.action_metadata || {}), ...body.action_metadata };
            }
        }

        if (status === 'COMPLETED') {
            const existingMeta = requestData.action_metadata || {};
            const newMeta = {
                ...existingMeta,
                actual_cost: body.actual_cost,
                received_quantity: body.received_quantity,
                item_price: body.item_price
            };

            // If it's a TRANSFER_REQUEST being "Received" from external, it becomes APPROVED (not completed)
            if (requestData.request_type === 'TRANSFER_REQUEST' && existingMeta.needs_external_purchase) {
                updatePayload.status = 'APPROVED';
                newMeta.needs_external_purchase = false; // Stock is now in store
            } else {
                updatePayload.status = 'COMPLETED';
            }
            updatePayload.action_metadata = newMeta;
        }

        const { data: updatedRequest, error: updateError } = await supabase
            .from('inventory_requests')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();
        if (updateError) throw updateError;

        // --- Transaction & Stock Processing ---
        const stockAffectingTypes = ['ADD_STOCK', 'receive', 'issue', 'damage', 'audit_adjustment', 'initial_stock', 'TRANSFER_REQUEST'];
        let shouldProcessTransaction = false;

        if (stockAffectingTypes.includes(requestData.request_type) && requestData.item_id) {
            // We process on 'COMPLETED' (which might have been converted to 'APPROVED' in our payload for transfers)
            if (status === 'COMPLETED') shouldProcessTransaction = true;
            else if (!['ADD_STOCK', 'TRANSFER_REQUEST'].includes(requestData.request_type) && status === 'APPROVED') {
                shouldProcessTransaction = true;
            }
        }

        if (shouldProcessTransaction) {
            // Check if this request is part of a PO and if that PO is already received
            if (requestData.purchase_order_id) {
                const { data: po } = await supabase
                    .from('purchase_orders')
                    .select('status')
                    .eq('id', requestData.purchase_order_id)
                    .single();
                
                if (po?.status === 'received') {
                    console.log(`Request ${id} is part of PO ${requestData.purchase_order_id} which is already received. Skipping duplicate stock update.`);
                    shouldProcessTransaction = false;
                }
            }
        }

        if (shouldProcessTransaction) {
            const req_metadata = requestData.action_metadata || {};
            const quantity = Number(body.received_quantity || requestData.requested_quantity);
            
            if (isExternalBuy) {
                // External Buy -> Always hits the Store
                // 1. Find the target item in the Store
                const { data: requestedItem, error: reqItemError } = await supabase.from('hotel_inventory_items').select('name, category').eq('id', requestData.item_id).single();
                if (reqItemError || !requestedItem) throw new Error("Requested item not found.");
                
                const { data: storeItemData, error: storeItemError } = await supabase
                    .from('hotel_inventory_items')
                    .select('id, current_stock')
                    .eq('name', requestedItem.name)
                    .eq('category', requestedItem.category)
                    .eq('department_id', storeDept.id)
                    .single();

                if (storeItemError || !storeItemData) throw new Error(`Item ${requestedItem.name} not found in Store inventory.`);

                const previousStoreStock = Number(storeItemData.current_stock);
                const newStoreStock = previousStoreStock + quantity;

                // 2. Update Store Stock
                await supabase.from('hotel_inventory_items').update({ current_stock: newStoreStock }).eq('id', storeItemData.id);

                // 3. Record Transaction (Receive for Store)
                await supabase.from('inventory_transactions').insert({
                    item_id: storeItemData.id,
                    transaction_type: 'receive',
                    quantity,
                    previous_stock: previousStoreStock,
                    new_stock: newStoreStock,
                    brand: req_metadata?.brand,
                    expiry_date: req_metadata?.expiry_date,
                    unit_price: req_metadata?.unit_price,
                    barcode: req_metadata?.barcode,
                    remarks: `External purchase received into Store. ${requestData.request_type === 'TRANSFER_REQUEST' ? 'Originating from Transfer Request.' : ''}`,
                    created_by: userId
                });

            } else if (requestData.request_type === 'TRANSFER_REQUEST') {
                // Internal Transfer (Issue from Store -> Add to Dept)
                // 1. Get Destination Item Info
                const { data: destItemData, error: destItemError } = await supabase.from('hotel_inventory_items').select('id, current_stock, name, category').eq('id', requestData.item_id).single();
                if (destItemError || !destItemData) throw new Error("Destination item not found.");
                
                // 2. Get Source (Store) Item Info
                const { data: sourceItemData, error: sourceItemError } = await supabase
                    .from('hotel_inventory_items')
                    .select('id, current_stock')
                    .eq('name', destItemData.name)
                    .eq('category', destItemData.category)
                    .eq('department_id', storeDept.id)
                    .single();

                if (sourceItemError || !sourceItemData) throw new Error(`Item ${destItemData.name} not found in Store.`);
                if (Number(sourceItemData.current_stock) < quantity) throw new Error(`Insufficient stock in Store for ${destItemData.name}.`);

                const sourceNewStock = Number(sourceItemData.current_stock) - quantity;
                const destNewStock = Number(destItemData.current_stock) + quantity;

                // 3. Update Stocks
                await supabase.from('hotel_inventory_items').update({ current_stock: sourceNewStock }).eq('id', sourceItemData.id);
                await supabase.from('hotel_inventory_items').update({ current_stock: destNewStock }).eq('id', destItemData.id);

                // 4. Record Transactions
                await supabase.from('inventory_transactions').insert([
                    {
                        item_id: sourceItemData.id,
                        transaction_type: 'issue',
                        quantity,
                        previous_stock: Number(sourceItemData.current_stock),
                        new_stock: sourceNewStock,
                        reference_department: requestData.action_metadata?.requesting_department_id || null,
                        brand: req_metadata?.brand,
                        expiry_date: req_metadata?.expiry_date,
                        unit_price: req_metadata?.unit_price,
                        barcode: req_metadata?.barcode,
                        remarks: `Internal transfer to ${requestData.action_metadata?.requesting_department_name || 'Department'}`,
                        created_by: userId
                    },
                    {
                        item_id: destItemData.id,
                        transaction_type: 'receive',
                        quantity,
                        previous_stock: Number(destItemData.current_stock),
                        new_stock: destNewStock,
                        reference_department: storeDept.id,
                        brand: req_metadata?.brand,
                        expiry_date: req_metadata?.expiry_date,
                        unit_price: req_metadata?.unit_price,
                        barcode: req_metadata?.barcode,
                        remarks: `Internal transfer from Store`,
                        created_by: userId
                    }
                ]);
            } else {
                // Other stock-affecting types for non-transfer/non-buy requests (e.g., direct audit, damage)
                const { data: itemData, error: itemError } = await supabase.from('hotel_inventory_items').select('current_stock').eq('id', requestData.item_id).single();
                if (itemError || !itemData) throw new Error("Item not found.");
                const previousStock = Number(itemData.current_stock);
                let newStock = previousStock;

                if (['receive', 'initial_stock'].includes(requestData.request_type)) newStock += quantity;
                else if (['issue', 'damage'].includes(requestData.request_type)) newStock -= quantity;
                else if (requestData.request_type === 'audit_adjustment') newStock = quantity;

                await supabase.from('hotel_inventory_items').update({ current_stock: newStock }).eq('id', requestData.item_id);
                await supabase.from('inventory_transactions').insert({
                    item_id: requestData.item_id,
                    transaction_type: requestData.request_type,
                    quantity: requestData.request_type === 'audit_adjustment' ? (quantity - previousStock) : quantity,
                    previous_stock: previousStock,
                    new_stock: newStock,
                    brand: req_metadata?.brand,
                    item_size: req_metadata?.item_size || (requestData as any).item?.item_size,
                    expiry_date: req_metadata?.expiry_date,
                    unit_price: req_metadata?.unit_price,
                    barcode: req_metadata?.barcode,
                    batch_number: req_metadata?.batch_number,
                    supplier: req_metadata?.supplier,
                    remarks: requestData.notes || null,
                    created_by: userId
                });
            }
        }

        // --- Sync with Purchase Order ---
        if (status === 'COMPLETED' && requestData.purchase_order_id) {
            // Check if all requests for this PO are now COMPLETED
            const { data: siblingRequests } = await supabase
                .from('inventory_requests')
                .select('id, status')
                .eq('purchase_order_id', requestData.purchase_order_id);
            
            const allCompleted = siblingRequests?.every(r => (r as any).status === 'COMPLETED' || r.id === id); // Current update might not be in the list yet with new status
            
            if (allCompleted) {
                await supabase
                    .from('purchase_orders')
                    .update({ 
                        status: 'received',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', requestData.purchase_order_id);
            }

            // Also update the individual item in PO items to show it's received
            const { data: items } = await supabase
                .from('purchase_order_items')
                .select('id, received_quantity, quantity')
                .eq('po_id', requestData.purchase_order_id)
                .eq('item_name', (requestData as any).item?.name || requestData.notes || ''); // Rough matching if direct link is missing
            
            if (items && items.length > 0) {
                for (const item of items) {
                    await supabase
                        .from('purchase_order_items')
                        .update({ 
                            received_quantity: body.received_quantity || requestData.requested_quantity,
                            updated_at: new Date().toISOString() 
                        } as any)
                        .eq('id', item.id);
                }
            }
        }

        return NextResponse.json({ request: updatedRequest }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
