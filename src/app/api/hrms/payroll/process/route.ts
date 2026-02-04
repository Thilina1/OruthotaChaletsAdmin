import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const supabase = await createClient();
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
    const supabase = await createClient();

    try {
        const body = await request.json();
        const { user_id, month, basic_salary, allowances, deductions = 0, tax = 0, status = 'processed' } = body;

        // Calculate Statutory Deductions
        // EPF Employee 8%
        const epf_employee_8 = basic_salary * 0.08;

        // EPF Employer 12%
        const epf_employer_12 = basic_salary * 0.12;

        // ETF Employer 3%
        const etf_employer_3 = basic_salary * 0.03;

        // Gross Salary (Earnings)
        const gross_salary = basic_salary + allowances;

        // Net Salary = Gross - EPF(8%) - Tax - Other Deductions
        const net_salary = gross_salary - epf_employee_8 - tax - deductions;

        const { data: payrollRecord, error } = await supabase
            .from('payroll_records')
            .insert([
                {
                    user_id,
                    month,
                    basic_salary,
                    allowances,
                    gross_salary,
                    epf_employee_8,
                    epf_employer_12,
                    etf_employer_3,
                    tax,
                    deductions,
                    net_salary,
                    status,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }
            ])
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ payrollRecord });
    } catch (error) {
        console.error('Error processing payroll:', error);
        return NextResponse.json({ error: 'Error processing payroll' }, { status: 500 });
    }
}
