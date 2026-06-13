import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Use a direct client to avoid session conflicts with custom auth
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

    try {
        let query = supabase
            .from('payroll_records')
            .select(`
        *,
        users (
          name,
          email
        )
      `)
            .order('month', { ascending: false });

        if (userId) query = query.eq('user_id', userId);
        if (month) query = query.eq('month', month);

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
        const { user_id, month, basic_salary, allowances, deductions = 0, tax = 0, status = 'processed' } = body;

        if (!user_id || !month || basic_salary === undefined || allowances === undefined) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Calculate Statutory Deductions
        // EPF Employee 8%
        const epf_employee_8 = Number(basic_salary) * 0.08;

        // EPF Employer 12%
        const epf_employer_12 = Number(basic_salary) * 0.12;

        // ETF Employer 3%
        const etf_employer_3 = Number(basic_salary) * 0.03;

        // Gross Salary (Earnings)
        const gross_salary = Number(basic_salary) + Number(allowances);

        // Net Salary = Gross - EPF(8%) - Tax - Other Deductions
        const net_salary = gross_salary - epf_employee_8 - Number(tax) - Number(deductions);

        const payload = {
            user_id,
            month,
            basic_salary: Number(basic_salary),
            allowances: Number(allowances),
            gross_salary,
            epf_employee_8,
            epf_employer_12,
            etf_employer_3,
            tax: Number(tax),
            deductions: Number(deductions),
            net_salary,
            status,
            updated_at: new Date().toISOString()
        };

        // Check if record exists for this month/user to perform update or insert
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

        if (result.error) {
            console.error('Supabase error processing payroll:', result.error);
            throw result.error;
        }

        return NextResponse.json({ payrollRecord: result.data });
    } catch (error: any) {
        console.error('Error processing payroll:', error);
        return NextResponse.json({
            error: 'Error processing payroll',
            details: error?.message || 'Unknown error'
        }, { status: 500 });
    }
}
