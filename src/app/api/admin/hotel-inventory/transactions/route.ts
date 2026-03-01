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
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const item_id = searchParams.get('item_id');

        let query = supabase
            .from('inventory_transactions')
            .select(`
                *,
                item:hotel_inventory_items (name),
                department:inventory_departments (name),
                user:users (name)
            `)
            .order('created_at', { ascending: false });

        if (item_id) {
            query = query.eq('item_id', item_id);
        }

        const { data, error } = await query;

        if (error) throw error;

        return NextResponse.json({ transactions: data }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        // Get the current user
        const decoded = await decodeToken(token);
        const userId = decoded?.sub;

        const body = await request.json();
        const { item_id, transaction_type, quantity, reference_department, reason, remarks } = body;

        // Perform transaction logic (this really should be a stored procedure or transaction block
        // but since we are using Supabase JS client and standard setup we will do it sequentially)

        // 1. Get current item stock
        const { data: itemData, error: itemError } = await supabase
            .from('hotel_inventory_items')
            .select('current_stock')
            .eq('id', item_id)
            .single();

        if (itemError) throw itemError;

        const previousStock = Number(itemData.current_stock);
        let newStock = previousStock;

        // 2. Calculate new stock based on transaction_type
        const q = Number(quantity);
        if (transaction_type === 'receive' || transaction_type === 'initial_stock') {
            newStock += q;
        } else if (transaction_type === 'issue' || transaction_type === 'damage') {
            newStock -= q;
        } else if (transaction_type === 'audit_adjustment') {
            // For audit adjustment, quantity is the new actual stock, not the difference
            newStock = q;
        }

        // 3. Insert transaction
        const { data: transaction, error: txnError } = await supabase
            .from('inventory_transactions')
            .insert({
                item_id,
                transaction_type,
                quantity: transaction_type === 'audit_adjustment' ? (q - previousStock) : q,
                previous_stock: previousStock,
                new_stock: newStock,
                reference_department,
                reason,
                remarks,
                created_by: userId
            })
            .select()
            .single();

        if (txnError) throw txnError;

        // 4. Update the item stock
        const { error: updateError } = await supabase
            .from('hotel_inventory_items')
            .update({ current_stock: newStock })
            .eq('id', item_id);

        if (updateError) throw updateError;

        return NextResponse.json({ transaction, current_stock: newStock }, { status: 201 });
    } catch (error: any) {
        console.error('Transaction Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
