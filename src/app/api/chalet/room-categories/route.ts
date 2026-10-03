import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!);

async function assertUser() {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return false;
    return !!(await verifyToken(token));
}

const arrayValue = (value: unknown) => Array.isArray(value) ? value.filter(Boolean) : [];

export async function GET() {
    try {
        if (!(await assertUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { data, error } = await supabase
            .from('chalet_room_categories')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true });
        if (error) throw error;
        return NextResponse.json({ categories: data ?? [] }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        if (!(await assertUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        if (!body.name) return NextResponse.json({ error: 'Category name is required' }, { status: 400 });

        const { data, error } = await supabase
            .from('chalet_room_categories')
            .insert({
                name: body.name,
                slug: body.slug || null,
                description: body.description || null,
                area_sqm: Number(body.area_sqm || 0) || null,
                room_count: Number(body.room_count || 1),
                max_adults: Number(body.max_adults || 1),
                max_children: Number(body.max_children || 0),
                max_guests: Number(body.max_guests || 1),
                bed_configurations: arrayValue(body.bed_configurations),
                bathroom_features: arrayValue(body.bathroom_features),
                entertainment_features: arrayValue(body.entertainment_features),
                general_amenities: arrayValue(body.general_amenities),
                internet_features: arrayValue(body.internet_features),
                image_urls: arrayValue(body.image_urls),
                sort_order: Number(body.sort_order || 0),
                is_active: body.is_active ?? true,
            })
            .select()
            .single();
        if (error) throw error;
        return NextResponse.json({ category: data }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        if (!(await assertUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        if (!body.id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        const { data, error } = await supabase
            .from('chalet_room_categories')
            .update({
                name: body.name,
                slug: body.slug || null,
                description: body.description || null,
                area_sqm: Number(body.area_sqm || 0) || null,
                room_count: Number(body.room_count || 1),
                max_adults: Number(body.max_adults || 1),
                max_children: Number(body.max_children || 0),
                max_guests: Number(body.max_guests || 1),
                bed_configurations: arrayValue(body.bed_configurations),
                bathroom_features: arrayValue(body.bathroom_features),
                entertainment_features: arrayValue(body.entertainment_features),
                general_amenities: arrayValue(body.general_amenities),
                internet_features: arrayValue(body.internet_features),
                image_urls: arrayValue(body.image_urls),
                sort_order: Number(body.sort_order || 0),
                is_active: body.is_active ?? true,
                updated_at: new Date().toISOString(),
            })
            .eq('id', body.id)
            .select()
            .single();
        if (error) throw error;
        return NextResponse.json({ category: data }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        if (!(await assertUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        const { error } = await supabase.from('chalet_room_categories').delete().eq('id', id);
        if (error) throw error;
        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
