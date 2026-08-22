import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@/lib/auth-utils';

export async function GET(request: Request) {
  const token = (await cookies()).get('auth_token')?.value;
  const authenticatedUser = token ? await verifyToken(token) : null;

  if (!authenticatedUser?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (authenticatedUser.role !== 'admin') {
    return NextResponse.json({ error: 'HRMS dashboard access is restricted to administrators.' }, { status: 403 });
  }

  const searchParams = new URL(request.url).searchParams;
  const date = searchParams.get('date');
  const month = searchParams.get('month');
  const isMonthly = Boolean(month);
  if ((!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) && (!month || !/^\d{4}-\d{2}$/.test(month))) {
    return NextResponse.json({ error: 'A valid date or month is required.' }, { status: 400 });
  }
  const from = isMonthly ? `${month}-01` : date!;
  const monthEnd = isMonthly ? new Date(Number(month!.slice(0, 4)), Number(month!.slice(5, 7)), 0).getDate() : null;
  const to = isMonthly ? `${month}-${String(monthEnd).padStart(2, '0')}` : date!;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const payrollMonth = month || date!.slice(0, 7);
    const [employeesResult, salariesResult, attendanceResult, leavesResult, reportsResult, overtimeResult, payrollResult, casualWorkersResult, dailyPaymentsResult] = await Promise.all([
      supabase
        .from('users')
        .select('id, employee_number, name, email, role, department, job_title')
        .order('name'),
      supabase
        .from('salary_details')
        .select('user_id'),
      supabase
        .from('attendance')
        .select('id, user_id, date, clock_in, clock_out, status')
        .gte('date', from)
        .lte('date', to),
      supabase
        .from('leave_requests')
        .select('id, user_id, start_date, end_date, days_count, half_day_type, status, reason, leave_type:leave_scheme_types!leave_type_id(name)')
        .lte('start_date', to)
        .gte('end_date', from)
        .in('status', ['approved', 'pending', 'pending_manager']),
      supabase
        .from('daily_reports')
        .select('id, user_id, date')
        .gte('date', from)
        .lte('date', to),
      supabase
        .from('ot_requests')
        .select('id, user_id, date, ot_hours, status')
        .gte('date', from)
        .lte('date', to),
      supabase
        .from('payroll_records')
        .select('id, user_id, basic_salary, allowances, gross_salary, deductions, epf_employee_8, tax, net_salary, status, released_at')
        .eq('month', payrollMonth),
      supabase
        .from('casual_workers')
        .select('id, name, phone, nic, department, daily_rate, is_active')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('daily_payments')
        .select('id, worker_id, date, daily_rate, day_type, amount, is_paid, paid_at')
        .gte('date', from)
        .lte('date', to),
    ]);

    const firstError = [employeesResult, salariesResult, attendanceResult, leavesResult, reportsResult, overtimeResult, payrollResult, casualWorkersResult, dailyPaymentsResult]
      .find(result => result.error)?.error;
    if (firstError) throw firstError;

    const salariedUserIds = new Set((salariesResult.data || []).map(item => item.user_id));
    const temporaryWorkers: any[] = (casualWorkersResult.data || []).map(worker => {
      const payments = (dailyPaymentsResult.data || []).filter(item => item.worker_id === worker.id);
      if (!isMonthly) return { ...worker, payment: payments[0] || null };
      return {
        ...worker,
        monthly: {
          full_days: payments.filter(item => item.day_type === 'full').length,
          half_days: payments.filter(item => item.day_type === 'half').length,
          absent_days: payments.filter(item => item.day_type === 'absent').length,
          total_earned: payments.reduce((sum, item) => sum + Number(item.amount || 0), 0),
          total_paid: payments.filter(item => item.is_paid).reduce((sum, item) => sum + Number(item.amount || 0), 0),
          total_unpaid: payments.filter(item => !item.is_paid).reduce((sum, item) => sum + Number(item.amount || 0), 0),
        },
      };
    });

    if (isMonthly) {
      const daysInRange = (start: string, end: string) => {
        const rangeStart = Math.max(Date.parse(`${start}T00:00:00Z`), Date.parse(`${from}T00:00:00Z`));
        const rangeEnd = Math.min(Date.parse(`${end}T00:00:00Z`), Date.parse(`${to}T00:00:00Z`));
        return rangeEnd < rangeStart ? 0 : Math.floor((rangeEnd - rangeStart) / 86_400_000) + 1;
      };

      const employees = (employeesResult.data || []).filter(employee => salariedUserIds.has(employee.id)).map(employee => {
        const attendance = (attendanceResult.data || []).filter(item => item.user_id === employee.id);
        const leaves = (leavesResult.data || []).filter(item => item.user_id === employee.id && item.status === 'approved');
        const overtime = (overtimeResult.data || []).filter(item => item.user_id === employee.id);
        const reportsSubmitted = (reportsResult.data || []).filter(item => item.user_id === employee.id).length;
        const payroll = (payrollResult.data || []).find(item => item.user_id === employee.id) || null;
        const workedHours = attendance.reduce((sum, item) => {
          if (!item.clock_in || !item.clock_out) return sum;
          return sum + Math.max(0, (Date.parse(item.clock_out) - Date.parse(item.clock_in)) / 3_600_000);
        }, 0);

        return {
          ...employee,
          monthly: {
            present_days: attendance.filter(item => item.status === 'present').length,
            absent_days: attendance.filter(item => item.status === 'absent').length,
            half_days: attendance.filter(item => item.status === 'half-day').length,
            leave_days: leaves.reduce((sum, item) => sum + daysInRange(item.start_date, item.end_date), 0),
            worked_hours: Number(workedHours.toFixed(1)),
            reports_submitted: reportsSubmitted,
            approved_ot_hours: overtime.filter(item => item.status === 'approved').reduce((sum, item) => sum + Number(item.ot_hours || 0), 0),
            pending_ot_hours: overtime.filter(item => item.status === 'pending').reduce((sum, item) => sum + Number(item.ot_hours || 0), 0),
          },
          payroll: payroll ? {
            ...payroll,
            total_deductions: Number(payroll.deductions || 0) + Number(payroll.epf_employee_8 || 0) + Number(payroll.tax || 0),
            payroll_status: payroll.released_at ? 'released' : payroll.status,
          } : null,
        };
      });

      const summary = {
        total: employees.length,
        present: employees.reduce((sum, item) => sum + item.monthly.present_days, 0),
        on_leave: employees.reduce((sum, item) => sum + item.monthly.leave_days, 0),
        absent: employees.reduce((sum, item) => sum + item.monthly.absent_days, 0),
        half_day: employees.reduce((sum, item) => sum + item.monthly.half_days, 0),
        not_marked: 0,
        clocked_in: 0,
        reports_submitted: employees.reduce((sum, item) => sum + item.monthly.reports_submitted, 0),
        pending_leave_requests: (leavesResult.data || []).filter(item => item.status !== 'approved').length,
        approved_ot_hours: employees.reduce((sum, item) => sum + item.monthly.approved_ot_hours, 0),
        worked_hours: employees.reduce((sum, item) => sum + item.monthly.worked_hours, 0),
        payroll_records: employees.filter(item => item.payroll).length,
        total_net_pay: employees.reduce((sum, item) => sum + Number(item.payroll?.net_salary || 0), 0),
      };
      const temporarySummary = {
        total: temporaryWorkers.length,
        full_days: temporaryWorkers.reduce((sum, item) => sum + (item.monthly?.full_days || 0), 0),
        half_days: temporaryWorkers.reduce((sum, item) => sum + (item.monthly?.half_days || 0), 0),
        absent_days: temporaryWorkers.reduce((sum, item) => sum + (item.monthly?.absent_days || 0), 0),
        total_earned: temporaryWorkers.reduce((sum, item) => sum + (item.monthly?.total_earned || 0), 0),
        total_paid: temporaryWorkers.reduce((sum, item) => sum + (item.monthly?.total_paid || 0), 0),
        total_unpaid: temporaryWorkers.reduce((sum, item) => sum + (item.monthly?.total_unpaid || 0), 0),
      };
      return NextResponse.json({ month, mode: 'monthly', summary, employees, temporary_workers: temporaryWorkers, temporary_summary: temporarySummary });
    }

    const attendanceByUser = new Map((attendanceResult.data || []).map(item => [item.user_id, item]));
    const leaveByUser = new Map((leavesResult.data || []).map(item => [item.user_id, item]));
    const reportUsers = new Set((reportsResult.data || []).map(item => item.user_id));
    const overtimeByUser = new Map((overtimeResult.data || []).map(item => [item.user_id, item]));

    const employees = (employeesResult.data || []).filter(employee => salariedUserIds.has(employee.id)).map(employee => {
      const attendance = attendanceByUser.get(employee.id) || null;
      const leave = leaveByUser.get(employee.id) || null;
      const overtime = overtimeByUser.get(employee.id) || null;
      const approvedLeave = leave?.status === 'approved';
      const status = approvedLeave ? 'on-leave' : attendance?.status || 'not-marked';

      return {
        ...employee,
        status,
        attendance,
        leave,
        overtime,
        report_submitted: reportUsers.has(employee.id),
      };
    });

    const summary = {
      total: employees.length,
      present: employees.filter(item => item.status === 'present').length,
      on_leave: employees.filter(item => item.status === 'on-leave').length,
      absent: employees.filter(item => item.status === 'absent').length,
      half_day: employees.filter(item => item.status === 'half-day').length,
      not_marked: employees.filter(item => item.status === 'not-marked').length,
      clocked_in: employees.filter(item => item.attendance?.clock_in && !item.attendance?.clock_out).length,
      reports_submitted: employees.filter(item => item.report_submitted).length,
      pending_leave_requests: (leavesResult.data || []).filter(item => item.status !== 'approved').length,
      approved_ot_hours: (overtimeResult.data || [])
        .filter(item => item.status === 'approved')
        .reduce((sum, item) => sum + Number(item.ot_hours || 0), 0),
    };

    const temporarySummary = {
      total: temporaryWorkers.length,
      present: temporaryWorkers.filter(item => item.payment && item.payment.day_type !== 'absent').length,
      absent: temporaryWorkers.filter(item => item.payment?.day_type === 'absent').length,
      not_marked: temporaryWorkers.filter(item => !item.payment).length,
      total_pay: temporaryWorkers.reduce((sum, item) => sum + Number(item.payment?.amount || 0), 0),
      paid: temporaryWorkers.filter(item => item.payment?.is_paid).reduce((sum, item) => sum + Number(item.payment?.amount || 0), 0),
    };
    return NextResponse.json({ date, mode: 'daily', summary, employees, temporary_workers: temporaryWorkers, temporary_summary: temporarySummary });
  } catch (error) {
    console.error('Error loading HRMS dashboard:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to load HRMS dashboard.' },
      { status: 500 },
    );
  }
}
