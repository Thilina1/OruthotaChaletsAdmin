import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth-utils';

export async function POST(req: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    try {
        const body = await req.json();
        const {
            product_id: input_product_id,
            product_name,
            category,
            unit,
            department_id: input_department_id,
            received_quantity,
            unit_price,
            batch_number,
            supplier,
            expiry_date,
            barcode,
            item_size,
            brand,
            notes
        } = body;

        if ((!input_product_id && !product_name) || !received_quantity || !input_department_id) {
            return NextResponse.json({ error: 'Missing required fields (Product, Quantity, or Store)' }, { status: 400 });
        }

        let product_id = input_product_id;
        let productDetails: any = null;

        // 1. Ensure Product (Variant) Exists
        // We strictly identify variants by Name + Brand + Size.
        // If a product_id was provided, we still check if the metadata matches.
        
        let targetProduct: any = null;
        const normalizedName = product_name?.trim() || '';
        const normalizedBrand = brand || '';
        const normalizedSize = item_size || '';

        const { data: existingVariant } = await supabase
            .from('hotel_inventory_products')
            .select('*')
            .ilike('name', normalizedName)
            .eq('brand', normalizedBrand)
            .eq('item_size', normalizedSize)
            .maybeSingle();

        if (existingVariant) {
            product_id = existingVariant.id;
            targetProduct = existingVariant;
        } else if (normalizedName) {
            // Create new variant
            const { data: newVariant, error: prodError } = await supabase
                .from('hotel_inventory_products')
                .insert({
                    name: normalizedName,
                    brand: normalizedBrand,
                    item_size: normalizedSize,
                    category: category || 'Food & Beverage',
                    unit: unit || 'Nos',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (prodError) throw prodError;
            product_id = newVariant.id;
            targetProduct = newVariant;
        } else if (product_id) {
            // Fallback for ID-only lookups (should be rare if metadata is provided)
            const { data: existingById } = await supabase
                .from('hotel_inventory_products')
                .select('*')
                .eq('id', product_id)
                .single();
            targetProduct = existingById;
        }

        if (!product_id) {
            throw new Error("Failed to identify or create product variant. Please ensure Product Name is provided.");
        }
        productDetails = targetProduct;

        // 2. Resolve/Create Batch
        // Use COALESCE logic similar to the DB unique index for consistent lookup
        const lookupExpiry = expiry_date || '1900-01-01';
        
        const { data: targetBatch, error: batchLookupError } = await supabase
            .from('inventory_batches')
            .select('*')
            .eq('product_id', product_id)
            .eq('batch_number', batch_number || '')
            .eq('supplier', supplier || '')
            .eq('buying_price', Number(unit_price) || 0)
            .or(`expiry_date.eq.${lookupExpiry},expiry_date.is.null`) // Fallback for various null representations
            .maybeSingle();

        // Refine lookup correctly: If lookupExpiry is 1900-01-01, we want records where expiry_date is null OR 1900-01-01
        // But the most reliable way with Supabase is to be explicit or use a RPC if complex.
        // For now, let's use a simpler approach that aligns with the DB constraint.

        let finalBatchId: string;
        if (targetBatch) {
            finalBatchId = targetBatch.id;
        } else {
            const { data: newBatch, error: batchCreateError } = await supabase
                .from('inventory_batches')
                .insert({
                    product_id,
                    batch_number: batch_number || '',
                    supplier: supplier || '',
                    buying_price: Number(unit_price) || 0,
                    expiry_date: expiry_date || null
                })
                .select()
                .single();
            
            if (batchCreateError) throw batchCreateError;
            finalBatchId = newBatch.id;
        }

        // 3. Update/Create Local Stock Instance (Item)
        const { data: stockEntry, error: stockLookupError } = await supabase
            .from('hotel_inventory_items')
            .select('*')
            .eq('batch_id', finalBatchId)
            .eq('department_id', input_department_id)
            .is('deleted_at', null)
            .maybeSingle();

        let finalItemId: string;
        let finalPreviousStock: number = 0;
        let finalNewStock: number;
        let isNewStockInstance = false;

        if (stockEntry) {
            finalItemId = stockEntry.id;
            finalPreviousStock = Number(stockEntry.current_stock);
            finalNewStock = finalPreviousStock + Number(received_quantity);

            const { error: updateError } = await supabase
                .from('hotel_inventory_items')
                .update({
                    current_stock: finalNewStock,
                    barcode: barcode || stockEntry.barcode,
                    updated_at: new Date().toISOString()
                })
                .eq('id', finalItemId);

            if (updateError) throw updateError;
        } else {
            isNewStockInstance = true;
            finalPreviousStock = 0;
            finalNewStock = Number(received_quantity);

            const { data: newItem, error: stockCreateError } = await supabase
                .from('hotel_inventory_items')
                .insert({
                    product_id,
                    batch_id: finalBatchId,
                    department_id: input_department_id,
                    name: productDetails.name, // Legacy support
                    category: productDetails.category, // Legacy support
                    unit: productDetails.unit, // Legacy support
                    brand: brand || '', // Legacy support
                    item_size: item_size || '', // Legacy support
                    batch_number: batch_number || '', // Legacy support
                    supplier: supplier || '', // Legacy support
                    current_stock: finalNewStock,
                    buying_price: Number(unit_price) || 0,
                    expiry_date: expiry_date || null,
                    barcode: barcode || null,
                    status: 'active',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (stockCreateError) throw stockCreateError;
            finalItemId = newItem.id;
        }

        // 4. Record Transaction with Batch tracking
        const { error: transactionError } = await supabase
            .from('inventory_transactions')
            .insert({
                item_id: finalItemId,
                batch_id: finalBatchId,
                transaction_type: 'receive',
                quantity: Number(received_quantity),
                previous_stock: finalPreviousStock,
                new_stock: finalNewStock,
                unit_price: Number(unit_price) || 0,
                batch_number: batch_number || '',
                supplier: supplier || '',
                expiry_date: expiry_date || null,
                barcode: barcode || null,
                item_size: item_size || '',
                brand: brand || '',
                remarks: notes || `Direct GRN Intake: ${received_quantity} ${productDetails.unit}`,
                created_by: payload.userId
            });

        if (transactionError) throw transactionError;

        // 5. Record Audit History
        await supabase.from('inventory_requests').insert({
            request_type: 'receive',
            item_id: finalItemId,
            requested_quantity: Number(received_quantity),
            status: 'COMPLETED',
            requested_by: payload.userId,
            reviewed_by: payload.userId,
            notes: notes || `Direct GRN: ${isNewStockInstance ? 'New Stock Instance' : 'Stock Replenish'}`,
            brand,
            item_size,
            supplier_name: supplier,
            action_metadata: {
                batch_id: finalBatchId,
                received_quantity: Number(received_quantity),
                unit_price: Number(unit_price) || 0
            }
        });

        return NextResponse.json({
            success: true,
            previous_stock: finalPreviousStock,
            new_stock: finalNewStock,
            target_id: finalItemId,
            batch_id: finalBatchId
        });

    } catch (error: any) {
        console.error('Direct GRN Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
