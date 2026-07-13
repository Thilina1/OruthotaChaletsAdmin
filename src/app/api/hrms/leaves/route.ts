import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    const supabase = await createClient();
    try {
        const { data: requests, error } = await supabase
            .from('leave_requests')
            .select(`
                *,
                leave_type:leave_scheme_types!leave_type_id(id, name, days_count),
                employee:users!user_id(id, name, email, reporting_manager_id),
                approver:users!approved_by(id, name),
                manager_approver:users!manager_approved_by(id, name)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return NextResponse.json({ leaves: requests });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const supabase = await createClient();
    try {
        const body = await request.json();
        const { user_id, leave_type_id, start_date, end_date, days_count, half_day_type, reason } = body;

        // Check if this employee has a reporting manager — if so, start at pending_manager
        const { data: userRecord } = await supabase
            .from('users')
            .select('reporting_manager_id')
            .eq('id', user_id)
            .single();

        const initialStatus = userRecord?.reporting_manager_id ? 'pending_manager' : 'pending';

        const { data: leave, error } = await supabase
            .from('leave_requests')
            .insert([{
                user_id,
                leave_type_id,
                start_date,
                end_date,
                days_count,
                half_day_type: half_day_type || null,
                reason,
                status: initialStatus,
            }])
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ leave });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const supabase = await createClient();
    try {
        const body = await request.json();
        const { id, status, approved_by, action_type } = body;

        let updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };

        if (action_type === 'manager') {
            // Reporting manager acting on a pending_manager request
            if (status === 'rejected') {
                updatePayload.status = 'rejected';
                updatePayload.manager_approved_by = approved_by;
                updatePayload.manager_approved_at = new Date().toISOString();
            } else {
                // Manager approved — escalate to 2nd level
                updatePayload.status = 'pending';
                updatePayload.manager_approved_by = approved_by;
                updatePayload.manager_approved_at = new Date().toISOString();
            }
        } else {
            // Final (2nd level / admin) approval
            updatePayload.status = status;
            updatePayload.approved_by = approved_by;
        }

        const { data: leave, error } = await supabase
            .from('leave_requests')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ leave });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
