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
        const includeInactive = searchParams.get('all') === 'true';

        let query = supabase
            .from('inventory_departments')
            .select('*')
            .order('name');

        if (!includeInactive) {
            query = query.eq('status', 'active');
        }

        const { data, error } = await query;

        if (error) throw error;

        return NextResponse.json({ departments: data }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { name, description } = await req.json();

        if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

        const { data, error } = await supabase
            .from('inventory_departments')
            .insert([{ name, description, status: 'active' }])
            .select()
            .single();

        if (error) throw error;

        // Note: Linked warehouse creation is now handled automatically by a DB trigger
        // (trigger_sync_department_warehouse on inventory_departments)

        return NextResponse.json({ department: data }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const user = await verifyToken(token);
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Admins only' }, { status: 403 });
        }

        const { id, status } = await req.json();
        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        if (status !== 'active') {
            return NextResponse.json({ error: 'Only department reactivation is supported' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('inventory_departments')
            .update({ status: 'active' })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // The department sync trigger reactivates its linked warehouse.
        return NextResponse.json({ department: data, action: 'activated' }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        const { data: linkedWarehouses, error: warehouseError } = await supabase
            .from('inventory_warehouses')
            .select('id')
            .eq('department_id', id);

        if (warehouseError) throw warehouseError;

        const warehouseIds = (linkedWarehouses || []).map(warehouse => warehouse.id);
        const referenceIds = Array.from(new Set([id, ...warehouseIds]));

        const usageChecks = [
            ...warehouseIds.map(warehouseId =>
                supabase.from('inventory_stock').select('id').eq('warehouse_id', warehouseId).limit(1)
            ),
            supabase.from('inventory_transactions').select('id').in('department_id', referenceIds).limit(1),
            supabase.from('inventory_transactions').select('id').in('from_department_id', referenceIds).limit(1),
            supabase.from('inventory_transactions').select('id').in('to_department_id', referenceIds).limit(1),
        ];

        const usageResults = await Promise.all(usageChecks);
        const usageError = usageResults.find(result => result.error)?.error;
        if (usageError) throw usageError;

        const isUsed = usageResults.some(result => (result.data?.length || 0) > 0);

        if (!isUsed) {
            const { error: deleteError } = await supabase
                .from('inventory_departments')
                .delete()
                .eq('id', id);

            if (!deleteError) {
                // ON DELETE CASCADE normally removes these rows. Delete by the
                // captured IDs as well so cleanup is guaranteed if the live
                // database constraint differs from the migration definition.
                if (warehouseIds.length > 0) {
                    const { error: warehouseDeleteError } = await supabase
                        .from('inventory_warehouses')
                        .delete()
                        .in('id', warehouseIds);

                    if (warehouseDeleteError) throw warehouseDeleteError;
                }

                return NextResponse.json({ success: true, action: 'deleted' }, { status: 200 });
            }

            // An unknown dependent foreign key means the department is still in use.
            if (deleteError.code !== '23503') throw deleteError;
        }

        const { error: updateError } = await supabase
            .from('inventory_departments')
            .update({ status: 'inactive' })
            .eq('id', id);

        if (updateError) throw updateError;

        // The department sync trigger deactivates its linked warehouse as well.
        return NextResponse.json({ success: true, action: 'deactivated' }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
