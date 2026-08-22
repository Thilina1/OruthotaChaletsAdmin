import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth-utils';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function GET() {
    try {
        const { data, error } = await supabase
            .from('casual_workers')
            .select('*, system_user:users!user_id(email)')
            .order('name');
        if (error) throw error;
        return NextResponse.json({ workers: data });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, phone, nic, address, department, daily_rate, notes, system_access, email, password } = body;
        if (system_access && (!email?.trim() || !password || password.length < 6)) {
            return NextResponse.json({ error: 'Email and a password of at least 6 characters are required for system access.' }, { status: 400 });
        }
        const { data, error } = await supabase
            .from('casual_workers')
            .insert([{ name, phone, nic, address, department, daily_rate: Number(daily_rate) || 0, notes, system_access: false }])
            .select()
            .single();
        if (error) throw error;

        if (system_access) {
            const { data: systemUser, error: userError } = await supabase.from('users').insert({
                name,
                email: email.trim().toLowerCase(),
                password: await hashPassword(password),
                employee_number: data.employee_number,
                role: 'temporary',
                phone_number: phone || null,
                nic: nic || null,
                address: address || null,
                department: department || null,
                job_title: 'Casual Worker',
                permissions: ['/dashboard/profile', '/dashboard/hrms/attendance'],
                restrict_admin_permissions: true,
            }).select('id').single();

            if (userError || !systemUser) {
                await supabase.from('casual_workers').delete().eq('id', data.id);
                throw userError || new Error('Could not create the login account.');
            }

            const { data: linkedWorker, error: linkError } = await supabase
                .from('casual_workers')
                .update({ user_id: systemUser.id, system_access: true })
                .eq('id', data.id)
                .select()
                .single();
            if (linkError) throw linkError;
            return NextResponse.json({ worker: linkedWorker }, { status: 201 });
        }
        return NextResponse.json({ worker: data }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, name, phone, nic, address, department, daily_rate, is_active, notes, system_access, email, password } = body;
        const { data: existing, error: existingError } = await supabase
            .from('casual_workers')
            .select('id, user_id, employee_number, system_access')
            .eq('id', id)
            .single();
        if (existingError) throw existingError;

        let linkedUserId = existing.user_id;
        if (system_access && linkedUserId && !existing.system_access && (!password || password.length < 6)) {
            return NextResponse.json({ error: 'A password of at least 6 characters is required to restore system access.' }, { status: 400 });
        }
        if (system_access && !linkedUserId) {
            if (!email?.trim() || !password || password.length < 6) {
                return NextResponse.json({ error: 'Email and a password of at least 6 characters are required to enable system access.' }, { status: 400 });
            }
            const { data: newUser, error: newUserError } = await supabase.from('users').insert({
                name, email: email.trim().toLowerCase(), password: await hashPassword(password),
                employee_number: existing.employee_number, role: 'temporary', phone_number: phone || null,
                nic: nic || null, address: address || null, department: department || null,
                job_title: 'Casual Worker', permissions: ['/dashboard/profile', '/dashboard/hrms/attendance'],
                restrict_admin_permissions: true,
            }).select('id').single();
            if (newUserError) throw newUserError;
            linkedUserId = newUser.id;
        } else if (linkedUserId) {
            const userUpdate: Record<string, unknown> = {
                name, email: email?.trim().toLowerCase(), phone_number: phone || null, nic: nic || null,
                address: address || null, department: department || null,
                password: system_access ? undefined : null,
            };
            if (system_access && password) userUpdate.password = await hashPassword(password);
            Object.keys(userUpdate).forEach(key => userUpdate[key] === undefined && delete userUpdate[key]);
            const { error: userUpdateError } = await supabase.from('users').update(userUpdate).eq('id', linkedUserId);
            if (userUpdateError) throw userUpdateError;
        }

        const { data, error } = await supabase
            .from('casual_workers')
            .update({ name, phone, nic, address, department, daily_rate: Number(daily_rate) || 0, is_active, notes, system_access: !!system_access, user_id: linkedUserId, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return NextResponse.json({ worker: data });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
        const { error } = await supabase.from('casual_workers').delete().eq('id', id);
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
