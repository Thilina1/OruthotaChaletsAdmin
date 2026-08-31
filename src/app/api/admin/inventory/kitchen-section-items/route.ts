import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { decodeToken, verifyToken } from '@/lib/auth-utils';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const KITCHEN_SECTIONS = ['Staff', 'Function', 'A la carte', 'Room guest'] as const;

async function currentUser() {
    const token = (await cookies()).get('auth_token')?.value;
    if (!token || !(await verifyToken(token))) return null;
    return decodeToken(token);
}

export async function GET() {
    try {
        if (!(await currentUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data, error } = await supabase
            .from('kitchen_section_items')
            .select('id, section, item_id, created_at')
            .order('created_at');
        if (error) throw error;

        return NextResponse.json({ assignments: data || [] });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await currentUser() as any;
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { section, item_id } = await request.json();
        if (!KITCHEN_SECTIONS.includes(section) || !item_id) {
            return NextResponse.json({ error: 'A valid kitchen section and item_id are required.' }, { status: 400 });
        }

        const createdBy = user.userId || user.id || user.sub;
        const { data, error } = await supabase
            .from('kitchen_section_items')
            .upsert({ section, item_id, created_by: createdBy }, { onConflict: 'section,item_id' })
            .select('id, section, item_id, created_at')
            .single();
        if (error) throw error;

        return NextResponse.json({ assignment: data }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        if (!(await currentUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const section = searchParams.get('section');
        const itemId = searchParams.get('item_id');
        if (!section || !itemId || !KITCHEN_SECTIONS.includes(section as any)) {
            return NextResponse.json({ error: 'A valid kitchen section and item_id are required.' }, { status: 400 });
        }

        const { error } = await supabase
            .from('kitchen_section_items')
            .delete()
            .eq('section', section)
            .eq('item_id', itemId);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
