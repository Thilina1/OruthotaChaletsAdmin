import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@/lib/auth-utils';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

export async function GET(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const verifiedUser = token ? await verifyToken(token) : null;

    if (!verifiedUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    try {
        let query = supabase
            .from('salary_details')
            .select(`
        *,
        users (
          name,
          email,
          role
        )
      `);

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data: salaryDetails, error } = await query;

        if (error) throw error;

        return NextResponse.json({ salaryDetails });
    } catch (error) {
        console.error('Error fetching salary details:', error);
        return NextResponse.json({ error: 'Error fetching salary details' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const verifiedUser = token ? await verifyToken(token) : null;

    if (!verifiedUser || verifiedUser.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized: Admins only' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { user_id, basic_salary, fixed_allowances } = body;

        const { data: salaryDetail, error } = await supabase
            .from('salary_details')
            .upsert([
                { user_id, basic_salary, fixed_allowances, updated_at: new Date().toISOString() }
            ], { onConflict: 'user_id' })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ salaryDetail });
    } catch (error) {
        console.error('Error updating salary details:', error);
        return NextResponse.json({ error: 'Error updating salary details' }, { status: 500 });
    }
}
