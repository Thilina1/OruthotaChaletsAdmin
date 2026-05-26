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
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const serviceType = searchParams.get('service_type');

        let query = supabase
            .from('service_incomes')
            .select('*')
            .order('date', { ascending: false });

        if (serviceType) {
            query = query.eq('service_type', serviceType);
        }

        const { data, error } = await query;

        if (error) throw error;

        return NextResponse.json({ incomes: data }, { status: 200 });
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

        const body = await request.json();
        const { description, amount, service_type, date, customer_name, room_number, payment_status, payment_method, line_items } = body;

        let finalDescription = description;
        let finalAmount = amount;

        if (line_items && Array.isArray(line_items) && line_items.length > 0) {
            finalDescription = line_items.map((item: any) => item.description).join(', ');
            finalAmount = line_items.reduce((sum: number, item: any) => sum + Number(item.amount), 0);
        }

        if (!finalDescription || finalAmount === undefined || !service_type || !date) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        let customer_id = null;
        let finalCustomerName = customer_name;

        if (customer_name && customer_name.trim() !== '') {
            const { data: existingCustomer } = await supabase
                .from('customers')
                .select('id')
                .ilike('name', customer_name.trim())
                .limit(1)
                .single();
                
            if (existingCustomer) {
                customer_id = existingCustomer.id;
            } else {
                const { data: newCustomer } = await supabase
                    .from('customers')
                    .insert({ name: customer_name.trim() })
                    .select('id')
                    .single();
                if (newCustomer) customer_id = newCustomer.id;
            }
        } else {
            const randomId = Math.random().toString(36).substring(2, 6).toUpperCase();
            finalCustomerName = `Unknown-${randomId}`;
            const { data: newCustomer } = await supabase
                .from('customers')
                .insert({ name: finalCustomerName })
                .select('id')
                .single();
            if (newCustomer) customer_id = newCustomer.id;
        }

        const { data, error } = await supabase
            .from('service_incomes')
            .insert({ 
                description: finalDescription, 
                amount: finalAmount, 
                service_type, 
                date, 
                customer_name: finalCustomerName, 
                room_number, 
                customer_id,
                payment_status: payment_status || 'paid',
                payment_method: payment_method || null,
                line_items: line_items || []
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ income: data }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const body = await request.json();
        const { id, description, amount, service_type, date, customer_name, room_number, payment_status, payment_method, line_items } = body;

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        let finalDescription = description;
        let finalAmount = amount;

        if (line_items && Array.isArray(line_items) && line_items.length > 0) {
            finalDescription = line_items.map((item: any) => item.description).join(', ');
            finalAmount = line_items.reduce((sum: number, item: any) => sum + Number(item.amount), 0);
        }

        let customer_id = null;
        let finalCustomerName = customer_name;

        if (customer_name && customer_name.trim() !== '') {
            const { data: existingCustomer } = await supabase
                .from('customers')
                .select('id')
                .ilike('name', customer_name.trim())
                .limit(1)
                .single();
                
            if (existingCustomer) {
                customer_id = existingCustomer.id;
            } else {
                const { data: newCustomer } = await supabase
                    .from('customers')
                    .insert({ name: customer_name.trim() })
                    .select('id')
                    .single();
                if (newCustomer) customer_id = newCustomer.id;
            }
        }

        const { data, error } = await supabase
            .from('service_incomes')
            .update({ 
                description: finalDescription, 
                amount: finalAmount, 
                service_type, 
                date, 
                customer_name: finalCustomerName, 
                room_number,
                ...(customer_id ? { customer_id } : {}),
                payment_status: payment_status || 'paid',
                payment_method: payment_method || null,
                line_items: line_items || [],
                updated_at: new Date().toISOString() 
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ income: data }, { status: 200 });
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

        const { error } = await supabase
            .from('service_incomes')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
