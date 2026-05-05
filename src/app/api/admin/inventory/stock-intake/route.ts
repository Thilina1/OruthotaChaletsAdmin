import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken, decodeToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function processIntake(supabase: any, data: any, userId: string) {
    const {
        item_id: input_item_id,
        name: product_name,
        code,
        category_id,
        unit_id,
        warehouse_id,
        quantity,
        unit_price,
        batch_number,
        supplier,
        expiry_date,
        notes
    } = data;

    if ((!input_item_id && !product_name) || !quantity || !warehouse_id) {
        throw new Error('Missing required fields for one of the items (Item, Quantity, or Warehouse)');
    }

    let item_id = input_item_id;

    // 1. Ensure Item exists
    if (!item_id) {
        const { data: existingItem } = await supabase
            .from('inventory_items')
            .select('*')
            .or(`code.eq.${code || 'NO_CODE'},name.ilike."${product_name}"`)
            .maybeSingle();

        if (existingItem) {
            item_id = existingItem.id;
        } else {
            if (!category_id || !unit_id) {
                throw new Error('Category and Unit are required for new items');
            }
            const { data: newItem, error: itemError } = await supabase
                .from('inventory_items')
                .insert([{
                    name: product_name,
                    code: code || `ITM-${Date.now()}`,
                    category_id,
                    unit_id,
                    status: 'active'
                }])
                .select()
                .single();
            
            if (itemError) throw itemError;
            item_id = newItem.id;
        }
    }

    // 2. Resolve/Create Batch
    const { data: targetBatch, error: batchLookupError } = await supabase
        .from('inventory_batches')
        .select('*')
        .eq('item_id', item_id)
        .eq('batch_number', batch_number || '')
        .eq('supplier', supplier || '')
        .eq('buying_price', Number(unit_price) || 0)
        .or(`expiry_date.eq.${expiry_date || '1900-01-01'},expiry_date.is.null`)
        .maybeSingle();

    let batch_id: string;
    if (targetBatch) {
        batch_id = targetBatch.id;
    } else {
        const { data: newBatch, error: batchCreateError } = await supabase
            .from('inventory_batches')
            .insert([{
                item_id,
                batch_number: batch_number || `B-${Date.now()}`,
                supplier: supplier || 'Default Supplier',
                buying_price: Number(unit_price) || 0,
                expiry_date: expiry_date || null,
                status: 'active'
            }])
            .select()
            .single();
        
        if (batchCreateError) throw batchCreateError;
        batch_id = newBatch.id;
    }

    // 3. Update/Create Stock Entry
    const { data: existingStock, error: stockLookupError } = await supabase
        .from('inventory_stock')
        .select('*')
        .eq('warehouse_id', warehouse_id)
        .eq('item_id', item_id)
        .eq('batch_id', batch_id)
        .maybeSingle();

    let finalQuantity: number;
    if (existingStock) {
        finalQuantity = Number(existingStock.quantity) + Number(quantity);
        const { error: stockUpdateError } = await supabase
            .from('inventory_stock')
            .update({ quantity: finalQuantity, last_updated: new Date().toISOString() })
            .eq('id', existingStock.id);
        
        if (stockUpdateError) throw stockUpdateError;
    } else {
        finalQuantity = Number(quantity);
        const { error: stockCreateError } = await supabase
            .from('inventory_stock')
            .insert([{
                warehouse_id,
                item_id,
                batch_id,
                quantity: finalQuantity
            }]);
        
        if (stockCreateError) throw stockCreateError;
    }

    // 4. Record Transaction
    const { error: txError } = await supabase
        .from('inventory_transactions')
        .insert([{
            item_id,
            batch_id,
            transaction_type: 'receive',
            quantity: Number(quantity),
            new_stock: finalQuantity,
            department_id: warehouse_id, 
            remarks: notes || `Stock intake (GRN) for batch ${batch_number || batch_id}`,
            created_by: userId
        }]);
    
    if (txError) throw txError;

    return { item_id, batch_id, new_quantity: finalQuantity };
}

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const decoded = await decodeToken(token);
        if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        const userId = decoded.userId || decoded.id || decoded.sub || 'system';

        const body = await req.json();

        // Support for multiple items
        if (body.items && Array.isArray(body.items)) {
            const results = [];
            for (const item of body.items) {
                const itemData = {
                    ...item,
                    warehouse_id: item.warehouse_id || body.warehouse_id,
                    supplier: item.supplier || body.supplier,
                    notes: item.notes || body.notes
                };
                const result = await processIntake(supabase, itemData, userId);
                results.push(result);
            }
            return NextResponse.json({ success: true, processed_count: results.length, results }, { status: 200 });
        }

        const result = await processIntake(supabase, body, userId);
        return NextResponse.json({ success: true, ...result }, { status: 200 });

    } catch (error: any) {
        console.error('Stock Intake Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
