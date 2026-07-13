import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function auth() {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    return verifyToken(token);
}

function calcOtPay(
    otHours: number,
    settings: any,
    basicSalary: number,
    workingDays: number
): number {
    if (!settings) return 0;
    if (settings.calculation_method === 'flat_rate') {
        return Number(settings.flat_rate_per_hour) * otHours;
    }
    const hoursPerDay = Number(settings.standard_hours_per_day) || 8;
    const hourlyRate = workingDays > 0 ? basicSalary / workingDays / hoursPerDay : 0;
    return hourlyRate * Number(settings.ot_multiplier ?? 1.5) * otHours;
}

// GET
// ?asManager=true  — manager sees their direct reports' requests
// ?userId=X        — (admin only) filter by user
// ?month=YYYY-MM   — filter by payroll month
// ?status=X        — filter by status
export async function GET(request: Request) {
    const user = await auth();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const month = searchParams.get('month');
    const status = searchParams.get('status');
    const asManager = searchParams.get('asManager') === 'true';

    let query = supabase
        .from('ot_requests')
        .select('*, user:user_id(id,name,job_title,department,salary_details(basic_salary,working_days)), approver:approved_by(id,name)')
        .order('date', { ascending: false });

    if (user.role !== 'admin') {
        if (asManager) {
            // Manager: fetch direct reports first
            const { data: reports } = await supabase
                .from('users')
                .select('id')
                .eq('reporting_manager_id', user.userId);
            const ids = (reports ?? []).map((r: any) => r.id);
            if (ids.length === 0) return NextResponse.json({ requests: [] });
            query = query.in('user_id', ids);
        } else {
            query = query.eq('user_id', user.userId);
        }
    } else if (userId) {
        query = query.eq('user_id', userId);
    }

    if (month) query = query.eq('payroll_month', month);
    if (status) query = query.eq('status', status);

    const [reqResult, settingsResult] = await Promise.all([
        query,
        supabase.from('ot_settings').select('*').limit(1).maybeSingle(),
    ]);

    if (reqResult.error) return NextResponse.json({ error: reqResult.error.message }, { status: 500 });

    const settings = settingsResult.data;
    const requests = (reqResult.data ?? []).map((r: any) => {
        const salaryArr = r.user?.salary_details ?? [];
        const salary = salaryArr[0] ?? {};
        const basic = Number(salary.basic_salary ?? 0);
        const days = Number(salary.working_days ?? 22);
        const estimated_ot_pay = Math.round(calcOtPay(Number(r.ot_hours), settings, basic, days));
        return { ...r, estimated_ot_pay };
    });

    return NextResponse.json({ requests });
}

// POST — employee submits an OT request
export async function POST(request: Request) {
    const user = await auth();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { date, ot_hours, reason } = await request.json();
    if (!date || !ot_hours) return NextResponse.json({ error: 'date and ot_hours are required' }, { status: 400 });

    // Enforce per-user or global max OT hours per month
    const month = date.slice(0, 7);
    const [settingsRes, userLimitRes, existingRes] = await Promise.all([
        supabase.from('ot_settings').select('max_ot_hours_per_month').limit(1).maybeSingle(),
        supabase.from('ot_user_limits').select('max_ot_hours_per_month').eq('user_id', user.userId).maybeSingle(),
        supabase.from('ot_requests')
            .select('ot_hours')
            .eq('user_id', user.userId)
            .eq('payroll_month', month)
            .in('status', ['pending', 'manager_approved', 'approved']),
    ]);

    const globalMax = Number(settingsRes.data?.max_ot_hours_per_month ?? 0);
    const userMax = userLimitRes.data ? Number(userLimitRes.data.max_ot_hours_per_month) : null;
    const effectiveMax = userMax !== null ? userMax : globalMax;

    if (effectiveMax > 0) {
        const usedHours = (existingRes.data ?? []).reduce((s: number, r: any) => s + Number(r.ot_hours), 0);
        if (usedHours + Number(ot_hours) > effectiveMax) {
            return NextResponse.json(
                { error: `Exceeds maximum OT limit of ${effectiveMax}h for this month. Already submitted: ${usedHours}h.` },
                { status: 400 }
            );
        }
    }

    const { data, error } = await supabase
        .from('ot_requests')
        .insert({ user_id: user.userId, date, ot_hours: Number(ot_hours), reason, status: 'pending', payroll_month: month })
        .select('*, user:user_id(id,name)')
        .single();

    if (error) {
        if (error.code === '23505') return NextResponse.json({ error: 'OT already submitted for this date' }, { status: 409 });
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ request: data }, { status: 201 });
}

// PATCH — manager sets manager_approved/rejected; admin sets approved/rejected
export async function PATCH(request: Request) {
    const user = await auth();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, status, rejection_reason } = await request.json();
    if (!id || !['approved', 'rejected', 'manager_approved'].includes(status)) {
        return NextResponse.json({ error: 'id and valid status required' }, { status: 400 });
    }

    // Fetch the existing request
    const { data: otReq } = await supabase.from('ot_requests')
        .select('user_id, status').eq('id', id).single();
    if (!otReq) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const isAdmin = user.role === 'admin';

    if (!isAdmin) {
        // Manager flow: can only mark pending → manager_approved or rejected
        if (!['manager_approved', 'rejected'].includes(status)) {
            return NextResponse.json({ error: 'You can only approve (manager_approved) or reject' }, { status: 403 });
        }
        if (otReq.status !== 'pending') {
            return NextResponse.json({ error: 'Can only act on pending requests' }, { status: 400 });
        }
        // Verify this employee reports to the current user
        const { data: emp } = await supabase.from('users')
            .select('reporting_manager_id').eq('id', otReq.user_id).single();
        if (!emp || emp.reporting_manager_id !== user.userId) {
            return NextResponse.json({ error: 'This employee is not your direct report' }, { status: 403 });
        }
    } else {
        // Admin: approved or rejected only, on pending or manager_approved
        if (!['approved', 'rejected'].includes(status)) {
            return NextResponse.json({ error: 'Admin can only set approved or rejected' }, { status: 400 });
        }
        if (!['pending', 'manager_approved'].includes(otReq.status)) {
            return NextResponse.json({ error: 'Request is already finalised' }, { status: 400 });
        }
    }

    const payload: any = {
        status,
        approved_by: user.userId,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
    if (status === 'rejected') payload.rejection_reason = rejection_reason ?? '';

    const { data, error } = await supabase
        .from('ot_requests')
        .update(payload)
        .eq('id', id)
        .select('*, user:user_id(id,name)')
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ request: data });
}

// DELETE — employee cancels own pending; admin deletes any
export async function DELETE(request: Request) {
    const user = await auth();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const { data: existing } = await supabase.from('ot_requests').select('user_id, status').eq('id', id).single();
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (user.role !== 'admin') {
        if (existing.user_id !== user.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (existing.status !== 'pending') return NextResponse.json({ error: 'Cannot delete a non-pending request' }, { status: 400 });
    }

    const { error } = await supabase.from('ot_requests').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
