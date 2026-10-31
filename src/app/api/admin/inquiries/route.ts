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

const TYPES = ['general', 'experience'];

function inquiryType(value: string | null | undefined) {
    return TYPES.includes(value || '') ? value! : 'general';
}

async function isAuthorized() {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    return !!token && !!(await verifyToken(token));
}

// Website contact form messages: ?type=general (default) or ?type=experience.
export async function GET(request: Request) {
    try {
        if (!(await isAuthorized())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const type = inquiryType(new URL(request.url).searchParams.get('type'));

        const { data, error } = await supabase
            .from('contact_messages')
            .select('*')
            .eq('inquiry_type', type)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ inquiries: data }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        if (!(await isAuthorized())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id, status, type } = await request.json();
        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        if (!status || typeof status !== 'string') return NextResponse.json({ error: 'Status is required' }, { status: 400 });

        const { error } = await supabase
            .from('contact_messages')
            .update({ status })
            .eq('id', id)
            .eq('inquiry_type', inquiryType(type));

        if (error) throw error;

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
