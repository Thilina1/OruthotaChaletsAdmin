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
            item_id,
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

        if (!item_id || !received_quantity) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Fetch current item stock
        const { data: itemData, error: itemError } = await supabase
            .from('hotel_inventory_items')
            .select('current_stock, name, unit')
            .eq('id', item_id)
            .single();

        if (itemError || !itemData) {
            return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }

        const previousStock = Number(itemData.current_stock);
        const newStock = previousStock + Number(received_quantity);

        // 2. Update stock level
        const { error: updateError } = await supabase
            .from('hotel_inventory_items')
            .update({ 
                current_stock: newStock,
                updated_at: new Date().toISOString()
            })
            .eq('id', item_id);

        if (updateError) throw updateError;

        // 3. Record transaction
        const { error: transactionError } = await supabase
            .from('inventory_transactions')
            .insert({
                item_id,
                transaction_type: 'receive',
                quantity: Number(received_quantity),
                previous_stock: previousStock,
                new_stock: newStock,
                unit_price: Number(unit_price) || 0,
                batch_number,
                supplier,
                expiry_date,
                barcode,
                item_size: item_size || (itemData as any).item_size,
                brand,
                remarks: notes || `Direct GRN: ${received_quantity} ${itemData.unit} of ${itemData.name}`,
                created_by: payload.userId
            });

        if (transactionError) throw transactionError;

        // 4. Record as a completed request for audit history
        await supabase.from('inventory_requests').insert({
            request_type: 'receive',
            item_id,
            requested_quantity: Number(received_quantity),
            status: 'COMPLETED',
            requested_by: payload.userId,
            reviewed_by: payload.userId,
            notes: notes || 'Direct GRN bypass approval',
            action_metadata: {
                received_quantity: Number(received_quantity),
                unit_price: Number(unit_price) || 0,
                batch_number,
                supplier,
                expiry_date,
                barcode,
                item_size,
                brand
            }
        });

        return NextResponse.json({ 
            success: true, 
            previous_stock: previousStock, 
            new_stock: newStock 
        });

    } catch (error: any) {
        console.error('Direct GRN Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
