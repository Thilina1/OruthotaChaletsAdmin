import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ROLE_DEFAULT_PERMISSIONS } from '@/lib/section-groups';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET → returns { permissions: { waiter: [...], kitchen: [...], payment: [...], admin: [...] } }
export async function GET() {
    try {
        const { data, error } = await supabase
            .from('role_permissions')
            .select('role, paths');

        if (error) throw error;

        // Build map; fall back to hardcoded defaults when table is empty or paths not yet set
        const map: Record<string, string[]> = { ...ROLE_DEFAULT_PERMISSIONS };
        for (const row of data || []) {
            const paths = Array.isArray(row.paths) ? row.paths : [];
            // Empty array means "never explicitly saved" — keep the defaults
            map[row.role] = paths.length > 0 ? paths : (ROLE_DEFAULT_PERMISSIONS[row.role] ?? []);
        }

        return NextResponse.json({ permissions: map });
    } catch {
        // Table might not exist yet — return defaults
        return NextResponse.json({ permissions: ROLE_DEFAULT_PERMISSIONS });
    }
}

// PUT { role, paths } → upsert permissions for one role
export async function PUT(request: Request) {
    try {
        const { role, paths } = await request.json();
        const { data, error } = await supabase
            .from('role_permissions')
            .upsert([{ role, paths, updated_at: new Date().toISOString() }], { onConflict: 'role' })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ permission: data });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

// PATCH { oldRole, newRole } → rename a role and update all users who have it
export async function PATCH(request: Request) {
    try {
        const { oldRole, newRole } = await request.json();
        const builtIn = ['admin', 'waiter', 'kitchen', 'payment'];
        if (builtIn.includes(oldRole)) {
            return NextResponse.json({ error: 'Cannot rename built-in roles.' }, { status: 400 });
        }
        const cleanNew = newRole.trim().toLowerCase().replace(/\s+/g, '_');
        if (!cleanNew) return NextResponse.json({ error: 'New role name is required.' }, { status: 400 });

        // Get existing paths for old role
        const { data: existing } = await supabase
            .from('role_permissions')
            .select('paths')
            .eq('role', oldRole)
            .single();

        // Insert new role row
        const { error: insertErr } = await supabase
            .from('role_permissions')
            .insert([{ role: cleanNew, paths: existing?.paths ?? [] }]);
        if (insertErr) throw insertErr;

        // Update users that had the old role
        await supabase.from('users').update({ role: cleanNew }).eq('role', oldRole);

        // Delete old role row
        const { error: delErr } = await supabase.from('role_permissions').delete().eq('role', oldRole);
        if (delErr) throw delErr;

        return NextResponse.json({ success: true, newRole: cleanNew });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

// DELETE { role } → remove a custom role (cannot delete built-in roles)
export async function DELETE(request: Request) {
    try {
        const { role } = await request.json();
        const builtIn = ['admin', 'waiter', 'kitchen', 'payment'];
        if (builtIn.includes(role)) {
            return NextResponse.json({ error: 'Cannot delete built-in roles.' }, { status: 400 });
        }
        const { error } = await supabase.from('role_permissions').delete().eq('role', role);
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
