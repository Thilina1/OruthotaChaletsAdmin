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
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { data, error } = await supabase
            .from('chalet_rates')
            .select(`
                *,
                chalet_packages ( id, name, sort_order ),
                chalet_occupancy_types ( id, name, sort_order )
            `)
            .order('updated_at', { ascending: false });

        if (error) throw error;
        return NextResponse.json({ rates: data }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT: upsert array of {package_id, occupancy_type_id, rate_per_night}
export async function PUT(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const body = await request.json();
        const rates: { package_id: string; occupancy_type_id: string; rate_per_night: number }[] = body;

        if (!Array.isArray(rates) || rates.length === 0) {
            return NextResponse.json({ error: 'Rates array is required' }, { status: 400 });
        }

        const upsertData = rates.map(r => ({
            package_id: r.package_id,
            occupancy_type_id: r.occupancy_type_id,
            rate_per_night: r.rate_per_night,
            updated_at: new Date().toISOString(),
        }));

        const { data, error } = await supabase
            .from('chalet_rates')
            .upsert(upsertData, { onConflict: 'package_id,occupancy_type_id' })
            .select();

        if (error) throw error;
        return NextResponse.json({ rates: data }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
