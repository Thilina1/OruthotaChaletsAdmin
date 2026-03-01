import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
        return NextResponse.json({ user: null }, { status: 200 });
    }

    const payload = await verifyToken(token);

    if (!payload) {
        return NextResponse.json({ user: null }, { status: 200 }); // Invalid token
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    const { data: dbUser, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', payload.userId)
        .single();

    if (error || !dbUser) {
        return NextResponse.json({ user: null }, { status: 200 });
    }

    const user = {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
        permissions: dbUser.permissions || [],
    };

    return NextResponse.json({ user }, { status: 200 });
}
