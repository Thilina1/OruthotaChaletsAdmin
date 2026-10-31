import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use service role to bypass RLS
const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!);

async function isAuthorized() {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    return !!token && !!(await verifyToken(token));
}

function duplicateError(error: any) {
    return error?.code === '23505'
        ? NextResponse.json({ error: 'A line item with this name already exists for this service.' }, { status: 409 })
        : null;
}

export async function GET(request: Request) {
    try {
        if (!(await isAuthorized())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const serviceType = searchParams.get('service_type');
        const activeOnly = searchParams.get('active') === 'true';

        let query = supabase
            .from('service_line_item_masters')
            .select('*')
            .order('service_type', { ascending: true })
            .order('name', { ascending: true });

        if (serviceType) query = query.eq('service_type', serviceType);
        if (activeOnly) query = query.eq('is_active', true);

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json({ items: data }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        if (!(await isAuthorized())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { service_type, name, default_amount, is_active } = await request.json();
        if (!service_type || !name?.trim()) {
            return NextResponse.json({ error: 'Service and name are required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('service_line_item_masters')
            .insert({
                service_type,
                name: name.trim(),
                default_amount: Number(default_amount) || 0,
                is_active: is_active ?? true,
            })
            .select()
            .single();

        if (error) return duplicateError(error) ?? NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ item: data }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        if (!(await isAuthorized())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id, service_type, name, default_amount, is_active } = await request.json();
        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        const update: Record<string, any> = { updated_at: new Date().toISOString() };
        if (service_type !== undefined) update.service_type = service_type;
        if (name !== undefined) {
            if (!name.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
            update.name = name.trim();
        }
        if (default_amount !== undefined) update.default_amount = Number(default_amount) || 0;
        if (is_active !== undefined) update.is_active = !!is_active;

        const { data, error } = await supabase
            .from('service_line_item_masters')
            .update(update)
            .eq('id', id)
            .select()
            .single();

        if (error) return duplicateError(error) ?? NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ item: data }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        if (!(await isAuthorized())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        const { error } = await supabase
            .from('service_line_item_masters')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
