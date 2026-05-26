import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use service role to bypass RLS
const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function GET(request: Request) {
    try {
        const token = (await cookies()).get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search');

        let query = supabase
            .from('customers')
            .select('*')
            .order('created_at', { ascending: false });

        if (search) {
            query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,id_number.ilike.%${search}%`);
        }

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json({ customers: data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const token = (await cookies()).get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const body = await request.json();
        const { id, name, phone, email, id_number, address } = body;

        if (!id || !name) {
            return NextResponse.json({ error: 'ID and Name are required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('customers')
            .update({ 
                name, 
                phone, 
                email, 
                id_number,
                address,
                updated_at: new Date().toISOString() 
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ customer: data }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
