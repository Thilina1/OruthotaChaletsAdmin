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

export async function GET() {
    try {
        if (!(await assertUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { data, error } = await supabase
            .from('chalet_meal_plans')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true });
        if (error) throw error;
        return NextResponse.json({ mealPlans: data ?? [] }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        if (!(await assertUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        if (!body.name?.trim()) return NextResponse.json({ error: 'Meal plan name is required' }, { status: 400 });

        const { data, error } = await supabase
            .from('chalet_meal_plans')
            .insert({
                name: body.name.trim(),
                description: body.description?.trim() || null,
                food_items: Array.isArray(body.food_items) ? body.food_items : [],
                other_costs: Array.isArray(body.other_costs) ? body.other_costs : [],
                sort_order: Number(body.sort_order || 0),
                is_active: body.is_active ?? true,
            })
            .select()
            .single();
        if (error) throw error;
        return NextResponse.json({ mealPlan: data }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        if (!(await assertUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        if (!body.id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        if (!body.name?.trim()) return NextResponse.json({ error: 'Meal plan name is required' }, { status: 400 });

        const { data, error } = await supabase
            .from('chalet_meal_plans')
            .update({
                name: body.name.trim(),
                description: body.description?.trim() || null,
                food_items: Array.isArray(body.food_items) ? body.food_items : [],
                other_costs: Array.isArray(body.other_costs) ? body.other_costs : [],
                sort_order: Number(body.sort_order || 0),
                is_active: body.is_active ?? true,
                updated_at: new Date().toISOString(),
            })
            .eq('id', body.id)
            .select()
            .single();
        if (error) throw error;
        return NextResponse.json({ mealPlan: data }, { status: 200 });
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
        const { error } = await supabase.from('chalet_meal_plans').delete().eq('id', id);
        if (error) throw error;
        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
