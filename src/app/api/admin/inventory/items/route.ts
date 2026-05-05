import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const includeStock = searchParams.get('includeStock') !== 'false';

        // Fetch items with category and unit
        let query = supabase
            .from('inventory_items')
            .select(`
                *,
                category:inventory_categories(id, name),
                unit:inventory_units(id, name)
            `)
            .order('name');

        const { data: items, error: itemsError } = await query;
        if (itemsError) throw itemsError;

        if (!includeStock) {
            return NextResponse.json({ items }, { status: 200 });
        }

        // Fetch stock for all items with warehouse and batch info
        const { data: stockData, error: stockError } = await supabase
            .from('inventory_stock')
            .select(`
                item_id, 
                quantity,
                warehouse:inventory_warehouses(id, name, department_id),
                batch:inventory_batches(id, batch_number, expiry_date)
            `);

        if (stockError) throw stockError;

        // Group stock per item
        const itemStockMap: Record<string, { total: number, warehouses: any[] }> = {};
        stockData.forEach((s: any) => {
            if (!itemStockMap[s.item_id]) {
                itemStockMap[s.item_id] = { total: 0, warehouses: [] };
            }
            itemStockMap[s.item_id].total += s.quantity;
            
            // Find if warehouse already in list
            let existingWH = itemStockMap[s.item_id].warehouses.find(w => w.id === s.warehouse?.id);
            if (!existingWH && s.warehouse) {
                existingWH = {
                    id: s.warehouse.id,
                    name: s.warehouse.name,
                    department_id: s.warehouse.department_id,
                    total_stock: 0,
                    batches: []
                };
                itemStockMap[s.item_id].warehouses.push(existingWH);
            }

            if (existingWH) {
                existingWH.total_stock += s.quantity;
                if (s.batch) {
                    existingWH.batches.push({
                        id: s.batch.id,
                        batch_number: s.batch.batch_number,
                        expiry_date: s.batch.expiry_date,
                        quantity: s.quantity
                    });
                }
            }
        });

        const itemsWithStock = items.map(item => ({
            ...item,
            total_stock: itemStockMap[item.id]?.total || 0,
            warehouse_stock: itemStockMap[item.id]?.warehouses || []
        }));

        return NextResponse.json({ items: itemsWithStock }, { status: 200 });
    } catch (error: any) {
        console.error('GET Items Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const body = await req.json();
        const { 
            name, 
            code, 
            description, 
            category_id, 
            unit_id, 
            batch_number, 
            buying_price, 
            expiry_date, 
            supplier,
            item_size,
            initial_quantity 
        } = body;

        if (!name || !category_id || !unit_id) {
            return NextResponse.json({ error: 'Missing required fields (name, category, unit)' }, { status: 400 });
        }

        // 1. Find or Create Item
        let item;
        
        // Try to find by code first (if provided)
        if (code && code !== 'AUTO') {
            const { data: byCode } = await supabase
                .from('inventory_items')
                .select('*')
                .eq('code', code)
                .maybeSingle();
            item = byCode;
        }

        // If not found by code, try finding by Name + Unit combination 
        // (Ensures "Yogurt 80ml" and "Yogurt 120ml" are distinct)
        if (!item) {
            const { data: byNameUnit } = await supabase
                .from('inventory_items')
                .select('*')
                .eq('name', name)
                .eq('unit_id', unit_id)
                .maybeSingle();
            
            if (byNameUnit) {
                // The user is attempting to register a new item that already exists.
                // We return an error so the UI can show the specific message they requested.
                return NextResponse.json({ 
                    error: `Item "${name}" with this unit is already registered in the system.`,
                    existing_item: byNameUnit 
                }, { status: 409 });
            }
        }

        if (item) {
            // Item exists, we'll use it
        } else {
            // 1.b Generate SKU if needed based on IDs
            let finalCode = code;
            const newItemId = crypto.randomUUID();

            if (!finalCode || finalCode === 'AUTO') {
                const itemPart = newItemId.substring(0, 5).toUpperCase();
                const unitPart = unit_id.substring(0, 4).toUpperCase();
                finalCode = `ID-${itemPart}-${unitPart}`;
            }

            const { data: newItem, error: itemError } = await supabase
                .from('inventory_items')
                .insert([{ 
                    id: newItemId,
                    name, 
                    code: finalCode, 
                    description, 
                    category_id, 
                    unit_id, 
                    item_size,
                    status: 'active' 
                }])
                .select()
                .single();
            if (itemError) {
                if (itemError.code === '23505') {
                    return NextResponse.json({ 
                        error: `The SKU/Code "${finalCode}" is already in use by another item.` 
                    }, { status: 409 });
                }
                throw itemError;
            }
            item = newItem;
        }

        // 2. Create or Find Initial Batch
        let batch;
        if (initial_quantity && initial_quantity > 0) {
            const predictableBatchNumber = batch_number || `INIT-${item.id.substring(0, 8)}`;
            
            // Check for existing batch for this item with this number
            const { data: existingBatch } = await supabase
                .from('inventory_batches')
                .select('*')
                .eq('item_id', item.id)
                .eq('batch_number', predictableBatchNumber)
                .maybeSingle();

            if (existingBatch) {
                batch = existingBatch;
            } else {
                const { data: newBatch, error: batchError } = await supabase
                    .from('inventory_batches')
                    .insert([{
                        item_id: item.id,
                        batch_number: predictableBatchNumber,
                        buying_price: buying_price || 0,
                        expiry_date: expiry_date || null,
                        supplier: supplier || 'Default Supplier',
                        status: 'active'
                    }])
                    .select()
                    .single();
                if (batchError) throw batchError;
                batch = newBatch;
            }

            // 3. Find Main Warehouse
            const { data: mainWarehouse, error: warehouseError } = await supabase
                .from('inventory_warehouses')
                .select('id')
                .eq('is_main', true)
                .maybeSingle();
            
            if (warehouseError) throw warehouseError;
            
            const warehouse_id = mainWarehouse?.id;
            if (!warehouse_id) {
                throw new Error('Main warehouse not found. Please ensure a warehouse is marked as "Main Store".');
            }

            // 4. Create/Update Stock Entry (Idempotent)
            const { data: existingStock } = await supabase
                .from('inventory_stock')
                .select('*')
                .eq('warehouse_id', warehouse_id)
                .eq('item_id', item.id)
                .eq('batch_id', batch.id)
                .maybeSingle();

            if (!existingStock) {
                const { error: stockError } = await supabase
                    .from('inventory_stock')
                    .insert([{
                        warehouse_id,
                        item_id: item.id,
                        batch_id: batch.id,
                        quantity: initial_quantity
                    }]);
                
                if (stockError) throw stockError;

                // 5. Create Transaction Record (Only if stock was just created)
                const { error: txError } = await supabase
                    .from('inventory_transactions')
                    .insert([{
                        item_id: item.id,
                        transaction_type: 'initial_stock',
                        quantity: initial_quantity,
                        new_stock: initial_quantity,
                        department_id: warehouse_id,
                        batch_id: batch.id,
                        remarks: `Initial stock intake for ${batch.batch_number}`,
                        created_by: (await verifyToken(token) as any).userId
                    }]);
                
                if (txError) throw txError;
            }
            // Note: We don't block if transaction fails, but ideally should be in a single transaction
        }

        return NextResponse.json({ item, batch }, { status: 201 });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const body = await req.json();
        const { id, name, code, description, category_id, unit_id, item_size } = body;

        if (!id || !name || !category_id || !unit_id) {
            return NextResponse.json({ error: 'Missing required fields (id, name, category, unit)' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('inventory_items')
            .update({ name, code, description, category_id, unit_id, item_size })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ item: data }, { status: 200 });
    } catch (error: any) {
        console.error('API PUT Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
