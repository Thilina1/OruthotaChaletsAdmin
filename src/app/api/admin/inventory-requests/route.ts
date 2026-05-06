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
                id,
                request_type,
                item_id,
                requested_quantity,
                status,
                notes,
                action_metadata,
                brand,
                supplier_name,
                item_size,
                created_at,
                updated_at,
                item:inventory_items(
                    id,
                    name,
                    code,
                    unit:inventory_units(name)
                ),
                requester:users!inventory_requests_requested_by_fkey(name, email, department),
                reviewer:users!inventory_requests_reviewed_by_fkey(name, email)
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
        const { request_type, item_id, batch_id, requested_quantity, estimated_cost, notes, action_metadata, brand, supplier_name, item_size } = body;

        const dataToSave: any = {
            request_type,
            item_id: request_type === 'NEW_ITEM' ? null : item_id,
            requested_quantity,
            estimated_cost,
            notes,
            brand,
            supplier_name,
            item_size,
            action_metadata,
            status: 'PENDING',
            requested_by: decoded.userId || decoded.id || decoded.sub,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // NEW: Immediate Processing for New System (Stock Overview)
        if (body.immediate && ['transfer', 'audit_adjustment', 'issue', 'damage', 'initial_stock'].includes(request_type)) {
            const userId = decoded.userId || decoded.id || decoded.sub;
            dataToSave.status = 'COMPLETED';
            dataToSave.reviewed_by = userId;

            const totalRequestedQuantity = Number(requested_quantity || 0);
            const source_warehouse_id = body.warehouse_id;
            const target_warehouse_id = body.to_warehouse_id || action_metadata?.transfer_to_warehouse_id;
            const selected_batch_id = batch_id || null;

            if (!item_id || !source_warehouse_id) {
                return NextResponse.json({ error: 'Missing metadata for immediate processing' }, { status: 400 });
            }

            if (request_type === 'initial_stock') {
                // Specialized Logic for Initialization
                // 1. Resolve/Create a default batch if none specified
                let activeBatchId = selected_batch_id;
                
                if (!activeBatchId || activeBatchId === 'auto') {
                    const { data: existingBatch } = await supabase
                        .from('inventory_batches')
                        .select('id')
                        .eq('item_id', item_id)
                        .eq('batch_number', 'INITIAL')
                        .maybeSingle();
                    
                    if (existingBatch) {
                        activeBatchId = existingBatch.id;
                    } else {
                        const { data: newBatch, error: batchError } = await supabase
                            .from('inventory_batches')
                            .insert([{
                                item_id,
                                batch_number: 'INITIAL',
                                buying_price: 0,
                                supplier: 'System Initialization',
                                status: 'active'
                            }])
                            .select()
                            .single();
                        if (batchError) throw batchError;
                        activeBatchId = newBatch.id;
                    }
                }

                // 2. Create Stock Entry if it doesn't exist
                const { data: existingStock } = await supabase
                    .from('inventory_stock')
                    .select('*')
                    .eq('warehouse_id', source_warehouse_id)
                    .eq('item_id', item_id)
                    .eq('batch_id', activeBatchId)
                    .maybeSingle();

                if (!existingStock) {
                    await supabase.from('inventory_stock').insert([{
                        warehouse_id: source_warehouse_id,
                        item_id,
                        batch_id: activeBatchId,
                        quantity: totalRequestedQuantity,
                        last_updated: new Date().toISOString()
                    }]);

                    // 3. Record Transaction
                    await supabase.from('inventory_transactions').insert([{
                        item_id,
                        batch_id: activeBatchId,
                        transaction_type: 'initial_stock',
                        quantity: totalRequestedQuantity,
                        department_id: source_warehouse_id,
                        remarks: notes || 'Item initialized in warehouse',
                        created_by: userId
                    }]);
                } else if (totalRequestedQuantity > 0) {
                    // If it exists and we have quantity, we might want to ADD to it? 
                    // But usually initial_stock is for the very first time.
                    // For now, let's just update if it's 0.
                    if (Number(existingStock.quantity) === 0) {
                        await supabase.from('inventory_stock')
                            .update({ quantity: totalRequestedQuantity, last_updated: new Date().toISOString() })
                            .eq('id', existingStock.id);
                        
                        await supabase.from('inventory_transactions').insert([{
                            item_id,
                            batch_id: activeBatchId,
                            transaction_type: 'initial_stock',
                            quantity: totalRequestedQuantity,
                            department_id: source_warehouse_id,
                            remarks: notes || 'Stock adjusted via initial_stock request',
                            created_by: userId
                        }]);
                    }
                }
            } else {
                // Existing logic for transfer, issue, damage, audit
                // 1. Fetch relevant stock entries from source (either specific batch or all FIFO)
                let query = supabase.from('inventory_stock').select('*')
                    .eq('warehouse_id', source_warehouse_id)
                    .eq('item_id', item_id)
                    .gt('quantity', 0);
                
                if (selected_batch_id) {
                    query = query.eq('batch_id', selected_batch_id);
                } else {
                    query = query.order('last_updated', { ascending: true }); // FIFO order
                }

                const { data: stockEntries, error: stockFetchError } = await query;
                if (stockFetchError) throw stockFetchError;

                if (!stockEntries || stockEntries.length === 0) {
                    return NextResponse.json({ error: 'No stock found in source warehouse for this item.' }, { status: 400 });
                }

                // 2. Process Deduction (Iterate through batches to fulfill total quantity)
                let remainingQuantity = totalRequestedQuantity;

                for (const stock of stockEntries) {
                    if (remainingQuantity <= 0) break;

                    const takeAmt = Math.min(Number(stock.quantity), remainingQuantity);
                    const current_batch_id = stock.batch_id;
                    
                    // A. Update Source Stock
                    await supabase.from('inventory_stock')
                        .update({ quantity: Number(stock.quantity) - takeAmt, last_updated: new Date().toISOString() })
                        .eq('id', stock.id);

                    if (request_type === 'transfer') {
                        if (!target_warehouse_id) return NextResponse.json({ error: 'Destination warehouse is required for transfer' }, { status: 400 });

                        // B. Update/Create Destination Stock
                        const { data: targetStock } = await supabase.from('inventory_stock')
                            .select('*').eq('warehouse_id', target_warehouse_id).eq('item_id', item_id).eq('batch_id', current_batch_id).maybeSingle();

                        if (targetStock) {
                            await supabase.from('inventory_stock').update({ quantity: Number(targetStock.quantity) + takeAmt, last_updated: new Date().toISOString() }).eq('id', targetStock.id);
                        } else {
                            await supabase.from('inventory_stock').insert([{ warehouse_id: target_warehouse_id, item_id, batch_id: current_batch_id, quantity: takeAmt }]);
                        }

                        // C. Record Dual Transactions
                        await supabase.from('inventory_transactions').insert([
                            {
                                item_id,
                                batch_id: current_batch_id,
                                transaction_type: 'issue',
                                quantity: takeAmt,
                                department_id: source_warehouse_id,
                                reference_department: target_warehouse_id,
                                remarks: `FIFO Transfer to ${target_warehouse_id}. Ref: ${notes || 'Immediate'}`,
                                created_by: userId
                            },
                            {
                                item_id,
                                batch_id: current_batch_id,
                                transaction_type: 'receive',
                                quantity: takeAmt,
                                department_id: target_warehouse_id,
                                reference_department: source_warehouse_id,
                                remarks: `FIFO Transfer from ${source_warehouse_id}. Ref: ${notes || 'Immediate'}`,
                                created_by: userId
                            }
                        ]);
                    } else if (['issue', 'damage'].includes(request_type)) {
                        // C. Record Single Transaction
                        await supabase.from('inventory_transactions').insert([{
                            item_id,
                            batch_id: current_batch_id,
                            transaction_type: request_type,
                            quantity: takeAmt,
                            department_id: source_warehouse_id,
                            remarks: notes || 'Immediate Adjustment',
                            created_by: userId
                        }]);
                    } else if (request_type === 'audit_adjustment') {
                        await supabase.from('inventory_stock').update({ quantity: totalRequestedQuantity, last_updated: new Date().toISOString() }).eq('id', stock.id);
                        await supabase.from('inventory_transactions').insert([{
                            item_id,
                            batch_id: current_batch_id,
                            transaction_type: 'audit_adjustment',
                            quantity: totalRequestedQuantity - Number(stock.quantity),
                            department_id: source_warehouse_id,
                            remarks: notes || 'Immediate Audit',
                            created_by: userId
                        }]);
                        remainingQuantity = 0; // Stop after first batch for audit
                        break;
                    }

                    remainingQuantity -= takeAmt;
                }

                if (remainingQuantity > 0 && request_type !== 'audit_adjustment') {
                    return NextResponse.json({ error: `Insufficient total stock. Could only process ${totalRequestedQuantity - remainingQuantity} of ${totalRequestedQuantity} requested.` }, { status: 400 });
                }
            }
        }

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
        const { id, status, requested_quantity, request_type, notes, brand, supplier_name, item_size } = body;

        if (!id || !status) return NextResponse.json({ error: 'ID and status are required' }, { status: 400 });

        // First, get the request details
        const { data: requestData, error: fetchError } = await supabase
            .from('inventory_requests')
            .select('*, requester:users!inventory_requests_requested_by_fkey(department)')
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
            if (request_type) updatePayload.request_type = request_type;
            if (requested_quantity) updatePayload.requested_quantity = requested_quantity;
            if (notes !== undefined) updatePayload.notes = notes;
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
            // Purchase order check skipped due to missing purchase_order_id column
        }

        if (shouldProcessTransaction) {
            const req_metadata = requestData.action_metadata || {};
            const quantity = Number(body.received_quantity || requestData.requested_quantity);
            
            // Fetch source item information
            const { data: sourceItem, error: sourceError } = await supabase
                .from('inventory_items')
                .select(`
                    *,
                    unit:inventory_units(name)
                `)
                .eq('id', requestData.item_id)
                .single();

            if (sourceError || !sourceItem) throw new Error("Source item not found.");
            
            if (isExternalBuy) {
                // External Buy -> Resolve Batch then Update Main Store Stock
                // 1. Resolve/Create Batch
                const { data: batch, error: batchError } = await supabase
                    .from('inventory_batches')
                    .upsert({
                        item_id: sourceItem.id,
                        batch_number: req_metadata?.batch_number || '',
                        supplier: req_metadata?.supplier || '',
                        buying_price: Number(req_metadata?.unit_price) || 0,
                        expiry_date: req_metadata?.expiry_date || null,
                        status: 'active'
                    }, { onConflict: 'item_id,batch_number' }) // Assuming item_id and batch_number are the unique constraint
                    .select()
                    .single();

                if (batchError) throw batchError;

                // Find Main Warehouse
                const { data: mainWH } = await supabase
                    .from('inventory_warehouses')
                    .select('id')
                    .eq('is_main', true)
                    .single();
                
                if (!mainWH) throw new Error("Main warehouse not found.");

                // 2. Find/Create Stock Instance in Main Warehouse
                const { data: storeStock, error: storeStockError } = await supabase
                    .from('inventory_stock')
                    .select('*')
                    .eq('batch_id', batch.id)
                    .eq('warehouse_id', mainWH.id)
                    .maybeSingle();

                let prevStock = 0;
                if (storeStock) {
                    prevStock = Number(storeStock.quantity);
                    await supabase.from('inventory_stock')
                        .update({ 
                            quantity: prevStock + quantity,
                            last_updated: new Date().toISOString()
                        })
                        .eq('id', storeStock.id);
                } else {
                    await supabase.from('inventory_stock').insert({
                        item_id: sourceItem.id,
                        batch_id: batch.id,
                        warehouse_id: mainWH.id,
                        quantity: quantity,
                        last_updated: new Date().toISOString()
                    });
                }

                // 3. Record Transaction
                await supabase.from('inventory_transactions').insert({
                    item_id: sourceItem.id,
                    batch_id: batch.id,
                    transaction_type: 'receive',
                    quantity,
                    department_id: mainWH.id,
                    remarks: `External purchase for Main Store. Req #${id}`,
                    created_by: userId
                });
            } else if (requestData.request_type === 'TRANSFER_REQUEST') {
                // Internal Transfer (Issue from Store/Warehouse -> Add to Dept Warehouse)
                let targetDeptId = requestData.action_metadata?.requesting_department_id || (requestData.requester as any)?.department;
                if (!targetDeptId) throw new Error("Destination department could not be determined (missing metadata and requester department).");

                // Find destination warehouse for the target department
                // Fallback logic: check if targetDeptId is a UUID or a Name
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetDeptId);
                
                let destWHQuery = supabase.from('inventory_warehouses').select('id');
                if (isUUID) {
                    destWHQuery = destWHQuery.eq('department_id', targetDeptId);
                } else {
                    destWHQuery = destWHQuery.eq('name', targetDeptId);
                }

                const { data: destWH } = await destWHQuery.maybeSingle();
                
                if (!destWH) throw new Error(`No warehouse linked to destination department: ${targetDeptId}`);

                const allocations = body.batch_allocations && Array.isArray(body.batch_allocations) 
                    ? body.batch_allocations 
                    : [];

                if (allocations.length === 0) throw new Error("No batch allocations provided for transfer.");

                for (const allocation of allocations) {
                    const currentBatchId = allocation.batch_id;
                    const sourceWHId = allocation.warehouse_id; 
                    const currentQty = Number(allocation.quantity);

                    if (!currentBatchId || !sourceWHId || currentQty <= 0) continue;

                    // 1. Find the Source Stock Instance
                    const { data: sourceStock, error: sourceStockError } = await supabase
                        .from('inventory_stock')
                        .select('*')
                        .eq('item_id', requestData.item_id)
                        .eq('batch_id', currentBatchId)
                        .eq('warehouse_id', sourceWHId)
                        .single();

                    if (sourceStockError || !sourceStock) {
                        throw new Error(`Stock not found in source warehouse for batch ${currentBatchId}.`);
                    }
                    if (Number(sourceStock.quantity) < currentQty) {
                        throw new Error(`Insufficient stock in source warehouse. Available: ${sourceStock.quantity}`);
                    }

                    // 2. Subtract from Source
                    await supabase.from('inventory_stock')
                        .update({ 
                            quantity: Number(sourceStock.quantity) - currentQty,
                            last_updated: new Date().toISOString()
                        })
                        .eq('id', sourceStock.id);

                    // 3. Find/Create Target Stock Instance
                    const { data: targetStock } = await supabase
                        .from('inventory_stock')
                        .select('*')
                        .eq('item_id', requestData.item_id)
                        .eq('batch_id', currentBatchId)
                        .eq('warehouse_id', destWH.id)
                        .maybeSingle();

                    let prevTargetQty = 0;
                    if (targetStock) {
                        prevTargetQty = Number(targetStock.quantity);
                        await supabase.from('inventory_stock')
                            .update({ 
                                quantity: prevTargetQty + currentQty,
                                last_updated: new Date().toISOString()
                            })
                            .eq('id', targetStock.id);
                    } else {
                        await supabase.from('inventory_stock').insert({
                            item_id: requestData.item_id,
                            batch_id: currentBatchId,
                            warehouse_id: destWH.id,
                            quantity: currentQty,
                            last_updated: new Date().toISOString()
                        });
                    }

                    // 4. Record Transaction
                    await supabase.from('inventory_transactions').insert({
                        item_id: requestData.item_id,
                        batch_id: currentBatchId,
                        transaction_type: 'transfer',
                        quantity: currentQty,
                        from_department_id: sourceWHId,
                        to_department_id: destWH.id,
                        remarks: `Transfer to ${req_metadata?.requesting_department_name || 'Department'}. Req #${id}`,
                        created_by: userId
                    });
                }
            } else {
                // Direct Adjustments (issue, damage, audit)
                // Note: These should also be updated to use inventory_stock
                // For now, we'll assume they are handled via the stock overview or need further refactoring
                console.warn(`Direct adjustments for type ${requestData.request_type} not yet updated for new schema.`);
            }
        }

        // --- Sync with Purchase Order (Skipped due to missing column) ---
        /*
        if (status === 'COMPLETED' && requestData.purchase_order_id) {
            
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
        */
        return NextResponse.json({ request: updatedRequest }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
