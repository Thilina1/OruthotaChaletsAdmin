import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth-utils';

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    try {
        const fetchSafely = async (tableName: string) => {
            try {
                const { data, error } = await supabase.from(tableName).select('name').order('name');
                if (error) return [];
                return data?.map(i => i.name) || [];
            } catch (err) {
                return [];
            }
        };

        const [brands, suppliers, units, sizes] = await Promise.all([
            fetchSafely('inventory_brands'),
            fetchSafely('inventory_suppliers'),
            fetchSafely('inventory_units'),
            fetchSafely('inventory_sizes')
        ]);

        return NextResponse.json({ brands, suppliers, units, sizes });

    } catch (error: any) {
        console.error('Inventory Metadata Resilient Fetch Error:', error);
        return NextResponse.json({
            brands: [], suppliers: [], units: [], sizes: []
        }, { status: 200 }); 
    }
}

export async function POST(req: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    try {
        const { type, name } = await req.json();

        if (!type || !name) {
            return NextResponse.json({ error: 'Type and name are required' }, { status: 400 });
        }

        const tableNameMap: Record<string, string> = {
            brand: 'inventory_brands',
            supplier: 'inventory_suppliers',
            unit: 'inventory_units',
            size: 'inventory_sizes'
        };

        const tableName = tableNameMap[type];
        if (!tableName) {
            return NextResponse.json({ error: 'Invalid metadata type' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from(tableName)
            .insert({ name: name.trim() })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') { 
                return NextResponse.json({ error: 'Already exists', name: name.trim() }, { status: 200 });
            }
            throw error;
        }

        return NextResponse.json({ success: true, data });

    } catch (error: any) {
        console.error('Inventory Metadata Create Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
