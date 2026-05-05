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
            .from('inventory_warehouses')
            .select(`
                *,
                department:inventory_departments(id, name)
            `)
            .order('name');

        if (!includeInactive) {
            query = query.eq('status', 'active');
        }

        const { data, error } = await query;

        if (error) throw error;

        return NextResponse.json({ warehouses: data }, { status: 200 });
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

        const { name, type, department_id, is_main, description } = await req.json();

        if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

        // If is_main is true, we should probably ensure no other warehouse is main
        // For simplicity and safety, we'll let the user manage this or we could add auto-unset logic
        // But let's keep it simple for now as requested.

        const { data, error } = await supabase
            .from('inventory_warehouses')
            .insert([{ 
                name, 
                type: type || 'Internal', 
                department_id, 
                is_main: is_main || false,
                description,
                status: 'active',
                is_active: true
            }])
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ warehouse: data }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const body = await req.json();
        const { id, ...updates } = body;

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        const { data, error } = await supabase
            .from('inventory_warehouses')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ warehouse: data }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
