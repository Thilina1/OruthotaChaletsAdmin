import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { comparePassword, signToken } from '@/lib/auth-utils';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; // use anon if service not available (requires RLS to allow select)

const supabase = createClient(supabaseUrl, serviceRoleKey);

export async function POST(request: Request) {
    try {
        const { email, identifier, password } = await request.json();
        const loginIdentifier = String(identifier || email || '').trim();

        if (!loginIdentifier || !password) {
            return NextResponse.json({ error: 'Missing email/employee number or password' }, { status: 400 });
        }

        const employeeNumber = /^\d{1,5}$/.test(loginIdentifier)
            ? loginIdentifier.padStart(4, '0')
            : null;
        let userQuery = supabase.from('users').select('*');
        userQuery = employeeNumber
            ? userQuery.eq('employee_number', employeeNumber)
            : userQuery.ilike('email', loginIdentifier);
        const { data: user, error } = await userQuery.single();

        if (error || !user) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        // Verify password
        // If user was created via Supabase Auth and migrated, they might not have a password hash in 'password' column yet.
        // Handling that case:
        if (!user.password) {
            return NextResponse.json({ error: 'Please reset your password or contact admin (Legacy Account)' }, { status: 401 });
        }

        const isValid = await comparePassword(password, user.password);

        if (!isValid) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        // Create session
        const token = await signToken({ userId: user.id, email: user.email, role: user.role, name: user.name });

        const cookieStore = await cookies();
        cookieStore.set('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24, // 1 day
            path: '/',
        });

        return NextResponse.json({ user }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
