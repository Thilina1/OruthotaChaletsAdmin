import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function GET() {
    try {
        const { data, error } = await supabase
            .from('inventory_units')
            .select('*')
            .order('name');

        if (error) throw error;
        return NextResponse.json({ units: data }, { status: 200 });
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

        // Check if it already exists to avoid unique constraint error
        const { data: existing } = await supabase
            .from('inventory_units')
            .select('*')
            .eq('name', name)
            .maybeSingle();

        if (existing) {
            return NextResponse.json({ unit: existing }, { status: 200 });
        }

        const { data, error } = await supabase
            .from('inventory_units')
            .insert([{ name, description, status: 'active' }])
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ unit: data }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const token = (await cookies()).get('auth_token')?.value;
        if (!token || !(await verifyToken(token))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const body = await req.json();
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        if (typeof body.id !== 'string' || !/^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(body.id) || !name) {
            return NextResponse.json({ error: 'A valid ID and name are required' }, { status: 400 });
        }
        const { data: records, error: lookupError } = await supabase.from('inventory_units').select('id, name');
        if (lookupError) throw lookupError;
        if (records?.some(record => record.id !== body.id && record.name.trim().toLowerCase() === name.toLowerCase())) {
            return NextResponse.json({ error: 'This name already exists' }, { status: 409 });
        }
        const { data, error } = await supabase.from('inventory_units')
            .update({ name, description: typeof body.description === 'string' ? body.description.trim() || null : null })
            .eq('id', body.id).select().maybeSingle();
        if (error) throw error;
        if (!data) return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        return NextResponse.json({ unit: data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: error.code === '23505' ? 409 : 500 });
    }
}
