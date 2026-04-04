import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken, decodeToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const isValid = await verifyToken(token);
        if (!isValid) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { data, error } = await supabase
            .from('inventory_suppliers')
            .select('name')
            .order('name', { ascending: true });

        if (error) throw error;

        return NextResponse.json(data.map(s => s.name));
    } catch (error: any) {
        console.error("Inventory Suppliers Fetch Error:", error);
        return NextResponse.json({ error: error.message || "Failed to fetch suppliers" }, { status: 500 });
    }
}
