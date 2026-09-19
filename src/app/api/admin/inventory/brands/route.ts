import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!);

export async function GET() {
    try {
        const token = (await cookies()).get('auth_token')?.value;
        if (!token || !(await verifyToken(token))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { data, error } = await supabase
            .from('inventory_brands')
            .select('*')
            .order('name');

        if (error && !['PGRST205', '42P01'].includes(error.code)) throw error;
        const { data: items, error: itemsError } = await supabase
            .from('inventory_items').select('brand').not('brand', 'is', null);
        if (itemsError) throw itemsError;
        const brands = new Map((data || []).map(brand => [brand.name.trim().toLowerCase(), brand]));
        for (const item of items || []) {
            const name = item.brand?.trim();
            if (name && !brands.has(name.toLowerCase())) {
                brands.set(name.toLowerCase(), { id: `item-brand:${name}`, name });
            }
        }
        return NextResponse.json({ brands: [...brands.values()].sort((a, b) => a.name.localeCompare(b.name)) });
    } catch (error: any) {
        return NextResponse.json({ error: ['PGRST205', '42P01', 'PGRST202'].includes(error.code) ? 'Brand master setup is required. Please ask your administrator to apply the inventory brand migration.' : error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;

        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const body = await req.json();
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

        // Check if it already exists to avoid unique constraint error
        const { data: existing, error: lookupError } = await supabase
            .from('inventory_brands')
            .select('*')
            .eq('name', name)
            .maybeSingle();

        if (lookupError) throw lookupError;
        if (existing) {
            return NextResponse.json({ brand: existing }, { status: 200 });
        }

        const { data, error } = await supabase
            .from('inventory_brands')
            .insert([{ name }])
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ brand: data }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: ['PGRST205', '42P01', 'PGRST202'].includes(error.code) ? 'Brand master setup is required. Please ask your administrator to apply the inventory brand migration.' : error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const token = (await cookies()).get('auth_token')?.value;
        if (!token || !(await verifyToken(token))) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const body = await req.json();
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        const validId = typeof body.id === 'string' && (
            (body.id.startsWith('item-brand:') && body.id.length > 11) || /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(body.id)
        );
        if (!validId || !name) {
            return NextResponse.json({ error: 'A valid ID and name are required' }, { status: 400 });
        }
        if (!serviceRoleKey) {
            return NextResponse.json({ error: 'Brand editing requires the server Supabase service-role key to be configured.' }, { status: 503 });
        }
        const { data, error } = await supabase.rpc('rename_inventory_brand_master', {
            record_id: body.id,
            new_name: name,
        });
        if (error) throw error;
        return NextResponse.json({ brand: data });
    } catch (error: any) {
        const status = error.code === '23505' ? 409 : error.code === 'P0002' ? 404 : 500;
        return NextResponse.json({ error: error.message }, { status });
    }
}
