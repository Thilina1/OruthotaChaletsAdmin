import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
        return NextResponse.json({ user: null }, { status: 200 });
    }

    const payload = await verifyToken(token);

    if (!payload) {
        return NextResponse.json({ user: null }, { status: 200 }); // Invalid token
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    const { data: dbUser, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', payload.userId)
        .single();

    if (error || !dbUser) {
        return NextResponse.json({ user: null }, { status: 200 });
    }

    // Fetch leave scheme and working calendar names if assigned
    const [leaveSchemeRes, calendarRes] = await Promise.all([
        dbUser.leave_scheme_id
            ? supabase.from('leave_schemes').select('id, name, leave_scheme_types(id, name, days_count, reset_period)').eq('id', dbUser.leave_scheme_id).single()
            : Promise.resolve({ data: null }),
        dbUser.working_calendar_id
            ? supabase.from('working_calendars').select('id, name, year, description').eq('id', dbUser.working_calendar_id).single()
            : Promise.resolve({ data: null }),
    ]);

    const user = {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
        permissions: dbUser.permissions || [],
        department: dbUser.department,
        job_title: dbUser.job_title,
        join_date: dbUser.join_date,
        gender: dbUser.gender,
        phone_number: dbUser.phone_number,
        nic: dbUser.nic,
        address: dbUser.address,
        created_at: dbUser.created_at,
        restrict_admin_permissions: dbUser.restrict_admin_permissions || false,
        leave_scheme_id: dbUser.leave_scheme_id || null,
        working_calendar_id: dbUser.working_calendar_id || null,
        reporting_manager_id: dbUser.reporting_manager_id || null,
        leave_scheme: leaveSchemeRes.data || null,
        working_calendar: calendarRes.data || null,
    };

    return NextResponse.json({ user }, { status: 200 });
}
