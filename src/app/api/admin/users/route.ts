import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { hashPassword } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use service role if available for reliable user creation
const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function GET() {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .order('name');

        if (error) throw error;
        return NextResponse.json({ users });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { name, email, password, role, phone_number, address, nic, job_title, department, join_date, permissions, restrict_admin_permissions } = await request.json();

        if (!email || !password || !name || !role) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        // Check if user exists
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (existingUser) {
            return NextResponse.json({ error: 'User already exists' }, { status: 400 });
        }

        const hashedPassword = await hashPassword(password);

        // Create user
        const { data, error } = await supabase
            .from('users')
            .insert({
                email,
                password: hashedPassword,
                name,
                role,
                phone_number,
                address,
                nic,
                job_title,
                department,
                join_date,
                permissions: permissions || [],
                restrict_admin_permissions: restrict_admin_permissions || false,
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ user: data }, { status: 201 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });
        }

        const data = await request.json();
        const { name, email, password, role, phone_number, address, nic, job_title, department, join_date, permissions, restrict_admin_permissions } = data;

        const updatePayload: any = {
            name,
            role,
            phone_number,
            address,
            nic,
            job_title,
            department,
            join_date,
            permissions: permissions || [],
            restrict_admin_permissions: restrict_admin_permissions !== undefined ? restrict_admin_permissions : false,
        };

        if (password) {
            updatePayload.password = await hashPassword(password);
        }

        const { data: updatedUser, error } = await supabase
            .from('users')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ user: updatedUser }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
