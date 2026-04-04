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
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const dateFrom = searchParams.get('date_from');
        const dateTo = searchParams.get('date_to');

        // Fetch all inventory items with department info
        const { data: items, error: itemsError } = await supabase
            .from('hotel_inventory_items')
            .select(`
                *,
                department:inventory_departments(name)
            `)
            .order('name');

        if (itemsError) throw itemsError;

        // Fetch all transactions with item and user info, optionally filtered by date range
        let txnQuery = supabase
            .from('inventory_transactions')
            .select(`
                *,
                item:hotel_inventory_items(name, unit, category),
                user:users!inventory_transactions_created_by_fkey(name),
                ref_dept:inventory_departments!inventory_transactions_reference_department_fkey(name)
            `)
            .order('created_at', { ascending: false });

        if (dateFrom) {
            txnQuery = txnQuery.gte('created_at', `${dateFrom}T00:00:00.000Z`);
        }
        if (dateTo) {
            txnQuery = txnQuery.lte('created_at', `${dateTo}T23:59:59.999Z`);
        }

        const { data: transactions, error: txnError } = await txnQuery;
        if (txnError) throw txnError;

        // Fetch all departments for grouping in cost analysis
        const { data: departments, error: deptError } = await supabase
            .from('inventory_departments')
            .select('*')
            .order('name');

        if (deptError) throw deptError;

        return NextResponse.json({
            items: items || [],
            transactions: transactions || [],
            departments: departments || [],
        }, { status: 200 });
    } catch (error: any) {
        console.error('Inventory reports API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
