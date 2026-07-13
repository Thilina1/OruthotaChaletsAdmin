import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const verifiedUser = token ? await verifyToken(token) : null;

    if (!verifiedUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const month = searchParams.get('month');
    const isAdmin = verifiedUser.role === 'admin';

    try {
        let query = supabase
            .from('payroll_records')
            .select('*, users(name, email, job_title, department)')
            .order('month', { ascending: false });

        if (isAdmin) {
            // Admins see all records for the requested scope
            if (userId) query = query.eq('user_id', userId);
            if (month) query = query.eq('month', month);
        } else {
            // Non-admins only see their own released records
            query = query
                .eq('user_id', verifiedUser.userId)
                .not('released_at', 'is', null);
            if (month) query = query.eq('month', month);
        }

        const { data: payrollRecords, error } = await query;
        if (error) throw error;

        return NextResponse.json({ payrollRecords });
    } catch (error) {
        console.error('Error fetching payroll records:', error);
        return NextResponse.json({ error: 'Error fetching payroll records' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const verifiedUser = token ? await verifyToken(token) : null;

    if (!verifiedUser || verifiedUser.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized: Admins only' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const {
            user_id, month, basic_salary, allowances,
            deductions = 0, tax = 0,
            leave_deduction = 0, joining_deduction = 0,
            ot_hours = 0, ot_pay = 0,
            service_charge = 0,
            status = 'processed',
            calculation_snapshot = null,
        } = body;

        if (!user_id || !month || basic_salary === undefined || allowances === undefined) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const effectiveBasic = Number(basic_salary) - Number(joining_deduction) - Number(leave_deduction);
        const epf_employee_8 = effectiveBasic * 0.08;
        const epf_employer_12 = effectiveBasic * 0.12;
        const etf_employer_3 = effectiveBasic * 0.03;
        const gross_salary = Number(basic_salary) + Number(allowances);
        const totalDeductions = Number(joining_deduction) + Number(leave_deduction) + Number(deductions);
        const net_salary = gross_salary + Number(ot_pay) + Number(service_charge) - epf_employee_8 - Number(tax) - totalDeductions;

        const payload = {
            user_id,
            month,
            basic_salary: Number(basic_salary),
            allowances: Number(allowances),
            gross_salary,
            ot_hours: Number(ot_hours),
            ot_pay: Number(ot_pay),
            service_charge: Number(service_charge),
            epf_employee_8,
            epf_employer_12,
            etf_employer_3,
            tax: Number(tax),
            deductions: totalDeductions,
            net_salary,
            status,
            calculation_snapshot,
            released_at: null,
            updated_at: new Date().toISOString(),
        };

        const { data: existing } = await supabase
            .from('payroll_records')
            .select('id')
            .eq('user_id', user_id)
            .eq('month', month)
            .maybeSingle();

        let result;
        if (existing) {
            result = await supabase
                .from('payroll_records')
                .update(payload)
                .eq('id', existing.id)
                .select()
                .single();
        } else {
            result = await supabase
                .from('payroll_records')
                .insert([{ ...payload, created_at: new Date().toISOString() }])
                .select()
                .single();
        }

        if (result.error) throw result.error;
        return NextResponse.json({ payrollRecord: result.data });
    } catch (error: any) {
        console.error('Error processing payroll:', error);
        return NextResponse.json({ error: 'Error processing payroll', details: error?.message }, { status: 500 });
    }
}

// Release payroll so employees can see it
export async function PATCH(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const verifiedUser = token ? await verifyToken(token) : null;

    if (!verifiedUser || verifiedUser.role !== 'admin') {
        return NextResponse.json({ error: 'Admins only' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const month = searchParams.get('month');

    if (!userId || !month) {
        return NextResponse.json({ error: 'userId and month required' }, { status: 400 });
    }

    const { error } = await supabase
        .from('payroll_records')
        .update({ released_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('month', month);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    const verifiedUser = token ? await verifyToken(token) : null;

    if (!verifiedUser || verifiedUser.role !== 'admin') {
        return NextResponse.json({ error: 'Admins only' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const month = searchParams.get('month');

    if (!userId || !month) {
        return NextResponse.json({ error: 'userId and month are required' }, { status: 400 });
    }

    const { error } = await supabase
        .from('payroll_records')
        .delete()
        .eq('user_id', userId)
        .eq('month', month);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
