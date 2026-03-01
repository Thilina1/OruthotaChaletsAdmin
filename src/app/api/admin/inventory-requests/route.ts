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
                item:hotel_inventory_items(name, unit),
                requester:users!inventory_requests_requested_by_fkey(name, email),
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
        const { id, status } = body;

        if (!id || !status) return NextResponse.json({ error: 'ID and status are required' }, { status: 400 });

        // First, get the request details
        const { data: requestData, error: fetchError } = await supabase
            .from('inventory_requests')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;
        if (!requestData) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

        // Allowed transitions
        if (status === 'COMPLETED') {
            if (requestData.status !== 'APPROVED') return NextResponse.json({ error: 'Only approved requests can be completed' }, { status: 400 });
        } else if (status === 'APPROVED' || status === 'REJECTED') {
            if (requestData.status !== 'PENDING') return NextResponse.json({ error: 'Only pending requests can be approved or rejected' }, { status: 400 });
        }

        // Update the status of the request
        // Only update reviewed_by and updated_at if it's the first non-pending status change
        const updatePayload: any = {
            status,
            updated_at: new Date().toISOString()
        };

        if (status === 'APPROVED' || status === 'REJECTED') {
            updatePayload.reviewed_by = decoded.userId || decoded.id || decoded.sub;
        }

        // If completing, we might have actual cost and quantity
        if (status === 'COMPLETED') {
            const existingMeta = requestData.action_metadata || {};
            updatePayload.action_metadata = {
                ...existingMeta,
                actual_cost: body.actual_cost,
                received_quantity: body.received_quantity,
                item_price: body.item_price
            };
        }

        const { data: updatedRequest, error: updateError } = await supabase
            .from('inventory_requests')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        const stockAffectingTypes = ['ADD_STOCK', 'receive', 'issue', 'damage', 'audit_adjustment', 'initial_stock'];

        // Determine if we should process the transaction.
        // For ADD_STOCK, we process ONLY on 'COMPLETED'.
        // For other types, we process on 'APPROVED'.
        let shouldProcessTransaction = false;

        if (stockAffectingTypes.includes(requestData.request_type) && requestData.item_id) {
            if (requestData.request_type === 'ADD_STOCK' && status === 'COMPLETED') {
                shouldProcessTransaction = true;
            } else if (requestData.request_type !== 'ADD_STOCK' && status === 'APPROVED') {
                shouldProcessTransaction = true;
            }
        }

        if (shouldProcessTransaction) {
            // Fetch current stock
            const { data: itemData, error: itemError } = await supabase
                .from('hotel_inventory_items')
                .select('current_stock')
                .eq('id', requestData.item_id)
                .single();

            if (itemError) throw itemError;

            const previousStock = Number(itemData.current_stock);
            let newStock = previousStock;

            // Use received_quantity if COMPLETED and available, otherwise requested_quantity
            const q = (status === 'COMPLETED' && body.received_quantity)
                ? Number(body.received_quantity)
                : Number(requestData.requested_quantity);

            if (['ADD_STOCK', 'receive', 'initial_stock'].includes(requestData.request_type)) {
                newStock += q;
            } else if (['issue', 'damage'].includes(requestData.request_type)) {
                newStock -= q;
            } else if (requestData.request_type === 'audit_adjustment') {
                newStock = q;
            }

            // Insert transaction record
            const { error: txnError } = await supabase
                .from('inventory_transactions')
                .insert({
                    item_id: requestData.item_id,
                    transaction_type: requestData.request_type === 'ADD_STOCK' ? 'receive' : requestData.request_type,
                    quantity: requestData.request_type === 'audit_adjustment' ? (q - previousStock) : q,
                    previous_stock: previousStock,
                    new_stock: newStock,
                    reference_department: requestData.action_metadata?.reference_department || null,
                    reason: requestData.action_metadata?.reason || null,
                    remarks: requestData.notes || null,
                    created_by: decoded.userId || decoded.id || decoded.sub
                });

            if (txnError) throw txnError;

            // Update item stock
            const { error: stockUpdateError } = await supabase
                .from('hotel_inventory_items')
                .update({
                    current_stock: newStock,
                    updated_at: new Date().toISOString()
                })
                .eq('id', requestData.item_id);

            if (stockUpdateError) throw stockUpdateError;
        }

        return NextResponse.json({ request: updatedRequest }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
