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
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { data, error } = await supabase
            .from('chalet_rates')
            .select(`
                *,
                chalet_room_categories ( id, name, sort_order ),
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

// PUT: upsert array of {room_category_id?, package_id, rate_per_night, usd_rate_per_night, usd_to_lkr_rate, offer_name, discounts,
// adult_rate, child_rate, usd_adult_rate, usd_child_rate (per guest per night)}
export async function PUT(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const body = await request.json();
        const rates: {
            room_category_id?: string | null;
            package_id: string;
            occupancy_type_id?: string | null;
            rate_per_night: number;
            usd_rate_per_night?: number | null;
            usd_to_lkr_rate?: number | null;
            offer_name?: string | null;
            discount_percent?: number | null;
            lkr_discount_value?: number | null;
            lkr_discount_fixed_value?: number | null;
            usd_discount_value?: number | null;
            usd_discount_fixed_value?: number | null;
            adult_rate?: number | null;
            child_rate?: number | null;
            usd_adult_rate?: number | null;
            usd_child_rate?: number | null;
        }[] = body;

        if (!Array.isArray(rates) || rates.length === 0) {
            return NextResponse.json({ error: 'Rates array is required' }, { status: 400 });
        }

        const saved = [];
        for (const rate of rates) {
            let query = supabase
                .from('chalet_rates')
                .select('id')
                .eq('package_id', rate.package_id)
                .is('occupancy_type_id', null);
            query = rate.room_category_id
                ? query.eq('room_category_id', rate.room_category_id)
                : query.is('room_category_id', null);

            const { data: existing, error: lookupError } = await query.maybeSingle();
            if (lookupError) throw lookupError;

            const payload = {
                room_category_id: rate.room_category_id || null,
                package_id: rate.package_id,
                occupancy_type_id: null,
                rate_per_night: rate.rate_per_night,
                usd_rate_per_night: rate.usd_rate_per_night ?? 0,
                usd_to_lkr_rate: rate.usd_to_lkr_rate ?? 0,
                offer_name: rate.offer_name?.trim() || null,
                discount_percent: rate.discount_percent ?? 0,
                lkr_discount_value: rate.lkr_discount_value ?? 0,
                lkr_discount_fixed_value: rate.lkr_discount_fixed_value ?? 0,
                usd_discount_value: rate.usd_discount_value ?? 0,
                usd_discount_fixed_value: rate.usd_discount_fixed_value ?? 0,
                adult_rate: Math.max(0, Number(rate.adult_rate ?? 0)),
                child_rate: Math.max(0, Number(rate.child_rate ?? 0)),
                usd_adult_rate: Math.max(0, Number(rate.usd_adult_rate ?? 0)),
                usd_child_rate: Math.max(0, Number(rate.usd_child_rate ?? 0)),
                updated_at: new Date().toISOString(),
            };

            const result = existing
                ? await supabase.from('chalet_rates').update(payload).eq('id', existing.id).select().single()
                : await supabase.from('chalet_rates').insert(payload).select().single();
            if (result.error) {
                if (/adult_rate|child_rate/.test(result.error.message || '')) {
                    return NextResponse.json({
                        error: 'Adult and child rates need a database update first: run supabase/migrations/20261013000001_chalet_rate_guest_charges.sql in the Supabase SQL Editor.',
                    }, { status: 500 });
                }
                throw result.error;
            }
            saved.push(result.data);
        }

        return NextResponse.json({ rates: saved }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
