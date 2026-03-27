import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/client'; // Using client with service role ideally, but for now we use client side lib if RLS allows or need server side admin
import { createClient as createServerClient } from '@supabase/supabase-js';
import { hashPassword, signToken } from '@/lib/auth-utils';
import { cookies } from 'next/headers';

// We need admin access to insert directly if RLS blocks or use a service role client here
// For API routes, better to use service role if available or ensure RLS allows public insert (which we have for 'users' maybe?)
// Let's us standard supabase-js with service key if available, else standard client

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use service role if available for reliable user creation, falling back to public client might be risky with RLS
// Assuming the user has set the key given previous context
const supabase = serviceRoleKey
    ? createServerClient(supabaseUrl, serviceRoleKey)
    : createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function POST(request: Request) {
    try {
        const { email, password, confirmPassword, gender } = await request.json();

        if (!email || !password || !confirmPassword) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        if (password !== confirmPassword) {
            return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
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
        const name = email.split('@')[0];

        // Create user
        const { data, error } = await supabase
            .from('users')
            .insert({
                email,
                password: hashedPassword,
                name,
                role: 'admin', // Default role
                gender,
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Create session
        const token = await signToken({ userId: data.id, email: data.email, role: data.role, name: data.name });

        // Set cookie
        // You cannot await cookies() inside set, you await cookies() to get the cookies object
        const cookieStore = await cookies();
        cookieStore.set('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24, // 1 day
            path: '/',
        });

        return NextResponse.json({ user: data }, { status: 201 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
