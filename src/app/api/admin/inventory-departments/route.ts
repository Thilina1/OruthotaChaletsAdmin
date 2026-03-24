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
            .select(`
                *,
                items_count:hotel_inventory_items(count)
            `)
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

        return NextResponse.json({ department: data }, { status: 201 });
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

        // 1. Check if ANY items are assigned to this department
        const { count, error: countError } = await supabase
            .from('hotel_inventory_items')
            .select('*', { count: 'exact', head: true })
            .eq('department_id', id);

        if (countError) throw countError;

        if (count && count > 0) {
            return NextResponse.json({
                error: `Cannot delete store. It still has ${count} inventory items associated with it. Please reassign them first.`
            }, { status: 400 });
        }

        // 2. Perform soft delete (deactivate)
        const { error: updateError } = await supabase
            .from('inventory_departments')
            .update({ status: 'inactive' })
            .eq('id', id);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
